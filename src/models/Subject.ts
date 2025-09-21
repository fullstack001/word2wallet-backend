import mongoose, { Schema } from "mongoose";
import { ISubject, ISubjectModel } from "../types";

const subjectSchema = new Schema<ISubject>(
  {
    name: {
      type: String,
      required: [true, "Subject name is required"],
      trim: true,
      maxlength: [100, "Subject name cannot exceed 100 characters"],
      unique: true,
    },
    description: {
      type: String,
      required: [true, "Subject description is required"],
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    isActive: {
      type: Boolean,
      default: true,
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

// Virtual for course count
subjectSchema.virtual("courseCount", {
  ref: "Course",
  localField: "_id",
  foreignField: "subject",
  count: true,
});

// Indexes for better query performance
subjectSchema.index({ name: 1 });
subjectSchema.index({ isActive: 1 });
subjectSchema.index({ createdBy: 1 });

// Static method to find active subjects
subjectSchema.statics.findActive = function () {
  return this.find({ isActive: true }).sort({ name: 1 });
};

export const Subject = mongoose.model<ISubject, ISubjectModel>(
  "Subject",
  subjectSchema
);
