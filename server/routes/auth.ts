import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { storage } from "../storage";
import {
  sendEmail,
  verificationEmailHtml,
  passwordResetOtpEmailHtml,
} from "../email";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@shared/schema";
import { z } from "zod";
import {
  AuthRequest,
  authMiddleware,
  getRateLimitClientId,
  rateLimiter,
} from "../middleware";
import { sanitizeString } from "../lib/api-response";
import { logger } from "../lib/logger";
import { effectiveSubscriptionStatus } from "../lib/subscription-status";
import {
  getScanLoginSettings,
  parseScannedLoginCode,
  verifyScanLoginCode,
} from "../lib/scan-login";
import {
  createOrReplaceUserSession,
  getActiveSession,
  hashRefreshToken,
  revokeSession,
  revokeUserSessions,
  type DeviceIdentity,
} from "../lib/device-sessions";

const router = Router();

router.get("/scan-login-settings", async (_req, res) => {
  try {
    const settings = await getScanLoginSettings();
    const {
      codeHash: _codeHash,
      targetEmail: _targetEmail,
      ...publicSettings
    } = settings;
    res.json(publicSettings);
  } catch (error) {
    logger.error("Get public scan login settings error", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ message: "Failed to load scan login settings" });
  }
});

// ── OTP Attempt Lockout ──────────────────────────────────────
const OTP_MAX_ATTEMPTS = 5;
const OTP_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const otpAttemptStore = new Map<string, { count: number; resetTime: number }>();

function checkOtpAttempts(email: string): boolean {
  const key = email.toLowerCase();
  const entry = otpAttemptStore.get(key);
  if (!entry) return false;
  if (Date.now() > entry.resetTime) {
    otpAttemptStore.delete(key);
    return false;
  }
  return entry.count >= OTP_MAX_ATTEMPTS;
}

function recordOtpAttempt(email: string): void {
  const key = email.toLowerCase();
  const entry = otpAttemptStore.get(key);
  if (!entry || Date.now() > entry.resetTime) {
    otpAttemptStore.set(key, {
      count: 1,
      resetTime: Date.now() + OTP_WINDOW_MS,
    });
  } else {
    entry.count++;
  }
}

function clearOtpAttempts(email: string): void {
  otpAttemptStore.delete(email.toLowerCase());
}

function getJwtSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET environment variable must be set. Never use a hardcoded secret in production.",
    );
  }
  return secret;
}
const JWT_EXPIRES_IN = "7d";
const REFRESH_EXPIRES_IN = "30d";

const ACCOUNT_DEACTIVATED_MESSAGE =
  "Your account has been deactivated. Please contact support to reactivate it.";
const ACCOUNT_DELETION_PENDING_MESSAGE =
  "Your account deletion request is in progress. Please contact support if you need help.";

function generateToken(userId: string, sessionId: string): string {
  return jwt.sign({ userId, sessionId }, getJwtSecret(), {
    expiresIn: JWT_EXPIRES_IN,
  });
}

function generateRefreshToken(userId: string, sessionId: string): string {
  return jwt.sign({ userId, sessionId, type: "refresh" }, getJwtSecret(), {
    expiresIn: REFRESH_EXPIRES_IN,
  });
}

function parseDeviceIdentity(body: unknown): DeviceIdentity {
  const input = body && typeof body === "object" ? (body as any) : {};
  return {
    deviceId:
      typeof input.deviceId === "string" ? sanitizeString(input.deviceId) : "",
    deviceLabel:
      typeof input.deviceLabel === "string"
        ? sanitizeString(input.deviceLabel)
        : "",
    platform:
      typeof input.platform === "string" ? sanitizeString(input.platform) : "",
  };
}

async function issueSessionTokens(
  user: NonNullable<Awaited<ReturnType<typeof storage.getUser>>>,
  req: AuthRequest,
) {
  const sessionId = crypto.randomUUID();
  const refreshToken = generateRefreshToken(user.id, sessionId);
  const session = await createOrReplaceUserSession({
    sessionId,
    user,
    refreshToken,
    device: parseDeviceIdentity(req.body),
    req,
  });
  const accessToken = generateToken(user.id, session.id);

  return {
    accessToken,
    refreshToken,
    session,
  };
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getBlockedAccountState(
  user: Awaited<ReturnType<typeof storage.getUser>>,
) {
  if (!user) return null;

  if (!user.isActive) {
    return {
      status: 403,
      code: "ACCOUNT_DEACTIVATED",
      message: ACCOUNT_DEACTIVATED_MESSAGE,
    };
  }

  if (
    user.deletionStatus === "requested" ||
    user.deletionStatus === "processing"
  ) {
    return {
      status: 403,
      code: "ACCOUNT_DELETION_PENDING",
      message: ACCOUNT_DELETION_PENDING_MESSAGE,
    };
  }

  return null;
}

function serializeUser(
  user: NonNullable<Awaited<ReturnType<typeof storage.getUser>>>,
) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
    subscriptionStatus: effectiveSubscriptionStatus(
      user.subscriptionStatus,
      user.subscriptionExpiresAt,
    ),
    subscriptionPlan: user.subscriptionPlan,
    isEmailVerified: user.isEmailVerified,
    isActive: user.isActive,
    deactivatedAt: user.deactivatedAt,
    deletionRequestedAt: user.deletionRequestedAt,
    deletionStatus: user.deletionStatus,
    createdAt: user.createdAt,
  };
}

