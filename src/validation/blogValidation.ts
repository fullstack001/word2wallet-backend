import { body, param } from "express-validator";

// Create blog validation rules
export const createBlogValidation = [
  body("title")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Title is required and must be less than 200 characters"),
  body("content")
    .trim()
    .isLength({ min: 1 })
    .withMessage("Content is required"),
  body("excerpt")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Excerpt must be less than 500 characters"),
  body("featuredImage").optional().trim(),
  // .isURL()
  // .withMessage("Featured image must be a valid URL"),
  body("tags").optional().isArray().withMessage("Tags must be an array"),
  body("tags.*")
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Each tag must be between 1 and 50 characters"),
  body("status")
    .optional()
    .isIn(["draft", "published"])
    .withMessage("Status must be either 'draft' or 'published'"),
];

// Update blog validation rules
export const updateBlogValidation = [
  body("title")
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Title must be less than 200 characters"),
  body("content")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("Content cannot be empty"),
  body("excerpt")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Excerpt must be less than 500 characters"),
  body("featuredImage").optional().trim(),
  // .isURL()
  // .withMessage("Featured image must be a valid URL"),
  body("tags").optional().isArray().withMessage("Tags must be an array"),
  body("tags.*")
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Each tag must be between 1 and 50 characters"),
  body("status")
    .optional()
    .isIn(["draft", "published"])
    .withMessage("Status must be either 'draft' or 'published'"),
];

// Blog ID validation rules
export const blogIdValidation = [
  param("id").isLength({ min: 1 }).withMessage("Blog ID or slug is required"),
];

export const blogIdParamValidation = [
  param("blogId").isLength({ min: 1 }).withMessage("Blog ID is required"),
];

// Comment validation rules
export const createCommentValidation = [
  body("content")
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage(
      "Comment content is required and must be less than 2000 characters"
    ),
  body("parent")
    .optional()
    .isMongoId()
    .withMessage("Parent comment ID must be a valid MongoDB ID"),
  body("anonymousName")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Name must be between 1 and 100 characters"),
  body("anonymousEmail")
    .optional()
    .trim()
    .isEmail()
    .withMessage("Please enter a valid email address")
    .normalizeEmail(),
];

// Update comment validation rules
export const updateCommentValidation = [
  body("content")
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage(
      "Comment content is required and must be less than 2000 characters"
    ),
];

// Reaction validation rules
export const createReactionValidation = [
  body("type")
    .optional()
    .isIn(["like", "love", "thumbsup", "thumbsdown"])
    .withMessage(
      "Reaction type must be one of: like, love, thumbsup, thumbsdown"
    ),
];
