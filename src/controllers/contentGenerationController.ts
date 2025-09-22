// src/controllers/ContentGenerationController.ts
import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import OpenAI from "openai";
import dotenv from "dotenv";

import { AuthRequest } from "../types";
dotenv.config();

export class ContentGenerationController {
  private static openai: OpenAI | null = null;

  static initialize() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn(
        "⚠️  OpenAI API key not found. Content generation will be disabled."
      );
      return;
    }
    ContentGenerationController.openai = new OpenAI({ apiKey });
    console.log("✅ OpenAI client initialized successfully");
  }

  /**
   * Generate chapter content using GPT-4
   */
  static async generateChapterContent(
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

      const { title, description, courseTitle, subjectName } = req.body as {
        title?: string;
        description?: string;
        courseTitle?: string;
        subjectName?: string;
      };

      if (!title || !description) {
        return res.status(400).json({
          success: false,
          message: "Chapter title and description are required",
        });
      }

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

      const prompt = `You are an expert educational content creator. Generate comprehensive, engaging, and well-structured chapter content based on the following information:

${contextInfo}Chapter Title: ${title}
Chapter Description: ${description}

Please create detailed chapter content that includes:

1. **Introduction**: A compelling opening that introduces the chapter topic and explains its importance
2. **Main Content**: Well-structured sections with clear headings, explanations, examples, and practical applications
3. **Key Concepts**: Important terms and concepts explained clearly
4. **Examples**: Real-world examples and case studies where applicable
5. **Summary**: A concise summary of the main points covered
6. **Key Takeaways**: Bullet points highlighting the most important information

Requirements:
- Use clear, engaging language appropriate for educational content
- Include proper HTML formatting for headings, paragraphs, lists, and emphasis
- Make the content comprehensive but not overwhelming
- Ensure the content directly relates to the chapter title and description
- Include practical applications and examples where relevant
- Use a professional, educational tone
- Focus primarily on the chapter title and description for content relevance

Format the response as HTML with proper structure using headings (h2, h3), paragraphs, lists, and emphasis tags.`;

      console.log("🤖 Generating content for chapter:", title);

      // Simple content generation using GPT-4
      const completion =
        await ContentGenerationController.openai!.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: `Generate detailed HTML content based on the description: "${description}" for a chapter titled "${title}". The content should be formatted in HTML.`,
            },
          ],
          temperature: 0.7,
          max_completion_tokens: 4000,
        });

      const generatedContent = completion.choices[0]?.message?.content?.trim();

      if (!generatedContent) {
        return res.status(500).json({
          success: false,
          message: "Failed to generate content. Please try again.",
        });
      }

      console.log("✅ Content generated successfully");

      return res.status(200).json({
        success: true,
        message: "Content generated successfully",
        data: {
          content: generatedContent,
          usage: completion.usage,
        },
      });
    } catch (error) {
      console.error("❌ Error generating content:", error);

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

      // List available models
      const models = await ContentGenerationController.openai.models.list();
      const availableModels = models.data
        .filter((model) => model.id.includes("gpt"))
        .map((model) => ({
          id: model.id,
          owned_by: model.owned_by,
          created: model.created,
        }));

      return res.status(200).json({
        success: true,
        message: "Models retrieved successfully",
        data: {
          available: true,
          models: availableModels,
          recommended: "gpt-4o", // Current best model
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
}
