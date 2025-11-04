import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import { Comment } from "../models/Comment";
import { Blog } from "../models/Blog";
import { CustomError } from "../middleware/errorHandler";
import { AuthRequest } from "../types";
import sanitizeHtml from "sanitize-html";

export class CommentController {
  /**
   * Get comments for a blog
   */
  static async getCommentsByBlog(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { blogId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const skip = (parseInt(page.toString()) - 1) * parseInt(limit.toString());

      // Get top-level comments (no parent)
      const comments = await Comment.find({
        blog: blogId,
        parent: null,
        isActive: true,
      })
        .populate("user", "firstName lastName email") // Only populates if user exists
        .populate({
          path: "replies",
          match: { isActive: true },
          populate: { path: "user", select: "firstName lastName email" },
          options: { sort: { createdAt: 1 } },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit.toString()));

      const total = await Comment.countDocuments({
        blog: blogId,
        parent: null,
        isActive: true,
      });

      res.json({
        success: true,
        message: "Comments retrieved successfully",
        data: comments,
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

  /**
   * Create new comment (supports both authenticated and anonymous users)
   */
  static async createComment(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { blogId } = req.params;
      const { content, parent, anonymousName, anonymousEmail } = req.body;

      // Verify blog exists and is published
      const blog = await Blog.findById(blogId);
      if (!blog) {
        return res.status(404).json({
          success: false,
          message: "Blog not found",
        });
      }

      if (blog.status !== "published" || !blog.isActive) {
        return res.status(403).json({
          success: false,
          message: "Cannot comment on unpublished blog",
        });
      }

      // Check if user is authenticated or providing anonymous info
      if (!req.user && (!anonymousName || !anonymousEmail)) {
        return res.status(400).json({
          success: false,
          message: "For anonymous comments, both name and email are required",
        });
      }

      // Sanitize content
      const sanitizedContent = sanitizeHtml(content, {
        allowedTags: [],
        allowedAttributes: {},
      });

      const commentData: any = {
        blog: blogId,
        content: sanitizedContent,
        parent: parent || null,
      };

      if (req.user) {
        // Authenticated user
        commentData.user = req.user._id;
      } else {
        // Anonymous user
        commentData.anonymousName = anonymousName.trim();
        commentData.anonymousEmail = anonymousEmail.trim().toLowerCase();
      }

      const comment = new Comment(commentData);
      await comment.save();

      // Update blog comments count
      blog.commentsCount = await Comment.countDocuments({
        blog: blogId,
        isActive: true,
      });
      await blog.save();

      // Populate user if authenticated, otherwise include anonymous info
      if (req.user) {
        await comment.populate("user", "firstName lastName email");
      }
      if (parent) {
        await comment.populate("parent");
      }

      res.status(201).json({
        success: true,
        message: "Comment created successfully",
        data: comment,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update comment
   */
  static async updateComment(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      if (!req.user) {
        throw new CustomError("User not authenticated", 401);
      }

      const { id } = req.params;
      const { content } = req.body;

      const comment = await Comment.findById(id);
      if (!comment) {
        return res.status(404).json({
          success: false,
          message: "Comment not found",
        });
      }

      // Check if user owns the comment (anonymous comments cannot be edited)
      if (!comment.user) {
        return res.status(403).json({
          success: false,
          message: "Anonymous comments cannot be edited",
        });
      }

      if (comment.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "You can only edit your own comments",
        });
      }

      // Sanitize content
      comment.content = sanitizeHtml(content, {
        allowedTags: [],
        allowedAttributes: {},
      });

      await comment.save();
      await comment.populate("user", "firstName lastName email");

      res.json({
        success: true,
        message: "Comment updated successfully",
        data: comment,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Delete comment (soft delete)
   */
  static async deleteComment(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.user) {
        throw new CustomError("User not authenticated", 401);
      }

      const { id } = req.params;

      const comment = await Comment.findById(id);
      if (!comment) {
        return res.status(404).json({
          success: false,
          message: "Comment not found",
        });
      }

      // Check if user owns the comment or is admin
      // Anonymous comments can only be deleted by admin
      if (!comment.user) {
        if (req.user.role !== "admin") {
          return res.status(403).json({
            success: false,
            message: "Only admins can delete anonymous comments",
          });
        }
      } else if (
        comment.user.toString() !== req.user._id.toString() &&
        req.user.role !== "admin"
      ) {
        return res.status(403).json({
          success: false,
          message: "You can only delete your own comments",
        });
      }

      // Soft delete
      comment.isActive = false;
      await comment.save();

      // Update blog comments count
      const blog = await Blog.findById(comment.blog);
      if (blog) {
        blog.commentsCount = await Comment.countDocuments({
          blog: comment.blog,
          isActive: true,
        });
        await blog.save();
      }

      res.json({
        success: true,
        message: "Comment deleted successfully",
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Toggle like on comment
   */
  static async toggleLike(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.user) {
        throw new CustomError("User not authenticated", 401);
      }

      const { id } = req.params;

      const comment = await Comment.findById(id);
      if (!comment) {
        return res.status(404).json({
          success: false,
          message: "Comment not found",
        });
      }

      await comment.toggleLike(req.user._id.toString());
      await comment.populate("user", "firstName lastName email");

      res.json({
        success: true,
        message: "Like toggled successfully",
        data: comment,
      });
    } catch (error) {
      return next(error);
    }
  }
}

