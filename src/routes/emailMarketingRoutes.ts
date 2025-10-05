import { Router } from "express";
import { body, param } from "express-validator";
import { EmailMarketingController } from "../controllers/emailMarketingController";
import { auth } from "../middleware/auth";

const router = Router();

// Apply authentication middleware to all routes
router.use(auth);

/**
 * @route GET /api/email-marketing/integrations
 * @desc Get user's email marketing integrations
 * @access Private
 */
router.get("/integrations", EmailMarketingController.getIntegrations);

/**
 * @route GET /api/email-marketing/integrations/:provider/lists
 * @desc Get lists from email marketing provider
 * @access Private
 */
router.get(
  "/integrations/:provider/lists",
  [
    param("provider")
      .isIn([
        "mailchimp",
        "convertkit",
        "active_campaign",
        "drip",
        "sendinblue",
      ])
      .withMessage("Invalid email marketing provider"),
  ],
  EmailMarketingController.getLists
);

/**
 * @route POST /api/email-marketing/contacts
 * @desc Add contact to email marketing provider
 * @access Private
 */
router.post(
  "/contacts",
  [
    body("provider")
      .isIn([
        "mailchimp",
        "convertkit",
        "active_campaign",
        "drip",
        "sendinblue",
      ])
      .withMessage("Invalid email marketing provider"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("firstName")
      .optional()
      .isString()
      .withMessage("First name must be a string"),
    body("lastName")
      .optional()
      .isString()
      .withMessage("Last name must be a string"),
    body("tags").optional().isArray().withMessage("Tags must be an array"),
    body("customFields")
      .optional()
      .isObject()
      .withMessage("Custom fields must be an object"),
    body("listId")
      .optional()
      .isString()
      .withMessage("List ID must be a string"),
  ],
  EmailMarketingController.addContact
);

/**
 * @route POST /api/email-marketing/sync
 * @desc Sync email captures to email marketing provider
 * @access Private
 */
router.post(
  "/sync",
  [
    body("provider")
      .isIn([
        "mailchimp",
        "convertkit",
        "active_campaign",
        "drip",
        "sendinblue",
      ])
      .withMessage("Invalid email marketing provider"),
    body("emailCaptureIds")
      .isArray({ min: 1 })
      .withMessage("Email capture IDs array is required"),
    body("emailCaptureIds.*")
      .isMongoId()
      .withMessage("Invalid email capture ID"),
    body("listId")
      .optional()
      .isString()
      .withMessage("List ID must be a string"),
  ],
  EmailMarketingController.syncEmailCaptures
);

/**
 * @route POST /api/email-marketing/bulk-sync
 * @desc Bulk sync all email captures to email marketing provider
 * @access Private
 */
router.post(
  "/bulk-sync",
  [
    body("provider")
      .isIn([
        "mailchimp",
        "convertkit",
        "active_campaign",
        "drip",
        "sendinblue",
      ])
      .withMessage("Invalid email marketing provider"),
    body("listId")
      .optional()
      .isString()
      .withMessage("List ID must be a string"),
    body("startDate")
      .optional()
      .isISO8601()
      .withMessage("Start date must be a valid date"),
    body("endDate")
      .optional()
      .isISO8601()
      .withMessage("End date must be a valid date"),
  ],
  EmailMarketingController.bulkSyncEmailCaptures
);

/**
 * @route POST /api/email-marketing/integrations/:provider/test
 * @desc Test email marketing integration
 * @access Private
 */
router.post(
  "/integrations/:provider/test",
  [
    param("provider")
      .isIn([
        "mailchimp",
        "convertkit",
        "active_campaign",
        "drip",
        "sendinblue",
      ])
      .withMessage("Invalid email marketing provider"),
  ],
  EmailMarketingController.testIntegration
);

/**
 * @route GET /api/email-marketing/integrations/:provider/stats
 * @desc Get integration statistics
 * @access Private
 */
router.get(
  "/integrations/:provider/stats",
  [
    param("provider")
      .isIn([
        "mailchimp",
        "convertkit",
        "active_campaign",
        "drip",
        "sendinblue",
      ])
      .withMessage("Invalid email marketing provider"),
  ],
  EmailMarketingController.getIntegrationStats
);

export default router;
