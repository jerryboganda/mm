import { Router } from "express";
import { storage } from "../storage";
import {
  insertWaitlistSchema,
  insertNewsletterSchema,
  insertContactSchema,
  insertInstitutionalRequestSchema,
} from "../../shared/schema";
import { fromError } from "zod-validation-error";
import { asyncHandler, success, error } from "../lib/api-response";
import { logger } from "../lib/logger";

const router = Router();

router.post(
  "/waitlist",
  asyncHandler(async (req, res) => {
    const parsed = insertWaitlistSchema.safeParse(req.body);
    if (!parsed.success) {
      return error(res, fromError(parsed.error).message, 400);
    }
    const entry = await storage.createWaitlistEntry(parsed.data);
    logger.info("Website waitlist signup", { email: parsed.data.email });
    return success(res, { success: true, id: entry.id }, 201);
  }),
);

router.post(
  "/newsletter",
  asyncHandler(async (req, res) => {
    const parsed = insertNewsletterSchema.safeParse(req.body);
    if (!parsed.success) {
      return error(res, fromError(parsed.error).message, 400);
    }
    const entry = await storage.createNewsletterEntry(parsed.data);
    logger.info("Website newsletter signup", { email: parsed.data.email });
    return success(res, { success: true, id: entry.id }, 201);
  }),
);

router.post(
  "/contact",
  asyncHandler(async (req, res) => {
    const parsed = insertContactSchema.safeParse(req.body);
    if (!parsed.success) {
      return error(res, fromError(parsed.error).message, 400);
    }
    const message = await storage.createContactMessage(parsed.data);
    logger.info("Website contact submission", { email: parsed.data.email, subject: parsed.data.subject });
    return success(res, { success: true, id: message.id }, 201);
  }),
);

router.post(
  "/institutional-request",
  asyncHandler(async (req, res) => {
    const parsed = insertInstitutionalRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return error(res, fromError(parsed.error).message, 400);
    }
    const request = await storage.createInstitutionalRequest(parsed.data);
    logger.info("Website institutional request", { email: parsed.data.email, institution: parsed.data.institution });
    return success(res, { success: true, id: request.id }, 201);
  }),
);

export default router;
