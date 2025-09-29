import { Queue, Worker, Job, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import {
  IJob,
  JobType,
  JobStatus,
  IBook,
  IArcLink,
  IIntegration,
  IntegrationProvider,
  BookStatus,
} from "../types";
import { Job as JobModel } from "../models/Job";
import { Book } from "../models/Book";
import { ArcLink } from "../models/ArcLink";
import { Integration } from "../models/Integration";
import { EpubService } from "./epubService";
import { getS3Service } from "./s3Service";
import { createBookFunnelService } from "./bookFunnelService";

// Redis connection
const redis = new IORedis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

// Job queues
const jobQueues = new Map<JobType, Queue>();

// Initialize queues
const initializeQueues = () => {
  const queueConfig = {
    connection: redis,
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

// Initialize queues on startup
initializeQueues();

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
      const queue = jobQueues.get(jobRecord.type);
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

      return validationResult;
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

  /**
   * BookFunnel Upload Processor
   */
  static async processBookFunnelUpload(job: Job): Promise<any> {
    const { jobId, bookId, userId } = job.data;

    try {
      const jobRecord = await JobModel.findById(jobId);
      if (!jobRecord) {
        throw new Error("Job record not found");
      }

      await (jobRecord as any).markProcessing();
      await (jobRecord as any).updateProgress(10);

      // Get book and integration
      const book = await Book.findById(bookId);
      if (!book) {
        throw new Error("Book not found");
      }

      const integration = await (Integration as any).findActiveByProvider(
        userId,
        IntegrationProvider.BOOKFUNNEL
      );
      if (!integration) {
        throw new Error("BookFunnel integration not found or inactive");
      }

      await (jobRecord as any).updateProgress(20);

      // Download file from S3
      const s3Service = getS3Service();
      const fileBuffer = await s3Service.downloadFile(book.fileKey);

      await (jobRecord as any).updateProgress(40);

      // Upload to BookFunnel
      const bookFunnelService = await createBookFunnelService(integration);
      const uploadResult = await bookFunnelService.uploadFile(
        fileBuffer,
        book.fileName
      );

      await (jobRecord as any).updateProgress(80);

      // Update book with upload result
      book.metadata = {
        ...book.metadata,
        bookFunnelUploadId: uploadResult.id,
      } as any;
      await book.save();

      await (jobRecord as any).updateProgress(100);
      await (jobRecord as any).markCompleted(uploadResult);

      return uploadResult;
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

  /**
   * ARC Campaign Create Processor
   */
  static async processArcCampaignCreate(job: Job): Promise<any> {
    const { jobId, bookId, userId, campaignData } = job.data;

    try {
      const jobRecord = await JobModel.findById(jobId);
      if (!jobRecord) {
        throw new Error("Job record not found");
      }

      await (jobRecord as any).markProcessing();
      await (jobRecord as any).updateProgress(10);

      // Get book and integration
      const book = await Book.findById(bookId);
      if (!book) {
        throw new Error("Book not found");
      }

      const integration = await (Integration as any).findActiveByProvider(
        userId,
        IntegrationProvider.BOOKFUNNEL
      );
      if (!integration) {
        throw new Error("BookFunnel integration not found or inactive");
      }

      await (jobRecord as any).updateProgress(30);

      // Create campaign in BookFunnel
      const bookFunnelService = await createBookFunnelService(integration);
      const campaign = await bookFunnelService.createCampaign({
        name: campaignData.name,
        description: campaignData.description,
        max_downloads: campaignData.maxDownloads,
        expires_at: campaignData.expiresAt,
        upload_id: (book.metadata as any).bookFunnelUploadId,
      });

      await (jobRecord as any).updateProgress(70);

      // Store campaign ID in book metadata
      book.metadata = {
        ...book.metadata,
        bookFunnelCampaignId: campaign.id,
      } as any;
      await book.save();

      await (jobRecord as any).updateProgress(100);
      await (jobRecord as any).markCompleted(campaign);

      return campaign;
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

  /**
   * ARC Codes Generate Processor
   */
  static async processArcCodesGenerate(job: Job): Promise<any> {
    const { jobId, bookId, userId, quantity, expiresAt, maxDownloadsPerCode } =
      job.data;

    try {
      const jobRecord = await JobModel.findById(jobId);
      if (!jobRecord) {
        throw new Error("Job record not found");
      }

      await (jobRecord as any).markProcessing();
      await (jobRecord as any).updateProgress(10);

      // Get book and integration
      const book = await Book.findById(bookId);
      if (!book) {
        throw new Error("Book not found");
      }

      const integration = await (Integration as any).findActiveByProvider(
        userId,
        IntegrationProvider.BOOKFUNNEL
      );
      if (!integration) {
        throw new Error("BookFunnel integration not found or inactive");
      }

      await (jobRecord as any).updateProgress(20);

      // Generate ARC codes in BookFunnel
      const bookFunnelService = await createBookFunnelService(integration);
      const arcCodes = await bookFunnelService.createArcCodes({
        campaign_id: (book.metadata as any).bookFunnelCampaignId,
        quantity,
        expires_at: expiresAt,
        max_downloads_per_code: maxDownloadsPerCode,
      });

      await (jobRecord as any).updateProgress(60);

      // Create ARC link records
      const arcLinks = [];
      for (const arcCode of arcCodes) {
        const code = await (ArcLink as any).generateUniqueCode();
        const arcLink = new ArcLink({
          bookId,
          userId,
          code,
          url: arcCode.url,
          campaignId: book.metadata.bookFunnelCampaignId,
          expiresAt: arcCode.expires_at
            ? new Date(arcCode.expires_at)
            : undefined,
          maxDownloads: arcCode.max_downloads,
          downloadsCount: arcCode.downloads_count,
          status: "active",
          metadata: {
            title: book.title,
            author: book.author,
            format: "EPUB",
            description: book.description,
          },
        });

        await arcLink.save();
        arcLinks.push(arcLink);
      }

      await (jobRecord as any).updateProgress(100);
      await (jobRecord as any).markCompleted({ arcLinks, arcCodes });

      return { arcLinks, arcCodes };
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
  // Check Redis version compatibility first
  redis
    .info()
    .then((info) => {
      const versionMatch = info.match(/redis_version:(\d+\.\d+\.\d+)/);
      if (versionMatch) {
        const version = versionMatch[1];
        const [major] = version.split(".").map(Number);

        if (major < 5) {
          console.warn(
            `⚠️  Redis version ${version} is not compatible with BullMQ (requires 5.0.0+). Job workers will be disabled.`
          );
          console.warn(
            "Please upgrade Redis to version 5.0.0 or higher to enable job processing."
          );
          return;
        }
      }

      // Initialize workers only if Redis is compatible
      const workerConfig = {
        connection: redis,
        concurrency: 5,
      };

      // Create workers for each job type
      Object.values(JobType).forEach((jobType) => {
        const queue = jobQueues.get(jobType);
        if (!queue) return;

        const worker = new Worker(
          jobType,
          async (job: Job) => {
            console.log(`Processing job ${jobType}:`, job.id);

            switch (jobType) {
              case JobType.EPUB_VALIDATION:
                return await JobProcessors.processEpubValidation(job);
              case JobType.EPUB_PACKAGING:
                return await JobProcessors.processEpubPackaging(job);
              case JobType.BOOKFUNNEL_UPLOAD:
                return await JobProcessors.processBookFunnelUpload(job);
              case JobType.ARC_CAMPAIGN_CREATE:
                return await JobProcessors.processArcCampaignCreate(job);
              case JobType.ARC_CODES_GENERATE:
                return await JobProcessors.processArcCodesGenerate(job);
              default:
                throw new Error(`Unknown job type: ${jobType}`);
            }
          },
          workerConfig
        );

        worker.on("completed", (job) => {
          console.log(`Job ${jobType} completed:`, job.id);
        });

        worker.on("failed", (job, err) => {
          console.error(`Job ${jobType} failed:`, job?.id, err);
        });

        worker.on("error", (err) => {
          console.error(`Worker ${jobType} error:`, err);
        });
      });

      console.log("✅ Job workers initialized");
    })
    .catch((error) => {
      console.warn(
        "⚠️  Could not connect to Redis. Job workers will be disabled."
      );
      console.warn("Redis connection error:", error.message);
    });
};

// Initialize workers on startup
initializeWorkers();
