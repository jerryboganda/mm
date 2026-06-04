/**
 * Admin Settings API Routes
 *
 * All routes are protected by authMiddleware + requireRole("admin").
 * Provides CRUD for app_settings and SMTP test endpoint.
 */
import { Router, Response } from "express";
import { AuthRequest, authMiddleware, requireRole } from "../middleware";
import { storage } from "../storage";
import { testSmtpConnection } from "../email";
import {
  getSupportContactSettings,
  SUPPORT_CONTACT_KEYS,
} from "../lib/support-contact";
import { getScanLoginSettings, setScanLoginSettings } from "../lib/scan-login";
import { logger } from "../lib/logger";

const router = Router();

const getSupportContactHandler = async (_req: AuthRequest, res: Response) => {
  try {
    const supportContactSettings = await getSupportContactSettings();
    res.json(supportContactSettings);
  } catch (error) {
    logger.error("Get support contact settings error", {
      error: String(error),
    });
    res
      .status(500)
      .json({ message: "Failed to load support contact settings" });
  }
};

const putSupportContactHandler = async (req: AuthRequest, res: Response) => {
  try {
    const whatsappNumber = String(req.body?.whatsappNumber || "").trim();
    const phoneNumber = String(req.body?.phoneNumber || "").trim();
    const supportEmail = String(req.body?.supportEmail || "").trim();
    const whatsappDefaultMessage = String(
      req.body?.whatsappDefaultMessage || "",
    ).trim();
    const whatsappEnabled = Boolean(req.body?.whatsappEnabled);
    const phoneEnabled = Boolean(req.body?.phoneEnabled);
    const emailEnabled =
      req.body?.emailEnabled === undefined
        ? true
        : Boolean(req.body.emailEnabled);

    if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
      return res.status(400).json({ message: "Invalid support email format" });
    }

    await storage.setAppSettings([
      { key: SUPPORT_CONTACT_KEYS.whatsappNumber, value: whatsappNumber },
      { key: SUPPORT_CONTACT_KEYS.phoneNumber, value: phoneNumber },
      { key: SUPPORT_CONTACT_KEYS.supportEmail, value: supportEmail },
      {
        key: SUPPORT_CONTACT_KEYS.whatsappDefaultMessage,
        value: whatsappDefaultMessage,
      },
      {
        key: SUPPORT_CONTACT_KEYS.whatsappEnabled,
        value: String(whatsappEnabled),
      },
      { key: SUPPORT_CONTACT_KEYS.phoneEnabled, value: String(phoneEnabled) },
      { key: SUPPORT_CONTACT_KEYS.emailEnabled, value: String(emailEnabled) },
    ]);

    const updated = await getSupportContactSettings();
    res.json({
      message: "Support contact settings saved successfully",
      ...updated,
    });
  } catch (error) {
    logger.error("Save support contact settings error", {
      error: String(error),
    });
    res
      .status(500)
      .json({ message: "Failed to save support contact settings" });
  }
};

router.get(
  "/support-contact",
  authMiddleware,
  requireRole("admin"),
  getSupportContactHandler,
);
router.get(
  "/settings/support-contact",
  authMiddleware,
  requireRole("admin"),
  getSupportContactHandler,
);

router.put(
  "/support-contact",
  authMiddleware,
  requireRole("admin"),
  putSupportContactHandler,
);
router.put(
  "/settings/support-contact",
  authMiddleware,
  requireRole("admin"),
  putSupportContactHandler,
);

// â”€â”€ GET /api/admin/email-settings â€” Fetch current Brevo SMTP config â”€â”€
const getScanLoginHandler = async (_req: AuthRequest, res: Response) => {
  try {
    const settings = await getScanLoginSettings();
    const { codeHash: _codeHash, ...publicSettings } = settings;
    res.json(publicSettings);
  } catch (error) {
    logger.error("Get scan login settings error", { error: String(error) });
    res.status(500).json({ message: "Failed to load scan login settings" });
  }
};

const putScanLoginHandler = async (req: AuthRequest, res: Response) => {
  try {
    const targetEmail = String(req.body?.targetEmail || "").trim();
    const code = String(req.body?.code || "").trim();
    const enabled = Boolean(req.body?.enabled);
    const title = String(req.body?.title || "").trim();
    const instructions = String(req.body?.instructions || "").trim();
    const buttonText = String(req.body?.buttonText || "").trim();
    const current = await getScanLoginSettings();

    if (enabled && !targetEmail) {
      return res
        .status(400)
        .json({ message: "Target account email is required when enabled." });
    }
    if (targetEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      return res.status(400).json({ message: "Invalid target email format" });
    }
    if (enabled && !code && !current.hasCode) {
      return res.status(400).json({
        message: "Access code is required before enabling scan login.",
      });
    }

    if (targetEmail) {
      const user = await storage.getUserByEmail(targetEmail);
      if (!user) {
        return res
          .status(400)
          .json({ message: "Target account was not found." });
      }
    }

    const updated = await setScanLoginSettings({
      enabled,
      targetEmail,
      title,
      instructions,
      buttonText,
      code: code || undefined,
    });

    res.json({
      message: "Scan login settings saved successfully",
      ...updated,
    });
  } catch (error) {
    logger.error("Save scan login settings error", { error: String(error) });
    res.status(500).json({ message: "Failed to save scan login settings" });
  }
};

router.get(
  "/scan-login-settings",
  authMiddleware,
  requireRole("admin"),
  getScanLoginHandler,
);
router.get(
  "/settings/scan-login",
  authMiddleware,
  requireRole("admin"),
  getScanLoginHandler,
);
router.put(
  "/scan-login-settings",
  authMiddleware,
  requireRole("admin"),
  putScanLoginHandler,
);
router.put(
  "/settings/scan-login",
  authMiddleware,
  requireRole("admin"),
  putScanLoginHandler,
);

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
      logger.error("Get email settings error", { error: String(error) });
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
      logger.error("Save email settings error", { error: String(error) });
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
    } catch (error: unknown) {
      logger.error("Email test error", { error: String(error) });
      res.status(500).json({
        message: `Email test failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  },
);

export default router;
