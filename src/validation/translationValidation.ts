import { body } from "express-validator";

// Translation validation rules
export const translateTextValidation = [
  body("text")
    .trim()
    .isLength({ min: 1, max: 10000 })
    .withMessage(
      "Text is required and must be between 1 and 10,000 characters"
    ),

  body("targetLanguage")
    .trim()
    .isLength({ min: 2, max: 5 })
    .withMessage(
      "Target language is required and must be a valid language code (2-5 characters)"
    )
    .matches(/^[a-z]{2,5}$/)
    .withMessage("Target language must be a valid ISO language code"),

  body("sourceLanguage")
    .optional()
    .trim()
    .isLength({ min: 2, max: 5 })
    .withMessage(
      "Source language must be a valid language code (2-5 characters)"
    )
    .matches(/^[a-z]{2,5}$/)
    .withMessage("Source language must be a valid ISO language code"),
];

export const translateHtmlValidation = [
  body("htmlContent")
    .trim()
    .isLength({ min: 1, max: 50000 })
    .withMessage(
      "HTML content is required and must be between 1 and 50,000 characters"
    ),

  body("targetLanguage")
    .trim()
    .isLength({ min: 2, max: 5 })
    .withMessage(
      "Target language is required and must be a valid language code (2-5 characters)"
    )
    .matches(/^[a-z]{2,5}$/)
    .withMessage("Target language must be a valid ISO language code"),

  body("sourceLanguage")
    .optional()
    .trim()
    .isLength({ min: 2, max: 5 })
    .withMessage(
      "Source language must be a valid language code (2-5 characters)"
    )
    .matches(/^[a-z]{2,5}$/)
    .withMessage("Source language must be a valid ISO language code"),
];

export const detectLanguageValidation = [
  body("text")
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage("Text is required and must be between 1 and 5,000 characters"),
];
