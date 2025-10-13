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

export default router;
