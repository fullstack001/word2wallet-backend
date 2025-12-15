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

  // New book information fields
  label?: string; // Book label or subtitle
  series?: string; // Book series name
  volume?: string; // Volume number in series
  tagline?: string; // Book tagline or catchphrase
  notesToReaders?: string; // Special notes to readers
  bookType?: BookType; // Type of book (advance_copy, excerpt, etc.)
  ebookType?: "doc" | "audio"; // Ebook type: document/book or audio book
  narrator?: string; // Audio narrator name
  audioQuality?: string; // Audio quality for distribution

  // Cover image fields (only 1 allowed)
  coverImageKey?: string; // GCS key for cover image
  coverImageName?: string; // Original cover image filename
  coverImageSize?: number; // Cover image file size

  // File fields (only 1 epub and 1 PDF allowed for regular books, 1 audio file for audio books)
  epubFile?: {
    fileKey?: string;
    fileName?: string;
    fileSize?: number;
    checksum?: string;
    uploadedAt?: Date;
  };
  pdfFile?: {
    fileKey?: string;
    fileName?: string;
    fileSize?: number;
    checksum?: string;
    uploadedAt?: Date;
  };
  audioFile?: {
    fileKey?: string;
    fileName?: string;
    fileSize?: number;
    checksum?: string;
    uploadedAt?: Date;
  };

  // Legacy fields for backward compatibility
  fileKey?: string; // GCS key for the book file
  fileName?: string;
  fileSize?: number;
  fileType?: BookFileType; // EPUB, PDF, or AUDIO
  checksum?: string; // SHA-256 hash

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
  };

  status: BookStatus;
  uploadDate: Date;
  lastModified: Date;
  coverImageUrl?: string;
  pageCount?: number;
  wordCount?: number;
  readingTime?: number; // in minutes

  // Delivery features
  isPublic: boolean; // Whether book can be accessed via public links
  allowEmailCapture: boolean; // Whether to capture reader emails
  deliverySettings: {
    requireEmail: boolean; // Require email before download
    allowAnonymous: boolean; // Allow anonymous downloads
    maxDownloads?: number; // Max downloads per link
    expiryDate?: Date; // When the book becomes unavailable
  };
}

export enum BookStatus {
  DRAFT = "draft",
  UPLOADING = "uploading",
  PROCESSING = "processing",
  READY = "ready",
  ERROR = "error",
  DELETED = "deleted",
}

export enum BookFileType {
  EPUB = "epub",
  PDF = "pdf",
  AUDIO = "audio",
}

export enum BookType {
  ADVANCE_COPY = "advance_copy",
  EXCERPT = "excerpt",
  FULL_BOOK = "full_book",
  NOVELLA = "novella",
  PREVIEW = "preview",
  SAMPLE = "sample",
  SHORT_STORY = "short_story",
  TEASER = "teaser",
  OTHER = "other",
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
      maxlength: [2000000, "Description cannot exceed 2000000 characters"],
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

    // New book information fields
    label: {
      type: String,
      trim: true,
      maxlength: [200, "Label cannot exceed 200 characters"],
    },
    series: {
      type: String,
      trim: true,
      maxlength: [100, "Series name cannot exceed 100 characters"],
    },
    volume: {
      type: String,
      trim: true,
      maxlength: [50, "Volume cannot exceed 50 characters"],
    },
    tagline: {
      type: String,
      trim: true,
      maxlength: [300, "Tagline cannot exceed 300 characters"],
    },
    notesToReaders: {
      type: String,
      trim: true,
      maxlength: [
        2000000,
        "Notes to readers cannot exceed 2000000   characters",
      ],
    },
    bookType: {
      type: String,
      enum: Object.values(BookType),
      default: BookType.FULL_BOOK,
    },
    ebookType: {
      type: String,
      enum: ["doc", "audio"],
      default: "doc",
    },
    narrator: {
      type: String,
      trim: true,
      maxlength: [100, "Narrator name cannot exceed 100 characters"],
    },
    audioQuality: {
      type: String,
      trim: true,
      maxlength: [50, "Audio quality cannot exceed 50 characters"],
    },
    coverImageKey: {
      type: String,
      trim: true,
    },
    coverImageName: {
      type: String,
      trim: true,
    },
    coverImageSize: {
      type: Number,
      min: [0, "Cover image size must be 0 or greater"],
    },
    epubFile: {
      fileKey: { type: String, required: false },
      fileName: { type: String, required: false },
      fileSize: {
        type: Number,
        required: false,
        min: [0, "File size must be 0 or greater"],
      },
      checksum: {
        type: String,
        required: false,
        match: [/^[a-f0-9]{64}$/, "Checksum must be a valid SHA-256 hash"],
      },
      uploadedAt: { type: Date, default: Date.now },
    },
    pdfFile: {
      fileKey: { type: String, required: false },
      fileName: { type: String, required: false },
      fileSize: {
        type: Number,
        required: false,
        min: [0, "File size must be 0 or greater"],
      },
      checksum: {
        type: String,
        required: false,
        match: [/^[a-f0-9]{64}$/, "Checksum must be a valid SHA-256 hash"],
      },
      uploadedAt: { type: Date, default: Date.now },
    },
    audioFile: {
      fileKey: { type: String, required: false },
      fileName: { type: String, required: false },
      fileSize: {
        type: Number,
        required: false,
        min: [0, "File size must be 0 or greater"],
      },
      checksum: {
        type: String,
        required: false,
        match: [/^[a-f0-9]{64}$/, "Checksum must be a valid SHA-256 hash"],
      },
      uploadedAt: { type: Date, default: Date.now },
    },
    // Legacy fields for backward compatibility
    fileKey: {
      type: String,
    },
    fileName: {
      type: String,
    },
    fileSize: {
      type: Number,
      min: [0, "File size must be 0 or greater"],
    },
    fileType: {
      type: String,
      enum: Object.values(BookFileType),
    },
    checksum: {
      type: String,
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
    // Delivery features
    isPublic: {
      type: Boolean,
      default: false,
    },
    allowEmailCapture: {
      type: Boolean,
      default: true,
    },
    deliverySettings: {
      requireEmail: {
        type: Boolean,
        default: false,
      },
      allowAnonymous: {
        type: Boolean,
        default: true,
      },
      maxDownloads: {
        type: Number,
        min: [1, "Max downloads must be at least 1"],
      },
      expiryDate: {
        type: Date,
      },
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

// Virtual for file URL (prioritizes epub, then PDF, then audio, then legacy fileKey)
bookSchema.virtual("fileUrl").get(function () {
  const fileKey =
    this.epubFile?.fileKey ||
    this.pdfFile?.fileKey ||
    this.audioFile?.fileKey ||
    this.fileKey;
  // Return GCS public URL - signed URLs will be generated when serving files
  if (!fileKey) return undefined;
  // Use GCS public URL format
  const bucketName = process.env.GCS_BUCKET_NAME || "";
  return bucketName
    ? `https://storage.googleapis.com/${bucketName}/${fileKey}`
    : undefined;
});

// Update lastModified before saving
bookSchema.pre("save", function (next) {
  this.lastModified = new Date();
  next();
});

export const Book = mongoose.model<IBook>("Book", bookSchema);
