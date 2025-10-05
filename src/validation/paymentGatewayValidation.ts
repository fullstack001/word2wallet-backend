import { body, param, query } from "express-validator";

export const paymentGatewayValidation = {
  // Create payment intent validation
  createPaymentIntent: [
    body("provider")
      .isIn(["stripe", "paypal", "square", "razorpay"])
      .withMessage("Invalid payment provider"),
    body("amount")
      .isFloat({ min: 0.01, max: 999999.99 })
      .withMessage("Amount must be between 0.01 and 999999.99"),
    body("currency")
      .optional()
      .isLength({ min: 3, max: 3 })
      .withMessage("Currency must be a 3-letter code")
      .isUppercase()
      .withMessage("Currency must be uppercase"),
    body("metadata")
      .optional()
      .isObject()
      .withMessage("Metadata must be an object"),
    body("metadata.*")
      .optional()
      .isString()
      .withMessage("Metadata values must be strings"),
  ],

  // Confirm payment validation
  confirmPayment: [
    body("provider")
      .isIn(["stripe", "paypal", "square", "razorpay"])
      .withMessage("Invalid payment provider"),
    body("paymentIntentId")
      .isString()
      .withMessage("Payment intent ID is required")
      .isLength({ min: 1, max: 200 })
      .withMessage("Payment intent ID must be between 1 and 200 characters"),
    body("paymentMethodId")
      .optional()
      .isString()
      .withMessage("Payment method ID must be a string")
      .isLength({ min: 1, max: 200 })
      .withMessage("Payment method ID must be between 1 and 200 characters"),
  ],

  // Create customer validation
  createCustomer: [
    body("provider")
      .isIn(["stripe", "paypal", "square", "razorpay"])
      .withMessage("Invalid payment provider"),
    body("email")
      .isEmail()
      .withMessage("Valid email is required")
      .normalizeEmail(),
    body("name")
      .optional()
      .isString()
      .withMessage("Name must be a string")
      .isLength({ min: 1, max: 100 })
      .withMessage("Name must be between 1 and 100 characters"),
    body("metadata")
      .optional()
      .isObject()
      .withMessage("Metadata must be an object"),
    body("metadata.*")
      .optional()
      .isString()
      .withMessage("Metadata values must be strings"),
  ],

  // Create subscription validation
  createSubscription: [
    body("provider")
      .isIn(["stripe", "paypal", "square", "razorpay"])
      .withMessage("Invalid payment provider"),
    body("customerId")
      .isString()
      .withMessage("Customer ID is required")
      .isLength({ min: 1, max: 200 })
      .withMessage("Customer ID must be between 1 and 200 characters"),
    body("planId")
      .isString()
      .withMessage("Plan ID is required")
      .isLength({ min: 1, max: 200 })
      .withMessage("Plan ID must be between 1 and 200 characters"),
    body("paymentMethodId")
      .optional()
      .isString()
      .withMessage("Payment method ID must be a string")
      .isLength({ min: 1, max: 200 })
      .withMessage("Payment method ID must be between 1 and 200 characters"),
  ],

  // Test integration validation
  testIntegration: [
    param("provider")
      .isIn(["stripe", "paypal", "square", "razorpay"])
      .withMessage("Invalid payment provider"),
  ],

  // Get integration stats validation
  getIntegrationStats: [
    param("provider")
      .isIn(["stripe", "paypal", "square", "razorpay"])
      .withMessage("Invalid payment provider"),
  ],

  // Process webhook validation
  processWebhook: [
    param("provider")
      .isIn(["stripe", "paypal", "square", "razorpay"])
      .withMessage("Invalid payment provider"),
  ],
};
