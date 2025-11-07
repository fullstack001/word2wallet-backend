import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import { Blog } from "../models/Blog";
import { Comment } from "../models/Comment";
import { Reaction } from "../models/Reaction";
import { CustomError } from "../middleware/errorHandler";
import { AuthRequest, BlogQuery } from "../types";
import mongoose from "mongoose";
import sanitizeHtml from "sanitize-html";

export class BlogController {
  /**
   * Get all blogs with pagination and filtering (Admin)
   */
  static async getBlogs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        status,
        tag,
        author,
        sort: sortParam = "createdAt",
        order: orderParam = "desc",
      } = req.query;

      // Build query
      const query: any = { isActive: true };

      if (status) {
        query.status = status;
      }

      if (author) {
        query.author = author;
      }

      if (tag) {
        query.tags = tag;
      }

      if (search) {
        query.$or = [
          { title: { $regex: search, $options: "i" } },
          { excerpt: { $regex: search, $options: "i" } },
          { content: { $regex: search, $options: "i" } },
        ];
      }

      // Build sort object
      const sortObj: any = {};
      const sortField = Array.isArray(sortParam) ? sortParam[0] : sortParam;
      const orderField = Array.isArray(orderParam) ? orderParam[0] : orderParam;
      sortObj[sortField as string] = (orderField as string) === "desc" ? -1 : 1;

      // Calculate pagination
      const skip = (parseInt(page.toString()) - 1) * parseInt(limit.toString());

      // Execute query
      const blogs = await Blog.find(query)
        .populate("author", "firstName lastName email")
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit.toString()));

      const total = await Blog.countDocuments(query);

      res.json({
        success: true,
        message: "Blogs retrieved successfully",
        data: blogs,
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
   * Get published blogs (public endpoint)
   */
  static async getPublishedBlogs(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        tag,
        sort: sortParam = "publishedAt",
        order: orderParam = "desc",
      } = req.query;

      // Build query for published blogs only
      const query: any = {
        status: "published",
        isActive: true,
      };

      if (tag) {
        query.tags = tag;
      }

      if (search) {
        query.$or = [
          { title: { $regex: search, $options: "i" } },
          { excerpt: { $regex: search, $options: "i" } },
          { content: { $regex: search, $options: "i" } },
        ];
      }

      // Build sort object
      const sortObj: any = {};
      const sortField = Array.isArray(sortParam) ? sortParam[0] : sortParam;
      const orderField = Array.isArray(orderParam) ? orderParam[0] : orderParam;
      sortObj[sortField as string] = (orderField as string) === "desc" ? -1 : 1;

      // Calculate pagination
      const skip = (parseInt(page.toString()) - 1) * parseInt(limit.toString());

      // Execute query
      const blogs = await Blog.find(query)
        .populate("author", "firstName lastName email")
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit.toString()));

      const total = await Blog.countDocuments(query);

      res.json({
        success: true,
        message: "Published blogs retrieved successfully",
        data: blogs,
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
   * Get blog by ID or slug
   */
  static async getBlogById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const isPublic = req.path.includes("/public/");

      // Determine if id is ObjectId or slug
      const isObjectId = mongoose.Types.ObjectId.isValid(id);
      const query: any = isObjectId ? { _id: id } : { slug: id };

      if (isPublic) {
        query.status = "published";
        query.isActive = true;
      }

      const blog = await Blog.findOne(query).populate(
        "author",
        "firstName lastName email"
      );

      if (!blog) {
        return res.status(404).json({
          success: false,
          message: "Blog not found",
        });
      }

      // Increment views for published blogs
      if (isPublic && blog.status === "published") {
        await blog.incrementViews();
      }

      res.json({
        success: true,
        message: "Blog retrieved successfully",
        data: blog,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get related blogs based on tags
   */
  static async getRelatedBlogs(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params;
      const { limit = 5 } = req.query;

      const blog = await Blog.findById(id);
      if (!blog) {
        return res.status(404).json({
          success: false,
          message: "Blog not found",
        });
      }

      // If no tags, return recent blogs
      let relatedBlogs;
      if (blog.tags && blog.tags.length > 0) {
        relatedBlogs = await Blog.findRelated(
          id,
          blog.tags,
          parseInt(limit.toString())
        );
      } else {
        // Return recent published blogs
        relatedBlogs = await Blog.find({
          _id: { $ne: id },
          status: "published",
          isActive: true,
        })
          .populate("author", "firstName lastName email")
          .limit(parseInt(limit.toString()))
          .sort({ publishedAt: -1 });
      }

      res.json({
        success: true,
        message: "Related blogs retrieved successfully",
        data: relatedBlogs,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get recent blogs
   */
  static async getRecentBlogs(req: Request, res: Response, next: NextFunction) {
    try {
      const { limit = 5 } = req.query;

      const blogs = await Blog.find({
        status: "published",
        isActive: true,
      })
        .populate("author", "firstName lastName email")
        .limit(parseInt(limit.toString()))
        .sort({ publishedAt: -1 });

      res.json({
        success: true,
        message: "Recent blogs retrieved successfully",
        data: blogs,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Create new blog (Admin only)
   */
  static async createBlog(req: AuthRequest, res: Response, next: NextFunction) {
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

      const { title, content, excerpt, featuredImage, tags, status } = req.body;

      // Sanitize HTML content
      const sanitizedContent = sanitizeHtml(content, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat([
          "img",
          "video",
          "source",
        ]),
        allowedAttributes: {
          ...sanitizeHtml.defaults.allowedAttributes,
          img: ["src", "alt", "width", "height"],
          video: [
            "src",
            "controls",
            "width",
            "height",
            "poster",
            "preload",
            "loop",
            "muted",
            "autoplay",
            "playsinline",
          ],
          source: ["src", "type"],
        },
      });

      // Generate slug from title
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      // Check if slug already exists
      const existingBlog = await Blog.findOne({ slug });
      if (existingBlog) {
        throw new CustomError("A blog with this title already exists", 400);
      }

      const blog = new Blog({
        title,
        slug,
        content: sanitizedContent,
        excerpt:
          excerpt ||
          sanitizeHtml(content, { allowedTags: [] }).substring(0, 500),
        featuredImage,
        tags: tags || [],
        status: status || "draft",
        author: req.user._id,
        publishedAt: status === "published" ? new Date() : undefined,
      });

      await blog.save();
      await blog.populate("author", "firstName lastName email");

      res.status(201).json({
        success: true,
        message: "Blog created successfully",
        data: blog,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update blog (Admin only)
   */
  static async updateBlog(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { id } = req.params;
      const { title, content, excerpt, featuredImage, tags, status } = req.body;

      const blog = await Blog.findById(id);
      if (!blog) {
        return res.status(404).json({
          success: false,
          message: "Blog not found",
        });
      }

      // Sanitize HTML content if provided
      if (content) {
        blog.content = sanitizeHtml(content, {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat([
            "img",
            "video",
            "source",
          ]),
          allowedAttributes: {
            ...sanitizeHtml.defaults.allowedAttributes,
            img: ["src", "alt", "width", "height"],
            video: [
              "src",
              "controls",
              "width",
              "height",
              "poster",
              "preload",
              "loop",
              "muted",
              "autoplay",
              "playsinline",
            ],
            source: ["src", "type"],
          },
        });
      }

      if (title) {
        blog.title = title;
        // Regenerate slug if title changed
        const newSlug = title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        // Only update slug if it's different and doesn't exist
        if (newSlug !== blog.slug) {
          const existingBlog = await Blog.findOne({ slug: newSlug });
          if (!existingBlog || existingBlog._id.toString() === id) {
            blog.slug = newSlug;
          }
        }
      }

      if (excerpt !== undefined) blog.excerpt = excerpt;
      if (featuredImage !== undefined) blog.featuredImage = featuredImage;
      if (tags !== undefined) blog.tags = tags;
      if (status !== undefined) {
        blog.status = status;
        // Set publishedAt when status changes to published
        if (status === "published" && !blog.publishedAt) {
          blog.publishedAt = new Date();
        }
      }

      await blog.save();
      await blog.populate("author", "firstName lastName email");

      res.json({
        success: true,
        message: "Blog updated successfully",
        data: blog,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Delete blog (Admin only)
   */
  static async deleteBlog(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const blog = await Blog.findById(id);
      if (!blog) {
        return res.status(404).json({
          success: false,
          message: "Blog not found",
        });
      }

      // Soft delete
      blog.isActive = false;
      await blog.save();

      // Delete related comments and reactions
      await Comment.updateMany({ blog: id }, { isActive: false });
      await Reaction.deleteMany({ blog: id });

      res.json({
        success: true,
        message: "Blog deleted successfully",
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Increment blog views
   */
  static async incrementViews(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const blog = await Blog.findById(id);
      if (!blog) {
        return res.status(404).json({
          success: false,
          message: "Blog not found",
        });
      }

      await blog.incrementViews();

      res.json({
        success: true,
        message: "View count updated",
        data: { views: blog.views },
      });
    } catch (error) {
      return next(error);
    }
  }
}
