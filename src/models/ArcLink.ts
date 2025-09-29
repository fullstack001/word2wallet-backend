import mongoose, { Schema } from "mongoose";

export interface IArcLink {
  _id: string;
  bookId: string;
  userId: string;
  code: string;
  url: string;
  campaignId?: string; // BookFunnel campaign ID
  expiresAt?: Date;
  maxDownloads?: number;
  downloadsCount: number;
  status: ArcLinkStatus;
  metadata: {
    title: string;
    author: string;
    format: string;
    description?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export enum ArcLinkStatus {
  ACTIVE = "active",
  EXPIRED = "expired",
  MAX_DOWNLOADS_REACHED = "max_downloads_reached",
  DISABLED = "disabled",
  ERROR = "error",
}

const arcLinkSchema = new Schema<IArcLink>(
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
    code: {
      type: String,
      required: [true, "Code is required"],
      unique: true,
      trim: true,
    },
    url: {
      type: String,
      required: [true, "URL is required"],
      trim: true,
    },
    campaignId: {
      type: String,
      trim: true,
    },
    expiresAt: {
      type: Date,
    },
    maxDownloads: {
      type: Number,
      min: [1, "Max downloads must be greater than 0"],
    },
    downloadsCount: {
      type: Number,
      default: 0,
      min: [0, "Downloads count cannot be negative"],
    },
    status: {
      type: String,
      enum: Object.values(ArcLinkStatus),
      default: ArcLinkStatus.ACTIVE,
    },
    metadata: {
      title: { type: String, required: true },
      author: { type: String, required: true },
      format: { type: String, required: true },
      description: { type: String },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
arcLinkSchema.index({ bookId: 1 });
arcLinkSchema.index({ userId: 1 });
arcLinkSchema.index({ code: 1 }, { unique: true });
arcLinkSchema.index({ status: 1 });
arcLinkSchema.index({ expiresAt: 1 });
arcLinkSchema.index({ createdAt: -1 });

// Virtual to check if link is expired
arcLinkSchema.virtual("isExpired").get(function () {
  return this.expiresAt && this.expiresAt < new Date();
});

// Virtual to check if max downloads reached
arcLinkSchema.virtual("isMaxDownloadsReached").get(function () {
  return this.maxDownloads && this.downloadsCount >= this.maxDownloads;
});

// Virtual to check if link is accessible
arcLinkSchema.virtual("isAccessible").get(function () {
  return (
    this.status === ArcLinkStatus.ACTIVE &&
    !(this as any).isExpired &&
    !(this as any).isMaxDownloadsReached
  );
});

// Method to increment download count
arcLinkSchema.methods.incrementDownload = function () {
  this.downloadsCount += 1;

  // Check if max downloads reached
  if (this.maxDownloads && this.downloadsCount >= this.maxDownloads) {
    this.status = ArcLinkStatus.MAX_DOWNLOADS_REACHED;
  }

  return this.save();
};

// Method to check and update status based on expiration
arcLinkSchema.methods.checkStatus = function () {
  if (this.isExpired && this.status === ArcLinkStatus.ACTIVE) {
    this.status = ArcLinkStatus.EXPIRED;
    return this.save();
  }
  return Promise.resolve(this);
};

// Static method to generate unique code
arcLinkSchema.statics.generateUniqueCode = async function (): Promise<string> {
  const generateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  let code: string;
  let isUnique = false;

  while (!isUnique) {
    code = generateCode();
    const existing = await this.findOne({ code });
    if (!existing) {
      isUnique = true;
    }
  }

  return code!;
};

// Static method to find active links for a book
arcLinkSchema.statics.findActiveByBook = function (bookId: string) {
  return this.find({
    bookId,
    status: ArcLinkStatus.ACTIVE,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } },
    ],
  });
};

export const ArcLink = mongoose.model<IArcLink>("ArcLink", arcLinkSchema);
