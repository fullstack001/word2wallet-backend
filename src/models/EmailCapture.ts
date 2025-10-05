import mongoose, { Schema } from "mongoose";

export interface IEmailCapture {
  _id: string;
  bookId: string;
  userId: string; // Author who owns the book
  deliveryLinkId?: string; // Optional: specific delivery link
  landingPageId?: string; // Optional: specific landing page
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string; // Virtual field for full name
  bookTitle?: string; // Virtual field for book title
  source: string; // Where the email was captured (landing page, delivery link, etc.)
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    country?: string;
    city?: string;
    referrer?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
  };
  status: EmailCaptureStatus;
  tags: string[]; // For categorization
  notes?: string; // Author notes about this lead
  createdAt: Date;
  updatedAt: Date;
}

export enum EmailCaptureStatus {
  NEW = "new",
  CONTACTED = "contacted",
  CONVERTED = "converted",
  UNSUBSCRIBED = "unsubscribed",
  BOUNCED = "bounced",
}

const emailCaptureSchema = new Schema<IEmailCapture>(
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
    email: {
      type: String,
      required: [true, "Email is required"],
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email format"],
      lowercase: true,
      trim: true,
    },
    firstName: {
      type: String,
      trim: true,
      maxlength: [100, "First name cannot exceed 100 characters"],
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: [100, "Last name cannot exceed 100 characters"],
    },
    source: {
      type: String,
      required: [true, "Source is required"],
      trim: true,
      maxlength: [100, "Source cannot exceed 100 characters"],
    },
    metadata: {
      ipAddress: {
        type: String,
        match: [
          /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^[0-9a-fA-F:]+$/,
          "Invalid IP address format",
        ],
      },
      userAgent: {
        type: String,
        maxlength: [500, "User agent cannot exceed 500 characters"],
      },
      country: {
        type: String,
        maxlength: [100, "Country cannot exceed 100 characters"],
      },
      city: {
        type: String,
        maxlength: [100, "City cannot exceed 100 characters"],
      },
      referrer: {
        type: String,
        maxlength: [500, "Referrer cannot exceed 500 characters"],
      },
      utmSource: {
        type: String,
        trim: true,
        maxlength: [100, "UTM source cannot exceed 100 characters"],
      },
      utmMedium: {
        type: String,
        trim: true,
        maxlength: [100, "UTM medium cannot exceed 100 characters"],
      },
      utmCampaign: {
        type: String,
        trim: true,
        maxlength: [100, "UTM campaign cannot exceed 100 characters"],
      },
      utmTerm: {
        type: String,
        trim: true,
        maxlength: [100, "UTM term cannot exceed 100 characters"],
      },
      utmContent: {
        type: String,
        trim: true,
        maxlength: [100, "UTM content cannot exceed 100 characters"],
      },
    },
    status: {
      type: String,
      enum: Object.values(EmailCaptureStatus),
      default: EmailCaptureStatus.NEW,
    },
    tags: [
      {
        type: String,
        trim: true,
        maxlength: [50, "Tag cannot exceed 50 characters"],
      },
    ],
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
emailCaptureSchema.index({ userId: 1 });
emailCaptureSchema.index({ bookId: 1 });
emailCaptureSchema.index({ deliveryLinkId: 1 });
emailCaptureSchema.index({ landingPageId: 1 });
emailCaptureSchema.index({ email: 1 });
emailCaptureSchema.index({ status: 1 });
emailCaptureSchema.index({ createdAt: -1 });

// Compound indexes for common queries
emailCaptureSchema.index({ userId: 1, status: 1 });
emailCaptureSchema.index({ bookId: 1, status: 1 });
emailCaptureSchema.index({ email: 1, userId: 1 }, { unique: true }); // Prevent duplicate emails per user

// Virtual for full name
emailCaptureSchema.virtual("fullName").get(function () {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.firstName || this.lastName || "";
});

// Virtual for book title (will be populated from bookId)
emailCaptureSchema.virtual("bookTitle").get(function () {
  return (this.bookId as any)?.title || "Unknown Book";
});

export const EmailCapture = mongoose.model<IEmailCapture>(
  "EmailCapture",
  emailCaptureSchema
);
