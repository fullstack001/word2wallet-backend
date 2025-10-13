import { Router } from "express";
import { PaymentTransactionController } from "../controllers/paymentTransactionController";
import { authenticate } from "../middleware/auth";
import {
  createTransactionValidation,
  verifyAccessTokenValidation,
} from "../validation/paymentTransactionValidation";

const router = Router();

/**
 * @route   POST /api/payment-transactions/create
 * @desc    Create payment transaction and generate access token (Public)
 * @access  Public
 */
router.post(
  "/create",
  createTransactionValidation,
  PaymentTransactionController.createTransaction
);

/**
 * @route   GET /api/payment-transactions/verify/:token
 * @desc    Verify access token and get book details (Public)
 * @access  Public
 */
router.get(
  "/verify/:token",
  verifyAccessTokenValidation,
  PaymentTransactionController.verifyAccessToken
);

/**
 * @route   GET /api/payment-transactions/download/:token
 * @desc    Download book using access token (Public)
 * @access  Public
 */
router.get(
  "/download/:token",
  verifyAccessTokenValidation,
  PaymentTransactionController.downloadBook
);

/**
 * @route   GET /api/payment-transactions
 * @desc    Get user's payment transactions (Authenticated)
 * @access  Private
 */
router.get("/", authenticate, PaymentTransactionController.getUserTransactions);

export default router;
