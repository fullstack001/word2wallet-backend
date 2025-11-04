import mongoose, { Schema, Model } from "mongoose";
import { IBlog, IBlogModel } from "../types";

const blogSchema = new Schema<IBlog>(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    content: {
      type: String,
      required: [true, "Content is required"],
    },
    excerpt: {
      type: String,
      trim: true,
      maxlength: [500, "Excerpt cannot exceed 500 characters"],
    },
    featuredImage: {
      type: String,
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    views: {
      type: Number,
      default: 0,
    },
    reactionsCount: {
      type: Number,
      default: 0,
    },
    commentsCount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    publishedAt: {
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
blogSchema.index({ slug: 1 }, { unique: true });
blogSchema.index({ status: 1, isActive: 1 });
blogSchema.index({ author: 1 });
blogSchema.index({ tags: 1 });
blogSchema.index({ publishedAt: -1 });
blogSchema.index({ createdAt: -1 });

// Virtual for published blogs
blogSchema.virtual("isPublished").get(function () {
  return this.status === "published";
});

// Generate slug from title before saving
blogSchema.pre("save", function (next) {
  if (this.isModified("title") && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  // Set publishedAt when status changes to published
  if (
    this.isModified("status") &&
    this.status === "published" &&
    !this.publishedAt
  ) {
    this.publishedAt = new Date();
  }

  next();
});

// Method to increment views
blogSchema.methods.incrementViews = async function () {
  this.views += 1;
  return this.save();
};

// Static method to find published blogs
blogSchema.statics.findPublished = function () {
  return this.find({
    status: "published",
    isActive: true,
  }).populate("author", "firstName lastName email");
};

// Static method to find related blogs
blogSchema.statics.findRelated = function (
  blogId: string,
  tags: string[],
  limit = 5
) {
  return this.find({
    _id: { $ne: blogId },
    status: "published",
    isActive: true,
    tags: { $in: tags },
  })
    .populate("author", "firstName lastName email")
    .limit(limit)
    .sort({ publishedAt: -1, createdAt: -1 });
};

export const Blog = mongoose.model<IBlog, IBlogModel>("Blog", blogSchema);
