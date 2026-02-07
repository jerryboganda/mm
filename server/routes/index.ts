import type { Express } from "express";
import { createServer, type Server } from "node:http";
import authRoutes from "./auth";
import userRoutes from "./user";
import contentRoutes from "./content";
import quizRoutes from "./quiz";
import progressRoutes from "./progress";
import attemptsRoutes from "./attempts";
import reviewRoutes from "./review";
import reportRoutes from "./reports";
import adminRoutes from "./admin";
import adminContentRoutes from "./admin-content";
import adminUserRoutes from "./admin-users";
import adminAnalyticsRoutes from "./admin-analytics";
import adminAnnouncementsRoutes from "./admin-announcements";

export async function registerRoutes(app: Express): Promise<Server> {
  app.use("/api/auth", authRoutes);
  app.use("/api/profile", userRoutes);
  app.use("/api", userRoutes);
  app.use("/api", contentRoutes);
  app.use("/api/quiz", quizRoutes);
  app.use("/api/progress", progressRoutes);
  app.use("/api/attempts", attemptsRoutes);
  app.use("/api/reviews", reviewRoutes);
  app.use("/api/content-reports", reportRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/admin/content", adminContentRoutes);
  app.use("/api/admin/users", adminUserRoutes);
  app.use("/api/admin/analytics", adminAnalyticsRoutes);
  app.use("/api/admin/announcements", adminAnnouncementsRoutes);

  const httpServer = createServer(app);
  return httpServer;
}
