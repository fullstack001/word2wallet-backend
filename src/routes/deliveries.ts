import { Router } from "express";
import { DeliveryController } from "../controllers/deliveryController";
import { auth } from "../middleware/auth";
import {
  createBookFunnelDeliveryValidation,
  getDeliveryStatusValidation,
  getUserDeliveriesValidation,
  cancelDeliveryValidation,
  retryDeliveryValidation,
  getBookDeliveryHistoryValidation,
} from "../validation/deliveryValidation";

const router = Router();

// All routes require authentication
router.use(auth);

// Create BookFunnel delivery
router.post(
  "/bookfunnel",
  createBookFunnelDeliveryValidation,
  DeliveryController.createBookFunnelDelivery
);

// Get delivery status
router.get(
  "/:id/status",
  getDeliveryStatusValidation,
  DeliveryController.getDeliveryStatus
);

// Get user deliveries
router.get(
  "/",
  getUserDeliveriesValidation,
  DeliveryController.getUserDeliveries
);

// Cancel delivery
router.delete(
  "/:id",
  cancelDeliveryValidation,
  DeliveryController.cancelDelivery
);

// Retry delivery
router.post(
  "/:id/retry",
  retryDeliveryValidation,
  DeliveryController.retryDelivery
);

// Get book delivery history
router.get(
  "/books/:bookId/history",
  getBookDeliveryHistoryValidation,
  DeliveryController.getBookDeliveryHistory
);

export default router;
