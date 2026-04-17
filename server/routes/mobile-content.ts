import { Router } from "express";
import { getMobileAppContent } from "../lib/mobile-app-content";
import { logger } from "../lib/logger";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const content = await getMobileAppContent();
    res.json(content);
  } catch (error) {
    logger.error("Get mobile app content error", { error: String(error) });
    res.status(500).json({ message: "Failed to load mobile app content" });
  }
});

export default router;
