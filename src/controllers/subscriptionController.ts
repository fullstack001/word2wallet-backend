import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import { User } from "../models/User";
import { StripeService } from "../services/stripeService";
import { EmailService } from "../services/emailService";
import { AuthRequest } from "../types";
import { CustomError } from "../middleware/errorHandler";

export class SubscriptionController {
  /**
   * Create a new subscription with trial
   */
  static async createSubscription(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const { paymentMethodId, plan = "pro" } = req.body;

      // Check if user already has a subscription
      if (user.subscription?.stripeSubscriptionId) {
        return res.status(400).json({
          success: false,
          message: "User already has an active subscription",
        });
      }

      // Check if user is eligible for trials
      if (!user.trialEligible || user.hasCanceledSubscription) {
        return res.status(400).json({
          success: false,
          message:
            "You are not eligible for a free trial. Please subscribe directly.",
        });
      }

      let customerId = user.subscription?.stripeCustomerId;

      // Create Stripe customer if doesn't exist
      if (!customerId) {
        const customer = await StripeService.createCustomer(user);
        customerId = customer.id;
      }

      // Attach payment method to customer
      if (paymentMethodId) {
        await StripeService.stripe.paymentMethods.attach(paymentMethodId, {
          customer: customerId,
        });

        // Set as default payment method
        await StripeService.stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });
      }

      // Get price ID for the plan
      const priceId = StripeService.getPriceIdFromPlan(plan as any);
      if (!priceId) {
        return res.status(400).json({
          success: false,
          message: "Invalid plan selected",
        });
      }

      // Create subscription with trial
      const subscription = await StripeService.createSubscription({
        customerId,
        priceId,
        paymentMethodId,
        trialPeriodDays: 7,
      });

      // Update user with subscription info
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        {
          "subscription.stripeCustomerId": customerId,
          "subscription.stripeSubscriptionId": subscription.id,
          "subscription.status": StripeService.mapSubscriptionStatus(
            subscription.status
          ),
          "subscription.plan": StripeService.getPlanFromPriceId(priceId),
          "subscription.trialStart": new Date(),
          "subscription.trialEnd": new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ),
          "subscription.currentPeriodStart": new Date(
            subscription.current_period_start * 1000
          ),
          "subscription.currentPeriodEnd": new Date(
            subscription.current_period_end * 1000
          ),
        },
        { new: true }
      );

      res.status(201).json({
        success: true,
        message: "Subscription created successfully",
        data: {
          subscription: {
            stripeCustomerId: updatedUser!.subscription?.stripeCustomerId,
            stripeSubscriptionId:
              updatedUser!.subscription?.stripeSubscriptionId,
            status: updatedUser!.subscription?.status,
            plan: updatedUser!.subscription?.plan,
            trialStart: updatedUser!.subscription?.trialStart,
            trialEnd: updatedUser!.subscription?.trialEnd,
            currentPeriodStart: updatedUser!.subscription?.currentPeriodStart,
            currentPeriodEnd: updatedUser!.subscription?.currentPeriodEnd,
            cancelAtPeriodEnd: updatedUser!.subscription?.cancelAtPeriodEnd,
            canceledAt: updatedUser!.subscription?.canceledAt,
            cancellationReason: updatedUser!.subscription?.cancellationReason,
            cancellationFeedback:
              updatedUser!.subscription?.cancellationFeedback,
            clientSecret: (subscription.latest_invoice as any)?.payment_intent
              ?.client_secret,
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get current subscription
   */
  static async getSubscription(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      if (!user.subscription?.stripeSubscriptionId) {
        return res.status(404).json({
          success: false,
          message: "No subscription found",
        });
      }

      // Get latest subscription data from Stripe
      const stripeSubscription = await StripeService.getSubscription(
        user.subscription.stripeSubscriptionId
      );

      // Update local subscription data
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        {
          "subscription.status": StripeService.mapSubscriptionStatus(
            stripeSubscription.status
          ),
          "subscription.currentPeriodStart": new Date(
            stripeSubscription.current_period_start * 1000
          ),
          "subscription.currentPeriodEnd": new Date(
            stripeSubscription.current_period_end * 1000
          ),
          "subscription.cancelAtPeriodEnd":
            stripeSubscription.cancel_at_period_end,
        },
        { new: true }
      );

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.json({
        success: true,
        message: "Subscription retrieved successfully",
        data: {
          subscription: {
            stripeCustomerId: updatedUser.subscription?.stripeCustomerId,
            stripeSubscriptionId:
              updatedUser.subscription?.stripeSubscriptionId,
            status: updatedUser.subscription?.status,
            plan: updatedUser.subscription?.plan,
            trialStart: updatedUser.subscription?.trialStart,
            trialEnd: updatedUser.subscription?.trialEnd,
            currentPeriodStart: updatedUser.subscription?.currentPeriodStart,
            currentPeriodEnd: updatedUser.subscription?.currentPeriodEnd,
            cancelAtPeriodEnd: updatedUser.subscription?.cancelAtPeriodEnd,
            canceledAt: updatedUser.subscription?.canceledAt,
            cancellationReason: updatedUser.subscription?.cancellationReason,
            cancellationFeedback:
              updatedUser.subscription?.cancellationFeedback,
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      if (!user.subscription?.stripeSubscriptionId) {
        return res.status(404).json({
          success: false,
          message: "No subscription found",
        });
      }

      const { immediately = false, reason, feedback } = req.body;

      // Cancel subscription in Stripe
      const canceledSubscription = await StripeService.cancelSubscription(
        user.subscription.stripeSubscriptionId,
        immediately
      );

      // Completely remove all subscription data and mark as ineligible for future trials
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        {
          // Remove all subscription data
          "subscription.stripeCustomerId": null,
          "subscription.stripeSubscriptionId": null,
          "subscription.status": null,
          "subscription.plan": null,
          "subscription.trialStart": null,
          "subscription.trialEnd": null,
          "subscription.currentPeriodStart": null,
          "subscription.currentPeriodEnd": null,
          "subscription.cancelAtPeriodEnd": true,
          "subscription.canceledAt": immediately ? new Date() : null,
          "subscription.cancellationReason": reason,
          "subscription.cancellationFeedback": feedback,
          // Mark user as ineligible for future trials
          trialEligible: false,
          hasCanceledSubscription: true,
        },
        { new: true }
      );

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.json({
        success: true,
        message: immediately
          ? "Subscription canceled and all data removed"
          : "Subscription will be canceled and all data removed at period end",
        data: {
          subscription: {
            stripeCustomerId: updatedUser.subscription?.stripeCustomerId,
            stripeSubscriptionId:
              updatedUser.subscription?.stripeSubscriptionId,
            status: updatedUser.subscription?.status,
            plan: updatedUser.subscription?.plan,
            trialStart: updatedUser.subscription?.trialStart,
            trialEnd: updatedUser.subscription?.trialEnd,
            currentPeriodStart: updatedUser.subscription?.currentPeriodStart,
            currentPeriodEnd: updatedUser.subscription?.currentPeriodEnd,
            cancelAtPeriodEnd: updatedUser.subscription?.cancelAtPeriodEnd,
            canceledAt: updatedUser.subscription?.canceledAt,
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Reactivate subscription
   */
  static async reactivateSubscription(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      if (!user.subscription?.stripeSubscriptionId) {
        return res.status(404).json({
          success: false,
          message: "No subscription found",
        });
      }

      // Reactivate subscription in Stripe
      const reactivatedSubscription =
        await StripeService.reactivateSubscription(
          user.subscription.stripeSubscriptionId
        );

      // Update user subscription
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        {
          "subscription.status": StripeService.mapSubscriptionStatus(
            reactivatedSubscription.status
          ),
          "subscription.cancelAtPeriodEnd": false,
          "subscription.canceledAt": null,
        },
        { new: true }
      );

      res.json({
        success: true,
        message: "Subscription reactivated successfully",
        data: {
          subscription: {
            id: reactivatedSubscription.id,
            status: reactivatedSubscription.status,
            cancelAtPeriodEnd: false,
            canceledAt: null,
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Direct upgrade subscription with payment
   */
  static async upgradeSubscriptionDirect(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const { paymentMethodId, plan = "pro" } = req.body;

      // Always create new Stripe customer (no conditions)
      const customer = await StripeService.createCustomer({
        email: user.email,
        name: user.fullName,
      });
      const customerId = customer.id;

      // Attach payment method to customer
      await StripeService.attachPaymentMethod(paymentMethodId, customerId);

      // Get price ID for the plan
      const priceId = StripeService.getPriceIdFromPlan(plan as any);
      if (!priceId) {
        return res.status(400).json({
          success: false,
          message: "Invalid plan specified",
        });
      }

      // Always create new subscription (no conditions)
      const subscription = await StripeService.createSubscription({
        customerId,
        priceId,
        paymentMethodId,
        trialPeriodDays: 0, // No trial for direct upgrades
        immediatePayment: true, // Process payment immediately
      });

      // Check if subscription is incomplete (payment failed)
      if (subscription.status === "incomplete") {
        return res.status(400).json({
          success: false,
          message:
            "Payment failed. Please check your payment method and try again.",
        });
      }

      // Update user subscription in database with new data
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        {
          "subscription.stripeCustomerId": customerId,
          "subscription.stripeSubscriptionId": subscription.id,
          "subscription.status": StripeService.mapSubscriptionStatus(
            subscription.status
          ),
          "subscription.plan": plan,
          "subscription.trialStart": null,
          "subscription.trialEnd": null,
          "subscription.currentPeriodStart": new Date(
            subscription.current_period_start * 1000
          ),
          "subscription.currentPeriodEnd": new Date(
            subscription.current_period_end * 1000
          ),
          "subscription.cancelAtPeriodEnd": false,
          "subscription.canceledAt": null,
          "subscription.cancellationReason": null,
          "subscription.cancellationFeedback": null,
        },
        { new: true }
      );

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      return res.json({
        success: true,
        message: "Subscription created successfully",
        data: {
          subscription: {
            stripeCustomerId: updatedUser.subscription?.stripeCustomerId,
            stripeSubscriptionId:
              updatedUser.subscription?.stripeSubscriptionId,
            status: updatedUser.subscription?.status,
            plan: updatedUser.subscription?.plan,
            trialStart: updatedUser.subscription?.trialStart,
            trialEnd: updatedUser.subscription?.trialEnd,
            currentPeriodStart: updatedUser.subscription?.currentPeriodStart,
            currentPeriodEnd: updatedUser.subscription?.currentPeriodEnd,
            cancelAtPeriodEnd: updatedUser.subscription?.cancelAtPeriodEnd,
            canceledAt: updatedUser.subscription?.canceledAt,
            cancellationReason: updatedUser.subscription?.cancellationReason,
            cancellationFeedback:
              updatedUser.subscription?.cancellationFeedback,
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update subscription plan
   */
  static async updateSubscription(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      if (!user.subscription?.stripeSubscriptionId) {
        return res.status(404).json({
          success: false,
          message: "No subscription found",
        });
      }

      const { plan } = req.body;

      // Get new price ID
      const newPriceId = StripeService.getPriceIdFromPlan(plan);
      if (!newPriceId) {
        return res.status(400).json({
          success: false,
          message: "Invalid plan selected",
        });
      }

      // Update subscription in Stripe
      const updatedSubscription = await StripeService.updateSubscription(
        user.subscription.stripeSubscriptionId,
        newPriceId
      );

      // Update user subscription
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        {
          "subscription.plan": plan,
          "subscription.currentPeriodStart": new Date(
            updatedSubscription.current_period_start * 1000
          ),
          "subscription.currentPeriodEnd": new Date(
            updatedSubscription.current_period_end * 1000
          ),
        },
        { new: true }
      );

      res.json({
        success: true,
        message: "Subscription updated successfully",
        data: {
          subscription: {
            id: updatedSubscription.id,
            plan: plan,
            currentPeriodStart: new Date(
              updatedSubscription.current_period_start * 1000
            ),
            currentPeriodEnd: new Date(
              updatedSubscription.current_period_end * 1000
            ),
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Create setup intent for payment method
   */
  static async createSetupIntent(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      let customerId = user.subscription?.stripeCustomerId;

      // Create Stripe customer if doesn't exist
      if (!customerId) {
        const customer = await StripeService.createCustomer(user);
        customerId = customer.id;

        // Update user with customer ID
        await User.findByIdAndUpdate(user._id, {
          "subscription.stripeCustomerId": customerId,
        });
      }

      // Create setup intent
      const setupIntent = await StripeService.createSetupIntent(customerId);

      res.json({
        success: true,
        message: "Setup intent created successfully",
        data: {
          clientSecret: setupIntent.client_secret,
          customerId: customerId,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Create a trial subscription for new users
   */
  static async createTrialSubscription(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      // Check if user already has a subscription
      if (user.subscription?.stripeSubscriptionId) {
        return res.status(400).json({
          success: false,
          message: "User already has a subscription",
        });
      }

      // Check if user is eligible for trials
      if (!user.trialEligible || user.hasCanceledSubscription) {
        return res.status(400).json({
          success: false,
          message:
            "You are not eligible for a free trial. Please subscribe directly.",
        });
      }

      const { paymentMethodId, plan = "pro" } = req.body;

      // Create Stripe customer if not exists
      let customerId = user.subscription?.stripeCustomerId;
      if (!customerId) {
        const customer = await StripeService.createCustomer({
          email: user.email,
          name: user.fullName,
        });
        customerId = customer.id;
      }

      // Attach payment method to customer if provided
      if (paymentMethodId) {
        await StripeService.attachPaymentMethod(paymentMethodId, customerId);

        // Set as default payment method
        await StripeService.stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });
      }

      // Create Stripe subscription with trial
      let priceId: string;
      try {
        priceId = StripeService.getPriceIdFromPlan(plan as any);
      } catch (error) {
        console.error("Price ID configuration error:", error);
        return res.status(500).json({
          success: false,
          message:
            "Subscription service configuration error. Please contact support.",
        });
      }

      const subscription = await StripeService.createSubscription({
        customerId,
        priceId,
        paymentMethodId,
        trialPeriodDays: 7,
      });

      // Update user with trial subscription info
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        {
          "subscription.stripeCustomerId": customerId,
          "subscription.stripeSubscriptionId": subscription.id,
          "subscription.status": subscription.status,
          "subscription.plan": plan,
          "subscription.trialStart": new Date(),
          "subscription.trialEnd": subscription.trial_end
            ? new Date(subscription.trial_end * 1000)
            : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          "subscription.currentPeriodStart": new Date(
            subscription.current_period_start * 1000
          ),
          "subscription.currentPeriodEnd": new Date(
            subscription.current_period_end * 1000
          ),
        },
        { new: true }
      );

      // Send trial start email
      try {
        const trialEndDate = subscription.trial_end
          ? new Date(subscription.trial_end * 1000)
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await EmailService.sendTrialStartEmail(updatedUser!, trialEndDate);
      } catch (emailError) {
        console.error("Failed to send trial start email:", emailError);
        // Don't fail the subscription creation if email fails
      }

      res.status(201).json({
        success: true,
        message: "Trial subscription created successfully",
        data: {
          subscription: {
            stripeCustomerId: updatedUser!.subscription?.stripeCustomerId,
            stripeSubscriptionId:
              updatedUser!.subscription?.stripeSubscriptionId,
            status: updatedUser!.subscription?.status,
            plan: updatedUser!.subscription?.plan,
            trialStart: updatedUser!.subscription?.trialStart,
            trialEnd: updatedUser!.subscription?.trialEnd,
            currentPeriodStart: updatedUser!.subscription?.currentPeriodStart,
            currentPeriodEnd: updatedUser!.subscription?.currentPeriodEnd,
            cancelAtPeriodEnd: updatedUser!.subscription?.cancelAtPeriodEnd,
            canceledAt: updatedUser!.subscription?.canceledAt,
            cancellationReason: updatedUser!.subscription?.cancellationReason,
            cancellationFeedback:
              updatedUser!.subscription?.cancellationFeedback,
          },
          user: {
            id: updatedUser!._id,
            email: updatedUser!.email,
            firstName: updatedUser!.firstName,
            lastName: updatedUser!.lastName,
            subscription: updatedUser!.subscription,
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Upgrade trial subscription to paid subscription
   */
  static async upgradeTrialSubscription(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const { paymentMethodId, plan = "pro" } = req.body;

      // Check if user has a trial subscription
      if (user.subscription?.status !== "trialing") {
        return res.status(400).json({
          success: false,
          message: "User must have an active trial to upgrade",
        });
      }

      // Create Stripe customer if not exists
      let customerId = user.subscription?.stripeCustomerId;
      if (!customerId) {
        const customer = await StripeService.createCustomer({
          email: user.email,
          name: user.fullName,
        });
        customerId = customer.id;
      }

      // Attach payment method to customer
      await StripeService.attachPaymentMethod(paymentMethodId, customerId);

      // Create Stripe subscription
      const priceId = StripeService.getPriceIdFromPlan(plan as any);
      if (!priceId) {
        return res.status(400).json({
          success: false,
          message: "Invalid plan specified",
        });
      }

      const subscription = await StripeService.createSubscription({
        customerId,
        priceId,
        paymentMethodId,
        trialPeriodDays: 0, // No trial since they already had one
        immediatePayment: true, // Process payment immediately
      });

      // Update user subscription in database
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        {
          "subscription.stripeCustomerId": customerId,
          "subscription.stripeSubscriptionId": subscription.id,
          "subscription.status": subscription.status,
          "subscription.plan": plan,
          "subscription.currentPeriodStart": new Date(
            subscription.current_period_start * 1000
          ),
          "subscription.currentPeriodEnd": new Date(
            subscription.current_period_end * 1000
          ),
          "subscription.cancelAtPeriodEnd": false,
        },
        { new: true }
      );

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Send trial success email
      try {
        const subscriptionEndDate = new Date(
          subscription.current_period_end * 1000
        );
        await EmailService.sendTrialSuccessEmail(
          updatedUser,
          subscriptionEndDate
        );
      } catch (emailError) {
        console.error("Failed to send trial success email:", emailError);
        // Don't fail the subscription upgrade if email fails
      }

      res.status(200).json({
        success: true,
        message: "Subscription upgraded successfully",
        data: {
          subscription: {
            stripeCustomerId: updatedUser.subscription?.stripeCustomerId,
            stripeSubscriptionId:
              updatedUser.subscription?.stripeSubscriptionId,
            status: updatedUser.subscription?.status,
            plan: updatedUser.subscription?.plan,
            trialStart: updatedUser.subscription?.trialStart,
            trialEnd: updatedUser.subscription?.trialEnd,
            currentPeriodStart: updatedUser.subscription?.currentPeriodStart,
            currentPeriodEnd: updatedUser.subscription?.currentPeriodEnd,
            cancelAtPeriodEnd: updatedUser.subscription?.cancelAtPeriodEnd,
            canceledAt: updatedUser.subscription?.canceledAt,
            cancellationReason: updatedUser.subscription?.cancellationReason,
            cancellationFeedback:
              updatedUser.subscription?.cancellationFeedback,
          },
          user: {
            id: updatedUser._id,
            email: updatedUser.email,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            subscription: updatedUser.subscription,
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Upgrade trial subscription immediately without payment method (for users who already have payment method)
   */
  static async upgradeTrialImmediate(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const { plan = "pro" } = req.body;

      // Check if user has a trial subscription
      if (user.subscription?.status !== "trialing") {
        return res.status(400).json({
          success: false,
          message: "User must have an active trial to upgrade",
        });
      }

      // Check if user has a Stripe customer ID
      if (!user.subscription?.stripeCustomerId) {
        return res.status(400).json({
          success: false,
          message:
            "No payment method found. Please add a payment method first.",
        });
      }

      // Get the existing Stripe subscription
      const existingSubscription =
        await StripeService.stripe.subscriptions.retrieve(
          user.subscription.stripeSubscriptionId!
        );

      // Get price ID for the plan
      const priceId = StripeService.getPriceIdFromPlan(plan as any);
      if (!priceId) {
        return res.status(400).json({
          success: false,
          message: "Invalid plan specified",
        });
      }

      // Update the existing subscription to remove trial and start billing immediately
      const updatedSubscription =
        await StripeService.stripe.subscriptions.update(
          user.subscription.stripeSubscriptionId!,
          {
            items: [
              {
                id: existingSubscription.items.data[0].id,
                price: priceId,
              },
            ],
            trial_end: "now", // End trial immediately
            proration_behavior: "create_prorations", // Prorate the billing
          }
        );

      // Update user subscription in database
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        {
          "subscription.status": StripeService.mapSubscriptionStatus(
            updatedSubscription.status
          ),
          "subscription.plan": StripeService.getPlanFromPriceId(priceId),
          "subscription.trialStart": undefined,
          "subscription.trialEnd": undefined,
          "subscription.currentPeriodStart": new Date(
            updatedSubscription.current_period_start * 1000
          ),
          "subscription.currentPeriodEnd": new Date(
            updatedSubscription.current_period_end * 1000
          ),
        },
        { new: true }
      );

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.status(200).json({
        success: true,
        message: "Trial subscription upgraded successfully",
        data: {
          subscription: {
            stripeCustomerId: updatedUser.subscription?.stripeCustomerId,
            stripeSubscriptionId:
              updatedUser.subscription?.stripeSubscriptionId,
            status: updatedUser.subscription?.status,
            plan: updatedUser.subscription?.plan,
            trialStart: updatedUser.subscription?.trialStart,
            trialEnd: updatedUser.subscription?.trialEnd,
            currentPeriodStart: updatedUser.subscription?.currentPeriodStart,
            currentPeriodEnd: updatedUser.subscription?.currentPeriodEnd,
            cancelAtPeriodEnd: updatedUser.subscription?.cancelAtPeriodEnd,
            canceledAt: updatedUser.subscription?.canceledAt,
            cancellationReason: updatedUser.subscription?.cancellationReason,
            cancellationFeedback:
              updatedUser.subscription?.cancellationFeedback,
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  }
}
