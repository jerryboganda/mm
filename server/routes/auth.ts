import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import twilio from "twilio";
import { storage } from "../storage";
import {
  sendEmail,
  verificationEmailHtml,
  passwordResetEmailHtml,
} from "../email";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@shared/schema";
import { z } from "zod";
import { AuthRequest, authMiddleware, rateLimiter } from "../middleware";

const router = Router();

const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    "SESSION_SECRET environment variable must be set. Never use a hardcoded secret in production.",
  );
}
const JWT_EXPIRES_IN = "7d";
const REFRESH_EXPIRES_IN = "30d";

function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: "refresh" }, JWT_SECRET, {
    expiresIn: REFRESH_EXPIRES_IN,
  });
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

router.post("/register", rateLimiter(5, 15 * 60 * 1000), async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);

    const existingUser = await storage.getUserByEmail(data.email);
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
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
      console.log(`[DEV] Email OTP for ${user.email}: ${emailOtp}`);
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
    console.error("Register error:", error);
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

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.isEmailVerified) {
        return res.json({ message: "Email already verified" });
      }

      if (
        user.emailVerificationToken !== code ||
        !user.emailTokenExpiresAt ||
        new Date() > user.emailTokenExpiresAt
      ) {
        return res.status(400).json({ message: "Invalid or expired code" });
      }

      // Mark verified
      await storage.updateUserVerification(user.id, {
        isEmailVerified: true,
        emailVerificationToken: null,
        emailTokenExpiresAt: null,
      });

      const accessToken = generateToken(user.id);
      // SECURITY: Never include password hash or verification tokens in response
      res.json({
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          subscriptionStatus: user.subscriptionStatus,
          subscriptionPlan: user.subscriptionPlan,
          isEmailVerified: true,
          isPhoneVerified: user.isPhoneVerified,
          createdAt: user.createdAt,
        },
      });
    } catch (error) {
      console.error("Verify email error:", error);
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
        console.log(`[DEV] Resend OTP for ${user.email}: ${emailOtp}`);
      }

      res.json({ message: "If an account exists, a new code has been sent." });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ message: "Failed to resend verification email" });
    }
  },
);

router.post("/login", rateLimiter(10, 15 * 60 * 1000), async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await storage.getUserByEmail(data.email);
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const validPassword = await bcrypt.compare(data.password, user.password);
    if (!validPassword) {
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

    const accessToken = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // SECURITY: Never include password hash in response
    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionPlan: user.subscriptionPlan,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
});

router.post(
  "/send-phone-otp",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { phoneNumber } = req.body;
      const userId = req.userId!;

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const phoneToUse = phoneNumber || user.phoneNumber;

      if (!phoneToUse) {
        return res.status(400).json({ message: "Phone number is required" });
      }

      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

      // Save OTP to DB
      await storage.updateUserPhoneOtp(userId, {
        phoneNumber: phoneToUse,
        phoneVerificationToken: otp,
        phoneTokenExpiresAt: expiresAt,
      });

      // Send SMS via Twilio
      if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
        await twilioClient.messages.create({
          body: `Your Maternal Mind verification code is: ${otp}`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phoneToUse,
        });
      } else if (process.env.NODE_ENV !== "production") {
        console.log(`[DEV] SMS OTP for ${phoneToUse}: ${otp}`);
      }

      res.json({ message: "OTP sent successfully" });
    } catch (error) {
      console.error("Send Phone OTP error:", error);
      res.status(500).json({ message: "Failed to send OTP" });
    }
  },
);

router.post(
  "/verify-phone-otp",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { code } = req.body;
      const userId = req.userId!;

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      if (
        user.phoneVerificationToken !== code ||
        !user.phoneTokenExpiresAt ||
        new Date() > user.phoneTokenExpiresAt
      ) {
        return res.status(400).json({ message: "Invalid or expired code" });
      }

      // Mark phone verified
      await storage.updateUserVerification(userId, {
        isPhoneVerified: true,
        phoneVerificationToken: null,
        phoneTokenExpiresAt: null,
      });

      res.json({ message: "Phone verified successfully" });
    } catch (error) {
      console.error("Verify Phone OTP error:", error);
      res.status(500).json({ message: "Verification failed" });
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
        return res.json({
          message:
            "If an account exists with this email, a reset link has been sent.",
        });
      }

      const token = await storage.createPasswordResetToken(user.id);
      const resetLink = `https://${req.get("host")}/reset-password?token=${token}`;

      // Send password reset email via Brevo SMTP
      const emailSent = await sendEmail({
        to: user.email,
        subject: "Reset Your Password - Maternal Mind",
        html: passwordResetEmailHtml(user.name, resetLink),
      });

      if (!emailSent && process.env.NODE_ENV !== "production") {
        console.log(`[DEV] Reset link for ${user.email}: ${resetLink}`);
      }

      res.json({
        message:
          "If an account exists with this email, a reset link has been sent.",
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to process request" });
    }
  },
);

// Password reset
router.post("/reset-password", async (req, res) => {
  try {
    const data = resetPasswordSchema.parse(req.body);
    const resetToken = await storage.getPasswordResetToken(data.token);
    if (!resetToken) {
      return res.status(400).json({ message: "Invalid or expired reset link" });
    }
    const hashedPassword = await bcrypt.hash(data.password, 10);
    await storage.updateUserPassword(resetToken.userId, hashedPassword);
    await storage.markTokenUsed(resetToken.id);
    res.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Failed to reset password" });
  }
});

router.get("/me", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await storage.getUser(req.userId!);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      subscriptionStatus: user.subscriptionStatus,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to get user" });
  }
});

router.post("/logout", authMiddleware, async (_req, res) => {
  res.json({ success: true });
});

// Token refresh — exchange a valid refresh token for a new access token
router.post("/refresh", rateLimiter(20, 60 * 1000), async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token is required" });
    }

    const decoded = jwt.verify(refreshToken, JWT_SECRET) as {
      userId: string;
      type?: string;
    };
    if (decoded.type !== "refresh") {
      return res.status(401).json({ message: "Invalid token type" });
    }

    // Verify user still exists
    const user = await storage.getUser(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const newAccessToken = generateToken(user.id);
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
    console.error("Token refresh error:", error);
    res.status(500).json({ message: "Token refresh failed" });
  }
});

export default router;
