import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { ApiResponse, AuthRequest, AnalyticsEventType } from "../types";
import { BookAnalytics } from "../models/BookAnalytics";
import { Book } from "../models/Book";
import { DeliveryLink } from "../models/DeliveryLink";
import { LandingPage } from "../models/LandingPage";
import { EmailCapture } from "../models/EmailCapture";

export class AnalyticsController {
  /**
   * Get overall analytics for a user
   */
  static async getUserAnalytics(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!._id;
      const { startDate, endDate, groupBy = "day" } = req.query;

      // Build date filter
      const dateFilter: any = { userId };
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

      // Get user's books, delivery links, and landing pages
      const books = await Book.find({ userId });
      const deliveryLinks = await DeliveryLink.find({ userId });
      const landingPages = await LandingPage.find({ userId });
      const emailCaptures = await EmailCapture.find({ userId });

      // Aggregate data
      const aggregatedData = {
        overview: {
          totalBooks: books.length,
          totalDeliveryLinks: deliveryLinks.length,
          totalLandingPages: landingPages.length,
          totalEmailCaptures: emailCaptures.length,
          totalViews: analytics.filter(
            (a) => a.eventType === AnalyticsEventType.PAGE_VIEW
          ).length,
          totalDownloads: analytics.filter(
            (a) => a.eventType === AnalyticsEventType.DOWNLOAD
          ).length,
          totalConversions: analytics.filter(
            (a) => a.eventType === AnalyticsEventType.CONVERSION
          ).length,
          uniqueVisitors: new Set(analytics.map((a) => a.eventData.ipAddress))
            .size,
        },
        eventsByType: analytics.reduce((acc, event) => {
          acc[event.eventType] = (acc[event.eventType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        eventsByDate: AnalyticsController.groupEventsByDate(
          analytics,
          groupBy as string
        ),
        topBooks: AnalyticsController.getTopBooks(analytics, books),
        topDeliveryLinks: AnalyticsController.getTopDeliveryLinks(
          analytics,
          deliveryLinks
        ),
        topLandingPages: AnalyticsController.getTopLandingPages(
          analytics,
          landingPages
        ),
        deviceBreakdown: AnalyticsController.getDeviceBreakdown(analytics),
        countryBreakdown: AnalyticsController.getCountryBreakdown(analytics),
        conversionFunnel: AnalyticsController.getConversionFunnel(analytics),
      };

      res.json({
        success: true,
        message: "Analytics retrieved successfully",
        data: aggregatedData,
      } as ApiResponse);
    } catch (error) {
      console.error("Get user analytics error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve analytics",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get analytics for a specific book
   */
  static async getBookAnalytics(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!._id;
      const { bookId } = req.params;
      const { startDate, endDate, groupBy = "day" } = req.query;

      // Verify book belongs to user
      const book = await Book.findOne({ _id: bookId, userId });
      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        } as ApiResponse);
        return;
      }

      // Build date filter
      const dateFilter: any = { bookId, userId };
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

      // Get related delivery links and landing pages
      const deliveryLinks = await DeliveryLink.find({ bookId, userId });
      const landingPages = await LandingPage.find({ bookId, userId });
      const emailCaptures = await EmailCapture.find({ bookId, userId });

      // Aggregate data
      const aggregatedData = {
        book: {
          _id: book._id,
          title: book.title,
          author: book.author,
          fileType: book.fileType,
        },
        overview: {
          totalViews: analytics.filter(
            (a) => a.eventType === AnalyticsEventType.PAGE_VIEW
          ).length,
          totalDownloads: analytics.filter(
            (a) => a.eventType === AnalyticsEventType.DOWNLOAD
          ).length,
          totalConversions: analytics.filter(
            (a) => a.eventType === AnalyticsEventType.CONVERSION
          ).length,
          emailCaptures: emailCaptures.length,
          uniqueVisitors: new Set(analytics.map((a) => a.eventData.ipAddress))
            .size,
          deliveryLinks: deliveryLinks.length,
          landingPages: landingPages.length,
        },
        eventsByType: analytics.reduce((acc, event) => {
          acc[event.eventType] = (acc[event.eventType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        eventsByDate: AnalyticsController.groupEventsByDate(
          analytics,
          groupBy as string
        ),
        deliveryLinks: deliveryLinks.map((link) => ({
          _id: link._id,
          title: link.title,
          slug: link.slug,
          analytics: link.analytics,
        })),
        landingPages: landingPages.map((page) => ({
          _id: page._id,
          title: page.title,
          slug: page.slug,
          analytics: page.analytics,
        })),
        deviceBreakdown: AnalyticsController.getDeviceBreakdown(analytics),
        countryBreakdown: AnalyticsController.getCountryBreakdown(analytics),
        conversionFunnel: AnalyticsController.getConversionFunnel(analytics),
      };

      res.json({
        success: true,
        message: "Book analytics retrieved successfully",
        data: aggregatedData,
      } as ApiResponse);
    } catch (error) {
      console.error("Get book analytics error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve book analytics",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get email capture analytics
   */
  static async getEmailCaptureAnalytics(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!._id;
      const { startDate, endDate, bookId, status } = req.query;

      // Build filter
      const filter: any = { userId };
      if (bookId) {
        filter.bookId = bookId as string;
      }
      if (status) {
        filter.status = status as string;
      }
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) {
          filter.createdAt.$gte = new Date(startDate as string);
        }
        if (endDate) {
          filter.createdAt.$lte = new Date(endDate as string);
        }
      }

      const emailCaptures = await EmailCapture.find(filter)
        .populate("bookId", "title author")
        .populate("deliveryLinkId", "title slug")
        .populate("landingPageId", "title slug")
        .sort({ createdAt: -1 });

      // Aggregate data
      const aggregatedData = {
        total: emailCaptures.length,
        byStatus: emailCaptures.reduce((acc, capture) => {
          acc[capture.status] = (acc[capture.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        bySource: emailCaptures.reduce((acc, capture) => {
          acc[capture.source] = (acc[capture.source] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        byDate: emailCaptures.reduce((acc, capture) => {
          const date = capture.createdAt.toISOString().split("T")[0];
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        topBooks: emailCaptures.reduce((acc, capture) => {
          const bookTitle = (capture.bookId as any)?.title || "Unknown";
          acc[bookTitle] = (acc[bookTitle] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        emailCaptures: emailCaptures.map((capture) => ({
          _id: capture._id,
          email: capture.email,
          firstName: capture.firstName,
          lastName: capture.lastName,
          fullName: capture.fullName,
          source: capture.source,
          status: capture.status,
          tags: capture.tags,
          notes: capture.notes,
          createdAt: capture.createdAt,
          book: (capture.bookId as any)?.title,
          deliveryLink: (capture.deliveryLinkId as any)?.title,
          landingPage: (capture.landingPageId as any)?.title,
        })),
      };

      res.json({
        success: true,
        message: "Email capture analytics retrieved successfully",
        data: aggregatedData,
      } as ApiResponse);
    } catch (error) {
      console.error("Get email capture analytics error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve email capture analytics",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Update email capture status
   */
  static async updateEmailCaptureStatus(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!._id;
      const { id } = req.params;
      const { status, notes, tags } = req.body;

      const emailCapture = await EmailCapture.findOneAndUpdate(
        { _id: id, userId },
        { status, notes, tags },
        { new: true, runValidators: true }
      );

      if (!emailCapture) {
        res.status(404).json({
          success: false,
          message: "Email capture not found",
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        message: "Email capture status updated successfully",
        data: emailCapture as any,
      } as ApiResponse);
    } catch (error) {
      console.error("Update email capture status error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update email capture status",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Export analytics data
   */
  static async exportAnalytics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;
      const { startDate, endDate, format = "csv", bookId } = req.query;

      // Build filter
      const filter: any = { userId };
      if (bookId) {
        filter.bookId = bookId as string;
      }
      if (startDate || endDate) {
        filter["eventData.timestamp"] = {};
        if (startDate) {
          filter["eventData.timestamp"].$gte = new Date(startDate as string);
        }
        if (endDate) {
          filter["eventData.timestamp"].$lte = new Date(endDate as string);
        }
      }

      const analytics = await BookAnalytics.find(filter)
        .populate("bookId", "title author")
        .populate("deliveryLinkId", "title slug")
        .populate("landingPageId", "title slug")
        .sort({ "eventData.timestamp": -1 });

      if (format === "csv") {
        // Generate CSV
        const csvHeaders = [
          "Date",
          "Event Type",
          "Book Title",
          "Author",
          "Delivery Link",
          "Landing Page",
          "IP Address",
          "User Agent",
          "Country",
          "City",
          "Device",
          "Browser",
          "OS",
          "Email",
          "Referrer",
        ];

        const csvRows = analytics.map((event) => [
          event.eventData.timestamp.toISOString(),
          event.eventType,
          (event.bookId as any)?.title || "",
          (event.bookId as any)?.author || "",
          (event.deliveryLinkId as any)?.title || "",
          (event.landingPageId as any)?.title || "",
          event.eventData.ipAddress || "",
          event.eventData.userAgent || "",
          event.eventData.country || "",
          event.eventData.city || "",
          event.eventData.device || "",
          event.eventData.browser || "",
          event.eventData.os || "",
          event.eventData.email || "",
          event.eventData.referrer || "",
        ]);

        const csvContent = [csvHeaders, ...csvRows]
          .map((row) => row.map((field) => `"${field}"`).join(","))
          .join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=analytics.csv"
        );
        res.send(csvContent);
      } else {
        // Return JSON
        res.json({
          success: true,
          message: "Analytics data exported successfully",
          data: analytics,
        } as ApiResponse);
      }
    } catch (error) {
      console.error("Export analytics error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to export analytics",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  // Helper methods
  private static groupEventsByDate(
    analytics: any[],
    groupBy: string
  ): Record<string, number> {
    const grouped: Record<string, number> = {};

    analytics.forEach((event) => {
      const date = new Date(event.eventData.timestamp);
      let key: string;

      switch (groupBy) {
        case "hour":
          key = date.toISOString().slice(0, 13) + ":00:00";
          break;
        case "day":
          key = date.toISOString().slice(0, 10);
          break;
        case "week":
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().slice(0, 10);
          break;
        case "month":
          key = date.toISOString().slice(0, 7);
          break;
        default:
          key = date.toISOString().slice(0, 10);
      }

      grouped[key] = (grouped[key] || 0) + 1;
    });

    return grouped;
  }

  private static getTopBooks(analytics: any[], books: any[]): any[] {
    const bookStats = books.map((book) => {
      const bookAnalytics = analytics.filter(
        (a) => a.bookId.toString() === book._id.toString()
      );
      return {
        _id: book._id,
        title: book.title,
        author: book.author,
        views: bookAnalytics.filter(
          (a) => a.eventType === AnalyticsEventType.PAGE_VIEW
        ).length,
        downloads: bookAnalytics.filter(
          (a) => a.eventType === AnalyticsEventType.DOWNLOAD
        ).length,
        conversions: bookAnalytics.filter(
          (a) => a.eventType === AnalyticsEventType.CONVERSION
        ).length,
      };
    });

    return bookStats.sort((a, b) => b.views - a.views).slice(0, 10);
  }

  private static getTopDeliveryLinks(
    analytics: any[],
    deliveryLinks: any[]
  ): any[] {
    return deliveryLinks
      .map((link) => ({
        _id: link._id,
        title: link.title,
        slug: link.slug,
        views: link.analytics.totalViews,
        downloads: link.analytics.totalDownloads,
        emailCaptures: link.analytics.emailCaptures,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  }

  private static getTopLandingPages(
    analytics: any[],
    landingPages: any[]
  ): any[] {
    return landingPages
      .map((page) => ({
        _id: page._id,
        title: page.title,
        slug: page.slug,
        views: page.analytics.totalViews,
        conversions: page.analytics.totalConversions,
        uniqueVisitors: page.analytics.uniqueVisitors,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  }

  private static getDeviceBreakdown(analytics: any[]): Record<string, number> {
    return analytics.reduce((acc, event) => {
      const device = event.eventData.device || "unknown";
      acc[device] = (acc[device] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private static getCountryBreakdown(analytics: any[]): Record<string, number> {
    return analytics.reduce((acc, event) => {
      const country = event.eventData.country || "unknown";
      acc[country] = (acc[country] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private static getConversionFunnel(analytics: any[]): any {
    const views = analytics.filter(
      (a) => a.eventType === AnalyticsEventType.PAGE_VIEW
    ).length;
    const emailCaptures = analytics.filter(
      (a) => a.eventType === AnalyticsEventType.EMAIL_CAPTURE
    ).length;
    const downloads = analytics.filter(
      (a) => a.eventType === AnalyticsEventType.DOWNLOAD
    ).length;
    const conversions = analytics.filter(
      (a) => a.eventType === AnalyticsEventType.CONVERSION
    ).length;

    return {
      views,
      emailCaptures,
      downloads,
      conversions,
      emailCaptureRate: views > 0 ? (emailCaptures / views) * 100 : 0,
      downloadRate: views > 0 ? (downloads / views) * 100 : 0,
      conversionRate: views > 0 ? (conversions / views) * 100 : 0,
    };
  }
}
