import { Request, Response, NextFunction } from "express";
import { Reaction } from "../models/Reaction";
import { Blog } from "../models/Blog";
import { CustomError } from "../middleware/errorHandler";
import { AuthRequest } from "../types";

export class ReactionController {
  /**
   * Toggle reaction on blog
   */
  static async toggleReaction(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.user) {
        throw new CustomError("User not authenticated", 401);
      }

      const { blogId } = req.params;
      const { type = "like" } = req.body;

      // Verify blog exists
      const blog = await Blog.findById(blogId);
      if (!blog) {
        return res.status(404).json({
          success: false,
          message: "Blog not found",
        });
      }

      // Check if reaction already exists
      let reaction = await Reaction.findOne({
        blog: blogId,
        user: req.user._id,
      });

      if (reaction) {
        // Toggle: if same type, remove it; otherwise, update type
        if (reaction.type === type) {
          // Remove reaction
          await Reaction.deleteOne({ _id: reaction._id });
          blog.reactionsCount = Math.max(0, blog.reactionsCount - 1);
          await blog.save();

          res.json({
            success: true,
            message: "Reaction removed",
            data: { reacted: false, type: null },
          });
        } else {
          // Update reaction type
          reaction.type = type;
          await reaction.save();

          res.json({
            success: true,
            message: "Reaction updated",
            data: { reacted: true, type: reaction.type },
          });
        }
      } else {
        // Create new reaction
        reaction = new Reaction({
          blog: blogId,
          user: req.user._id,
          type,
        });

        await reaction.save();
        blog.reactionsCount += 1;
        await blog.save();

        res.json({
          success: true,
          message: "Reaction added",
          data: { reacted: true, type: reaction.type },
        });
      }
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get user's reaction on blog
   */
  static async getUserReaction(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.user) {
        throw new CustomError("User not authenticated", 401);
      }

      const { blogId } = req.params;

      const reaction = await Reaction.findOne({
        blog: blogId,
        user: req.user._id,
      });

      res.json({
        success: true,
        message: "User reaction retrieved",
        data: reaction
          ? { reacted: true, type: reaction.type }
          : { reacted: false, type: null },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get all reactions for a blog
   */
  static async getBlogReactions(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { blogId } = req.params;

      const reactions = await Reaction.find({ blog: blogId }).populate(
        "user",
        "firstName lastName email"
      );

      // Group by type
      const grouped = reactions.reduce(
        (acc, reaction) => {
          acc[reaction.type] = (acc[reaction.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      res.json({
        success: true,
        message: "Reactions retrieved",
        data: {
          total: reactions.length,
          grouped,
          reactions: reactions.map((r) => ({
            type: r.type,
            user: r.user,
            createdAt: r.createdAt,
          })),
        },
      });
    } catch (error) {
      return next(error);
    }
  }
}

