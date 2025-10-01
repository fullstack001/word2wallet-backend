import { Router } from "express";
import { IntegrationController } from "../controllers/integrationController";
import { auth } from "../middleware/auth";
import {
  getIntegrationByIdValidation,
  deleteIntegrationValidation,
  testIntegrationValidation,
} from "../validation/integrationValidation";

const router = Router();

// All routes require authentication
router.use(auth);

// Get user integrations
router.get("/", IntegrationController.getUserIntegrations);

// Get integration by ID
router.get(
  "/:id",
  getIntegrationByIdValidation,
  IntegrationController.getIntegrationById
);

// Delete integration
router.delete(
  "/:id",
  deleteIntegrationValidation,
  IntegrationController.deleteIntegration
);

// Test integration connection
router.post(
  "/:id/test",
  testIntegrationValidation,
  IntegrationController.testIntegration
);

export default router;
