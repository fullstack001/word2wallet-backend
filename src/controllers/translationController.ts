// src/controllers/translationController.ts
import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import OpenAI from "openai";
import dotenv from "dotenv";

import { AuthRequest } from "../types";

dotenv.config();

export class TranslationController {
  private static openai: OpenAI | null = null;

  static initialize() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn(
        "⚠️  OpenAI API key not found. Translation service will be disabled."
      );
      return;
    }
    TranslationController.openai = new OpenAI({ apiKey });
    console.log("✅ Translation service initialized successfully");
  }

  /**
   * Translate text from one language to another
   */
  static async translateText(
    req: AuthRequest,
    res: Response,
    _next: NextFunction
  ) {
    try {
      // express-validator check
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { text, targetLanguage, sourceLanguage } = req.body as {
        text: string;
        targetLanguage: string;
        sourceLanguage?: string;
      };

      if (!text || !targetLanguage) {
        return res.status(400).json({
          success: false,
          message: "Text and target language are required",
        });
      }

      // Check content size to prevent timeouts
      if (text.length > 10000) {
        return res.status(400).json({
          success: false,
          message:
            "Content too large. Please reduce the content size to under 10,000 characters.",
        });
      }

      if (!TranslationController.openai) {
        return res.status(503).json({
          success: false,
          message:
            "Translation service is not available. Please check OpenAI API configuration.",
        });
      }

      console.log("🌐 Translating text to:", targetLanguage);

      const sourceLangText = sourceLanguage ? ` from ${sourceLanguage}` : "";
      const prompt = `Translate the following text${sourceLangText} to ${targetLanguage}. 
      Maintain the original formatting, structure, and meaning. 
      If the text contains HTML tags, preserve them in the translation.
      
      Text to translate:
      ${text}`;

      const completion =
        await TranslationController.openai.chat.completions.create(
          {
            model: "gpt-4o",
            messages: [
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.3,
            max_completion_tokens: 2000,
          },
          {
            timeout: 60000, // 600 seconds timeout
          }
        );

      let translatedText = completion.choices[0]?.message?.content?.trim();

      if (!translatedText) {
        return res.status(500).json({
          success: false,
          message: "Failed to translate text. Please try again.",
        });
      }

      // Clean up any markdown formatting that might have been added
      translatedText = translatedText
        .replace(/^```\s*/g, "")
        .replace(/\s*```$/g, "")
        .replace(/^`/g, "")
        .replace(/`$/g, "")
        .trim();

      console.log("✅ Text translated successfully");

      return res.status(200).json({
        success: true,
        message: "Text translated successfully",
        data: {
          originalText: text,
          translatedText,
          sourceLanguage: sourceLanguage || "auto-detected",
          targetLanguage,
          usage: completion.usage,
        },
      });
    } catch (error) {
      console.error("❌ Error translating text:", error);

      // Handle specific OpenAI errors
      if (error instanceof Error) {
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
        message: "An error occurred while translating text. Please try again.",
      });
    }
  }

  /**
   * Translate HTML content while preserving structure
   */
  static async translateHtmlContent(
    req: AuthRequest,
    res: Response,
    _next: NextFunction
  ) {
    try {
      // express-validator check
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { htmlContent, targetLanguage, sourceLanguage } = req.body as {
        htmlContent: string;
        targetLanguage: string;
        sourceLanguage?: string;
      };

      if (!htmlContent || !targetLanguage) {
        return res.status(400).json({
          success: false,
          message: "HTML content and target language are required",
        });
      }

      // Check content size to prevent timeouts
      if (htmlContent.length > 100000) {
        return res.status(400).json({
          success: false,
          message:
            "Content too large. Please reduce the content size to under 50,000 characters.",
        });
      }

      // For very large content, suggest chunking
      if (htmlContent.length > 100000) {
        console.log("⚠️ Large content detected, translation may take longer");
      }

      if (!TranslationController.openai) {
        return res.status(503).json({
          success: false,
          message:
            "Translation service is not available. Please check OpenAI API configuration.",
        });
      }

      console.log("🌐 Translating HTML content to:", targetLanguage);

      const sourceLangText = sourceLanguage ? ` from ${sourceLanguage}` : "";
      const prompt = `Translate the following HTML content${sourceLangText} to ${targetLanguage}. 
      IMPORTANT: 
      - Preserve ALL HTML tags, attributes, and structure exactly
      - Only translate the text content within HTML elements
      - Do not modify any HTML syntax, class names, IDs, or attributes
      - Maintain the exact same HTML structure
      - Translate text in title attributes, alt attributes, and other text attributes
      - Return ONLY the translated HTML content, no markdown formatting, no code blocks, no explanations
      - Do not wrap the response in \`\`\`html or any other markdown syntax
      
      HTML content to translate:
      ${htmlContent}`;

      const completion =
        await TranslationController.openai.chat.completions.create(
          {
            model: "gpt-4o",
            messages: [
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.3,
            max_completion_tokens: 4000,
          },
          {
            timeout: 60000, // 600 seconds timeout
          }
        );

      let translatedHtml = completion.choices[0]?.message?.content?.trim();

      if (!translatedHtml) {
        return res.status(500).json({
          success: false,
          message: "Failed to translate HTML content. Please try again.",
        });
      }

      // Clean up any markdown formatting that might have been added
      translatedHtml = translatedHtml
        .replace(/^```html\s*/g, "")
        .replace(/^```\s*/g, "")
        .replace(/\s*```$/g, "")
        .replace(/^`/g, "")
        .replace(/`$/g, "")
        .trim();

      console.log("✅ HTML content translated successfully");

      return res.status(200).json({
        success: true,
        message: "HTML content translated successfully",
        data: {
          originalHtml: htmlContent,
          translatedHtml,
          sourceLanguage: sourceLanguage || "auto-detected",
          targetLanguage,
          usage: completion.usage,
        },
      });
    } catch (error) {
      console.error("❌ Error translating HTML content:", error);

      // Handle specific OpenAI errors
      if (error instanceof Error) {
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

        if (
          error.message.includes("timeout") ||
          error.message.includes("APIConnectionTimeoutError")
        ) {
          return res.status(408).json({
            success: false,
            message:
              "Translation request timed out. The content might be too large. Please try with smaller content or try again later.",
          });
        }
      }

      return res.status(500).json({
        success: false,
        message:
          "An error occurred while translating HTML content. Please try again.",
      });
    }
  }

  /**
   * Get supported languages
   */
  static async getSupportedLanguages(
    _req: AuthRequest,
    res: Response,
    _next: NextFunction
  ) {
    try {
      const supportedLanguages = [
        { code: "en", name: "English" },
        { code: "es", name: "Spanish" },
        { code: "fr", name: "French" },
        { code: "de", name: "German" },
        { code: "it", name: "Italian" },
        { code: "pt", name: "Portuguese" },
        { code: "ru", name: "Russian" },
        { code: "ja", name: "Japanese" },
        { code: "ko", name: "Korean" },
        { code: "zh", name: "Chinese" },
        { code: "ar", name: "Arabic" },
        { code: "hi", name: "Hindi" },
        { code: "nl", name: "Dutch" },
        { code: "sv", name: "Swedish" },
        { code: "da", name: "Danish" },
        { code: "no", name: "Norwegian" },
        { code: "fi", name: "Finnish" },
        { code: "pl", name: "Polish" },
        { code: "tr", name: "Turkish" },
        { code: "th", name: "Thai" },
        { code: "vi", name: "Vietnamese" },
        { code: "id", name: "Indonesian" },
        { code: "ms", name: "Malay" },
        { code: "tl", name: "Filipino" },
        { code: "uk", name: "Ukrainian" },
        { code: "cs", name: "Czech" },
        { code: "hu", name: "Hungarian" },
        { code: "ro", name: "Romanian" },
        { code: "bg", name: "Bulgarian" },
        { code: "hr", name: "Croatian" },
        { code: "sk", name: "Slovak" },
        { code: "sl", name: "Slovenian" },
        { code: "et", name: "Estonian" },
        { code: "lv", name: "Latvian" },
        { code: "lt", name: "Lithuanian" },
        { code: "el", name: "Greek" },
        { code: "he", name: "Hebrew" },
        { code: "fa", name: "Persian" },
        { code: "ur", name: "Urdu" },
        { code: "bn", name: "Bengali" },
        { code: "ta", name: "Tamil" },
        { code: "te", name: "Telugu" },
        { code: "ml", name: "Malayalam" },
        { code: "kn", name: "Kannada" },
        { code: "gu", name: "Gujarati" },
        { code: "pa", name: "Punjabi" },
        { code: "or", name: "Odia" },
        { code: "as", name: "Assamese" },
        { code: "ne", name: "Nepali" },
        { code: "si", name: "Sinhala" },
        { code: "my", name: "Burmese" },
        { code: "km", name: "Khmer" },
        { code: "lo", name: "Lao" },
        { code: "ka", name: "Georgian" },
        { code: "am", name: "Amharic" },
        { code: "sw", name: "Swahili" },
        { code: "zu", name: "Zulu" },
        { code: "af", name: "Afrikaans" },
        { code: "sq", name: "Albanian" },
        { code: "az", name: "Azerbaijani" },
        { code: "be", name: "Belarusian" },
        { code: "bs", name: "Bosnian" },
        { code: "ca", name: "Catalan" },
        { code: "cy", name: "Welsh" },
        { code: "eu", name: "Basque" },
        { code: "gl", name: "Galician" },
        { code: "is", name: "Icelandic" },
        { code: "ga", name: "Irish" },
        { code: "mt", name: "Maltese" },
        { code: "mk", name: "Macedonian" },
        { code: "sr", name: "Serbian" },
        { code: "sn", name: "Shona" },
        { code: "so", name: "Somali" },
        { code: "sw", name: "Swahili" },
        { code: "tg", name: "Tajik" },
        { code: "uz", name: "Uzbek" },
        { code: "yo", name: "Yoruba" },
        { code: "zu", name: "Zulu" },
      ];

      return res.status(200).json({
        success: true,
        message: "Supported languages retrieved successfully",
        data: {
          languages: supportedLanguages,
          total: supportedLanguages.length,
        },
      });
    } catch (error) {
      console.error("❌ Error retrieving supported languages:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve supported languages",
      });
    }
  }

  /**
   * Detect language of text
   */
  static async detectLanguage(
    req: AuthRequest,
    res: Response,
    _next: NextFunction
  ) {
    try {
      // express-validator check
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { text } = req.body as { text: string };

      if (!text) {
        return res.status(400).json({
          success: false,
          message: "Text is required for language detection",
        });
      }

      if (!TranslationController.openai) {
        return res.status(503).json({
          success: false,
          message:
            "Language detection service is not available. Please check OpenAI API configuration.",
        });
      }

      console.log("🔍 Detecting language for text");

      const prompt = `Detect the language of the following text and respond with only the ISO 639-1 language code (e.g., "en", "es", "fr", etc.). If you cannot determine the language, respond with "unknown".

Text: ${text}`;

      const completion =
        await TranslationController.openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.1,
          max_completion_tokens: 10,
        });

      const detectedLanguage = completion.choices[0]?.message?.content?.trim();

      if (!detectedLanguage || detectedLanguage === "unknown") {
        return res.status(400).json({
          success: false,
          message: "Could not detect the language of the provided text",
        });
      }

      console.log("✅ Language detected:", detectedLanguage);

      return res.status(200).json({
        success: true,
        message: "Language detected successfully",
        data: {
          text,
          detectedLanguage,
          usage: completion.usage,
        },
      });
    } catch (error) {
      console.error("❌ Error detecting language:", error);

      // Handle specific OpenAI errors
      if (error instanceof Error) {
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
          "An error occurred while detecting language. Please try again.",
      });
    }
  }
}
