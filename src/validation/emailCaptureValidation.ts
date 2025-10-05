import { body, param, query } from "express-validator";

export const getEmailCapturesValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("bookId").optional().isMongoId().withMessage("Invalid book ID format"),

  query("status")
    .optional()
    .isIn(["new", "contacted", "converted", "unsubscribed", "bounced"])
    .withMessage(
      "Status must be one of: new, contacted, converted, unsubscribed, bounced"
    ),

  query("search")
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search term must be between 1 and 100 characters")
    .trim(),

  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid date"),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid date"),

  query("sortBy")
    .optional()
    .isIn(["createdAt", "email", "firstName", "lastName", "status"])
    .withMessage(
      "Sort by must be one of: createdAt, email, firstName, lastName, status"
    ),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be either asc or desc"),
];

export const getEmailCaptureValidation = [
  param("id").isMongoId().withMessage("Invalid email capture ID format"),
];

export const updateEmailCaptureValidation = [
  param("id").isMongoId().withMessage("Invalid email capture ID format"),

  body("firstName")
    .optional()
    .isLength({ max: 100 })
    .withMessage("First name cannot exceed 100 characters")
    .trim(),

  body("lastName")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Last name cannot exceed 100 characters")
    .trim(),

  body("status")
    .optional()
    .isIn(["new", "contacted", "converted", "unsubscribed", "bounced"])
    .withMessage(
      "Status must be one of: new, contacted, converted, unsubscribed, bounced"
    ),

  body("tags").optional().isArray().withMessage("Tags must be an array"),

  body("tags.*")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Tag cannot exceed 50 characters")
    .trim(),

  body("notes")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Notes cannot exceed 1000 characters")
    .trim(),
];

export const deleteEmailCaptureValidation = [
  param("id").isMongoId().withMessage("Invalid email capture ID format"),
];

export const bulkUpdateEmailCapturesValidation = [
  body("emailCaptureIds")
    .isArray({ min: 1 })
    .withMessage("Email capture IDs must be a non-empty array"),

  body("emailCaptureIds.*")
    .isMongoId()
    .withMessage("Each email capture ID must be a valid MongoDB ID"),

  body("status")
    .optional()
    .isIn(["new", "contacted", "converted", "unsubscribed", "bounced"])
    .withMessage(
      "Status must be one of: new, contacted, converted, unsubscribed, bounced"
    ),

  body("tags").optional().isArray().withMessage("Tags must be an array"),

  body("tags.*")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Tag cannot exceed 50 characters")
    .trim(),

  body("notes")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Notes cannot exceed 1000 characters")
    .trim(),
];

export const exportEmailCapturesValidation = [
  query("format")
    .optional()
    .isIn(["csv", "json"])
    .withMessage("Format must be either csv or json"),

  query("bookId").optional().isMongoId().withMessage("Invalid book ID format"),

  query("status")
    .optional()
    .isIn(["new", "contacted", "converted", "unsubscribed", "bounced"])
    .withMessage(
      "Status must be one of: new, contacted, converted, unsubscribed, bounced"
    ),

  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid date"),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid date"),
];

export const getEmailCaptureStatsValidation = [
  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid date"),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid date"),

  query("bookId").optional().isMongoId().withMessage("Invalid book ID format"),
];

export const addTagsToEmailCapturesValidation = [
  body("emailCaptureIds")
    .isArray({ min: 1 })
    .withMessage("Email capture IDs must be a non-empty array"),

  body("emailCaptureIds.*")
    .isMongoId()
    .withMessage("Each email capture ID must be a valid MongoDB ID"),

  body("tags")
    .isArray({ min: 1 })
    .withMessage("Tags must be a non-empty array"),

  body("tags.*")
    .isLength({ min: 1, max: 50 })
    .withMessage("Each tag must be between 1 and 50 characters")
    .trim(),
];

export const removeTagsFromEmailCapturesValidation = [
  body("emailCaptureIds")
    .isArray({ min: 1 })
    .withMessage("Email capture IDs must be a non-empty array"),

  body("emailCaptureIds.*")
    .isMongoId()
    .withMessage("Each email capture ID must be a valid MongoDB ID"),

  body("tags")
    .isArray({ min: 1 })
    .withMessage("Tags must be a non-empty array"),

  body("tags.*")
    .isLength({ min: 1, max: 50 })
    .withMessage("Each tag must be between 1 and 50 characters")
    .trim(),
];

