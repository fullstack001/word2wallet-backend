import { body, ValidationChain } from "express-validator";

/**
 * Validation rules for write book feature
 */
export const writeBookValidation: ValidationChain[] = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 3, max: 200 })
    .withMessage("Title must be between 3 and 200 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description must be less than 1000 characters"),

  body("chapters")
    .notEmpty()
    .withMessage("Chapters are required")
    .custom((value) => {
      // If it's already an array, validate it
      if (Array.isArray(value)) {
        if (value.length === 0) {
          throw new Error("At least one chapter is required");
        }
        return true;
      }

      // If it's a string, try to parse it
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          if (!Array.isArray(parsed) || parsed.length === 0) {
            throw new Error("At least one chapter is required");
          }
          return true;
        } catch (error) {
          throw new Error("Invalid chapters format");
        }
      }

      throw new Error("Chapters must be an array");
    }),

  body("format")
    .notEmpty()
    .withMessage("Format is required")
    .custom((value) => {
      // Format can be a string or an array
      const formats = Array.isArray(value) ? value : [value];
      const validFormats = ["epub", "pdf"];

      for (const format of formats) {
        if (!validFormats.includes(format)) {
          throw new Error('Format must be either "epub" or "pdf"');
        }
      }

      return true;
    }),
];
