import { Queue, Worker, Job, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import { IJob, JobType, JobStatus, IBook, BookStatus } from "../types";
import { Job as JobModel } from "../models/Job";
import { Book } from "../models/Book";
import { EpubService } from "./epubService";
import { getS3Service } from "./s3Service";

// Redis connection - will be initialized after dotenv config
let redis: IORedis;

// Job queues
const jobQueues = new Map<JobType, Queue>();

// Initialize Redis connection
const initializeRedis = () => {
  if (!redis) {
    redis = new IORedis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
    });
  }
  return redis;
};

// Initialize queues
export const initializeQueues = () => {
  const redisConnection = initializeRedis();
  const queueConfig = {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    },
  };

  // Create queues for each job type
  Object.values(JobType).forEach((jobType) => {
    const queue = new Queue(jobType, queueConfig);
    jobQueues.set(jobType, queue);
  });
};

// Note: Queues will be initialized by calling initializeQueues() after dotenv.config()

export class JobService {
  /**
   * Add job to queue
   */
  static async addJob(
    type: JobType,
    data: any,
    options?: {
      delay?: number;
      priority?: number;
      attempts?: number;
    }
  ): Promise<IJob> {
    try {
      // Create job record in database
      const jobRecord = new JobModel({
        type,
        status: JobStatus.PENDING,
        userId: data.userId,
        bookId: data.bookId,
        arcLinkId: data.arcLinkId,
        data,
        maxAttempts: options?.attempts || 3,
      });

      await jobRecord.save();

      // Add job to queue
      const queue = jobQueues.get(type);
      if (!queue) {
        throw new Error(`Queue not found for job type: ${type}`);
      }

      const job = await queue.add(
        type,
        { ...data, jobId: jobRecord._id },
        {
          delay: options?.delay,
          priority: options?.priority,
          attempts: options?.attempts || 3,
          jobId: jobRecord._id.toString(),
        }
      );

      return jobRecord as any;
    } catch (error) {
      console.error(`Failed to add job ${type}:`, error);
      throw error;
    }
  }

  /**
   * Get job status
   */
  static async getJobStatus(jobId: string): Promise<IJob | null> {
    try {
      return await JobModel.findById(jobId);
    } catch (error) {
      console.error(`Failed to get job status ${jobId}:`, error);
      return null;
    }
  }

