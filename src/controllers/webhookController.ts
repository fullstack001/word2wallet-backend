import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { User } from "../models/User";
import { StripeService } from "../services/stripeService";
import { EmailService } from "../services/emailService";
import { CustomError } from "../middleware/errorHandler";
import { Book } from "../models/Book";
import { ArcLink } from "../models/ArcLink";
import { Job } from "../models/Job";
import { Integration } from "../models/Integration";
import { IntegrationProvider, BookStatus, ArcLinkStatus } from "../types";
import { ApiResponse } from "../types";

export class WebhookController {
  /**
   * Handle Stripe webhook events
   */
  static async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const sig = req.headers["stripe-signature"] as string;
      const payload = req.body;

      if (!sig) {
        return res.status(400).json({
          success: false,
          message: "Missing stripe-signature header",
        });
      }

      let event;
      try {
        event = StripeService.constructWebhookEvent(payload, sig);
      } catch (err) {
        console.error("Webhook signature verification failed:", err);
        return res.status(400).json({
          success: false,
          message: "Invalid signature",
        });
      }

      // Handle the event
      switch (event.type) {
        // Subscription Events
        case "customer.subscription.created":
          await WebhookController.handleSubscriptionCreated(event.data.object);
          break;

        case "customer.subscription.updated":
          await WebhookController.handleSubscriptionUpdated(event.data.object);
          break;

        case "customer.subscription.deleted":
          await WebhookController.handleSubscriptionDeleted(event.data.object);
          break;

        case "customer.subscription.trial_will_end":
          await WebhookController.handleTrialWillEnd(event.data.object);
          break;

        // Payment Events
        case "invoice.payment_succeeded":
          await WebhookController.handlePaymentSucceeded(event.data.object);
          break;

        case "invoice.payment_failed":
          await WebhookController.handlePaymentFailed(event.data.object);
          break;

        case "invoice.payment_action_required":
          await WebhookController.handlePaymentActionRequired(
            event.data.object
          );
          break;

        // Customer Events
        case "customer.created":
          await WebhookController.handleCustomerCreated(event.data.object);
          break;

        case "customer.updated":
          await WebhookController.handleCustomerUpdated(event.data.object);
          break;

        case "customer.deleted":
          await WebhookController.handleCustomerDeleted(event.data.object);
          break;

        // Payment Method Events
        case "payment_method.attached":
          await WebhookController.handlePaymentMethodAttached(
            event.data.object
          );
          break;

        case "payment_method.detached":
          await WebhookController.handlePaymentMethodDetached(
            event.data.object
          );
          break;

        // Invoice Events
        case "invoice.created":
          await WebhookController.handleInvoiceCreated(event.data.object);
          break;

        case "invoice.finalized":
          await WebhookController.handleInvoiceFinalized(event.data.object);
          break;

        case "invoice.payment_action_required":
          await WebhookController.handlePaymentActionRequired(
            event.data.object
          );
          break;

        case "invoice.upcoming":
          await WebhookController.handleInvoiceUpcoming(event.data.object);
          break;

        // Setup Intent Events
        case "setup_intent.succeeded":
          await WebhookController.handleSetupIntentSucceeded(event.data.object);
          break;

        case "setup_intent.setup_failed":
          await WebhookController.handleSetupIntentFailed(event.data.object);
          break;

        // Checkout Session Events
        case "checkout.session.completed":
          await WebhookController.handleCheckoutSessionCompleted(
            event.data.object
          );
          break;

        case "checkout.session.expired":
          await WebhookController.handleCheckoutSessionExpired(
            event.data.object
          );
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Webhook error:", error);
      return next(error);
    }
  }

  /**
   * Handle subscription created event
   */
  private static async handleSubscriptionCreated(subscription: any) {
    try {
      const customerId = subscription.customer;
      const user = await User.findOne({
        "subscription.stripeCustomerId": customerId,
      });

      if (!user) {
        console.error("User not found for customer:", customerId);
        return;
      }

      await User.findByIdAndUpdate(user._id, {
        "subscription.stripeSubscriptionId": subscription.id,
        "subscription.status": StripeService.mapSubscriptionStatus(
          subscription.status
        ),
        "subscription.plan": StripeService.getPlanFromPriceId(
          subscription.items.data[0].price.id
        ),
        "subscription.trialStart": subscription.trial_start
          ? new Date(subscription.trial_start * 1000)
          : undefined,
        "subscription.trialEnd": subscription.trial_end
          ? new Date(subscription.trial_end * 1000)
          : undefined,
        "subscription.currentPeriodStart": new Date(
          subscription.current_period_start * 1000
        ),
        "subscription.currentPeriodEnd": new Date(
          subscription.current_period_end * 1000
        ),
      });

      console.log(`Subscription created for user: ${user.email}`);
    } catch (error) {
      console.error("Error handling subscription created:", error);
    }
  }

  /**
   * Handle subscription updated event
   */
  private static async handleSubscriptionUpdated(subscription: any) {
    try {
      const customerId = subscription.customer;
      const user = await User.findOne({
        "subscription.stripeCustomerId": customerId,
      });

      if (!user) {
        console.error("User not found for customer:", customerId);
        return;
      }

      await User.findByIdAndUpdate(user._id, {
        "subscription.status": StripeService.mapSubscriptionStatus(
          subscription.status
        ),
        "subscription.plan": StripeService.getPlanFromPriceId(
          subscription.items.data[0].price.id
        ),
        "subscription.currentPeriodStart": new Date(
          subscription.current_period_start * 1000
        ),
        "subscription.currentPeriodEnd": new Date(
          subscription.current_period_end * 1000
        ),
        "subscription.cancelAtPeriodEnd": subscription.cancel_at_period_end,
      });

      console.log(`Subscription updated for user: ${user.email}`);
    } catch (error) {
      console.error("Error handling subscription updated:", error);
    }
  }

  /**
   * Handle subscription deleted event
   */
  private static async handleSubscriptionDeleted(subscription: any) {
    try {
      const customerId = subscription.customer;
      const user = await User.findOne({
        "subscription.stripeCustomerId": customerId,
      });

      if (!user) {
        console.error("User not found for customer:", customerId);
        return;
      }

      await User.findByIdAndUpdate(user._id, {
        "subscription.status": "canceled",
        "subscription.canceledAt": new Date(),
      });

      console.log(`Subscription canceled for user: ${user.email}`);
    } catch (error) {
      console.error("Error handling subscription deleted:", error);
    }
  }

  /**
   * Handle payment succeeded event
   */
  private static async handlePaymentSucceeded(invoice: any) {
    try {
      const customerId = invoice.customer;
      const user = await User.findOne({
        "subscription.stripeCustomerId": customerId,
      });

      if (!user) {
        console.error("User not found for customer:", customerId);
        return;
      }

      // Update subscription status to active if it was past due
      if (user.subscription?.status === "past_due") {
        await User.findByIdAndUpdate(user._id, {
          "subscription.status": "active",
        });
      }

      console.log(`Payment succeeded for user: ${user.email}`);
    } catch (error) {
      console.error("Error handling payment succeeded:", error);
    }
  }

  /**
   * Handle payment failed event
   */
  private static async handlePaymentFailed(invoice: any) {
    try {
      const customerId = invoice.customer;
      const user = await User.findOne({
        "subscription.stripeCustomerId": customerId,
      });

      if (!user) {
        console.error("User not found for customer:", customerId);
        return;
      }

      // Update subscription status to past due
      await User.findByIdAndUpdate(user._id, {
        "subscription.status": "past_due",
      });

      // Send payment failure email
      try {
        const retryDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now
        await EmailService.sendPaymentFailureEmail(user, retryDate);
      } catch (emailError) {
        console.error("Failed to send payment failure email:", emailError);
      }

      console.log(`Payment failed for user: ${user.email}`);
    } catch (error) {
      console.error("Error handling payment failed:", error);
    }
  }

  /**
   * Handle trial will end event
   */
  private static async handleTrialWillEnd(subscription: any) {
    try {
      const customerId = subscription.customer;
      const user = await User.findOne({
        "subscription.stripeCustomerId": customerId,
      });

      if (!user) {
        console.error("User not found for customer:", customerId);
        return;
      }

      // Send payment processing email
      try {
        const subscriptionEndDate = new Date(
          subscription.current_period_end * 1000
        );
        await EmailService.sendPaymentProcessingEmail(
          user,
          subscriptionEndDate
        );
      } catch (emailError) {
        console.error("Failed to send payment processing email:", emailError);
      }

      console.log(`Trial will end soon for user: ${user.email}`);
    } catch (error) {
      console.error("Error handling trial will end:", error);
    }
  }

  /**
   * Handle payment action required event
   */
  private static async handlePaymentActionRequired(invoice: any) {
    try {
      const customerId = invoice.customer;
      const user = await User.findOne({
        "subscription.stripeCustomerId": customerId,
      });

      if (!user) {
        console.error("User not found for customer:", customerId);
        return;
      }

      // Update subscription status to requires_payment_method
      await User.findByIdAndUpdate(user._id, {
        "subscription.status": "requires_payment_method",
      });

      console.log(`Payment action required for user: ${user.email}`);
    } catch (error) {
      console.error("Error handling payment action required:", error);
    }
  }

  /**
   * Handle customer created event
   */
  private static async handleCustomerCreated(customer: any) {
    try {
      console.log(`Customer created: ${customer.id}`);
      // You can add logic here to sync customer data if needed
    } catch (error) {
      console.error("Error handling customer created:", error);
    }
  }

  /**
   * Handle customer updated event
   */
  private static async handleCustomerUpdated(customer: any) {
    try {
      const user = await User.findOne({
        "subscription.stripeCustomerId": customer.id,
      });

      if (user) {
        // Update user data if customer info changed
        await User.findByIdAndUpdate(user._id, {
          email: customer.email,
          // Add other fields as needed
        });
      }

      console.log(`Customer updated: ${customer.id}`);
    } catch (error) {
      console.error("Error handling customer updated:", error);
    }
  }

  /**
   * Handle customer deleted event
   */
  private static async handleCustomerDeleted(customer: any) {
    try {
      const user = await User.findOne({
        "subscription.stripeCustomerId": customer.id,
      });

      if (user) {
        // Mark subscription as canceled
        await User.findByIdAndUpdate(user._id, {
          "subscription.status": "canceled",
          "subscription.canceledAt": new Date(),
        });
      }

      console.log(`Customer deleted: ${customer.id}`);
    } catch (error) {
      console.error("Error handling customer deleted:", error);
    }
  }

  /**
   * Handle payment method attached event
   */
  private static async handlePaymentMethodAttached(paymentMethod: any) {
    try {
      const customerId = paymentMethod.customer;
      const user = await User.findOne({
        "subscription.stripeCustomerId": customerId,
      });

      if (user) {
        // Update user's payment method info
        await User.findByIdAndUpdate(user._id, {
          "subscription.paymentMethodId": paymentMethod.id,
        });
      }

      console.log(`Payment method attached for customer: ${customerId}`);
    } catch (error) {
      console.error("Error handling payment method attached:", error);
    }
  }

  /**
   * Handle payment method detached event
   */
  private static async handlePaymentMethodDetached(paymentMethod: any) {
    try {
      const customerId = paymentMethod.customer;
      const user = await User.findOne({
        "subscription.stripeCustomerId": customerId,
      });

      if (user) {
        // Remove payment method info
        await User.findByIdAndUpdate(user._id, {
          $unset: { "subscription.paymentMethodId": 1 },
        });
      }

      console.log(`Payment method detached for customer: ${customerId}`);
    } catch (error) {
      console.error("Error handling payment method detached:", error);
    }
  }

  /**
   * Handle invoice created event
   */
  private static async handleInvoiceCreated(invoice: any) {
    try {
      console.log(`Invoice created: ${invoice.id}`);
      // You can add logic here to track invoice creation
    } catch (error) {
      console.error("Error handling invoice created:", error);
    }
  }

  /**
   * Handle invoice finalized event
   */
  private static async handleInvoiceFinalized(invoice: any) {
    try {
      console.log(`Invoice finalized: ${invoice.id}`);
      // You can add logic here to handle finalized invoices
    } catch (error) {
      console.error("Error handling invoice finalized:", error);
    }
  }

  /**
   * Handle invoice upcoming event
   */
  private static async handleInvoiceUpcoming(invoice: any) {
    try {
      const customerId = invoice.customer;
      const user = await User.findOne({
        "subscription.stripeCustomerId": customerId,
      });

      if (user) {
        // Send upcoming invoice notification
        try {
          const invoiceDate = new Date(invoice.period_end * 1000);
          await EmailService.sendPaymentProcessingEmail(user, invoiceDate);
        } catch (emailError) {
          console.error("Failed to send upcoming invoice email:", emailError);
        }
      }

      console.log(`Invoice upcoming for customer: ${customerId}`);
    } catch (error) {
      console.error("Error handling invoice upcoming:", error);
    }
  }

  /**
   * Handle setup intent succeeded event
   */
  private static async handleSetupIntentSucceeded(setupIntent: any) {
    try {
      console.log(`Setup intent succeeded: ${setupIntent.id}`);
      // You can add logic here to handle successful setup intents
    } catch (error) {
      console.error("Error handling setup intent succeeded:", error);
    }
  }

  /**
   * Handle setup intent failed event
   */
  private static async handleSetupIntentFailed(setupIntent: any) {
    try {
      console.log(`Setup intent failed: ${setupIntent.id}`);
      // You can add logic here to handle failed setup intents
    } catch (error) {
      console.error("Error handling setup intent failed:", error);
    }
  }

  /**
   * Handle checkout session completed event
   */
  private static async handleCheckoutSessionCompleted(session: any) {
    try {
      const customerId = session.customer;
      const user = await User.findOne({
        "subscription.stripeCustomerId": customerId,
      });

      if (user) {
        // Handle successful checkout completion
        console.log(`Checkout session completed for user: ${user.email}`);
      }
    } catch (error) {
      console.error("Error handling checkout session completed:", error);
    }
  }

  /**
   * Handle checkout session expired event
   */
  private static async handleCheckoutSessionExpired(session: any) {
    try {
      console.log(`Checkout session expired: ${session.id}`);
      // You can add logic here to handle expired checkout sessions
    } catch (error) {
      console.error("Error handling checkout session expired:", error);
    }
  }

  // ==================== BOOKFUNNEL WEBHOOK METHODS ====================

  /**
   * Handle BookFunnel webhooks
   */
  static async handleBookFunnelWebhook(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      // Verify webhook signature
      const signature = req.headers["x-bookfunnel-signature"] as string;
      const webhookSecret = process.env.BOOKFUNNEL_WEBHOOK_SECRET;

      if (!webhookSecret) {
        console.error("BookFunnel webhook secret not configured");
        res.status(500).json({
          success: false,
          message: "Webhook secret not configured",
        } as ApiResponse);
        return;
      }

      if (!signature) {
        res.status(400).json({
          success: false,
          message: "Missing webhook signature",
        } as ApiResponse);
        return;
      }

      // Verify signature
      const body = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(body)
        .digest("hex");

      if (signature !== expectedSignature) {
        res.status(401).json({
          success: false,
          message: "Invalid webhook signature",
        } as ApiResponse);
        return;
      }

      const { event, data } = req.body;

      console.log(`BookFunnel webhook received: ${event}`, data);

      // Handle different webhook events
      switch (event) {
        case "upload.completed":
          await WebhookController.handleBookFunnelUploadCompleted(data);
          break;
        case "upload.failed":
          await WebhookController.handleBookFunnelUploadFailed(data);
          break;
        case "campaign.created":
          await WebhookController.handleBookFunnelCampaignCreated(data);
          break;
        case "campaign.updated":
          await WebhookController.handleBookFunnelCampaignUpdated(data);
          break;
        case "arc_code.downloaded":
          await WebhookController.handleBookFunnelArcCodeDownloaded(data);
          break;
        case "arc_code.expired":
          await WebhookController.handleBookFunnelArcCodeExpired(data);
          break;
        default:
          console.log(`Unhandled BookFunnel webhook event: ${event}`);
      }

      res.json({
        success: true,
        message: "Webhook processed successfully",
      } as ApiResponse);
    } catch (error) {
      console.error("BookFunnel webhook error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to process webhook",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Handle BookFunnel upload completed event
   */
  private static async handleBookFunnelUploadCompleted(
    data: any
  ): Promise<void> {
    try {
      const { upload_id, status, download_url } = data;

      // Find book with this upload ID
      const book = await Book.findOne({
        "metadata.bookFunnelUploadId": upload_id,
      });

      if (!book) {
        console.warn(`Book not found for upload ID: ${upload_id}`);
        return;
      }

      // Update book metadata
      book.metadata = {
        ...book.metadata,
        bookFunnelUploadStatus: status,
        bookFunnelDownloadUrl: download_url,
      };

      await book.save();

      // Update related job
      const job = await Job.findOne({
        bookId: book._id,
        type: "bookfunnel_upload",
      });

      if (job) {
        await (job as any).markCompleted({
          uploadId: upload_id,
          status,
          downloadUrl: download_url,
        });
      }

      console.log(`Upload completed for book: ${book._id}`);
    } catch (error) {
      console.error("Error handling upload completed:", error);
    }
  }

  /**
   * Handle BookFunnel upload failed event
   */
  private static async handleBookFunnelUploadFailed(data: any): Promise<void> {
    try {
      const { upload_id, error_message } = data;

      // Find book with this upload ID
      const book = await Book.findOne({
        "metadata.bookFunnelUploadId": upload_id,
      });

      if (!book) {
        console.warn(`Book not found for upload ID: ${upload_id}`);
        return;
      }

      // Update book status
      book.status = BookStatus.ERROR;
      await book.save();

      // Update related job
      const job = await Job.findOne({
        bookId: book._id,
        type: "bookfunnel_upload",
      });

      if (job) {
        await (job as any).markFailed({
          message: error_message || "Upload failed",
          code: "UPLOAD_FAILED",
        });
      }

      console.log(
        `Upload failed for book: ${book._id}, error: ${error_message}`
      );
    } catch (error) {
      console.error("Error handling upload failed:", error);
    }
  }

  /**
   * Handle BookFunnel campaign created event
   */
  private static async handleBookFunnelCampaignCreated(
    data: any
  ): Promise<void> {
    try {
      const { campaign_id, name, status } = data;

      // Find book with this campaign ID
      const book = await Book.findOne({
        "metadata.bookFunnelCampaignId": campaign_id,
      });

      if (!book) {
        console.warn(`Book not found for campaign ID: ${campaign_id}`);
        return;
      }

      // Update book metadata
      book.metadata = {
        ...book.metadata,
        bookFunnelCampaignStatus: status,
        bookFunnelCampaignName: name,
      };

      await book.save();

      // Update related job
      const job = await Job.findOne({
        bookId: book._id,
        type: "arc_campaign_create",
      });

      if (job) {
        await (job as any).markCompleted({
          campaignId: campaign_id,
          name,
          status,
        });
      }

      console.log(`Campaign created for book: ${book._id}`);
    } catch (error) {
      console.error("Error handling campaign created:", error);
    }
  }

  /**
   * Handle BookFunnel campaign updated event
   */
  private static async handleBookFunnelCampaignUpdated(
    data: any
  ): Promise<void> {
    try {
      const { campaign_id, status, download_count } = data;

      // Find book with this campaign ID
      const book = await Book.findOne({
        "metadata.bookFunnelCampaignId": campaign_id,
      });

      if (!book) {
        console.warn(`Book not found for campaign ID: ${campaign_id}`);
        return;
      }

      // Update book metadata
      book.metadata = {
        ...book.metadata,
        bookFunnelCampaignStatus: status,
        bookFunnelDownloadCount: download_count,
      };

      await book.save();

      console.log(`Campaign updated for book: ${book._id}`);
    } catch (error) {
      console.error("Error handling campaign updated:", error);
    }
  }

  /**
   * Handle BookFunnel ARC code downloaded event
   */
  private static async handleBookFunnelArcCodeDownloaded(
    data: any
  ): Promise<void> {
    try {
      const { code, download_count } = data;

      // Find ARC link with this code
      const arcLink = await ArcLink.findOne({ code });
      if (!arcLink) {
        console.warn(`ARC link not found for code: ${code}`);
        return;
      }

      // Update download count
      arcLink.downloadsCount = download_count;

      // Check if max downloads reached
      if (
        arcLink.maxDownloads &&
        arcLink.downloadsCount >= arcLink.maxDownloads
      ) {
        arcLink.status = ArcLinkStatus.MAX_DOWNLOADS_REACHED;
      }

      await arcLink.save();

      console.log(`ARC code downloaded: ${code}, count: ${download_count}`);
    } catch (error) {
      console.error("Error handling ARC code downloaded:", error);
    }
  }

  /**
   * Handle BookFunnel ARC code expired event
   */
  private static async handleBookFunnelArcCodeExpired(
    data: any
  ): Promise<void> {
    try {
      const { code } = data;

      // Find ARC link with this code
      const arcLink = await ArcLink.findOne({ code });
      if (!arcLink) {
        console.warn(`ARC link not found for code: ${code}`);
        return;
      }

      // Update status
      arcLink.status = ArcLinkStatus.EXPIRED;
      await arcLink.save();

      console.log(`ARC code expired: ${code}`);
    } catch (error) {
      console.error("Error handling ARC code expired:", error);
    }
  }

  /**
   * Handle generic webhook (for testing)
   */
  static async handleGenericWebhook(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      console.log("Generic webhook received:", req.body);

      res.json({
        success: true,
        message: "Webhook received successfully",
        data: req.body,
      } as ApiResponse);
    } catch (error) {
      console.error("Generic webhook error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to process webhook",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Verify webhook endpoint (for BookFunnel webhook verification)
   */
  static async verifyWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { challenge } = req.query;

      if (challenge) {
        res.send(challenge);
      } else {
        res.status(400).json({
          success: false,
          message: "Missing challenge parameter",
        } as ApiResponse);
      }
    } catch (error) {
      console.error("Webhook verification error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to verify webhook",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }
}
