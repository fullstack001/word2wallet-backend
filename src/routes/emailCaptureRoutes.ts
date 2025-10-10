import { Router } from "express";
import { EmailCaptureController } from "../controllers/emailCaptureController";
import { auth } from "../middleware/auth";
import {
  getEmailCapturesValidation,
  getEmailCaptureValidation,
  updateEmailCaptureValidation,
  deleteEmailCaptureValidation,
  bulkUpdateEmailCapturesValidation,
  exportEmailCapturesValidation,
  getEmailCaptureStatsValidation,
  addTagsToEmailCapturesValidation,
  removeTagsFromEmailCapturesValidation,
} from "../validation/emailCaptureValidation";

const router = Router();

// All routes require authentication
router.use(auth);

// Get all email captures
router.get(
  "/",
  getEmailCapturesValidation,
  EmailCaptureController.getEmailCaptures
);

// Export email captures (must come before /:id)
router.get(
  "/export",
  exportEmailCapturesValidation,
  EmailCaptureController.exportEmailCaptures
);

// Get email capture statistics (must come before /:id)
router.get(
  "/stats",
  getEmailCaptureStatsValidation,
  EmailCaptureController.getEmailCaptureStats
);

// Bulk update email captures (must come before /:id)
router.put(
  "/bulk/update",
  bulkUpdateEmailCapturesValidation,
  EmailCaptureController.bulkUpdateEmailCaptures
);

// Add tags to email captures (must come before /:id)
router.put(
  "/bulk/tags/add",
  addTagsToEmailCapturesValidation,
  EmailCaptureController.addTagsToEmailCaptures
);

// Remove tags from email captures (must come before /:id)
router.put(
  "/bulk/tags/remove",
  removeTagsFromEmailCapturesValidation,
  EmailCaptureController.removeTagsFromEmailCaptures
);

// Get email capture by ID
router.get(
  "/:id",
  getEmailCaptureValidation,
  EmailCaptureController.getEmailCapture
);

// Update email capture
router.put(
  "/:id",
  updateEmailCaptureValidation,
  EmailCaptureController.updateEmailCapture
);

// Delete email capture
router.delete(
  "/:id",
  deleteEmailCaptureValidation,
  EmailCaptureController.deleteEmailCapture
);

export default router;
