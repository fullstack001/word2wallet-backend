import express from "express";
import { NewsletterController } from "../controllers/newsletterController";
import { authenticate } from "../middleware/auth";
import { body } from "express-validator";

const router = express.Router();

/**
 * @route   POST /api/newsletters/send-new-book
 * @desc    Send new book notification to all author's readers
 * @access  Private
 */
router.post(
  "/send-new-book",
  authenticate,
  [
    body("bookId")
      .notEmpty()
      .isMongoId()
      .withMessage("Valid book ID is required"),
  ],
  NewsletterController.sendNewBookNotification
);

/**
 * @route   POST /api/newsletters/send-new-book-targeted
 * @desc    Send new book notification to readers of specific books
 * @access  Private
 */
router.post(
  "/send-new-book-targeted",
  authenticate,
  [
    body("bookId")
      .notEmpty()
      .isMongoId()
      .withMessage("Valid book ID is required"),
    body("targetBookIds")
      .isArray()
      .withMessage("Target book IDs must be an array"),
  ],
  NewsletterController.sendNewBookNotificationToBookReaders
);

/**
 * @route   GET /api/newsletters/stats
 * @desc    Get newsletter statistics
 * @access  Private
 */
router.get("/stats", authenticate, NewsletterController.getNewsletterStats);

export default router;
