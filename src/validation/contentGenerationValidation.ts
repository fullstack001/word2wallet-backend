import { body, ValidationChain } from "express-validator";

/**
 * Content generation validation rules for dual-mode support.
 *
 * Supports two modes:
 * 1. RAW_XHTML - requires: mode, html
 * 2. STRICT_NATIVE_BLOCKS - requires: mode; optional: title, description, instructions, courseTitle, subjectName, strict
 */
export const generateContentValidation: ValidationChain[] = [
  // Mode is always required
  body("mode")
    .trim()
    .notEmpty()
    .withMessage("Mode is required")
    .isIn(["RAW_XHTML", "STRICT_NATIVE_BLOCKS"])
    .withMessage('Mode must be either "RAW_XHTML" or "STRICT_NATIVE_BLOCKS"'),

  // RAW_XHTML mode validations
  body("html")
    .if(body("mode").equals("RAW_XHTML"))
    .trim()
    .notEmpty()
    .withMessage("HTML content is required for RAW_XHTML mode")
    .isLength({ min: 1, max: 50000 })
    .withMessage("HTML content must be between 1 and 50000 characters"),

  // STRICT_NATIVE_BLOCKS mode validations
  body("title")
    .if(body("mode").equals("STRICT_NATIVE_BLOCKS"))
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage("Chapter title must be between 3 and 200 characters"),

  body("description")
    .if(body("mode").equals("STRICT_NATIVE_BLOCKS"))
    .optional()
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage("Chapter description must be between 10 and 1000 characters"),

  body("instructions")
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage("Instructions must be less than 5000 characters"),

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

  body("strict")
    .optional()
    .isBoolean()
    .withMessage("Strict must be a boolean value"),
];
