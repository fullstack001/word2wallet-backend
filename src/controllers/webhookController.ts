import { Request, Response, NextFunction } from "express";
import { User } from "../models/User";
import { StripeService } from "../services/stripeService";
import { EmailService } from "../services/emailService";
export class WebhookController {
  /**
   * Handle Stripe webhook events
   */
  static async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const sig = req.headers["stripe-signature"] as string;

      // Use rawBody if available, otherwise fall back to req.body
      const payload = (req as any).rawBody || req.body;

      if (!sig) {
        return res.status(400).json({
          success: false,
          message: "Missing stripe-signature header",
        });
      }

      if (!Buffer.isBuffer(payload)) {
        console.error("Payload is not a Buffer! Type:", typeof payload);
        return res.status(400).json({
          success: false,
          message: "Invalid payload format - must be raw buffer",
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
      console.log("Event:", event);

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
}
