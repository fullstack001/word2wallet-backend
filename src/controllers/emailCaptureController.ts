import { Request, Response } from "express";
import { validationResult } from "express-validator";
import {
  IEmailCapture,
  ApiResponse,
  AuthRequest,
  EmailCaptureStatus,
} from "../types";
import { EmailCapture } from "../models/EmailCapture";
import { Book } from "../models/Book";

export class EmailCaptureController {
  /**
   * Get all email captures for a user
   */
  static async getEmailCaptures(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!._id;
      const {
        page = 1,
        limit = 10,
        bookId,
        status,
        search,
        startDate,
        endDate,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const query: any = { userId };

      // Apply filters
      if (bookId) {
        query.bookId = bookId as string;
      }

      if (status) {
        query.status = status as EmailCaptureStatus;
      }

      if (search) {
        query.$or = [
          { email: { $regex: search, $options: "i" } },
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { source: { $regex: search, $options: "i" } },
        ];
      }

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) {
          query.createdAt.$gte = new Date(startDate as string);
        }
        if (endDate) {
          query.createdAt.$lte = new Date(endDate as string);
        }
      }

      // Build sort object
      const sort: any = {};
      sort[sortBy as string] = sortOrder === "desc" ? -1 : 1;

      const emailCaptures = await EmailCapture.find(query)
        .populate("bookId", "title author")
        .populate("deliveryLinkId", "title slug")
        .populate("landingPageId", "title slug")
        .sort(sort)
        .skip(skip)
        .limit(Number(limit));

      const total = await EmailCapture.countDocuments(query);

