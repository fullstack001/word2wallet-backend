import { Request, Response } from "express";
import { validationResult } from "express-validator";
import {
  IIntegration,
  IntegrationProvider,
  IntegrationStatus,
  ApiResponse,
  AuthRequest,
} from "../types";
import { Integration } from "../models/Integration";
import {
  createBookFunnelService,
  encryptApiKey,
} from "../services/bookFunnelService";

export class IntegrationController {
  /**
   * Connect BookFunnel account
   */
  static async connectBookFunnel(
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
      const { apiKey } = req.body;

      // Test API key by creating a service instance
      const testService = new (
        await import("../services/bookFunnelService")
      ).BookFunnelService({
        apiKey,
      });

      const isValid = await testService.testConnection();
      if (!isValid) {
        res.status(400).json({
          success: false,
          message: "Invalid API key or connection failed",
        } as ApiResponse);
        return;
      }

      // Encrypt API key
      const encryptedApiKey = encryptApiKey(apiKey);

      // Check if integration already exists
      let integration = await Integration.findOne({
        userId,
        provider: IntegrationProvider.BOOKFUNNEL,
      });

      if (integration) {
        // Update existing integration
        integration.apiKey = encryptedApiKey;
        integration.status = IntegrationStatus.ACTIVE;
        integration.errorMessage = undefined;
                await (integration as any).clearError();
      } else {
        // Create new integration
        integration = new Integration({
          userId,
          provider: IntegrationProvider.BOOKFUNNEL,
          apiKey: encryptedApiKey,
          status: IntegrationStatus.ACTIVE,
        });
        await integration.save();
      }

      // Get account info to store in settings
      try {
        const accountInfo = await testService.getAccountInfo();
        integration.settings = {
          accountInfo,
          connectedAt: new Date(),
        };
        await integration.save();
      } catch (error) {
        console.warn("Failed to get account info:", error);
      }

      res.status(201).json({
        success: true,
        message: "BookFunnel account connected successfully",
        data: {
          id: integration._id,
          provider: integration.provider,
          status: integration.status,
          lastSync: integration.lastSync,
          settings: integration.settings,
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Connect BookFunnel error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to connect BookFunnel account",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get user integrations
   */
  static async getUserIntegrations(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!._id;

      const integrations = await Integration.find({ userId }).select("-apiKey");

              res.json({
                success: true,
                message: "Integrations retrieved successfully",
                data: integrations as any,
              } as ApiResponse<IIntegration[]>);
    } catch (error) {
      console.error("Get user integrations error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve integrations",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get integration by provider
   */
  static async getIntegration(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { provider } = req.params;
      const userId = req.user!._id;

      if (
        !Object.values(IntegrationProvider).includes(
          provider as IntegrationProvider
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid provider",
        } as ApiResponse);
        return;
      }

      const integration = await Integration.findOne({
        userId,
        provider: provider as IntegrationProvider,
      }).select("-apiKey");

      if (!integration) {
        res.status(404).json({
          success: false,
          message: "Integration not found",
        } as ApiResponse);
        return;
      }

              res.json({
                success: true,
                message: "Integration retrieved successfully",
                data: integration as any,
              } as ApiResponse<IIntegration>);
    } catch (error) {
      console.error("Get integration error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve integration",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Update integration settings
   */
  static async updateIntegration(
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

      const { id } = req.params;
      const userId = req.user!._id;
      const { settings } = req.body;

      const integration = await Integration.findOne({ _id: id, userId });
      if (!integration) {
        res.status(404).json({
          success: false,
          message: "Integration not found",
        } as ApiResponse);
        return;
      }

      integration.settings = { ...integration.settings, ...settings };
      await integration.save();

              res.json({
                success: true,
                message: "Integration updated successfully",
                data: integration as any,
              } as ApiResponse<IIntegration>);
    } catch (error) {
      console.error("Update integration error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update integration",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Disconnect integration
   */
  static async disconnectIntegration(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!._id;

      const integration = await Integration.findOne({ _id: id, userId });
      if (!integration) {
        res.status(404).json({
          success: false,
          message: "Integration not found",
        } as ApiResponse);
        return;
      }

      integration.status = IntegrationStatus.INACTIVE;
      await integration.save();

      res.json({
        success: true,
        message: "Integration disconnected successfully",
      } as ApiResponse);
    } catch (error) {
      console.error("Disconnect integration error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to disconnect integration",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Delete integration
   */
  static async deleteIntegration(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!._id;

      const integration = await Integration.findOne({ _id: id, userId });
      if (!integration) {
        res.status(404).json({
          success: false,
          message: "Integration not found",
        } as ApiResponse);
        return;
      }

      await Integration.findByIdAndDelete(id);

      res.json({
        success: true,
        message: "Integration deleted successfully",
      } as ApiResponse);
    } catch (error) {
      console.error("Delete integration error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete integration",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Test integration connection
   */
  static async testIntegration(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!._id;

      const integration = await Integration.findOne({ _id: id, userId });
      if (!integration) {
        res.status(404).json({
          success: false,
          message: "Integration not found",
        } as ApiResponse);
        return;
      }

      let isConnected = false;
      let errorMessage: string | undefined;

      try {
        switch (integration.provider) {
          case IntegrationProvider.BOOKFUNNEL:
            const bookFunnelService = await createBookFunnelService(
              integration as any
            );
            isConnected = await bookFunnelService.testConnection();
            break;
          default:
            throw new Error("Unsupported provider for testing");
        }
      } catch (error) {
        isConnected = false;
        errorMessage = error instanceof Error ? error.message : "Unknown error";
      }

      // Update integration status
      if (isConnected) {
                await (integration as any).clearError();
                await (integration as any).updateLastSync();
      } else {
        await (integration as any).setError(errorMessage || "Connection test failed");
      }

      res.json({
        success: true,
        message: "Integration test completed",
        data: {
          isConnected,
          errorMessage,
          lastSync: integration.lastSync,
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Test integration error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to test integration",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Sync integration data
   */
  static async syncIntegration(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!._id;

      const integration = await Integration.findOne({ _id: id, userId });
      if (!integration) {
        res.status(404).json({
          success: false,
          message: "Integration not found",
        } as ApiResponse);
        return;
      }

      if (integration.status !== IntegrationStatus.ACTIVE) {
        res.status(400).json({
          success: false,
          message: "Integration is not active",
        } as ApiResponse);
        return;
      }

      let syncResult: any = {};

      try {
        switch (integration.provider) {
          case IntegrationProvider.BOOKFUNNEL:
            const bookFunnelService = await createBookFunnelService(
              integration as any
            );
            const accountInfo = await bookFunnelService.getAccountInfo();
            syncResult = { accountInfo };
            break;
          default:
            throw new Error("Unsupported provider for sync");
        }

                await (integration as any).updateLastSync();
        integration.settings = { ...integration.settings, ...syncResult };
        await integration.save();

        res.json({
          success: true,
          message: "Integration synced successfully",
          data: syncResult,
        } as ApiResponse);
      } catch (error) {
        await (integration as any).setError(
          error instanceof Error ? error.message : "Sync failed"
        );

        res.status(500).json({
          success: false,
          message: "Failed to sync integration",
          error: error instanceof Error ? error.message : "Unknown error",
        } as ApiResponse);
      }
    } catch (error) {
      console.error("Sync integration error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to sync integration",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }
}
