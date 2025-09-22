import { Request, Response, NextFunction } from "express";
import { User } from "../models/User";
import { StripeService } from "../services/stripeService";
import { CustomError } from "../middleware/errorHandler";

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
        case "customer.subscription.created":
          await WebhookController.handleSubscriptionCreated(event.data.object);
          break;

        case "customer.subscription.updated":
          await WebhookController.handleSubscriptionUpdated(event.data.object);
          break;

        case "customer.subscription.deleted":
          await WebhookController.handleSubscriptionDeleted(event.data.object);
          break;

        case "invoice.payment_succeeded":
          await WebhookController.handlePaymentSucceeded(event.data.object);
          break;

        case "invoice.payment_failed":
          await WebhookController.handlePaymentFailed(event.data.object);
          break;

        case "customer.subscription.trial_will_end":
          await WebhookController.handleTrialWillEnd(event.data.object);
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

      // Here you could send an email notification to the user
      // about their trial ending soon
      console.log(`Trial will end soon for user: ${user.email}`);
    } catch (error) {
      console.error("Error handling trial will end:", error);
    }
  }
}
