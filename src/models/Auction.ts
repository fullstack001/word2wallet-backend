import mongoose, { Schema } from "mongoose";
import { IAuction, AuctionStatus } from "../types";

const auctionSchema = new Schema<IAuction>(
  {
    title: {
      type: String,
      required: [true, "Auction title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Auction description is required"],
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    currency: {
      type: String,
      required: [true, "Currency is required"],
      default: "USD",
      uppercase: true,
      enum: ["USD", "EUR", "GBP", "CAD", "AUD"],
    },
    startingPrice: {
      type: Number,
      required: [true, "Starting price is required"],
      min: [0, "Starting price cannot be negative"],
    },
    reservePrice: {
      type: Number,
      min: [0, "Reserve price cannot be negative"],
    },
    buyNowPrice: {
      type: Number,
      min: [0, "Buy now price cannot be negative"],
    },
    currentBid: {
      type: Number,
      default: 0,
      min: [0, "Current bid cannot be negative"],
    },
    highBidder: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: Object.values(AuctionStatus),
      default: AuctionStatus.SCHEDULED,
    },
    startTime: {
      type: Date,
      required: [true, "Start time is required"],
    },
    endTime: {
      type: Date,
      required: [true, "End time is required"],
    },
    extendSeconds: {
      type: Number,
      default: 30,
      min: [0, "Extension seconds cannot be negative"],
      max: [300, "Extension seconds cannot exceed 300"],
    },
    minIncrement: {
      type: Number,
      default: 1,
      min: [0.01, "Minimum increment must be at least 0.01"],
    },
    bids: [
      {
        type: Schema.Types.ObjectId,
        ref: "Bid",
      },
    ],
    offers: [
      {
        type: Schema.Types.ObjectId,
        ref: "Offer",
      },
    ],
    images: [
      {
        type: String, // Array of image URLs
        validate: {
          validator: function (url: string) {
            // Basic URL validation
            try {
              new URL(url);
              return true;
            } catch {
              return false;
            }
          },
          message: "Invalid image URL format",
        },
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator is required"],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for time remaining
auctionSchema.virtual("timeRemaining").get(function () {
  if (this.status !== AuctionStatus.ACTIVE) return 0;
  const now = new Date();
  const remaining = this.endTime.getTime() - now.getTime();
  return Math.max(0, Math.floor(remaining / 1000));
});

// Virtual for reserve met
auctionSchema.virtual("reserveMet").get(function () {
  if (!this.reservePrice) return true;
  return (this.currentBid || this.startingPrice) >= this.reservePrice;
});

// Virtual for online count (will be set by WebSocket server)
auctionSchema.virtual("onlineCount").get(function () {
  return 0; // This will be managed by the WebSocket server
});

// Indexes for better query performance
auctionSchema.index({ status: 1 });
auctionSchema.index({ startTime: 1 });
auctionSchema.index({ endTime: 1 });
auctionSchema.index({ createdBy: 1 });
auctionSchema.index({ highBidder: 1 });

// Compound index for active auctions
auctionSchema.index({ status: 1, endTime: 1 });

// Validation middleware
auctionSchema.pre("save", function (next) {
  // Ensure end time is after start time
  if (this.endTime <= this.startTime) {
    return next(new Error("End time must be after start time"));
  }

  // Ensure buy now price is higher than starting price
  if (this.buyNowPrice && this.buyNowPrice <= this.startingPrice) {
    return next(new Error("Buy now price must be higher than starting price"));
  }

  // Ensure reserve price is not higher than buy now price
  if (
    this.reservePrice &&
    this.buyNowPrice &&
    this.reservePrice > this.buyNowPrice
  ) {
    return next(new Error("Reserve price cannot be higher than buy now price"));
  }

  next();
});

// Static method to find active auctions
auctionSchema.statics.findActive = function () {
  return this.find({
    status: AuctionStatus.ACTIVE,
    endTime: { $gt: new Date() },
  }).populate("highBidder", "firstName lastName email");
};

// Static method to find auctions ending soon
auctionSchema.statics.findEndingSoon = function (minutes = 5) {
  const now = new Date();
  const endThreshold = new Date(now.getTime() + minutes * 60 * 1000);

  return this.find({
    status: AuctionStatus.ACTIVE,
    endTime: { $gt: now, $lte: endThreshold },
  });
};

// Instance method to check if auction can accept bids
auctionSchema.methods.canAcceptBids = function () {
  const now = new Date();
  return (
    this.status === AuctionStatus.ACTIVE &&
    now >= this.startTime &&
    now <= this.endTime
  );
};

// Instance method to extend auction end time (anti-sniping)
auctionSchema.methods.extendEndTime = function () {
  if (this.extendSeconds > 0) {
    this.endTime = new Date(this.endTime.getTime() + this.extendSeconds * 1000);
  }
  return this.save();
};

// Instance method to get auction snapshot for API
auctionSchema.methods.getSnapshot = function () {
  return {
    id: this._id,
    title: this.title,
    currency: this.currency,
    highBid: this.currentBid || this.startingPrice,
    leader: this.highBidder
      ? {
          id: this.highBidder._id,
          name: `${this.highBidder.firstName} ${this.highBidder.lastName}`,
        }
      : null,
    online: this.onlineCount || 0,
    start: this.startTime,
    end: this.endTime,
    reserveMet: this.reserveMet,
    status: this.status,
    buyNowPrice: this.buyNowPrice,
    timeRemaining: this.timeRemaining,
    images: this.images || [],
  };
};

export const Auction = mongoose.model<IAuction>("Auction", auctionSchema);
