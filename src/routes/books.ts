import { Router } from "express";
import { BookController, upload } from "../controllers/bookController";
import { auth } from "../middleware/auth";
import {
  uploadBookValidation,
  updateBookValidation,
  getBookValidation,
  deleteBookValidation,
  getBooksValidation,
  getBookStatusValidation,
  getBookDownloadUrlValidation,
} from "../validation/bookValidation";

const router = Router();

// All routes require authentication
router.use(auth);

// Book upload (with file upload)
router.post(
  "/upload",
  upload.single("epubFile"),
  uploadBookValidation,
  BookController.uploadBook
);

// Get user's books
router.get("/", getBooksValidation, BookController.getUserBooks);

// Get book by ID
router.get("/:id", getBookValidation, BookController.getBook);

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

// Get book processing status
router.get(
  "/:id/status",
  getBookStatusValidation,
  BookController.getBookStatus
);

export default router;
