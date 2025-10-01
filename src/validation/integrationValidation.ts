import { param } from "express-validator";

export const getIntegrationByIdValidation = [
  param("id").isMongoId().withMessage("Invalid integration ID"),
];

export const deleteIntegrationValidation = [
  param("id").isMongoId().withMessage("Invalid integration ID"),
];

export const testIntegrationValidation = [
  param("id").isMongoId().withMessage("Invalid integration ID"),
];
