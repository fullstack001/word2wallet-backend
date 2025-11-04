import { body } from "express-validator";

// Register validation rules
export const registerValidation = [
  body("email").isEmail().withMessage("Please provide a valid email"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  body("firstName")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("First name is required and must be less than 50 characters"),
  body("lastName")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Last name is required and must be less than 50 characters"),
  body("role")
    .optional()
    .isIn(["admin", "user"])
    .withMessage("Role must be either admin or user"),
];

// Login validation rules
export const loginValidation = [
  body("email").isEmail().withMessage("Please provide a valid email"),
  body("password").notEmpty().withMessage("Password is required"),
];

// Refresh token validation rules
export const refreshTokenValidation = [
  body("refreshToken").notEmpty().withMessage("Refresh token is required"),
];

// Update profile validation rules
export const updateProfileValidation = [
  body("firstName")
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("First name must be less than 50 characters"),
  body("lastName")
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Last name must be less than 50 characters"),
];

// Change password validation rules
export const changePasswordValidation = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),
  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters long"),
];

// Verify email validation rules
export const verifyEmailValidation = [
  body("token").notEmpty().withMessage("Verification token is required"),
];

// Resend verification email validation rules
export const resendVerificationValidation = [
  body("email").isEmail().withMessage("Please provide a valid email"),
];

// Verify code validation rules
export const verifyCodeValidation = [
  body("email").isEmail().withMessage("Please provide a valid email"),
  body("code")
    .isLength({ min: 6, max: 6 })
    .withMessage("Verification code must be 6 digits")
    .matches(/^\d+$/)
    .withMessage("Verification code must contain only numbers"),
];

// Forgot password validation rules
export const forgotPasswordValidation = [
  body("email").isEmail().withMessage("Please provide a valid email"),
];

// Reset password validation rules
export const resetPasswordValidation = [
  body("token").notEmpty().withMessage("Reset token is required"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
];
