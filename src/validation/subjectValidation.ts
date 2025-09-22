import { body, param } from "express-validator";

// Create subject validation rules
export const createSubjectValidation = [
  body("name")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage(
      "Subject name is required and must be less than 100 characters"
    ),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description must be less than 500 characters"),
];

// Update subject validation rules
export const updateSubjectValidation = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Subject name must be less than 100 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description must be less than 500 characters"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
];

// ID validation rules
export const idValidation = [
  param("id").isMongoId().withMessage("Invalid subject ID"),
];
