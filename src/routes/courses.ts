import { Router } from "express";
import { CourseController } from "../controllers/courseController";
import { authenticate, requireAdmin } from "../middleware/auth";
import { uploadCourseContent, handleUploadError } from "../middleware/upload";
import {
  createCourseValidation,
  updateCourseValidation,
  courseIdValidation,
  multimediaFileValidation,
} from "../validation";

const router = Router();

// Public routes
router.get("/published", CourseController.getPublishedCourses);
router.get("/:id/epub", courseIdValidation, CourseController.serveEpub);
router.get("/:id/download", courseIdValidation, CourseController.downloadEpub);
router.get("/:id/cover", courseIdValidation, CourseController.serveCoverImage);
router.get(
  "/:id/multimedia/:type/:filename",
  courseIdValidation,
  CourseController.serveMultimediaFile
);

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
  uploadCourseContent.fields([
    { name: "cover", maxCount: 1 },
    { name: "audio", maxCount: 10 },
    { name: "video", maxCount: 10 },
  ]),
  handleUploadError,
  createCourseValidation,
  CourseController.createCourse
);
router.put(
  "/:id",
  authenticate,
  requireAdmin,
  uploadCourseContent.fields([
    { name: "epubCover", maxCount: 1 },
    { name: "audio", maxCount: 10 },
    { name: "video", maxCount: 10 },
  ]),
  handleUploadError,
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

// Individual multimedia file management (Admin only)

router.delete(
  "/:id/multimedia/:type/:fileId",
  authenticate,
  requireAdmin,
  multimediaFileValidation,
  CourseController.removeMultimediaFile
);

export default router;
