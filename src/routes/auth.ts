import { Router } from "express";
import { AuthController } from "../controllers/authController";
import { authenticate } from "../middleware/auth";
import {
  registerValidation,
  loginValidation,
  refreshTokenValidation,
  updateProfileValidation,
  changePasswordValidation,
} from "../validation";

const router = Router();

// Routes
router.post("/register", registerValidation, AuthController.register);
router.post("/login", loginValidation, AuthController.login);
router.post(
  "/refresh-token",
  refreshTokenValidation,
  AuthController.refreshToken
);
router.get("/profile", authenticate, AuthController.getProfile);
router.put(
  "/profile",
  authenticate,
  updateProfileValidation,
  AuthController.updateProfile
);
router.put(
  "/change-password",
  authenticate,
  changePasswordValidation,
  AuthController.changePassword
);
router.post("/logout", authenticate, AuthController.logout);

export default router;
