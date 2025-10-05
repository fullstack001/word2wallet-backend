import { Request, Response } from "express";
import { validationResult } from "express-validator";
import {
  ApiResponse,
  AuthRequest,
  IntegrationProvider,
  IEmailCapture,
} from "../types";
import { EmailMarketingService } from "../services/emailMarketingService";
import { EmailCapture } from "../models/EmailCapture";
import { Integration } from "../models/Integration";

export class EmailMarketingController {
  /**
   * Get user's email marketing integrations
   */
  static async getIntegrations(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;
      const integrations = await EmailMarketingService.getUserIntegrations(
        userId
      );

      res.json({
        success: true,
        message: "Email marketing integrations retrieved successfully",
        data: integrations,
      } as ApiResponse);
    } catch (error) {
      console.error("Get email marketing integrations error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve email marketing integrations",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get lists from email marketing provider
   */
  static async getLists(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;
      const { provider } = req.params;

      if (
        !Object.values(IntegrationProvider).includes(
          provider as IntegrationProvider
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid email marketing provider",
        } as ApiResponse);
        return;
      }

      const lists = await EmailMarketingService.getLists(
        userId,
        provider as IntegrationProvider
      );

      res.json({
        success: true,
        message: "Lists retrieved successfully",
        data: lists,
      } as ApiResponse);
    } catch (error) {
      console.error("Get lists error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve lists",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Add contact to email marketing provider
   */
  static async addContact(req: AuthRequest, res: Response): Promise<void> {
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
        provider,
        email,
        firstName,
        lastName,
        tags,
        customFields,
        listId,
      } = req.body;

      if (
        !Object.values(IntegrationProvider).includes(
          provider as IntegrationProvider
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid email marketing provider",
        } as ApiResponse);
        return;
      }

      const result = await EmailMarketingService.addContact(
        userId,
        provider as IntegrationProvider,
        {
          email,
          firstName,
          lastName,
          tags,
          customFields,
        },
        listId
      );

      res.json({
        success: true,
        message: "Contact added successfully",
        data: result,
      } as ApiResponse);
    } catch (error) {
      console.error("Add contact error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to add contact",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Sync email captures to email marketing provider
   */
  static async syncEmailCaptures(
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
      const { provider, emailCaptureIds, listId } = req.body;

      if (
        !Object.values(IntegrationProvider).includes(
          provider as IntegrationProvider
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid email marketing provider",
        } as ApiResponse);
        return;
      }

      // Get email captures
      const emailCaptures = await EmailCapture.find({
        _id: { $in: emailCaptureIds },
        userId,
      });

      if (emailCaptures.length === 0) {
        res.status(404).json({
          success: false,
          message: "No email captures found",
        } as ApiResponse);
        return;
      }

      const results = await EmailMarketingService.syncEmailCaptures(
        userId,
        provider as IntegrationProvider,
        emailCaptures.map(
          (capture) => capture.toObject() as unknown as IEmailCapture
        ),
        listId
      );

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      res.json({
        success: true,
        message: `Sync completed: ${successCount} successful, ${failureCount} failed`,
        data: {
          total: results.length,
          successful: successCount,
          failed: failureCount,
          results,
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Sync email captures error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to sync email captures",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Bulk sync all email captures to email marketing provider
   */
  static async bulkSyncEmailCaptures(
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
      const { provider, listId, startDate, endDate } = req.body;

      if (
        !Object.values(IntegrationProvider).includes(
          provider as IntegrationProvider
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid email marketing provider",
        } as ApiResponse);
        return;
      }

      // Build filter for email captures
      const filter: any = { userId };
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) {
          filter.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
          filter.createdAt.$lte = new Date(endDate);
        }
      }

      // Get email captures
      const emailCaptures = await EmailCapture.find(filter);

      if (emailCaptures.length === 0) {
        res.status(404).json({
          success: false,
          message: "No email captures found for the specified criteria",
        } as ApiResponse);
        return;
      }

      const results = await EmailMarketingService.syncEmailCaptures(
        userId,
        provider as IntegrationProvider,
        emailCaptures.map(
          (capture) => capture.toObject() as unknown as IEmailCapture
        ),
        listId
      );

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      res.json({
        success: true,
        message: `Bulk sync completed: ${successCount} successful, ${failureCount} failed`,
        data: {
          total: results.length,
          successful: successCount,
          failed: failureCount,
          results,
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Bulk sync email captures error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to bulk sync email captures",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Test email marketing integration
   */
  static async testIntegration(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;
      const { provider } = req.params;

      if (
        !Object.values(IntegrationProvider).includes(
          provider as IntegrationProvider
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid email marketing provider",
        } as ApiResponse);
        return;
      }

      // Try to get lists to test the connection
      const lists = await EmailMarketingService.getLists(
        userId,
        provider as IntegrationProvider
      );

      // Update integration status
      await Integration.findOneAndUpdate(
        { userId, provider },
        { status: "active", errorMessage: null }
      );

      res.json({
        success: true,
        message: "Integration test successful",
        data: {
          provider,
          listsCount: lists.length,
          lists,
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Test integration error:", error);

      // Update integration status with error
      try {
        await Integration.findOneAndUpdate(
          { userId: req.user!._id, provider: req.params.provider },
          {
            status: "error",
            errorMessage:
              error instanceof Error ? error.message : "Unknown error",
          }
        );
      } catch (updateError) {
        console.error(
          "Failed to update integration error status:",
          updateError
        );
      }

      res.status(500).json({
        success: false,
        message: "Integration test failed",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get integration statistics
   */
  static async getIntegrationStats(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!._id;
      const { provider } = req.params;

      if (
        !Object.values(IntegrationProvider).includes(
          provider as IntegrationProvider
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid email marketing provider",
        } as ApiResponse);
        return;
      }

      const integration = await Integration.findOne({ userId, provider });
      if (!integration) {
        res.status(404).json({
          success: false,
          message: "Integration not found",
        } as ApiResponse);
        return;
      }

      // Get email captures count
      const totalEmailCaptures = await EmailCapture.countDocuments({ userId });
      const recentEmailCaptures = await EmailCapture.countDocuments({
        userId,
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
      });

      // Get lists
      const lists = await EmailMarketingService.getLists(
        userId,
        provider as IntegrationProvider
      );

      const stats = {
        integration: {
          _id: integration._id,
          provider: integration.provider,
          isActive: integration.isActive,
          testStatus: integration.testStatus,
          lastSyncAt: integration.lastSyncAt,
          testError: integration.testError,
          createdAt: integration.createdAt,
        },
        emailCaptures: {
          total: totalEmailCaptures,
          recent: recentEmailCaptures,
        },
        lists: {
          count: lists.length,
          totalSubscribers: lists.reduce(
            (sum, list) => sum + list.subscriberCount,
            0
          ),
          lists,
        },
      };

      res.json({
        success: true,
        message: "Integration statistics retrieved successfully",
        data: stats,
      } as ApiResponse);
    } catch (error) {
      console.error("Get integration stats error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve integration statistics",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }
}
