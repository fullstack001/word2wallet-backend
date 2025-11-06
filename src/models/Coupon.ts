import mongoose, { Schema, Document } from "mongoose";

export interface ICoupon extends Document {
  code: string;
  name: string;
  description?: string;
  stripeCouponId: string;
  discountType: "percentage" | "fixed_amount";
  discountValue: number; // Percentage (0-100) or amount in cents
  currency?: string; // For fixed_amount discounts
  duration: "once" | "repeating" | "forever";
  durationInMonths?: number; // For repeating duration
  maxRedemptions?: number;
  redeemBy?: Date;
  valid: boolean;
  appliesTo?: {
    products?: string[];
    plans?: string[];
  };
  metadata?: Record<string, string>;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const couponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      trim: true,
      uppercase: true,
      match: [
        /^[A-Z0-9_-]+$/,
        "Coupon code can only contain uppercase letters, numbers, underscores, and hyphens",
      ],
    },
    name: {
      type: String,
      required: [true, "Coupon name is required"],
      trim: true,
      maxlength: [100, "Coupon name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    stripeCouponId: {
      type: String,
      required: [true, "Stripe coupon ID is required"],
      unique: true,
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed_amount"],
      required: [true, "Discount type is required"],
    },
    discountValue: {
      type: Number,
      required: [true, "Discount value is required"],
      min: [0, "Discount value must be positive"],
      validate: {
        validator: function (this: ICoupon, value: number) {
          if (this.discountType === "percentage") {
            return value >= 0 && value <= 100;
          }
          return value > 0;
        },
        message: "Invalid discount value for the selected discount type",
      },
    },
    currency: {
      type: String,
      validate: {
        validator: function (this: ICoupon, value: string | undefined) {
          if (this.discountType === "fixed_amount") {
            return !!value && value.length === 3;
          }
          return true;
        },
        message: "Currency is required for fixed amount discounts",
      },
    },
    duration: {
      type: String,
      enum: ["once", "repeating", "forever"],
      required: [true, "Duration is required"],
    },
    durationInMonths: {
      type: Number,
      validate: {
        validator: function (this: ICoupon, value: number | undefined) {
          if (this.duration === "repeating") {
            return value !== undefined && value > 0 && value <= 12;
          }
          return true;
        },
        message:
          "Duration in months is required for repeating coupons and must be between 1 and 12",
      },
    },
    maxRedemptions: {
      type: Number,
      min: [1, "Max redemptions must be at least 1"],
    },
    redeemBy: {
      type: Date,
      validate: {
        validator: function (value: Date | undefined) {
          if (value) {
            return value > new Date();
          }
          return true;
        },
        message: "Redeem by date must be in the future",
      },
    },
    valid: {
      type: Boolean,
      default: true,
    },
    appliesTo: {
      products: [String],
      plans: [String],
    },
    metadata: {
      type: Map,
      of: String,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator is required"],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
couponSchema.index({ code: 1 });
couponSchema.index({ stripeCouponId: 1 });
couponSchema.index({ valid: 1 });
couponSchema.index({ createdAt: -1 });

export const Coupon = mongoose.model<ICoupon>("Coupon", couponSchema);
