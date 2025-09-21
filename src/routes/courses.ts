import { Router } from "express";
import { CourseController } from "../controllers/courseController";
import { authenticate, requireAdmin } from "../middleware/auth";
import {
  uploadEpub,
  uploadThumbnail,
  handleUploadError,
} from "../middleware/upload";
import {
  createCourseValidation,
  updateCourseValidation,
  courseIdValidation,
} from "../validation";

const router = Router();

// Public routes
router.get("/published", CourseController.getPublishedCourses);
router.get("/:id/download", courseIdValidation, CourseController.downloadEpub);

// Protected routes (require authentication)
router.get("/", authenticate, CourseController.getCourses);
router.get(
  "/id/:id",
  authenticate,
  courseIdValidation,
  CourseController.getCourseById
);

// Admin routes
router.post(
  "/",
  authenticate,
  requireAdmin,
  createCourseValidation,
  CourseController.createCourse
);
router.put(
  "/:id",
  authenticate,
  requireAdmin,
  courseIdValidation,
  updateCourseValidation,
  CourseController.updateCourse
);
router.delete(
  "/:id",
  authenticate,
  requireAdmin,
  courseIdValidation,
  CourseController.deleteCourse
);
router.patch(
  "/:id/toggle-published",
  authenticate,
  requireAdmin,
  courseIdValidation,
  CourseController.togglePublishedStatus
);

// File upload routes (Admin only)
router.post(
  "/:id/upload-epub",
  authenticate,
  requireAdmin,
  courseIdValidation,
  uploadEpub.single("epub"),
  handleUploadError,
  CourseController.uploadEpub
);

router.post(
  "/:id/upload-thumbnail",
  authenticate,
  requireAdmin,
  courseIdValidation,
  uploadThumbnail.single("thumbnail"),
  handleUploadError,
  CourseController.uploadThumbnail
);

export default router;
