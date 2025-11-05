import mongoose, { Schema } from "mongoose";
import { IBid, BidStatus } from "../types";

const bidSchema = new Schema<IBid>(
  {
    auction: {
      type: Schema.Types.ObjectId,
      ref: "Auction",
      required: [true, "Auction is required"],
    },
    bidder: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Bidder is required"],
    },
    amount: {
      type: Number,
      required: [true, "Bid amount is required"],
      min: [0.01, "Bid amount must be at least 0.01"],
    },
    status: {
      type: String,
      enum: Object.values(BidStatus),
      default: BidStatus.PENDING,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    ipAddress: {
      type: String,
      required: [true, "IP address is required"],
    },
    userAgent: {
      type: String,
      maxlength: [500, "User agent cannot exceed 500 characters"],
    },
    shippingInfo: {
      country: {
        type: String,
        trim: true,
      },
      street: {
        type: String,
        trim: true,
      },
      city: {
        type: String,
        trim: true,
      },
      state: {
        type: String,
        trim: true,
      },
      zipCode: {
        type: String,
        trim: true,
      },
      phone: {
        type: String,
        trim: true,
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
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
bidSchema.index({ auction: 1, timestamp: -1 });
bidSchema.index({ bidder: 1 });
bidSchema.index({ status: 1 });
bidSchema.index({ amount: -1 });

// Compound index for auction bidding history
bidSchema.index({ auction: 1, status: 1, amount: -1 });

// Validation middleware
bidSchema.pre("save", async function (next) {
  try {
    // Validate bid amount against auction rules
    if (this.isNew) {
      const Auction = mongoose.model("Auction");
      const auction = await Auction.findById(this.auction);

      if (!auction) {
        return next(new Error("Auction not found"));
      }

      // Check if auction can accept bids
      if (!auction.canAcceptBids()) {
        return next(new Error("Auction is not accepting bids"));
      }

      // Check minimum bid increment
      const currentHighBid = auction.currentBid || auction.startingPrice;
      const minimumBid = currentHighBid + auction.minIncrement;

      if (this.amount < minimumBid) {
        return next(
          new Error(`Bid must be at least ${minimumBid} ${auction.currency}`)
        );
      }

      // Check if bid exceeds buy now price (if set)
      if (auction.buyNowPrice && this.amount >= auction.buyNowPrice) {
        return next(
          new Error("Bid amount cannot exceed or equal buy now price")
        );
      }
    }

    next();
  } catch (error) {
    next(error as Error);
  }
});

// Post-save middleware to update auction
bidSchema.post("save", async function () {
  try {
    if (this.status === BidStatus.ACCEPTED) {
      const Auction = mongoose.model("Auction");
      const auction = await Auction.findById(this.auction);

      if (
        auction &&
        this.amount > (auction.currentBid || auction.startingPrice)
      ) {
        // Update auction with new high bid
        auction.currentBid = this.amount;
        auction.highBidder = this.bidder;
        auction.bids.push(this._id);

        // Extend auction end time if bid is placed in last few minutes (anti-sniping)
        const now = new Date();
        const timeToEnd = auction.endTime.getTime() - now.getTime();
        const extendThreshold = 60000; // 1 minute in milliseconds

        if (timeToEnd <= extendThreshold && auction.extendSeconds > 0) {
          auction.extendEndTime();
        } else {
          await auction.save();
        }

        // Mark previous high bid as outbid
        await mongoose.model("Bid").updateMany(
          {
            auction: this.auction,
            _id: { $ne: this._id },
            status: BidStatus.ACCEPTED,
          },
          { status: BidStatus.OUTBID }
        );
      }
    }
  } catch (error) {
    console.error("Error updating auction after bid:", error);
  }
});

// Static method to get auction bidding history
bidSchema.statics.getAuctionBids = function (auctionId: string, limit = 50) {
  return this.find({ auction: auctionId, status: BidStatus.ACCEPTED })
    .populate("bidder", "firstName lastName")
    .sort({ timestamp: -1 })
    .limit(limit);
};

// Static method to get user's bids for an auction
bidSchema.statics.getUserBids = function (auctionId: string, userId: string) {
  return this.find({ auction: auctionId, bidder: userId }).sort({
    timestamp: -1,
  });
};

// Instance method to check if bid is winning
bidSchema.methods.isWinning = async function () {
  const highestBid = await mongoose
    .model("Bid")
    .findOne({
      auction: this.auction,
      status: BidStatus.ACCEPTED,
    })
    .sort({ amount: -1 });

  return highestBid && highestBid._id.toString() === this._id.toString();
};

export const Bid = mongoose.model<IBid>("Bid", bidSchema);
