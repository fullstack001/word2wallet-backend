import jwt from "jsonwebtoken";
import { JWTPayload, RefreshTokenPayload, UserRole } from "../types";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key";
const JWT_EXPIRE = process.env.JWT_EXPIRE || "7d";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "fallback-refresh-secret";
const JWT_REFRESH_EXPIRE = process.env.JWT_REFRESH_EXPIRE || "30d";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class JWTUtils {
  /**
   * Generate access token
   */
  static generateAccessToken(payload: Omit<JWTPayload, "iat" | "exp">): string {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRE,
      issuer: "word2wallet-api",
      audience: "word2wallet-client",
    } as jwt.SignOptions);
  }

  /**
   * Generate refresh token
   */
  static generateRefreshToken(
    payload: Omit<RefreshTokenPayload, "iat" | "exp">
  ): string {
    return jwt.sign(payload, JWT_REFRESH_SECRET, {
      expiresIn: JWT_REFRESH_EXPIRE,
      issuer: "word2wallet-api",
      audience: "word2wallet-client",
    } as jwt.SignOptions);
  }

  /**
   * Generate both access and refresh tokens
   */
  static generateTokenPair(
    userId: string,
    email: string,
    role: UserRole
  ): TokenPair {
    const accessToken = this.generateAccessToken({
      userId,
      email,
      role,
    });

    const refreshToken = this.generateRefreshToken({
      userId,
      tokenVersion: 1, // You can implement token versioning for security
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, JWT_SECRET, {
        issuer: "word2wallet-api",
        audience: "word2wallet-client",
      } as jwt.VerifyOptions) as JWTPayload;
    } catch (error) {
      throw new Error("Invalid or expired access token");
    }
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      return jwt.verify(token, JWT_REFRESH_SECRET, {
        issuer: "word2wallet-api",
        audience: "word2wallet-client",
      } as jwt.VerifyOptions) as RefreshTokenPayload;
    } catch (error) {
      throw new Error("Invalid or expired refresh token");
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  static decodeToken(token: string): any {
    return jwt.decode(token);
  }

  /**
   * Get token expiration time
   */
  static getTokenExpiration(token: string): Date | null {
    try {
      const decoded = jwt.decode(token) as any;
      if (decoded && decoded.exp) {
        return new Date(decoded.exp * 1000);
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(token: string): boolean {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) return true;
    return expiration < new Date();
  }
}
