import { body, param } from "express-validator";

export const createTransactionValidation = [
  body("slug")
    .trim()
    .notEmpty()
    .withMessage("Slug is required")
    .isLength({ max: 100 })
    .withMessage("Slug cannot exceed 100 characters"),

  body("customerEmail")
    .trim()
    .notEmpty()
    .withMessage("Customer email is required")
    .isEmail()
    .withMessage("Invalid email address")
    .normalizeEmail(),

  body("customerName")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Customer name cannot exceed 200 characters"),

  body("transactionId")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Transaction ID cannot exceed 200 characters"),

  body("paymentProvider")
    .optional()
    .trim()
    .isIn(["paypal", "stripe", "manual"])
    .withMessage("Invalid payment provider"),
];

export const verifyAccessTokenValidation = [
  param("token")
    .trim()
    .notEmpty()
    .withMessage("Access token is required")
    .isLength({ min: 64, max: 64 })
    .withMessage("Invalid access token format"),
];
