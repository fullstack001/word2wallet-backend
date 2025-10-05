import { Request, Response } from "express";
import { validationResult } from "express-validator";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import {
  IBook,
  BookStatus,
  BookFileType,
  BookType,
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

// Upload middleware for book/audio files
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [".epub", ".pdf", ".mp3", ".m4a", ".wav", ".aac"];
    const fileExt = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error("Only EPUB, PDF, and audio files are allowed"));
    }
  },
});

// Upload middleware for cover images
const uploadCover = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for images
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [".jpg", ".jpeg", ".png", ".webp"];
    const fileExt = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, JPEG, PNG, and WebP images are allowed"));
    }
  },
});

export class BookController {
  // Export upload middlewares for use in routes
  static upload = upload;
  static uploadCover = uploadCover;
  /**
   * Create a new book draft (without file upload)
   */
  static async createDraft(req: AuthRequest, res: Response): Promise<void> {
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

      const userId = req.user!._id;
      const {
        title,
        author,
        description,
        isbn,
        language,
        category,
        // New book information fields
        label,
        series,
        volume,
        tagline,
        notesToReaders,
        bookType,
        narrator,
        audioQuality,
      } = req.body;

      // Create draft book without file
      const book = new Book({
        title,
        author,
        description,
        isbn,
        language: language || "en",
        genre: category ? [category] : [],

        // New book information fields
        label,
        series,
        volume,
        tagline,
        notesToReaders,
        bookType,
        narrator,
        audioQuality,

        userId,
        status: BookStatus.DRAFT,
        metadata: {
          title,
          creator: author,
          format: "Draft",
        },
        // Delivery features
        isPublic: false,
        allowEmailCapture: true,
        deliverySettings: {
          requireEmail: false,
          allowAnonymous: true,
        },
      });

      await book.save();

      res.status(201).json({
        success: true,
        message: "Book draft created successfully",
        data: book as any,
      } as ApiResponse<IBook>);
    } catch (error) {
      console.error("Create draft error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create book draft",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Upload and create a new book
   */
  static async uploadBook(req: AuthRequest, res: Response): Promise<void> {
    let detectedFileType: BookFileType | undefined;

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
      const {
        title,
        author,
        description,
        isbn,
        language,
        category,
        fileType,
        // New book information fields
        label,
        series,
        volume,
        tagline,
        notesToReaders,
        bookType,
        narrator,
        audioQuality,
      } = req.body;

      // Determine file type from extension
      const fileExt = path.extname(req.file.originalname).toLowerCase();

      if (fileExt === ".epub") {
        detectedFileType = BookFileType.EPUB;
      } else if (fileExt === ".pdf") {
        detectedFileType = BookFileType.PDF;
      } else if ([".mp3", ".m4a", ".wav", ".aac"].includes(fileExt)) {
        detectedFileType = BookFileType.AUDIO;
      } else {
        res.status(400).json({
          success: false,
          message:
            "Unsupported file type. Only EPUB, PDF, and audio files are allowed.",
        } as ApiResponse);
        return;
      }

      let fileValidationResult: any;
      let processingResult: any;

      // Validate and process based on file type
      if (detectedFileType === BookFileType.EPUB) {
        console.log("Validating EPUB file...");
        fileValidationResult = await EpubService.validateEpub(req.file.path);

        if (!fileValidationResult.isValid) {
          await EpubService.cleanupTempFile(req.file.path);
          res.status(400).json({
            success: false,
            message: "Invalid EPUB file",
            error: fileValidationResult.errors.join(", "),
          } as ApiResponse);
          return;
        }

        console.log("EPUB validation successful, processing...");
        processingResult = await EpubService.processEpub(
          req.file.path,
          fileValidationResult.metadata as any
        );
      } else if (detectedFileType === BookFileType.PDF) {
        // For PDF files, we'll do basic validation
        fileValidationResult = {
          isValid: true,
          fileSize: req.file.size,
          checksum: await BookController.calculateChecksum(req.file.path),
          metadata: {
            title: title,
            creator: author,
            format: "PDF",
          },
        };

        processingResult = {
          // Don't set pageCount for PDF files - let it be undefined
          // pageCount: 0, // This causes validation error
          wordCount: 0,
          readingTime: 0,
          coverImageUrl: null,
        };
      } else if (detectedFileType === BookFileType.AUDIO) {
        // For audio files, we'll do basic validation
        fileValidationResult = {
          isValid: true,
          fileSize: req.file.size,
          checksum: await BookController.calculateChecksum(req.file.path),
          metadata: {
            title: title,
            creator: author,
            format: "Audio",
          },
        };

        processingResult = {
          // Don't set pageCount for audio files - let it be undefined
          // pageCount: 0, // This causes validation error
          wordCount: 0,
          readingTime: 0, // Audio duration would need special processing
          coverImageUrl: null,
        };
      }

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

      // Create file data object
      const fileData = {
        fileKey,
        fileName: req.file.originalname,
        fileSize: fileValidationResult.fileSize,
        checksum: fileValidationResult.checksum,
        uploadedAt: new Date(),
      };

      // Create book record
      const bookData: any = {
        title,
        author,
        description,
        isbn,
        language: language || "en",
        genre: category ? [category] : [],

        // New book information fields
        label,
        series,
        volume,
        tagline,
        notesToReaders,
        bookType,
        narrator,
        audioQuality,

        userId,
        status: BookStatus.READY,
        metadata: {
          ...fileValidationResult.metadata!,
          creator: fileValidationResult.metadata!.creator,
        },
        ...(processingResult.pageCount && {
          pageCount: processingResult.pageCount,
        }),
        wordCount: processingResult.wordCount,
        readingTime: processingResult.readingTime,
        coverImageUrl: processingResult.coverImageUrl,
        // Delivery features
        isPublic: false,
        allowEmailCapture: true,
        deliverySettings: {
          requireEmail: false,
          allowAnonymous: true,
        },
      };

      // Set the appropriate file field based on type
      if (detectedFileType === BookFileType.EPUB) {
        bookData.epubFile = fileData;
      } else if (detectedFileType === BookFileType.PDF) {
        bookData.pdfFile = fileData;
      } else if (detectedFileType === BookFileType.AUDIO) {
        bookData.audioFile = fileData;
      }

      // Set legacy fields for backward compatibility
      bookData.fileName = req.file.originalname;
      bookData.fileKey = fileKey;
      bookData.fileType = detectedFileType;
      bookData.fileSize = fileValidationResult.fileSize;
      bookData.checksum = fileValidationResult.checksum;

      const book = new Book(bookData);

      await book.save();

      // Clean up temp file
      if (detectedFileType === BookFileType.EPUB) {
        await EpubService.cleanupTempFile(req.file.path);
      } else {
        // For non-EPUB files, just delete the temp file
        try {
          fs.unlinkSync(req.file.path);
        } catch (error) {
          console.error("Failed to delete temp file:", error);
        }
      }

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
          if (detectedFileType === BookFileType.EPUB) {
            await EpubService.cleanupTempFile(req.file.path);
          } else if (detectedFileType) {
            fs.unlinkSync(req.file.path);
          }
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
   * Get a single book by ID
   */
  static async getBookById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;
      const { id } = req.params;

      const book = await Book.findOne({
        _id: id,
        userId,
      }).select("-__v");

      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        } as ApiResponse);
        return;
      }

