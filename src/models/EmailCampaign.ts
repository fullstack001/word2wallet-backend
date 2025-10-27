import mongoose, { Schema, Document } from "mongoose";

export interface ICampaignReceiver extends Document {
  _id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  customFields?: Record<string, any>;
  status: "pending" | "sent" | "failed" | "bounced" | "unsubscribed";
  sentAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  bouncedAt?: Date;
  unsubscribedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEmailCampaign extends Document {
  _id: string;
  userId: string; // Author who created the campaign
  name: string;
  subject: string;
  content: string; // HTML content
  status: "draft" | "scheduled" | "sending" | "sent" | "paused" | "failed";
  scheduledAt?: Date;
  sentAt?: Date;
  books: string[]; // Array of book IDs to attach
  selectedLink?: {
    linkId: string;
    linkUrl: string;
    linkType: "reader" | "landing_page" | "delivery_link";
  };
  receivers: ICampaignReceiver[];
  senderInfo: {
    name: string;
    email: string;
    company?: string;
  };
  settings: {
    trackOpens: boolean;
    trackClicks: boolean;
    unsubscribeLink: boolean;
    replyTo?: string;
  };
  analytics: {
    totalRecipients: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
    failed: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const receiverSchema = new Schema<ICampaignReceiver>(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      index: true,
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    customFields: {
      type: Map,
      of: Schema.Types.Mixed,
    },
    status: {
      type: String,
      enum: ["pending", "sent", "failed", "bounced", "unsubscribed"],
      default: "pending",
      index: true,
    },
    sentAt: {
      type: Date,
    },
    openedAt: {
      type: Date,
    },
    clickedAt: {
      type: Date,
    },
    bouncedAt: {
      type: Date,
    },
    unsubscribedAt: {
      type: Date,
    },
    errorMessage: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const emailCampaignSchema = new Schema<IEmailCampaign>(
  {
    userId: {
      type: String,
      required: [true, "User ID is required"],
      ref: "User",
      index: true,
    },
    name: {
      type: String,
      required: [true, "Campaign name is required"],
      trim: true,
      maxlength: [200, "Campaign name cannot exceed 200 characters"],
    },
    subject: {
      type: String,
      required: [true, "Email subject is required"],
      trim: true,
      maxlength: [300, "Email subject cannot exceed 300 characters"],
    },
    content: {
      type: String,
      required: [true, "Email content is required"],
    },
    status: {
      type: String,
      enum: ["draft", "scheduled", "sending", "sent", "paused", "failed"],
      default: "draft",
      index: true,
    },
    scheduledAt: {
      type: Date,
    },
    sentAt: {
      type: Date,
    },
    books: [
      {
        type: String,
        ref: "Book",
      },
    ],
    selectedLink: {
      linkId: {
        type: String,
      },
      linkUrl: {
        type: String,
      },
      linkType: {
        type: String,
        enum: ["reader", "landing_page", "delivery_link"],
      },
    },
    receivers: [receiverSchema],
    senderInfo: {
      name: {
        type: String,
        required: [true, "Sender name is required"],
        trim: true,
      },
      email: {
        type: String,
        required: [true, "Sender email is required"],
        trim: true,
        lowercase: true,
      },
      company: {
        type: String,
        trim: true,
      },
    },
    settings: {
      trackOpens: {
        type: Boolean,
        default: true,
      },
      trackClicks: {
        type: Boolean,
        default: true,
      },
      unsubscribeLink: {
        type: Boolean,
        default: true,
      },
      replyTo: {
        type: String,
        trim: true,
        lowercase: true,
      },
    },
    analytics: {
      totalRecipients: {
        type: Number,
        default: 0,
        min: [0, "Total recipients cannot be negative"],
      },
      sent: {
        type: Number,
        default: 0,
        min: [0, "Sent count cannot be negative"],
      },
      delivered: {
        type: Number,
        default: 0,
        min: [0, "Delivered count cannot be negative"],
      },
      opened: {
        type: Number,
        default: 0,
        min: [0, "Opened count cannot be negative"],
      },
      clicked: {
        type: Number,
        default: 0,
        min: [0, "Clicked count cannot be negative"],
      },
      bounced: {
        type: Number,
        default: 0,
        min: [0, "Bounced count cannot be negative"],
      },
      unsubscribed: {
        type: Number,
        default: 0,
        min: [0, "Unsubscribed count cannot be negative"],
      },
      failed: {
        type: Number,
        default: 0,
        min: [0, "Failed count cannot be negative"],
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
emailCampaignSchema.index({ userId: 1, createdAt: -1 });
emailCampaignSchema.index({ status: 1 });
emailCampaignSchema.index({ scheduledAt: 1 });

export const CampaignReceiver = mongoose.model<ICampaignReceiver>(
  "CampaignReceiver",
  receiverSchema
);
export const EmailCampaign = mongoose.model<IEmailCampaign>(
  "EmailCampaign",
  emailCampaignSchema
);
