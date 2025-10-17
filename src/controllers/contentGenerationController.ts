// src/controllers/ContentGenerationController.ts
import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import OpenAI from "openai";
import dotenv from "dotenv";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";

import { AuthRequest } from "../types";

dotenv.config();

/**
 * Generation modes supported by this controller.
 * - RAW_XHTML: verbatim passthrough with script/style stripped, attributes preserved (width/height etc.), no wrappers/boilerplate.
 * - STRICT_NATIVE_BLOCKS: deterministic mapping to native blocks only (H2, P, Image/Video/Audio, UL/LI, Button). No templates, no <meta>, no <style>.
 */
type GenerationMode = "RAW_XHTML" | "STRICT_NATIVE_BLOCKS";

/* ------------------------------ Helpers & Schemas ------------------------------ */

/** Simple extension-based media type validation (no prefetch/CORS). */
const urlLooksLike = (url: string, kind: "image" | "video" | "audio") => {
  try {
    const u = new URL(url);
    const ext = (u.pathname.split(".").pop() || "").toLowerCase();
    if (kind === "image") return ["jpg", "jpeg", "png", "svg"].includes(ext);
    if (kind === "video") return ["mp4"].includes(ext);
    return ["mp3"].includes(ext);
  } catch {
    return false;
  }
};

/** RAW_XHTML passthrough sanitizer: strip scripts/styles & event handlers, preserve everything else. */
const sanitizePassthrough = (html: string) =>
  sanitizeHtml(html, {
    allowedTags: false, // allow standard tags
    allowedAttributes: false, // allow all attributes
    disallowedTagsMode: "discard",
    exclusiveFilter(frame: any) {
      if (frame && frame.attribs) {
        for (const key of Object.keys(frame.attribs)) {
          if (key.toLowerCase().startsWith("on")) {
            delete frame.attribs[key];
          }
        }
      }
      return false;
    },
    transformTags: {
      script: () => ({ tagName: "", attribs: {} }),
      style: () => ({ tagName: "", attribs: {} }),
    },
  });

/** Deterministic native block schema (STRICT_NATIVE_BLOCKS). */
const BlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("heading"),
    level: z.union([z.literal(2), z.literal(3), z.literal(4)]), // Allow H2, H3, H4
    text: z.string().min(1),
  }),
  z.object({
    type: z.literal("paragraph"),
    text: z.string().min(1),
  }),
  z.object({
    type: z.literal("image"),
    url: z.string().url(),
    alt: z.string().default(""),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal("video"),
    url: z.string().url(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    aspect: z
      .string()
      .regex(/^\d+:\d+$/)
      .optional(), // e.g., "16:9"
  }),
  z.object({
    type: z.literal("audio"),
    url: z.string().url(),
  }),
  z.object({
    type: z.literal("list"),
    items: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    type: z.literal("button"),
    text: z.string().min(1),
    href: z.string().min(1), // Allow any non-empty string (URLs or placeholders like {{VAR}})
  }),
]);

const StrictBlocksPayload = z.object({
  mode: z.literal("STRICT_NATIVE_BLOCKS"),
  blocks: z.array(BlockSchema).min(1),
});

const RawXHTMLPayload = z.object({
  mode: z.literal("RAW_XHTML"),
  html: z.string().min(1),
});

/** Enforce media whitelist (extension-based) without any prefetching. */
const enforceMediaWhitelist = (
  blocks: z.infer<typeof StrictBlocksPayload>["blocks"]
) => {
  for (const b of blocks) {
    if (b.type === "image" && !urlLooksLike(b.url, "image")) {
      throw new Error(`Image URL fails whitelist/extension check: ${b.url}`);
    }
    if (b.type === "video" && !urlLooksLike(b.url, "video")) {
      throw new Error(`Video URL fails whitelist/extension check: ${b.url}`);
    }
    if (b.type === "audio" && !urlLooksLike(b.url, "audio")) {
      throw new Error(`Audio URL fails whitelist/extension check: ${b.url}`);
    }
  }
};

