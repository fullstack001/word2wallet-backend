import express from "express";
import { authenticate } from "../middleware/auth";
import { WriteBookController } from "../controllers/writeBookController";
import { writeBookValidation } from "../validation/writeBookValidation";

const router = express.Router();

/**
 * @route   POST /api/write-book/generate
 * @desc    Generate a book (EPUB/PDF) from chapters
 * @access  Private (authenticated users)
 */
router.post(
  "/generate",
  authenticate,
  writeBookValidation,
  WriteBookController.generateBook
);

/**
 * @route   GET /api/write-book/download/:filename
 * @desc    Download a generated book file
 * @access  Private (authenticated users)
 */
router.get(
  "/download/:filename",
  authenticate,
  WriteBookController.downloadBook
);

/**
 * @route   GET /api/write-book/my-books
 * @desc    Get all written books for authenticated user
 * @access  Private (authenticated users)
 */
router.get("/my-books", authenticate, WriteBookController.getMyBooks);

/**
 * @route   GET /api/write-book/my-books/:id
 * @desc    Get a specific written book by ID
 * @access  Private (authenticated users)
 */
router.get("/my-books/:id", authenticate, WriteBookController.getBookById);

/**
 * @route   PUT /api/write-book/my-books/:id
 * @desc    Update a written book
 * @access  Private (authenticated users)
 */
router.put("/my-books/:id", authenticate, WriteBookController.updateBook);

/**
 * @route   DELETE /api/write-book/my-books/:id
 * @desc    Delete a written book
 * @access  Private (authenticated users)
 */
router.delete("/my-books/:id", authenticate, WriteBookController.deleteBook);

export default router;
