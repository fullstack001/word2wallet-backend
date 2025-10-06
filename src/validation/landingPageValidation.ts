import { body, param, query } from "express-validator";

// Landing Page Type validation
const validateLandingPageType = (value: string) => {
  const validTypes = [
    "simple_download",
    "email_signup",
    "restricted",
    "universal_link",
  ];
  if (!validTypes.includes(value)) {
    throw new Error("Invalid landing page type");
  }
  return true;
};

// Landing Page Settings validation
const validateLandingPageSettings = () => {
  return [
    body("landingPageSettings.pageLayout")
      .optional()
      .isString()
      .withMessage("Page layout must be a string"),
    body("landingPageSettings.include3DEffects")
      .optional()
      .isBoolean()
      .withMessage("Include 3D effects must be a boolean"),
    body("landingPageSettings.pageTheme")
      .optional()
      .isString()
      .withMessage("Page theme must be a string"),
    body("landingPageSettings.accentColor")
      .optional()
      .isString()
      .withMessage("Accent color must be a string"),
    body("landingPageSettings.pageTitle")
      .optional()
      .isString()
      .isLength({ max: 200 })
      .withMessage("Page title must be a string with max 200 characters"),
    body("landingPageSettings.buttonText")
      .optional()
      .isString()
      .isLength({ max: 50 })
      .withMessage("Button text must be a string with max 50 characters"),
    body("landingPageSettings.heading1.type")
      .optional()
      .isIn(["none", "tagline", "newsletter", "get_free_copy", "custom"])
      .withMessage("Invalid heading 1 type"),
    body("landingPageSettings.heading1.customText")
      .optional()
      .isString()
      .withMessage("Heading 1 custom text must be a string"),
    body("landingPageSettings.heading2.type")
      .optional()
      .isIn(["none", "tagline", "subscribers", "get_free_copy", "custom"])
      .withMessage("Invalid heading 2 type"),
    body("landingPageSettings.heading2.customText")
      .optional()
      .isString()
      .withMessage("Heading 2 custom text must be a string"),
    body("landingPageSettings.popupMessage.type")
      .optional()
      .isIn(["none", "default", "custom"])
      .withMessage("Invalid popup message type"),
    body("landingPageSettings.popupMessage.customText")
      .optional()
      .isString()
      .withMessage("Popup message custom text must be a string"),
    body("landingPageSettings.pageText.type")
      .optional()
      .isIn(["none", "book_description", "custom"])
      .withMessage("Invalid page text type"),
    body("landingPageSettings.pageText.customText")
      .optional()
      .isString()
      .withMessage("Page text custom text must be a string"),
  ];
};

// Download Page validation
const validateDownloadPage = () => {
  return [
    body("downloadPage.pageName")
      .optional()
      .isString()
      .isLength({ max: 200 })
      .withMessage("Page name must be a string with max 200 characters"),
    body("downloadPage.expirationDate")
      .optional({ checkFalsy: true })
      .isISO8601()
      .withMessage("Expiration date must be a valid date"),
    body("downloadPage.downloadLimit")
      .optional({ checkFalsy: true })
      .isInt({ min: 1 })
      .withMessage("Download limit must be a positive integer"),
    ...validateLandingPageSettings(),
    body("downloadPage.advancedSettings.allowMultipleDownloads")
      .optional()
      .isBoolean()
      .withMessage("Allow multiple downloads must be a boolean"),
    body("downloadPage.advancedSettings.requireEmailVerification")
      .optional()
      .isBoolean()
      .withMessage("Require email verification must be a boolean"),
    body("downloadPage.advancedSettings.customRedirectUrl")
      .optional({ checkFalsy: true })
      .isURL()
      .withMessage("Custom redirect URL must be a valid URL"),
  ];
};

