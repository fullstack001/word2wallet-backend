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

// Bulk update email captures
router.put(
  "/bulk/update",
  bulkUpdateEmailCapturesValidation,
  EmailCaptureController.bulkUpdateEmailCaptures
);

// Export email captures
router.get(
  "/export",
  exportEmailCapturesValidation,
  EmailCaptureController.exportEmailCaptures
);

// Get email capture statistics
router.get(
  "/stats",
  getEmailCaptureStatsValidation,
  EmailCaptureController.getEmailCaptureStats
);

// Add tags to email captures
router.put(
  "/bulk/tags/add",
  addTagsToEmailCapturesValidation,
  EmailCaptureController.addTagsToEmailCaptures
);

// Remove tags from email captures
router.put(
  "/bulk/tags/remove",
  removeTagsFromEmailCapturesValidation,
  EmailCaptureController.removeTagsFromEmailCaptures
);

export default router;

