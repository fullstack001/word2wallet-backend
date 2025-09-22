import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import { User } from "../models/User";
import { StripeService } from "../services/stripeService";
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

      const { paymentMethodId, plan = "basic" } = req.body;

      // Check if user already has a subscription
      if (user.subscription?.stripeSubscriptionId) {
        return res.status(400).json({
          success: false,
          message: "User already has an active subscription",
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
      const subscription = await StripeService.createSubscription(
        customerId,
        priceId
      );

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

      res.status(201).json({
        success: true,
        message: "Subscription created successfully",
        data: {
          subscription: {
            id: subscription.id,
            status: subscription.status,
            trialEnd: subscription.trial_end,
            currentPeriodEnd: subscription.current_period_end,
            clientSecret: (subscription.latest_invoice as any)?.payment_intent
              ?.client_secret,
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

      res.json({
        success: true,
        message: "Subscription retrieved successfully",
        data: {
          subscription: {
            id: stripeSubscription.id,
            status: stripeSubscription.status,
            plan: user.subscription.plan,
            trialStart: user.subscription.trialStart,
            trialEnd: user.subscription.trialEnd,
            currentPeriodStart: new Date(
              stripeSubscription.current_period_start * 1000
            ),
            currentPeriodEnd: new Date(
              stripeSubscription.current_period_end * 1000
            ),
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
            canceledAt: user.subscription.canceledAt,
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

      const { immediately = false } = req.body;

      // Cancel subscription in Stripe
      const canceledSubscription = await StripeService.cancelSubscription(
        user.subscription.stripeSubscriptionId,
        immediately
      );

      // Update user subscription
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        {
          "subscription.status": StripeService.mapSubscriptionStatus(
            canceledSubscription.status
          ),
          "subscription.cancelAtPeriodEnd":
            canceledSubscription.cancel_at_period_end,
          "subscription.canceledAt": immediately
            ? new Date()
            : user.subscription.canceledAt,
        },
        { new: true }
      );

      res.json({
        success: true,
        message: immediately
          ? "Subscription canceled immediately"
          : "Subscription will be canceled at period end",
        data: {
          subscription: {
            id: canceledSubscription.id,
            status: canceledSubscription.status,
            cancelAtPeriodEnd: canceledSubscription.cancel_at_period_end,
            canceledAt: immediately ? new Date() : user.subscription.canceledAt,
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
}
