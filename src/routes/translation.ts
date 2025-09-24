import express from "express";
import { TranslationController } from "../controllers/translationController";
import { authenticate } from "../middleware/auth";
import {
  translateTextValidation,
  translateHtmlValidation,
  detectLanguageValidation,
} from "../validation/translationValidation";

const router = express.Router();

// Initialize translation service when the module loads
TranslationController.initialize();

// Public routes (no authentication required for basic translation)
router.post(
  "/translate-text",
  translateTextValidation,
  TranslationController.translateText
);

router.post(
  "/translate-html",
  translateHtmlValidation,
  TranslationController.translateHtmlContent
);

router.post(
  "/detect-language",
  detectLanguageValidation,
  TranslationController.detectLanguage
);

router.get("/supported-languages", TranslationController.getSupportedLanguages);

// Authenticated routes (for premium features or usage tracking)
router.post(
  "/translate-text-auth",
  authenticate,
  translateTextValidation,
  TranslationController.translateText
);

router.post(
  "/translate-html-auth",
  authenticate,
  translateHtmlValidation,
  TranslationController.translateHtmlContent
);

router.post(
  "/detect-language-auth",
  authenticate,
  detectLanguageValidation,
  TranslationController.detectLanguage
);

export default router;
