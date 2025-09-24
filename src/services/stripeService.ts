import Stripe from "stripe";
import { IUser, SubscriptionStatus, SubscriptionPlan } from "../types";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not defined in environment variables");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

export class StripeService {
  // Export stripe instance for direct access when needed
  static stripe = stripe;
  /**
   * Create a Stripe customer
   */
  static async createCustomer(user: IUser): Promise<Stripe.Customer> {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.fullName,
      metadata: {
        userId: user._id.toString(),
      },
    });

    return customer;
  }

  /**
   * Create a subscription with 7-day trial
   */
  static async createSubscription(
    customerId: string,
    priceId: string
  ): Promise<Stripe.Subscription> {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: 7,
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.payment_intent"],
    });

    return subscription;
  }

  /**
   * Create a payment intent for setup
   */
  static async createSetupIntent(
    customerId: string
  ): Promise<Stripe.SetupIntent> {
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session",
    });

    return setupIntent;
  }

  /**
   * Retrieve a customer
   */
  static async getCustomer(customerId: string): Promise<Stripe.Customer> {
    return (await stripe.customers.retrieve(customerId)) as Stripe.Customer;
  }

  /**
   * Retrieve a subscription
   */
  static async getSubscription(
    subscriptionId: string
  ): Promise<Stripe.Subscription> {
    return await stripe.subscriptions.retrieve(subscriptionId);
  }

  /**
   * Cancel a subscription
   */
  static async cancelSubscription(
    subscriptionId: string,
    immediately: boolean = false
  ): Promise<Stripe.Subscription> {
    if (immediately) {
      return await stripe.subscriptions.cancel(subscriptionId);
    } else {
      return await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    }
  }

  /**
   * Reactivate a subscription
   */
  static async reactivateSubscription(
    subscriptionId: string
  ): Promise<Stripe.Subscription> {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  }

  /**
   * Update subscription
   */
  static async updateSubscription(
    subscriptionId: string,
    newPriceId: string
  ): Promise<Stripe.Subscription> {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    return await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId,
        },
      ],
      proration_behavior: "create_prorations",
    });
  }

  /**
   * Create a webhook endpoint
   */
  static constructWebhookEvent(
    payload: string | Buffer,
    signature: string
  ): Stripe.Event {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not defined");
    }

    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }

  /**
   * Map Stripe subscription status to our enum
   */
  static mapSubscriptionStatus(stripeStatus: string): SubscriptionStatus {
    switch (stripeStatus) {
      case "trialing":
        return SubscriptionStatus.TRIALING;
      case "active":
        return SubscriptionStatus.ACTIVE;
      case "past_due":
        return SubscriptionStatus.PAST_DUE;
      case "canceled":
        return SubscriptionStatus.CANCELED;
      case "unpaid":
        return SubscriptionStatus.UNPAID;
      case "incomplete":
        return SubscriptionStatus.INCOMPLETE;
      case "incomplete_expired":
        return SubscriptionStatus.INCOMPLETE_EXPIRED;
      case "paused":
        return SubscriptionStatus.PAUSED;
      default:
        return SubscriptionStatus.TRIALING;
    }
  }

  /**
   * Get subscription plan from price ID
   */
  static getPlanFromPriceId(priceId: string): SubscriptionPlan {
    // This should match your Stripe price IDs
    const priceToPlanMap: { [key: string]: SubscriptionPlan } = {
      [process.env.STRIPE_PRO_PRICE_ID || ""]: SubscriptionPlan.PRO,
      [process.env.STRIPE_PREMIUM_PRICE_ID || ""]: SubscriptionPlan.PREMIUM,
    };

    return priceToPlanMap[priceId] || SubscriptionPlan.PRO;
  }

  /**
   * Get price ID from plan
   */
  static getPriceIdFromPlan(plan: SubscriptionPlan): string {
    const planToPriceMap: { [key in SubscriptionPlan]: string } = {
      [SubscriptionPlan.FREE]: "",
      [SubscriptionPlan.PRO]: process.env.STRIPE_PRO_PRICE_ID || "",
      [SubscriptionPlan.PREMIUM]: process.env.STRIPE_PREMIUM_PRICE_ID || "",
    };

    return planToPriceMap[plan];
  }
}
