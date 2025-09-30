import { Response, NextFunction } from "express";
import { Course } from "../models/Course";
import { User } from "../models/User";
import { AuthRequest } from "../types";

export class DashboardController {
  /**
   * Get dashboard data for authenticated user
   */
  static async getDashboardData(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      // Get published courses with optimized query
      const courses = await Course.find({
        isActive: true,
        isPublished: true,
      })
        .populate("subject", "name")
        .populate("createdBy", "firstName lastName")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(); // Use lean() for better performance

      // Calculate user-specific stats
      const totalCourses = courses.length;

      // For now, we'll use mock data for user progress
      // In a real implementation, you'd have a UserProgress model
      const completedCourses = Math.floor(
        Math.random() * Math.min(totalCourses, 3)
      );
      const inProgressCourses = Math.floor(
        Math.random() * Math.min(totalCourses - completedCourses, 2)
      );
      const totalTimeSpent = Math.floor(Math.random() * 20) + 5; // hours

      // Get user subscription info in a single query
      const userWithSubscription = await User.findById(user._id)
        .select("subscription")
        .lean();
      const subscription = userWithSubscription?.subscription;

      // Simple response without complex caching for now

      res.json({
        success: true,
        message: "Dashboard data retrieved successfully",
        data: {
          stats: {
            totalCourses,
            completedCourses,
            inProgressCourses,
            totalTimeSpent,
          },
          courses: courses.map((course) => ({
            _id: course._id,
            title: course.title,
            description: course.description,
            subject: course.subject,
            isPublished: course.isPublished,
            createdAt: course.createdAt,
            progress: Math.floor(Math.random() * 100), // Mock progress for now
          })),
          subscription: subscription
            ? {
                stripeCustomerId: subscription.stripeCustomerId,
                stripeSubscriptionId: subscription.stripeSubscriptionId,
                status: subscription.status,
                plan: subscription.plan,
                trialStart: subscription.trialStart,
                trialEnd: subscription.trialEnd,
                currentPeriodStart: subscription.currentPeriodStart,
                currentPeriodEnd: subscription.currentPeriodEnd,
                cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
                canceledAt: subscription.canceledAt,
                cancellationReason: subscription.cancellationReason,
                cancellationFeedback: subscription.cancellationFeedback,
              }
            : null,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
}
