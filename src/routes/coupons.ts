import { Router } from "express";
import { CouponController } from "../controllers/couponController";
import { authenticate, requireAdmin } from "../middleware/auth";
import {
  createCouponValidation,
  updateCouponValidation,
  couponIdValidation,
  getCouponsValidation,
} from "../validation/couponValidation";

const router = Router();

// Validate coupon code (public endpoint - must be before admin middleware)
router.get("/validate", CouponController.validateCoupon);

// All other coupon routes require admin authentication
router.use(authenticate, requireAdmin);

// Create coupon
router.post("/", createCouponValidation, CouponController.createCoupon);

// Get all coupons
router.get("/", getCouponsValidation, CouponController.getCoupons);

// Get coupon by ID
router.get("/:id", couponIdValidation, CouponController.getCouponById);

// Update coupon
router.put("/:id", updateCouponValidation, CouponController.updateCoupon);

// Delete coupon
router.delete("/:id", couponIdValidation, CouponController.deleteCoupon);

// Toggle coupon validity
router.patch(
  "/:id/toggle-validity",
  couponIdValidation,
  CouponController.toggleCouponValidity
);

export default router;
