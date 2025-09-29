import { body, param, query } from "express-validator";

export const createArcCampaignValidation = [
  body("bookId").isMongoId().withMessage("Invalid book ID"),

  body("campaignName")
    .notEmpty()
    .withMessage("Campaign name is required")
    .isLength({ max: 100 })
    .withMessage("Campaign name cannot exceed 100 characters")
    .trim(),

  body("description")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters")
    .trim(),

  body("quantity")
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage("Quantity must be between 1 and 1000"),

  body("maxDownloads")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Max downloads must be a positive integer"),

  body("expiresAt")
    .optional()
    .isISO8601()
    .withMessage("Expiration date must be a valid date"),

  body("maxDownloadsPerCode")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Max downloads per code must be a positive integer"),
];

export const getBookArcLinksValidation = [
  param("bookId").isMongoId().withMessage("Invalid book ID"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("status")
    .optional()
    .isIn(["active", "expired", "max_downloads_reached", "disabled", "error"])
    .withMessage("Invalid status"),

  query("expired")
    .optional()
    .isBoolean()
    .withMessage("Expired must be a boolean"),
];

export const getUserArcLinksValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("status")
    .optional()
    .isIn(["active", "expired", "max_downloads_reached", "disabled", "error"])
    .withMessage("Invalid status"),

  query("expired")
    .optional()
    .isBoolean()
    .withMessage("Expired must be a boolean"),
];

export const getArcLinkValidation = [
  param("code")
    .notEmpty()
    .withMessage("Code is required")
    .isLength({ min: 6, max: 20 })
    .withMessage("Code must be between 6 and 20 characters")
    .trim(),
];

export const downloadArcValidation = [
  param("code")
    .notEmpty()
    .withMessage("Code is required")
    .isLength({ min: 6, max: 20 })
    .withMessage("Code must be between 6 and 20 characters")
    .trim(),
];

export const updateArcLinkValidation = [
  param("id").isMongoId().withMessage("Invalid ARC link ID"),

  body("status")
    .optional()
    .isIn(["active", "expired", "max_downloads_reached", "disabled", "error"])
    .withMessage("Invalid status"),

  body("expiresAt")
    .optional()
    .isISO8601()
    .withMessage("Expiration date must be a valid date"),

  body("maxDownloads")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Max downloads must be a positive integer"),
];

export const deleteArcLinkValidation = [
  param("id").isMongoId().withMessage("Invalid ARC link ID"),
];

export const getArcLinkAnalyticsValidation = [
  param("id").isMongoId().withMessage("Invalid ARC link ID"),
];
