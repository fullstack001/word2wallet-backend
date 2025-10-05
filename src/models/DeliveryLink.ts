import mongoose, { Schema } from "mongoose";

export interface IDeliveryLink {
  _id: string;
  bookId: string;
  userId: string; // Author who created the link
  title: string; // Custom title for the link
  description?: string; // Custom description
  slug: string; // Unique URL slug
  url?: string; // Virtual field for full URL
  isActive: boolean;
  settings: {
    requireEmail: boolean;
    allowAnonymous: boolean;
    maxDownloads?: number;
    expiryDate?: Date;
    password?: string; // Optional password protection
  };
  analytics: {
    totalViews: number;
    totalDownloads: number;
    uniqueVisitors: number;
    emailCaptures: number;
    lastAccessed?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const deliveryLinkSchema = new Schema<IDeliveryLink>(
  {
    bookId: {
      type: String,
      required: [true, "Book ID is required"],
      ref: "Book",
    },
    userId: {
      type: String,
      required: [true, "User ID is required"],
      ref: "User",
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[a-z0-9-]+$/,
        "Slug can only contain lowercase letters, numbers, and hyphens",
      ],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    settings: {
      requireEmail: {
        type: Boolean,
        default: false,
      },
      allowAnonymous: {
        type: Boolean,
        default: true,
      },
      maxDownloads: {
        type: Number,
        min: [1, "Max downloads must be at least 1"],
      },
      expiryDate: {
        type: Date,
      },
      password: {
        type: String,
        trim: true,
      },
    },
    analytics: {
      totalViews: {
        type: Number,
        default: 0,
        min: [0, "Total views cannot be negative"],
      },
      totalDownloads: {
        type: Number,
        default: 0,
        min: [0, "Total downloads cannot be negative"],
      },
      uniqueVisitors: {
        type: Number,
        default: 0,
        min: [0, "Unique visitors cannot be negative"],
      },
      emailCaptures: {
        type: Number,
        default: 0,
        min: [0, "Email captures cannot be negative"],
      },
      lastAccessed: {
        type: Date,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
deliveryLinkSchema.index({ userId: 1 });
deliveryLinkSchema.index({ bookId: 1 });
deliveryLinkSchema.index({ slug: 1 }, { unique: true });
deliveryLinkSchema.index({ isActive: 1 });
deliveryLinkSchema.index({ createdAt: -1 });

// Virtual for full URL
deliveryLinkSchema.virtual("url").get(function () {
  return `${
    process.env.FRONTEND_URL || "http://localhost:3000"
  }/book/${this.slug}`;
});

export const DeliveryLink = mongoose.model<IDeliveryLink>(
  "DeliveryLink",
  deliveryLinkSchema
);
