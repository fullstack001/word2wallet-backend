import mongoose, { Schema } from "mongoose";
import {
  ICourse,
  ICourseModel,
  EpubMetadata,
  MultimediaContent,
  MediaFile,
} from "../types";

const epubMetadataSchema = new Schema<EpubMetadata>(
  {
    title: {
      type: String,
      required: true,
    },
    author: {
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
    description: {
      type: String,
      required: [true, "Course description is required"],
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
    thumbnail: {
      type: String, // Path to thumbnail image
    },
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

// Indexes for better query performance
courseSchema.index({ title: 1 });
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
courseSchema.virtual("url").get(function () {
  const course = this as ICourse;
  return `/api/courses/${course._id}`;
});

export const Course = mongoose.model<ICourse, ICourseModel>(
  "Course",
  courseSchema
);
