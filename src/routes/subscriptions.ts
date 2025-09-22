import { Router } from "express";
import { body } from "express-validator";
import { SubscriptionController } from "../controllers/subscriptionController";
import { authenticate } from "../middleware/auth";

const router = Router();

// Validation middleware
const createSubscriptionValidation = [
  body("paymentMethodId")
    .optional()
    .isString()
    .withMessage("Payment method ID must be a string"),
  body("plan")
    .optional()
    .isIn(["basic", "premium"])
    .withMessage("Plan must be either 'basic' or 'premium'"),
];

const updateSubscriptionValidation = [
  body("plan")
    .isIn(["basic", "premium"])
    .withMessage("Plan must be either 'basic' or 'premium'"),
];

const cancelSubscriptionValidation = [
  body("immediately")
    .optional()
    .isBoolean()
    .withMessage("Immediately must be a boolean"),
];

// Routes
router.post(
  "/",
  authenticate,
  createSubscriptionValidation,
  SubscriptionController.createSubscription
);

router.get("/", authenticate, SubscriptionController.getSubscription);

router.post(
  "/cancel",
  authenticate,
  cancelSubscriptionValidation,
  SubscriptionController.cancelSubscription
);

router.post(
  "/reactivate",
  authenticate,
  SubscriptionController.reactivateSubscription
);

router.put(
  "/",
  authenticate,
  updateSubscriptionValidation,
  SubscriptionController.updateSubscription
);

router.post(
  "/setup-intent",
  authenticate,
  SubscriptionController.createSetupIntent
);

export default router;