router.post("/register", rateLimiter(5, 15 * 60 * 1000), async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);

    // Sanitize user-supplied strings before use
    data.name = sanitizeString(data.name);
    data.email = sanitizeString(data.email);

    const existingUser = await storage.getUserByEmail(data.email);
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);
    const emailOtp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    // Create user but mark as unverified
    const user = await storage.createUser({
      email: data.email,
      password: hashedPassword,
      name: data.name,
      emailVerificationToken: emailOtp,
      emailTokenExpiresAt: otpExpiresAt,
      isEmailVerified: false,
    });

    // Send Verification Email via Brevo SMTP
    const emailSent = await sendEmail({
      to: user.email,
      subject: "Verify Your Email - Maternal Mind",
      html: verificationEmailHtml(emailOtp),
    });

    if (!emailSent && process.env.NODE_ENV !== "production") {
      logger.debug("Email OTP generated", { email: user.email, otp: emailOtp });
    }

    // Do NOT return access token yet. User must verify email first.
    res.json({
      requiresEmailVerification: true,
      email: user.email,
      message: "Please verify your email to continue",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    logger.error("Register error", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ message: "Registration failed" });
  }
});

router.post(
  "/verify-email",
  rateLimiter(10, 15 * 60 * 1000),
  async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ message: "Email and code are required" });
      }

      // Sanitize user-supplied strings before use
      const sanitizedEmail = sanitizeString(email);
      const sanitizedCode = sanitizeString(code);

      // Check OTP attempt lockout before any verification logic
      if (checkOtpAttempts(sanitizedEmail)) {
        return res.status(429).json({
          message: "Too many verification attempts. Please wait 15 minutes.",
        });
      }

      const user = await storage.getUserByEmail(sanitizedEmail);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const blockedState = getBlockedAccountState(user);
      if (blockedState) {
        return res
          .status(blockedState.status)
          .json({ code: blockedState.code, message: blockedState.message });
      }

      if (user.isEmailVerified) {
        return res.json({ message: "Email already verified" });
      }

      if (
        user.emailVerificationToken !== sanitizedCode ||
        !user.emailTokenExpiresAt ||
        new Date() > user.emailTokenExpiresAt
      ) {
        recordOtpAttempt(sanitizedEmail);
        return res.status(400).json({ message: "Invalid or expired code" });
      }

      // Mark verified
      clearOtpAttempts(sanitizedEmail);
      await storage.updateUserVerification(user.id, {
        isEmailVerified: true,
        emailVerificationToken: null,
        emailTokenExpiresAt: null,
      });

      const sessionTokens = await issueSessionTokens(
        { ...user, isEmailVerified: true },
        req as AuthRequest,
      );
      res.json({
        accessToken: sessionTokens.accessToken,
        refreshToken: sessionTokens.refreshToken,
        user: serializeUser({ ...user, isEmailVerified: true }),
      });
    } catch (error) {
      logger.error("Verify email error", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ message: "Verification failed" });
    }
  },
);

// ── Resend verification email ──
router.post(
  "/resend-verification",
  rateLimiter(3, 15 * 60 * 1000),
  async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal whether user exists
        return res.json({
          message: "If an account exists, a new code has been sent.",
        });
      }

      if (user.isEmailVerified) {
        return res.json({ message: "Email already verified" });
      }

      const emailOtp = generateOTP();
      const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await storage.updateUserVerification(user.id, {
        emailVerificationToken: emailOtp,
        emailTokenExpiresAt: otpExpiresAt,
      });

      const emailSent = await sendEmail({
        to: user.email,
        subject: "Verify Your Email - Maternal Mind",
        html: verificationEmailHtml(emailOtp),
      });

      if (!emailSent && process.env.NODE_ENV !== "production") {
        logger.debug("Resend OTP generated", {
          email: user.email,
          otp: emailOtp,
        });
      }

      res.json({ message: "If an account exists, a new code has been sent." });
    } catch (error) {
      logger.error("Resend verification error", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ message: "Failed to resend verification email" });
    }
  },
);

