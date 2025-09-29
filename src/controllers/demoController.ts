import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { JWTPayload } from "../types";

// Demo login endpoint (for testing purposes only)
export const demoLogin = async (req: Request, res: Response) => {
  try {
    // Check if demo mode is enabled
    if (
      process.env.NODE_ENV === "production" &&
      !process.env.ALLOW_DEMO_LOGIN
    ) {
      return res.status(403).json({
        success: false,
        message: "Demo login is not available in production",
      });
    }

    // Create or find demo user
    let demoUser = await User.findOne({ email: "demo@example.com" });

    if (!demoUser) {
      demoUser = new User({
        email: "demo@example.com",
        password: "demo123456", // Will be hashed by pre-save middleware
        firstName: "Demo",
        lastName: "User",
        role: "user",
      });
      await demoUser.save();
    }

    // Generate JWT token
    const payload: JWTPayload = {
      userId: demoUser._id,
      email: demoUser.email,
      role: demoUser.role,
    };

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET environment variable is not set");
    }

    const token = jwt.sign(payload, secret, {
      expiresIn: "24h",
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: demoUser._id,
          email: demoUser.email,
          firstName: demoUser.firstName,
          lastName: demoUser.lastName,
          role: demoUser.role,
        },
      },
      message: "Demo login successful",
    });
    return;
  } catch (error) {
    console.error("Error in demo login:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
    return;
  }
};
