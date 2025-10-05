import { Request, Response } from "express";
import { validationResult } from "express-validator";
import {
  ILandingPage,
  ApiResponse,
  AuthRequest,
  AnalyticsEventType,
} from "../types";
import { LandingPage } from "../models/LandingPage";
import { Book } from "../models/Book";
import { BookAnalytics } from "../models/BookAnalytics";
import { EmailCapture } from "../models/EmailCapture";

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
      const { bookId, title, description, design, content, seo } = req.body;

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

      while (await LandingPage.findOne({ slug })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      // Create landing page
      const landingPage = new LandingPage({
        bookId,
        userId,
        title,
        description,
        slug,
        design: {
          theme: design?.theme || "default",
          primaryColor: design?.primaryColor || "#3B82F6",
          backgroundColor: design?.backgroundColor || "#FFFFFF",
          textColor: design?.textColor || "#1F2937",
          fontFamily: design?.fontFamily || "Inter",
          customCSS: design?.customCSS,
        },
        content: {
          heroTitle: content.heroTitle,
          heroSubtitle: content.heroSubtitle,
          heroImage: content.heroImage,
          features: content.features || [],
          testimonials: content.testimonials || [],
          callToAction: {
            text: content.callToAction.text,
            buttonText: content.callToAction.buttonText,
            buttonColor: content.callToAction.buttonColor || "#3B82F6",
          },
          aboutAuthor: content.aboutAuthor,
          faq: content.faq || [],
        },
        seo: {
          metaTitle: seo?.metaTitle,
          metaDescription: seo?.metaDescription,
          metaKeywords: seo?.metaKeywords || [],
          ogImage: seo?.ogImage,
        },
      });

      await landingPage.save();

      res.status(201).json({
        success: true,
        message: "Landing page created successfully",
        data: landingPage as any,
      } as ApiResponse<ILandingPage>);
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
   * Get all landing pages for a user
   */
  static async getLandingPages(req: AuthRequest, res: Response): Promise<void> {
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

      const landingPages = await LandingPage.find(query)
        .populate("bookId", "title author coverImageUrl")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

      const total = await LandingPage.countDocuments(query);

      res.json({
        success: true,
        message: "Landing pages retrieved successfully",
        data: {
          landingPages,
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
        data: landingPage as any,
      } as ApiResponse<ILandingPage>);
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
  static async updateLandingPage(
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

      const landingPage = await LandingPage.findOneAndUpdate(
        { _id: id, userId },
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
        data: landingPage as any,
      } as ApiResponse<ILandingPage>);
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
      const { slug } = req.params;

      const landingPage = await LandingPage.findOne({
        slug,
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
            title: landingPage.title,
            description: landingPage.description,
            design: landingPage.design,
            content: landingPage.content,
            seo: landingPage.seo,
            url: landingPage.toJSON().url,
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
            readingTime: book.readingTime,
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
      const { slug } = req.params;
      const {
        email,
        firstName,
        lastName,
        conversionType = "download",
      } = req.body;

      const landingPage = await LandingPage.findOne({
        slug,
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

      // Capture email if provided
      if (email && book.allowEmailCapture) {
        try {
          const existingCapture = await EmailCapture.findOne({
            email: email.toLowerCase(),
            userId: landingPage.userId,
          });

          if (!existingCapture) {
            await EmailCapture.create({
              bookId: book._id,
              userId: landingPage.userId,
              landingPageId: landingPage._id,
              email: email.toLowerCase(),
              firstName,
              lastName,
              source: `landing_page_${landingPage.slug}`,
              metadata: {
                ipAddress: req.ip,
                userAgent: req.get("User-Agent"),
                referrer: req.get("Referer"),
              },
            });

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
        message: "Conversion tracked successfully",
        data: {
          conversionType,
          email: email ? "captured" : "not_provided",
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
}
