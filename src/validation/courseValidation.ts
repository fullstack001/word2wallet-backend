import { body, param } from "express-validator";

// Create course validation rules
export const createCourseValidation = [
  body("title")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage(
      "Course title is required and must be less than 200 characters"
    ),
  body("description")
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage(
      "Description is required and must be less than 1000 characters"
    ),
  body("subject").isMongoId().withMessage("Valid subject ID is required"),
  body("isPublished")
    .optional()
    .isBoolean()
    .withMessage("isPublished must be a boolean value"),
];

// Update course validation rules
export const updateCourseValidation = [
  body("title")
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Course title must be less than 200 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage("Description must be less than 1000 characters"),
  body("subject")
    .optional()
    .isMongoId()
    .withMessage("Valid subject ID is required"),
  body("isPublished")
    .optional()
    .isBoolean()
    .withMessage("isPublished must be a boolean value"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
];

// Course ID validation rules
export const courseIdValidation = [
  param("id").isMongoId().withMessage("Invalid course ID"),
];
