import express from "express";
import { MediaController } from "../controllers/mediaController";
import { authenticate } from "../middleware/auth";
import { uploadMedia, handleUploadError } from "../middleware/upload";

const router = express.Router();

// Initialize OpenAI client when the module loads
MediaController.initialize();

// All routes require authentication
router.use(authenticate);

// Get all media files
router.get("/", MediaController.getMedia);

// Get video generation suggestions
router.get("/video-suggestions", MediaController.getVideoGenerationSuggestions);

// Get single media file by ID
router.get("/:id", MediaController.getMediaById);

// Upload media file
router.post(
  "/upload",
  uploadMedia.single("file"),
  handleUploadError,
  MediaController.uploadMedia
);

// Generate image with OpenAI
router.post("/generate/image", MediaController.generateImage);

// Generate audio with OpenAI
router.post("/generate/audio", MediaController.generateAudio);

// Update media metadata
router.put("/:id", MediaController.updateMedia);

// Delete media file
router.delete("/:id", MediaController.deleteMedia);

export default router;

