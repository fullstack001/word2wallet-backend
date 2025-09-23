import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import { User } from "../models/User";
import { JWTUtils } from "../utils/jwt";
import { UserRole } from "../types";
import { CustomError } from "../middleware/errorHandler";
import { AuthRequest } from "../types";

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

      // Check if user already exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User already exists with this email",
        });
      }

      // Create new user
      const user = new User({
        email: email.toLowerCase(),
        password,
        firstName,
        lastName,
        role: role || UserRole.USER,
      });

      await user.save();

      // Generate tokens
      const tokens = JWTUtils.generateTokenPair(
        user._id.toString(),
        user.email,
        user.role
      );

      // Update last login
      await user.updateLastLogin();

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: {
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            fullName: user.fullName,
          },
          tokens,
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
      const user = await User.findOne({ email: email.toLowerCase() }).select(
        "+password"
      );
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
        message: "Login successful",
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
}