  /**
   * Cancel job
   */
  static async cancelJob(jobId: string): Promise<boolean> {
    try {
      const jobRecord = await JobModel.findById(jobId);
      if (!jobRecord) {
        return false;
      }

      // Cancel in queue
      const queue = jobQueues.get(jobRecord.type as JobType);
      if (queue) {
        await queue.remove(jobId);
      }

      // Update database record
      await (jobRecord as any).cancel();
      return true;
    } catch (error) {
      console.error(`Failed to cancel job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Get jobs for user
   */
  static async getUserJobs(userId: string, limit: number = 50): Promise<any[]> {
    try {
      return await (JobModel as any).findByUser(userId, limit);
    } catch (error) {
      console.error(`Failed to get user jobs ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get jobs by book
   */
  static async getBookJobs(bookId: string): Promise<any[]> {
    try {
      return await JobModel.find({ bookId }).sort({ createdAt: -1 });
    } catch (error) {
      console.error(`Failed to get book jobs ${bookId}:`, error);
      return [];
    }
  }
}

// Job processors
export class JobProcessors {
  /**
   * EPUB Validation Processor
   */
  static async processEpubValidation(job: Job): Promise<any> {
    const { jobId, bookId, filePath } = job.data;

    try {
      const jobRecord = await JobModel.findById(jobId);
      if (!jobRecord) {
        throw new Error("Job record not found");
      }

      await (jobRecord as any).markProcessing();

      // Validate EPUB
      const validationResult = await EpubService.validateEpub(filePath);

      if (!validationResult.isValid) {
        throw new Error(
          `EPUB validation failed: ${validationResult.errors.join(", ")}`
        );
      }

      // Update book with validation results
      const book = await Book.findById(bookId);
      if (book) {
        book.status = BookStatus.READY;
        book.metadata = {
          ...validationResult.metadata!,
          creator: validationResult.metadata!.creator,
        };
        book.checksum = validationResult.checksum;
        book.fileSize = validationResult.fileSize;
        await book.save();
      }

      await (jobRecord as any).markCompleted({
        isValid: validationResult.isValid,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
        metadata: validationResult.metadata,
      });

      // Clean up temp file after successful validation
      try {
        await EpubService.cleanupTempFile(filePath);
      } catch (cleanupError) {
        console.warn("Failed to cleanup temp file:", cleanupError);
        // Don't fail the job for cleanup errors
      }

      return validationResult;
    } catch (error) {
      const jobRecord = await JobModel.findById(jobId);
      if (jobRecord) {
        await (jobRecord as any).markFailed({
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        });
      }

      // Only clean up temp file if this is the final attempt (no more retries)
      const isFinalAttempt =
        jobRecord && jobRecord.attempts >= jobRecord.maxAttempts;
      if (isFinalAttempt) {
        try {
          await EpubService.cleanupTempFile(filePath);
        } catch (cleanupError) {
          console.warn(
            "Failed to cleanup temp file after final error:",
            cleanupError
          );
          // Don't fail the job for cleanup errors
        }
      }

      throw error;
    }
  }

  /**
   * EPUB Packaging Processor
   */
  static async processEpubPackaging(job: Job): Promise<any> {
    const { jobId, bookId, filePath } = job.data;

    try {
      const jobRecord = await JobModel.findById(jobId);
      if (!jobRecord) {
        throw new Error("Job record not found");
      }

      await (jobRecord as any).markProcessing();
      await (jobRecord as any).updateProgress(10);

      // Process EPUB for additional metadata
      const book = await Book.findById(bookId);
      if (!book) {
        throw new Error("Book not found");
      }

      const processingResult = await EpubService.processEpub(
        filePath,
        book.metadata as any
      );

      await (jobRecord as any).updateProgress(50);

      // Update book with processing results
      book.pageCount = processingResult.pageCount;
      book.wordCount = processingResult.wordCount;
      book.readingTime = processingResult.readingTime;
      book.coverImageUrl = processingResult.coverImageUrl;
      await book.save();

      await (jobRecord as any).updateProgress(100);
      await (jobRecord as any).markCompleted(processingResult);

      return processingResult;
    } catch (error) {
      const jobRecord = await JobModel.findById(jobId);
      if (jobRecord) {
        await (jobRecord as any).markFailed({
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
      throw error;
    }
  }
}

// Initialize workers
export const initializeWorkers = () => {
  const redisConnection = initializeRedis();

  // Check Redis version compatibility first
  redisConnection
    .info()
    .then((info) => {
      console.log("✅ Redis connection established");
      console.log(`📊 Redis version: ${info.split("\n")[0]}`);
    })
    .catch((error) => {
      console.error("❌ Redis connection failed:", error);
      throw error;
    });

  // Worker configuration
  const workerConfig = {
    connection: redisConnection,
    concurrency: 5,
  };

  // Create workers for each job type
  Object.values(JobType).forEach((jobType) => {
    const queue = jobQueues.get(jobType);
    if (!queue) {
      console.warn(`Queue not found for job type: ${jobType}`);
      return;
    }

    const worker = new Worker(
      jobType,
      async (job: Job) => {
        console.log(`Processing job ${jobType}:`, job.id);

        switch (jobType) {
          case JobType.EPUB_VALIDATION:
            return await JobProcessors.processEpubValidation(job);
          case JobType.EPUB_PACKAGING:
            return await JobProcessors.processEpubPackaging(job);
          default:
            throw new Error(`Unknown job type: ${jobType}`);
        }
      },
      workerConfig
    );

    // Worker event listeners
    worker.on("completed", (job) => {
      console.log(`✅ Job ${jobType} completed:`, job.id);
    });

    worker.on("failed", (job, err) => {
      console.error(`❌ Job ${jobType} failed:`, job?.id, err.message);
    });

    worker.on("error", (err) => {
      console.error(`❌ Worker ${jobType} error:`, err);
    });
  });

  console.log("🔧 Job workers initialized");
};
