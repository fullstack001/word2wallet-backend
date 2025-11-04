import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import { User } from "../models/User";
import { JWTUtils } from "../utils/jwt";
import { UserRole } from "../types";
import { CustomError } from "../middleware/errorHandler";
import { AuthRequest } from "../types";
import { EmailService } from "../services/emailService";

export class AuthController {
  /**
   * Register a new user
   */
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { email, password, firstName, lastName, role } = req.body;
      console.log(email, password, firstName, lastName, role);

      // Check if user already exists
      const existingUser = await User.findOne({ email: email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User already exists with this email",
        });
      }

      // Create new user
      const user = new User({
        email: email,
        password,
        firstName,
        lastName,
        role: role || UserRole.USER,
        emailVerified: false,
      });

      await user.save();

      // Generate email verification token and code, then send verification email
      try {
        await user.generateEmailVerificationToken();
        await EmailService.sendEmailVerificationEmail(
          user,
          user.emailVerificationToken!,
          user.emailVerificationCode!
        );
      } catch (emailError) {
        // If email fails, still return success but log error
        console.error("Failed to send verification email:", emailError);
      }

      // Don't return tokens yet - user must verify email first
      res.status(201).json({
        success: true,
        message:
          "Registration successful! Please check your email for the verification code.",
        data: {
          email: user.email,
          requiresVerification: true,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Login user
   */
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { email, password } = req.body;

      // Find user and include password
      const user = await User.findOne({ email: email }).select("+password");
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: "Account is deactivated",
        });
      }

      // Check password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      // Check if email is verified, if not, send verification email
      if (!user.emailVerified) {
        try {
          // Generate new verification token if expired or doesn't exist
          if (
            !user.emailVerificationToken ||
            (user.emailVerificationTokenExpiry &&
              user.emailVerificationTokenExpiry < new Date())
          ) {
            await user.generateEmailVerificationToken();
          }
          await EmailService.sendEmailVerificationEmail(
            user,
            user.emailVerificationToken!,
            user.emailVerificationCode!
          );
        } catch (emailError) {
          // Log error but don't fail login if email fails
          console.error("Failed to send verification email:", emailError);
        }
      }

      // Generate tokens
      const tokens = JWTUtils.generateTokenPair(
        user._id.toString(),
        user.email,
        user.role
      );

      // Update last login
      await user.updateLastLogin();

      res.json({
        success: true,
        message: user.emailVerified
          ? "Login successful"
          : "Login successful. Please verify your email address. A verification email has been sent.",
        data: {
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            fullName: user.fullName,
            lastLogin: user.lastLogin,
            subscription: user.subscription,
            emailVerified: user.emailVerified,
          },
          tokens,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Refresh access token
   */
  static async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: "Refresh token is required",
        });
      }

      // Verify refresh token
      const payload = JWTUtils.verifyRefreshToken(refreshToken);

      // Find user
      const user = await User.findById(payload.userId);
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: "Invalid refresh token",
        });
      }

      // Generate new tokens
      const tokens = JWTUtils.generateTokenPair(
        user._id.toString(),
        user.email,
        user.role
      );

      res.json({
        success: true,
        message: "Token refreshed successfully",
        data: { tokens },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get current user profile
   */
  static async getProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      res.json({
        success: true,
        message: "Profile retrieved successfully",
        data: {
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            fullName: user.fullName,
            lastLogin: user.lastLogin,
            createdAt: user.createdAt,
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const { firstName, lastName } = req.body;
      const updates: any = {};

      if (firstName) updates.firstName = firstName;
      if (lastName) updates.lastName = lastName;

      const updatedUser = await User.findByIdAndUpdate(user._id, updates, {
        new: true,
        runValidators: true,
      });

      res.json({
        success: true,
        message: "Profile updated successfully",
        data: {
          user: {
            id: updatedUser!._id,
            email: updatedUser!.email,
            firstName: updatedUser!.firstName,
            lastName: updatedUser!.lastName,
            role: updatedUser!.role,
            fullName: updatedUser!.fullName,
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Change password
   */
  static async changePassword(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const { currentPassword, newPassword } = req.body;

      // Get user with password
      const userWithPassword = await User.findById(user._id).select(
        "+password"
      );
      if (!userWithPassword) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await userWithPassword.comparePassword(
        currentPassword
      );
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: "Current password is incorrect",
        });
      }

      // Update password
      userWithPassword.password = newPassword;
      await userWithPassword.save();

      res.json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Logout user (client-side token removal)
   */
  static async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // In a stateless JWT system, logout is typically handled client-side
      // by removing the token from storage. However, you could implement
      // a token blacklist here if needed.

      res.json({
        success: true,
        message: "Logout successful",
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Verify email with token
   */
  static async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: "Verification token is required",
        });
      }

      // Find user by verification token
      const user = await User.findOne({
        emailVerificationToken: token,
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired verification token",
        });
      }

      // Check if token has expired
      if (
        user.emailVerificationTokenExpiry &&
        user.emailVerificationTokenExpiry < new Date()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Verification token has expired. Please request a new verification email.",
        });
      }

      // Check if already verified
      if (user.emailVerified) {
        return res.status(400).json({
          success: false,
          message: "Email is already verified",
        });
      }

      // Verify email
      await user.verifyEmail();

      res.json({
        success: true,
        message: "Email verified successfully",
        data: {
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            fullName: user.fullName,
            emailVerified: user.emailVerified,
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Resend verification email
   */
  static async resendVerificationEmail(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
        });
      }

      // Find user by email
      const user = await User.findOne({ email: email });

      if (!user) {
        // Don't reveal if user exists for security
        return res.json({
          success: true,
          message:
            "If an account exists with this email, a verification email has been sent.",
        });
      }

      // Check if already verified
      if (user.emailVerified) {
        return res.json({
          success: true,
          message: "Email is already verified",
        });
      }

      // Generate new verification token
      await user.generateEmailVerificationToken();

      // Send verification email
      try {
        await EmailService.sendEmailVerificationEmail(
          user,
          user.emailVerificationToken!,
          user.emailVerificationCode!
        );
        res.json({
          success: true,
          message: "Verification email sent successfully",
        });
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
        return res.status(500).json({
          success: false,
          message: "Failed to send verification email. Please try again later.",
        });
      }
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Verify email with code
   */
  static async verifyCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, code } = req.body;

      if (!email || !code) {
        return res.status(400).json({
          success: false,
          message: "Email and verification code are required",
        });
      }

      // Find user by email
      const user = await User.findOne({ email: email });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: "Invalid email or verification code",
        });
      }

      // Check if already verified
      if (user.emailVerified) {
        // User already verified - generate tokens and return
        const tokens = JWTUtils.generateTokenPair(
          user._id.toString(),
          user.email,
          user.role
        );
        await user.updateLastLogin();

        return res.json({
          success: true,
          message: "Email already verified",
          data: {
            user: {
              id: user._id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              role: user.role,
              fullName: user.fullName,
              emailVerified: user.emailVerified,
            },
            tokens,
          },
        });
      }

      // Check if code matches
      if (user.emailVerificationCode !== code) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired verification code",
        });
      }

      // Check if code has expired
      if (
        user.emailVerificationCodeExpiry &&
        user.emailVerificationCodeExpiry < new Date()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Verification code has expired. Please request a new verification code.",
        });
      }

      // Verify email
      await user.verifyEmail();

      // Generate tokens
      const tokens = JWTUtils.generateTokenPair(
        user._id.toString(),
        user.email,
        user.role
      );

      // Update last login
      await user.updateLastLogin();

      res.json({
        success: true,
        message: "Email verified successfully",
        data: {
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            fullName: user.fullName,
            emailVerified: user.emailVerified,
          },
          tokens,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Forgot password - send reset email
   */
  static async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { email } = req.body;

      // Find user by email
      const user = await User.findOne({ email: email });

      // Don't reveal if user exists for security - prevent user enumeration
      // Always return same message for user existence cases
      if (!user) {
        return res.status(500).json({
          success: false,
          message: "Can't find user with this email",
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(500).json({
          success: false,
          message: "User is not active",
        });
      }

      // Generate password reset token
      try {
        await user.generatePasswordResetToken();
      } catch (tokenError) {
        console.error("Failed to generate password reset token:", tokenError);
        return res.status(500).json({
          success: false,
          message:
            "Failed to process password reset request. Please try again later.",
        });
      }

      // Send password reset email
      try {
        await EmailService.sendPasswordResetEmail(
          user,
          user.passwordResetToken!
        );
        // Log success for debugging (server-side only)
        console.log(`Password reset email sent to ${user.email}`);
        return res.json({
          success: true,
          message:
            "If an account exists with this email, a password reset link has been sent.",
        });
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError);

        // Clear the token since email failed
        try {
          await user.clearPasswordResetToken();
        } catch (clearError) {
          console.error("Failed to clear reset token:", clearError);
        }

        // Return error for email sending failures
        // Still use generic message to prevent user enumeration
        return res.status(500).json({
          success: false,
          message:
            "Failed to send password reset email. Please try again later.",
        });
      }
    } catch (error) {
      console.error("Unexpected error in forgotPassword:", error);
      return res.status(500).json({
        success: false,
        message: "An unexpected error occurred. Please try again later.",
      });
    }
  }

  /**
   * Reset password with token
   */
  static async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { token, password } = req.body;

      // Find user by password reset token
      const user = await User.findOne({
        passwordResetToken: token,
      }).select("+password");

      if (!user) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired reset token",
        });
      }

      // Check if token has expired
      if (
        user.passwordResetTokenExpiry &&
        user.passwordResetTokenExpiry < new Date()
      ) {
        // Clear expired token
        await user.clearPasswordResetToken();
        return res.status(400).json({
          success: false,
          message:
            "Reset token has expired. Please request a new password reset link.",
        });
      }

      // Update password
      user.password = password;
      // Clear reset token after successful password change
      await user.clearPasswordResetToken();
      await user.save();

      res.json({
        success: true,
        message: "Password reset successfully",
      });
    } catch (error) {
      return next(error);
    }
  }
}
