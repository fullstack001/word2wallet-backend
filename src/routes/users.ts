import { Router, Request, Response, NextFunction } from "express";
import { User } from "../models/User";
import {
  authenticate,
  requireAdmin,
  requireAdminOrOwner,
} from "../middleware/auth";
import { userIdValidation, updateUserValidation } from "../validation";
import { AuthRequest } from "../types";

const router = Router();

/**
 * Get all users (Admin only)
 */
router.get(
  "/",
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 10, role, isActive } = req.query;

      // Build query
      const query: any = {};
      if (role) query.role = role;
      if (isActive !== undefined) query.isActive = isActive === "true";

      // Calculate pagination
      const skip = (parseInt(page.toString()) - 1) * parseInt(limit.toString());

      const users = await User.find(query)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit.toString()));

      const total = await User.countDocuments(query);

      return res.json({
        success: true,
        message: "Users retrieved successfully",
        data: users,
        pagination: {
          page: parseInt(page.toString()),
          limit: parseInt(limit.toString()),
          total,
          pages: Math.ceil(total / parseInt(limit.toString())),
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * Get user by ID (Admin or owner)
 */
router.get(
  "/:id",
  authenticate,
  requireAdminOrOwner,
  userIdValidation,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const user = await User.findById(id).select("-password");
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      return res.json({
        success: true,
        message: "User retrieved successfully",
        data: user,
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * Update user (Admin or owner)
 */
router.put(
  "/:id",
  authenticate,
  requireAdminOrOwner,
  userIdValidation,
  updateUserValidation,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { firstName, lastName, role, isActive } = req.body;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Only admin can change role and isActive
      const currentUser = req.user!;
      const updates: any = {};

      if (firstName) updates.firstName = firstName;
      if (lastName) updates.lastName = lastName;

      if (currentUser.role === "admin") {
        if (role) updates.role = role;
        if (isActive !== undefined) updates.isActive = isActive;
      }

      const updatedUser = await User.findByIdAndUpdate(id, updates, {
        new: true,
        runValidators: true,
      }).select("-password");

      return res.json({
        success: true,
        message: "User updated successfully",
        data: updatedUser,
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * Delete user (Admin only)
 */
router.delete(
  "/:id",
  authenticate,
  requireAdmin,
  userIdValidation,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Prevent admin from deleting themselves
      if (req.user!._id.toString() === id) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete your own account",
        });
      }

      await User.findByIdAndDelete(id);

      return res.json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * Toggle user active status (Admin only)
 */
router.patch(
  "/:id/toggle-status",
  authenticate,
  requireAdmin,
  userIdValidation,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Prevent admin from deactivating themselves
      if (req.user!._id.toString() === id) {
        return res.status(400).json({
          success: false,
          message: "Cannot deactivate your own account",
        });
      }

      user.isActive = !user.isActive;
      await user.save();

      return res.json({
        success: true,
        message: `User ${
          user.isActive ? "activated" : "deactivated"
        } successfully`,
        data: user,
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * Unsubscribe from emails (Public endpoint)
 */
router.post(
  "/unsubscribe",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
        });
      }

      // Find user by email
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Update user to mark as unsubscribed from emails
      await User.findByIdAndUpdate(user._id, {
        emailUnsubscribed: true,
        emailUnsubscribedAt: new Date(),
      });

      return res.json({
        success: true,
        message: "Successfully unsubscribed from emails",
      });
    } catch (error) {
      return next(error);
    }
  }
);

export default router;
