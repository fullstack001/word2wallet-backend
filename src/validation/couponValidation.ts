import { body, param, query } from "express-validator";

export const createCouponValidation = [
  body("code")
    .trim()
    .notEmpty()
    .withMessage("Coupon code is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Coupon code must be between 2 and 50 characters")
    .matches(/^[A-Z0-9_-]+$/)
    .withMessage(
      "Coupon code can only contain uppercase letters, numbers, underscores, and hyphens"
    ),
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Coupon name is required")
    .isLength({ max: 100 })
    .withMessage("Coupon name cannot exceed 100 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),
  body("discountType")
    .isIn(["percentage", "fixed_amount"])
    .withMessage("Discount type must be either 'percentage' or 'fixed_amount'"),
  body("discountValue")
    .isFloat({ min: 0 })
    .withMessage("Discount value must be a positive number")
    .custom((value, { req }) => {
      if (req.body.discountType === "percentage") {
        if (value < 0 || value > 100) {
          throw new Error("Percentage discount must be between 0 and 100");
        }
      } else if (req.body.discountType === "fixed_amount") {
        if (value <= 0) {
          throw new Error("Fixed amount discount must be greater than 0");
        }
      }
      return true;
    }),
  body("currency")
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage("Currency must be a 3-letter code (e.g., USD)")
    .custom((value, { req }) => {
      if (req.body.discountType === "fixed_amount" && !value) {
        throw new Error("Currency is required for fixed amount discounts");
      }
      return true;
    }),
  body("duration")
    .isIn(["once", "repeating", "forever"])
    .withMessage("Duration must be 'once', 'repeating', or 'forever'"),
  body("durationInMonths")
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage("Duration in months must be between 1 and 12")
    .custom((value, { req }) => {
      if (req.body.duration === "repeating" && !value) {
        throw new Error("Duration in months is required for repeating coupons");
      }
      return true;
    }),
  body("maxRedemptions")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Max redemptions must be at least 1"),
  body("redeemBy")
    .optional()
    .isISO8601()
    .withMessage("Redeem by must be a valid date")
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error("Redeem by date must be in the future");
      }
      return true;
    }),
  body("appliesTo")
    .optional()
    .isObject()
    .withMessage("Applies to must be an object"),
  body("appliesTo.products")
    .optional()
    .isArray()
    .withMessage("Products must be an array"),
  body("appliesTo.plans")
    .optional()
    .isArray()
    .withMessage("Plans must be an array"),
  body("metadata")
    .optional()
    .isObject()
    .withMessage("Metadata must be an object"),
];

export const updateCouponValidation = [
  param("id").isMongoId().withMessage("Invalid coupon ID"),
  body("name")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Coupon name cannot exceed 100 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),
  body("valid").optional().isBoolean().withMessage("Valid must be a boolean"),
  body("appliesTo")
    .optional()
    .isObject()
    .withMessage("Applies to must be an object"),
  body("metadata")
    .optional()
    .isObject()
    .withMessage("Metadata must be an object"),
];

export const couponIdValidation = [
  param("id").isMongoId().withMessage("Invalid coupon ID"),
];

export const getCouponsValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("valid").optional().isBoolean().withMessage("Valid must be a boolean"),
  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search query cannot exceed 100 characters"),
];
