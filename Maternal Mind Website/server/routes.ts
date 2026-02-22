import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertWaitlistSchema,
  insertNewsletterSchema,
  insertContactSchema,
  insertInstitutionalRequestSchema,
} from "@shared/schema";
import { fromError } from "zod-validation-error";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post("/api/waitlist", async (req, res) => {
    try {
      const parsed = insertWaitlistSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: fromError(parsed.error).message });
      }
      const entry = await storage.createWaitlistEntry(parsed.data);
      res.status(201).json({ success: true, id: entry.id });
    } catch (error) {
      res.status(500).json({ error: "Failed to process request" });
    }
  });

  app.post("/api/contact", async (req, res) => {
    try {
      const parsed = insertContactSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: fromError(parsed.error).message });
      }
      const message = await storage.createContactMessage(parsed.data);
      res.status(201).json({ success: true, id: message.id });
    } catch (error) {
      res.status(500).json({ error: "Failed to process request" });
    }
  });

  app.post("/api/newsletter", async (req, res) => {
    try {
      const parsed = insertNewsletterSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: fromError(parsed.error).message });
      }
      const entry = await storage.createNewsletterEntry(parsed.data);
      res.status(201).json({ success: true, id: entry.id });
    } catch (error) {
      res.status(500).json({ error: "Failed to process request" });
    }
  });

  app.post("/api/institutional-request", async (req, res) => {
    try {
      const parsed = insertInstitutionalRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: fromError(parsed.error).message });
      }
      const request = await storage.createInstitutionalRequest(parsed.data);
      res.status(201).json({ success: true, id: request.id });
    } catch (error) {
      res.status(500).json({ error: "Failed to process request" });
    }
  });

  return httpServer;
}
