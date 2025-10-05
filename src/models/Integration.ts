import mongoose, { Schema } from "mongoose";
import { IntegrationProvider } from "../types";

export interface IIntegration {
  _id: string;
  userId: string;
  provider: IntegrationProvider;
  isActive: boolean;
  credentials: {
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    accountId?: string;
    listId?: string;
    webhookSecret?: string;
    [key: string]: any; // Allow for provider-specific credentials
  };
  settings: {
    autoSync: boolean;
    syncInterval: number; // in minutes
    defaultList?: string;
    defaultTags?: string[];
    [key: string]: any; // Allow for provider-specific settings
  };
  lastSyncAt?: Date;
  lastTestAt?: Date;
  testStatus?: "success" | "failed" | "pending";
  testError?: string;
  stats: {
    totalContacts: number;
    lastSyncContacts: number;
    syncErrors: number;
    lastSyncError?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const integrationSchema = new Schema<IIntegration>(
  {
    userId: {
      type: String,
      required: [true, "User ID is required"],
      ref: "User",
    },
    provider: {
      type: String,
      required: [true, "Provider is required"],
      enum: Object.values(IntegrationProvider),
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    credentials: {
      type: Schema.Types.Mixed,
      required: true,
    },
    settings: {
      autoSync: {
        type: Boolean,
        default: false,
      },
      syncInterval: {
        type: Number,
        default: 60, // 1 hour
        min: [5, "Sync interval must be at least 5 minutes"],
      },
      defaultList: {
        type: String,
      },
      defaultTags: [
        {
          type: String,
          trim: true,
        },
      ],
    },
    lastSyncAt: {
      type: Date,
    },
    lastTestAt: {
      type: Date,
    },
    testStatus: {
      type: String,
      enum: ["success", "failed", "pending"],
    },
    testError: {
      type: String,
    },
    stats: {
      totalContacts: {
        type: Number,
        default: 0,
        min: [0, "Total contacts cannot be negative"],
      },
      lastSyncContacts: {
        type: Number,
        default: 0,
        min: [0, "Last sync contacts cannot be negative"],
      },
      syncErrors: {
        type: Number,
        default: 0,
        min: [0, "Sync errors cannot be negative"],
      },
      lastSyncError: {
        type: String,
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
integrationSchema.index({ userId: 1 });
integrationSchema.index({ provider: 1 });
integrationSchema.index({ userId: 1, provider: 1 }, { unique: true });
integrationSchema.index({ isActive: 1 });
integrationSchema.index({ lastSyncAt: -1 });

export const Integration = mongoose.model<IIntegration>(
  "Integration",
  integrationSchema
);
