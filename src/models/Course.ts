import mongoose, { Schema } from "mongoose";
import {
  ICourse,
  ICourseModel,
  IChapter,
  EpubMetadata,
  MultimediaContent,
  MediaFile,
} from "../types";

const chapterSchema = new Schema<IChapter>(
  {
    id: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const epubMetadataSchema = new Schema<EpubMetadata>(
  {
    title: {
      type: String,
      required: true,
    },
    creator: {
      type: String,
      required: true,
    },
    publisher: {
      type: String,
    },
    language: {
      type: String,
      default: "en",
    },
    description: {
      type: String,
    },
    coverImage: {
      type: String,
    },
    totalPages: {
      type: Number,
    },
    fileSize: {
      type: Number,
    },
    lastModified: {
      type: Date,
    },
  },
  { _id: false }
);

const mediaFileSchema = new Schema<MediaFile>(
  {
    id: {
      type: String,
      required: true,
    },
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    path: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const multimediaContentSchema = new Schema<MultimediaContent>(
  {
    images: [mediaFileSchema],
    audio: [mediaFileSchema],
    video: [mediaFileSchema],
  },
  { _id: false }
);

const courseSchema = new Schema<ICourse>(
  {
    title: {
      type: String,
      required: [true, "Course title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    slug: {
      type: String,
      unique: true,
      sparse: true, // This allows multiple null values
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    subject: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: [true, "Subject is required"],
    },
    epubFile: {
      type: String, // Path to the EPUB file
    },
    epubMetadata: {
      type: epubMetadataSchema,
    },
    epubCover: {
      type: String, // Path to cover image
    },
    chapters: [chapterSchema],
    multimediaContent: {
      type: multimediaContentSchema,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    googleDocLink: {
      type: String,
      trim: true,
      validate: {
        validator: function (v: string) {
          if (!v) return true; // Allow empty
          return /^https:\/\/docs\.google\.com\//.test(v);
        },
        message: "Google Doc link must be a valid Google Docs URL",
      },
    },
    googleClassroomLink: {
      type: String,
      trim: true,
      validate: {
        validator: function (v: string) {
          if (!v) return true; // Allow empty
          return /^https:\/\/classroom\.google\.com\//.test(v);
        },
        message: "Google Classroom link must be a valid Google Classroom URL",
      },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Pre-save middleware to generate slug from title
courseSchema.pre<ICourse>("save", function (next) {
  if (this.isModified("title") && !this.slug) {
    // Generate slug from title
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
  }
  next();
});

// Indexes for better query performance
courseSchema.index({ title: 1 });
courseSchema.index({ slug: 1 }, { unique: true, sparse: true });
courseSchema.index({ subject: 1 });
courseSchema.index({ isActive: 1 });
courseSchema.index({ isPublished: 1 });
courseSchema.index({ createdBy: 1 });
courseSchema.index({ createdAt: -1 });

// Text search index
courseSchema.index({
  title: "text",
  description: "text",
});

// Static method to find published courses
courseSchema.statics.findPublished = function () {
  return this.find({ isActive: true, isPublished: true })
    .populate("subject", "name")
    .populate("createdBy", "firstName lastName")
    .sort({ createdAt: -1 });
};

// Static method to search courses
courseSchema.statics.search = function (query: string) {
  return this.find({
    $text: { $search: query },
    isActive: true,
    isPublished: true,
  })
    .populate("subject", "name")
    .populate("createdBy", "firstName lastName")
    .sort({ score: { $meta: "textScore" } });
};

// Virtual for course URL
courseSchema.virtual<ICourse>("url").get(function () {
  return `/api/courses/${this._id}`;
});

export const Course = mongoose.model<ICourse, ICourseModel>(
  "Course",
  courseSchema
);