/** Map blocks to EPUB-safe HTML without wrappers/boilerplate. */
const renderStrictBlocksToHTML = (
  blocks: z.infer<typeof StrictBlocksPayload>["blocks"]
) => {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return blocks
    .map((b) => {
      switch (b.type) {
        case "heading":
          return `<h${b.level}>${esc(b.text)}</h${b.level}>`;
        case "paragraph":
          return `<p>${esc(b.text)}</p>`;
        case "image": {
          const wh =
            (b.width ? ` width="${b.width}"` : "") +
            (b.height ? ` height="${b.height}"` : "");
          return `<img src="${b.url}" alt="${esc(b.alt)}"${wh} />`;
        }
        case "video": {
          const wh =
            (b.width ? ` width="${b.width}"` : "") +
            (b.height ? ` height="${b.height}"` : "");
          return (
            `<video controls="controls"${wh}>` +
            `<source src="${b.url}" type="video/mp4" />` +
            `</video>`
          );
        }
        case "audio":
          return (
            `<audio controls="controls">` +
            `<source src="${b.url}" type="audio/mpeg" />` +
            `</audio>`
          );
        case "list":
          return `<ul>${b.items
            .map((i) => `<li>${esc(i)}</li>`)
            .join("")}</ul>`;
        case "button":
          return `<a href="${b.href}">${esc(b.text)}</a>`;
      }
    })
    .join("\n");
};

/** Extract JSON object from a string that may contain code fences or prose. */
const extractJsonObject = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      return JSON.parse(m[0]);
    }
    throw new Error("Model did not return valid JSON.");
  }
};

/* -------------------------------- Controller --------------------------------- */

export class ContentGenerationController {
  private static openai: OpenAI | null = null;
  // Default to GPT-5; allow override via env if your account doesn't have access yet.
  private static defaultModel = process.env.OPENAI_MODEL?.trim() || "gpt-5";

