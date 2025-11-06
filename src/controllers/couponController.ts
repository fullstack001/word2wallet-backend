import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import { Coupon, ICoupon } from "../models/Coupon";
import { StripeService } from "../services/stripeService";
import { AuthRequest } from "../types";
import { CustomError } from "../middleware/errorHandler";

export class CouponController {
  /**
   * Create a new coupon
   * Creates coupon in Stripe first, then saves to database
   */
  static async createCoupon(
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

      const {
        code,
        name,
        description,
        discountType,
        discountValue,
        currency,
        duration,
        durationInMonths,
        maxRedemptions,
        redeemBy,
        appliesTo,
        metadata,
      } = req.body;

      // Check if coupon code already exists in database
      const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
      if (existingCoupon) {
        return res.status(400).json({
          success: false,
          message: "Coupon code already exists",
        });
      }

      // Prepare Stripe coupon parameters
      const stripeCouponParams: any = {
        id: code.toUpperCase(),
        name,
        duration,
      };

      if (discountType === "percentage") {
        stripeCouponParams.percentOff = discountValue;
      } else {
        stripeCouponParams.amountOff = Math.round(discountValue * 100); // Convert to cents
        stripeCouponParams.currency = currency || "usd";
      }

      if (duration === "repeating" && durationInMonths) {
        stripeCouponParams.durationInMonths = durationInMonths;
      }

      if (maxRedemptions) {
        stripeCouponParams.maxRedemptions = maxRedemptions;
      }

      if (redeemBy) {
        stripeCouponParams.redeemBy = Math.floor(
          new Date(redeemBy).getTime() / 1000
        );
      }

      if (metadata) {
        stripeCouponParams.metadata = metadata;
      }

      // Create coupon in Stripe first
      let stripeCoupon;
      try {
        stripeCoupon = await StripeService.createCoupon(stripeCouponParams);
      } catch (stripeError: any) {
        return res.status(400).json({
          success: false,
          message: `Failed to create coupon in Stripe: ${stripeError.message}`,
        });
      }

      // Save coupon to database
      const coupon = new Coupon({
        code: code.toUpperCase(),
        name,
        description,
        stripeCouponId: stripeCoupon.id,
        discountType,
        discountValue,
        currency:
          discountType === "fixed_amount" ? currency || "usd" : undefined,
        duration,
        durationInMonths:
          duration === "repeating" ? durationInMonths : undefined,
        maxRedemptions,
        redeemBy: redeemBy ? new Date(redeemBy) : undefined,
        appliesTo,
        metadata,
        createdBy: req.user!._id,
        valid: true,
      });

      await coupon.save();

      return res.status(201).json({
        success: true,
        message: "Coupon created successfully",
        data: coupon,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get all coupons
   */
  static async getCoupons(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page = 1, limit = 10, valid, search } = req.query;

      // Build query
      const query: any = {};
      if (valid !== undefined) {
        query.valid = valid === "true";
      }
      if (search) {
        query.$or = [
          { code: { $regex: search, $options: "i" } },
          { name: { $regex: search, $options: "i" } },
        ];
      }

      // Calculate pagination
      const skip = (parseInt(page.toString()) - 1) * parseInt(limit.toString());

      const coupons = await Coupon.find(query)
        .populate("createdBy", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit.toString()));

      const total = await Coupon.countDocuments(query);

      return res.json({
        success: true,
        message: "Coupons retrieved successfully",
        data: coupons,
        pagination: {
          page: parseInt(page.toString()),
          limit: parseInt(limit.toString()),
          total,
          pages: Math.ceil(total / parseInt(limit.toString())),
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get coupon by ID
   */
  static async getCouponById(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params;

      const coupon = await Coupon.findById(id).populate(
        "createdBy",
        "firstName lastName email"
      );

      if (!coupon) {
        return res.status(404).json({
          success: false,
          message: "Coupon not found",
        });
      }

      return res.json({
        success: true,
        message: "Coupon retrieved successfully",
        data: coupon,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update coupon
   * Note: Stripe doesn't allow updating coupons, so we only update database
   */
  static async updateCoupon(
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

      const { id } = req.params;
      const { name, description, valid, appliesTo, metadata } = req.body;

      const coupon = await Coupon.findById(id);
      if (!coupon) {
        return res.status(404).json({
          success: false,
          message: "Coupon not found",
        });
      }

      // Update only allowed fields (Stripe doesn't allow updating coupons)
      if (name !== undefined) coupon.name = name;
      if (description !== undefined) coupon.description = description;
      if (valid !== undefined) coupon.valid = valid;
      if (appliesTo !== undefined) coupon.appliesTo = appliesTo;
      if (metadata !== undefined) coupon.metadata = metadata;

      await coupon.save();

      return res.json({
        success: true,
        message: "Coupon updated successfully",
        data: coupon,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Delete coupon
   * Deletes from Stripe first, then from database
   */
  static async deleteCoupon(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params;

      const coupon = await Coupon.findById(id);
      if (!coupon) {
        return res.status(404).json({
          success: false,
          message: "Coupon not found",
        });
      }

      // Delete from Stripe first
      try {
        await StripeService.deleteCoupon(coupon.stripeCouponId);
      } catch (stripeError: any) {
        // If coupon doesn't exist in Stripe, continue with database deletion
        if (stripeError.code !== "resource_missing") {
          return res.status(400).json({
            success: false,
            message: `Failed to delete coupon from Stripe: ${stripeError.message}`,
          });
        }
      }

      // Delete from database
      await Coupon.findByIdAndDelete(id);

      return res.json({
        success: true,
        message: "Coupon deleted successfully",
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Toggle coupon validity
   */
  static async toggleCouponValidity(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params;

      const coupon = await Coupon.findById(id);
      if (!coupon) {
        return res.status(404).json({
          success: false,
          message: "Coupon not found",
        });
      }

      coupon.valid = !coupon.valid;
      await coupon.save();

      return res.json({
        success: true,
        message: `Coupon ${
          coupon.valid ? "activated" : "deactivated"
        } successfully`,
        data: coupon,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Validate coupon code
   */
  static async validateCoupon(req: Request, res: Response, next: NextFunction) {
    try {
      const { code } = req.query;

      if (!code || typeof code !== "string") {
        return res.status(400).json({
          success: false,
          message: "Coupon code is required",
        });
      }

      const coupon = await Coupon.findOne({
        code: code.toUpperCase(),
        valid: true,
      });

      if (!coupon) {
        return res.status(404).json({
          success: false,
          message: "Invalid or expired coupon code",
        });
      }

      // Check if coupon has expired
      if (coupon.redeemBy && new Date(coupon.redeemBy) < new Date()) {
        return res.status(400).json({
          success: false,
          message: "Coupon has expired",
        });
      }

      // Check max redemptions (if we were tracking this, but for now we'll just return the coupon)
      return res.json({
        success: true,
        message: "Coupon is valid",
        data: {
          code: coupon.code,
          name: coupon.name,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          currency: coupon.currency,
          duration: coupon.duration,
          durationInMonths: coupon.durationInMonths,
          stripeCouponId: coupon.stripeCouponId,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
}
