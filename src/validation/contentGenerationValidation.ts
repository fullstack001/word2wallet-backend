import { body } from "express-validator";

// Content generation validation rules
export const generateContentValidation = [
  body("title")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage(
      "Chapter title is required and must be less than 200 characters"
    ),

  body("description")
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage(
      "Chapter description is required and must be between 10 and 1000 characters"
    ),

  body("courseTitle")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Course title must be less than 200 characters"),

  body("subjectName")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Subject name must be less than 100 characters"),
];