  static initialize() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn(
        "⚠️  OpenAI API key not found. Content generation will be disabled."
      );
      return;
    }
    ContentGenerationController.openai = new OpenAI({
      apiKey,
      timeout: 600000, // 10 minutes (600 seconds) - increased from default 10 minutes for long content
      maxRetries: 2,
    });
    console.log(
      `✅ OpenAI client initialized successfully (model: ${ContentGenerationController.defaultModel})`
    );
  }

  /**
   * Generate chapter content with two modes:
   * - RAW_XHTML: passthrough (scripts/styles stripped; keep attrs)
   * - STRICT_NATIVE_BLOCKS: deterministic native blocks only; no templates/meta/style
   *
   * Request body (one of):
   *  A) { mode: "RAW_XHTML", html: "<h2>..."}
   *  B) {
   *       mode: "STRICT_NATIVE_BLOCKS",
   *       strict?: boolean, // default true (disables boilerplate/templates)
   *       instructions?: string, // member prompt that describes the blocks to build
   *       title?: string, description?: string, courseTitle?: string, subjectName?: string
   *     }
   *
   * Response:
   *  - RAW_XHTML: { mode, content }
   *  - STRICT_NATIVE_BLOCKS: { mode, blocks, html, usage? }
   */
  static async generateChapterContent(
    req: AuthRequest,
    res: Response,
    _next: NextFunction
  ) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const {
        mode,
        html,
        strict = true,
        instructions,
        title,
        description,
        courseTitle,
        subjectName,
      } = req.body as Partial<{
        mode: GenerationMode;
        html: string;
        strict: boolean;
        instructions: string;
        title: string;
        description: string;
        courseTitle: string;
        subjectName: string;
      }>;

      if (!mode) {
        return res.status(400).json({
          success: false,
          message: `Missing 'mode'. Use "RAW_XHTML" or "STRICT_NATIVE_BLOCKS".`,
        });
      }

      /* ----------------------------- RAW_XHTML MODE ----------------------------- */
      if (mode === "RAW_XHTML") {
        if (!html || typeof html !== "string") {
          return res.status(400).json({
            success: false,
            message: "RAW_XHTML mode requires a non-empty 'html' string.",
          });
        }

        const clean = sanitizePassthrough(html);
        console.log("🧪 RAW_XHTML final (sanitized, no wrappers):\n", clean);

        return res.status(200).json({
          success: true,
          message: "Passthrough content accepted",
          data: { mode, content: clean },
        });
      }

      /* ------------------------ STRICT_NATIVE_BLOCKS MODE ----------------------- */
      if (!ContentGenerationController.openai) {
        return res.status(503).json({
          success: false,
          message:
            "Content generation service is not available. Please check OpenAI API configuration.",
        });
      }

      const contextInfo =
        courseTitle && subjectName
          ? `Course Title: ${courseTitle}\nSubject: ${subjectName}\n`
          : "";

      const contract = `
You are an EPUB3 editor agent.

MODES:
1) RAW_XHTML (passthrough): not used in this call.
2) STRICT_NATIVE_BLOCKS (this call): Output ONLY JSON matching the schema below.
No templates. No meta. No style. No extra sections. No wrappers.

ALLOWED BLOCKS (deterministic mapping only):
- Heading -> { "type":"heading","level":2|3|4,"text":string } (H2, H3, or H4)
- Paragraph -> { "type":"paragraph","text":string }
- Image BLOCK -> { "type":"image","url":https URL, "alt":string, "width"?:int, "height"?:int }
- Video BLOCK -> { "type":"video","url":https MP4 URL, "width"?:int, "height"?:int, "aspect"?: "W:H" }
- Audio BLOCK -> { "type":"audio","url":https MP3 URL }
- List -> { "type":"list","items":[string, ...] }
- Button -> { "type":"button","text":string,"href":URL or {{placeholder}} }

EXTERNAL MEDIA:
- Accept HTTPS remote URLs only.
- MIME whitelist by extension: image/jpeg|png|svg, video/mp4, audio/mpeg (.mp3).
- Do NOT prefetch. Do NOT add crossorigin attributes.

SANITIZATION:
- Not needed here (we output data, not markup). Do NOT include script/style.

STRICT MODE: ${strict ? "ENABLED" : "DISABLED"}
- When ENABLED, never inject templates, promo cards, titles like "Promo Sample", "Flash Sale", buttons like "Learn More", or any <style>/<meta>.
- Output ONLY blocks explicitly requested or inferable from user instructions.

FALLBACK:
- If a provided media URL cannot be embedded per rules, emit a Paragraph:
  { "type":"paragraph", "text": "Media (not embedded): <URL>" }

OUTPUT:
- Return JSON ONLY with shape:
  { "mode":"STRICT_NATIVE_BLOCKS", "blocks":[ ...allowed blocks... ] }
- No prose outside JSON.
`;

      const userTask = `
${contextInfo}
User instructions (may include promotion recipes):
${instructions ?? ""}

Chapter Title: ${title ?? ""}
Chapter Description: ${description ?? ""}

Build content using ONLY the allowed blocks and rules above.
`;

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: contract },
        { role: "user", content: userTask },
      ];

      // Use GPT-5 by default (env OPENAI_MODEL can override).
      const model = ContentGenerationController.defaultModel;

      const completion =
        await ContentGenerationController.openai.chat.completions.create({
          model,
          messages,
          temperature: 0.2,
          max_completion_tokens: 4000, // Increased from 40000 for longer content generation
        });

      const raw = completion.choices[0]?.message?.content ?? "";
      if (!raw) {
        return res.status(500).json({
          success: false,
          message: "No content returned by model.",
        });
      }

      // Parse & validate
      let parsed: unknown;
      try {
        parsed = extractJsonObject(raw);
      } catch (e) {
        console.error("JSON parsing error:", e, "\nRAW:", raw);
        return res.status(500).json({
          success: false,
          message: "Model returned invalid JSON.",
        });
      }

      let strictPayload: z.infer<typeof StrictBlocksPayload>;
      try {
        strictPayload = StrictBlocksPayload.parse(parsed);
      } catch (e) {
        console.error("Schema validation error:", e, "\nParsed:", parsed);
        return res.status(400).json({
          success: false,
          message:
            "Response did not match STRICT_NATIVE_BLOCKS schema (likely templating or unsupported fields).",
        });
      }

      // Enforce URL extension whitelist
      try {
        enforceMediaWhitelist(strictPayload.blocks);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: (e as Error).message,
        });
      }

      // Render to bare HTML (no wrappers/boilerplate/styles/meta)
      const htmlOut = renderStrictBlocksToHTML(strictPayload.blocks);

      console.log("🧪 STRICT_NATIVE_BLOCKS final DOM:\n", htmlOut);

      return res.status(200).json({
        success: true,
        message: "Blocks generated successfully",
        data: {
          mode: "STRICT_NATIVE_BLOCKS",
          blocks: strictPayload.blocks,
          html: htmlOut,
          usage: completion.usage,
        },
      });
    } catch (error) {
      console.error("❌ Error generating content:", error);

      if (error instanceof Error) {
        // Helpful hints if model is not found / not allowed yet
        if (
          error.message.match(/model.*not found|unknown model|unsupported/i)
        ) {
          return res.status(400).json({
            success: false,
            message:
              "The requested model is not available for your account/region. Set OPENAI_MODEL to a permitted model (e.g., gpt-4o) and retry.",
          });
        }
        if (error.message.includes("API key")) {
          return res.status(401).json({
            success: false,
            message: "Invalid OpenAI API key. Please check your configuration.",
          });
        }
        if (error.message.includes("quota")) {
          return res.status(429).json({
            success: false,
            message: "OpenAI API quota exceeded. Please try again later.",
          });
        }
      }

      return res.status(500).json({
        success: false,
        message:
          "An error occurred while generating content. Please try again.",
      });
    }
  }

  /**
   * Get available models and their status
   */
  static async getModelsStatus(
    _req: AuthRequest,
    res: Response,
    _next: NextFunction
  ) {
    try {
      if (!ContentGenerationController.openai) {
        return res.status(503).json({
          success: false,
          message: "OpenAI service is not available",
          data: { available: false, reason: "API key not configured" },
        });
      }

      const models = await ContentGenerationController.openai.models.list();
      const gptModels = models.data.filter((m) => m.id.startsWith("gpt-"));

      const availableModels = gptModels.map((model) => ({
        id: model.id,
        owned_by: (model as any).owned_by ?? "openai",
        created: (model as any).created,
      }));

      // Prefer gpt-5 if present
      const hasGpt5 = gptModels.some(
        (m) => m.id === "gpt-5" || m.id.startsWith("gpt-5")
      );
      const recommended = hasGpt5 ? "gpt-5" : gptModels[0]?.id ?? "gpt-4o";

      return res.status(200).json({
        success: true,
        message: "Models retrieved successfully",
        data: {
          available: true,
          models: availableModels,
          recommended,
        },
      });
    } catch (error) {
      console.error("❌ Error retrieving models:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve model information",
      });
    }
  }

  /**
   * Custom GPT Instructions for EPUB Prompt Architect
   */
  private static readonly CUSTOM_GPT_INSTRUCTIONS = `You are the EPUB Prompt Architect, a specialized GPT that helps users of WordToWallet.com's EPUB3 editor craft high-quality, structured prompts to generate content using either Strict Native Blocks (no templates) or Raw HTML passthrough. These prompts are designed for generating EPUB3 promotional or educational materials through the in-platform generator. You ensure compatibility with strict generation modes and emphasize clarity, content order, and media/text block use.

All code samples are always wrapped in pagination-safe, adjustable containers using: <div class="codebox"><textarea class="codearea" readonly>...</textarea></div>. These code samples use compact, resizable textarea boxes with drag handles.

The GPT also suggests—but does not enforce—optional EPUB-compliant style rules users may adopt, including:
- System font stack for legibility
- Semantic structure (<section>, <h1>-<h3>, <ul>/<ol>, etc.)
- .btn class for styled buttons
- Break avoidance for lists/images/tables
- Light color scheme
- Accessible markup (alt text, heading order)

These options are included if relevant but are not locked in. Only the adjustable codebox container is enforced.

EPUB Quality Checklist:
- All code samples use compact, resizable textarea boxes with drag handles
- Void elements self-close: img, source, track, br, hr
- No meta, style, or script in EPUB content files
- All tags close; headings are in logical order; ampersands escape as needed

✅ Validation Outputs:
After every HTML or EPUB section, this GPT appends a checklist confirming:
- All tags are closed
- No disallowed tags are used
- Void elements are self-closed
- Heading structure is logical
- Ampersands are escaped correctly

Always provide complete, comprehensive responses without truncation or reduction. Generate full content as requested by users.`;

  /**
   * Generate a custom GPT response
   */
  static async generateCustomGPTResponse(
    req: AuthRequest,
    res: Response,
    _next: NextFunction
  ) {
    try {
      if (!ContentGenerationController.openai) {
        return res.status(503).json({
          success: false,
          message: "OpenAI service is not available",
        });
      }

      const {
        userMessage,
        conversationHistory = [],
        context,
      } = req.body as {
        userMessage: string;
        conversationHistory?: Array<{
          role: "system" | "user" | "assistant";
          content: string;
        }>;
        context?: {
          chapterTitle?: string;
          chapterDescription?: string;
          contentType?: string;
        };
      };

      if (!userMessage) {
        return res.status(400).json({
          success: false,
          message: "User message is required",
        });
      }

      // Build the conversation with system instructions
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: ContentGenerationController.CUSTOM_GPT_INSTRUCTIONS,
        },
        ...conversationHistory,
        {
          role: "user",
          content: userMessage,
        },
      ];

      // Add context if provided
      if (context?.chapterTitle || context?.chapterDescription) {
        const contextMessage = `Context: Chapter Title: "${
          context.chapterTitle || "Not specified"
        }", Chapter Description: "${
          context.chapterDescription || "Not specified"
        }", Content Type: "${context.contentType || "educational"}"`;
        messages.splice(-1, 0, {
          role: "system",
          content: contextMessage,
        });
      }

      const completion =
        await ContentGenerationController.openai.chat.completions.create({
          model: "gpt-4",
          messages: messages as any,
          temperature: 0.7,
          presence_penalty: 0.1,
          frequency_penalty: 0.1,
        });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error("No response generated from OpenAI");
      }

      return res.status(200).json({
        success: true,
        message: "Response generated successfully",
        data: {
          content: response,
          usage: completion.usage
            ? {
                prompt_tokens: completion.usage.prompt_tokens,
                completion_tokens: completion.usage.completion_tokens,
                total_tokens: completion.usage.total_tokens,
              }
            : undefined,
        },
      });
    } catch (error) {
      console.error("❌ Error generating custom GPT response:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to generate response",
      });
    }
  }

  /**
   * Generate Strict Native Blocks prompt using the custom GPT
   */
  static async generateStrictNativeBlocksPrompt(
    req: AuthRequest,
    res: Response,
    _next: NextFunction
  ) {
    try {
      if (!ContentGenerationController.openai) {
        return res.status(503).json({
          success: false,
          message: "OpenAI service is not available",
        });
      }

      const {
        chapterTitle = "",
        chapterDescription = "",
        currentInstructions = "",
        contentType = "educational",
      } = req.body as {
        chapterTitle?: string;
        chapterDescription?: string;
        currentInstructions?: string;
        contentType?:
          | "promotional"
          | "educational"
          | "tutorial"
          | "auction"
          | "delivery"
          | "sales"
          | "marketing";
      };

      const prompt = `Generate a Strict Native Blocks prompt for EPUB3 content with these specifications:

Context:
- Chapter Title: ${chapterTitle || "Untitled Chapter"}
- Chapter Description: ${chapterDescription || "No description provided"}
- Current Instructions: ${currentInstructions || "None"}
- Content Type: ${contentType}

Requirements:
1. Create engaging, professional content suitable for EPUB3
2. Use only CREATE SECTION, ADD TEXT H1, ADD PARAGRAPH commands
3. Ensure all text is ASCII-compliant
4. Structure content logically with clear sections
5. Make content actionable and valuable for readers
6. Include practical examples or insights where appropriate

Generate a comprehensive prompt that will create high-quality EPUB3 content following the STRICT_NATIVE_BLOCKS EMISSION CONTRACT v1.`;

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: ContentGenerationController.CUSTOM_GPT_INSTRUCTIONS,
        },
        {
          role: "system",
          content: `Context: Chapter Title: "${chapterTitle}", Chapter Description: "${chapterDescription}", Content Type: "${contentType}"`,
        },
        {
          role: "user",
          content: prompt,
        },
      ];

      const completion =
        await ContentGenerationController.openai.chat.completions.create({
          model: "gpt-4",
          messages: messages as any,
          temperature: 0.7,
          presence_penalty: 0.1,
          frequency_penalty: 0.1,
        });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error("No response generated from OpenAI");
      }

      return res.status(200).json({
        success: true,
        message: "Prompt generated successfully",
        data: {
          content: response,
        },
      });
    } catch (error) {
      console.error("❌ Error generating prompt:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to generate prompt",
      });
    }
  }

  /**
   * Generate video tutorial script
   */
  static async generateVideoScript(
    req: AuthRequest,
    res: Response,
    _next: NextFunction
  ) {
    try {
      if (!ContentGenerationController.openai) {
        return res.status(503).json({
          success: false,
          message: "OpenAI service is not available",
        });
      }

      const {
        title = "",
        description = "",
        contentType = "educational",
      } = req.body as {
        title?: string;
        description?: string;
        contentType?: string;
      };

      const prompt = `Generate a detailed video tutorial script for "${title}". 

Description: ${description}
Content Type: ${contentType}

Create a professional video script with:
1. Introduction with hook
2. Clear step-by-step instructions
3. Visual cues and screen recording guidance
4. Engaging narration
5. Call-to-action for WordToWallet.com

Format the script with timing markers and visual descriptions.`;

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: ContentGenerationController.CUSTOM_GPT_INSTRUCTIONS,
        },
        {
          role: "system",
          content: `Context: Chapter Title: "${title}", Chapter Description: "${description}", Content Type: "${contentType}"`,
        },
        {
          role: "user",
          content: prompt,
        },
      ];

      const completion =
        await ContentGenerationController.openai.chat.completions.create({
          model: "gpt-4",
          messages: messages as any,
          temperature: 0.7,
          presence_penalty: 0.1,
          frequency_penalty: 0.1,
        });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error("No response generated from OpenAI");
      }

      return res.status(200).json({
        success: true,
        message: "Video script generated successfully",
        data: {
          content: response,
        },
      });
    } catch (error) {
      console.error("❌ Error generating video script:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to generate video script",
      });
    }
  }

  /**
   * Generate video storyboard
   */
  static async generateVideoStoryboard(
    req: AuthRequest,
    res: Response,
    _next: NextFunction
  ) {
    try {
      if (!ContentGenerationController.openai) {
        return res.status(503).json({
          success: false,
          message: "OpenAI service is not available",
        });
      }

      const {
        title = "",
        description = "",
        contentType = "educational",
      } = req.body as {
        title?: string;
        description?: string;
        contentType?: string;
      };

      const prompt = `Create a detailed video storyboard for "${title}".

Description: ${description}
Content Type: ${contentType}

Generate a professional storyboard with:
1. Scene-by-scene breakdown
2. Visual descriptions and timing
3. Text overlays and graphics
4. Action sequences and transitions
5. Call-to-action scenes

Include timing, visual elements, narration, and technical specifications.`;

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: ContentGenerationController.CUSTOM_GPT_INSTRUCTIONS,
        },
        {
          role: "system",
          content: `Context: Chapter Title: "${title}", Chapter Description: "${description}", Content Type: "${contentType}"`,
        },
        {
          role: "user",
          content: prompt,
        },
      ];

      const completion =
        await ContentGenerationController.openai.chat.completions.create({
          model: "gpt-4",
          messages: messages as any,
          temperature: 0.7,
          presence_penalty: 0.1,
          frequency_penalty: 0.1,
        });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error("No response generated from OpenAI");
      }

      return res.status(200).json({
        success: true,
        message: "Video storyboard generated successfully",
        data: {
          content: response,
        },
      });
    } catch (error) {
      console.error("❌ Error generating video storyboard:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to generate video storyboard",
      });
    }
  }
}
