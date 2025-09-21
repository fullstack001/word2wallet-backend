import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import { Subject } from "../models/Subject";
import { CustomError } from "../middleware/errorHandler";
import { AuthRequest, SubjectQuery } from "../types";

export class SubjectController {
  /**
   * Get all subjects with pagination and filtering
   */
  static async getSubjects(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        isActive,
        sort = "name",
        order = "asc",
      } = req.query as SubjectQuery;

      // Build query
      const query: any = {};

      if (isActive !== undefined) {
        query.isActive = String(isActive) === "true";
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ];
      }

      // Build sort object
      const sortObj: any = {};
      sortObj[sort] = order === "desc" ? -1 : 1;

      // Calculate pagination
      const skip = (parseInt(page.toString()) - 1) * parseInt(limit.toString());

      // Execute query
      const subjects = await Subject.find(query)
        .populate("createdBy", "firstName lastName email")
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit.toString()));

      const total = await Subject.countDocuments(query);

      res.json({
        success: true,
        message: "Subjects retrieved successfully",
        data: subjects,
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
   * Get active subjects (public endpoint)
   */
  static async getActiveSubjects(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const subjects = await Subject.findActive()
        .populate("createdBy", "firstName lastName")
        .sort({ name: 1 });

      res.json({
        success: true,
        message: "Active subjects retrieved successfully",
        data: subjects,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get subject by ID
   */
  static async getSubjectById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const subject = await Subject.findById(id).populate(
        "createdBy",
        "firstName lastName email"
      );

      if (!subject) {
        return res.status(404).json({
          success: false,
          message: "Subject not found",
        });
      }

      res.json({
        success: true,
        message: "Subject retrieved successfully",
        data: subject,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Create new subject (Admin only)
   */
  static async createSubject(
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

      const { name, description } = req.body;
      const user = req.user!;

      // Check if subject with same name already exists
      const existingSubject = await Subject.findOne({
        name: { $regex: new RegExp(`^${name}$`, "i") },
      });

      if (existingSubject) {
        return res.status(400).json({
          success: false,
          message: "Subject with this name already exists",
        });
      }

      const subject = new Subject({
        name,
        description,
        createdBy: user._id,
      });

      await subject.save();
      await subject.populate("createdBy", "firstName lastName email");

      res.status(201).json({
        success: true,
        message: "Subject created successfully",
        data: subject,
      });
    } catch (error: any) {
      console.error("Error creating subject:", error);

      // Handle specific MongoDB errors
      if (error.code === 11000) {
        // Duplicate key error
        const field = Object.keys(error.keyPattern)[0];
        if (field === "name") {
          return res.status(400).json({
            success: false,
            message: "Subject with this name already exists",
          });
        }
      }

      // Handle validation errors
      if (error.name === "ValidationError") {
        const errors = Object.values(error.errors).map(
          (err: any) => err.message
        );
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors,
        });
      }

      return next(error);
    }
  }

  /**
   * Update subject (Admin only)
   */
  static async updateSubject(
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
      const { name, description, isActive } = req.body;

      const subject = await Subject.findById(id);
      if (!subject) {
        return res.status(404).json({
          success: false,
          message: "Subject not found",
        });
      }

      // Check if name is being changed and if it conflicts
      if (name && name !== subject.name) {
        const existingSubject = await Subject.findOne({
          name: { $regex: new RegExp(`^${name}$`, "i") },
          _id: { $ne: id },
        });

        if (existingSubject) {
          return res.status(400).json({
            success: false,
            message: "Subject with this name already exists",
          });
        }
      }

      // Update subject
      const updates: any = {};
      if (name) updates.name = name;
      if (description) updates.description = description;
      if (isActive !== undefined) updates.isActive = isActive;

      const updatedSubject = await Subject.findByIdAndUpdate(id, updates, {
        new: true,
        runValidators: true,
      }).populate("createdBy", "firstName lastName email");

      res.json({
        success: true,
        message: "Subject updated successfully",
        data: updatedSubject,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Delete subject (Admin only)
   */
  static async deleteSubject(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params;

      const subject = await Subject.findById(id);
      if (!subject) {
        return res.status(404).json({
          success: false,
          message: "Subject not found",
        });
      }

      // Check if subject has courses
      const { Course } = await import("../models/Course");
      const courseCount = await Course.countDocuments({ subject: id });

      if (courseCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete subject. It has ${courseCount} course(s) associated with it.`,
        });
      }

      await Subject.findByIdAndDelete(id);

      res.json({
        success: true,
        message: "Subject deleted successfully",
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Toggle subject active status (Admin only)
   */
  static async toggleSubjectStatus(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params;

      const subject = await Subject.findById(id);
      if (!subject) {
        return res.status(404).json({
          success: false,
          message: "Subject not found",
        });
      }

      subject.isActive = !subject.isActive;
      await subject.save();

      res.json({
        success: true,
        message: `Subject ${
          subject.isActive ? "activated" : "deactivated"
        } successfully`,
        data: subject,
      });
    } catch (error) {
      return next(error);
    }
  }
}
