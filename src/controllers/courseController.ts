import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import { Course } from "../models/Course";
import { Subject } from "../models/Subject";
import { CustomError } from "../middleware/errorHandler";
import { AuthRequest, CourseQuery, IChapter } from "../types";
import { EpubGenerator } from "../utils/epubGenerator";
import { getStorageService } from "../services/storageService";
import fs from "fs";
import path from "path";
import os from "os";

export class CourseController {
  /**
   * Get all courses with pagination and filtering
   */
  static async getCourses(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        page = 1,
        limit = 100,
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
        limit = 100,
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
   * Create new course with all content (Admin only)
   * Handles: course creation, cover upload, multimedia uploads, EPUB generation
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

      const {
        title,
        description,
        subject,
        chapters,
        isPublished,
        isActive,
        googleDocLink,
        googleClassroomLink,
      } = req.body;
      const user = req.user!;

      // Parse chapters if it's a JSON string (from FormData)
      let parsedChapters = [];
      if (chapters) {
        if (typeof chapters === "string") {
          try {
            parsedChapters = JSON.parse(chapters);
          } catch (error) {
            return res.status(400).json({
              success: false,
              message: "Invalid chapters format",
            });
          }
        } else {
          parsedChapters = chapters;
        }
      }

      // Handle cover image upload if present
      let coverImageKey: string | null = null;
      const storageService = getStorageService();

      if (
        req.files &&
        typeof req.files === "object" &&
        "cover" in req.files &&
        req.files.cover &&
        req.files.cover[0]
      ) {
        const coverFile = req.files.cover[0];
        if (coverFile.buffer) {
          const uploadResult = await storageService.uploadFile(
            `covers/${user._id}/${Date.now()}-${coverFile.originalname}`,
            coverFile.buffer,
            coverFile.mimetype,
            {
              uploadedAt: new Date().toISOString(),
              originalName: coverFile.originalname,
            }
          );
          coverImageKey = uploadResult.key;
        }
      }

      // Handle multimedia files if present
      let multimediaFiles: any = { audio: [], video: [] };
      if (req.files) {
        const files = Array.isArray(req.files)
          ? req.files
          : Object.values(req.files).flat();

        for (const file of files) {
          if (file.fieldname === "audio" || file.fieldname === "video") {
            if (file.buffer) {
              const uploadResult = await storageService.uploadFile(
                `${file.fieldname}/${user._id}/${Date.now()}-${
                  file.originalname
                }`,
                file.buffer,
                file.mimetype,
                {
                  uploadedAt: new Date().toISOString(),
                  originalName: file.originalname,
                }
              );

              const fileData = {
                id: `${file.fieldname}-${Date.now()}-${Math.random()
                  .toString(36)
                  .substr(2, 9)}`,
                filename:
                  uploadResult.key.split("/").pop() || file.originalname,
                originalName: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
                path: uploadResult.key,
                url: uploadResult.url,
                uploadedAt: new Date(),
              };

              if (file.fieldname === "audio") {
                multimediaFiles.audio.push(fileData);
              } else if (file.fieldname === "video") {
                multimediaFiles.video.push(fileData);
              }
            }
          }
        }
      }

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

      // Create course
      const courseData = {
        title,
        description,
        subject,
        chapters: parsedChapters,
        epubCover: coverImageKey,
        multimediaContent: multimediaFiles,
        isPublished: isPublished || false,
        isActive: isActive !== undefined ? isActive : true,
        googleDocLink: googleDocLink || undefined,
        googleClassroomLink: googleClassroomLink || undefined,
        createdBy: user._id,
      };

      console.log("🏗️ Creating course with data:");
      console.log("- epubCover:", courseData.epubCover);
      console.log("- Full course data:", JSON.stringify(courseData, null, 2));

      const course = new Course(courseData);
      await course.save();

      console.log("✅ Course saved with ID:", course._id);
      console.log("✅ Course epubCover in DB:", course.epubCover);

      // Generate EPUB file
      try {
        // Create temporary file for EPUB generation
        const tempEpubPath = path.join(
          os.tmpdir(),
          `epub-${course._id}-${Date.now()}.epub`
        );

        // Download cover image if needed for EPUB generation
        let coverImagePath: string | null = null;
        if (coverImageKey) {
          try {
            const coverBuffer = await storageService.downloadFile(
              coverImageKey
            );
            coverImagePath = path.join(
              os.tmpdir(),
              `cover-${course._id}-${Date.now()}.jpg`
            );
            fs.writeFileSync(coverImagePath, coverBuffer);
          } catch (error) {
            console.warn("Failed to download cover for EPUB:", error);
          }
        }

        await EpubGenerator.generateEpub({
          title: course.title,
          description: course.description,
          author: `${user.firstName} ${user.lastName}`,
          coverImagePath: coverImagePath || undefined,
          chapters: course.chapters,
          outputPath: tempEpubPath,
        });

        // Upload EPUB to GCS
        const epubBuffer = fs.readFileSync(tempEpubPath);
        const epubUploadResult = await storageService.uploadFile(
          `epubs/${course._id}.epub`,
          epubBuffer,
          "application/epub+zip",
          {
            courseId: course._id.toString(),
            title: course.title,
            uploadedAt: new Date().toISOString(),
          }
        );

        // Update course with EPUB file key
        course.epubFile = epubUploadResult.key;
        course.epubMetadata = {
          title: course.title,
          creator: `${user.firstName} ${user.lastName}`,
          language: "en",
          description: course.description,
          coverImage: coverImageKey || undefined,
          fileSize: epubBuffer.length,
          lastModified: new Date(),
        };

        await course.save();

        // Clean up temporary files
        if (fs.existsSync(tempEpubPath)) {
          fs.unlinkSync(tempEpubPath);
        }
        if (coverImagePath && fs.existsSync(coverImagePath)) {
          fs.unlinkSync(coverImagePath);
        }
      } catch (epubError) {
        console.error("EPUB generation failed:", epubError);
        // Continue without EPUB file - it can be generated later
      }

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
   * Handles: course updates, cover upload, multimedia uploads, EPUB regeneration
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
      const {
        title,
        description,
        subject,
        chapters,
        multimediaContent,
        isPublished,
        isActive,
        removeExistingCover,
        googleDocLink,
        googleClassroomLink,
      } = req.body;

      const course = await Course.findById(id);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course not found",
        });
      }

      // Parse chapters if it's a JSON string (from FormData)
      let parsedChapters = course.chapters;
      if (chapters) {
        if (typeof chapters === "string") {
          try {
            parsedChapters = JSON.parse(chapters);
          } catch (error) {
            return res.status(400).json({
              success: false,
              message: "Invalid chapters format",
            });
          }
        } else {
          parsedChapters = chapters;
        }
      }

      // Parse multimediaContent if it's a JSON string (from FormData)
      let parsedMultimediaContent = course.multimediaContent;
      if (multimediaContent) {
        if (typeof multimediaContent === "string") {
          try {
            parsedMultimediaContent = JSON.parse(multimediaContent);
          } catch (error) {
            return res.status(400).json({
              success: false,
              message: "Invalid multimedia content format",
            });
          }
        } else {
          parsedMultimediaContent = multimediaContent;
        }
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

      // Validate chapters if provided
      if (parsedChapters && parsedChapters !== course.chapters) {
        if (!Array.isArray(parsedChapters) || parsedChapters.length === 0) {
          return res.status(400).json({
            success: false,
            message: "At least one chapter is required",
          });
        }

        for (const chapter of parsedChapters) {
          if (!chapter.title || !chapter.description || !chapter.content) {
            return res.status(400).json({
              success: false,
              message: "Each chapter must have title, description, and content",
            });
          }
        }
      }

      const storageService = getStorageService();

      // Handle cover image upload if present
      let coverImageKey: string | undefined = course.epubCover;

      // Check if existing cover should be removed
      if (removeExistingCover === "true" || removeExistingCover === true) {
        if (course.epubCover) {
          try {
            await storageService.deleteFile(course.epubCover);
            console.log("🗑️ Removed existing cover image:", course.epubCover);
          } catch (error) {
            console.error("Failed to delete cover from GCS:", error);
          }
        }
        coverImageKey = undefined;
      }

      // Handle new cover image upload
      if (
        req.files &&
        typeof req.files === "object" &&
        "epubCover" in req.files &&
        req.files.epubCover &&
        req.files.epubCover[0]
      ) {
        const coverFile = req.files.epubCover[0];
        // Delete old cover if exists
        if (course.epubCover) {
          try {
            await storageService.deleteFile(course.epubCover);
          } catch (error) {
            console.error("Failed to delete old cover:", error);
          }
        }
        // Upload new cover
        if (coverFile.buffer) {
          const uploadResult = await storageService.uploadFile(
            `covers/${course.createdBy}/${Date.now()}-${
              coverFile.originalname
            }`,
            coverFile.buffer,
            coverFile.mimetype,
            {
              uploadedAt: new Date().toISOString(),
              originalName: coverFile.originalname,
            }
          );
          coverImageKey = uploadResult.key;
          console.log("📸 Cover image updated:", coverImageKey);
        }
      }

      // Handle new multimedia files if present
      let newMultimediaFiles: any = { audio: [], video: [] };
      if (req.files) {
        const files = Array.isArray(req.files)
          ? req.files
          : Object.values(req.files).flat();

        for (const file of files) {
          if (
            (file.fieldname === "audio" || file.fieldname === "video") &&
            file.buffer
          ) {
            const uploadResult = await storageService.uploadFile(
              `${file.fieldname}/${course.createdBy}/${Date.now()}-${
                file.originalname
              }`,
              file.buffer,
              file.mimetype,
              {
                uploadedAt: new Date().toISOString(),
                originalName: file.originalname,
              }
            );

            const fileData = {
              id: `${file.fieldname}-${Date.now()}-${Math.random()
                .toString(36)
                .substr(2, 9)}`,
              filename: uploadResult.key.split("/").pop() || file.originalname,
              originalName: file.originalname,
              mimeType: file.mimetype,
              size: file.size,
              path: uploadResult.key,
              url: uploadResult.url,
              uploadedAt: new Date(),
            };

            if (file.fieldname === "audio") {
              newMultimediaFiles.audio.push(fileData);
            } else if (file.fieldname === "video") {
              newMultimediaFiles.video.push(fileData);
            }
          }
        }
      }

      // Merge existing multimedia content with new files
      let finalMultimediaContent = parsedMultimediaContent ||
        course.multimediaContent || { audio: [], video: [] };
      if (
        newMultimediaFiles.audio.length > 0 ||
        newMultimediaFiles.video.length > 0
      ) {
        finalMultimediaContent = {
          audio: [
            ...(finalMultimediaContent?.audio || []),
            ...newMultimediaFiles.audio,
          ],
          video: [
            ...(finalMultimediaContent?.video || []),
            ...newMultimediaFiles.video,
          ],
        } as any;
      }

      // Update course
      const updates: any = {};
      if (title) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (subject) updates.subject = subject;
      if (parsedChapters && parsedChapters !== course.chapters)
        updates.chapters = parsedChapters;
      if (coverImageKey !== course.epubCover) updates.epubCover = coverImageKey;
      if (finalMultimediaContent !== course.multimediaContent)
        updates.multimediaContent = finalMultimediaContent;
      if (isPublished !== undefined) updates.isPublished = isPublished;
      if (isActive !== undefined) updates.isActive = isActive;
      if (googleDocLink !== undefined)
        updates.googleDocLink = googleDocLink || null;
      if (googleClassroomLink !== undefined)
        updates.googleClassroomLink = googleClassroomLink || null;

      const updatedCourse = await Course.findByIdAndUpdate(id, updates, {
        new: true,
        runValidators: true,
      })
        .populate("subject", "name")
        .populate("createdBy", "firstName lastName email");

      if (!updatedCourse) {
        return res.status(404).json({
          success: false,
          message: "Course not found",
        });
      }

      // Regenerate EPUB if content changed
      const contentChanged =
        title ||
        description ||
        (parsedChapters && parsedChapters !== course.chapters) ||
        coverImageKey !== course.epubCover ||
        removeExistingCover;
      if (contentChanged) {
        try {
          // Delete old EPUB file from GCS if exists
          if (updatedCourse.epubFile) {
            try {
              await storageService.deleteFile(updatedCourse.epubFile);
              console.log(
                "🗑️ Deleted old EPUB file from GCS:",
                updatedCourse.epubFile
              );
            } catch (error) {
              console.error("Failed to delete old EPUB:", error);
            }
          }

          // Create temporary file for EPUB generation
          const tempEpubPath = path.join(
            os.tmpdir(),
            `epub-${updatedCourse._id}-${Date.now()}.epub`
          );

          // Download cover image if needed for EPUB generation
          let coverImagePath: string | null = null;
          if (coverImageKey) {
            try {
              const coverBuffer = await storageService.downloadFile(
                coverImageKey
              );
              coverImagePath = path.join(
                os.tmpdir(),
                `cover-${updatedCourse._id}-${Date.now()}.jpg`
              );
              fs.writeFileSync(coverImagePath, coverBuffer);
            } catch (error) {
              console.warn("Failed to download cover for EPUB:", error);
            }
          }

          const authorName =
            typeof updatedCourse.createdBy === "object" &&
            updatedCourse.createdBy
              ? `${(updatedCourse.createdBy as any).firstName} ${
                  (updatedCourse.createdBy as any).lastName
                }`
              : "Unknown Author";

          console.log("🔄 Regenerating EPUB for course:", updatedCourse.title);
          await EpubGenerator.generateEpub({
            title: updatedCourse.title,
            description: updatedCourse.description,
            author: authorName,
            coverImagePath: coverImagePath || undefined,
            chapters: updatedCourse.chapters,
            outputPath: tempEpubPath,
          });

          // Upload EPUB to GCS
          const epubBuffer = fs.readFileSync(tempEpubPath);
          const epubUploadResult = await storageService.uploadFile(
            `epubs/${updatedCourse._id}.epub`,
            epubBuffer,
            "application/epub+zip",
            {
              courseId: updatedCourse._id.toString(),
              title: updatedCourse.title,
              uploadedAt: new Date().toISOString(),
            }
          );

          // Update EPUB metadata
          updatedCourse.epubFile = epubUploadResult.key;
          updatedCourse.epubMetadata = {
            title: updatedCourse.title,
            creator: authorName,
            language: "en",
            description: updatedCourse.description,
            coverImage: coverImageKey || undefined,
            fileSize: epubBuffer.length,
            lastModified: new Date(),
          };

          await updatedCourse.save();
          console.log("✅ EPUB regenerated successfully");

          // Clean up temporary files
          if (fs.existsSync(tempEpubPath)) {
            fs.unlinkSync(tempEpubPath);
          }
          if (coverImagePath && fs.existsSync(coverImagePath)) {
            fs.unlinkSync(coverImagePath);
          }
        } catch (epubError) {
          console.error("❌ EPUB regeneration failed:", epubError);
          // Continue without regenerating EPUB
        }
      }

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
   * Serve EPUB file for reading (not download)
   * Redirects to GCS signed URL
   */
  static async serveEpub(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const course = await Course.findById(id);
      if (!course || !course.epubFile) {
        return res.status(404).json({
          success: false,
          message: "EPUB file not found",
        });
      }

      const storageService = getStorageService();
      const exists = await storageService.fileExists(course.epubFile);

      if (!exists) {
        return res.status(404).json({
          success: false,
          message: "EPUB file not found in storage",
        });
      }

      // Generate signed URL (valid for 1 hour)
      const signedUrl = await storageService.generatePresignedDownloadUrl(
        course.epubFile,
        3600
      );

      // Redirect to signed URL
      return res.redirect(signedUrl);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Download EPUB file
   * Redirects to GCS signed URL
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

      const storageService = getStorageService();
      const exists = await storageService.fileExists(course.epubFile);

      if (!exists) {
        return res.status(404).json({
          success: false,
          message: "EPUB file not found in storage",
        });
      }

      // Generate signed URL with download disposition (valid for 1 hour)
      const signedUrl = await storageService.generatePresignedDownloadUrl(
        course.epubFile,
        3600
      );

      // Redirect to signed URL
      return res.redirect(signedUrl);
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

      // Delete associated files from GCS
      const storageService = getStorageService();

      if (course.epubFile) {
        try {
          await storageService.deleteFile(course.epubFile);
        } catch (error) {
          console.error("Failed to delete EPUB from GCS:", error);
        }
      }

      if (course.epubCover) {
        try {
          await storageService.deleteFile(course.epubCover);
        } catch (error) {
          console.error("Failed to delete cover from GCS:", error);
        }
      }

      // Delete multimedia files from GCS
      if (course.multimediaContent) {
        // Delete audio files
        for (const audioFile of course.multimediaContent.audio) {
          if (audioFile.path) {
            try {
              await storageService.deleteFile(audioFile.path);
            } catch (error) {
              console.error("Failed to delete audio file from GCS:", error);
            }
          }
        }

        // Delete video files
        for (const videoFile of course.multimediaContent.video) {
          if (videoFile.path) {
            try {
              await storageService.deleteFile(videoFile.path);
            } catch (error) {
              console.error("Failed to delete video file from GCS:", error);
            }
          }
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
   * Remove multimedia file from course (Admin only)
   */
  static async removeMultimediaFile(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id, fileId, type } = req.params;

      const course = await Course.findById(id);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course not found",
        });
      }

      if (!course.multimediaContent) {
        return res.status(404).json({
          success: false,
          message: "No multimedia content found",
        });
      }

      let fileToRemove: any = null;
      let filePath = "";

      // Find and remove the file based on type
      if (type === "audio") {
        const fileIndex = course.multimediaContent.audio.findIndex(
          (file) => file.id === fileId
        );
        if (fileIndex !== -1) {
          fileToRemove = course.multimediaContent.audio[fileIndex];
          filePath = fileToRemove.path;
          course.multimediaContent.audio.splice(fileIndex, 1);
        }
      } else if (type === "video") {
        const fileIndex = course.multimediaContent.video.findIndex(
          (file) => file.id === fileId
        );
        if (fileIndex !== -1) {
          fileToRemove = course.multimediaContent.video[fileIndex];
          filePath = fileToRemove.path;
          course.multimediaContent.video.splice(fileIndex, 1);
        }
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid file type. Must be 'audio' or 'video'",
        });
      }

      if (!fileToRemove) {
        return res.status(404).json({
          success: false,
          message: "File not found",
        });
      }

      // Delete the file from GCS
      if (filePath) {
        try {
          const storageService = getStorageService();
          await storageService.deleteFile(filePath);
        } catch (error) {
          console.error("Failed to delete file from GCS:", error);
        }
      }

      await course.save();

      res.json({
        success: true,
        message: "File removed successfully",
        data: {
          course: course,
          removedFile: fileToRemove,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Serve multimedia file
   */
  static async serveMultimediaFile(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id, type, filename } = req.params;

      const course = await Course.findById(id);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course not found",
        });
      }

      // Check if course is published or user has access
      if (!course.isPublished && !course.isActive) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      console.log("🎵 Serving multimedia file:", { id, type, filename });
      console.log("🎵 Course multimedia content:", course.multimediaContent);

      if (!course.multimediaContent) {
        return res.status(404).json({
          success: false,
          message: "No multimedia content found",
        });
      }

      let fileToServe: any = null;

      // Find the file based on type and filename
      if (type === "audio") {
        fileToServe = course.multimediaContent.audio.find(
          (file) => file.filename === filename
        );
      } else if (type === "video") {
        fileToServe = course.multimediaContent.video.find(
          (file) => file.filename === filename
        );
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid file type",
        });
      }

      if (!fileToServe) {
        return res.status(404).json({
          success: false,
          message: "File not found",
        });
      }

      // Generate signed URL for the file
      const storageService = getStorageService();
      const exists = await storageService.fileExists(fileToServe.path);

      if (!exists) {
        return res.status(404).json({
          success: false,
          message: "File not found in storage",
        });
      }

      // Generate signed URL (valid for 1 hour)
      const signedUrl = await storageService.generatePresignedDownloadUrl(
        fileToServe.path,
        3600
      );

      // Redirect to signed URL
      return res.redirect(signedUrl);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Serve cover image
   */
  static async serveCoverImage(
    req: Request,
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

      console.log("📸 Serving cover image for course:", id);
      console.log("📸 Course epubCover:", course.epubCover);

      if (!course.epubCover) {
        return res.status(404).json({
          success: false,
          message: "Cover image not found",
        });
      }

      // Generate signed URL for the cover image
      const storageService = getStorageService();
      const exists = await storageService.fileExists(course.epubCover);

      if (!exists) {
        return res.status(404).json({
          success: false,
          message: "Cover image not found in storage",
        });
      }

      // Generate signed URL (valid for 1 hour)
      const signedUrl = await storageService.generatePresignedDownloadUrl(
        course.epubCover,
        3600
      );

      // Redirect to signed URL
      return res.redirect(signedUrl);
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
