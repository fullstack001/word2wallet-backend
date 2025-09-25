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
    .isIn(["pro", "premium"])
    .withMessage("Plan must be either 'pro' or 'premium'"),
];

const updateSubscriptionValidation = [
  body("plan")
    .isIn(["pro", "premium"])
    .withMessage("Plan must be either 'pro' or 'premium'"),
];

const cancelSubscriptionValidation = [
  body("immediately")
    .optional()
    .isBoolean()
    .withMessage("Immediately must be a boolean"),
  body("reason")
    .optional()
    .isString()
    .withMessage("Cancellation reason must be a string"),
  body("feedback")
    .optional()
    .isString()
    .withMessage("Cancellation feedback must be a string"),
];

const upgradeTrialValidation = [
  body("paymentMethodId")
    .notEmpty()
    .withMessage("Payment method ID is required"),
  body("plan")
    .optional()
    .isIn(["pro", "premium"])
    .withMessage("Plan must be either 'pro' or 'premium'"),
];

const upgradeTrialImmediateValidation = [
  body("plan")
    .optional()
    .isIn(["pro", "premium"])
    .withMessage("Plan must be either 'pro' or 'premium'"),
];

const upgradeDirectValidation = [
  body("paymentMethodId")
    .notEmpty()
    .withMessage("Payment method ID is required"),
  body("plan")
    .optional()
    .isIn(["pro", "premium"])
    .withMessage("Plan must be either 'pro' or 'premium'"),
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

router.post(
  "/trial",
  authenticate,
  SubscriptionController.createTrialSubscription
);

router.post(
  "/upgrade",
  authenticate,
  upgradeTrialValidation,
  SubscriptionController.upgradeTrialSubscription
);

router.post(
  "/upgrade-trial",
  authenticate,
  upgradeTrialImmediateValidation,
  SubscriptionController.upgradeTrialImmediate
);

router.post(
  "/upgrade-direct",
  authenticate,
  upgradeDirectValidation,
  SubscriptionController.upgradeSubscriptionDirect
);

export default router;
