import { Request, Response } from "express";
import { validationResult } from "express-validator";
import {
  IArcLink,
  ArcLinkStatus,
  ApiResponse,
  AuthRequest,
  ArcLinkQuery,
} from "../types";
import { ArcLink } from "../models/ArcLink";
import { Book } from "../models/Book";
import { Integration } from "../models/Integration";
import { IntegrationProvider } from "../types";
import { JobService } from "../services/jobService";
import { JobType } from "../types";

export class ArcController {
  /**
   * Create ARC campaign and generate codes
   */
  static async createArcCampaign(
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
      const {
        bookId,
        campaignName,
        description,
        quantity = 1,
        maxDownloads,
        expiresAt,
        maxDownloadsPerCode,
      } = req.body;

      // Verify book exists and belongs to user
      const book = await Book.findOne({ _id: bookId, userId });
      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        } as ApiResponse);
        return;
      }

      if (book.status !== "ready") {
        res.status(400).json({
          success: false,
          message: "Book is not ready for ARC distribution",
        } as ApiResponse);
        return;
      }

      // Check if BookFunnel integration exists
      const integration = await (Integration as any).findActiveByProvider(
        userId,
        IntegrationProvider.BOOKFUNNEL
      );
      if (!integration) {
        res.status(400).json({
          success: false,
          message: "BookFunnel integration not found or inactive",
        } as ApiResponse);
        return;
      }

      // Check if book has been uploaded to BookFunnel
      if (!book.metadata.bookFunnelUploadId) {
        res.status(400).json({
          success: false,
          message: "Book must be uploaded to BookFunnel first",
        } as ApiResponse);
        return;
      }

      // Start ARC campaign creation job
      const campaignJob = await JobService.addJob(JobType.ARC_CAMPAIGN_CREATE, {
        bookId,
        userId,
        campaignData: {
          name: campaignName,
          description,
          maxDownloads,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        },
      });

      // Start ARC codes generation job (depends on campaign creation)
      const codesJob = await JobService.addJob(
        JobType.ARC_CODES_GENERATE,
        {
          bookId,
          userId,
          quantity,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
          maxDownloadsPerCode,
        },
        {
          delay: 5000, // Wait 5 seconds for campaign creation
        }
      );

      res.status(201).json({
        success: true,
        message: "ARC campaign creation started",
        data: {
          campaignJobId: campaignJob._id,
          codesJobId: codesJob._id,
          bookId,
          quantity,
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Create ARC campaign error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create ARC campaign",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get ARC links for a book
   */
  static async getBookArcLinks(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { bookId } = req.params;
      const userId = req.user!._id;
      const {
        page = 1,
        limit = 10,
        status,
        expired,
      } = req.query as ArcLinkQuery;

      // Verify book exists and belongs to user
      const book = await Book.findOne({ _id: bookId, userId });
      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        } as ApiResponse);
        return;
      }

      const query: any = { bookId, userId };

      // Apply filters
      if (status) {
        query.status = status;
      }

      if (expired !== undefined) {
        if (expired) {
          query.$or = [
            { expiresAt: { $lt: new Date() } },
            { status: ArcLinkStatus.EXPIRED },
          ];
        } else {
          query.$or = [
            { expiresAt: { $exists: false } },
            { expiresAt: { $gt: new Date() } },
          ];
          query.status = { $ne: ArcLinkStatus.EXPIRED };
        }
      }

      // Calculate pagination
      const skip = (Number(page) - 1) * Number(limit);

              const [arcLinks, total] = await Promise.all([
                ArcLink.find(query)
                  .sort({ createdAt: -1 })
                  .skip(skip)
                  .limit(Number(limit)),
                ArcLink.countDocuments(query),
              ]);

              res.json({
                success: true,
                message: "ARC links retrieved successfully",
                data: arcLinks as any,
                pagination: {
                  page: Number(page),
                  limit: Number(limit),
                  total,
                  pages: Math.ceil(total / Number(limit)),
                },
              } as ApiResponse<IArcLink[]>);
    } catch (error) {
      console.error("Get book ARC links error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve ARC links",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get all user's ARC links
   */
  static async getUserArcLinks(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;
      const {
        page = 1,
        limit = 10,
        status,
        expired,
      } = req.query as ArcLinkQuery;

      const query: any = { userId };

      // Apply filters
      if (status) {
        query.status = status;
      }

      if (expired !== undefined) {
        if (expired) {
          query.$or = [
            { expiresAt: { $lt: new Date() } },
            { status: ArcLinkStatus.EXPIRED },
          ];
        } else {
          query.$or = [
            { expiresAt: { $exists: false } },
            { expiresAt: { $gt: new Date() } },
          ];
          query.status = { $ne: ArcLinkStatus.EXPIRED };
        }
      }

      // Calculate pagination
      const skip = (Number(page) - 1) * Number(limit);

              const [arcLinks, total] = await Promise.all([
                ArcLink.find(query)
                  .populate("bookId", "title author")
                  .sort({ createdAt: -1 })
                  .skip(skip)
                  .limit(Number(limit)),
                ArcLink.countDocuments(query),
              ]);

              res.json({
                success: true,
                message: "ARC links retrieved successfully",
                data: arcLinks as any,
                pagination: {
                  page: Number(page),
                  limit: Number(limit),
                  total,
                  pages: Math.ceil(total / Number(limit)),
                },
              } as ApiResponse<IArcLink[]>);
    } catch (error) {
      console.error("Get user ARC links error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve ARC links",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get ARC link by code
   */
  static async getArcLink(req: Request, res: Response): Promise<void> {
    try {
      const { code } = req.params;

              const arcLink = await ArcLink.findOne({ code });
              if (!arcLink) {
                res.status(404).json({
                  success: false,
                  message: "ARC link not found",
                } as ApiResponse);
                return;
              }

              // Check if link is accessible
              await (arcLink as any).checkStatus();

              if (!(arcLink as any).isAccessible) {
                res.status(410).json({
                  success: false,
                  message: "ARC link is no longer accessible",
                  data: {
                    status: arcLink.status,
                    isExpired: (arcLink as any).isExpired,
                    isMaxDownloadsReached: (arcLink as any).isMaxDownloadsReached,
                  },
                } as ApiResponse);
                return;
              }

              res.json({
                success: true,
                message: "ARC link retrieved successfully",
                data: arcLink as any,
              } as ApiResponse<IArcLink>);
    } catch (error) {
      console.error("Get ARC link error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve ARC link",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Download ARC (increment download count)
   */
  static async downloadArc(req: Request, res: Response): Promise<void> {
    try {
      const { code } = req.params;

      const arcLink = await ArcLink.findOne({ code });
      if (!arcLink) {
        res.status(404).json({
          success: false,
          message: "ARC link not found",
        } as ApiResponse);
        return;
      }

              // Check if link is accessible
              await (arcLink as any).checkStatus();

              if (!(arcLink as any).isAccessible) {
                res.status(410).json({
                  success: false,
                  message: "ARC link is no longer accessible",
                  data: {
                    status: arcLink.status,
                    isExpired: (arcLink as any).isExpired,
                    isMaxDownloadsReached: (arcLink as any).isMaxDownloadsReached,
                  },
                } as ApiResponse);
                return;
              }

              // Increment download count
              await (arcLink as any).incrementDownload();

      // Get book for download URL
      const book = await Book.findById(arcLink.bookId);
      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        } as ApiResponse);
        return;
      }

      // Generate download URL (this would typically redirect to BookFunnel)
      const downloadUrl = arcLink.url; // BookFunnel URL

      res.json({
        success: true,
        message: "ARC download initiated",
        data: {
          downloadUrl,
          downloadsCount: arcLink.downloadsCount,
          maxDownloads: arcLink.maxDownloads,
          remainingDownloads: arcLink.maxDownloads
            ? Math.max(0, arcLink.maxDownloads - arcLink.downloadsCount)
            : null,
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Download ARC error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to download ARC",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Update ARC link
   */
  static async updateArcLink(req: AuthRequest, res: Response): Promise<void> {
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
      const { status, expiresAt, maxDownloads } = req.body;

      const arcLink = await ArcLink.findOne({ _id: id, userId });
      if (!arcLink) {
        res.status(404).json({
          success: false,
          message: "ARC link not found",
        } as ApiResponse);
        return;
      }

      // Update allowed fields
      if (status && Object.values(ArcLinkStatus).includes(status)) {
        arcLink.status = status;
      }

      if (expiresAt !== undefined) {
        arcLink.expiresAt = expiresAt ? new Date(expiresAt) : undefined;
      }

      if (maxDownloads !== undefined) {
        arcLink.maxDownloads = maxDownloads;
      }

      await arcLink.save();

              res.json({
                success: true,
                message: "ARC link updated successfully",
                data: arcLink as any,
              } as ApiResponse<IArcLink>);
    } catch (error) {
      console.error("Update ARC link error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update ARC link",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Delete ARC link
   */
  static async deleteArcLink(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!._id;

      const arcLink = await ArcLink.findOne({ _id: id, userId });
      if (!arcLink) {
        res.status(404).json({
          success: false,
          message: "ARC link not found",
        } as ApiResponse);
        return;
      }

      await ArcLink.findByIdAndDelete(id);

      res.json({
        success: true,
        message: "ARC link deleted successfully",
      } as ApiResponse);
    } catch (error) {
      console.error("Delete ARC link error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete ARC link",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get ARC link analytics
   */
  static async getArcLinkAnalytics(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!._id;

      const arcLink = await ArcLink.findOne({ _id: id, userId });
      if (!arcLink) {
        res.status(404).json({
          success: false,
          message: "ARC link not found",
        } as ApiResponse);
        return;
      }

              // Get analytics data
              const analytics = {
                downloadsCount: arcLink.downloadsCount,
                maxDownloads: arcLink.maxDownloads,
                remainingDownloads: arcLink.maxDownloads
                  ? Math.max(0, arcLink.maxDownloads - arcLink.downloadsCount)
                  : null,
                isExpired: (arcLink as any).isExpired,
                isMaxDownloadsReached: (arcLink as any).isMaxDownloadsReached,
                isAccessible: (arcLink as any).isAccessible,
                createdAt: arcLink.createdAt,
                expiresAt: arcLink.expiresAt,
                status: arcLink.status,
              };

      res.json({
        success: true,
        message: "ARC link analytics retrieved successfully",
        data: analytics,
      } as ApiResponse);
    } catch (error) {
      console.error("Get ARC link analytics error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve ARC link analytics",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }
}
