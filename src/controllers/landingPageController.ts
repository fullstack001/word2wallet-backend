import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { ApiResponse, AuthRequest, AnalyticsEventType } from "../types";
import { LandingPage } from "../models/LandingPage";
import { Book } from "../models/Book";
import { BookAnalytics } from "../models/BookAnalytics";
import { EmailCapture } from "../models/EmailCapture";
import { EmailConfirmationService } from "../services/emailConfirmationService";
import { BookDeliveryService } from "../services/bookDeliveryService";
import { getStorageService } from "../services/storageService";
import {
  CreateLandingPageRequest,
  UpdateLandingPageRequest,
  LandingPageListQuery,
  LandingPageType,
} from "../types/landingPage";

export class LandingPageController {
  /**
   * Create a new landing page
   */
  static async createLandingPage(
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

      const userId = req.user!._id;
      const { bookId, type, ...pageData }: CreateLandingPageRequest = req.body;

      // Verify book exists and belongs to user
      const book = await Book.findOne({ _id: bookId, userId });
      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        } as ApiResponse);
        return;
      }

      // Generate unique slug based on type and page name
      let baseSlug: string;
      switch (type) {
        case "simple_download":
          baseSlug = pageData.downloadPage?.pageName || "download";
          break;
        case "email_signup":
          baseSlug = pageData.emailSignupPage?.pageName || "signup";
          break;
        case "restricted":
          baseSlug = pageData.restrictedPage?.pageName || "restricted";
          break;
        case "universal_link":
          baseSlug = pageData.universalBookLink?.linkName || "universal";
          break;
        default:
          baseSlug = "landing";
      }

      // Clean and create slug
      baseSlug = baseSlug
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      let slug = baseSlug;
      let counter = 1;

      while (await LandingPage.findOne({ slug })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      // Create landing page with type-specific data
      // Only include the nested object relevant to the landing page type
      const landingPageData: any = {
        bookId,
        userId,
        type,
        slug,
      };

      // Add only the type-specific settings based on landing page type
      switch (type) {
        case "simple_download":
          if (pageData.downloadPage) {
            landingPageData.downloadPage = pageData.downloadPage;
          }
          break;
        case "email_signup":
          if (pageData.emailSignupPage) {
            landingPageData.emailSignupPage = pageData.emailSignupPage;
          }
          break;
        case "restricted":
          if (pageData.restrictedPage) {
            landingPageData.restrictedPage = pageData.restrictedPage;
          }
          break;
        case "universal_link":
          if (pageData.universalBookLink) {
            landingPageData.universalBookLink = pageData.universalBookLink;
          }
          break;
      }

      const landingPage = new LandingPage(landingPageData);
      await landingPage.save();

      res.status(201).json({
        success: true,
        message: "Landing page created successfully",
        data: landingPage,
      } as ApiResponse);
    } catch (error) {
      console.error("Create landing page error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create landing page",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get all landing pages for a user with filtering
   */
  static async getLandingPages(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;
      const {
        page = 1,
        limit = 10,
        bookId,
        type,
        isActive,
      }: LandingPageListQuery = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const query: any = { userId };

      if (bookId) {
        query.bookId = bookId as string;
      }

      if (type) {
        query.type = type as LandingPageType;
      }

      if (isActive !== undefined) {
        query.isActive = String(isActive) === "true";
      }

      const landingPages = await LandingPage.find(query)
        .populate("bookId", "title author coverImageUrl")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

      const total = await LandingPage.countDocuments(query);

      // Transform data for frontend
      const transformedPages = landingPages.map((page) => ({
        id: page._id,
        title: (page as any).title, // Virtual field
        type: page.type,
        slug: page.slug,
        url: (page as any).url, // Virtual field
        isActive: page.isActive,
        analytics: page.analytics,
        book: page.bookId,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
      }));

      res.json({
        success: true,
        message: "Landing pages retrieved successfully",
        data: {
          landingPages: transformedPages,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Get landing pages error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve landing pages",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get a single landing page by ID
   */
  static async getLandingPage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;
      const { id } = req.params;

      const landingPage = await LandingPage.findOne({
        _id: id,
        userId,
      }).populate("bookId", "title author description coverImageUrl fileType");

      if (!landingPage) {
        res.status(404).json({
          success: false,
          message: "Landing page not found",
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        message: "Landing page retrieved successfully",
        data: landingPage,
      } as ApiResponse);
    } catch (error) {
      console.error("Get landing page error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve landing page",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Update a landing page
   */
  static async updateLandingPage(req: Request, res: Response): Promise<void> {
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
      const updateData: UpdateLandingPageRequest = req.body;

      const landingPage = await LandingPage.findOneAndUpdate(
        { _id: id },
        updateData,
        { new: true, runValidators: true }
      ).populate("bookId", "title author coverImageUrl");

      if (!landingPage) {
        res.status(404).json({
          success: false,
          message: "Landing page not found",
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        message: "Landing page updated successfully",
        data: landingPage,
      } as ApiResponse);
    } catch (error) {
      console.error("Update landing page error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update landing page",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Delete a landing page
   */
  static async deleteLandingPage(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!._id;
      const { id } = req.params;

      const landingPage = await LandingPage.findOne({ _id: id, userId });

      if (!landingPage) {
        res.status(404).json({
          success: false,
          message: "Landing page not found",
        } as ApiResponse);
        return;
      }

      await LandingPage.findByIdAndDelete(id);

      res.json({
        success: true,
        message: "Landing page deleted successfully",
      } as ApiResponse);
    } catch (error) {
      console.error("Delete landing page error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete landing page",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get landing page analytics
   */
  static async getLandingPageAnalytics(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!._id;
      const { id } = req.params;
      const { startDate, endDate } = req.query;

      const landingPage = await LandingPage.findOne({ _id: id, userId });
      if (!landingPage) {
        res.status(404).json({
          success: false,
          message: "Landing page not found",
        } as ApiResponse);
        return;
      }

      // Build date filter
      const dateFilter: any = { landingPageId: id };
      if (startDate || endDate) {
        dateFilter["eventData.timestamp"] = {};
        if (startDate) {
          dateFilter["eventData.timestamp"].$gte = new Date(
            startDate as string
          );
        }
        if (endDate) {
          dateFilter["eventData.timestamp"].$lte = new Date(endDate as string);
        }
      }

      // Get analytics data
      const analytics = await BookAnalytics.find(dateFilter);

      // Aggregate data
      const aggregatedData = {
        totalViews: analytics.filter(
          (a) => a.eventType === AnalyticsEventType.PAGE_VIEW
        ).length,
        totalConversions: analytics.filter(
          (a) => a.eventType === AnalyticsEventType.CONVERSION
        ).length,
        emailCaptures: analytics.filter(
          (a) => a.eventType === AnalyticsEventType.EMAIL_CAPTURE
        ).length,
        uniqueVisitors: new Set(analytics.map((a) => a.eventData.ipAddress))
          .size,
        conversionRate: 0,
        eventsByType: analytics.reduce((acc, event) => {
          acc[event.eventType] = (acc[event.eventType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        eventsByDate: analytics.reduce((acc, event) => {
          const date = event.eventData.timestamp.toISOString().split("T")[0];
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      };

      // Calculate conversion rate
      const totalViews = aggregatedData.totalViews;
      if (totalViews > 0) {
        aggregatedData.conversionRate =
          (aggregatedData.totalConversions / totalViews) * 100;
      }

      res.json({
        success: true,
        message: "Analytics retrieved successfully",
        data: aggregatedData,
      } as ApiResponse);
    } catch (error) {
      console.error("Get landing page analytics error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve analytics",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Public endpoint to view a landing page
   */
  static async viewLandingPage(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const landingPage = await LandingPage.findOne({
        _id: id,
        isActive: true,
      }).populate("bookId");

      if (!landingPage) {
        res.status(404).json({
          success: false,
          message: "Landing page not found or inactive",
        } as ApiResponse);
        return;
      }

      const book = landingPage.bookId as any;
      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        } as ApiResponse);
        return;
      }

      // Track page view
      await BookAnalytics.create({
        bookId: book._id,
        userId: landingPage.userId,
        landingPageId: landingPage._id,
        eventType: AnalyticsEventType.PAGE_VIEW,
        eventData: {
          timestamp: new Date(),
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
          referrer: req.get("Referer"),
        },
      });

      // Update landing page analytics
      landingPage.analytics.totalViews += 1;
      landingPage.analytics.lastAccessed = new Date();
      await landingPage.save();

      res.json({
        success: true,
        message: "Landing page retrieved successfully",
        data: {
          landingPage: {
            _id: landingPage._id,
            type: landingPage.type,
            title: (landingPage as any).title,
            url: (landingPage as any).url,
            downloadPage: landingPage.downloadPage,
            emailSignupPage: landingPage.emailSignupPage,
            restrictedPage: landingPage.restrictedPage,
            universalBookLink: landingPage.universalBookLink,
          },
          book: {
            _id: book._id,
            title: book.title,
            author: book.author,
            description: book.description,
            fileType: book.fileType,
            pageCount: book.pageCount,
            wordCount: book.wordCount,
            readingTime: book.readingTime,
            coverImageUrl: book.coverImageKey,
          },
        },
      } as ApiResponse);
    } catch (error) {
      console.error("View landing page error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve landing page",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Handle conversion from landing page
   */
  static async handleLandingPageConversion(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const {
        email,
        firstName,
        lastName,
        conversionType = "download",
        subscribedToNewsletter = false,
      } = req.body;

      const landingPage = await LandingPage.findOne({
        _id: id,
        isActive: true,
      }).populate("bookId");

      if (!landingPage) {
        res.status(404).json({
          success: false,
          message: "Landing page not found or inactive",
        } as ApiResponse);
        return;
      }

      const book = landingPage.bookId as any;
      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        } as ApiResponse);
        return;
      }

      // Check if email confirmation is required for this landing page
      const needsConfirmation =
        landingPage.type === "email_signup" &&
        landingPage.emailSignupPage?.confirmEmail;

      let emailCaptureId: string | undefined;

      // Capture email if provided
      if (email && book.allowEmailCapture) {
        try {
          const existingCapture = await EmailCapture.findOne({
            email: email.toLowerCase(),
            userId: landingPage.userId,
          });

          if (!existingCapture) {
            const newCapture = await EmailCapture.create({
              bookId: book._id,
              userId: landingPage.userId,
              landingPageId: landingPage._id,
              email: email.toLowerCase(),
              firstName,
              lastName,
              source: `landing_page_${landingPage._id}`,
              isConfirmed: !needsConfirmation, // Auto-confirm if not needed
              subscribedToNewsletter, // User's newsletter opt-in choice
              metadata: {
                ipAddress: req.ip,
                userAgent: req.get("User-Agent"),
                referrer: req.get("Referer"),
              },
            });

            emailCaptureId = newCapture._id;

            // Track email capture
            await BookAnalytics.create({
              bookId: book._id,
              userId: landingPage.userId,
              landingPageId: landingPage._id,
              eventType: AnalyticsEventType.EMAIL_CAPTURE,
              eventData: {
                timestamp: new Date(),
                email: email.toLowerCase(),
                ipAddress: req.ip,
                userAgent: req.get("User-Agent"),
                referrer: req.get("Referer"),
              },
            });
            console.log("needsConfirmation", needsConfirmation);

            // Send confirmation email if needed
            if (needsConfirmation) {
              try {
                await EmailConfirmationService.sendConfirmationEmail(
                  emailCaptureId,
                  book.title,
                  book.author
                );
              } catch (emailSendError) {
                console.error(
                  "Failed to send confirmation email:",
                  emailSendError
                );
                // Continue even if email sending fails - user can still use the system
                // TODO: Set up proper email service (Mailgun, SendGrid, etc.)
              }
            }
          } else {
            emailCaptureId = existingCapture._id;
          }
        } catch (emailError) {
          console.error("Email capture error:", emailError);
          // Continue even if email capture fails
        }
      }

      // Track conversion
      await BookAnalytics.create({
        bookId: book._id,
        userId: landingPage.userId,
        landingPageId: landingPage._id,
        eventType: AnalyticsEventType.CONVERSION,
        eventData: {
          timestamp: new Date(),
          email: email?.toLowerCase(),
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
          referrer: req.get("Referer"),
          conversionType,
        },
      });

      // Update landing page analytics
      landingPage.analytics.totalConversions += 1;
      await landingPage.save();

      res.json({
        success: true,
        message: needsConfirmation
          ? "Please check your email to confirm and get your book"
          : "Conversion tracked successfully",
        data: {
          conversionType,
          email: email ? "captured" : "not_provided",
          needsConfirmation,
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Handle landing page conversion error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to track conversion",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Duplicate a landing page
   */
  static async duplicateLandingPage(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!._id;
      const { id } = req.params;

      const originalPage = await LandingPage.findOne({ _id: id, userId });
      if (!originalPage) {
        res.status(404).json({
          success: false,
          message: "Landing page not found",
        } as ApiResponse);
        return;
      }

      // Create a copy with a new slug
      const duplicatedData = originalPage.toObject();
      delete (duplicatedData as any)._id;
      delete (duplicatedData as any).createdAt;
      delete (duplicatedData as any).updatedAt;

      // Generate new slug
      const baseSlug = `${duplicatedData.slug}-copy`;
      let newSlug = baseSlug;
      let counter = 1;

      while (await LandingPage.findOne({ slug: newSlug })) {
        newSlug = `${baseSlug}-${counter}`;
        counter++;
      }

      duplicatedData.slug = newSlug;
      duplicatedData.analytics = {
        totalViews: 0,
        totalConversions: 0,
        uniqueVisitors: 0,
      };

      const duplicatedPage = new LandingPage(duplicatedData);
      await duplicatedPage.save();

      res.status(201).json({
        success: true,
        message: "Landing page duplicated successfully",
        data: duplicatedPage,
      } as ApiResponse);
    } catch (error) {
      console.error("Duplicate landing page error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to duplicate landing page",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Toggle landing page active status
   */
  static async toggleLandingPageStatus(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!._id;
      const { id } = req.params;

      const landingPage = await LandingPage.findOne({ _id: id, userId });
      if (!landingPage) {
        res.status(404).json({
          success: false,
          message: "Landing page not found",
        } as ApiResponse);
        return;
      }

      landingPage.isActive = !landingPage.isActive;
      await landingPage.save();

      res.json({
        success: true,
        message: `Landing page ${
          landingPage.isActive ? "activated" : "deactivated"
        } successfully`,
        data: {
          id: landingPage._id,
          isActive: landingPage.isActive,
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Toggle landing page status error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to toggle landing page status",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Confirm email with token (public endpoint)
   */
  static async confirmEmailToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      const result = await EmailConfirmationService.confirmEmail(token);

      // Calculate expiration days (default 14 days from now)
      const expirationDays = 13;

      // Check available file formats
      const availableFormats = {
        epub: !!(result.book.epubFile?.fileKey || result.book.fileKey),
        pdf: !!result.book.pdfFile?.fileKey,
        audio: !!result.book.audioFile?.fileKey,
      };

      res.json({
        success: true,
        message: "Email confirmed successfully",
        data: {
          book: {
            _id: result.book._id,
            title: result.book.title,
            author: result.book.author,
            coverImageUrl: result.book.coverImageUrl,
          },
          downloadUrl: result.downloadUrl,
          expirationDays,
          userEmail: result.emailCapture.email,
          availableFormats,
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Confirm email error:", error);
      res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to confirm email. The link may have expired.",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Send book file via email (public endpoint)
   */
  static async sendBookViaEmail(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;
      const { email, format } = req.body;

      // Validate format
      if (!format || (format !== "epub" && format !== "pdf")) {
        res.status(400).json({
          success: false,
          message: "Invalid format. Must be 'epub' or 'pdf'",
        } as ApiResponse);
        return;
      }

      // Validate email
      if (!email) {
        res.status(400).json({
          success: false,
          message: "Email is required",
        } as ApiResponse);
        return;
      }

      // Find email capture by token to get book info
      const emailCapture = await EmailCapture.findOne({
        confirmationToken: token,
      }).populate("bookId");

      if (!emailCapture) {
        res.status(404).json({
          success: false,
          message: "Invalid token",
        } as ApiResponse);
        return;
      }

      const book = emailCapture.bookId as any;
      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        } as ApiResponse);
        return;
      }

      // Check if format is available
      const hasEpub = !!(book.epubFile?.fileKey || book.fileKey);
      const hasPdf = !!book.pdfFile?.fileKey;

      if (format === "epub" && !hasEpub) {
        res.status(400).json({
          success: false,
          message: "EPUB format not available for this book",
        } as ApiResponse);
        return;
      }

      if (format === "pdf" && !hasPdf) {
        res.status(400).json({
          success: false,
          message: "PDF format not available for this book",
        } as ApiResponse);
        return;
      }

      // Send book via email
      await BookDeliveryService.sendBookViaEmail(book, email, format);

      // Track analytics
      await BookAnalytics.create({
        bookId: book._id,
        userId: book.userId,
        landingPageId: emailCapture.landingPageId,
        eventType: AnalyticsEventType.DOWNLOAD,
        eventData: {
          timestamp: new Date(),
          email: email.toLowerCase(),
          format,
          deliveryMethod: "email",
        },
      });

      res.json({
        success: true,
        message: `Book sent successfully to ${email}`,
        data: {
          format,
          email,
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Send book via email error:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to send book via email",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Download book file (public endpoint)
   */
  static async downloadBook(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;
      const { format } = req.query;

      // Validate format
      if (!format || (format !== "epub" && format !== "pdf")) {
        res.status(400).json({
          success: false,
          message: "Invalid format. Must be 'epub' or 'pdf'",
        } as ApiResponse);
        return;
      }

      // Find email capture by token
      const emailCapture = await EmailCapture.findOne({
        confirmationToken: token,
      }).populate("bookId");

      if (!emailCapture) {
        res.status(404).json({
          success: false,
          message: "Invalid token",
        } as ApiResponse);
        return;
      }

      // Check if token has expired
      if (
        emailCapture.confirmationTokenExpiry &&
        emailCapture.confirmationTokenExpiry < new Date()
      ) {
        res.status(400).json({
          success: false,
          message: "Download link has expired",
        } as ApiResponse);
        return;
      }

      const book = emailCapture.bookId as any;
      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        } as ApiResponse);
        return;
      }

      // Get the file key based on format
      let fileKey: string | undefined;
      if (format === "epub") {
        fileKey = book.epubFile?.fileKey || book.fileKey;
      } else if (format === "pdf") {
        fileKey = book.pdfFile?.fileKey;
      }

      if (!fileKey) {
        res.status(400).json({
          success: false,
          message: `${format.toUpperCase()} format not available for this book`,
        } as ApiResponse);
        return;
      }

      // Generate download URL
      const storageService = getStorageService();
      const downloadUrl = await storageService.generatePresignedDownloadUrl(
        fileKey
      );

      // Redirect to the download URL
      res.redirect(downloadUrl);
    } catch (error) {
      console.error("Download book error:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to download book",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Simple download endpoint for simple_download landing pages
   * Allows direct download without email capture/token
   */
  static async simpleDownload(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { format } = req.query;

      // Validate format
      if (!format || (format !== "epub" && format !== "pdf")) {
        res.status(400).json({
          success: false,
          message: "Invalid format. Must be 'epub' or 'pdf'",
        } as ApiResponse);
        return;
      }

      // Find landing page
      const landingPage = await LandingPage.findById(id).populate("bookId");

      if (!landingPage) {
        res.status(404).json({
          success: false,
          message: "Landing page not found",
        } as ApiResponse);
        return;
      }

      // Check if landing page is active
      if (!landingPage.isActive) {
        res.status(403).json({
          success: false,
          message: "This landing page is not active",
        } as ApiResponse);
        return;
      }

      // Verify it's a simple_download type
      if (landingPage.type !== "simple_download") {
        res.status(403).json({
          success: false,
          message: "This endpoint only supports simple_download landing pages",
        } as ApiResponse);
        return;
      }

      const book = landingPage.bookId as any;
      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        } as ApiResponse);
        return;
      }

      // Get the file key based on format
      let fileKey: string | undefined;
      if (format === "epub") {
        fileKey = book.epubFile?.fileKey || book.fileKey;
      } else if (format === "pdf") {
        fileKey = book.pdfFile?.fileKey;
      }

      if (!fileKey) {
        res.status(400).json({
          success: false,
          message: `${format.toUpperCase()} format not available for this book`,
        } as ApiResponse);
        return;
      }

      // Generate download URL
      const storageService = getStorageService();
      const downloadUrl = await storageService.generatePresignedDownloadUrl(
        fileKey
      );

      // Track the download in analytics
      await BookAnalytics.create({
        bookId: book._id,
        userId: landingPage.userId,
        eventType: "download" as AnalyticsEventType,
        metadata: {
          source: "simple_download_landing_page",
          landingPageId: landingPage._id,
          format: format,
        },
      });

      // Increment conversion count
      landingPage.analytics.totalConversions += 1;
      await landingPage.save();

      // Redirect to the download URL
      res.redirect(downloadUrl);
    } catch (error) {
      console.error("Simple download error:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to download book",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }
}
