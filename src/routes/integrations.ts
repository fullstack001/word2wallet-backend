import { Router } from "express";
import { IntegrationController } from "../controllers/integrationController";
import { auth } from "../middleware/auth";
import {
  connectBookFunnelValidation,
  getIntegrationValidation,
  updateIntegrationValidation,
  disconnectIntegrationValidation,
  deleteIntegrationValidation,
  testIntegrationValidation,
  syncIntegrationValidation,
} from "../validation/integrationValidation";

const router = Router();

// All routes require authentication
router.use(auth);

// Connect BookFunnel account
router.post(
  "/bookfunnel",
  connectBookFunnelValidation,
  IntegrationController.connectBookFunnel
);

// Get user integrations
router.get("/", IntegrationController.getUserIntegrations);

// Get integration by provider
router.get(
  "/:provider",
  getIntegrationValidation,
  IntegrationController.getIntegration
);

// Update integration settings
router.put(
  "/:id",
  updateIntegrationValidation,
  IntegrationController.updateIntegration
);

// Disconnect integration
router.patch(
  "/:id/disconnect",
  disconnectIntegrationValidation,
  IntegrationController.disconnectIntegration
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

// Sync integration data
router.post(
  "/:id/sync",
  syncIntegrationValidation,
  IntegrationController.syncIntegration
);

export default router;
