import mongoose, { Schema } from "mongoose";

export interface IJob {
  _id: string;
  type: JobType;
  status: JobStatus;
  userId: string;
  bookId?: string;
  arcLinkId?: string;
  progress: number; // 0-100
  data: {
    [key: string]: any;
  };
  result?: {
    [key: string]: any;
  };
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum JobType {
  EPUB_VALIDATION = "epub_validation",
  EPUB_PACKAGING = "epub_packaging",
}

export enum JobStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
  RETRYING = "retrying",
  CANCELLED = "cancelled",
}

const jobSchema = new Schema<IJob>(
  {
    type: {
      type: String,
      required: [true, "Job type is required"],
      enum: Object.values(JobType),
    },
    status: {
      type: String,
      enum: Object.values(JobStatus),
      default: JobStatus.PENDING,
    },
    userId: {
      type: String,
      required: [true, "User ID is required"],
      ref: "User",
    },
    bookId: {
      type: String,
      ref: "Book",
    },
    arcLinkId: {
      type: String,
      ref: "ArcLink",
    },
    progress: {
      type: Number,
      default: 0,
      min: [0, "Progress cannot be negative"],
      max: [100, "Progress cannot exceed 100"],
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    result: {
      type: Schema.Types.Mixed,
    },
    error: {
      message: { type: String },
      stack: { type: String },
      code: { type: String },
    },
    attempts: {
      type: Number,
      default: 0,
      min: [0, "Attempts cannot be negative"],
    },
    maxAttempts: {
      type: Number,
      default: 3,
      min: [1, "Max attempts must be at least 1"],
    },
    nextRetryAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
jobSchema.index({ userId: 1 });
jobSchema.index({ type: 1 });
jobSchema.index({ status: 1 });
jobSchema.index({ bookId: 1 });
jobSchema.index({ arcLinkId: 1 });
jobSchema.index({ createdAt: -1 });
jobSchema.index({ nextRetryAt: 1 });

// Virtual to check if job can be retried
jobSchema.virtual("canRetry").get(function () {
  return this.status === JobStatus.FAILED && this.attempts < this.maxAttempts;
});

// Virtual to check if job is in progress
jobSchema.virtual("isInProgress").get(function () {
  return [JobStatus.PENDING, JobStatus.PROCESSING, JobStatus.RETRYING].includes(
    this.status
  );
});

// Method to update progress
jobSchema.methods.updateProgress = function (progress: number) {
  this.progress = Math.max(0, Math.min(100, progress));
  return this.save();
};

// Method to mark as processing
jobSchema.methods.markProcessing = function () {
  this.status = JobStatus.PROCESSING;
  this.attempts += 1;
  return this.save();
};

// Method to mark as completed
jobSchema.methods.markCompleted = function (result?: any) {
  this.status = JobStatus.COMPLETED;
  this.progress = 100;
  this.completedAt = new Date();
  if (result) {
    this.result = result;
  }
  return this.save();
};

// Method to mark as failed
jobSchema.methods.markFailed = function (error: {
  message: string;
  stack?: string;
  code?: string;
}) {
  this.status = JobStatus.FAILED;
  this.error = error;

  // Calculate next retry time if can retry
  if (this.canRetry) {
    this.status = JobStatus.RETRYING;
    // Exponential backoff: 2^attempts minutes
    const retryDelay = Math.pow(2, this.attempts) * 60 * 1000;
    this.nextRetryAt = new Date(Date.now() + retryDelay);
  }

  return this.save();
};

// Method to cancel job
jobSchema.methods.cancel = function () {
  this.status = JobStatus.CANCELLED;
  return this.save();
};

// Static method to find jobs by status
jobSchema.statics.findByStatus = function (status: JobStatus) {
  return this.find({ status });
};

// Static method to find retryable jobs
jobSchema.statics.findRetryable = function () {
  return this.find({
    status: JobStatus.RETRYING,
    nextRetryAt: { $lte: new Date() },
  });
};

// Static method to find jobs for user
jobSchema.statics.findByUser = function (userId: string, limit = 50) {
  return this.find({ userId }).sort({ createdAt: -1 }).limit(limit);
};

export const Job = mongoose.model<IJob>("Job", jobSchema);
