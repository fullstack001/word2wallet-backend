import { Request, Response } from "express";
import { validationResult } from "express-validator";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  IBook,
  BookStatus,
  BookQuery,
  ApiResponse,
  AuthRequest,
} from "../types";
import { Book } from "../models/Book";
import { EpubService } from "../services/epubService";
import { getStorageService } from "../services/storageService";

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads/temp");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    if (EpubService.isValidEpubFile(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error("Only EPUB files are allowed"));
    }
  },
});

export class BookController {
  /**
   * Upload and create a new book
   */
  static async uploadBook(req: AuthRequest, res: Response): Promise<void> {
    try {
      const validationErrors = validationResult(req);
      if (!validationErrors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: "Validation failed",
          error: validationErrors.array()[0].msg,
        } as ApiResponse);
        return;
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "No file uploaded",
        } as ApiResponse);
        return;
      }

      const userId = req.user!._id;
      const { title, author, description, isbn, language, category } = req.body;

      // Validate EPUB file synchronously
      console.log("Validating EPUB file...");
      const epubValidationResult = await EpubService.validateEpub(
        req.file.path
      );

      if (!epubValidationResult.isValid) {
        // Clean up temp file
        await EpubService.cleanupTempFile(req.file.path);

        res.status(400).json({
          success: false,
          message: "Invalid EPUB file",
          error: epubValidationResult.errors.join(", "),
        } as ApiResponse);
        return;
      }

      console.log("EPUB validation successful, processing...");

      // Process EPUB for additional metadata
      const processingResult = await EpubService.processEpub(
        req.file.path,
        epubValidationResult.metadata as any
      );

      // Upload to storage service
      const fileBuffer = fs.readFileSync(req.file.path);
      const storageService = getStorageService();
      const uploadResult = await storageService.uploadFile(
        `books/${userId}/${Date.now()}-${req.file.originalname}`,
        fileBuffer,
        EpubService.getEpubMimeType(),
        {
          userId: userId.toString(),
          originalName: req.file.originalname,
        }
      );
      const fileKey = uploadResult.key;

      // Create book record
      const book = new Book({
        title,
        author,
        description,
        isbn,
        language: language || "en",
        category: category || "general",
        userId,
        fileName: req.file.originalname,
        fileKey,
        fileUrl: fileKey, // Use fileKey as fileUrl for now
        fileSize: epubValidationResult.fileSize,
        checksum: epubValidationResult.checksum,
        status: BookStatus.READY,
        metadata: {
          ...epubValidationResult.metadata!,
          creator: epubValidationResult.metadata!.creator,
        },
        pageCount: processingResult.pageCount,
        wordCount: processingResult.wordCount,
        readingTime: processingResult.readingTime,
        coverImageUrl: processingResult.coverImageUrl,
      });

      await book.save();

      // Clean up temp file
      await EpubService.cleanupTempFile(req.file.path);

      res.status(201).json({
        success: true,
        message: "Book uploaded and validated successfully",
        data: book as any,
      } as ApiResponse<IBook>);
    } catch (error) {
      console.error("Upload book error:", error);

      // Clean up temp file if it exists
      if (req.file?.path) {
        try {
          await EpubService.cleanupTempFile(req.file.path);
        } catch (cleanupError) {
          console.error("Failed to cleanup temp file:", cleanupError);
        }
      }

      res.status(500).json({
        success: false,
        message: "Failed to upload book",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get all books for a user
   */
  static async getBooks(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;
      const {
        page = 1,
        limit = 10,
        search,
        category,
        status,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const query: any = { userId };

      // Apply filters
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: "i" } },
          { author: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ];
      }

      if (category) {
        query.category = category as string;
      }

      if (status) {
        query.status = status as BookStatus;
      }

      // Build sort object
      const sort: any = {};
      sort[sortBy as string] = sortOrder === "desc" ? -1 : 1;

      const books = await Book.find(query)
        .sort(sort)
        .skip(skip)
        .limit(Number(limit));

      const total = await Book.countDocuments(query);

      res.json({
        success: true,
        message: "Books retrieved successfully",
        data: {
          books,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Get books error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve books",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get a single book by ID
   */
  static async getBook(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;
      const { id } = req.params;

      const book = await Book.findOne({ _id: id, userId });

      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        message: "Book retrieved successfully",
        data: book as any,
      } as ApiResponse<IBook>);
    } catch (error) {
      console.error("Get book error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve book",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Update a book
   */
  static async updateBook(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: "Validation failed",
          error: errors.array()[0].msg,
        } as ApiResponse);
        return;
      }

      const userId = req.user!._id;
      const { id } = req.params;
      const updateData = req.body;

      const book = await Book.findOneAndUpdate(
        { _id: id, userId },
        updateData,
        { new: true, runValidators: true }
      );

      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        message: "Book updated successfully",
        data: book as any,
      } as ApiResponse<IBook>);
    } catch (error) {
      console.error("Update book error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update book",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Delete a book
   */
  static async deleteBook(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;
      const { id } = req.params;

      const book = await Book.findOne({ _id: id, userId });

      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        } as ApiResponse);
        return;
      }

      // Delete file from storage
      try {
        const storageService = getStorageService();
        await storageService.deleteFile(book.fileKey);
      } catch (storageError) {
        console.error("Failed to delete file from storage:", storageError);
        // Continue with book deletion even if storage deletion fails
      }

      await Book.findByIdAndDelete(id);

      res.json({
        success: true,
        message: "Book deleted successfully",
      } as ApiResponse);
    } catch (error) {
      console.error("Delete book error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete book",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get book download URL
   */
  static async getBookDownloadUrl(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!._id;
      const { id } = req.params;

      const book = await Book.findOne({ _id: id, userId });

      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        } as ApiResponse);
        return;
      }

      if (book.status !== BookStatus.READY) {
        res.status(400).json({
          success: false,
          message: "Book is not ready for download",
        } as ApiResponse);
        return;
      }

      const storageService = getStorageService();
      const downloadUrl = await storageService.generatePresignedDownloadUrl(
        book.fileKey
      );

      res.json({
        success: true,
        message: "Download URL generated successfully",
        data: {
          downloadUrl,
          expiresIn: 3600, // 1 hour
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Get book download URL error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate download URL",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  // Export multer middleware for use in routes
  static upload = upload;
}