      res.json({
        success: true,
        message: "Email captures retrieved successfully",
        data: {
          emailCaptures,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Get email captures error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve email captures",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get a single email capture by ID
   */
  static async getEmailCapture(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;
      const { id } = req.params;

      const emailCapture = await EmailCapture.findOne({ _id: id, userId })
        .populate("bookId", "title author coverImageUrl")
        .populate("deliveryLinkId", "title slug")
        .populate("landingPageId", "title slug");

      if (!emailCapture) {
        res.status(404).json({
          success: false,
          message: "Email capture not found",
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        message: "Email capture retrieved successfully",
        data: emailCapture as any,
      } as ApiResponse<IEmailCapture>);
    } catch (error) {
      console.error("Get email capture error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve email capture",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Update an email capture
   */
  static async updateEmailCapture(
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

      const emailCapture = await EmailCapture.findOneAndUpdate(
        { _id: id, userId },
        updateData,
        { new: true, runValidators: true }
      )
        .populate("bookId", "title author")
        .populate("deliveryLinkId", "title slug")
        .populate("landingPageId", "title slug");

      if (!emailCapture) {
        res.status(404).json({
          success: false,
          message: "Email capture not found",
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        message: "Email capture updated successfully",
        data: emailCapture as any,
      } as ApiResponse<IEmailCapture>);
    } catch (error) {
      console.error("Update email capture error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update email capture",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Delete an email capture
   */
  static async deleteEmailCapture(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!._id;
      const { id } = req.params;

      const emailCapture = await EmailCapture.findOne({ _id: id, userId });

      if (!emailCapture) {
        res.status(404).json({
          success: false,
          message: "Email capture not found",
        } as ApiResponse);
        return;
      }

      await EmailCapture.findByIdAndDelete(id);

      res.json({
        success: true,
        message: "Email capture deleted successfully",
      } as ApiResponse);
    } catch (error) {
      console.error("Delete email capture error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete email capture",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Bulk update email capture status
   */
  static async bulkUpdateEmailCaptures(
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
      const { emailCaptureIds, status, tags, notes } = req.body;

      if (!Array.isArray(emailCaptureIds) || emailCaptureIds.length === 0) {
        res.status(400).json({
          success: false,
          message: "Email capture IDs are required",
        } as ApiResponse);
        return;
      }

      const updateData: any = {};
      if (status) {
        updateData.status = status;
      }
      if (tags) {
        updateData.tags = tags;
      }
      if (notes !== undefined) {
        updateData.notes = notes;
      }

      const result = await EmailCapture.updateMany(
        { _id: { $in: emailCaptureIds }, userId },
        updateData
      );

      res.json({
        success: true,
        message: `${result.modifiedCount} email captures updated successfully`,
        data: {
          modifiedCount: result.modifiedCount,
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Bulk update email captures error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to bulk update email captures",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Export email captures
   */
  static async exportEmailCaptures(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!._id;
      const { format = "csv", bookId, status, startDate, endDate } = req.query;

      // Build filter
      const filter: any = { userId };
      if (bookId) {
        filter.bookId = bookId as string;
      }
      if (status) {
        filter.status = status as EmailCaptureStatus;
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

      if (format === "csv") {
        // Generate CSV
        const csvHeaders = [
          "Email",
          "First Name",
          "Last Name",
          "Full Name",
          "Source",
          "Status",
          "Tags",
          "Notes",
          "Book Title",
          "Author",
          "Delivery Link",
          "Landing Page",
          "IP Address",
          "Country",
          "City",
          "UTM Source",
          "UTM Medium",
          "UTM Campaign",
          "UTM Term",
          "UTM Content",
          "Created At",
        ];

        const csvRows = emailCaptures.map((capture) => [
          capture.email,
          capture.firstName || "",
          capture.lastName || "",
          capture.fullName,
          capture.source,
          capture.status,
          capture.tags.join("; "),
          capture.notes || "",
          (capture.bookId as any)?.title || "",
          (capture.bookId as any)?.author || "",
          (capture.deliveryLinkId as any)?.title || "",
          (capture.landingPageId as any)?.title || "",
          capture.metadata.ipAddress || "",
          capture.metadata.country || "",
          capture.metadata.city || "",
          capture.metadata.utmSource || "",
          capture.metadata.utmMedium || "",
          capture.metadata.utmCampaign || "",
          capture.metadata.utmTerm || "",
          capture.metadata.utmContent || "",
          capture.createdAt.toISOString(),
        ]);

        const csvContent = [csvHeaders, ...csvRows]
          .map((row) => row.map((field) => `"${field}"`).join(","))
          .join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=email_captures.csv"
        );
        res.send(csvContent);
      } else {
        // Return JSON
        res.json({
          success: true,
          message: "Email captures exported successfully",
          data: emailCaptures,
        } as ApiResponse);
      }
    } catch (error) {
      console.error("Export email captures error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to export email captures",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get email capture statistics
   */
  static async getEmailCaptureStats(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!._id;
      const { startDate, endDate, bookId } = req.query;

      // Build filter
      const filter: any = { userId };
      if (bookId) {
        filter.bookId = bookId as string;
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

      const emailCaptures = await EmailCapture.find(filter).populate(
        "bookId",
        "title author"
      );

      // Calculate statistics
      const stats = {
        total: emailCaptures.length,
        byStatus: emailCaptures.reduce((acc, capture) => {
          acc[capture.status] = (acc[capture.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        bySource: emailCaptures.reduce((acc, capture) => {
          acc[capture.source] = (acc[capture.source] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        byBook: emailCaptures.reduce((acc, capture) => {
          const bookTitle = (capture.bookId as any)?.title || "Unknown";
          acc[bookTitle] = (acc[bookTitle] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        byDate: emailCaptures.reduce((acc, capture) => {
          const date = capture.createdAt.toISOString().split("T")[0];
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        byCountry: emailCaptures.reduce((acc, capture) => {
          const country = capture.metadata.country || "Unknown";
          acc[country] = (acc[country] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        averagePerDay: 0,
        topSources: [] as Array<{ source: string; count: number }>,
        topBooks: [] as Array<{ book: string; count: number }>,
        topCountries: [] as Array<{ country: string; count: number }>,
      };

      // Calculate average per day
      if (startDate && endDate) {
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        const daysDiff = Math.ceil(
          (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
        );
        stats.averagePerDay = daysDiff > 0 ? stats.total / daysDiff : 0;
      }

      // Get top sources
      stats.topSources = Object.entries(stats.bySource)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([source, count]) => ({ source, count }));

      // Get top books
      stats.topBooks = Object.entries(stats.byBook)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([book, count]) => ({ book, count }));

      // Get top countries
      stats.topCountries = Object.entries(stats.byCountry)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([country, count]) => ({ country, count }));

      res.json({
        success: true,
        message: "Email capture statistics retrieved successfully",
        data: stats,
      } as ApiResponse);
    } catch (error) {
      console.error("Get email capture stats error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve email capture statistics",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Add tags to email captures
   */
  static async addTagsToEmailCaptures(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!._id;
      const { emailCaptureIds, tags } = req.body;

      if (!Array.isArray(emailCaptureIds) || emailCaptureIds.length === 0) {
        res.status(400).json({
          success: false,
          message: "Email capture IDs are required",
        } as ApiResponse);
        return;
      }

      if (!Array.isArray(tags) || tags.length === 0) {
        res.status(400).json({
          success: false,
          message: "Tags are required",
        } as ApiResponse);
        return;
      }

      const result = await EmailCapture.updateMany(
        { _id: { $in: emailCaptureIds }, userId },
        { $addToSet: { tags: { $each: tags } } }
      );

      res.json({
        success: true,
        message: `Tags added to ${result.modifiedCount} email captures`,
        data: {
          modifiedCount: result.modifiedCount,
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Add tags to email captures error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to add tags to email captures",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Remove tags from email captures
   */
  static async removeTagsFromEmailCaptures(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!._id;
      const { emailCaptureIds, tags } = req.body;

      if (!Array.isArray(emailCaptureIds) || emailCaptureIds.length === 0) {
        res.status(400).json({
          success: false,
          message: "Email capture IDs are required",
        } as ApiResponse);
        return;
      }

      if (!Array.isArray(tags) || tags.length === 0) {
        res.status(400).json({
          success: false,
          message: "Tags are required",
        } as ApiResponse);
        return;
      }

      const result = await EmailCapture.updateMany(
        { _id: { $in: emailCaptureIds }, userId },
        { $pull: { tags: { $in: tags } } }
      );

      res.json({
        success: true,
        message: `Tags removed from ${result.modifiedCount} email captures`,
        data: {
          modifiedCount: result.modifiedCount,
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Remove tags from email captures error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to remove tags from email captures",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }
}
