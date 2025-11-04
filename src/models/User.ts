import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";
import {
  IUser,
  UserRole,
  SubscriptionStatus,
  SubscriptionPlan,
} from "../types";

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
      select: false, // Don't include password in queries by default
    },
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      maxlength: [50, "First name cannot exceed 50 characters"],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      maxlength: [50, "Last name cannot exceed 50 characters"],
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    emailUnsubscribed: {
      type: Boolean,
      default: false,
    },
    emailUnsubscribedAt: {
      type: Date,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      sparse: true,
    },
    emailVerificationTokenExpiry: {
      type: Date,
    },
    emailVerificationCode: {
      type: String,
      sparse: true,
    },
    emailVerificationCodeExpiry: {
      type: Date,
    },
    passwordResetToken: {
      type: String,
      sparse: true,
    },
    passwordResetTokenExpiry: {
      type: Date,
    },
    subscription: {
      stripeCustomerId: {
        type: String,
      },
      stripeSubscriptionId: {
        type: String,
      },
      status: {
        type: String,
        enum: Object.values(SubscriptionStatus),
      },
      plan: {
        type: String,
        enum: Object.values(SubscriptionPlan),
      },
      trialStart: {
        type: Date,
      },
      trialEnd: {
        type: Date,
      },
      currentPeriodStart: {
        type: Date,
      },
      currentPeriodEnd: {
        type: Date,
      },
      cancelAtPeriodEnd: {
        type: Boolean,
        default: false,
      },
      canceledAt: {
        type: Date,
      },
      cancellationReason: {
        type: String,
      },
      cancellationFeedback: {
        type: String,
      },
    },
    // Track trial eligibility
    trialEligible: {
      type: Boolean,
      default: true,
    },
    // Track if user has ever canceled a subscription
    hasCanceledSubscription: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for full name
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Index for better query performance
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

// Hash password before saving
userSchema.pre("save", async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified("password")) return next();

  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Update last login method
userSchema.methods.updateLastLogin = function () {
  this.lastLogin = new Date();
  return this.save();
};

// Generate email verification token method
userSchema.methods.generateEmailVerificationToken = function () {
  const crypto = require("crypto");
  const token = crypto.randomBytes(32).toString("hex");
  // Generate 6-digit verification code
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  this.emailVerificationToken = token;
  this.emailVerificationCode = code;
  // Token and code expire in 24 hours
  this.emailVerificationTokenExpiry = new Date(
    Date.now() + 24 * 60 * 60 * 1000
  );
  this.emailVerificationCodeExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return this.save();
};

// Verify email method
userSchema.methods.verifyEmail = function () {
  this.emailVerified = true;
  this.emailVerificationToken = undefined;
  this.emailVerificationTokenExpiry = undefined;
  this.emailVerificationCode = undefined;
  this.emailVerificationCodeExpiry = undefined;
  return this.save();
};

// Generate password reset token method
userSchema.methods.generatePasswordResetToken = function () {
  const crypto = require("crypto");
  const token = crypto.randomBytes(32).toString("hex");

  this.passwordResetToken = token;
  // Token expires in 1 hour
  this.passwordResetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
  return this.save();
};

// Clear password reset token method
userSchema.methods.clearPasswordResetToken = function () {
  this.passwordResetToken = undefined;
  this.passwordResetTokenExpiry = undefined;
  return this.save();
};

// Static method to find user by email
userSchema.statics.findByEmail = function (email: string) {
  return this.findOne({ email: email.toLowerCase() }).select("+password");
};

// Transform output to remove sensitive data
userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.__v;
  return userObject;
};

export const User = mongoose.model<IUser>("User", userSchema);
