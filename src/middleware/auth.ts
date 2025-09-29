import { Response, NextFunction } from "express";
import { JWTUtils } from "../utils/jwt";
import { User } from "../models/User";
import { UserRole } from "../types";
import { AuthRequest } from "../types";

/**
 * Middleware to authenticate JWT token
 */
export const auth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access token is required",
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the token
    const payload = JWTUtils.verifyAccessToken(token);

    // Find the user
    const user = await User.findById(payload.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is deactivated",
      });
    }

    // Attach user to request
    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

// Export authenticate as an alias for auth
export const authenticate = auth;

/**
 * Middleware to check if user has required role
 */
export const authorize = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions",
      });
    }

    return next();
  };
};

/**
 * Middleware to check if user is admin
 */
export const requireAdmin = authorize(UserRole.ADMIN);

/**
 * Middleware to check if user is admin or the resource owner
 */
export const requireAdminOrOwner = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  const resourceUserId = req.params.userId || req.body.userId;

  if (
    req.user.role === UserRole.ADMIN ||
    req.user._id.toString() === resourceUserId
  ) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Insufficient permissions",
  });
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.substring(7);
    const payload = JWTUtils.verifyAccessToken(token);
    const user = await User.findById(payload.userId);

    if (user && user.isActive) {
      req.user = user;
    }

    return next();
  } catch (error) {
    // Continue without authentication
    return next();
  }
};
