import { Request, Response } from "express";
import { Auction } from "../models/Auction";
import { User } from "../models/User";
import { AuctionStatus } from "../types";

// Create demo auction
export const createDemoAuction = async (req: Request, res: Response) => {
  try {
    // Find or create demo user
    let demoUser = await User.findOne({ email: "demo@example.com" });

    if (!demoUser) {
      demoUser = new User({
        email: "demo@example.com",
        password: "demo123456",
        firstName: "Demo",
        lastName: "User",
        role: "user",
      });
      await demoUser.save();
    }

    // Create demo auction
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

    const auction = new Auction({
      title: "Demo Auction Item",
      description:
        "This is a demo auction item for testing purposes. It has a beautiful description and is perfect for demonstration.",
      currency: "USD",
      startingPrice: 100,
      reservePrice: 150,
      buyNowPrice: 500,
      status: AuctionStatus.ACTIVE,
      startTime: startTime,
      endTime: endTime,
      extendSeconds: 30,
      minIncrement: 5,
      createdBy: demoUser._id,
    });

    await auction.save();

    res.json({
      success: true,
      data: {
        auction: auction,
        auctionUrl: `/auction/${auction._id}`,
      },
      message: "Demo auction created successfully",
    });
  } catch (error) {
    console.error("Error creating demo auction:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get demo auctions
export const getDemoAuctions = async (req: Request, res: Response) => {
  try {
    const auctions = await Auction.find()
      .populate("createdBy", "firstName lastName")
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: auctions,
    });
  } catch (error) {
    console.error("Error getting demo auctions:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
