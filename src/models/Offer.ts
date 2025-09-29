import mongoose, { Schema } from "mongoose";
import { IOffer, OfferStatus } from "../types";

const offerSchema = new Schema<IOffer>(
  {
    auction: {
      type: Schema.Types.ObjectId,
      ref: "Auction",
      required: [true, "Auction is required"],
    },
    buyer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Buyer is required"],
    },
    amount: {
      type: Number,
      required: [true, "Offer amount is required"],
      min: [0.01, "Offer amount must be at least 0.01"],
    },
    status: {
      type: String,
      enum: Object.values(OfferStatus),
      default: OfferStatus.PENDING,
    },
    expiresAt: {
      type: Date,
      required: [true, "Expiration date is required"],
    },
    counterOffer: {
      type: Schema.Types.ObjectId,
      ref: "Offer",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
offerSchema.index({ auction: 1, status: 1 });
offerSchema.index({ buyer: 1 });
offerSchema.index({ expiresAt: 1 });
offerSchema.index({ status: 1, expiresAt: 1 });

// Compound index for active offers
offerSchema.index({ auction: 1, buyer: 1, status: 1 });

// Virtual for is expired
offerSchema.virtual("isExpired").get(function () {
  return new Date() > this.expiresAt;
});

// Validation middleware
offerSchema.pre("save", async function (next) {
  try {
    if (this.isNew) {
      // Check if auction exists and is active
      const Auction = mongoose.model("Auction");
      const auction = await Auction.findById(this.auction);

      if (!auction) {
        return next(new Error("Auction not found"));
      }

      // Check if auction is still accepting offers
      if (auction.status !== "active" && auction.status !== "scheduled") {
        return next(new Error("Auction is not accepting offers"));
      }

      // Check if there's already an active offer from this buyer
      const existingOffer = await mongoose.model("Offer").findOne({
        auction: this.auction,
        buyer: this.buyer,
        status: { $in: [OfferStatus.PENDING, OfferStatus.COUNTERED] },
      });

      if (existingOffer) {
        return next(
          new Error("You already have an active offer for this auction")
        );
      }

      // Validate offer amount
      if (this.amount < (auction.startingPrice || 0)) {
        return next(
          new Error("Offer amount must be at least the starting price")
        );
      }

      // Check if offer exceeds buy now price
      if (auction.buyNowPrice && this.amount >= auction.buyNowPrice) {
        return next(
          new Error("Offer amount cannot exceed or equal buy now price")
        );
      }
    }

    next();
  } catch (error) {
    next(error as Error);
  }
});

// Post-save middleware to update auction
offerSchema.post("save", async function () {
  try {
    if (this.status === OfferStatus.ACCEPTED) {
      // Update auction status to sold via offer
      const Auction = mongoose.model("Auction");
      await Auction.findByIdAndUpdate(this.auction, {
        status: "sold_offer",
        currentBid: this.amount,
        highBidder: this.buyer,
        offers: this._id,
      });

      // Cancel all other pending offers for this auction
      await mongoose.model("Offer").updateMany(
        {
          auction: this.auction,
          _id: { $ne: this._id },
          status: { $in: [OfferStatus.PENDING, OfferStatus.COUNTERED] },
        },
        { status: OfferStatus.EXPIRED }
      );
    }
  } catch (error) {
    console.error("Error updating auction after offer acceptance:", error);
  }
});

// Static method to get auction offers
offerSchema.statics.getAuctionOffers = function (auctionId: string) {
  return this.find({ auction: auctionId })
    .populate("buyer", "firstName lastName email")
    .sort({ createdAt: -1 });
};

// Static method to get user's offers
offerSchema.statics.getUserOffers = function (userId: string) {
  return this.find({ buyer: userId })
    .populate("auction", "title description")
    .sort({ createdAt: -1 });
};

// Static method to expire old offers
offerSchema.statics.expireOldOffers = function () {
  return this.updateMany(
    {
      status: { $in: [OfferStatus.PENDING, OfferStatus.COUNTERED] },
      expiresAt: { $lt: new Date() },
    },
    { status: OfferStatus.EXPIRED }
  );
};

// Static method to cancel offers when bid exceeds offer
offerSchema.statics.cancelOffersBelowBid = async function (
  auctionId: string,
  bidAmount: number
) {
  const offers = await this.find({
    auction: auctionId,
    status: { $in: [OfferStatus.PENDING, OfferStatus.COUNTERED] },
    amount: { $lt: bidAmount },
  });

  if (offers.length > 0) {
    await this.updateMany(
      {
        auction: auctionId,
        status: { $in: [OfferStatus.PENDING, OfferStatus.COUNTERED] },
        amount: { $lt: bidAmount },
      },
      { status: OfferStatus.EXPIRED }
    );

    // Emit WebSocket update for each cancelled offer
    offers.forEach((offer: any) => {
      // This would trigger WebSocket notifications
      console.log(`Offer ${offer._id} expired due to higher bid`);
    });
  }
};

// Instance method to create counter offer
offerSchema.methods.createCounterOffer = async function (
  amount: number,
  expiresAt: Date
) {
  if (this.status !== OfferStatus.PENDING) {
    throw new Error("Can only counter pending offers");
  }

  // Create new offer as counter
  const CounterOffer = mongoose.model("Offer");
  const counterOffer = new CounterOffer({
    auction: this.auction,
    buyer: this.buyer,
    amount: amount,
    status: OfferStatus.COUNTERED,
    expiresAt: expiresAt,
  });

  await counterOffer.save();

  // Update original offer status
  this.status = OfferStatus.COUNTERED;
  this.counterOffer = counterOffer._id;
  await this.save();

  return counterOffer;
};

export const Offer = mongoose.model<IOffer>("Offer", offerSchema);
