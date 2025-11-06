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
  static async createCustomer(user: IUser): Promise<Stripe.Customer>;
  static async createCustomer(customerData: {
    email: string;
    name: string;
  }): Promise<Stripe.Customer>;
  static async createCustomer(
    userOrData: IUser | { email: string; name: string }
  ): Promise<Stripe.Customer> {
    const customer = await stripe.customers.create({
      email: userOrData.email,
      name: "name" in userOrData ? userOrData.name : userOrData.fullName,
      metadata:
        "fullName" in userOrData
          ? {
              userId: userOrData._id.toString(),
            }
          : {},
    });

    return customer;
  }

  /**
   * Create a subscription with trial
   */
  static async createSubscription(params: {
    customerId: string;
    priceId: string;
    paymentMethodId: string;
    trialPeriodDays?: number;
    immediatePayment?: boolean;
    coupon?: string; // Stripe coupon ID or code
  }): Promise<Stripe.Subscription> {
    const {
      customerId,
      priceId,
      paymentMethodId,
      trialPeriodDays = 0,
      immediatePayment = false,
      coupon,
    } = params;

    const subscriptionParams: any = {
      customer: customerId,
      items: [{ price: priceId }],
      default_payment_method: paymentMethodId,
      trial_period_days: trialPeriodDays,
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.payment_intent"],
    };

    // Add coupon if provided
    if (coupon) {
      subscriptionParams.coupon = coupon;
    }

    // For immediate payment (direct upgrades), use error_if_incomplete
    // For trials, use default_incomplete to allow trial without payment
    if (immediatePayment) {
      subscriptionParams.payment_behavior = "error_if_incomplete";
    } else {
      subscriptionParams.payment_behavior = "default_incomplete";
    }

    const subscription = await stripe.subscriptions.create(subscriptionParams);

    return subscription;
  }

  /**
   * Attach payment method to customer
   */
  static async attachPaymentMethod(
    paymentMethodId: string,
    customerId: string
  ): Promise<Stripe.PaymentMethod> {
    const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    return paymentMethod;
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

    const header = stripe.webhooks.generateTestHeaderString({
      payload: payload.toString(),
      secret: webhookSecret,
    });

    return stripe.webhooks.constructEvent(payload, header, webhookSecret);
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
      [process.env.STRIPE_BASIC_PRICE_ID || ""]: SubscriptionPlan.PRO,
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
      [SubscriptionPlan.PRO]: process.env.STRIPE_BASIC_PRICE_ID || "",
      [SubscriptionPlan.PREMIUM]: process.env.STRIPE_PREMIUM_PRICE_ID || "",
    };

    const priceId = planToPriceMap[plan];

    // Check if price ID is available for paid plans
    if (plan !== SubscriptionPlan.FREE && !priceId) {
      throw new Error(
        `Price ID not configured for plan: ${plan}. Please set STRIPE_${plan.toUpperCase()}_PRICE_ID environment variable.`
      );
    }

    return priceId;
  }

  /**
   * Create a coupon in Stripe
   */
  static async createCoupon(params: {
    id: string; // Coupon code
    name: string;
    percentOff?: number; // Percentage discount (0-100)
    amountOff?: number; // Fixed amount in cents
    currency?: string; // Required for fixed amount
    duration: "once" | "repeating" | "forever";
    durationInMonths?: number; // Required for repeating
    maxRedemptions?: number;
    redeemBy?: number; // Unix timestamp
    metadata?: Record<string, string>;
  }): Promise<Stripe.Coupon> {
    const {
      id,
      name,
      percentOff,
      amountOff,
      currency,
      duration,
      durationInMonths,
      maxRedemptions,
      redeemBy,
      metadata,
    } = params;

    const couponParams: Stripe.CouponCreateParams = {
      id,
      name,
      duration,
    };

    if (percentOff !== undefined) {
      couponParams.percent_off = percentOff;
    } else if (amountOff !== undefined) {
      couponParams.amount_off = amountOff;
      couponParams.currency = currency || "usd";
    } else {
      throw new Error("Either percentOff or amountOff must be provided");
    }

    if (duration === "repeating" && durationInMonths) {
      couponParams.duration_in_months = durationInMonths;
    }

    if (maxRedemptions !== undefined) {
      couponParams.max_redemptions = maxRedemptions;
    }

    if (redeemBy !== undefined) {
      couponParams.redeem_by = redeemBy;
    }

    if (metadata) {
      couponParams.metadata = metadata;
    }

    return await stripe.coupons.create(couponParams);
  }

  /**
   * Retrieve a coupon from Stripe
   */
  static async getCoupon(couponId: string): Promise<Stripe.Coupon> {
    return await stripe.coupons.retrieve(couponId);
  }

  /**
   * Delete a coupon from Stripe
   */
  static async deleteCoupon(couponId: string): Promise<Stripe.DeletedCoupon> {
    return await stripe.coupons.del(couponId);
  }

  /**
   * List all coupons from Stripe
   */
  static async listCoupons(
    params?: Stripe.CouponListParams
  ): Promise<Stripe.ApiList<Stripe.Coupon>> {
    return await stripe.coupons.list(params);
  }
}
