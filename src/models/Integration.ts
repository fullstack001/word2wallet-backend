import mongoose, { Schema } from "mongoose";

export interface IIntegration {
  _id: string;
  userId: string;
  provider: IntegrationProvider;
  apiKey: string; // Encrypted
  status: IntegrationStatus;
  settings?: {
    [key: string]: any;
  };
  lastSync?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum IntegrationProvider {
  BOOKFUNNEL = "bookfunnel",
  AMAZON_KDP = "amazon_kdp",
  DRAFT2DIGITAL = "draft2digital",
  SMASHWORDS = "smashwords",
}

export enum IntegrationStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  ERROR = "error",
  PENDING = "pending",
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
    apiKey: {
      type: String,
      required: [true, "API key is required"],
    },
    status: {
      type: String,
      enum: Object.values(IntegrationStatus),
      default: IntegrationStatus.PENDING,
    },
    settings: {
      type: Schema.Types.Mixed,
      default: {},
    },
    lastSync: {
      type: Date,
    },
    errorMessage: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
integrationSchema.index({ userId: 1, provider: 1 }, { unique: true });
integrationSchema.index({ status: 1 });
integrationSchema.index({ provider: 1 });

// Virtual for decrypted API key (only accessible in methods)
integrationSchema.virtual("decryptedApiKey").get(function () {
  // This would be implemented with actual decryption logic
  return this.apiKey;
});

// Method to update last sync
integrationSchema.methods.updateLastSync = function () {
  this.lastSync = new Date();
  return this.save();
};

// Method to set error
integrationSchema.methods.setError = function (errorMessage: string) {
  this.status = IntegrationStatus.ERROR;
  this.errorMessage = errorMessage;
  return this.save();
};

// Method to clear error
integrationSchema.methods.clearError = function () {
  this.status = IntegrationStatus.ACTIVE;
  this.errorMessage = undefined;
  return this.save();
};

// Static method to find active integration by provider
integrationSchema.statics.findActiveByProvider = function (
  userId: string,
  provider: IntegrationProvider
) {
  return this.findOne({ userId, provider, status: IntegrationStatus.ACTIVE });
};

export const Integration = mongoose.model<IIntegration>(
  "Integration",
  integrationSchema
);
