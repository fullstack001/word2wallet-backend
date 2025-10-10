import { Response } from "express";
import { validationResult } from "express-validator";
import { AuthRequest, ApiResponse } from "../types";
import { AutoNewsletterService } from "../services/autoNewsletterService";

export class NewsletterController {
  /**
   * Send new book notification to all readers (manual trigger)
   */
  static async sendNewBookNotification(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: "Validation failed",
          error: errors.array()[0].msg,
        } as ApiResponse);
        return;
      }

      const authorId = req.user!._id;
      const { bookId } = req.body;

      const result = await AutoNewsletterService.sendNewBookNotification(
        authorId,
        bookId
      );

      res.json({
        success: true,
        message: `Newsletter sent: ${result.sentCount} successful, ${result.failedCount} failed`,
        data: result,
      } as ApiResponse);
    } catch (error) {
      console.error("Send new book notification error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send newsletter",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Send new book notification to readers of specific books
   */
  static async sendNewBookNotificationToBookReaders(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: "Validation failed",
          error: errors.array()[0].msg,
        } as ApiResponse);
        return;
      }

      const authorId = req.user!._id;
      const { bookId, targetBookIds } = req.body;

      const result =
        await AutoNewsletterService.sendNewBookNotificationToBookReaders(
          authorId,
          bookId,
          targetBookIds
        );

      res.json({
        success: true,
        message: `Newsletter sent to targeted readers: ${result.sentCount} successful, ${result.failedCount} failed`,
        data: result,
      } as ApiResponse);
    } catch (error) {
      console.error("Send targeted new book notification error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send newsletter",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get newsletter statistics
   */
  static async getNewsletterStats(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const authorId = req.user!._id;
      const stats = await AutoNewsletterService.getAuthorNewsletterStats(
        authorId
      );

      res.json({
        success: true,
        message: "Newsletter statistics retrieved successfully",
        data: stats,
      } as ApiResponse);
    } catch (error) {
      console.error("Get newsletter stats error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve newsletter statistics",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }
}
