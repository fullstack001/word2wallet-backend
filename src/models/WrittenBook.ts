import mongoose, { Schema, Document } from "mongoose";

export interface IChapter {
  id: string;
  title: string;
  description: string;
  content: string;
}

export interface IWrittenBook extends Document {
  _id: string;
  userId: string;
  title: string;
  description?: string;
  author: string;
  chapters: IChapter[];
  files: {
    epub?: {
      path: string;
      url: string;
      size?: number;
    };
    pdf?: {
      path: string;
      url: string;
      size?: number;
    };
  };
  format: string[]; // ['epub', 'pdf']
  status: "draft" | "published";
  createdAt: Date;
  updatedAt: Date;
}

const chapterSchema = new Schema({
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
});

const writtenBookSchema = new Schema<IWrittenBook>(
  {
    userId: {
      type: String,
      required: [true, "User ID is required"],
      ref: "User",
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    author: {
      type: String,
      required: [true, "Author is required"],
      trim: true,
    },
    chapters: {
      type: [chapterSchema],
      required: true,
      validate: {
        validator: (v: IChapter[]) => v.length > 0,
        message: "At least one chapter is required",
      },
    },
    files: {
      epub: {
        path: String,
        url: String,
        size: Number,
      },
      pdf: {
        path: String,
        url: String,
        size: Number,
      },
    },
    format: {
      type: [String],
      required: true,
      validate: {
        validator: (v: string[]) =>
          v.length > 0 && v.every((f) => ["epub", "pdf"].includes(f)),
        message: "Format must contain at least one of: epub, pdf",
      },
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "published",
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
writtenBookSchema.index({ userId: 1, createdAt: -1 });
writtenBookSchema.index({ title: 1 });

export const WrittenBook = mongoose.model<IWrittenBook>(
  "WrittenBook",
  writtenBookSchema
);
