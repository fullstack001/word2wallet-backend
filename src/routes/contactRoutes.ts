import express from "express";
import { body } from "express-validator";
import { ContactController } from "../controllers/contactController";

const router = express.Router();

/**
 * @route POST /api/contact
 * @desc Send contact form email
 * @access Public
 */
router.post(
  "/",
  [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Name is required")
      .isLength({ min: 2, max: 100 })
      .withMessage("Name must be between 2 and 100 characters"),
    body("email")
      .trim()
      .isEmail()
      .withMessage("Valid email is required")
      .normalizeEmail(),
    body("message")
      .trim()
      .notEmpty()
      .withMessage("Message is required")
      .isLength({ min: 10, max: 5000 })
      .withMessage("Message must be between 10 and 5000 characters"),
  ],
  ContactController.sendContactEmail
);

export default router;

