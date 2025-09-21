import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import { Course } from "../models/Course";
import { Subject } from "../models/Subject";
import { CustomError } from "../middleware/errorHandler";
import { AuthRequest, CourseQuery } from "../types";
import fs from "fs";
import path from "path";

export class CourseController {
  /**
   * Get all courses with pagination and filtering
   */
  static async getCourses(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        page = 1,
        limit = 10,
        subject,
        search,
        isPublished: isPublishedStr,
        isActive: isActiveStr,
        sort: sortParam = "createdAt",
        order: orderParam = "desc",
      } = req.query;

      // Build query
      const query: any = {};

      if (subject) {
        query.subject = subject;
      }

      if (isPublishedStr !== undefined) {
        query.isPublished = isPublishedStr === "true";
      }

      if (isActiveStr !== undefined) {
        query.isActive = isActiveStr === "true";
      }

      if (search) {
        query.$or = [
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
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
      const courses = await Course.find(query)
        .populate("subject", "name")
        .populate("createdBy", "firstName lastName email")
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit.toString()));

      const total = await Course.countDocuments(query);

      res.json({
        success: true,
        message: "Courses retrieved successfully",
        data: courses,
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
   * Get published courses (public endpoint)
   */
  static async getPublishedCourses(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const {
        page = 1,
        limit = 10,
        subject,
        search,
        sort: sortParam = "createdAt",
        order: orderParam = "desc",
      } = req.query;

      // Build query for published courses only
      const query: any = {
        isActive: true,
        isPublished: true,
      };

      if (subject) {
        query.subject = subject;
      }

      if (search) {
        query.$or = [
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
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
      const courses = await Course.find(query)
        .populate("subject", "name")
        .populate("createdBy", "firstName lastName")
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit.toString()));

      const total = await Course.countDocuments(query);

      res.json({
        success: true,
        message: "Published courses retrieved successfully",
        data: courses,
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
   * Get course by ID
   */
  static async getCourseById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const course = await Course.findById(id)
        .populate("subject", "name")
        .populate("createdBy", "firstName lastName email");

      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course not found",
        });
      }

      res.json({
        success: true,
        message: "Course retrieved successfully",
        data: course,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Create new course (Admin only)
   */
  static async createCourse(
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

      const { title, description, subject, isPublished } = req.body;
      const user = req.user!;

      // Verify subject exists
      const subjectExists = await Subject.findById(subject);
      if (!subjectExists) {
        return res.status(400).json({
          success: false,
          message: "Subject not found",
        });
      }

      // Check if course with same title already exists
      const existingCourse = await Course.findOne({
        title: { $regex: new RegExp(`^${title}$`, "i") },
      });

      if (existingCourse) {
        return res.status(400).json({
          success: false,
          message: "Course with this title already exists",
        });
      }

      const course = new Course({
        title,
        description,
        subject,
        isPublished: isPublished || false,
        createdBy: user._id,
      });

      await course.save();
      await course.populate("subject", "name slug");
      await course.populate("createdBy", "firstName lastName email");

      res.status(201).json({
        success: true,
        message: "Course created successfully",
        data: course,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update course (Admin only)
   */
  static async updateCourse(
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

      const { id } = req.params;
      const { title, description, subject, isPublished, isActive } = req.body;

      const course = await Course.findById(id);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course not found",
        });
      }

      // Verify subject exists if provided
      if (subject) {
        const subjectExists = await Subject.findById(subject);
        if (!subjectExists) {
          return res.status(400).json({
            success: false,
            message: "Subject not found",
          });
        }
      }

      // Check if title is being changed and if it conflicts
      if (title && title !== course.title) {
        const existingCourse = await Course.findOne({
          title: { $regex: new RegExp(`^${title}$`, "i") },
          _id: { $ne: id },
        });

        if (existingCourse) {
          return res.status(400).json({
            success: false,
            message: "Course with this title already exists",
          });
        }
      }

      // Update course
      const updates: any = {};
      if (title) updates.title = title;
      if (description) updates.description = description;
      if (subject) updates.subject = subject;
      if (isPublished !== undefined) updates.isPublished = isPublished;
      if (isActive !== undefined) updates.isActive = isActive;

      const updatedCourse = await Course.findByIdAndUpdate(id, updates, {
        new: true,
        runValidators: true,
      })
        .populate("subject", "name")
        .populate("createdBy", "firstName lastName email");

      res.json({
        success: true,
        message: "Course updated successfully",
        data: updatedCourse,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Upload EPUB file for course (Admin only)
   */
  static async uploadEpub(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "EPUB file is required",
        });
      }

      const course = await Course.findById(id);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course not found",
        });
      }

      // Delete old EPUB file if exists
      if (course.epubFile) {
        const oldFilePath = path.join(process.cwd(), course.epubFile);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }

      // Update course with new EPUB file
      course.epubFile = req.file.path;

      // Extract basic metadata from filename
      course.epubMetadata = {
        title: course.title,
        author: "Unknown",
        language: "en",
        fileSize: req.file.size,
        lastModified: new Date(),
      };

      await course.save();

      res.json({
        success: true,
        message: "EPUB file uploaded successfully",
        data: {
          course: course,
          file: {
            filename: req.file.filename,
            originalname: req.file.originalname,
            size: req.file.size,
            path: req.file.path,
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Upload thumbnail for course (Admin only)
   */
  static async uploadThumbnail(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Thumbnail image is required",
        });
      }

      const course = await Course.findById(id);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course not found",
        });
      }

      // Delete old thumbnail if exists
      if (course.thumbnail) {
        const oldFilePath = path.join(process.cwd(), course.thumbnail);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }

      // Update course with new thumbnail
      course.thumbnail = req.file.path;
      await course.save();

      res.json({
        success: true,
        message: "Thumbnail uploaded successfully",
        data: {
          course: course,
          file: {
            filename: req.file.filename,
            originalname: req.file.originalname,
            size: req.file.size,
            path: req.file.path,
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Download EPUB file
   */
  static async downloadEpub(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const course = await Course.findById(id);
      if (!course || !course.epubFile) {
        return res.status(404).json({
          success: false,
          message: "EPUB file not found",
        });
      }

      const filePath = path.join(process.cwd(), course.epubFile);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: "EPUB file not found on server",
        });
      }

      res.download(
        filePath,
        `${course.title.replace(/[^a-zA-Z0-9]/g, "_")}.epub`
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Delete course (Admin only)
   */
  static async deleteCourse(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params;

      const course = await Course.findById(id);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course not found",
        });
      }

      // Delete associated files
      if (course.epubFile) {
        const epubPath = path.join(process.cwd(), course.epubFile);
        if (fs.existsSync(epubPath)) {
          fs.unlinkSync(epubPath);
        }
      }

      if (course.thumbnail) {
        const thumbnailPath = path.join(process.cwd(), course.thumbnail);
        if (fs.existsSync(thumbnailPath)) {
          fs.unlinkSync(thumbnailPath);
        }
      }

      await Course.findByIdAndDelete(id);

      res.json({
        success: true,
        message: "Course deleted successfully",
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Toggle course published status (Admin only)
   */
  static async togglePublishedStatus(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params;

      const course = await Course.findById(id);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course not found",
        });
      }

      course.isPublished = !course.isPublished;
      await course.save();

      res.json({
        success: true,
        message: `Course ${
          course.isPublished ? "published" : "unpublished"
        } successfully`,
        data: course,
      });
    } catch (error) {
      return next(error);
    }
  }
}
