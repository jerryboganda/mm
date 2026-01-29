import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Resend } from "resend";
import { storage } from "../storage";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@shared/schema";
import { z } from "zod";
import { AuthRequest, authMiddleware } from "../middleware";

const router = Router();
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;
const JWT_SECRET = process.env.SESSION_SECRET || "maternal-mind-secret-key";
const JWT_EXPIRES_IN = "7d";

function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

router.post("/register", async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);

    const existingUser = await storage.getUserByEmail(data.email);
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = await storage.createUser({
      email: data.email,
      password: hashedPassword,
      name: data.name,
    });

    const accessToken = generateToken(user.id);

    res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionPlan: user.subscriptionPlan,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error("Register error:", error);
    res.status(500).json({ message: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
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

    const accessToken = generateToken(user.id);

    res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionPlan: user.subscriptionPlan,
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

router.post("/forgot-password", async (req, res) => {
  try {
    const data = forgotPasswordSchema.parse(req.body);

    const user = await storage.getUserByEmail(data.email);
    if (!user) {
      // Return success even if user not found to prevent email enumeration
      return res.json({
        message:
          "If an account exists with this email, a reset link has been sent.",
      });
    }

    const token = await storage.createPasswordResetToken(user.id);

    // Get the app domain for the reset link
    const appDomain =
      process.env.REPLIT_DEV_DOMAIN ||
      process.env.REPLIT_DOMAINS?.split(",")[0] ||
      "localhost:5000";
    const resetLink = `https://${appDomain}/reset-password?token=${token}`;

    if (resend) {
      try {
        await resend.emails.send({
          from: "Maternal Mind <noreply@maternalmind.app>",
          to: user.email,
          subject: "Reset Your Password - Maternal Mind",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #11a4d4;">Reset Your Password</h1>
              <p>Hello ${user.name},</p>
              <p>You requested to reset your password for Maternal Mind. Click the button below to set a new password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" style="background: #11a4d4; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Reset Password</a>
              </div>
              <p style="color: #666; font-size: 14px;">This link will expire in 1 hour. If you didn't request this, please ignore this email.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              <p style="color: #999; font-size: 12px;">Maternal Mind - OB-GYN Education Platform</p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error("Email send error:", emailError);
        // Still return success to prevent email enumeration
      }
    } else {
      // Development mode - log the reset link
      console.log(`[DEV] Password reset link for ${user.email}: ${resetLink}`);
    }

    res.json({
      message:
        "If an account exists with this email, a reset link has been sent.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Failed to process request" });
  }
});

router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await storage.getUserByEmail(email);
    if (!user) {
      // Don't reveal if user exists
      return res.json({
        message:
          "If an account exists with this email, a verification link has been sent.",
      });
    }

    // In production, send verification email via Resend
    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);

        await resend.emails.send({
          from: "Maternal Mind <noreply@maternalmind.app>",
          to: [email],
          subject: "Verify your email - Maternal Mind",
          html: `
            <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <h1 style="color: #11a4d4; margin-bottom: 20px;">Verify Your Email</h1>
              <p style="color: #333; font-size: 16px; line-height: 24px;">
                Thank you for signing up for Maternal Mind! Please verify your email to access all features.
              </p>
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                If you didn't create an account, please ignore this email.
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              <p style="color: #999; font-size: 12px;">Maternal Mind - OB-GYN Education Platform</p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error("Email send error:", emailError);
      }
    } else {
      console.log(`[DEV] Verification email would be sent to ${email}`);
    }

    res.json({
      message:
        "If an account exists with this email, a verification link has been sent.",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({ message: "Failed to send verification email" });
  }
});

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
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Failed to reset password" });
  }
});

router.get("/me", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await storage.getUser(req.userId!);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionPlan: user.subscriptionPlan,
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Failed to get user" });
  }
});

router.post("/logout", authMiddleware, async (_req, res) => {
  res.json({ success: true });
});

router.post(
  "/change-password",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

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

      const user = await storage.getUser(req.userId!);
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

      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUserPassword(req.userId!, hashedNewPassword);

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  },
);

router.post("/logout-all", authMiddleware, async (req: AuthRequest, res) => {
  try {
    // In a real implementation, this would invalidate all refresh tokens
    // For now, we just return success since we're using stateless JWTs
    // In production, you'd use a token blacklist or version number
    res.json({ message: "Logged out of all devices" });
  } catch (error) {
    console.error("Logout all error:", error);
    res.status(500).json({ message: "Failed to logout all devices" });
  }
});

export default router;
