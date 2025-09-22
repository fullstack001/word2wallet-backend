import { Router } from "express";
import { WebhookController } from "../controllers/webhookController";

const router = Router();

// Stripe webhook endpoint
router.post(
  "/stripe",
  // Raw body parser is needed for Stripe webhook signature verification
  WebhookController.handleWebhook
);

export default router;
