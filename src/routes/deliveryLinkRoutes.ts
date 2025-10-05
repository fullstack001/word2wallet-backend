import { Router } from "express";
import { DeliveryLinkController } from "../controllers/deliveryLinkController";
import { auth } from "../middleware/auth";
import {
  createDeliveryLinkValidation,
  updateDeliveryLinkValidation,
  getDeliveryLinkValidation,
  deleteDeliveryLinkValidation,
  getDeliveryLinksValidation,
  getDeliveryLinkAnalyticsValidation,
} from "../validation/deliveryLinkValidation";

const router = Router();

// All routes require authentication
router.use(auth);

// Create delivery link
router.post(
  "/",
  createDeliveryLinkValidation,
  DeliveryLinkController.createDeliveryLink
);

// Get user's delivery links
router.get(
  "/",
  getDeliveryLinksValidation,
  DeliveryLinkController.getDeliveryLinks
);

// Get delivery link by ID
router.get(
  "/:id",
  getDeliveryLinkValidation,
  DeliveryLinkController.getDeliveryLink
);

// Update delivery link
router.put(
  "/:id",
  updateDeliveryLinkValidation,
  DeliveryLinkController.updateDeliveryLink
);

// Delete delivery link
router.delete(
  "/:id",
  deleteDeliveryLinkValidation,
  DeliveryLinkController.deleteDeliveryLink
);

// Get delivery link analytics
router.get(
  "/:id/analytics",
  getDeliveryLinkAnalyticsValidation,
  DeliveryLinkController.getDeliveryLinkAnalytics
);

// Public routes (no auth required)
// Access delivery link by slug
router.post("/public/:slug", DeliveryLinkController.accessDeliveryLink);

// Download from delivery link
router.get(
  "/public/:slug/download",
  DeliveryLinkController.downloadFromDeliveryLink
);

export default router;

