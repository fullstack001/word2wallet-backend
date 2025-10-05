import mongoose, { Schema } from "mongoose";

export interface IBookAnalytics {
  _id: string;
  bookId: string;
  userId: string; // Author who owns the book
  deliveryLinkId?: string; // Optional: specific delivery link
  landingPageId?: string; // Optional: specific landing page
  eventType: AnalyticsEventType;
  eventData: {
    // Common fields
    timestamp: Date;
    userAgent?: string;
    ipAddress?: string;
    referrer?: string;
    country?: string;
    city?: string;
    device?: string;
    browser?: string;
    os?: string;

    // Event-specific data
    email?: string; // For email capture events
    downloadUrl?: string; // For download events
    streamDuration?: number; // For audio streaming events
    pageViews?: number; // For page view events
    conversionType?: string; // Type of conversion
  };
  createdAt: Date;
}

export enum AnalyticsEventType {
  PAGE_VIEW = "page_view",
  DOWNLOAD = "download",
  EMAIL_CAPTURE = "email_capture",
  STREAM_START = "stream_start",
  STREAM_COMPLETE = "stream_complete",
  LINK_CLICK = "link_click",
  CONVERSION = "conversion",
  BOUNCE = "bounce",
}

const bookAnalyticsSchema = new Schema<IBookAnalytics>(
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
    deliveryLinkId: {
      type: String,
      ref: "DeliveryLink",
    },
    landingPageId: {
      type: String,
      ref: "LandingPage",
    },
    eventType: {
      type: String,
      required: [true, "Event type is required"],
      enum: Object.values(AnalyticsEventType),
    },
    eventData: {
      timestamp: {
        type: Date,
        required: [true, "Timestamp is required"],
        default: Date.now,
      },
      userAgent: {
        type: String,
        maxlength: [500, "User agent cannot exceed 500 characters"],
      },
      ipAddress: {
        type: String,
        match: [
          /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^[0-9a-fA-F:]+$/,
          "Invalid IP address format",
        ],
      },
      referrer: {
        type: String,
        maxlength: [500, "Referrer cannot exceed 500 characters"],
      },
      country: {
        type: String,
        maxlength: [100, "Country cannot exceed 100 characters"],
      },
      city: {
        type: String,
        maxlength: [100, "City cannot exceed 100 characters"],
      },
      device: {
        type: String,
        enum: ["desktop", "mobile", "tablet", "unknown"],
        default: "unknown",
      },
      browser: {
        type: String,
        maxlength: [100, "Browser cannot exceed 100 characters"],
      },
      os: {
        type: String,
        maxlength: [100, "OS cannot exceed 100 characters"],
      },
      email: {
        type: String,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email format"],
      },
      downloadUrl: {
        type: String,
        maxlength: [500, "Download URL cannot exceed 500 characters"],
      },
      streamDuration: {
        type: Number,
        min: [0, "Stream duration cannot be negative"],
      },
      pageViews: {
        type: Number,
        min: [1, "Page views must be at least 1"],
      },
      conversionType: {
        type: String,
        maxlength: [100, "Conversion type cannot exceed 100 characters"],
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
bookAnalyticsSchema.index({ bookId: 1 });
bookAnalyticsSchema.index({ userId: 1 });
bookAnalyticsSchema.index({ deliveryLinkId: 1 });
bookAnalyticsSchema.index({ landingPageId: 1 });
bookAnalyticsSchema.index({ eventType: 1 });
bookAnalyticsSchema.index({ "eventData.timestamp": -1 });
bookAnalyticsSchema.index({ createdAt: -1 });

// Compound indexes for common queries
bookAnalyticsSchema.index({
  bookId: 1,
  eventType: 1,
  "eventData.timestamp": -1,
});
bookAnalyticsSchema.index({
  userId: 1,
  eventType: 1,
  "eventData.timestamp": -1,
});

export const BookAnalytics = mongoose.model<IBookAnalytics>(
  "BookAnalytics",
  bookAnalyticsSchema
);