router.post(
  "/login",
  rateLimiter(10, 15 * 60 * 1000, {
    keyPrefix: "auth_login",
    keyGenerator: (req) => {
      const email =
        typeof req.body?.email === "string"
          ? req.body.email.trim().toLowerCase()
          : "unknown";
      return `${getRateLimitClientId(req)}:${email}`;
    },
  }),
  async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);

      // Sanitize email (trim/normalize) before use
      data.email = sanitizeString(data.email);
      logger.info("[AUTH LOGIN ATTEMPT]", { email: data.email });

      const user = await storage.getUserByEmail(data.email);
      if (!user) {
        logger.warn("[AUTH LOGIN FAILED: USER NOT FOUND]", { email: data.email });
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const validPassword = await bcrypt.compare(data.password, user.password);
      if (!validPassword) {
        logger.warn("[AUTH LOGIN FAILED: PASSWORD MISMATCH]", { email: data.email });
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // 1. Check Email Verification
      if (!user.isEmailVerified) {
        return res.status(403).json({
          code: "EMAIL_NOT_VERIFIED",
          message: "Please verify your email address",
          email: user.email,
        });
      }

      const blockedState = getBlockedAccountState(user);
      if (blockedState) {
        return res
          .status(blockedState.status)
          .json({ code: blockedState.code, message: blockedState.message });
      }

      const sessionTokens = await issueSessionTokens(user, req as AuthRequest);

      res.json({
        accessToken: sessionTokens.accessToken,
        refreshToken: sessionTokens.refreshToken,
        user: serializeUser(user),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      logger.error("Login error", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ message: "Login failed" });
    }
  },
);

router.post(
  "/scan-login",
  rateLimiter(10, 15 * 60 * 1000, {
    keyPrefix: "auth_scan_login",
    keyGenerator: (req) => getRateLimitClientId(req),
  }),
  async (req, res) => {
    try {
      const schema = z.object({ code: z.string().min(1) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Access code is required" });
      }

      const code = parseScannedLoginCode(sanitizeString(parsed.data.code));
      const settings = await getScanLoginSettings();
      if (!settings.enabled || !settings.hasCode || !settings.targetEmail) {
        return res.status(400).json({
          code: "SCAN_LOGIN_DISABLED",
          message: "Scan login is not available right now.",
        });
      }

      const validCode = await verifyScanLoginCode(code);
      if (!validCode) {
        return res.status(401).json({ message: "Invalid access code" });
      }

      const user = await storage.getUserByEmail(settings.targetEmail);
      if (!user) {
        logger.warn("Scan login target account not found", {
          targetEmail: settings.targetEmail,
        });
        return res.status(400).json({
          code: "SCAN_LOGIN_NOT_CONFIGURED",
          message: "Scan login is not configured correctly.",
        });
      }

      if (!user.isEmailVerified) {
        return res.status(403).json({
          code: "EMAIL_NOT_VERIFIED",
          message: "Please verify your email address",
          email: user.email,
        });
      }

      const blockedState = getBlockedAccountState(user);
      if (blockedState) {
        return res
          .status(blockedState.status)
          .json({ code: blockedState.code, message: blockedState.message });
      }

      const sessionTokens = await issueSessionTokens(user, req as AuthRequest);

      res.json({
        accessToken: sessionTokens.accessToken,
        refreshToken: sessionTokens.refreshToken,
        user: serializeUser(user),
      });
    } catch (error) {
      logger.error("Scan login error", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ message: "Scan login failed" });
    }
  },
);

router.post(
  "/forgot-password",
  rateLimiter(3, 15 * 60 * 1000),
  async (req, res) => {
    try {
      const data = forgotPasswordSchema.parse(req.body);

      const user = await storage.getUserByEmail(data.email);
      if (!user) {
        // Don't reveal whether user exists
        return res.json({
          message:
            "If an account exists with this email, a reset code has been sent.",
        });
      }

      // Generate a 6-digit OTP instead of a long token link
      const otp = generateOTP();
      await storage.createPasswordResetOtp(user.id, otp);

      // Send OTP email (no links — stays entirely in-app)
      const emailSent = await sendEmail({
        to: user.email,
        subject: "Password Reset Code - Maternal Mind",
        html: passwordResetOtpEmailHtml(user.name, otp),
      });

      if (!emailSent && process.env.NODE_ENV !== "production") {
        logger.debug("Reset OTP generated", { email: user.email, otp });
      }

      res.json({
        message:
          "If an account exists with this email, a reset code has been sent.",
      });
    } catch (error) {
      logger.error("Forgot password error", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ message: "Failed to process request" });
    }
  },
);