// Email Signup Page validation
const validateEmailSignupPage = () => {
  return [
    body("emailSignupPage.pageName")
      .optional()
      .isString()
      .isLength({ max: 200 })
      .withMessage("Page name must be a string with max 200 characters"),
    body("emailSignupPage.mailingListAction")
      .optional()
      .isIn(["none", "optional", "required"])
      .withMessage("Invalid mailing list action"),
    body("emailSignupPage.integrationList")
      .optional()
      .isString()
      .withMessage("Integration list must be a string"),
    body("emailSignupPage.expirationDate")
      .optional({ checkFalsy: true })
      .isISO8601()
      .withMessage("Expiration date must be a valid date"),
    body("emailSignupPage.claimLimit")
      .optional({ checkFalsy: true })
      .isInt({ min: 1 })
      .withMessage("Claim limit must be a positive integer"),
    body("emailSignupPage.askFirstName")
      .optional()
      .isBoolean()
      .withMessage("Ask first name must be a boolean"),
    body("emailSignupPage.askLastName")
      .optional()
      .isBoolean()
      .withMessage("Ask last name must be a boolean"),
    body("emailSignupPage.confirmEmail")
      .optional()
      .isBoolean()
      .withMessage("Confirm email must be a boolean"),
    ...validateLandingPageSettings(),
    body("emailSignupPage.thankYouPageSettings.title")
      .optional()
      .isString()
      .withMessage("Thank you page title must be a string"),
    body("emailSignupPage.thankYouPageSettings.message")
      .optional()
      .isString()
      .withMessage("Thank you page message must be a string"),
    body("emailSignupPage.thankYouPageSettings.buttonText")
      .optional()
      .isString()
      .withMessage("Thank you page button text must be a string"),
    body("emailSignupPage.thankYouPageSettings.redirectUrl")
      .optional({ checkFalsy: true })
      .isURL()
      .withMessage("Thank you page redirect URL must be a valid URL"),
    body("emailSignupPage.advancedSettings.doubleOptIn")
      .optional()
      .isBoolean()
      .withMessage("Double opt-in must be a boolean"),
    body("emailSignupPage.advancedSettings.customThankYouMessage")
      .optional()
      .isString()
      .withMessage("Custom thank you message must be a string"),
    body("emailSignupPage.advancedSettings.autoResponder")
      .optional()
      .isBoolean()
      .withMessage("Auto responder must be a boolean"),
  ];
};

// Restricted Page validation
const validateRestrictedPage = () => {
  return [
    body("restrictedPage.pageName")
      .optional()
      .isString()
      .isLength({ max: 200 })
      .withMessage("Page name must be a string with max 200 characters"),
    body("restrictedPage.restrictedList")
      .optional()
      .isString()
      .withMessage("Restricted list must be a string"),
    body("restrictedPage.redirectUrl")
      .optional({ checkFalsy: true })
      .isURL()
      .withMessage("Redirect URL must be a valid URL"),
    body("restrictedPage.expirationDate")
      .optional({ checkFalsy: true })
      .isISO8601()
      .withMessage("Expiration date must be a valid date"),
    body("restrictedPage.downloadLimit")
      .optional({ checkFalsy: true })
      .isInt({ min: 1 })
      .withMessage("Download limit must be a positive integer"),
    body("restrictedPage.confirmEmail")
      .optional()
      .isBoolean()
      .withMessage("Confirm email must be a boolean"),
    ...validateLandingPageSettings(),
    body("restrictedPage.deliveryPageSettings.title")
      .optional()
      .isString()
      .withMessage("Delivery page title must be a string"),
    body("restrictedPage.deliveryPageSettings.message")
      .optional()
      .isString()
      .withMessage("Delivery page message must be a string"),
    body("restrictedPage.deliveryPageSettings.downloadButtonText")
      .optional()
      .isString()
      .withMessage("Delivery page download button text must be a string"),
    body("restrictedPage.deliveryPageSettings.showDownloadCount")
      .optional()
      .isBoolean()
      .withMessage("Show download count must be a boolean"),
    body("restrictedPage.advancedSettings.allowBookmarking")
      .optional()
      .isBoolean()
      .withMessage("Allow bookmarking must be a boolean"),
    body("restrictedPage.advancedSettings.customRestrictionMessage")
      .optional()
      .isString()
      .withMessage("Custom restriction message must be a string"),
    body("restrictedPage.advancedSettings.requireEmailVerification")
      .optional()
      .isBoolean()
      .withMessage("Require email verification must be a boolean"),
  ];
};

