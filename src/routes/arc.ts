import { Router } from "express";
import { ArcController } from "../controllers/arcController";
import { auth } from "../middleware/auth";
import {
  createArcCampaignValidation,
  getBookArcLinksValidation,
  getUserArcLinksValidation,
  getArcLinkValidation,
  downloadArcValidation,
  updateArcLinkValidation,
  deleteArcLinkValidation,
  getArcLinkAnalyticsValidation,
} from "../validation/arcValidation";

const router = Router();

// Create ARC campaign (requires authentication)
router.post(
  "/campaigns",
  auth,
  createArcCampaignValidation,
  ArcController.createArcCampaign
);

// Get ARC links for a book (requires authentication)
router.get(
  "/books/:bookId/links",
  auth,
  getBookArcLinksValidation,
  ArcController.getBookArcLinks
);

// Get user's ARC links (requires authentication)
router.get(
  "/links",
  auth,
  getUserArcLinksValidation,
  ArcController.getUserArcLinks
);

// Get ARC link by code (public endpoint)
router.get("/links/:code", getArcLinkValidation, ArcController.getArcLink);

// Download ARC (public endpoint)
router.post(
  "/links/:code/download",
  downloadArcValidation,
  ArcController.downloadArc
);

// Update ARC link (requires authentication)
router.put(
  "/links/:id",
  auth,
  updateArcLinkValidation,
  ArcController.updateArcLink
);

// Delete ARC link (requires authentication)
router.delete(
  "/links/:id",
  auth,
  deleteArcLinkValidation,
  ArcController.deleteArcLink
);

// Get ARC link analytics (requires authentication)
router.get(
  "/links/:id/analytics",
  auth,
  getArcLinkAnalyticsValidation,
  ArcController.getArcLinkAnalytics
);

export default router;
