/**
 * Admin Settings API Routes
 *
 * All routes are protected by authMiddleware + requireRole("admin").
 * Provides CRUD for app_settings and SMTP test endpoint.
 */
import { Router } from "express";
import { AuthRequest, authMiddleware, requireRole } from "../middleware";
import { storage } from "../storage";
import { testSmtpConnection } from "../email";

const router = Router();

// â”€â”€ GET /api/admin/email-settings â€” Fetch current Brevo SMTP config â”€â”€
router.get(
  "/email-settings",
  authMiddleware,
  requireRole("admin"),
  async (_req: AuthRequest, res) => {
    try {
      const keys = [
        "brevo_smtp_host",
        "brevo_smtp_port",
        "brevo_smtp_user",
        "brevo_smtp_pass",
        "brevo_from_email",
        "brevo_from_name",
      ];

      const settings = await storage.getAppSettings(keys);
      const settingsMap: Record<string, string> = {};
      for (const s of settings) {
        settingsMap[s.key] = s.value;
      }

      res.json({
        smtpHost: settingsMap["brevo_smtp_host"] || "",
        smtpPort: settingsMap["brevo_smtp_port"] || "587",
        smtpUser: settingsMap["brevo_smtp_user"] || "",
        smtpPass: settingsMap["brevo_smtp_pass"] || "",
        fromEmail: settingsMap["brevo_from_email"] || "",
        fromName: settingsMap["brevo_from_name"] || "Maternal Mind",
      });
    } catch (error) {
      console.error("Get email settings error:", error);
      res.status(500).json({ message: "Failed to load email settings" });
    }
  },
);

// â”€â”€ PUT /api/admin/email-settings â€” Save Brevo SMTP config â”€â”€
router.put(
  "/email-settings",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res) => {
    try {
      const { smtpHost, smtpPort, smtpUser, smtpPass, fromEmail, fromName } =
        req.body;

      if (!smtpHost || !smtpUser || !smtpPass || !fromEmail) {
        return res.status(400).json({
          message: "SMTP Host, Login, Password, and From Email are required",
        });
      }

      await storage.setAppSettings([
        { key: "brevo_smtp_host", value: smtpHost },
        { key: "brevo_smtp_port", value: String(smtpPort || "587") },
        { key: "brevo_smtp_user", value: smtpUser },
        { key: "brevo_smtp_pass", value: smtpPass },
        { key: "brevo_from_email", value: fromEmail },
        { key: "brevo_from_name", value: fromName || "Maternal Mind" },
      ]);

      res.json({ message: "Email settings saved successfully" });
    } catch (error) {
      console.error("Save email settings error:", error);
      res.status(500).json({ message: "Failed to save email settings" });
    }
  },
);

// â”€â”€ POST /api/admin/email-test â€” Send a test email â”€â”€
router.post(
  "/email-test",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res) => {
    try {
      const {
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPass,
        fromEmail,
        fromName,
        testRecipient,
      } = req.body;

      if (!smtpHost || !smtpUser || !smtpPass || !fromEmail || !testRecipient) {
        return res.status(400).json({
          message:
            "SMTP Host, Login, Password, From Email, and Test Recipient are required",
        });
      }

      const result = await testSmtpConnection({
        host: smtpHost,
        port: parseInt(smtpPort || "587", 10),
        user: smtpUser,
        pass: smtpPass,
        fromEmail,
        fromName: fromName || "Maternal Mind",
        testRecipient,
      });

      if (result.success) {
        res.json({ message: "Test email sent successfully!" });
      } else {
        res.status(400).json({
          message: `SMTP test failed: ${result.error}`,
        });
      }
    } catch (error: any) {
      console.error("Email test error:", error);
      res.status(500).json({
        message: `Email test failed: ${error.message || "Unknown error"}`,
      });
    }
  },
);

export default router;
