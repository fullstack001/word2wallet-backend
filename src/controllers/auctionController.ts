import { Request, Response } from "express";
import mongoose from "mongoose";
import { Auction } from "../models/Auction";
import { Bid } from "../models/Bid";
import { Offer } from "../models/Offer";
import { User } from "../models/User";
import { AuctionStatus, BidStatus, OfferStatus, AuthRequest } from "../types";

// Import WebSocket manager (we'll need to pass this as a parameter)
let wsManager: any = null;

export const setWebSocketManager = (manager: any) => {
  wsManager = manager;
};

// Get auction snapshot
export const getAuctionSnapshot = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid auction ID",
      });
      return;
    }

    // Create snapshot using the model's getSnapshot method
    const auctionDoc = await Auction.findById(id).populate(
      "highBidder",
      "firstName lastName"
    );
    if (!auctionDoc) {
      return res.status(404).json({
        success: false,
        message: "Auction not found",
      });
    }

    const snapshot = (auctionDoc as any).getSnapshot();
    snapshot.online = 0; // This will be managed by WebSocket server

    res.json({
      success: true,
      data: snapshot,
    });
    return;
  } catch (error) {
    console.error("Error getting auction snapshot:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
    return;
  }
};

// Place a bid
export const placeBid = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { amount, shippingInfo } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid auction ID",
      });
    }

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid bid amount is required",
      });
    }

    const auction = await Auction.findById(id);
    if (!auction) {
      return res.status(404).json({
        success: false,
        message: "Auction not found",
      });
    }

    // Check if auction can accept bids
    const now = new Date();
    const canAcceptBids =
      auction.status === AuctionStatus.ACTIVE &&
      now >= auction.startTime &&
      now <= auction.endTime;

    if (!canAcceptBids) {
      return res.status(400).json({
        success: false,
        message: "Auction is not accepting bids",
      });
    }

    // Validate bid amount
    const currentHighBid = auction.currentBid || auction.startingPrice;
    const minimumBid = currentHighBid + auction.minIncrement;

    if (amount < minimumBid) {
      return res.status(400).json({
        success: false,
        message: `Bid must be at least ${minimumBid} ${auction.currency}`,
      });
    }

    // Check if bid exceeds buy now price
    if (auction.buyNowPrice && amount >= auction.buyNowPrice) {
      return res.status(400).json({
        success: false,
        message: "Bid amount cannot exceed or equal buy now price",
      });
    }

    // Create bid
    const bid = new Bid({
      auction: auction._id,
      bidder: req.user!._id,
      amount: amount,
      ipAddress: req.ip || req.connection.remoteAddress || "unknown",
      userAgent: req.get("User-Agent"),
      shippingInfo: shippingInfo || undefined,
    });

    await bid.save();

    // Update auction
    auction.currentBid = amount;
    auction.highBidder = req.user!._id as any;
    auction.bids.push(bid._id as any);

    // Extend auction if bid is placed in last minute (anti-sniping)
    const timeToEnd = auction.endTime.getTime() - now.getTime();
    const extendThreshold = 60000; // 1 minute

    if (timeToEnd <= extendThreshold && auction.extendSeconds > 0) {
      auction.endTime = new Date(
        auction.endTime.getTime() + auction.extendSeconds * 1000
      );
    }

    await auction.save();

    // Mark previous high bids as outbid
    await Bid.updateMany(
      {
        auction: auction._id,
        _id: { $ne: bid._id },
        status: BidStatus.ACCEPTED,
      },
      { status: BidStatus.OUTBID }
    );

    // Mark bid as accepted
    bid.status = BidStatus.ACCEPTED;
    await bid.save();

    // Cancel offers below the new bid amount
    const offers = await Offer.find({
      auction: auction._id,
      status: { $in: [OfferStatus.PENDING, OfferStatus.COUNTERED] },
      amount: { $lt: amount },
    });

    if (offers.length > 0) {
      await Offer.updateMany(
        {
          auction: auction._id,
          status: { $in: [OfferStatus.PENDING, OfferStatus.COUNTERED] },
          amount: { $lt: amount },
        },
        { status: OfferStatus.EXPIRED }
      );
    }

    // Broadcast bid update via WebSocket
    if (wsManager) {
      await wsManager.broadcastBidUpdate(auction._id);
    }

    // Get updated snapshot using the model's getSnapshot method
    const updatedAuction = await Auction.findById(id).populate(
      "highBidder",
      "firstName lastName"
    );

    if (!updatedAuction) {
      return res.status(404).json({
        success: false,
        message: "Auction not found",
      });
    }

    const snapshot = (updatedAuction as any).getSnapshot();
    snapshot.online = 0;

    res.json({
      success: true,
      data: snapshot,
      message: "Bid placed successfully",
    });
    return;
  } catch (error) {
    console.error("Error placing bid:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
    return;
  }
};

