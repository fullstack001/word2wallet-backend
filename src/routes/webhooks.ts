import { Router } from "express";
import { WebhookController } from "../controllers/webhookController";

const router = Router();

// Stripe webhook endpoint
router.post(
  "/stripe",
  // Raw body parser is needed for Stripe webhook signature verification
  WebhookController.handleWebhook
);

// BookFunnel webhook endpoint
router.post("/bookfunnel", WebhookController.handleBookFunnelWebhook);

// Generic webhook endpoint (for testing)
router.post("/generic", WebhookController.handleGenericWebhook);

// Webhook verification endpoint (for BookFunnel)
router.get("/verify", WebhookController.verifyWebhook);

export default router;
