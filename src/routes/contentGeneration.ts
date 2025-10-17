import express from "express";
import { ContentGenerationController } from "../controllers/contentGenerationController";
import { authenticate, requireAdmin } from "../middleware/auth";
import { generateContentValidation } from "../validation/contentGenerationValidation";

const router = express.Router();

// Initialize OpenAI client when the module loads
ContentGenerationController.initialize();

// Admin routes for content generation
router.post(
  "/generate-chapter-content",
  authenticate,
  generateContentValidation,
  ContentGenerationController.generateChapterContent
);

router.get(
  "/models-status",
  authenticate,
  requireAdmin,
  ContentGenerationController.getModelsStatus
);

// Custom GPT endpoints for AI Prompt Generator
router.post(
  "/custom-gpt-response",
  authenticate,
  ContentGenerationController.generateCustomGPTResponse
);

router.post(
  "/generate-prompt",
  authenticate,
  ContentGenerationController.generateStrictNativeBlocksPrompt
);

router.post(
  "/generate-video-script",
  authenticate,
  ContentGenerationController.generateVideoScript
);

router.post(
  "/generate-video-storyboard",
  authenticate,
  ContentGenerationController.generateVideoStoryboard
);

export default router;
