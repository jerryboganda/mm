import type { Express } from "express";
import { createServer, type Server } from "node:http";
import authRoutes from "./auth";
import userRoutes from "./user";
import contentRoutes from "./content";
import quizRoutes from "./quiz";
import progressRoutes from "./progress";
import attemptsRoutes from "./attempts";

export async function registerRoutes(app: Express): Promise<Server> {
  // Mount the routers
  app.use("/api/auth", authRoutes);
  app.use("/api/profile", userRoutes); // /api/profile is mounted here
  app.use("/api", userRoutes); // For /api/recent-activity, /api/bookmarks, /api/support/report-issue.
  // Wait, user routes has /recent-activity etc.
  // If I mount it at /api, then /recent-activity becomes /api/recent-activity. Correct.
  // But /profile is also in user routes. So /api/profile becomes /api/profile.
  // In user.ts: router.patch("/profile", ...) -> /api/profile
  // But I also have router.get("/recent-activity") -> /api/recent-activity
  // If I mount "userRoutes" at "/api", then:
  // /api/profile matches.
  // /api/recent-activity matches.
  // /api/bookmarks matches.
  // /api/support/report-issue matches.
  // This looks correct.

  app.use("/api", contentRoutes); // /api/books, /api/topics etc.
  app.use("/api/quiz", quizRoutes); // /api/quiz/*
  app.use("/api/progress", progressRoutes); // /api/progress/*
  app.use("/api/attempts", attemptsRoutes); // /api/attempts/*

  const httpServer = createServer(app);
  return httpServer;
}
