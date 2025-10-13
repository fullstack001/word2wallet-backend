import mongoose, { Schema, Document } from "mongoose";

export interface IPaymentTransaction extends Document {
  _id: string;
  deliveryLinkId: string;
  bookId: string;
  userId: string; // Author who receives payment
  customerEmail: string;
  customerName?: string;
  amount: number;
  currency: string;
  paymentProvider: "paypal" | "stripe" | "manual";
  paymentStatus: "pending" | "completed" | "failed" | "refunded";
  transactionId?: string; // External payment ID from PayPal/Stripe
  accessToken: string; // One-time token for book access
  accessTokenUsed: boolean;
  accessTokenExpiresAt: Date;
  downloadCount: number;
  maxDownloads: number;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    referrer?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const paymentTransactionSchema = new Schema<IPaymentTransaction>(
  {
    deliveryLinkId: {
      type: String,
      required: [true, "Delivery link ID is required"],
      ref: "DeliveryLink",
      index: true,
    },
    bookId: {
      type: String,
      required: [true, "Book ID is required"],
      ref: "Book",
      index: true,
    },
    userId: {
      type: String,
      required: [true, "User ID is required"],
      ref: "User",
      index: true,
    },
    customerEmail: {
      type: String,
      required: [true, "Customer email is required"],
      trim: true,
      lowercase: true,
      index: true,
    },
    customerName: {
      type: String,
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    currency: {
      type: String,
      required: [true, "Currency is required"],
      uppercase: true,
      default: "USD",
    },
    paymentProvider: {
      type: String,
      required: [true, "Payment provider is required"],
      enum: ["paypal", "stripe", "manual"],
    },
    paymentStatus: {
      type: String,
      required: [true, "Payment status is required"],
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
      index: true,
    },
    transactionId: {
      type: String,
      trim: true,
      index: true,
    },
    accessToken: {
      type: String,
      required: [true, "Access token is required"],
      unique: true,
      index: true,
    },
    accessTokenUsed: {
      type: Boolean,
      default: false,
    },
    accessTokenExpiresAt: {
      type: Date,
      required: [true, "Access token expiration is required"],
      index: true,
    },
    downloadCount: {
      type: Number,
      default: 0,
      min: [0, "Download count cannot be negative"],
    },
    maxDownloads: {
      type: Number,
      default: 3,
      min: [1, "Max downloads must be at least 1"],
    },
    metadata: {
      ipAddress: String,
      userAgent: String,
      referrer: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
paymentTransactionSchema.index({ createdAt: -1 });
paymentTransactionSchema.index({ customerEmail: 1, deliveryLinkId: 1 });

export const PaymentTransaction = mongoose.model<IPaymentTransaction>(
  "PaymentTransaction",
  paymentTransactionSchema
);
