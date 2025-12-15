import { Response, NextFunction } from "express";
import { AuthRequest, UserRole } from "../types";
import { Media, MediaType, MediaSource, IMedia } from "../models/Media";
import OpenAI from "openai";
import path from "path";
import fs from "fs/promises";
import { getStorageService } from "../services/storageService";
import { CustomError } from "../middleware/errorHandler";
import sharp from "sharp"; // For image metadata extraction
import dotenv from "dotenv";
dotenv.config();

export class MediaController {
  private static openai: OpenAI | null = null;

  static initialize() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn(
        "⚠️  OpenAI API key not found. AI media generation will be disabled."
      );
      return;
    }
    MediaController.openai = new OpenAI({
      apiKey,
      timeout: 300000, // 5 minutes
      maxRetries: 2,
    });
    console.log("✅ OpenAI client initialized for media generation");
  }

  /**
   * Get all media files for the authenticated user
   * Admins can see all media files from all users
   */
  static async getMedia(req: AuthRequest, res: Response, _next: NextFunction) {
    try {
      const { type, source, search, page = 1, limit = 20 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const filter: any = {};

      // Only filter by user if not admin
      if (req.user!.role !== UserRole.ADMIN) {
        filter.createdBy = req.user!._id;
      }

      if (type) {
        filter.type = type;
      }

      if (source) {
        filter.source = source;
      }

      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ];
      }

      const media = await Media.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("createdBy", "firstName lastName email");

      const total = await Media.countDocuments(filter);

      return res.status(200).json({
        success: true,
        data: {
          media,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error) {
      console.error("Error fetching media:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch media",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get a single media file by ID
   */
  static async getMediaById(
    req: AuthRequest,
    res: Response,
    _next: NextFunction
  ) {
    try {
      const { id } = req.params;

      const media = await Media.findById(id).populate(
        "createdBy",
        "firstName lastName email"
      );

      if (!media) {
        return res.status(404).json({
          success: false,
          message: "Media not found",
        });
      }

      // Check if user owns the media or is admin
      if (
        media.createdBy._id.toString() !== req.user!._id.toString() &&
        req.user!.role !== "admin"
      ) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      return res.status(200).json({
        success: true,
        data: media,
      });
    } catch (error) {
      console.error("Error fetching media:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch media",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Upload media file
   */
  static async uploadMedia(
    req: AuthRequest,
    res: Response,
    _next: NextFunction
  ) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      const { title, description } = req.body;
      const file = req.file;

      // Determine media type from MIME type
      let mediaType: MediaType;
      if (file.mimetype.startsWith("image/")) {
        mediaType = MediaType.IMAGE;
      } else if (file.mimetype.startsWith("audio/")) {
        mediaType = MediaType.AUDIO;
      } else if (file.mimetype.startsWith("video/")) {
        mediaType = MediaType.VIDEO;
      } else {
        return res.status(400).json({
          success: false,
          message: "Unsupported file type",
        });
      }

      // Extract metadata
      let width: number | undefined;
      let height: number | undefined;
      let duration: number | undefined;

      if (mediaType === MediaType.IMAGE && file.buffer) {
        try {
          const metadata = await sharp(file.buffer).metadata();
          width = metadata.width;
          height = metadata.height;
        } catch (error) {
          console.warn("Failed to extract image metadata:", error);
        }
      }

      // Upload to storage service
      const storageService = getStorageService();
      const fileBuffer = file.buffer;
      if (!fileBuffer) {
        return res.status(400).json({
          success: false,
          message: "File buffer is missing",
        });
      }

      const fileName = `media-${Date.now()}-${Math.round(
        Math.random() * 1e9
      )}${path.extname(file.originalname)}`;

      const uploadResult = await storageService.uploadFile(
        fileName,
        fileBuffer,
        file.mimetype,
        {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
        }
      );

      const publicUrl = uploadResult.url;
      console.log("publicUrl", publicUrl);

      // Create media record
      const media = await Media.create({
        title: title || file.originalname,
        description: description || "",
        type: mediaType,
        source: MediaSource.UPLOADED,
        fileName,
        filePath: fileName,
        publicUrl,
        mimeType: file.mimetype,
        size: file.size,
        width,
        height,
        duration,
        createdBy: req.user!._id,
      });

      return res.status(201).json({
        success: true,
        message: "Media uploaded successfully",
        data: media,
      });
    } catch (error) {
      console.error("Error uploading media:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to upload media",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Generate image using OpenAI DALL-E
   */
  static async generateImage(
    req: AuthRequest,
    res: Response,
    _next: NextFunction
  ) {
    try {
      if (!MediaController.openai) {
        return res.status(503).json({
          success: false,
          message: "OpenAI service is not available",
        });
      }

      const { prompt, title, description, size = "1024x1024" } = req.body;

      if (!prompt) {
        return res.status(400).json({
          success: false,
          message: "Prompt is required",
        });
      }

      // Generate image using DALL-E
      const response = await MediaController.openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: size as "1024x1024" | "1024x1792" | "1792x1024",
        quality: "standard",
        response_format: "url",
      });

      const imageUrl = response.data?.[0]?.url;
      if (!imageUrl) {
        return res.status(500).json({
          success: false,
          message: "Failed to generate image",
        });
      }

      // Download the image
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

      // Upload to storage
      const storageService = getStorageService();
      const fileName = `generated-image-${Date.now()}-${Math.round(
        Math.random() * 1e9
      )}.png`;

      const uploadResult = await storageService.uploadFile(
        fileName,
        imageBuffer,
        "image/png",
        {
          generatedBy: "dall-e-3",
          prompt: prompt,
          uploadedAt: new Date().toISOString(),
        }
      );

      const publicUrl = uploadResult.url;
      console.log("publicUrl", publicUrl);

      // Extract image dimensions
      let width: number | undefined;
      let height: number | undefined;
      try {
        const metadata = await sharp(imageBuffer).metadata();
        width = metadata.width;
        height = metadata.height;
      } catch (error) {
        console.warn("Failed to extract image metadata:", error);
      }

      // Create media record
      const media = await Media.create({
        title: title || `Generated: ${prompt.substring(0, 50)}`,
        description: description || prompt,
        type: MediaType.IMAGE,
        source: MediaSource.GENERATED,
        fileName,
        filePath: uploadResult.key,
        publicUrl,
        mimeType: "image/png",
        size: imageBuffer.length,
        width,
        height,
        generatedPrompt: prompt,
        createdBy: req.user!._id,
      });

      return res.status(201).json({
        success: true,
        message: "Image generated successfully",
        data: media,
      });
    } catch (error) {
      console.error("Error generating image:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to generate image",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Generate audio using OpenAI TTS
   */
  static async generateAudio(
    req: AuthRequest,
    res: Response,
    _next: NextFunction
  ) {
    try {
      if (!MediaController.openai) {
        return res.status(503).json({
          success: false,
          message: "OpenAI service is not available",
        });
      }

      const {
        text,
        title,
        description,
        voice = "alloy",
        model = "tts-1",
      } = req.body;

      if (!text) {
        return res.status(400).json({
          success: false,
          message: "Text is required",
        });
      }

      // Generate speech using TTS
      const response = await MediaController.openai.audio.speech.create({
        model: model as "tts-1" | "tts-1-hd",
        voice: voice as
          | "alloy"
          | "echo"
          | "fable"
          | "onyx"
          | "nova"
          | "shimmer",
        input: text,
      });

      // Convert response to buffer
      const audioBuffer = Buffer.from(await response.arrayBuffer());

      // Upload to storage
      const storageService = getStorageService();
      const fileName = `generated-audio-${Date.now()}-${Math.round(
        Math.random() * 1e9
      )}.mp3`;

      const uploadResult = await storageService.uploadFile(
        fileName,
        audioBuffer,
        "audio/mpeg",
        {
          generatedBy: "openai-tts",
          text: text.substring(0, 100),
          uploadedAt: new Date().toISOString(),
        }
      );

      const publicUrl = uploadResult.url;
      console.log("publicUrl", publicUrl);

      // Create media record
      const media = await Media.create({
        title: title || `Generated Audio: ${text.substring(0, 30)}...`,
        description: description || text,
        type: MediaType.AUDIO,
        source: MediaSource.GENERATED,
        fileName,
        filePath: uploadResult.key,
        publicUrl,
        mimeType: "audio/mpeg",
        size: audioBuffer.length,
        generatedPrompt: text,
        createdBy: req.user!._id,
      });

      return res.status(201).json({
        success: true,
        message: "Audio generated successfully",
        data: media,
      });
    } catch (error) {
      console.error("Error generating audio:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to generate audio",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Delete media file
   */
  static async deleteMedia(
    req: AuthRequest,
    res: Response,
    _next: NextFunction
  ) {
    try {
      const { id } = req.params;

      const media = await Media.findById(id);

      if (!media) {
        return res.status(404).json({
          success: false,
          message: "Media not found",
        });
      }

      // Check if user owns the media or is admin
      if (
        media.createdBy.toString() !== req.user!._id.toString() &&
        req.user!.role !== "admin"
      ) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      // Delete from storage
      try {
        const storageService = getStorageService();
        await storageService.deleteFile(media.fileName);
      } catch (error) {
        console.warn("Failed to delete file from storage:", error);
      }

      // Delete from database
      await Media.findByIdAndDelete(id);

      return res.status(200).json({
        success: true,
        message: "Media deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting media:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to delete media",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Update media metadata
   */
  static async updateMedia(
    req: AuthRequest,
    res: Response,
    _next: NextFunction
  ) {
    try {
      const { id } = req.params;
      const { title, description } = req.body;

      const media = await Media.findById(id);

      if (!media) {
        return res.status(404).json({
          success: false,
          message: "Media not found",
        });
      }

      // Check if user owns the media or is admin
      if (
        media.createdBy.toString() !== req.user!._id.toString() &&
        req.user!.role !== "admin"
      ) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      // Update media
      if (title) media.title = title;
      if (description !== undefined) media.description = description;

      await media.save();

      return res.status(200).json({
        success: true,
        message: "Media updated successfully",
        data: media,
      });
    } catch (error) {
      console.error("Error updating media:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update media",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get video generation suggestions (free methods)
   */
  static async getVideoGenerationSuggestions(
    req: AuthRequest,
    res: Response,
    _next: NextFunction
  ) {
    try {
      const suggestions = {
        freeMethods: [
          {
            name: "Remotion",
            description:
              "Free, open-source React-based framework for creating videos programmatically",
            type: "library",
            website: "https://www.remotion.dev/",
            api: false,
            instructions:
              "Use Remotion to create videos from React components. Install: npm install remotion",
          },
          {
            name: "FFmpeg + Image Sequences",
            description:
              "Create videos from image sequences or single images using FFmpeg",
            type: "cli",
            website: "https://ffmpeg.org/",
            api: false,
            instructions:
              "Use FFmpeg to combine images into videos: ffmpeg -framerate 1 -i image%d.jpg -c:v libx264 output.mp4",
          },
          {
            name: "Hugging Face Text-to-Video",
            description:
              "Free API access to text-to-video models on Hugging Face",
            type: "api",
            website: "https://huggingface.co/models?pipeline_tag=text-to-video",
            api: true,
            instructions:
              "Use Hugging Face Inference API with models like ModelScope/text-to-video-synthesis",
          },
          {
            name: "Pexels/Pixabay API",
            description:
              "Free stock video API - can combine with text overlay using FFmpeg",
            type: "api",
            website: "https://www.pexels.com/api/",
            api: true,
            instructions:
              "Fetch free stock videos from Pexels API and add text overlays with FFmpeg",
          },
        ],
        note: "For production use, consider implementing a simple video generation service using Remotion or FFmpeg with image-to-video conversion.",
      };

      return res.status(200).json({
        success: true,
        data: suggestions,
      });
    } catch (error) {
      console.error("Error fetching video suggestions:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch suggestions",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
