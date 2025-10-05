import { Router } from "express";
import { AnalyticsController } from "../controllers/analyticsController";
import { auth } from "../middleware/auth";
import {
  getUserAnalyticsValidation,
  getBookAnalyticsValidation,
  getEmailCaptureAnalyticsValidation,
  updateEmailCaptureStatusValidation,
  exportAnalyticsValidation,
} from "../validation/analyticsValidation";

const router = Router();

// All routes require authentication
router.use(auth);

// Get overall user analytics
router.get(
  "/",
  getUserAnalyticsValidation,
  AnalyticsController.getUserAnalytics
);

// Get analytics for a specific book
router.get(
  "/book/:bookId",
  getBookAnalyticsValidation,
  AnalyticsController.getBookAnalytics
);

// Get email capture analytics
router.get(
  "/email-captures",
  getEmailCaptureAnalyticsValidation,
  AnalyticsController.getEmailCaptureAnalytics
);

// Update email capture status
router.put(
  "/email-captures/:id",
  updateEmailCaptureStatusValidation,
  AnalyticsController.updateEmailCaptureStatus
);

// Export analytics data
router.get(
  "/export",
  exportAnalyticsValidation,
  AnalyticsController.exportAnalytics
);

export default router;

