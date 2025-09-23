import { Router } from "express";
import { DashboardController } from "../controllers/dashboardController";
import { authenticate } from "../middleware/auth";

const router = Router();

// Protected routes (require authentication)
router.get("/", authenticate, DashboardController.getDashboardData);

export default router;
