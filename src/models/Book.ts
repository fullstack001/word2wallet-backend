import mongoose, { Schema } from "mongoose";

export interface IBook {
  _id: string;
  userId: string;
  title: string;
  author: string;
  description?: string;
  isbn?: string;
  publisher?: string;
  publicationDate?: Date;
  language: string;
  genre?: string[];
  tags?: string[];
  fileKey: string; // S3 key for the EPUB file
  fileName: string;
  fileSize: number;
  checksum: string; // SHA-256 hash
  metadata: {
    title: string;
    creator: string;
    subject?: string;
    description?: string;
    publisher?: string;
    date?: string;
    language?: string;
    rights?: string;
    identifier?: string;
    format?: string;
    source?: string;
    relation?: string;
    coverage?: string;
    contributor?: string;
    type?: string;
    // BookFunnel specific fields
    bookFunnelUploadId?: string;
    bookFunnelUploadStatus?: string;
    bookFunnelDownloadUrl?: string;
    bookFunnelErrorMessage?: string;
    bookFunnelCampaignId?: string;
    bookFunnelCampaignStatus?: string;
    bookFunnelCampaignName?: string;
    bookFunnelDownloadCount?: number;
  };
  status: BookStatus;
  uploadDate: Date;
  lastModified: Date;
  coverImageUrl?: string;
  pageCount?: number;
  wordCount?: number;
  readingTime?: number; // in minutes
}

export enum BookStatus {
  UPLOADING = "uploading",
  PROCESSING = "processing",
  READY = "ready",
  ERROR = "error",
  DELETED = "deleted",
}

const bookSchema = new Schema<IBook>(
  {
    userId: {
      type: String,
      required: [true, "User ID is required"],
      ref: "User",
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    author: {
      type: String,
      required: [true, "Author is required"],
      trim: true,
      maxlength: [100, "Author cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    isbn: {
      type: String,
      trim: true,
      match: [
        /^(?:ISBN(?:-1[03])?:? )?(?=[0-9X]{10}$|(?=(?:[0-9]+[- ]){3})[- 0-9X]{13}$|97[89][0-9]{10}$|(?=(?:[0-9]+[- ]){4})[- 0-9]{17}$)(?:97[89][- ]?)?[0-9]{1,5}[- ]?[0-9]+[- ]?[0-9]+[- ]?[0-9X]$/,
        "Please enter a valid ISBN",
      ],
    },
    publisher: {
      type: String,
      trim: true,
      maxlength: [100, "Publisher cannot exceed 100 characters"],
    },
    publicationDate: {
      type: Date,
    },
    language: {
      type: String,
      required: [true, "Language is required"],
      default: "en",
      maxlength: [10, "Language code cannot exceed 10 characters"],
    },
    genre: [
      {
        type: String,
        trim: true,
        maxlength: [50, "Genre cannot exceed 50 characters"],
      },
    ],
    tags: [
      {
        type: String,
        trim: true,
        maxlength: [30, "Tag cannot exceed 30 characters"],
      },
    ],
    fileKey: {
      type: String,
      required: [true, "File key is required"],
    },
    fileName: {
      type: String,
      required: [true, "File name is required"],
    },
    fileSize: {
      type: Number,
      required: [true, "File size is required"],
      min: [1, "File size must be greater than 0"],
    },
    checksum: {
      type: String,
      required: [true, "Checksum is required"],
      match: [/^[a-f0-9]{64}$/, "Checksum must be a valid SHA-256 hash"],
    },
    metadata: {
      title: { type: String, required: true },
      creator: { type: String, required: true },
      subject: { type: String },
      description: { type: String },
      publisher: { type: String },
      date: { type: String },
      language: { type: String },
      rights: { type: String },
      identifier: { type: String },
      format: { type: String },
      source: { type: String },
      relation: { type: String },
      coverage: { type: String },
      contributor: { type: String },
      type: { type: String },
      // BookFunnel specific fields
      bookFunnelUploadId: { type: String },
      bookFunnelUploadStatus: { type: String },
      bookFunnelDownloadUrl: { type: String },
      bookFunnelErrorMessage: { type: String },
      bookFunnelCampaignId: { type: String },
      bookFunnelCampaignStatus: { type: String },
      bookFunnelCampaignName: { type: String },
      bookFunnelDownloadCount: { type: Number },
    },
    status: {
      type: String,
      enum: Object.values(BookStatus),
      default: BookStatus.UPLOADING,
    },
    uploadDate: {
      type: Date,
      default: Date.now,
    },
    lastModified: {
      type: Date,
      default: Date.now,
    },
    coverImageUrl: {
      type: String,
    },
    pageCount: {
      type: Number,
      min: [1, "Page count must be greater than 0"],
    },
    wordCount: {
      type: Number,
      min: [0, "Word count cannot be negative"],
    },
    readingTime: {
      type: Number,
      min: [0, "Reading time cannot be negative"],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
bookSchema.index({ userId: 1 });
bookSchema.index({ status: 1 });
bookSchema.index({ title: "text", author: "text", description: "text" });
bookSchema.index({ uploadDate: -1 });
bookSchema.index({ genre: 1 });
bookSchema.index({ tags: 1 });

// Virtual for file URL
bookSchema.virtual("fileUrl").get(function () {
  return `${process.env.S3_BASE_URL || ""}/${this.fileKey}`;
});

// Update lastModified before saving
bookSchema.pre("save", function (next) {
  this.lastModified = new Date();
  next();
});

export const Book = mongoose.model<IBook>("Book", bookSchema);
