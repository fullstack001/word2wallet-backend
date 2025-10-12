import { Request, Response } from "express";
import { validationResult } from "express-validator";
import {
  IDeliveryLink,
  ApiResponse,
  AuthRequest,
  AnalyticsEventType,
} from "../types";
import { DeliveryLink } from "../models/DeliveryLink";
import { Book } from "../models/Book";
import { BookAnalytics } from "../models/BookAnalytics";
import { EmailCapture } from "../models/EmailCapture";
import { getStorageService } from "../services/storageService";
import crypto from "crypto";

export class DeliveryLinkController {
  /**
   * Create a new delivery link
   */
  static async createDeliveryLink(
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
      const { bookId, title, description, settings, saleSettings } = req.body;

      // Verify book exists and belongs to user
      const book = await Book.findOne({ _id: bookId, userId });
      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        } as ApiResponse);
        return;
      }

      // Generate unique slug
      const baseSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      let slug = baseSlug;
      let counter = 1;

      while (await DeliveryLink.findOne({ slug })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      // Create delivery link
      const deliveryLink = new DeliveryLink({
        bookId,
        userId,
        title,
        description,
        slug,
        settings: {
          requireEmail: true, // Always require email for all links
          allowAnonymous: settings?.allowAnonymous !== false,
          maxDownloads: settings?.maxDownloads,
          expiryDate: settings?.expiryDate
            ? new Date(settings.expiryDate)
            : undefined,
          password: settings?.password,
        },
        saleSettings: saleSettings
          ? {
              enabled: saleSettings.enabled || false,
              price: saleSettings.price,
              currency: saleSettings.currency || "USD",
              salePageTitle: saleSettings.salePageTitle,
              salePageDescription: saleSettings.salePageDescription,
              paypalLink: saleSettings.paypalLink,
              stripeLink: saleSettings.stripeLink,
            }
          : undefined,
      });

      console.log(
        "Creating delivery link with saleSettings:",
        deliveryLink.saleSettings
      );
      await deliveryLink.save();
      console.log(
        "Delivery link saved with saleSettings:",
        deliveryLink.saleSettings
      );

      res.status(201).json({
        success: true,
        message: "Delivery link created successfully",
        data: deliveryLink as any,
      } as ApiResponse<IDeliveryLink>);
    } catch (error) {
      console.error("Create delivery link error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create delivery link",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get all delivery links for a user
   */
  static async getDeliveryLinks(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!._id;
      const { page = 1, limit = 10, bookId, isActive } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const query: any = { userId };

      if (bookId) {
        query.bookId = bookId as string;
      }

      if (isActive !== undefined) {
        query.isActive = isActive === "true";
      }

      const deliveryLinks = await DeliveryLink.find(query)
        .populate("bookId", "title author coverImageUrl")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

      const total = await DeliveryLink.countDocuments(query);

      res.json({
        success: true,
        message: "Delivery links retrieved successfully",
        data: {
          deliveryLinks,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Get delivery links error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve delivery links",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get a single delivery link by ID
   */
  static async getDeliveryLink(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;
      const { id } = req.params;

      const deliveryLink = await DeliveryLink.findOne({
        _id: id,
        userId,
      }).populate("bookId", "title author description coverImageUrl fileType");

      if (!deliveryLink) {
        res.status(404).json({
          success: false,
          message: "Delivery link not found",
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        message: "Delivery link retrieved successfully",
        data: deliveryLink as any,
      } as ApiResponse<IDeliveryLink>);
    } catch (error) {
      console.error("Get delivery link error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve delivery link",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Update a delivery link
   */
  static async updateDeliveryLink(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
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

      const deliveryLink = await DeliveryLink.findOneAndUpdate(
        { _id: id, userId },
        updateData,
        { new: true, runValidators: true }
      ).populate("bookId", "title author coverImageUrl");

      if (!deliveryLink) {
        res.status(404).json({
          success: false,
          message: "Delivery link not found",
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        message: "Delivery link updated successfully",
        data: deliveryLink as any,
      } as ApiResponse<IDeliveryLink>);
    } catch (error) {
      console.error("Update delivery link error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update delivery link",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Delete a delivery link
   */
  static async deleteDeliveryLink(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!._id;
      const { id } = req.params;

      const deliveryLink = await DeliveryLink.findOne({ _id: id, userId });

      if (!deliveryLink) {
        res.status(404).json({
          success: false,
          message: "Delivery link not found",
        } as ApiResponse);
        return;
      }

      await DeliveryLink.findByIdAndDelete(id);

      res.json({
        success: true,
        message: "Delivery link deleted successfully",
      } as ApiResponse);
    } catch (error) {
      console.error("Delete delivery link error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete delivery link",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get delivery link analytics
   */
  static async getDeliveryLinkAnalytics(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!._id;
      const { id } = req.params;
      const { startDate, endDate } = req.query;

      const deliveryLink = await DeliveryLink.findOne({ _id: id, userId });
      if (!deliveryLink) {
        res.status(404).json({
          success: false,
          message: "Delivery link not found",
        } as ApiResponse);
        return;
      }

      // Build date filter
      const dateFilter: any = { deliveryLinkId: id };
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
        totalDownloads: analytics.filter(
          (a) => a.eventType === AnalyticsEventType.DOWNLOAD
        ).length,
        emailCaptures: analytics.filter(
          (a) => a.eventType === AnalyticsEventType.EMAIL_CAPTURE
        ).length,
        uniqueVisitors: new Set(analytics.map((a) => a.eventData.ipAddress))
          .size,
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

      res.json({
        success: true,
        message: "Analytics retrieved successfully",
        data: aggregatedData,
      } as ApiResponse);
    } catch (error) {
      console.error("Get delivery link analytics error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve analytics",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get delivery link by slug (public - for displaying sale page)
   */
  static async getDeliveryLinkBySlug(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { slug } = req.params;

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

      // Return the delivery link data (public info only)
      res.json({
        success: true,
        message: "Delivery link found",
        data: deliveryLink as any,
        deliveryLink: deliveryLink as any, // For backward compatibility
      } as ApiResponse);
    } catch (error) {
      console.error("Get delivery link by slug error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch delivery link",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Public endpoint to access a delivery link
   */
  static async accessDeliveryLink(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const { password, email, firstName, lastName } = req.body;

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

      const book = deliveryLink.bookId as any;
      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        } as ApiResponse);
        return;
      }

      // Check if link has expired
      if (
        deliveryLink.settings.expiryDate &&
        new Date() > deliveryLink.settings.expiryDate
      ) {
        res.status(410).json({
          success: false,
          message: "This delivery link has expired",
        } as ApiResponse);
        return;
      }

      // Check password if required
      if (
        deliveryLink.settings.password &&
        deliveryLink.settings.password !== password
      ) {
        res.status(401).json({
          success: false,
          message: "Invalid password",
        } as ApiResponse);
        return;
      }

      // Check if email is required
      if (deliveryLink.settings.requireEmail && !email) {
        res.status(400).json({
          success: false,
          message: "Email is required to access this content",
        } as ApiResponse);
        return;
      }

      // Capture email if provided
      if (email && book.allowEmailCapture) {
        try {
          const existingCapture = await EmailCapture.findOne({
            email: email.toLowerCase(),
            userId: deliveryLink.userId,
          });

          if (!existingCapture) {
            await EmailCapture.create({
              bookId: book._id,
              userId: deliveryLink.userId,
              deliveryLinkId: deliveryLink._id,
              email: email.toLowerCase(),
              firstName,
              lastName,
              source: `delivery_link_${deliveryLink.slug}`,
              metadata: {
                ipAddress: req.ip,
                userAgent: req.get("User-Agent"),
                referrer: req.get("Referer"),
              },
            });

            // Update analytics
            await BookAnalytics.create({
              bookId: book._id,
              userId: deliveryLink.userId,
              deliveryLinkId: deliveryLink._id,
              eventType: AnalyticsEventType.EMAIL_CAPTURE,
              eventData: {
                timestamp: new Date(),
                email: email.toLowerCase(),
                ipAddress: req.ip,
                userAgent: req.get("User-Agent"),
                referrer: req.get("Referer"),
              },
            });

            // Update delivery link analytics
            deliveryLink.analytics.emailCaptures += 1;
            await deliveryLink.save();
          }
        } catch (emailError) {
          console.error("Email capture error:", emailError);
          // Continue even if email capture fails
        }
      }

      // Track page view
      await BookAnalytics.create({
        bookId: book._id,
        userId: deliveryLink.userId,
        deliveryLinkId: deliveryLink._id,
        eventType: AnalyticsEventType.PAGE_VIEW,
        eventData: {
          timestamp: new Date(),
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
          referrer: req.get("Referer"),
        },
      });

      // Update delivery link analytics
      deliveryLink.analytics.totalViews += 1;
      deliveryLink.analytics.lastAccessed = new Date();
      await deliveryLink.save();

      // Generate download URL
      const storageService = getStorageService();
      const downloadUrl = await storageService.generatePresignedDownloadUrl(
        book.fileKey
      );

      res.json({
        success: true,
        message: "Delivery link accessed successfully",
        data: {
          book: {
            _id: book._id,
            title: book.title,
            author: book.author,
            description: book.description,
            coverImageUrl: book.coverImageUrl,
            fileType: book.fileType,
            pageCount: book.pageCount,
            wordCount: book.wordCount,
            readingTime: book.readingTime,
          },
          deliveryLink: {
            title: deliveryLink.title,
            description: deliveryLink.description,
          },
          downloadUrl,
          expiresIn: 3600, // 1 hour
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Access delivery link error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to access delivery link",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Download book from delivery link
   */
  static async downloadFromDeliveryLink(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { slug } = req.params;

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

      const book = deliveryLink.bookId as any;
      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        } as ApiResponse);
        return;
      }

      // Check download limits
      if (
        deliveryLink.settings.maxDownloads &&
        deliveryLink.analytics.totalDownloads >=
          deliveryLink.settings.maxDownloads
      ) {
        res.status(429).json({
          success: false,
          message: "Download limit reached for this link",
        } as ApiResponse);
        return;
      }

      // Track download
      await BookAnalytics.create({
        bookId: book._id,
        userId: deliveryLink.userId,
        deliveryLinkId: deliveryLink._id,
        eventType: AnalyticsEventType.DOWNLOAD,
        eventData: {
          timestamp: new Date(),
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
          referrer: req.get("Referer"),
        },
      });

      // Update delivery link analytics
      deliveryLink.analytics.totalDownloads += 1;
      await deliveryLink.save();

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
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Download from delivery link error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate download URL",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }
}
