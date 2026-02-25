import { Router } from "express";
import { z } from "zod";
import { AuthRequest, authMiddleware, requireRole } from "../middleware";
import {
  getMobileAppContent,
  setMobileAppTextOverrides,
} from "../lib/mobile-app-content";

const router = Router();

router.use(authMiddleware, requireRole("admin"));

router.get("/", async (_req: AuthRequest, res) => {
  try {
    const content = await getMobileAppContent();
    res.json(content);
  } catch (error) {
    console.error("Admin get mobile app content error:", error);
    res.status(500).json({ message: "Failed to load mobile app content" });
  }
});

router.put("/", async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      textOverrides: z.record(z.string()).default({}),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid payload",
        errors: parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
      });
    }

    const keysCount = Object.keys(parsed.data.textOverrides).length;
    if (keysCount > 5000) {
      return res
        .status(400)
        .json({ message: "Too many text overrides (maximum 5000)." });
    }

    const content = await setMobileAppTextOverrides(parsed.data.textOverrides);
    res.json({
      message: "Mobile app content saved successfully",
      ...content,
    });
  } catch (error) {
    console.error("Admin save mobile app content error:", error);
    res.status(500).json({ message: "Failed to save mobile app content" });
  }
});

export default router;

