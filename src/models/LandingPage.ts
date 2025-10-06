import mongoose, { Schema } from "mongoose";
import {
  LandingPageType,
  LandingPageSettings,
  DownloadPageSettings,
  EmailSignupPageSettings,
  RestrictedPageSettings,
  UniversalBookLinkSettings,
} from "../types/landingPage";

export interface ILandingPage {
  _id: string;
  bookId: string;
  userId: string;
  type: LandingPageType;
  isActive: boolean;
  slug: string;
  url?: string;
  title?: string; // Virtual property based on page type

  // Type-specific settings
  downloadPage?: DownloadPageSettings;
  emailSignupPage?: EmailSignupPageSettings;
  restrictedPage?: RestrictedPageSettings;
  universalBookLink?: UniversalBookLinkSettings;

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
    type: {
      type: String,
      required: [true, "Landing page type is required"],
      enum: {
        values: [
          "simple_download",
          "email_signup",
          "restricted",
          "universal_link",
        ],
        message: "Invalid landing page type",
      },
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

    // Download Page Settings
    downloadPage: {
      pageName: {
        type: String,
        trim: true,
        maxlength: [200, "Page name cannot exceed 200 characters"],
      },
      expirationDate: {
        type: Date,
      },
      downloadLimit: {
        type: Number,
        min: [1, "Download limit must be at least 1"],
      },
      landingPageSettings: {
        pageLayout: {
          type: String,
          default: "WordToWallet Default",
        },
        include3DEffects: {
          type: Boolean,
          default: true,
        },
        pageTheme: {
          type: String,
          default: "WordToWallet Black & Gray",
        },
        accentColor: {
          type: String,
          default: "Default",
        },
        pageTitle: {
          type: String,
          default: "Get your FREE copy of {{title}}.",
        },
        buttonText: {
          type: String,
          default: "Get My Book",
        },
        heading1: {
          type: {
            type: String,
            enum: ["none", "tagline", "newsletter", "get_free_copy", "custom"],
            default: "tagline",
          },
          customText: {
            type: String,
            trim: true,
          },
        },
        heading2: {
          type: {
            type: String,
            enum: ["none", "tagline", "subscribers", "get_free_copy", "custom"],
            default: "get_free_copy",
          },
          customText: {
            type: String,
            trim: true,
          },
        },
        popupMessage: {
          type: {
            type: String,
            enum: ["none", "default", "custom"],
            default: "default",
          },
          customText: {
            type: String,
            trim: true,
          },
        },
        pageText: {
          type: {
            type: String,
            enum: ["none", "book_description", "custom"],
            default: "book_description",
          },
          customText: {
            type: String,
            trim: true,
          },
        },
      },
      advancedSettings: {
        allowMultipleDownloads: {
          type: Boolean,
          default: false,
        },
        requireEmailVerification: {
          type: Boolean,
          default: false,
        },
        customRedirectUrl: {
          type: String,
          trim: true,
        },
      },
    },

    // Email Signup Page Settings
    emailSignupPage: {
      pageName: {
        type: String,
        trim: true,
        maxlength: [200, "Page name cannot exceed 200 characters"],
      },
      mailingListAction: {
        type: String,
        enum: ["none", "optional", "required"],
        default: "required",
      },
      integrationList: {
        type: String,
        default: "no_list",
      },
      expirationDate: {
        type: Date,
      },
      claimLimit: {
        type: Number,
        min: [1, "Claim limit must be at least 1"],
      },
      askFirstName: {
        type: Boolean,
        default: true,
      },
      askLastName: {
        type: Boolean,
        default: false,
      },
      confirmEmail: {
        type: Boolean,
        default: true,
      },
      landingPageSettings: {
        pageLayout: {
          type: String,
          default: "WordToWallet Default",
        },
        include3DEffects: {
          type: Boolean,
          default: true,
        },
        pageTheme: {
          type: String,
          default: "WordToWallet Black & Gray",
        },
        accentColor: {
          type: String,
          default: "Default",
        },
        pageTitle: {
          type: String,
          default: "Get your FREE copy of {{title}}.",
        },
        buttonText: {
          type: String,
          default: "Get My Book",
        },
        heading1: {
          type: {
            type: String,
            enum: ["none", "tagline", "newsletter", "get_free_copy", "custom"],
            default: "tagline",
          },
          customText: {
            type: String,
            trim: true,
          },
        },
        heading2: {
          type: {
            type: String,
            enum: ["none", "tagline", "subscribers", "get_free_copy", "custom"],
            default: "get_free_copy",
          },
          customText: {
            type: String,
            trim: true,
          },
        },
        popupMessage: {
          type: {
            type: String,
            enum: ["none", "default", "custom"],
            default: "default",
          },
          customText: {
            type: String,
            trim: true,
          },
        },
        pageText: {
          type: {
            type: String,
            enum: ["none", "book_description", "custom"],
            default: "book_description",
          },
          customText: {
            type: String,
            trim: true,
          },
        },
      },
      thankYouPageSettings: {
        title: {
          type: String,
          trim: true,
        },
        message: {
          type: String,
          trim: true,
        },
        buttonText: {
          type: String,
          trim: true,
        },
        redirectUrl: {
          type: String,
          trim: true,
        },
      },
      advancedSettings: {
        doubleOptIn: {
          type: Boolean,
          default: false,
        },
        customThankYouMessage: {
          type: String,
          trim: true,
        },
        autoResponder: {
          type: Boolean,
          default: false,
        },
      },
    },

    // Restricted Page Settings
    restrictedPage: {
      pageName: {
        type: String,
        trim: true,
        maxlength: [200, "Page name cannot exceed 200 characters"],
      },
      restrictedList: {
        type: String,
        trim: true,
      },
      redirectUrl: {
        type: String,
        trim: true,
      },
      expirationDate: {
        type: Date,
      },
      downloadLimit: {
        type: Number,
        min: [1, "Download limit must be at least 1"],
      },
      confirmEmail: {
        type: Boolean,
        default: true,
      },
      landingPageSettings: {
        pageLayout: {
          type: String,
          default: "WordToWallet Default",
        },
        include3DEffects: {
          type: Boolean,
          default: true,
        },
        pageTheme: {
          type: String,
          default: "WordToWallet Black & Gray",
        },
        accentColor: {
          type: String,
          default: "Default",
        },
        pageTitle: {
          type: String,
          default: "Get your FREE copy of {{title}}.",
        },
        buttonText: {
          type: String,
          default: "Get My Book",
        },
        heading1: {
          type: {
            type: String,
            enum: ["none", "tagline", "newsletter", "get_free_copy", "custom"],
            default: "tagline",
          },
          customText: {
            type: String,
            trim: true,
          },
        },
        heading2: {
          type: {
            type: String,
            enum: ["none", "tagline", "subscribers", "get_free_copy", "custom"],
            default: "get_free_copy",
          },
          customText: {
            type: String,
            trim: true,
          },
        },
        popupMessage: {
          type: {
            type: String,
            enum: ["none", "default", "custom"],
            default: "default",
          },
          customText: {
            type: String,
            trim: true,
          },
        },
        pageText: {
          type: {
            type: String,
            enum: ["none", "book_description", "custom"],
            default: "book_description",
          },
          customText: {
            type: String,
            trim: true,
          },
        },
      },
      deliveryPageSettings: {
        title: {
          type: String,
          trim: true,
        },
        message: {
          type: String,
          trim: true,
        },
        downloadButtonText: {
          type: String,
          trim: true,
        },
        showDownloadCount: {
          type: Boolean,
          default: false,
        },
      },
      advancedSettings: {
        allowBookmarking: {
          type: Boolean,
          default: false,
        },
        customRestrictionMessage: {
          type: String,
          trim: true,
        },
        requireEmailVerification: {
          type: Boolean,
          default: false,
        },
      },
    },

    // Universal Book Link Settings
    universalBookLink: {
      linkName: {
        type: String,
        trim: true,
        maxlength: [200, "Link name cannot exceed 200 characters"],
      },
      selectedBook: {
        type: String,
        // Note: Required validation is handled at the controller level based on landing page type
      },
      audioSample: {
        type: String,
        default: "no_audio",
      },
      displayEbookLinks: {
        type: Boolean,
        default: true,
      },
      displayAudiobookLinks: {
        type: Boolean,
        default: true,
      },
      displayPaperbackLinks: {
        type: Boolean,
        default: true,
      },
      expirationDate: {
        type: Date,
      },
      landingPageSettings: {
        pageLayout: {
          type: String,
          default: "WordToWallet Default",
        },
        include3DEffects: {
          type: Boolean,
          default: true,
        },
        pageTheme: {
          type: String,
          default: "WordToWallet Black & Gray",
        },
        accentColor: {
          type: String,
          default: "Default",
        },
        pageTitle: {
          type: String,
          default: "Get your FREE copy of {{title}}.",
        },
        buttonText: {
          type: String,
          default: "Get My Book",
        },
        heading1: {
          type: {
            type: String,
            enum: ["none", "tagline", "newsletter", "get_free_copy", "custom"],
            default: "tagline",
          },
          customText: {
            type: String,
            trim: true,
          },
        },
        heading2: {
          type: {
            type: String,
            enum: ["none", "tagline", "subscribers", "get_free_copy", "custom"],
            default: "get_free_copy",
          },
          customText: {
            type: String,
            trim: true,
          },
        },
        popupMessage: {
          type: {
            type: String,
            enum: ["none", "default", "custom"],
            default: "default",
          },
          customText: {
            type: String,
            trim: true,
          },
        },
        pageText: {
          type: {
            type: String,
            enum: ["none", "book_description", "custom"],
            default: "book_description",
          },
          customText: {
            type: String,
            trim: true,
          },
        },
      },
      advancedSettings: {
        trackClicks: {
          type: Boolean,
          default: true,
        },
        customDomain: {
          type: String,
          trim: true,
        },
        analyticsEnabled: {
          type: Boolean,
          default: true,
        },
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
landingPageSchema.index({ type: 1 });
landingPageSchema.index({ slug: 1 }, { unique: true });
landingPageSchema.index({ isActive: 1 });
landingPageSchema.index({ createdAt: -1 });
landingPageSchema.index({ userId: 1, type: 1 });
landingPageSchema.index({ userId: 1, bookId: 1 });

// Virtual for full URL
landingPageSchema.virtual("url").get(function () {
  return `${
    process.env.READER_FRONTEND_URL || "http://localhost:3000"
  }/landing/${this.id}`;
});

// Virtual for page title based on type
landingPageSchema.virtual("title").get(function () {
  switch (this.type) {
    case "simple_download":
      return this.downloadPage?.pageName || "Download Page";
    case "email_signup":
      return this.emailSignupPage?.pageName || "Email Signup Page";
    case "restricted":
      return this.restrictedPage?.pageName || "Restricted Page";
    case "universal_link":
      return this.universalBookLink?.linkName || "Universal Book Link";
    default:
      return "Landing Page";
  }
});

export const LandingPage = mongoose.model<ILandingPage>(
  "LandingPage",
  landingPageSchema
);
