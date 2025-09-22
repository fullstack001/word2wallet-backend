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
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description must be less than 1000 characters"),
  body("subject").isMongoId().withMessage("Valid subject ID is required"),
  body("isPublished")
    .optional()
    .isBoolean()
    .withMessage("isPublished must be a boolean value"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
  body("googleDocLink")
    .optional()
    .custom((value) => {
      if (value && value.trim() !== "") {
        if (!value.startsWith("https://docs.google.com/")) {
          throw new Error("Google Doc link must be a valid Google Docs URL");
        }
      }
      return true;
    }),
  body("googleClassroomLink")
    .optional()
    .custom((value) => {
      if (value && value.trim() !== "") {
        if (!value.startsWith("https://classroom.google.com/")) {
          throw new Error(
            "Google Classroom link must be a valid Google Classroom URL"
          );
        }
      }
      return true;
    }),
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
    .isLength({ max: 1000 })
    .withMessage("Description must be less than 1000 characters"),
  body("subject")
    .optional()
    .isMongoId()
    .withMessage("Valid subject ID is required"),
  body("chapters")
    .optional()
    .isArray({ min: 1 })
    .withMessage("At least one chapter is required"),
  body("chapters.*.title")
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Chapter title must be less than 200 characters"),
  body("chapters.*.description")
    .optional()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage("Chapter description must be less than 500 characters"),
  body("chapters.*.content")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("Chapter content is required"),
  body("isPublished")
    .optional()
    .isBoolean()
    .withMessage("isPublished must be a boolean value"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
  body("googleDocLink")
    .optional()
    .custom((value) => {
      if (value && value.trim() !== "") {
        if (!value.startsWith("https://docs.google.com/")) {
          throw new Error("Google Doc link must be a valid Google Docs URL");
        }
      }
      return true;
    }),
  body("googleClassroomLink")
    .optional()
    .custom((value) => {
      if (value && value.trim() !== "") {
        if (!value.startsWith("https://classroom.google.com/")) {
          throw new Error(
            "Google Classroom link must be a valid Google Classroom URL"
          );
        }
      }
      return true;
    }),
];

// Course ID validation rules
export const courseIdValidation = [
  param("id").isMongoId().withMessage("Invalid course ID"),
];

// Multimedia file validation rules
export const multimediaFileValidation = [
  param("id").isMongoId().withMessage("Invalid course ID"),
  param("type")
    .isIn(["audio", "video"])
    .withMessage("Type must be 'audio' or 'video'"),
  param("fileId").isLength({ min: 1 }).withMessage("File ID is required"),
];
