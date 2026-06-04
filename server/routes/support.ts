import { Router } from "express";
import { sendEmail, supportIssueEmailHtml } from "../email";
import { AuthRequest, authMiddleware } from "../middleware";
import { getSupportContactSettings } from "../lib/support-contact";
import { sanitizeString } from "../lib/api-response";
import { logger } from "../lib/logger";

const router = Router();

router.get("/contact", authMiddleware, async (_req: AuthRequest, res) => {
  try {
    const supportContactSettings = await getSupportContactSettings();
    res.json(supportContactSettings);
  } catch (error) {
    logger.error("Get support contact settings error", {
      error: error instanceof Error ? error.message : String(error),
    });
    res
      .status(500)
      .json({ message: "Failed to load support contact settings" });
  }
});

router.get("/public-contact", async (_req, res) => {
  try {
    const supportContactSettings = await getSupportContactSettings();
    res.json(supportContactSettings);
  } catch (error) {
    logger.error("Get public support contact settings error", {
      error: error instanceof Error ? error.message : String(error),
    });
    res
      .status(500)
      .json({ message: "Failed to load support contact settings" });
  }
});

router.post("/report-issue", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { type, description, email } = req.body;

    if (!type || !description) {
      return res
        .status(400)
        .json({ message: "Issue type and description are required" });
    }

    // Sanitize user-supplied strings before use
    const sanitizedType = sanitizeString(type);
    const sanitizedDescription = sanitizeString(description);
    const sanitizedEmail = email ? sanitizeString(email) : email;

    if (process.env.NODE_ENV !== "production") {
      logger.debug("Support issue reported", {
        email: sanitizedEmail,
        type: sanitizedType,
      });
    }

    const supportContactSettings = await getSupportContactSettings();

    try {
      await sendEmail({
        to: supportContactSettings.supportEmail,
        subject: `[${String(sanitizedType).toUpperCase()}] New Issue Report`,
        html: supportIssueEmailHtml(
          sanitizedType,
          sanitizedEmail,
          sanitizedDescription,
        ),
      });
    } catch (emailError) {
      logger.error("Failed to send support email", {
        error:
          emailError instanceof Error ? emailError.message : String(emailError),
      });
    }

    res.json({ message: "Issue reported successfully" });
  } catch (error) {
    logger.error("Report issue error", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ message: "Failed to report issue" });
  }
});

export default router;
