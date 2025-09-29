import { Request, Response } from "express";
import { validationResult } from "express-validator";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import {
  IBook,
  BookStatus,
  BookQuery,
  ApiResponse,
  AuthRequest,
} from "../types";
import { Book } from "../models/Book";
import { JobService } from "../services/jobService";
import { JobType } from "../types";
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
   * Upload EPUB file and create book record
   */
  static async uploadBook(req: AuthRequest, res: Response): Promise<void> {
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

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "No file uploaded",
        } as ApiResponse);
        return;
      }

      const userId = req.user!._id;
      const {
        title,
        author,
        description,
        isbn,
        publisher,
        language,
        genre,
        tags,
      } = req.body;

      // Generate file key for S3
      const fileKey = EpubService.generateFileKey(
        userId,
        req.file.originalname
      );

      // Calculate SHA-256 checksum of the uploaded file
      const fileBuffer = fs.readFileSync(req.file.path);
      const checksum = crypto
        .createHash("sha256")
        .update(fileBuffer)
        .digest("hex");

      // Create book record
      const book = new Book({
        userId,
        title,
        author,
        description,
        isbn,
        publisher,
        language: language || "en",
        genre: genre ? genre.split(",").map((g: string) => g.trim()) : [],
        tags: tags ? tags.split(",").map((t: string) => t.trim()) : [],
        fileKey,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        checksum,
        metadata: {
          title,
          creator: author,
          language: language || "en",
        },
        status: BookStatus.UPLOADING,
      });

      await book.save();

      // Upload file to storage
      const storageService = getStorageService();
      await storageService.uploadFile(
        fileKey,
        fileBuffer,
        EpubService.getEpubMimeType(),
        {
          userId: userId.toString(),
          bookId: book._id.toString(),
          originalName: req.file.originalname,
        }
      );

      // Clean up temp file
      await EpubService.cleanupTempFile(req.file.path);

      // Start validation job
      await JobService.addJob(JobType.EPUB_VALIDATION, {
        jobId: book._id,
        bookId: book._id,
        userId,
        filePath: req.file.path,
      });

      res.status(201).json({
        success: true,
        message: "Book uploaded successfully",
        data: book as any,
      } as ApiResponse<IBook>);
    } catch (error) {
      console.error("Upload book error:", error);

      // Clean up temp file if it exists
      if (req.file?.path) {
        await EpubService.cleanupTempFile(req.file.path);
      }

      res.status(500).json({
        success: false,
        message: "Failed to upload book",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get user's books
   */
  static async getUserBooks(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;
      const {
        page = 1,
        limit = 10,
        search,
        status,
        genre,
        language,
        author,
        sort = "uploadDate",
        order = "desc",
      } = req.query as BookQuery;

      const query: any = { userId };

      // Apply filters
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: "i" } },
          { author: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ];
      }

      if (status) {
        query.status = status;
      }

      if (genre) {
        query.genre = { $in: [genre] };
      }

      if (language) {
        query.language = language;
      }

      if (author) {
        query.author = { $regex: author, $options: "i" };
      }

      // Calculate pagination
      const skip = (Number(page) - 1) * Number(limit);
      const sortOrder = order === "desc" ? -1 : 1;

      const [books, total] = await Promise.all([
        Book.find(query)
          .sort({ [sort]: sortOrder })
          .skip(skip)
          .limit(Number(limit)),
        Book.countDocuments(query),
      ]);

      res.json({
        success: true,
        message: "Books retrieved successfully",
        data: books as any,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      } as ApiResponse<IBook[]>);
    } catch (error) {
      console.error("Get user books error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve books",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get book by ID
   */
  static async getBook(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!._id;

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
   * Update book metadata
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

      const { id } = req.params;
      const userId = req.user!._id;
      const updates = req.body;

      const book = await Book.findOne({ _id: id, userId });
      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        } as ApiResponse);
        return;
      }

      // Update allowed fields
      const allowedUpdates = [
        "title",
        "author",
        "description",
        "isbn",
        "publisher",
        "publicationDate",
        "language",
        "genre",
        "tags",
      ];

      allowedUpdates.forEach((field) => {
        if (updates[field] !== undefined) {
          (book as any)[field] = updates[field];
        }
      });

      // Update metadata
      if (updates.title) book.metadata.title = updates.title;
      if (updates.author) book.metadata.creator = updates.author;
      if (updates.description) book.metadata.description = updates.description;
      if (updates.publisher) book.metadata.publisher = updates.publisher;
      if (updates.language) book.metadata.language = updates.language;

      await book.save();

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
   * Delete book
   */
  static async deleteBook(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!._id;

      const book = await Book.findOne({ _id: id, userId });
      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        } as ApiResponse);
        return;
      }

      // Delete file from storage
      const storageService = getStorageService();
      await storageService.deleteFile(book.fileKey);

      // Mark book as deleted
      book.status = BookStatus.DELETED;
      await book.save();

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
      const { id } = req.params;
      const userId = req.user!._id;

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
        book.fileKey,
        3600
      ); // 1 hour

      res.json({
        success: true,
        message: "Download URL generated successfully",
        data: {
          downloadUrl,
          expiresIn: 3600,
          fileName: book.fileName,
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Get download URL error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate download URL",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get book processing status
   */
  static async getBookStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!._id;

      const book = await Book.findOne({ _id: id, userId });
      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        } as ApiResponse);
        return;
      }

      // Get related jobs
      const jobs = await JobService.getBookJobs(id);

      res.json({
        success: true,
        message: "Book status retrieved successfully",
        data: {
          book,
          jobs,
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Get book status error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve book status",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }
}

// Export multer middleware
export { upload };
