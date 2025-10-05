import { Router } from "express";
import { LandingPageController } from "../controllers/landingPageController";
import { auth } from "../middleware/auth";
import {
  createLandingPageValidation,
  updateLandingPageValidation,
  getLandingPageValidation,
  deleteLandingPageValidation,
  getLandingPagesValidation,
  getLandingPageAnalyticsValidation,
} from "../validation/landingPageValidation";

const router = Router();

// All routes require authentication
router.use(auth);

// Create landing page
router.post(
  "/",
  createLandingPageValidation,
  LandingPageController.createLandingPage
);

// Get user's landing pages
router.get(
  "/",
  getLandingPagesValidation,
  LandingPageController.getLandingPages
);

// Get landing page by ID
router.get(
  "/:id",
  getLandingPageValidation,
  LandingPageController.getLandingPage
);

// Update landing page
router.put(
  "/:id",
  updateLandingPageValidation,
  LandingPageController.updateLandingPage
);

// Delete landing page
router.delete(
  "/:id",
  deleteLandingPageValidation,
  LandingPageController.deleteLandingPage
);

// Get landing page analytics
router.get(
  "/:id/analytics",
  getLandingPageAnalyticsValidation,
  LandingPageController.getLandingPageAnalytics
);

// Public routes (no auth required)
// View landing page by slug
router.get("/public/:slug", LandingPageController.viewLandingPage);

// Handle conversion from landing page
router.post(
  "/public/:slug/conversion",
  LandingPageController.handleLandingPageConversion
);

export default router;

