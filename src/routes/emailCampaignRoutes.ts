import { Router } from "express";
import { EmailCampaignController } from "../controllers/emailCampaignController";
import { authenticate } from "../middleware/auth";
import { body } from "express-validator";

const router = Router();

// Validation middleware
const createCampaignValidation = [
  body("name").custom((value) => {
    if (typeof value !== "string") {
      throw new Error("Campaign name must be a string");
    }
    const trimmed = value.trim();
    if (trimmed.length < 1) {
      throw new Error("Campaign name is required");
    }
    if (trimmed.length > 200) {
      throw new Error("Campaign name must be less than 200 characters");
    }
    return true;
  }),
  body("subject").custom((value) => {
    if (typeof value !== "string") {
      throw new Error("Email subject must be a string");
    }
    const trimmed = value.trim();
    if (trimmed.length < 1) {
      throw new Error("Email subject is required");
    }
    if (trimmed.length > 300) {
      throw new Error("Email subject must be less than 300 characters");
    }
    return true;
  }),
  body("content").custom((value) => {
    if (typeof value !== "string") {
      throw new Error("Email content must be a string");
    }
    const trimmed = value.trim();
    if (trimmed.length < 1) {
      throw new Error("Email content is required");
    }
    return true;
  }),
  body("books").optional().isArray().withMessage("Books must be an array"),
  body("scheduledAt")
    .optional()
    .isISO8601()
    .withMessage("Scheduled date must be a valid ISO date"),
];

const updateCampaignValidation = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Campaign name must be less than 200 characters"),
  body("subject")
    .optional()
    .trim()
    .isLength({ min: 1, max: 300 })
    .withMessage("Email subject must be less than 300 characters"),
  body("content")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("Email content cannot be empty"),
  body("books").optional().isArray().withMessage("Books must be an array"),

  body("scheduledAt")
    .optional()
    .isISO8601()
    .withMessage("Scheduled date must be a valid ISO date"),
];

// Apply authentication to all routes
router.use(authenticate);

// Campaign CRUD routes
router.post(
  "/",
  createCampaignValidation,
  EmailCampaignController.createCampaign
);
router.get("/", EmailCampaignController.getCampaigns);
router.get("/books", EmailCampaignController.getUserBooks);
router.get("/books/:bookId/links", EmailCampaignController.getBookLinks);
router.get("/:id", EmailCampaignController.getCampaign);
router.put(
  "/:id",
  updateCampaignValidation,
  EmailCampaignController.updateCampaign
);
router.delete("/:id", EmailCampaignController.deleteCampaign);

// Send campaign route
router.post("/:id/send", EmailCampaignController.sendCampaign);

// Receiver upload route
router.post(
  "/:campaignId/receivers",
  EmailCampaignController.upload.single("receivers"),
  EmailCampaignController.uploadReceivers
);

export default router;
