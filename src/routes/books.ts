import { Router } from "express";
import { BookController } from "../controllers/bookController";
import { auth } from "../middleware/auth";
import {
  uploadBookValidation,
  updateBookValidation,
  getBookValidation,
  deleteBookValidation,
  getBooksValidation,
  getBookDownloadUrlValidation,
} from "../validation/bookValidation";

const router = Router();

// Public routes (no authentication required)
// Get book cover image
router.get("/:id/cover", BookController.getBookCover);

// Get book by ID (public)
router.get("/public/:id", BookController.getPublicBook);

// Stream book file (public)
router.get("/public/:id/file/:fileType", BookController.streamPublicBookFile);

// All other routes require authentication
router.use(auth);

// Get all books for authenticated user
router.get("/", getBooksValidation, BookController.getBooks);

// Get single book by ID
router.get("/:id", getBookValidation, BookController.getBookById);

// Update book metadata
router.put("/:id", updateBookValidation, BookController.updateBook);

// Delete book
router.delete("/:id", deleteBookValidation, BookController.deleteBook);

// Get book download URL
router.get(
  "/:id/download",
  getBookDownloadUrlValidation,
  BookController.getBookDownloadUrl
);

// Create book draft (without file upload)
router.post("/draft", uploadBookValidation, BookController.createDraft);

// Upload cover image for draft book
router.post(
  "/:bookId/upload-cover",
  BookController.uploadCover.single("coverImage"),
  BookController.uploadCoverImage
);

// Update draft book with file upload
router.post(
  "/:bookId/upload",
  BookController.upload.single("epubFile"),
  BookController.updateDraftWithFile
);

// Upload audio file for a book
router.post(
  "/:bookId/upload-audio",
  BookController.upload.single("audioFile"),
  BookController.uploadAudioFile
);

// Complete book upload (change status from DRAFT to READY)
router.post("/:bookId/complete", BookController.completeBookUpload);

// Book upload (with file upload) - legacy endpoint
router.post(
  "/upload",
  BookController.upload.single("epubFile"),
  uploadBookValidation,
  BookController.uploadBook
);

export default router;
