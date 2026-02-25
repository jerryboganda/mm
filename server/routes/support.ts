import { Router } from "express";
import { sendEmail, supportIssueEmailHtml } from "../email";
import { AuthRequest, authMiddleware } from "../middleware";
import { getSupportContactSettings } from "../lib/support-contact";

const router = Router();

router.get("/contact", authMiddleware, async (_req: AuthRequest, res) => {
  try {
    const supportContactSettings = await getSupportContactSettings();
    res.json(supportContactSettings);
  } catch (error) {
    console.error("Get support contact settings error:", error);
    res.status(500).json({ message: "Failed to load support contact settings" });
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

    if (process.env.NODE_ENV !== "production") {
      console.log(`[SUPPORT] Issue reported by ${email}: ${type}`);
    }

    const supportContactSettings = await getSupportContactSettings();

    try {
      await sendEmail({
        to: supportContactSettings.supportEmail,
        subject: `[${String(type).toUpperCase()}] New Issue Report`,
        html: supportIssueEmailHtml(type, email, description),
      });
    } catch (emailError) {
      console.error("Failed to send support email:", emailError);
    }

    res.json({ message: "Issue reported successfully" });
  } catch (error) {
    console.error("Report issue error:", error);
    res.status(500).json({ message: "Failed to report issue" });
  }
});

export default router;

