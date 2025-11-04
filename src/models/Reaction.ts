import mongoose, { Schema } from "mongoose";
import { IReaction } from "../types";

const reactionSchema = new Schema<IReaction>(
  {
    blog: {
      type: Schema.Types.ObjectId,
      ref: "Blog",
      required: [true, "Blog is required"],
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    type: {
      type: String,
      enum: ["like", "love", "thumbsup", "thumbsdown"],
      default: "like",
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index to ensure one reaction per user per blog
reactionSchema.index({ blog: 1, user: 1 }, { unique: true });
reactionSchema.index({ blog: 1, type: 1 });
reactionSchema.index({ user: 1 });

export const Reaction = mongoose.model<IReaction>("Reaction", reactionSchema);