// Verify the password reset OTP (optional step — validates OTP before showing new password form)
router.post(
  "/verify-reset-otp",
  rateLimiter(10, 15 * 60 * 1000),
  async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ message: "Email and code are required" });
      }

      // Check OTP attempt lockout before any verification logic
      const normalizedEmail =
        typeof email === "string" ? email.trim().toLowerCase() : email;
      if (checkOtpAttempts(normalizedEmail)) {
        return res.status(429).json({
          message: "Too many verification attempts. Please wait 15 minutes.",
        });
      }

      const resetToken = await storage.getPasswordResetByOtp(email, code);
      if (!resetToken) {
        recordOtpAttempt(normalizedEmail);
        return res.status(400).json({ message: "Invalid or expired code" });
      }
      clearOtpAttempts(normalizedEmail);
      res.json({ valid: true, message: "Code verified" });
    } catch (error) {
      logger.error("Verify reset OTP error", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ message: "Verification failed" });
    }
  },
);

// Password reset via OTP (in-app flow — no external links)
router.post("/reset-password", async (req, res) => {
  try {
    const data = resetPasswordSchema.parse(req.body);

    // Support both legacy token-based and new OTP-based flows
    let resetToken;
    if (data.email && data.code) {
      // New OTP-based flow
      resetToken = await storage.getPasswordResetByOtp(data.email, data.code);
    } else if (data.token) {
      // Legacy token-based flow (backward compat)
      resetToken = await storage.getPasswordResetToken(data.token);
    }

    if (!resetToken) {
      return res.status(400).json({ message: "Invalid or expired reset code" });
    }
    const hashedPassword = await bcrypt.hash(data.password, 12);
    await storage.updateUserPassword(resetToken.userId, hashedPassword);
    await storage.markTokenUsed(resetToken.id);
    res.json({ message: "Password reset successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    logger.error("Reset password error", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ message: "Failed to reset password" });
  }
});

router.post(
  "/change-password",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const { currentPassword, newPassword } = req.body as {
        currentPassword?: string;
        newPassword?: string;
      };

      if (!currentPassword || !newPassword) {
        return res
          .status(400)
          .json({ message: "Current password and new password are required" });
      }

      if (newPassword.length < 8) {
        return res
          .status(400)
          .json({ message: "New password must be at least 8 characters" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password,
      );
      if (!isCurrentPasswordValid) {
        return res
          .status(400)
          .json({ message: "Current password is incorrect" });
      }

      const isSamePassword = await bcrypt.compare(newPassword, user.password);
      if (isSamePassword) {
        return res.status(400).json({
          message: "New password must be different from current password",
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await storage.updateUserPassword(userId, hashedPassword);

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      logger.error("Change password error", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ message: "Failed to change password" });
    }
  },
);

router.post("/logout-all", authMiddleware, async (req: AuthRequest, res) => {
  await revokeUserSessions(req.userId!, "user_logout_all");
  res.json({ success: true, message: "Logged out from all devices" });
});

router.get("/me", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await storage.getUser(req.userId!);
    if (!user) return res.status(404).json({ message: "User not found" });

    const blockedState = getBlockedAccountState(user);
    if (blockedState) {
      return res
        .status(blockedState.status)
        .json({ code: blockedState.code, message: blockedState.message });
    }

    res.json(serializeUser(user));
  } catch {
    res.status(500).json({ message: "Failed to get user" });
  }
});

router.post("/logout", authMiddleware, async (req: AuthRequest, res) => {
  if (req.sessionId) {
    await revokeSession(req.sessionId, "user_logout");
  }
  res.json({ success: true });
});

// Token refresh — exchange a valid refresh token for a new access token
router.post("/refresh", rateLimiter(20, 60 * 1000), async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token is required" });
    }

    const decoded = jwt.verify(refreshToken, getJwtSecret()) as {
      userId: string;
      sessionId?: string;
      type?: string;
    };
    if (decoded.type !== "refresh" || !decoded.sessionId) {
      return res.status(401).json({ message: "Invalid token type" });
    }

    // Verify user still exists
    const user = await storage.getUser(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const blockedState = getBlockedAccountState(user);
    if (blockedState) {
      return res
        .status(blockedState.status)
        .json({ code: blockedState.code, message: blockedState.message });
    }

    const session = await getActiveSession(decoded.sessionId);
    if (
      !session ||
      session.userId !== user.id ||
      session.refreshTokenHash !== hashRefreshToken(refreshToken)
    ) {
      return res.status(401).json({ message: "Invalid or expired session" });
    }

    const newAccessToken = generateToken(user.id, session.id);
    res.json({ accessToken: newAccessToken });
  } catch (error) {
    if (
      error instanceof jwt.JsonWebTokenError ||
      error instanceof jwt.TokenExpiredError
    ) {
      return res
        .status(401)
        .json({ message: "Invalid or expired refresh token" });
    }
    logger.error("Token refresh error", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ message: "Token refresh failed" });
  }
});

export default router;
