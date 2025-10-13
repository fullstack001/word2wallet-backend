import { body, param, query } from "express-validator";

// Custom validator to check if at least one payment link is provided
const atLeastOnePaymentLink = (value: any, { req }: any) => {
  const saleSettings = req.body.saleSettings;
  if (saleSettings && saleSettings.enabled) {
    const hasPaypal =
      saleSettings.paypalLink && saleSettings.paypalLink.trim().length > 0;
    const hasStripe =
      saleSettings.stripeLink && saleSettings.stripeLink.trim().length > 0;

    if (!hasPaypal && !hasStripe) {
      throw new Error(
        "At least one payment link (PayPal or Stripe) is required for sale links"
      );
    }
  }
  return true;
};

export const createDeliveryLinkValidation = [
  body("bookId")
    .notEmpty()
    .withMessage("Book ID is required")
    .isMongoId()
    .withMessage("Invalid book ID format"),

  body("title")
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 1, max: 200 })
    .withMessage("Title must be between 1 and 200 characters")
    .trim(),

  body("description")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters")
    .trim(),

  body("settings")
    .optional()
    .isObject()
    .withMessage("Settings must be an object"),

  body("settings.requireEmail")
    .optional()
    .isBoolean()
    .withMessage("Require email must be a boolean"),

  body("settings.allowAnonymous")
    .optional()
    .isBoolean()
    .withMessage("Allow anonymous must be a boolean"),

  body("settings.maxDownloads")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Max downloads must be a positive integer"),

  body("settings.expiryDate")
    .optional()
    .isISO8601()
    .withMessage("Expiry date must be a valid date"),

  body("settings.password")
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage("Password must be between 1 and 100 characters")
    .trim(),

  // Sale settings validation
  body("saleSettings")
    .optional()
    .isObject()
    .withMessage("Sale settings must be an object"),

  body("saleSettings.enabled")
    .optional()
    .isBoolean()
    .withMessage("Sale enabled must be a boolean"),

  body("saleSettings.price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),

  body("saleSettings.currency")
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage("Currency must be a 3-letter code")
    .trim(),

  body("saleSettings.salePageTitle")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Sale page title cannot exceed 200 characters")
    .trim(),

  body("saleSettings.salePageDescription")
    .optional()
    .isLength({ max: 2000000 })
    .withMessage("Sale page description cannot exceed 2000 characters")
    .trim(),

  body("saleSettings.paypalLink")
    .optional()
    .isLength({ max: 500 })
    .withMessage("PayPal link cannot exceed 500 characters")
    .trim(),

  body("saleSettings.stripeLink")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Stripe link cannot exceed 500 characters")
    .trim(),

  // Custom validation: at least one payment link required
  body("saleSettings").optional().custom(atLeastOnePaymentLink),
];

export const updateDeliveryLinkValidation = [
  param("id").isMongoId().withMessage("Invalid delivery link ID format"),

  body("title")
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage("Title must be between 1 and 200 characters")
    .trim(),

  body("description")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters")
    .trim(),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("Is active must be a boolean"),

  body("settings")
    .optional()
    .isObject()
    .withMessage("Settings must be an object"),

  body("settings.requireEmail")
    .optional()
    .isBoolean()
    .withMessage("Require email must be a boolean"),

  body("settings.allowAnonymous")
    .optional()
    .isBoolean()
    .withMessage("Allow anonymous must be a boolean"),

  body("settings.maxDownloads")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Max downloads must be a positive integer"),

  body("settings.expiryDate")
    .optional()
    .isISO8601()
    .withMessage("Expiry date must be a valid date"),

  body("settings.password")
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage("Password must be between 1 and 100 characters")
    .trim(),

  // Sale settings validation
  body("saleSettings")
    .optional()
    .isObject()
    .withMessage("Sale settings must be an object"),

  body("saleSettings.enabled")
    .optional()
    .isBoolean()
    .withMessage("Sale enabled must be a boolean"),

  body("saleSettings.price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),

  body("saleSettings.currency")
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage("Currency must be a 3-letter code")
    .trim(),

  body("saleSettings.salePageTitle")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Sale page title cannot exceed 200 characters")
    .trim(),

  body("saleSettings.salePageDescription")
    .optional()
    .isLength({ max: 2000000 })
    .withMessage("Sale page description cannot exceed 2000 characters")
    .trim(),

  body("saleSettings.paypalLink")
    .optional()
    .isLength({ max: 500 })
    .withMessage("PayPal link cannot exceed 500 characters")
    .trim(),

  body("saleSettings.stripeLink")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Stripe link cannot exceed 500 characters")
    .trim(),

  // Custom validation: at least one payment link required
  body("saleSettings").optional().custom(atLeastOnePaymentLink),
];

export const getDeliveryLinkValidation = [
  param("id").isMongoId().withMessage("Invalid delivery link ID format"),
];

export const deleteDeliveryLinkValidation = [
  param("id").isMongoId().withMessage("Invalid delivery link ID format"),
];

export const getDeliveryLinksValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("bookId").optional().isMongoId().withMessage("Invalid book ID format"),

  query("isActive")
    .optional()
    .isBoolean()
    .withMessage("Is active must be a boolean"),
];

export const getDeliveryLinkAnalyticsValidation = [
  param("id").isMongoId().withMessage("Invalid delivery link ID format"),

  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid date"),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid date"),
];
