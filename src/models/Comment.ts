import mongoose, { Schema } from "mongoose";
import { IComment } from "../types";

const commentSchema = new Schema<IComment>(
  {
    blog: {
      type: Schema.Types.ObjectId,
      ref: "Blog",
      required: [true, "Blog is required"],
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false, // Optional for anonymous comments
    },
    // Anonymous comment fields
    anonymousName: {
      type: String,
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    anonymousEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    content: {
      type: String,
      required: [true, "Content is required"],
      trim: true,
      maxlength: [2000, "Comment cannot exceed 2000 characters"],
    },
    parent: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    likes: {
      type: Number,
      default: 0,
    },
    likedBy: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
commentSchema.index({ blog: 1, createdAt: -1 });
commentSchema.index({ user: 1 });
commentSchema.index({ anonymousEmail: 1 });
commentSchema.index({ parent: 1 });
commentSchema.index({ isActive: 1 });

// Populate replies (children comments)
commentSchema.virtual("replies", {
  ref: "Comment",
  localField: "_id",
  foreignField: "parent",
});

// Method to toggle like
commentSchema.methods.toggleLike = async function (userId: string) {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const index = this.likedBy.indexOf(userObjectId);

  if (index > -1) {
    // Unlike
    this.likedBy.splice(index, 1);
    this.likes = Math.max(0, this.likes - 1);
  } else {
    // Like
    this.likedBy.push(userObjectId);
    this.likes += 1;
  }

  return this.save();
};

export const Comment = mongoose.model<IComment>("Comment", commentSchema);