      res.status(200).json({
        success: true,
        message: "Book retrieved successfully",
        data: book.toObject() as unknown as IBook,
      } as ApiResponse<IBook>);
    } catch (error) {
      console.error("Get book by ID error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve book",
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
        if (book.fileKey) {
          await storageService.deleteFile(book.fileKey);
        }
        // Also delete epub, PDF, and audio files
        if (book.epubFile?.fileKey) {
          await storageService.deleteFile(book.epubFile.fileKey);
        }
        if (book.pdfFile?.fileKey) {
          await storageService.deleteFile(book.pdfFile.fileKey);
        }
        if (book.audioFile?.fileKey) {
          await storageService.deleteFile(book.audioFile.fileKey);
        }
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

      // Use epub file first, then PDF file, then audio file, then legacy fileKey (backward compatibility)
      const fileKey =
        book.epubFile?.fileKey ||
        book.pdfFile?.fileKey ||
        book.audioFile?.fileKey ||
        book.fileKey;

      if (!fileKey) {
        res.status(400).json({
          success: false,
          message: "No file available for download",
        } as ApiResponse);
        return;
      }

      const downloadUrl = await storageService.generatePresignedDownloadUrl(
        fileKey
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

  /**
   * Upload cover image for draft book
   */
  static async uploadCoverImage(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "No cover image uploaded",
        } as ApiResponse);
        return;
      }

      const userId = req.user!._id;
      const { bookId } = req.params;

      // Find the book (allow both DRAFT and READY status)
      const book = await Book.findOne({
        _id: bookId,
        userId,
        status: { $in: [BookStatus.DRAFT, BookStatus.READY] },
      });
      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        } as ApiResponse);
        return;
      }

      // Validate image file type
      const fileExt = path.extname(req.file.originalname).toLowerCase();
      if (![".jpg", ".jpeg", ".png", ".webp"].includes(fileExt)) {
        res.status(400).json({
          success: false,
          message:
            "Invalid image format. Only JPG, JPEG, PNG, and WebP are allowed.",
        } as ApiResponse);
        return;
      }

      // Delete old cover image from storage if it exists
      if (book.coverImageKey) {
        try {
          const storageService = getStorageService();
          await storageService.deleteFile(book.coverImageKey);
        } catch (error) {
          console.error("Failed to delete old cover image:", error);
        }
      }

      // Upload new cover image to storage
      const fileBuffer = fs.readFileSync(req.file.path);
      const storageService = getStorageService();
      const uploadResult = await storageService.uploadFile(
        `covers/${userId}/${Date.now()}-${req.file.originalname}`,
        fileBuffer,
        req.file.mimetype
      );
      const coverImageKey = uploadResult.key;

      // Update book with cover image information
      book.coverImageKey = coverImageKey;
      book.coverImageName = req.file.originalname;
      book.coverImageSize = req.file.size;

      await book.save();

      // Clean up temp file
      try {
        fs.unlinkSync(req.file.path);
      } catch (error) {
        console.error("Failed to delete temp file:", error);
      }

      res.status(200).json({
        success: true,
        message: "Cover image uploaded successfully",
        data: { coverImageKey, coverImageName: req.file.originalname },
      } as ApiResponse);
    } catch (error) {
      console.error("Cover upload error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to upload cover image",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Update draft book with file upload
   */
  static async updateDraftWithFile(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
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
      const { bookId } = req.params;

      // Find the book (allow both DRAFT and READY status)
      const book = await Book.findOne({
        _id: bookId,
        userId,
        status: { $in: [BookStatus.DRAFT, BookStatus.READY] },
      });
      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        } as ApiResponse);
        return;
      }

      // Determine file type from extension
      const fileExt = path.extname(req.file.originalname).toLowerCase();
      let detectedFileType: BookFileType;

      if (fileExt === ".epub") {
        detectedFileType = BookFileType.EPUB;
      } else if (fileExt === ".pdf") {
        detectedFileType = BookFileType.PDF;
      } else if ([".mp3", ".m4a", ".wav", ".aac"].includes(fileExt)) {
        detectedFileType = BookFileType.AUDIO;
      } else {
        res.status(400).json({
          success: false,
          message: "Unsupported file type",
        } as ApiResponse);
        return;
      }

      // Upload file to storage
      const fileBuffer = fs.readFileSync(req.file.path);
      const storageService = getStorageService();
      const uploadResult = await storageService.uploadFile(
        `books/${userId}/${Date.now()}-${req.file.originalname}`,
        fileBuffer,
        req.file.mimetype
      );
      const fileKey = uploadResult.key;

      // Calculate checksum
      const checksum = await BookController.calculateChecksum(req.file.path);

      // Create file object with all required fields
      const fileData = {
        fileKey,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        checksum,
        uploadedAt: new Date(),
      };

      // Handle file replacement based on type
      if (detectedFileType === BookFileType.EPUB) {
        // Delete old epub file from storage if it exists
        if (book.epubFile?.fileKey) {
          try {
            const storageService = getStorageService();
            await storageService.deleteFile(book.epubFile.fileKey);
          } catch (error) {
            console.error("Failed to delete old epub file:", error);
          }
        }

        book.epubFile = fileData;

        // Update legacy fields for backward compatibility
        book.fileName = req.file.originalname;
        book.fileKey = fileKey;
        book.fileType = detectedFileType;
        book.fileSize = req.file.size;
        book.checksum = checksum;
      } else if (detectedFileType === BookFileType.PDF) {
        // Delete old PDF file from storage if it exists
        if (book.pdfFile?.fileKey) {
          try {
            const storageService = getStorageService();
            await storageService.deleteFile(book.pdfFile.fileKey);
          } catch (error) {
            console.error("Failed to delete old PDF file:", error);
          }
        }

        book.pdfFile = fileData;

        // Update legacy fields for backward compatibility (if no epub exists)
        if (!book.epubFile) {
          book.fileName = req.file.originalname;
          book.fileKey = fileKey;
          book.fileType = detectedFileType;
          book.fileSize = req.file.size;
          book.checksum = checksum;
        }
      } else if (detectedFileType === BookFileType.AUDIO) {
        // Delete old audio file from storage if it exists
        if (book.audioFile?.fileKey) {
          try {
            const storageService = getStorageService();
            await storageService.deleteFile(book.audioFile.fileKey);
          } catch (error) {
            console.error("Failed to delete old audio file:", error);
          }
        }

        book.audioFile = fileData;

        // Update legacy fields for backward compatibility (if no epub or PDF exists)
        if (!book.epubFile && !book.pdfFile) {
          book.fileName = req.file.originalname;
          book.fileKey = fileKey;
          book.fileType = detectedFileType;
          book.fileSize = req.file.size;
          book.checksum = checksum;
        }
      }

      // Keep as draft until all files are uploaded
      // Status will be changed to READY when user completes the upload process

      await book.save();

      // Clean up temp file
      try {
        fs.unlinkSync(req.file.path);
      } catch (error) {
        console.error("Failed to delete temp file:", error);
      }

      res.status(200).json({
        success: true,
        message: "Book updated with file successfully",
        data: book.toObject() as unknown as IBook,
      } as ApiResponse<IBook>);
    } catch (error) {
      console.error("Update draft with file error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update draft with file",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Upload audio file for a book
   */
  static async uploadAudioFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { bookId } = req.params;
      const userId = req.user!._id;

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "No audio file uploaded",
        } as ApiResponse);
        return;
      }

      // Validate file type
      const fileExt = path.extname(req.file.originalname).toLowerCase();
      const allowedAudioTypes = [
        ".mp3",
        ".wav",
        ".ogg",
        ".m4a",
        ".aac",
        ".webm",
      ];

      if (!allowedAudioTypes.includes(fileExt)) {
        res.status(400).json({
          success: false,
          message:
            "Invalid audio file type. Only MP3, WAV, OGG, M4A, AAC, and WebM files are allowed.",
        } as ApiResponse);
        return;
      }

      // Find the book and verify ownership
      const book = await Book.findOne({ _id: bookId, userId });
      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found or access denied",
        } as ApiResponse);
        return;
      }

      // Upload to storage service
      const fileBuffer = fs.readFileSync(req.file.path);
      const storageService = getStorageService();
      const uploadResult = await storageService.uploadFile(
        `audio/${userId}/${Date.now()}-${req.file.originalname}`,
        fileBuffer,
        req.file.mimetype,
        {
          userId: userId.toString(),
          originalName: req.file.originalname,
          bookId: bookId,
        }
      );

      // Delete old audio file from storage if it exists
      if (book.audioFile?.fileKey) {
        try {
          const storageService = getStorageService();
          await storageService.deleteFile(book.audioFile.fileKey);
        } catch (error) {
          console.error("Failed to delete old audio file:", error);
        }
      }

      // Update book with audio file information
      const audioFileData = {
        fileKey: uploadResult.key,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        checksum: await BookController.calculateChecksum(req.file.path),
        uploadedAt: new Date(),
      };

      book.audioFile = audioFileData;
      book.ebookType = "audio"; // Set ebook type to audio
      book.fileType = BookFileType.AUDIO;

      await book.save();

      // Clean up temporary file
      fs.unlinkSync(req.file.path);

      res.status(200).json({
        success: true,
        message: "Audio file uploaded successfully",
        data: {
          audioFile: audioFileData,
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Error uploading audio file:", error);

      // Clean up temporary file if it exists
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        success: false,
        message: "Failed to upload audio file",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Complete book upload (change status from DRAFT to READY)
   */
  static async completeBookUpload(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!._id;
      const { bookId } = req.params;

      // Find the book (allow both DRAFT and READY status)
      const book = await Book.findOne({
        _id: bookId,
        userId,
        status: { $in: [BookStatus.DRAFT, BookStatus.READY] },
      });

      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        } as ApiResponse);
        return;
      }

      // Check if at least one file has been uploaded
      if (!book.epubFile && !book.pdfFile && !book.audioFile) {
        res.status(400).json({
          success: false,
          message:
            "No files uploaded. Please upload at least one EPUB, PDF, or audio file.",
        } as ApiResponse);
        return;
      }

      // Change status to READY (if not already)
      if (book.status !== BookStatus.READY) {
        book.status = BookStatus.READY;
        await book.save();
      }

      res.status(200).json({
        success: true,
        message: "Book upload completed successfully",
        data: book as any,
      } as ApiResponse<IBook>);
    } catch (error) {
      console.error("Complete upload error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to complete book upload",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get book cover image
   */
  static async getBookCover(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const book = await Book.findOne({
        _id: id,
      });

      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        } as ApiResponse);
        return;
      }

      if (!book.coverImageKey) {
        res.status(404).json({
          success: false,
          message: "Cover image not found",
        } as ApiResponse);
        return;
      }

      const storageService = getStorageService();

      // Get file metadata to determine content type
      const metadata = await storageService.getFileMetadata(book.coverImageKey);
      const contentType = metadata.contentType || "image/jpeg";

      // Download the file buffer
      const fileBuffer = await storageService.downloadFile(book.coverImageKey);

      // Set appropriate headers
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Length", fileBuffer.length);
      res.setHeader("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      // Send the file buffer
      res.send(fileBuffer);
    } catch (error) {
      console.error("Get book cover error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get book cover",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Calculate SHA-256 checksum for a file
   */
  private static async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash("sha256");
      const stream = fs.createReadStream(filePath);

      stream.on("data", (data) => hash.update(data));
      stream.on("end", () => resolve(hash.digest("hex")));
      stream.on("error", reject);
    });
  }
}
