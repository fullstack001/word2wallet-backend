import { body, param, query } from "express-validator";

export const emailMarketingValidation = {
  // Get lists validation
  getLists: [
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

  // Add contact validation
  addContact: [
    body("provider")
      .isIn([
        "mailchimp",
        "convertkit",
        "active_campaign",
        "drip",
        "sendinblue",
      ])
      .withMessage("Invalid email marketing provider"),
    body("email")
      .isEmail()
      .withMessage("Valid email is required")
      .normalizeEmail(),
    body("firstName")
      .optional()
      .isString()
      .withMessage("First name must be a string")
      .isLength({ min: 1, max: 50 })
      .withMessage("First name must be between 1 and 50 characters"),
    body("lastName")
      .optional()
      .isString()
      .withMessage("Last name must be a string")
      .isLength({ min: 1, max: 50 })
      .withMessage("Last name must be between 1 and 50 characters"),
    body("tags").optional().isArray().withMessage("Tags must be an array"),
    body("tags.*")
      .optional()
      .isString()
      .withMessage("Each tag must be a string")
      .isLength({ min: 1, max: 30 })
      .withMessage("Each tag must be between 1 and 30 characters"),
    body("customFields")
      .optional()
      .isObject()
      .withMessage("Custom fields must be an object"),
    body("listId")
      .optional()
      .isString()
      .withMessage("List ID must be a string")
      .isLength({ min: 1, max: 100 })
      .withMessage("List ID must be between 1 and 100 characters"),
  ],

  // Sync email captures validation
  syncEmailCaptures: [
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
      .isArray({ min: 1, max: 100 })
      .withMessage("Email capture IDs array is required (1-100 items)"),
    body("emailCaptureIds.*")
      .isMongoId()
      .withMessage("Invalid email capture ID"),
    body("listId")
      .optional()
      .isString()
      .withMessage("List ID must be a string")
      .isLength({ min: 1, max: 100 })
      .withMessage("List ID must be between 1 and 100 characters"),
  ],

  // Bulk sync validation
  bulkSyncEmailCaptures: [
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
      .withMessage("List ID must be a string")
      .isLength({ min: 1, max: 100 })
      .withMessage("List ID must be between 1 and 100 characters"),
    body("startDate")
      .optional()
      .isISO8601()
      .withMessage("Start date must be a valid ISO 8601 date")
      .custom((value) => {
        if (new Date(value) > new Date()) {
          throw new Error("Start date cannot be in the future");
        }
        return true;
      }),
    body("endDate")
      .optional()
      .isISO8601()
      .withMessage("End date must be a valid ISO 8601 date")
      .custom((value) => {
        if (new Date(value) > new Date()) {
          throw new Error("End date cannot be in the future");
        }
        return true;
      }),
    body().custom((body) => {
      if (body.startDate && body.endDate) {
        if (new Date(body.startDate) > new Date(body.endDate)) {
          throw new Error("Start date must be before end date");
        }
      }
      return true;
    }),
  ],

  // Test integration validation
  testIntegration: [
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

  // Get integration stats validation
  getIntegrationStats: [
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
};
