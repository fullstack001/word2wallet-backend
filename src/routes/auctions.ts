import express from "express";
import { body } from "express-validator";
import { authenticate as auth } from "../middleware/auth";
import {
  getAuctionSnapshot,
  placeBid,
  buyNow,
  createOffer,
  getAuctionOffers,
  acceptOffer,
  declineOffer,
  getAuctionBids,
  createAuction,
  getUserAuctions,
  getAllAuctions,
  updateAuction,
  deleteAuction,
} from "../controllers/auctionController";

const router = express.Router();

// Validation middleware
const bidValidation = [
  body("amount")
    .isNumeric()
    .withMessage("Bid amount must be a number")
    .isFloat({ min: 0.01 })
    .withMessage("Bid amount must be at least 0.01"),
];

const offerValidation = [
  body("amount")
    .isNumeric()
    .withMessage("Offer amount must be a number")
    .isFloat({ min: 0.01 })
    .withMessage("Offer amount must be at least 0.01"),
];

const auctionValidation = [
  body("title")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Title must be between 1 and 200 characters"),
  body("description")
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage("Description must be between 1 and 2000 characters"),
  body("startingPrice")
    .isNumeric()
    .withMessage("Starting price must be a number")
    .isFloat({ min: 0.01 })
    .withMessage("Starting price must be at least 0.01"),
  body("reservePrice")
    .optional()
    .isNumeric()
    .withMessage("Reserve price must be a number")
    .isFloat({ min: 0.01 })
    .withMessage("Reserve price must be at least 0.01"),
  body("buyNowPrice")
    .optional()
    .isNumeric()
    .withMessage("Buy now price must be a number")
    .isFloat({ min: 0.01 })
    .withMessage("Buy now price must be at least 0.01"),
  body("startTime").isISO8601().withMessage("Start time must be a valid date"),
  body("endTime").isISO8601().withMessage("End time must be a valid date"),
  body("currency")
    .optional()
    .isIn(["USD", "EUR", "GBP", "CAD", "AUD"])
    .withMessage("Currency must be one of: USD, EUR, GBP, CAD, AUD"),
];

// Public routes
router.get("/", getAllAuctions);
router.get("/:id/snapshot", getAuctionSnapshot);
router.get("/:id/bids", getAuctionBids);

// Protected routes (require authentication)
router.post("/", auth, auctionValidation, createAuction);
router.get("/my/auctions", auth, getUserAuctions);
router.put("/:id", auth, auctionValidation, updateAuction);
router.delete("/:id", auth, deleteAuction);
router.post("/:id/bids", auth, bidValidation, placeBid);
router.post("/:id/buy-now", auth, buyNow);
router.post("/:id/offers", auth, offerValidation, createOffer);
router.get("/:id/offers", auth, getAuctionOffers);
router.post("/offers/:offerId/accept", auth, acceptOffer);
router.post("/offers/:offerId/decline", auth, declineOffer);

export default router;
