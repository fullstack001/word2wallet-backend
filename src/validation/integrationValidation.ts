import { body, param, query } from "express-validator";

export const connectBookFunnelValidation = [
  body("apiKey")
    .notEmpty()
    .withMessage("API key is required")
    .isLength({ min: 10, max: 200 })
    .withMessage("API key must be between 10 and 200 characters")
    .trim(),
];

export const getIntegrationValidation = [
  param("provider")
    .isIn(["bookfunnel", "amazon_kdp", "draft2digital", "smashwords"])
    .withMessage("Invalid provider"),
];

export const updateIntegrationValidation = [
  param("id").isMongoId().withMessage("Invalid integration ID"),

  body("settings")
    .optional()
    .isObject()
    .withMessage("Settings must be an object"),
];

export const disconnectIntegrationValidation = [
  param("id").isMongoId().withMessage("Invalid integration ID"),
];

export const deleteIntegrationValidation = [
  param("id").isMongoId().withMessage("Invalid integration ID"),
];

export const testIntegrationValidation = [
  param("id").isMongoId().withMessage("Invalid integration ID"),
];

export const syncIntegrationValidation = [
  param("id").isMongoId().withMessage("Invalid integration ID"),
];
