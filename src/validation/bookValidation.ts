import { body, param, query } from "express-validator";

export const uploadBookValidation = [
  body("title")
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ max: 200 })
    .withMessage("Title cannot exceed 200 characters")
    .trim(),

  body("author")
    .notEmpty()
    .withMessage("Author is required")
    .isLength({ max: 100 })
    .withMessage("Author cannot exceed 100 characters")
    .trim(),

  body("description")
    .optional()
    .isLength({ max: 2000 })
    .withMessage("Description cannot exceed 2000 characters")
    .trim(),

  body("isbn")
    .optional()
    .matches(
      /^(?:ISBN(?:-1[03])?:? )?(?=[0-9X]{10}$|(?=(?:[0-9]+[- ]){3})[- 0-9X]{13}$|97[89][0-9]{10}$|(?=(?:[0-9]+[- ]){4})[- 0-9]{17}$)(?:97[89][- ]?)?[0-9]{1,5}[- ]?[0-9]+[- ]?[0-9]+[- ]?[0-9X]$/
    )
    .withMessage("Please enter a valid ISBN"),

  body("publisher")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Publisher cannot exceed 100 characters")
    .trim(),

  body("publicationDate")
    .optional()
    .isISO8601()
    .withMessage("Publication date must be a valid date"),

  body("language")
    .optional()
    .isLength({ max: 10 })
    .withMessage("Language code cannot exceed 10 characters")
    .trim(),

  body("genre").optional().isString().withMessage("Genre must be a string"),

  body("tags").optional().isString().withMessage("Tags must be a string"),

  // New book information fields
  body("label")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Label cannot exceed 200 characters")
    .trim(),

  body("series")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Series name cannot exceed 100 characters")
    .trim(),

  body("volume")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Volume cannot exceed 50 characters")
    .trim(),

  body("tagline")
    .optional()
    .isLength({ max: 300 })
    .withMessage("Tagline cannot exceed 300 characters")
    .trim(),

  body("notesToReaders")
    .optional()
    .isLength({ max: 2000 })
    .withMessage("Notes to readers cannot exceed 2000 characters")
    .trim(),

  body("bookType")
    .optional()
    .isIn([
      "advance_copy",
      "excerpt",
      "full_book",
      "novella",
      "preview",
      "sample",
      "short_story",
      "teaser",
      "other",
    ])
    .withMessage("Invalid book type"),

  body("narrator")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Narrator name cannot exceed 100 characters")
    .trim(),

  body("audioQuality")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Audio quality cannot exceed 50 characters")
    .trim(),
];

export const updateBookValidation = [
  param("id").isMongoId().withMessage("Invalid book ID"),

  body("title")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Title cannot exceed 200 characters")
    .trim(),

  body("author")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Author cannot exceed 100 characters")
    .trim(),

  body("description")
    .optional()
    .isLength({ max: 2000 })
    .withMessage("Description cannot exceed 2000 characters")
    .trim(),

  body("isbn")
    .optional()
    .matches(
      /^(?:ISBN(?:-1[03])?:? )?(?=[0-9X]{10}$|(?=(?:[0-9]+[- ]){3})[- 0-9X]{13}$|97[89][0-9]{10}$|(?=(?:[0-9]+[- ]){4})[- 0-9]{17}$)(?:97[89][- ]?)?[0-9]{1,5}[- ]?[0-9]+[- ]?[0-9]+[- ]?[0-9X]$/
    )
    .withMessage("Please enter a valid ISBN"),

  body("publisher")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Publisher cannot exceed 100 characters")
    .trim(),

  body("publicationDate")
    .optional()
    .isISO8601()
    .withMessage("Publication date must be a valid date"),

  body("language")
    .optional()
    .isLength({ max: 10 })
    .withMessage("Language code cannot exceed 10 characters")
    .trim(),

  body("genre").optional().isArray().withMessage("Genre must be an array"),

  body("genre.*")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Each genre cannot exceed 50 characters")
    .trim(),

  body("tags").optional().isArray().withMessage("Tags must be an array"),

  body("tags.*")
    .optional()
    .isLength({ max: 30 })
    .withMessage("Each tag cannot exceed 30 characters")
    .trim(),

  // New book information fields
  body("label")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Label cannot exceed 200 characters")
    .trim(),

  body("series")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Series name cannot exceed 100 characters")
    .trim(),

  body("volume")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Volume cannot exceed 50 characters")
    .trim(),

  body("tagline")
    .optional()
    .isLength({ max: 300 })
    .withMessage("Tagline cannot exceed 300 characters")
    .trim(),

  body("notesToReaders")
    .optional()
    .isLength({ max: 2000 })
    .withMessage("Notes to readers cannot exceed 2000 characters")
    .trim(),

  body("bookType")
    .optional()
    .isIn([
      "advance_copy",
      "excerpt",
      "full_book",
      "novella",
      "preview",
      "sample",
      "short_story",
      "teaser",
      "other",
    ])
    .withMessage("Invalid book type"),

  body("narrator")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Narrator name cannot exceed 100 characters")
    .trim(),

  body("audioQuality")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Audio quality cannot exceed 50 characters")
    .trim(),
];

export const getBookValidation = [
  param("id").isMongoId().withMessage("Invalid book ID"),
];

export const deleteBookValidation = [
  param("id").isMongoId().withMessage("Invalid book ID"),
];

export const getBooksValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("search")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Search term cannot exceed 100 characters")
    .trim(),

  query("status")
    .optional()
    .isIn(["uploading", "processing", "ready", "error", "deleted"])
    .withMessage("Invalid status"),

  query("genre")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Genre cannot exceed 50 characters")
    .trim(),

  query("language")
    .optional()
    .isLength({ max: 10 })
    .withMessage("Language code cannot exceed 10 characters")
    .trim(),

  query("author")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Author cannot exceed 100 characters")
    .trim(),

  query("sort")
    .optional()
    .isIn(["title", "author", "uploadDate", "lastModified"])
    .withMessage("Invalid sort field"),

  query("order")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Order must be 'asc' or 'desc'"),
];

export const getBookStatusValidation = [
  param("id").isMongoId().withMessage("Invalid book ID"),
];

export const getBookDownloadUrlValidation = [
  param("id").isMongoId().withMessage("Invalid book ID"),
];
