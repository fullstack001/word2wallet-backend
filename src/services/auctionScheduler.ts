import { Auction } from "../models/Auction";
import { AuctionStatus } from "../types";

/**
 * Service to manage auction scheduling and status updates
 */
export class AuctionScheduler {
  private static intervalId: NodeJS.Timeout | null = null;
  private static isRunning = false;

  /**
   * Start the auction scheduler
   */
  static start() {
    if (this.isRunning) {
      console.log("Auction scheduler is already running");
      return;
    }

    console.log("Starting auction scheduler...");
    this.isRunning = true;

    // Check every minute for auctions that need status updates
    this.intervalId = setInterval(async () => {
      try {
        await this.processAuctions();
      } catch (error) {
        console.error("Error in auction scheduler:", error);
      }
    }, 60000); // Check every minute

    // Run immediately on start
    this.processAuctions();
  }

  /**
   * Stop the auction scheduler
   */
  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("Auction scheduler stopped");
  }

  /**
   * Process auctions for status updates
   */
  private static async processAuctions() {
    const now = new Date();

    try {
      // Start scheduled auctions
      const scheduledAuctions = await Auction.find({
        status: AuctionStatus.SCHEDULED,
        startTime: { $lte: now },
      });

      if (scheduledAuctions.length > 0) {
        console.log(`Starting ${scheduledAuctions.length} scheduled auctions`);

        for (const auction of scheduledAuctions) {
          auction.status = AuctionStatus.ACTIVE;
          await auction.save();
          console.log(`Auction ${auction._id} started`);
        }
      }

      // End expired auctions
      const activeAuctions = await Auction.find({
        status: AuctionStatus.ACTIVE,
        endTime: { $lte: now },
      });

      if (activeAuctions.length > 0) {
        console.log(`Ending ${activeAuctions.length} expired auctions`);

        for (const auction of activeAuctions) {
          // Check if reserve price was met
          const currentBid = auction.currentBid || auction.startingPrice;
          const reserveMet =
            !auction.reservePrice || currentBid >= auction.reservePrice;

          if (reserveMet && auction.highBidder) {
            auction.status = AuctionStatus.SOLD;
          } else {
            auction.status = AuctionStatus.ENDED_NO_SALE;
          }

          await auction.save();
          console.log(
            `Auction ${auction._id} ended with status: ${auction.status}`
          );
        }
      }

      // Clean up old ended auctions (optional - keep for 30 days)
      const cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const oldAuctions = await Auction.find({
        status: {
          $in: [
            AuctionStatus.SOLD,
            AuctionStatus.ENDED_NO_SALE,
            AuctionStatus.SOLD_BUY_NOW,
          ],
        },
        updatedAt: { $lt: cutoffDate },
      });

      if (oldAuctions.length > 0) {
        console.log(`Cleaning up ${oldAuctions.length} old auctions`);
        // You might want to archive these instead of deleting
        // For now, we'll just log them
        console.log(
          "Old auctions:",
          oldAuctions.map((a) => a._id)
        );
      }
    } catch (error) {
      console.error("Error processing auctions:", error);
    }
  }

  /**
   * Manually trigger auction processing (for testing)
   */
  static async processNow() {
    console.log("Manually processing auctions...");
    await this.processAuctions();
  }

  /**
   * Get scheduler status
   */
  static getStatus() {
    return {
      isRunning: this.isRunning,
      intervalId: this.intervalId ? "active" : "inactive",
    };
  }
}
