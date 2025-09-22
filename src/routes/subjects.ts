import { Router } from "express";
import { SubjectController } from "../controllers/subjectController";
import { authenticate, requireAdmin } from "../middleware/auth";
import {
  createSubjectValidation,
  updateSubjectValidation,
  idValidation,
} from "../validation";

const router = Router();

// Public routes
router.get("/active", SubjectController.getActiveSubjects);

// Protected routes (require authentication)
router.get("/", authenticate, SubjectController.getSubjects);
router.get(
  "/id/:id",
  authenticate,
  idValidation,
  SubjectController.getSubjectById
);
router.get("/:slug", authenticate, SubjectController.getSubjectBySlug);

// Admin routes
router.post(
  "/",
  authenticate,
  requireAdmin,
  createSubjectValidation,
  SubjectController.createSubject
);
router.put(
  "/:id",
  authenticate,
  requireAdmin,
  idValidation,
  updateSubjectValidation,
  SubjectController.updateSubject
);
router.delete(
  "/:id",
  authenticate,
  requireAdmin,
  idValidation,
  SubjectController.deleteSubject
);
router.patch(
  "/:id/toggle-status",
  authenticate,
  requireAdmin,
  idValidation,
  SubjectController.toggleSubjectStatus
);

export default router;