// Buy now
export const buyNow = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid auction ID",
      });
    }

    const auction = await Auction.findById(id);
    if (!auction) {
      return res.status(404).json({
        success: false,
        message: "Auction not found",
      });
    }

    // Check if auction has buy now price and is active
    if (!auction.buyNowPrice) {
      return res.status(400).json({
        success: false,
        message: "This auction does not have a buy now option",
      });
    }

    if (auction.status !== AuctionStatus.ACTIVE) {
      return res.status(400).json({
        success: false,
        message: "Auction is not active",
      });
    }

    // Check if auction is still running
    const now = new Date();
    if (now > auction.endTime) {
      return res.status(400).json({
        success: false,
        message: "Auction has ended",
      });
    }

    // Update auction status
    auction.status = AuctionStatus.SOLD_BUY_NOW;
    auction.currentBid = auction.buyNowPrice;
    auction.highBidder = req.user!._id as any;
    await auction.save();

    // Cancel all pending offers
    await Offer.updateMany(
      {
        auction: auction._id,
        status: { $in: [OfferStatus.PENDING, OfferStatus.COUNTERED] },
      },
      { status: OfferStatus.EXPIRED }
    );

    // Broadcast auction end via WebSocket
    if (wsManager) {
      await wsManager.broadcastAuctionEnd(auction._id);
    }

    // Get updated snapshot using the model's getSnapshot method
    const updatedAuction = await Auction.findById(id).populate(
      "highBidder",
      "firstName lastName"
    );

    if (!updatedAuction) {
      return res.status(404).json({
        success: false,
        message: "Auction not found",
      });
    }

    const snapshot = (updatedAuction as any).getSnapshot();
    snapshot.online = 0;
    snapshot.timeRemaining = 0; // Auction ended

    res.json({
      success: true,
      data: snapshot,
      message: "Auction purchased successfully",
    });
    return;
  } catch (error) {
    console.error("Error buying now:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
    return;
  }
};

// Create offer
export const createOffer = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid auction ID",
      });
    }

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid offer amount is required",
      });
    }

    const auction = await Auction.findById(id);
    if (!auction) {
      return res.status(404).json({
        success: false,
        message: "Auction not found",
      });
    }

    // Check if auction is accepting offers
    if (
      auction.status !== AuctionStatus.ACTIVE &&
      auction.status !== AuctionStatus.SCHEDULED
    ) {
      return res.status(400).json({
        success: false,
        message: "Auction is not accepting offers",
      });
    }

    // Check for existing active offer from this user
    const existingOffer = await Offer.findOne({
      auction: auction._id,
      buyer: req.user!._id,
      status: { $in: [OfferStatus.PENDING, OfferStatus.COUNTERED] },
    });

    if (existingOffer) {
      return res.status(400).json({
        success: false,
        message: "You already have an active offer for this auction",
      });
    }

    // Validate offer amount
    if (amount < auction.startingPrice) {
      return res.status(400).json({
        success: false,
        message: "Offer amount must be at least the starting price",
      });
    }

    if (auction.buyNowPrice && amount >= auction.buyNowPrice) {
      return res.status(400).json({
        success: false,
        message: "Offer amount cannot exceed or equal buy now price",
      });
    }

    // Create offer (expires in 24 hours)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const offer = new Offer({
      auction: auction._id as any,
      buyer: req.user!._id as any,
      amount: amount,
      expiresAt: expiresAt,
    });

    await offer.save();

    // Add offer to auction
    auction.offers.push(offer._id as any);
    await auction.save();

    // Broadcast offer update via WebSocket
    if (wsManager) {
      await wsManager.broadcastOfferUpdate(auction._id);
    }

    res.json({
      success: true,
      data: offer,
      message: "Offer created successfully",
    });
    return;
  } catch (error) {
    console.error("Error creating offer:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
    return;
  }
};

