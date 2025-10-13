import { Request, Response } from "express";
import { validationResult } from "express-validator";
import crypto from "crypto";
import { ApiResponse, AuthRequest, AnalyticsEventType } from "../types";
import { PaymentTransaction } from "../models/PaymentTransaction";
import { DeliveryLink } from "../models/DeliveryLink";
import { Book } from "../models/Book";
import { BookAnalytics } from "../models/BookAnalytics";
import { EmailCapture } from "../models/EmailCapture";
import { getStorageService } from "../services/storageService";
import { EmailService } from "../services/emailService";

export class PaymentTransactionController {
  /**
   * Create payment transaction and generate access token
   * Public endpoint - called after payment success
   */
  static async createTransaction(req: Request, res: Response): Promise<void> {
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

      const {
        slug,
        customerEmail,
        customerName,
        transactionId,
        paymentProvider,
      } = req.body;

      // Get delivery link
      const deliveryLink = await DeliveryLink.findOne({
        slug,
        isActive: true,
      }).populate("bookId");

      if (!deliveryLink) {
        res.status(404).json({
          success: false,
          message: "Delivery link not found or inactive",
        } as ApiResponse);
        return;
      }

      // Verify it's a sale link
      if (!deliveryLink.saleSettings?.enabled) {
        res.status(400).json({
          success: false,
          message: "This link is not configured for sales",
        } as ApiResponse);
        return;
      }

      const book = deliveryLink.bookId as any;
      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        } as ApiResponse);
        return;
      }

      // Check if transaction already exists for this email and link
      const existingTransaction = await PaymentTransaction.findOne({
        deliveryLinkId: deliveryLink._id,
        customerEmail: customerEmail.toLowerCase(),
        paymentStatus: "completed",
      });

      if (existingTransaction) {
        // Return existing access token if still valid
        if (
          existingTransaction.accessTokenExpiresAt > new Date() &&
          existingTransaction.downloadCount < existingTransaction.maxDownloads
        ) {
          res.json({
            success: true,
            message: "Access token already exists",
            data: {
              accessToken: existingTransaction.accessToken,
              expiresAt: existingTransaction.accessTokenExpiresAt,
            },
          } as ApiResponse);
          return;
        }
      }

      // Generate unique access token
      const accessToken = crypto.randomBytes(32).toString("hex");

      // Set expiration to 30 days
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      // Create payment transaction
      const transaction = new PaymentTransaction({
        deliveryLinkId: deliveryLink._id,
        bookId: book._id,
        userId: deliveryLink.userId,
        customerEmail: customerEmail.toLowerCase(),
        customerName,
        amount: deliveryLink.saleSettings.price || 0,
        currency: deliveryLink.saleSettings.currency || "USD",
        paymentProvider: paymentProvider || "manual",
        paymentStatus: "completed",
        transactionId,
        accessToken,
        accessTokenUsed: false,
        accessTokenExpiresAt: expiresAt,
        downloadCount: 0,
        maxDownloads: 3,
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
          referrer: req.get("Referer"),
        },
      });

      await transaction.save();

      // Capture email
      try {
        const existingCapture = await EmailCapture.findOne({
          email: customerEmail.toLowerCase(),
          userId: deliveryLink.userId,
        });

        if (!existingCapture) {
          await EmailCapture.create({
            bookId: book._id,
            userId: deliveryLink.userId,
            deliveryLinkId: deliveryLink._id,
            email: customerEmail.toLowerCase(),
            firstName: customerName?.split(" ")[0],
            lastName: customerName?.split(" ").slice(1).join(" "),
            source: `sale_${deliveryLink.slug}`,
            metadata: {
              ipAddress: req.ip,
              userAgent: req.get("User-Agent"),
              referrer: req.get("Referer"),
            },
          });
        }
      } catch (emailError) {
        console.error("Email capture error:", emailError);
        // Continue even if email capture fails
      }

      // Track analytics
      try {
        await BookAnalytics.create({
          bookId: book._id,
          userId: deliveryLink.userId,
          deliveryLinkId: deliveryLink._id,
          eventType: AnalyticsEventType.EMAIL_CAPTURE,
          eventData: {
            timestamp: new Date(),
            email: customerEmail.toLowerCase(),
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
            referrer: req.get("Referer"),
          },
        });
      } catch (analyticsError) {
        console.error("Analytics error:", analyticsError);
      }

      // Send confirmation email with download link
      try {
        const downloadLink = `${
          process.env.BOOK_LANDING_URL || "http://localhost:3001"
        }/access/${accessToken}`;

        await EmailService.sendPurchaseConfirmation(
          customerEmail,
          customerName || "Customer",
          book.title,
          downloadLink,
          expiresAt
        );
      } catch (emailError) {
        console.error("Failed to send confirmation email:", emailError);
        // Don't fail the transaction if email fails
      }

      res.status(201).json({
        success: true,
        message: "Transaction created successfully",
        data: {
          accessToken,
          expiresAt,
          bookTitle: book.title,
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Create transaction error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create transaction",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Verify access token and get book details
   * Public endpoint
   */
  static async verifyAccessToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      const transaction = await PaymentTransaction.findOne({
        accessToken: token,
      })
        .populate("bookId")
        .populate("deliveryLinkId");

      if (!transaction) {
        res.status(404).json({
          success: false,
          message: "Invalid access token",
        } as ApiResponse);
        return;
      }

      // Check if token has expired
      if (transaction.accessTokenExpiresAt < new Date()) {
        res.status(410).json({
          success: false,
          message: "Access token has expired",
        } as ApiResponse);
        return;
      }

      // Check download limit
      if (transaction.downloadCount >= transaction.maxDownloads) {
        res.status(429).json({
          success: false,
          message: "Download limit reached for this purchase",
        } as ApiResponse);
        return;
      }

      const book = transaction.bookId as any;
      const deliveryLink = transaction.deliveryLinkId as any;

      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        message: "Access token is valid",
        data: {
          transaction: {
            _id: transaction._id,
            customerEmail: transaction.customerEmail,
            customerName: transaction.customerName,
            amount: transaction.amount,
            currency: transaction.currency,
            downloadCount: transaction.downloadCount,
            maxDownloads: transaction.maxDownloads,
            expiresAt: transaction.accessTokenExpiresAt,
          },
          book: {
            _id: book._id,
            title: book.title,
            author: book.author,
            description: book.description,
            coverImageUrl: book.coverImageUrl,
            fileType: book.fileType,
            pageCount: book.pageCount,
            wordCount: book.wordCount,
          },
          deliveryLink: {
            title: deliveryLink.title,
            description: deliveryLink.description,
          },
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Verify access token error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to verify access token",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Download book using access token
   * Public endpoint
   */
  static async downloadBook(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      const transaction = await PaymentTransaction.findOne({
        accessToken: token,
      }).populate("bookId");

      if (!transaction) {
        res.status(404).json({
          success: false,
          message: "Invalid access token",
        } as ApiResponse);
        return;
      }

      // Check if token has expired
      if (transaction.accessTokenExpiresAt < new Date()) {
        res.status(410).json({
          success: false,
          message: "Access token has expired",
        } as ApiResponse);
        return;
      }

      // Check download limit
      if (transaction.downloadCount >= transaction.maxDownloads) {
        res.status(429).json({
          success: false,
          message: "Download limit reached for this purchase",
        } as ApiResponse);
        return;
      }

      const book = transaction.bookId as any;
      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        } as ApiResponse);
        return;
      }

      // Increment download count
      transaction.downloadCount += 1;
      transaction.accessTokenUsed = true;
      await transaction.save();

      // Track download analytics
      try {
        await BookAnalytics.create({
          bookId: book._id,
          userId: transaction.userId,
          deliveryLinkId: transaction.deliveryLinkId,
          eventType: AnalyticsEventType.DOWNLOAD,
          eventData: {
            timestamp: new Date(),
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
            email: transaction.customerEmail,
          },
        });
      } catch (analyticsError) {
        console.error("Analytics error:", analyticsError);
      }

      // Generate download URL
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
          downloadCount: transaction.downloadCount,
          remainingDownloads:
            transaction.maxDownloads - transaction.downloadCount,
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Download book error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate download URL",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get user's purchase transactions (authenticated)
   */
  static async getUserTransactions(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!._id;
      const { page = 1, limit = 10 } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      const transactions = await PaymentTransaction.find({ userId })
        .populate("bookId", "title author coverImageUrl")
        .populate("deliveryLinkId", "title slug")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

      const total = await PaymentTransaction.countDocuments({ userId });

      res.json({
        success: true,
        message: "Transactions retrieved successfully",
        data: {
          transactions,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Get user transactions error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve transactions",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }
}
