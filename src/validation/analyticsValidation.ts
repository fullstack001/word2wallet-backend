import { body, param, query } from "express-validator";

export const getUserAnalyticsValidation = [
  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid date"),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid date"),

  query("groupBy")
    .optional()
    .isIn(["hour", "day", "week", "month"])
    .withMessage("Group by must be one of: hour, day, week, month"),
];

export const getBookAnalyticsValidation = [
  param("bookId").isMongoId().withMessage("Invalid book ID format"),

  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid date"),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid date"),

  query("groupBy")
    .optional()
    .isIn(["hour", "day", "week", "month"])
    .withMessage("Group by must be one of: hour, day, week, month"),
];

export const getEmailCaptureAnalyticsValidation = [
  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid date"),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid date"),

  query("bookId").optional().isMongoId().withMessage("Invalid book ID format"),

  query("status")
    .optional()
    .isIn(["new", "contacted", "converted", "unsubscribed", "bounced"])
    .withMessage(
      "Status must be one of: new, contacted, converted, unsubscribed, bounced"
    ),
];

export const updateEmailCaptureStatusValidation = [
  param("id").isMongoId().withMessage("Invalid email capture ID format"),

  body("status")
    .optional()
    .isIn(["new", "contacted", "converted", "unsubscribed", "bounced"])
    .withMessage(
      "Status must be one of: new, contacted, converted, unsubscribed, bounced"
    ),

  body("notes")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Notes cannot exceed 1000 characters")
    .trim(),

  body("tags").optional().isArray().withMessage("Tags must be an array"),

  body("tags.*")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Tag cannot exceed 50 characters")
    .trim(),
];

export const exportAnalyticsValidation = [
  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid date"),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid date"),

  query("format")
    .optional()
    .isIn(["csv", "json"])
    .withMessage("Format must be either csv or json"),

  query("bookId").optional().isMongoId().withMessage("Invalid book ID format"),
];