// Get auction offers
export const getAuctionOffers = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid auction ID",
      });
    }

    const offers = await Offer.find({ auction: id })
      .populate("buyer", "firstName lastName email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: offers,
    });
    return;
  } catch (error) {
    console.error("Error getting auction offers:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
    return;
  }
};

// Accept offer
export const acceptOffer = async (req: AuthRequest, res: Response) => {
  try {
    const { offerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid offer ID",
      });
    }

    const offer = await Offer.findById(offerId).populate("auction");
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
      });
    }

    // Check if user owns the auction or is admin
    const auction = offer.auction as any;
    if (
      auction.createdBy.toString() !== req.user!._id.toString() &&
      req.user!.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only accept offers for your own auctions",
      });
    }

    // Check if offer is still valid
    if (offer.status !== OfferStatus.PENDING) {
      return res.status(400).json({
        success: false,
        message: "Offer is no longer valid",
      });
    }

    if (new Date() > offer.expiresAt) {
      return res.status(400).json({
        success: false,
        message: "Offer has expired",
      });
    }

    // Accept the offer
    offer.status = OfferStatus.ACCEPTED;
    await offer.save();

    // Broadcast offer update via WebSocket
    if (wsManager) {
      await wsManager.broadcastOfferUpdate(auction._id);
    }

    res.json({
      success: true,
      message: "Offer accepted successfully",
    });
    return;
  } catch (error) {
    console.error("Error accepting offer:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
    return;
  }
};

// Decline offer
export const declineOffer = async (req: AuthRequest, res: Response) => {
  try {
    const { offerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid offer ID",
      });
    }

    const offer = await Offer.findById(offerId).populate("auction");
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
      });
    }

    // Check if user owns the auction or is admin
    const auction = offer.auction as any;
    if (
      auction.createdBy.toString() !== req.user!._id.toString() &&
      req.user!.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only decline offers for your own auctions",
      });
    }

    // Decline the offer
    offer.status = OfferStatus.DECLINED;
    await offer.save();

    // Broadcast offer update via WebSocket
    if (wsManager) {
      await wsManager.broadcastOfferUpdate(auction._id);
    }

    res.json({
      success: true,
      message: "Offer declined",
    });
    return;
  } catch (error) {
    console.error("Error declining offer:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
    return;
  }
};

// Create auction
export const createAuction = async (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      description,
      currency = "USD",
      startingPrice,
      reservePrice,
      buyNowPrice,
      startTime,
      endTime,
      extendSeconds = 30,
      minIncrement = 1,
      images = [],
    } = req.body;

    // Validation
    if (!title || !description || !startingPrice || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message:
          "Title, description, starting price, start time, and end time are required",
      });
    }

    if (startingPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: "Starting price must be greater than 0",
      });
    }

    if (reservePrice && reservePrice <= startingPrice) {
      return res.status(400).json({
        success: false,
        message: "Reserve price must be greater than starting price",
      });
    }

    if (buyNowPrice && buyNowPrice <= startingPrice) {
      return res.status(400).json({
        success: false,
        message: "Buy now price must be greater than starting price",
      });
    }

    if (reservePrice && buyNowPrice && reservePrice > buyNowPrice) {
      return res.status(400).json({
        success: false,
        message: "Reserve price cannot be higher than buy now price",
      });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (end <= start) {
      return res.status(400).json({
        success: false,
        message: "End time must be after start time",
      });
    }

    if (start <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Start time must be in the future",
      });
    }

    // Create auction
    const auction = new Auction({
      title,
      description,
      currency,
      startingPrice,
      reservePrice,
      buyNowPrice,
      startTime: start,
      endTime: end,
      extendSeconds,
      minIncrement,
      images,
      createdBy: req.user!._id,
      status: AuctionStatus.SCHEDULED,
    });

    await auction.save();

    // Populate creator info
    await auction.populate("createdBy", "firstName lastName email");

    res.status(201).json({
      success: true,
      data: auction,
      message: "Auction created successfully",
    });
    return;
  } catch (error) {
    console.error("Error creating auction:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
    return;
  }
};

