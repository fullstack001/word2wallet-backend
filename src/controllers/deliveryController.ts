import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { ApiResponse, AuthRequest } from "../types";
import { JobService } from "../services/jobService";
import { JobType, JobStatus } from "../types";
import { Book } from "../models/Book";
import { Integration } from "../models/Integration";
import { IntegrationProvider } from "../types";

export class DeliveryController {
  /**
   * Create BookFunnel delivery (upload book to BookFunnel)
   */
  static async createBookFunnelDelivery(
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

      const userId = req.user!._id;
      const { bookId } = req.body;

      // Verify book exists and belongs to user
      const book = await Book.findOne({ _id: bookId, userId });
      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        } as ApiResponse);
        return;
      }

      if (book.status !== "ready") {
        res.status(400).json({
          success: false,
          message: "Book is not ready for delivery",
        } as ApiResponse);
        return;
      }

      // Check if BookFunnel integration exists
      const integration = await (Integration as any).findActiveByProvider(
        userId,
        IntegrationProvider.BOOKFUNNEL
      );
      if (!integration) {
        res.status(400).json({
          success: false,
          message: "BookFunnel integration not found or inactive",
        } as ApiResponse);
        return;
      }

      // Check if book is already uploaded to BookFunnel
      if (book.metadata.bookFunnelUploadId) {
        res.status(400).json({
          success: false,
          message: "Book is already uploaded to BookFunnel",
        } as ApiResponse);
        return;
      }

      // Start BookFunnel upload job
      const job = await JobService.addJob(JobType.BOOKFUNNEL_UPLOAD, {
        bookId,
        userId,
      });

      res.status(201).json({
        success: true,
        message: "BookFunnel delivery started",
        data: {
          jobId: job._id,
          bookId,
          status: "processing",
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Create BookFunnel delivery error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create BookFunnel delivery",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get delivery status
   */
  static async getDeliveryStatus(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!._id;

      // Get job status
      const job = await JobService.getJobStatus(id);
      if (!job) {
        res.status(404).json({
          success: false,
          message: "Delivery job not found",
        } as ApiResponse);
        return;
      }

      // Verify job belongs to user
      if (job.userId !== userId) {
        res.status(403).json({
          success: false,
          message: "Access denied",
        } as ApiResponse);
        return;
      }

      // Get additional context based on job type
      let context: any = {};

      if (job.bookId) {
        const book = await Book.findById(job.bookId);
        if (book) {
          context.book = {
            id: book._id,
            title: book.title,
            author: book.author,
            status: book.status,
          };
        }
      }

      res.json({
        success: true,
        message: "Delivery status retrieved successfully",
        data: {
          job: {
            id: job._id,
            type: job.type,
            status: job.status,
            progress: job.progress,
            attempts: job.attempts,
            maxAttempts: job.maxAttempts,
            createdAt: job.createdAt,
            completedAt: job.completedAt,
            error: job.error,
          },
          context,
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Get delivery status error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve delivery status",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get all delivery jobs for user
   */
  static async getUserDeliveries(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!._id;
      const { page = 1, limit = 10, type, status } = req.query;

      // Get user jobs
      const jobs = await JobService.getUserJobs(userId, Number(limit));

      // Filter by type if specified
      let filteredJobs = jobs;
      if (type) {
        filteredJobs = jobs.filter((job: any) => job.type === type);
      }

      // Filter by status if specified
      if (status) {
        filteredJobs = filteredJobs.filter((job: any) => job.status === status);
      }

      // Apply pagination
      const skip = (Number(page) - 1) * Number(limit);
      const paginatedJobs = filteredJobs.slice(skip, skip + Number(limit));

      // Get context for each job
      const jobsWithContext = await Promise.all(
        paginatedJobs.map(async (job: any) => {
          let context: any = {};

          if (job.bookId) {
            const book = await Book.findById(job.bookId);
            if (book) {
              context.book = {
                id: book._id,
                title: book.title,
                author: book.author,
                status: book.status,
              };
            }
          }

          return {
            id: job._id,
            type: job.type,
            status: job.status,
            progress: job.progress,
            attempts: job.attempts,
            maxAttempts: job.maxAttempts,
            createdAt: job.createdAt,
            completedAt: job.completedAt,
            error: job.error,
            context,
          };
        })
      );

      res.json({
        success: true,
        message: "User deliveries retrieved successfully",
        data: jobsWithContext,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: filteredJobs.length,
          pages: Math.ceil(filteredJobs.length / Number(limit)),
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Get user deliveries error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve user deliveries",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Cancel delivery job
   */
  static async cancelDelivery(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!._id;

      // Get job to verify ownership
      const job = await JobService.getJobStatus(id);
      if (!job) {
        res.status(404).json({
          success: false,
          message: "Delivery job not found",
        } as ApiResponse);
        return;
      }

      if (job.userId !== userId) {
        res.status(403).json({
          success: false,
          message: "Access denied",
        } as ApiResponse);
        return;
      }

      // Cancel job
      const cancelled = await JobService.cancelJob(id);
      if (!cancelled) {
        res.status(400).json({
          success: false,
          message: "Failed to cancel delivery job",
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        message: "Delivery job cancelled successfully",
      } as ApiResponse);
    } catch (error) {
      console.error("Cancel delivery error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to cancel delivery",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Retry failed delivery job
   */
  static async retryDelivery(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!._id;

      // Get job to verify ownership and status
      const job = await JobService.getJobStatus(id);
      if (!job) {
        res.status(404).json({
          success: false,
          message: "Delivery job not found",
        } as ApiResponse);
        return;
      }

      if (job.userId !== userId) {
        res.status(403).json({
          success: false,
          message: "Access denied",
        } as ApiResponse);
        return;
      }

      if (job.status !== JobStatus.FAILED) {
        res.status(400).json({
          success: false,
          message: "Only failed jobs can be retried",
        } as ApiResponse);
        return;
      }

      if (!job.canRetry) {
        res.status(400).json({
          success: false,
          message: "Job has exceeded maximum retry attempts",
        } as ApiResponse);
        return;
      }

      // Reset job status and add back to queue
      job.status = JobStatus.PENDING;
      job.attempts = 0;
      job.error = undefined;
      job.nextRetryAt = undefined;
      await job.save();

      // Add job back to queue
      await JobService.addJob(job.type, job.data, {
        attempts: job.maxAttempts,
      });

      res.json({
        success: true,
        message: "Delivery job retry initiated",
      } as ApiResponse);
    } catch (error) {
      console.error("Retry delivery error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retry delivery",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get delivery history for a book
   */
  static async getBookDeliveryHistory(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const { bookId } = req.params;
      const userId = req.user!._id;

      // Verify book exists and belongs to user
      const book = await Book.findOne({ _id: bookId, userId });
      if (!book) {
        res.status(404).json({
          success: false,
          message: "Book not found",
        } as ApiResponse);
        return;
      }

      // Get all jobs for this book
      const jobs = await JobService.getBookJobs(bookId);

      // Format job data
      const deliveryHistory = jobs.map((job) => ({
        id: job._id,
        type: job.type,
        status: job.status,
        progress: job.progress,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        error: job.error,
        result: job.result,
      }));

      res.json({
        success: true,
        message: "Book delivery history retrieved successfully",
        data: {
          book: {
            id: book._id,
            title: book.title,
            author: book.author,
            status: book.status,
          },
          deliveries: deliveryHistory,
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Get book delivery history error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve book delivery history",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }
}
