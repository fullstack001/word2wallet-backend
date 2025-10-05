import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { ApiResponse, AuthRequest, IntegrationProvider } from "../types";
import { PaymentGatewayService } from "../services/paymentGatewayService";
import { Integration } from "../models/Integration";

export class PaymentGatewayController {
  /**
   * Get user's payment gateway integrations
   */
  static async getIntegrations(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;
      const integrations = await PaymentGatewayService.getUserIntegrations(
        userId
      );

      res.json({
        success: true,
        message: "Payment gateway integrations retrieved successfully",
        data: integrations,
      } as ApiResponse);
    } catch (error) {
      console.error("Get payment gateway integrations error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve payment gateway integrations",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Create payment intent
   */
  static async createPaymentIntent(
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
      const { provider, amount, currency = "usd", metadata } = req.body;

      if (
        !Object.values(IntegrationProvider).includes(
          provider as IntegrationProvider
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid payment provider",
        } as ApiResponse);
        return;
      }

      if (amount <= 0) {
        res.status(400).json({
          success: false,
          message: "Amount must be greater than 0",
        } as ApiResponse);
        return;
      }

      const paymentIntent = await PaymentGatewayService.createPaymentIntent(
        userId,
        provider as IntegrationProvider,
        amount,
        currency,
        metadata
      );

      res.json({
        success: true,
        message: "Payment intent created successfully",
        data: paymentIntent,
      } as ApiResponse);
    } catch (error) {
      console.error("Create payment intent error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create payment intent",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Confirm payment
   */
  static async confirmPayment(req: AuthRequest, res: Response): Promise<void> {
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
      const { provider, paymentIntentId, paymentMethodId } = req.body;

      if (
        !Object.values(IntegrationProvider).includes(
          provider as IntegrationProvider
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid payment provider",
        } as ApiResponse);
        return;
      }

      const result = await PaymentGatewayService.confirmPayment(
        userId,
        provider as IntegrationProvider,
        paymentIntentId,
        paymentMethodId
      );

      res.json({
        success: true,
        message: "Payment confirmed successfully",
        data: result,
      } as ApiResponse);
    } catch (error) {
      console.error("Confirm payment error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to confirm payment",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Create customer
   */
  static async createCustomer(req: AuthRequest, res: Response): Promise<void> {
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
      const { provider, email, name, metadata } = req.body;

      if (
        !Object.values(IntegrationProvider).includes(
          provider as IntegrationProvider
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid payment provider",
        } as ApiResponse);
        return;
      }

      const customer = await PaymentGatewayService.createCustomer(
        userId,
        provider as IntegrationProvider,
        email,
        name,
        metadata
      );

      res.json({
        success: true,
        message: "Customer created successfully",
        data: customer,
      } as ApiResponse);
    } catch (error) {
      console.error("Create customer error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create customer",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Create subscription
   */
  static async createSubscription(
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
      const { provider, customerId, planId, paymentMethodId } = req.body;

      if (
        !Object.values(IntegrationProvider).includes(
          provider as IntegrationProvider
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid payment provider",
        } as ApiResponse);
        return;
      }

      const subscription = await PaymentGatewayService.createSubscription(
        userId,
        provider as IntegrationProvider,
        customerId,
        planId,
        paymentMethodId
      );

      res.json({
        success: true,
        message: "Subscription created successfully",
        data: subscription,
      } as ApiResponse);
    } catch (error) {
      console.error("Create subscription error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create subscription",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Test payment gateway integration
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
          message: "Invalid payment provider",
        } as ApiResponse);
        return;
      }

      // Try to create a test payment intent with minimal amount
      const testAmount = 0.5; // 50 cents
      const paymentIntent = await PaymentGatewayService.createPaymentIntent(
        userId,
        provider as IntegrationProvider,
        testAmount,
        "usd",
        { test: true }
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
          testPaymentIntent: paymentIntent,
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
          message: "Invalid payment provider",
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
        // Note: In a real implementation, you would track payment statistics
        // in a separate collection or through webhook events
        payments: {
          total: 0,
          successful: 0,
          failed: 0,
          totalAmount: 0,
        },
        subscriptions: {
          active: 0,
          cancelled: 0,
          total: 0,
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

  /**
   * Process webhook from payment provider
   */
  static async processWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { provider } = req.params;
      const signature =
        req.get("stripe-signature") ||
        req.get("paypal-signature") ||
        req.get("square-signature") ||
        req.get("razorpay-signature");
      const body = req.body;

      if (
        !Object.values(IntegrationProvider).includes(
          provider as IntegrationProvider
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid payment provider",
        } as ApiResponse);
        return;
      }

      // In a real implementation, you would:
      // 1. Verify the webhook signature
      // 2. Parse the webhook event
      // 3. Update payment status in your database
      // 4. Trigger any necessary business logic (e.g., deliver book)

      console.log(`Received webhook from ${provider}:`, body);

      // For now, just acknowledge receipt
      res.json({
        success: true,
        message: "Webhook processed successfully",
        data: { provider, event: body.type || body.event_type || "unknown" },
      } as ApiResponse);
    } catch (error) {
      console.error("Process webhook error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to process webhook",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }
}