// Get user's auctions
export const getUserAuctions = async (req: AuthRequest, res: Response) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter: any = { createdBy: req.user!._id };
    if (status) {
      filter.status = status;
    }

    const auctions = await Auction.find(filter)
      .populate("highBidder", "firstName lastName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Auction.countDocuments(filter);

    res.json({
      success: true,
      data: {
        auctions,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
    return;
  } catch (error) {
    console.error("Error getting user auctions:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
    return;
  }
};

// Get all auctions (public)
export const getAllAuctions = async (req: Request, res: Response) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter: any = {};
    if (status) {
      filter.status = status;
    }

    const auctions = await Auction.find(filter)
      .populate("createdBy", "firstName lastName")
      .populate("highBidder", "firstName lastName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Auction.countDocuments(filter);

    res.json({
      success: true,
      data: {
        auctions,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
    return;
  } catch (error) {
    console.error("Error getting all auctions:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
    return;
  }
};

// Update auction (only by creator or admin)
export const updateAuction = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid auction ID",
      });
    }

    const auction = await Auction.findById(id);
    if (!auction) {
      return res.status(404).json({
        success: false,
        message: "Auction not found",
      });
    }

    // Check if user can update this auction
    if (
      auction.createdBy.toString() !== req.user!._id.toString() &&
      req.user!.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own auctions",
      });
    }

    // Don't allow updates to active auctions
    if (auction.status === AuctionStatus.ACTIVE) {
      return res.status(400).json({
        success: false,
        message: "Cannot update active auctions",
      });
    }

    // Update auction
    const updatedAuction = await Auction.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate("createdBy", "firstName lastName");

    res.json({
      success: true,
      data: updatedAuction,
      message: "Auction updated successfully",
    });
    return;
  } catch (error) {
    console.error("Error updating auction:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
    return;
  }
};

// Delete auction (only by creator or admin)
export const deleteAuction = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid auction ID",
      });
    }

    const auction = await Auction.findById(id);
    if (!auction) {
      return res.status(404).json({
        success: false,
        message: "Auction not found",
      });
    }

    // Check if user can delete this auction
    if (
      auction.createdBy.toString() !== req.user!._id.toString() &&
      req.user!.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own auctions",
      });
    }

    // Don't allow deletion of active auctions
    if (auction.status === AuctionStatus.ACTIVE) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete active auctions",
      });
    }

    // Delete related bids and offers
    await Bid.deleteMany({ auction: id });
    await Offer.deleteMany({ auction: id });

    // Delete auction
    await Auction.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Auction deleted successfully",
    });
    return;
  } catch (error) {
    console.error("Error deleting auction:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
    return;
  }
};

// Get auction bidding history
export const getAuctionBids = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid auction ID",
      });
    }

    const bids = await Bid.find({ auction: id, status: BidStatus.ACCEPTED })
      .populate("bidder", "firstName lastName")
      .sort({ timestamp: -1 })
      .limit(limit);

    res.json({
      success: true,
      data: bids,
    });
    return;
  } catch (error) {
    console.error("Error getting auction bids:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
    return;
  }
};
