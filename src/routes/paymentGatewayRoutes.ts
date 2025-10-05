import { Router } from "express";
import { body, param } from "express-validator";
import { PaymentGatewayController } from "../controllers/paymentGatewayController";
import { auth } from "../middleware/auth";

const router = Router();

// Apply authentication middleware to all routes except webhooks
router.use((req, res, next) => {
  // Skip auth for webhook endpoints
  if (req.path.includes("/webhooks/")) {
    return next();
  }
  return auth(req, res, next);
});

/**
 * @route GET /api/payment-gateway/integrations
 * @desc Get user's payment gateway integrations
 * @access Private
 */
router.get("/integrations", PaymentGatewayController.getIntegrations);

/**
 * @route POST /api/payment-gateway/payment-intents
 * @desc Create payment intent
 * @access Private
 */
router.post(
  "/payment-intents",
  [
    body("provider")
      .isIn(["stripe", "paypal", "square", "razorpay"])
      .withMessage("Invalid payment provider"),
    body("amount")
      .isFloat({ min: 0.01 })
      .withMessage("Amount must be greater than 0"),
    body("currency")
      .optional()
      .isLength({ min: 3, max: 3 })
      .withMessage("Currency must be a 3-letter code"),
    body("metadata")
      .optional()
      .isObject()
      .withMessage("Metadata must be an object"),
  ],
  PaymentGatewayController.createPaymentIntent
);

/**
 * @route POST /api/payment-gateway/payments/confirm
 * @desc Confirm payment
 * @access Private
 */
router.post(
  "/payments/confirm",
  [
    body("provider")
      .isIn(["stripe", "paypal", "square", "razorpay"])
      .withMessage("Invalid payment provider"),
    body("paymentIntentId")
      .isString()
      .withMessage("Payment intent ID is required"),
    body("paymentMethodId")
      .optional()
      .isString()
      .withMessage("Payment method ID must be a string"),
  ],
  PaymentGatewayController.confirmPayment
);

/**
 * @route POST /api/payment-gateway/customers
 * @desc Create customer
 * @access Private
 */
router.post(
  "/customers",
  [
    body("provider")
      .isIn(["stripe", "paypal", "square", "razorpay"])
      .withMessage("Invalid payment provider"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("name").optional().isString().withMessage("Name must be a string"),
    body("metadata")
      .optional()
      .isObject()
      .withMessage("Metadata must be an object"),
  ],
  PaymentGatewayController.createCustomer
);

/**
 * @route POST /api/payment-gateway/subscriptions
 * @desc Create subscription
 * @access Private
 */
router.post(
  "/subscriptions",
  [
    body("provider")
      .isIn(["stripe", "paypal", "square", "razorpay"])
      .withMessage("Invalid payment provider"),
    body("customerId").isString().withMessage("Customer ID is required"),
    body("planId").isString().withMessage("Plan ID is required"),
    body("paymentMethodId")
      .optional()
      .isString()
      .withMessage("Payment method ID must be a string"),
  ],
  PaymentGatewayController.createSubscription
);

/**
 * @route POST /api/payment-gateway/integrations/:provider/test
 * @desc Test payment gateway integration
 * @access Private
 */
router.post(
  "/integrations/:provider/test",
  [
    param("provider")
      .isIn(["stripe", "paypal", "square", "razorpay"])
      .withMessage("Invalid payment provider"),
  ],
  PaymentGatewayController.testIntegration
);

/**
 * @route GET /api/payment-gateway/integrations/:provider/stats
 * @desc Get integration statistics
 * @access Private
 */
router.get(
  "/integrations/:provider/stats",
  [
    param("provider")
      .isIn(["stripe", "paypal", "square", "razorpay"])
      .withMessage("Invalid payment provider"),
  ],
  PaymentGatewayController.getIntegrationStats
);

/**
 * @route POST /api/payment-gateway/webhooks/:provider
 * @desc Process webhook from payment provider
 * @access Public (webhook endpoint)
 */
router.post(
  "/webhooks/:provider",
  [
    param("provider")
      .isIn(["stripe", "paypal", "square", "razorpay"])
      .withMessage("Invalid payment provider"),
  ],
  PaymentGatewayController.processWebhook
);

export default router;
