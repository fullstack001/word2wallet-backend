import express from "express";
import { demoLogin } from "../controllers/demoController";
import {
  createDemoAuction,
  getDemoAuctions,
} from "../controllers/demoAuctionController";

const router = express.Router();

// Demo login endpoint
router.post("/login", demoLogin);

// Demo auction endpoints
router.post("/auction", createDemoAuction);
router.get("/auctions", getDemoAuctions);

export default router;