// Universal Book Link validation
const validateUniversalBookLink = () => {
  return [
    body("universalBookLink.linkName")
      .optional()
      .isString()
      .isLength({ max: 200 })
      .withMessage("Link name must be a string with max 200 characters"),
    body("universalBookLink.selectedBook")
      .if(body("type").equals("universal_link"))
      .notEmpty()
      .withMessage("Selected book is required for universal book link")
      .isString()
      .withMessage("Selected book must be a string"),
    body("universalBookLink.audioSample")
      .optional()
      .isString()
      .withMessage("Audio sample must be a string"),
    body("universalBookLink.displayEbookLinks")
      .optional()
      .isBoolean()
      .withMessage("Display ebook links must be a boolean"),
    body("universalBookLink.displayAudiobookLinks")
      .optional()
      .isBoolean()
      .withMessage("Display audiobook links must be a boolean"),
    body("universalBookLink.displayPaperbackLinks")
      .optional()
      .isBoolean()
      .withMessage("Display paperback links must be a boolean"),
    body("universalBookLink.expirationDate")
      .optional({ checkFalsy: true })
      .isISO8601()
      .withMessage("Expiration date must be a valid date"),
    ...validateLandingPageSettings(),
    body("universalBookLink.advancedSettings.trackClicks")
      .optional()
      .isBoolean()
      .withMessage("Track clicks must be a boolean"),
    body("universalBookLink.advancedSettings.customDomain")
      .optional()
      .isString()
      .withMessage("Custom domain must be a string"),
    body("universalBookLink.advancedSettings.analyticsEnabled")
      .optional()
      .isBoolean()
      .withMessage("Analytics enabled must be a boolean"),
  ];
};

// Main validation functions
export const validateCreateLandingPage = [
  body("bookId")
    .notEmpty()
    .withMessage("Book ID is required")
    .isMongoId()
    .withMessage("Invalid book ID format"),
  body("type")
    .notEmpty()
    .withMessage("Landing page type is required")
    .custom(validateLandingPageType),
  body("downloadPage")
    .optional()
    .isObject()
    .withMessage("Download page settings must be an object"),
  body("emailSignupPage")
    .optional()
    .isObject()
    .withMessage("Email signup page settings must be an object"),
  body("restrictedPage")
    .optional()
    .isObject()
    .withMessage("Restricted page settings must be an object"),
  body("universalBookLink")
    .optional()
    .isObject()
    .withMessage("Universal book link settings must be an object"),
  ...validateDownloadPage(),
  ...validateEmailSignupPage(),
  ...validateRestrictedPage(),
  ...validateUniversalBookLink(),
];

export const validateUpdateLandingPage = [
  param("id").isMongoId().withMessage("Invalid landing page ID format"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("Is active must be a boolean"),
  body("downloadPage")
    .optional()
    .isObject()
    .withMessage("Download page settings must be an object"),
  body("emailSignupPage")
    .optional()
    .isObject()
    .withMessage("Email signup page settings must be an object"),
  body("restrictedPage")
    .optional()
    .isObject()
    .withMessage("Restricted page settings must be an object"),
  body("universalBookLink")
    .optional()
    .isObject()
    .withMessage("Universal book link settings must be an object"),
  ...validateDownloadPage(),
  ...validateEmailSignupPage(),
  ...validateRestrictedPage(),
  ...validateUniversalBookLink(),
];

export const validateGetLandingPage = [
  param("id").isMongoId().withMessage("Invalid landing page ID format"),
];

export const validateDeleteLandingPage = [
  param("id").isMongoId().withMessage("Invalid landing page ID format"),
];

export const validateGetLandingPages = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("bookId").optional().isMongoId().withMessage("Invalid book ID format"),
  query("type").optional().custom(validateLandingPageType),
  query("isActive")
    .optional()
    .isBoolean()
    .withMessage("Is active must be a boolean"),
];

export const validateGetLandingPageAnalytics = [
  param("id").isMongoId().withMessage("Invalid landing page ID format"),
  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid date"),
  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid date"),
];

export const validateViewLandingPage = [
  param("id").isMongoId().withMessage("Invalid landing page ID format"),
];

export const validateLandingPageConversion = [
  param("id").isMongoId().withMessage("Invalid landing page ID format"),
  body("email")
    .optional()
    .isEmail()
    .withMessage("Email must be a valid email address"),
  body("firstName")
    .optional()
    .isString()
    .withMessage("First name must be a string"),
  body("lastName")
    .optional()
    .isString()
    .withMessage("Last name must be a string"),
  body("conversionType")
    .optional()
    .isString()
    .withMessage("Conversion type must be a string"),
];

export const validateDuplicateLandingPage = [
  param("id").isMongoId().withMessage("Invalid landing page ID format"),
];

export const validateToggleLandingPageStatus = [
  param("id").isMongoId().withMessage("Invalid landing page ID format"),
];
