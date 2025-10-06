import express from "express";
import { LandingPageController } from "../controllers/landingPageController";
import { auth } from "../middleware/auth";
import {
  validateCreateLandingPage,
  validateUpdateLandingPage,
  validateGetLandingPage,
  validateDeleteLandingPage,
  validateGetLandingPages,
  validateGetLandingPageAnalytics,
  validateViewLandingPage,
  validateLandingPageConversion,
  validateDuplicateLandingPage,
  validateToggleLandingPageStatus,
} from "../validation/landingPageValidation";

const router = express.Router();

// Public routes (no authentication required) - MUST be defined BEFORE auth middleware

/**
 * @route   GET /api/landing-pages/public/:id
 * @desc    Public endpoint to view a landing page by ID
 * @access  Public
 */
router.get(
  "/public/:id",
  validateViewLandingPage,
  LandingPageController.viewLandingPage
);

/**
 * @route   POST /api/landing-pages/public/:id/conversion
 * @desc    Handle conversion from landing page (email capture, download, etc.)
 * @access  Public
 */
router.post(
  "/public/:id/conversion",
  validateLandingPageConversion,
  LandingPageController.handleLandingPageConversion
);

/**
 * @route   GET /api/landing-pages/confirm/:token
 * @desc    Confirm email with token and get download access
 * @access  Public
 */
router.get("/confirm/:token", LandingPageController.confirmEmailToken);

/**
 * @route   POST /api/landing-pages/send-book/:token
 * @desc    Send book file via email
 * @access  Public
 */
router.post("/send-book/:token", LandingPageController.sendBookViaEmail);

/**
 * @route   GET /api/landing-pages/download/:token
 * @desc    Download book file (public endpoint with token)
 * @access  Public
 * @query   format (epub or pdf)
 */
router.get("/download/:token", LandingPageController.downloadBook);

/**
 * @route   GET /api/landing-pages/simple_download/:id
 * @desc    Download book directly from simple_download landing page
 * @access  Public
 * @query   format (epub or pdf)
 */
router.get("/simple_download/:id", LandingPageController.simpleDownload);

// Protected routes (require authentication)
router.use(auth);

/**
 * @route   POST /api/landing-pages
 * @desc    Create a new landing page
 * @access  Private
 */
router.post(
  "/",
  validateCreateLandingPage,
  LandingPageController.createLandingPage
);

/**
 * @route   GET /api/landing-pages
 * @desc    Get all landing pages for the authenticated user
 * @access  Private
 * @query   page, limit, bookId, type, isActive
 */
router.get("/", validateGetLandingPages, LandingPageController.getLandingPages);

/**
 * @route   GET /api/landing-pages/:id
 * @desc    Get a single landing page by ID
 * @access  Private
 */
router.get(
  "/:id",
  validateGetLandingPage,
  LandingPageController.getLandingPage
);

/**
 * @route   PUT /api/landing-pages/:id
 * @desc    Update a landing page
 * @access  Private
 */
router.put(
  "/:id",
  validateUpdateLandingPage,
  LandingPageController.updateLandingPage
);

/**
 * @route   DELETE /api/landing-pages/:id
 * @desc    Delete a landing page
 * @access  Private
 */
router.delete(
  "/:id",
  validateDeleteLandingPage,
  LandingPageController.deleteLandingPage
);

/**
 * @route   GET /api/landing-pages/:id/analytics
 * @desc    Get analytics for a landing page
 * @access  Private
 * @query   startDate, endDate
 */
router.get(
  "/:id/analytics",
  validateGetLandingPageAnalytics,
  LandingPageController.getLandingPageAnalytics
);

/**
 * @route   POST /api/landing-pages/:id/duplicate
 * @desc    Duplicate a landing page
 * @access  Private
 */
router.post(
  "/:id/duplicate",
  validateDuplicateLandingPage,
  LandingPageController.duplicateLandingPage
);

/**
 * @route   PATCH /api/landing-pages/:id/toggle-status
 * @desc    Toggle landing page active status
 * @access  Private
 */
router.patch(
  "/:id/toggle-status",
  validateToggleLandingPageStatus,
  LandingPageController.toggleLandingPageStatus
);

export default router;
