import { body, param, query } from "express-validator";

export const createBookFunnelDeliveryValidation = [
  body("bookId").isMongoId().withMessage("Invalid book ID"),
];

export const getDeliveryStatusValidation = [
  param("id").isMongoId().withMessage("Invalid delivery ID"),
];

export const getUserDeliveriesValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("type")
    .optional()
    .isIn([
      "epub_validation",
      "epub_packaging",
      "bookfunnel_upload",
      "arc_campaign_create",
      "arc_codes_generate",
      "bookfunnel_sync",
    ])
    .withMessage("Invalid job type"),

  query("status")
    .optional()
    .isIn([
      "pending",
      "processing",
      "completed",
      "failed",
      "retrying",
      "cancelled",
    ])
    .withMessage("Invalid status"),
];

export const cancelDeliveryValidation = [
  param("id").isMongoId().withMessage("Invalid delivery ID"),
];

export const retryDeliveryValidation = [
  param("id").isMongoId().withMessage("Invalid delivery ID"),
];

export const getBookDeliveryHistoryValidation = [
  param("bookId").isMongoId().withMessage("Invalid book ID"),
];
