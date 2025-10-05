import mongoose, { Schema } from "mongoose";

export interface ILandingPage {
  _id: string;
  bookId: string;
  userId: string; // Author who created the landing page
  title: string;
  description?: string;
  slug: string; // Unique URL slug
  url?: string; // Virtual field for full URL
  isActive: boolean;
  design: {
    theme: "default" | "minimal" | "modern" | "classic";
    primaryColor: string;
    backgroundColor: string;
    textColor: string;
    fontFamily: string;
    customCSS?: string;
  };
  content: {
    heroTitle: string;
    heroSubtitle?: string;
    heroImage?: string;
    features?: string[];
    testimonials?: Array<{
      name: string;
      text: string;
      avatar?: string;
    }>;
    callToAction: {
      text: string;
      buttonText: string;
      buttonColor: string;
    };
    aboutAuthor?: {
      name: string;
      bio: string;
      avatar?: string;
      socialLinks?: {
        twitter?: string;
        facebook?: string;
        instagram?: string;
        website?: string;
      };
    };
    faq?: Array<{
      question: string;
      answer: string;
    }>;
  };
  seo: {
    metaTitle?: string;
    metaDescription?: string;
    metaKeywords?: string[];
    ogImage?: string;
  };
  analytics: {
    totalViews: number;
    totalConversions: number;
    uniqueVisitors: number;
    lastAccessed?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const landingPageSchema = new Schema<ILandingPage>(
  {
    bookId: {
      type: String,
      required: [true, "Book ID is required"],
      ref: "Book",
    },
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
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[a-z0-9-]+$/,
        "Slug can only contain lowercase letters, numbers, and hyphens",
      ],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    design: {
      theme: {
        type: String,
        enum: ["default", "minimal", "modern", "classic"],
        default: "default",
      },
      primaryColor: {
        type: String,
        default: "#3B82F6",
        match: [/^#[0-9A-Fa-f]{6}$/, "Primary color must be a valid hex color"],
      },
      backgroundColor: {
        type: String,
        default: "#FFFFFF",
        match: [
          /^#[0-9A-Fa-f]{6}$/,
          "Background color must be a valid hex color",
        ],
      },
      textColor: {
        type: String,
        default: "#1F2937",
        match: [/^#[0-9A-Fa-f]{6}$/, "Text color must be a valid hex color"],
      },
      fontFamily: {
        type: String,
        default: "Inter",
        enum: ["Inter", "Roboto", "Open Sans", "Lato", "Poppins", "Montserrat"],
      },
      customCSS: {
        type: String,
        maxlength: [10000, "Custom CSS cannot exceed 10000 characters"],
      },
    },
    content: {
      heroTitle: {
        type: String,
        required: [true, "Hero title is required"],
        trim: true,
        maxlength: [200, "Hero title cannot exceed 200 characters"],
      },
      heroSubtitle: {
        type: String,
        trim: true,
        maxlength: [500, "Hero subtitle cannot exceed 500 characters"],
      },
      heroImage: {
        type: String,
      },
      features: [
        {
          type: String,
          trim: true,
          maxlength: [200, "Feature cannot exceed 200 characters"],
        },
      ],
      testimonials: [
        {
          name: {
            type: String,
            required: true,
            trim: true,
            maxlength: [100, "Testimonial name cannot exceed 100 characters"],
          },
          text: {
            type: String,
            required: true,
            trim: true,
            maxlength: [500, "Testimonial text cannot exceed 500 characters"],
          },
          avatar: {
            type: String,
          },
        },
      ],
      callToAction: {
        text: {
          type: String,
          required: [true, "CTA text is required"],
          trim: true,
          maxlength: [200, "CTA text cannot exceed 200 characters"],
        },
        buttonText: {
          type: String,
          required: [true, "CTA button text is required"],
          trim: true,
          maxlength: [50, "CTA button text cannot exceed 50 characters"],
        },
        buttonColor: {
          type: String,
          default: "#3B82F6",
          match: [
            /^#[0-9A-Fa-f]{6}$/,
            "Button color must be a valid hex color",
          ],
        },
      },
      aboutAuthor: {
        name: {
          type: String,
          trim: true,
          maxlength: [100, "Author name cannot exceed 100 characters"],
        },
        bio: {
          type: String,
          trim: true,
          maxlength: [1000, "Author bio cannot exceed 1000 characters"],
        },
        avatar: {
          type: String,
        },
        socialLinks: {
          twitter: {
            type: String,
            trim: true,
          },
          facebook: {
            type: String,
            trim: true,
          },
          instagram: {
            type: String,
            trim: true,
          },
          website: {
            type: String,
            trim: true,
          },
        },
      },
      faq: [
        {
          question: {
            type: String,
            required: true,
            trim: true,
            maxlength: [200, "FAQ question cannot exceed 200 characters"],
          },
          answer: {
            type: String,
            required: true,
            trim: true,
            maxlength: [1000, "FAQ answer cannot exceed 1000 characters"],
          },
        },
      ],
    },
    seo: {
      metaTitle: {
        type: String,
        trim: true,
        maxlength: [60, "Meta title cannot exceed 60 characters"],
      },
      metaDescription: {
        type: String,
        trim: true,
        maxlength: [160, "Meta description cannot exceed 160 characters"],
      },
      metaKeywords: [
        {
          type: String,
          trim: true,
          maxlength: [50, "Meta keyword cannot exceed 50 characters"],
        },
      ],
      ogImage: {
        type: String,
      },
    },
    analytics: {
      totalViews: {
        type: Number,
        default: 0,
        min: [0, "Total views cannot be negative"],
      },
      totalConversions: {
        type: Number,
        default: 0,
        min: [0, "Total conversions cannot be negative"],
      },
      uniqueVisitors: {
        type: Number,
        default: 0,
        min: [0, "Unique visitors cannot be negative"],
      },
      lastAccessed: {
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
landingPageSchema.index({ userId: 1 });
landingPageSchema.index({ bookId: 1 });
landingPageSchema.index({ slug: 1 }, { unique: true });
landingPageSchema.index({ isActive: 1 });
landingPageSchema.index({ createdAt: -1 });

// Virtual for full URL
landingPageSchema.virtual("url").get(function () {
  return `${
    process.env.FRONTEND_URL || "http://localhost:3000"
  }/landing/${this.slug}`;
});

export const LandingPage = mongoose.model<ILandingPage>(
  "LandingPage",
  landingPageSchema
);
