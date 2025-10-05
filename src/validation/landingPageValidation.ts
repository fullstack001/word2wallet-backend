import { body, param, query } from "express-validator";

export const createLandingPageValidation = [
  body("bookId")
    .notEmpty()
    .withMessage("Book ID is required")
    .isMongoId()
    .withMessage("Invalid book ID format"),

  body("title")
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 1, max: 200 })
    .withMessage("Title must be between 1 and 200 characters")
    .trim(),

  body("description")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters")
    .trim(),

  body("design").optional().isObject().withMessage("Design must be an object"),

  body("design.theme")
    .optional()
    .isIn(["default", "minimal", "modern", "classic"])
    .withMessage("Theme must be one of: default, minimal, modern, classic"),

  body("design.primaryColor")
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage("Primary color must be a valid hex color"),

  body("design.backgroundColor")
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage("Background color must be a valid hex color"),

  body("design.textColor")
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage("Text color must be a valid hex color"),

  body("design.fontFamily")
    .optional()
    .isIn(["Inter", "Roboto", "Open Sans", "Lato", "Poppins", "Montserrat"])
    .withMessage("Font family must be one of the supported fonts"),

  body("design.customCSS")
    .optional()
    .isLength({ max: 10000 })
    .withMessage("Custom CSS cannot exceed 10000 characters"),

  body("content").isObject().withMessage("Content must be an object"),

  body("content.heroTitle")
    .notEmpty()
    .withMessage("Hero title is required")
    .isLength({ min: 1, max: 200 })
    .withMessage("Hero title must be between 1 and 200 characters")
    .trim(),

  body("content.heroSubtitle")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Hero subtitle cannot exceed 500 characters")
    .trim(),

  body("content.heroImage")
    .optional()
    .isURL()
    .withMessage("Hero image must be a valid URL"),

  body("content.features")
    .optional()
    .isArray()
    .withMessage("Features must be an array"),

  body("content.features.*")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Feature cannot exceed 200 characters")
    .trim(),

  body("content.testimonials")
    .optional()
    .isArray()
    .withMessage("Testimonials must be an array"),

  body("content.testimonials.*.name")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Testimonial name cannot exceed 100 characters")
    .trim(),

  body("content.testimonials.*.text")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Testimonial text cannot exceed 500 characters")
    .trim(),

  body("content.testimonials.*.avatar")
    .optional()
    .isURL()
    .withMessage("Testimonial avatar must be a valid URL"),

  body("content.callToAction")
    .isObject()
    .withMessage("Call to action must be an object"),

  body("content.callToAction.text")
    .notEmpty()
    .withMessage("CTA text is required")
    .isLength({ min: 1, max: 200 })
    .withMessage("CTA text must be between 1 and 200 characters")
    .trim(),

  body("content.callToAction.buttonText")
    .notEmpty()
    .withMessage("CTA button text is required")
    .isLength({ min: 1, max: 50 })
    .withMessage("CTA button text must be between 1 and 50 characters")
    .trim(),

  body("content.callToAction.buttonColor")
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage("Button color must be a valid hex color"),

  body("content.aboutAuthor")
    .optional()
    .isObject()
    .withMessage("About author must be an object"),

  body("content.aboutAuthor.name")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Author name cannot exceed 100 characters")
    .trim(),

  body("content.aboutAuthor.bio")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Author bio cannot exceed 1000 characters")
    .trim(),

  body("content.aboutAuthor.avatar")
    .optional()
    .isURL()
    .withMessage("Author avatar must be a valid URL"),

  body("content.faq").optional().isArray().withMessage("FAQ must be an array"),

  body("content.faq.*.question")
    .optional()
    .isLength({ max: 200 })
    .withMessage("FAQ question cannot exceed 200 characters")
    .trim(),

  body("content.faq.*.answer")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("FAQ answer cannot exceed 1000 characters")
    .trim(),

  body("seo").optional().isObject().withMessage("SEO must be an object"),

  body("seo.metaTitle")
    .optional()
    .isLength({ max: 60 })
    .withMessage("Meta title cannot exceed 60 characters")
    .trim(),

  body("seo.metaDescription")
    .optional()
    .isLength({ max: 160 })
    .withMessage("Meta description cannot exceed 160 characters")
    .trim(),

  body("seo.metaKeywords")
    .optional()
    .isArray()
    .withMessage("Meta keywords must be an array"),

  body("seo.metaKeywords.*")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Meta keyword cannot exceed 50 characters")
    .trim(),

  body("seo.ogImage")
    .optional()
    .isURL()
    .withMessage("OG image must be a valid URL"),
];

export const updateLandingPageValidation = [
  param("id").isMongoId().withMessage("Invalid landing page ID format"),

  body("title")
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage("Title must be between 1 and 200 characters")
    .trim(),

  body("description")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters")
    .trim(),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("Is active must be a boolean"),

  body("design").optional().isObject().withMessage("Design must be an object"),

  body("content")
    .optional()
    .isObject()
    .withMessage("Content must be an object"),

  body("seo").optional().isObject().withMessage("SEO must be an object"),
];

export const getLandingPageValidation = [
  param("id").isMongoId().withMessage("Invalid landing page ID format"),
];

export const deleteLandingPageValidation = [
  param("id").isMongoId().withMessage("Invalid landing page ID format"),
];

export const getLandingPagesValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("bookId").optional().isMongoId().withMessage("Invalid book ID format"),

  query("isActive")
    .optional()
    .isBoolean()
    .withMessage("Is active must be a boolean"),
];

export const getLandingPageAnalyticsValidation = [
  param("id").isMongoId().withMessage("Invalid landing page ID format"),

  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid date"),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid date"),
];

