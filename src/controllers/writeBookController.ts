import { Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import path from "path";
import fs from "fs";
import { AuthRequest } from "../types";
import { EpubGenerator } from "../utils/epubGenerator";
import { PdfGenerator } from "../utils/pdfGenerator";
import { WrittenBook } from "../models/WrittenBook";

export class WriteBookController {
  /**
   * Generate book from chapters (EPUB and/or PDF)
   */
  static async generateBook(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { title, description, chapters, format } = req.body;
      const user = req.user!;

      // Parse chapters if it's a JSON string (from FormData)
      let parsedChapters = [];
      if (chapters) {
        if (typeof chapters === "string") {
          try {
            parsedChapters = JSON.parse(chapters);
          } catch (error) {
            return res.status(400).json({
              success: false,
              message: "Invalid chapters format",
            });
          }
        } else {
          parsedChapters = chapters;
        }
      }

      if (!parsedChapters || parsedChapters.length === 0) {
        return res.status(400).json({
          success: false,
          message: "At least one chapter is required",
        });
      }

      // Determine which formats to generate
      const formats = Array.isArray(format) ? format : [format];
      const shouldGenerateEpub = formats.includes("epub");
      const shouldGeneratePdf = formats.includes("pdf");

      if (!shouldGenerateEpub && !shouldGeneratePdf) {
        return res.status(400).json({
          success: false,
          message: "At least one format (epub or pdf) must be selected",
        });
      }

      // Create output directory
      const timestamp = Date.now();
      const outputDir = path.join("uploads", "generated-books");
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const baseFilename = `${title
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase()}_${timestamp}`;
      const generatedFiles: {
        epub?: { path: string; url: string };
        pdf?: { path: string; url: string };
      } = {};

      // Generate EPUB if requested
      if (shouldGenerateEpub) {
        try {
          const epubPath = path.join(outputDir, `${baseFilename}.epub`);
          await EpubGenerator.generateEpub({
            title,
            description,
            author: user.fullName || "Unknown Author",
            chapters: parsedChapters,
            outputPath: epubPath,
          });

          generatedFiles.epub = {
            path: epubPath,
            url: `/uploads/generated-books/${baseFilename}.epub`,
          };
        } catch (error) {
          console.error("Error generating EPUB:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate EPUB file",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      // Generate PDF if requested
      if (shouldGeneratePdf) {
        try {
          const pdfPath = path.join(outputDir, `${baseFilename}.pdf`);
          await PdfGenerator.generatePdf({
            title,
            description,
            author: user.fullName || "Unknown Author",
            chapters: parsedChapters,
            outputPath: pdfPath,
          });

          generatedFiles.pdf = {
            path: pdfPath,
            url: `/uploads/generated-books/${baseFilename}.pdf`,
          };
        } catch (error) {
          console.error("Error generating PDF:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate PDF file",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      // Save book to database
      const writtenBook = await WrittenBook.create({
        userId: user._id,
        title,
        description,
        author: user.fullName || "Unknown Author",
        chapters: parsedChapters,
        files: generatedFiles,
        format: formats,
        status: "published",
      });

      return res.status(200).json({
        success: true,
        message: "Book generated successfully",
        data: {
          id: writtenBook._id,
          title,
          description,
          author: user.fullName,
          chapters: parsedChapters,
          files: generatedFiles,
          createdAt: writtenBook.createdAt,
        },
      });
    } catch (error) {
      console.error("Error in generateBook:", error);
      return next(error);
    }
  }

  /**
   * Download generated book file
   */
  static async downloadBook(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { filename } = req.params;

      // Security: ensure filename doesn't contain path traversal
      if (
        filename.includes("..") ||
        filename.includes("/") ||
        filename.includes("\\")
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid filename",
        });
      }

      const filePath = path.join("uploads", "generated-books", filename);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: "File not found",
        });
      }

      // Set appropriate headers
      const ext = path.extname(filename).toLowerCase();
      const mimeTypes: { [key: string]: string } = {
        ".epub": "application/epub+zip",
        ".pdf": "application/pdf",
      };

      const mimeType = mimeTypes[ext] || "application/octet-stream";
      res.setHeader("Content-Type", mimeType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );

      // Stream the file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error in downloadBook:", error);
      return next(error);
    }
  }

  /**
   * Get all written books for the authenticated user
   */
  static async getMyBooks(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const { page = 1, limit = 10, search = "" } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build query
      const query: any = { userId: user._id };
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
          { author: { $regex: search, $options: "i" } },
        ];
      }

      // Get books with pagination
      const [books, total] = await Promise.all([
        WrittenBook.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        WrittenBook.countDocuments(query),
      ]);

      return res.status(200).json({
        success: true,
        message: "Books retrieved successfully",
        data: {
          books,
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      console.error("Error in getMyBooks:", error);
      return next(error);
    }
  }

  /**
   * Get a specific written book by ID
   */
  static async getBookById(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params;
      const user = req.user!;

      const book = await WrittenBook.findOne({
        _id: id,
        userId: user._id,
      }).lean();

      if (!book) {
        return res.status(404).json({
          success: false,
          message: "Book not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Book retrieved successfully",
        data: book,
      });
    } catch (error) {
      console.error("Error in getBookById:", error);
      return next(error);
    }
  }

  /**
   * Update a written book
   */
  static async updateBook(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const user = req.user!;
      const { title, description, chapters, format } = req.body;

      // Find the book
      const book = await WrittenBook.findOne({
        _id: id,
        userId: user._id,
      });

      if (!book) {
        return res.status(404).json({
          success: false,
          message: "Book not found",
        });
      }

      // Validate chapters if provided
      if (chapters) {
        const parsedChapters =
          typeof chapters === "string" ? JSON.parse(chapters) : chapters;
        if (!Array.isArray(parsedChapters) || parsedChapters.length === 0) {
          return res.status(400).json({
            success: false,
            message: "At least one chapter is required",
          });
        }
        book.chapters = parsedChapters;
      }

      // Update fields
      if (title) book.title = title;
      if (description !== undefined) book.description = description;
      if (format) book.format = Array.isArray(format) ? format : [format];

      // If chapters or title changed, regenerate files
      const shouldRegenerate = chapters || (title && title !== book.title);
      if (shouldRegenerate) {
        // Delete old files
        if (book.files.epub?.path && fs.existsSync(book.files.epub.path)) {
          fs.unlinkSync(book.files.epub.path);
        }
        if (book.files.pdf?.path && fs.existsSync(book.files.pdf.path)) {
          fs.unlinkSync(book.files.pdf.path);
        }

        // Generate new files
        const timestamp = Date.now();
        const outputDir = path.join("uploads", "generated-books");
        const baseFilename = `${book.title
          .replace(/[^a-z0-9]/gi, "_")
          .toLowerCase()}_${timestamp}`;

        const generatedFiles: {
          epub?: { path: string; url: string };
          pdf?: { path: string; url: string };
        } = {};

        // Generate EPUB if requested
        if (book.format.includes("epub")) {
          const epubPath = path.join(outputDir, `${baseFilename}.epub`);
          await EpubGenerator.generateEpub({
            title: book.title,
            description: book.description,
            author: book.author,
            chapters: book.chapters,
            outputPath: epubPath,
          });

          generatedFiles.epub = {
            path: epubPath,
            url: `/uploads/generated-books/${baseFilename}.epub`,
          };
        }

        // Generate PDF if requested
        if (book.format.includes("pdf")) {
          const pdfPath = path.join(outputDir, `${baseFilename}.pdf`);
          await PdfGenerator.generatePdf({
            title: book.title,
            description: book.description,
            author: book.author,
            chapters: book.chapters,
            outputPath: pdfPath,
          });

          generatedFiles.pdf = {
            path: pdfPath,
            url: `/uploads/generated-books/${baseFilename}.pdf`,
          };
        }

        book.files = generatedFiles;
      }

      await book.save();

      return res.status(200).json({
        success: true,
        message: "Book updated successfully",
        data: book,
      });
    } catch (error) {
      console.error("Error in updateBook:", error);
      return next(error);
    }
  }

  /**
   * Delete a written book
   */
  static async deleteBook(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const user = req.user!;

      const book = await WrittenBook.findOne({
        _id: id,
        userId: user._id,
      });

      if (!book) {
        return res.status(404).json({
          success: false,
          message: "Book not found",
        });
      }

      // Delete associated files
      if (book.files.epub?.path && fs.existsSync(book.files.epub.path)) {
        fs.unlinkSync(book.files.epub.path);
      }
      if (book.files.pdf?.path && fs.existsSync(book.files.pdf.path)) {
        fs.unlinkSync(book.files.pdf.path);
      }

      // Delete book from database
      await WrittenBook.deleteOne({ _id: id });

      return res.status(200).json({
        success: true,
        message: "Book deleted successfully",
      });
    } catch (error) {
      console.error("Error in deleteBook:", error);
      return next(error);
    }
  }
}
