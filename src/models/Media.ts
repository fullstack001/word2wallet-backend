import mongoose, { Schema } from "mongoose";

export enum MediaType {
  IMAGE = "image",
  AUDIO = "audio",
  VIDEO = "video",
}

export enum MediaSource {
  UPLOADED = "uploaded",
  GENERATED = "generated",
}

export interface IMedia extends mongoose.Document {
  title: string;
  description?: string;
  type: MediaType;
  source: MediaSource;
  fileName: string;
  filePath: string;
  publicUrl: string;
  mimeType: string;
  size: number; // in bytes
  width?: number; // for images/videos
  height?: number; // for images/videos
  duration?: number; // for audio/video in seconds
  generatedPrompt?: string; // for AI-generated media
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const mediaSchema = new Schema<IMedia>(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    type: {
      type: String,
      enum: Object.values(MediaType),
      required: [true, "Media type is required"],
    },
    source: {
      type: String,
      enum: Object.values(MediaSource),
      required: [true, "Media source is required"],
      default: MediaSource.UPLOADED,
    },
    fileName: {
      type: String,
      required: [true, "File name is required"],
    },
    filePath: {
      type: String,
      required: [true, "File path is required"],
    },
    publicUrl: {
      type: String,
      required: [true, "Public URL is required"],
    },
    mimeType: {
      type: String,
      required: [true, "MIME type is required"],
    },
    size: {
      type: Number,
      required: [true, "File size is required"],
      min: [0, "File size cannot be negative"],
    },
    width: {
      type: Number,
      min: [0, "Width cannot be negative"],
    },
    height: {
      type: Number,
      min: [0, "Height cannot be negative"],
    },
    duration: {
      type: Number,
      min: [0, "Duration cannot be negative"],
    },
    generatedPrompt: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator is required"],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
mediaSchema.index({ createdBy: 1, createdAt: -1 });
mediaSchema.index({ type: 1 });
mediaSchema.index({ source: 1 });
mediaSchema.index({ title: "text", description: "text" });

export const Media = mongoose.model<IMedia>("Media", mediaSchema);

