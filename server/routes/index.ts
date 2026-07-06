import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { rateLimiter } from "../middleware";
import authRoutes from "./auth";
import userRoutes from "./user";
import contentRoutes from "./content";
import quizRoutes from "./quiz";
import progressRoutes from "./progress";
import attemptsRoutes from "./attempts";
import reviewRoutes from "./review";
import reportRoutes from "./reports";
import supportRoutes from "./support";
import mobileContentRoutes from "./mobile-content";
import adminRoutes from "./admin";
import adminMobileContentRoutes from "./admin-mobile-content";
import adminContentRoutes from "./admin-content";
import adminUserRoutes from "./admin-users";
import adminAnalyticsRoutes from "./admin-analytics";
import adminAnnouncementsRoutes from "./admin-announcements";
import adminSubscriptionRoutes from "./admin-subscriptions";
import adminManualPaymentRoutes from "./admin-manual-payments";
import adminDeviceLimitRoutes from "./admin-device-limits";
import subscriptionRoutes from "./subscription";
import updatesRoutes from "./updates";

// General API rate limits (per IP)
const generalLimiter = rateLimiter(120, 60_000); // 120 requests/min for content browsing
const quizLimiter = rateLimiter(30, 60_000); // 30 requests/min for quiz operations
const adminLimiter = rateLimiter(600, 60_000); // 600 requests/min for admin operations (bulk saves need headroom)

export async function registerRoutes(app: Express): Promise<Server> {
  // Self-hosted Expo OTA updates. Mounted outside /api (no `no-store` header,
  // no /api 404 handler) and intentionally un-rate-limited: one OTA download
  // bursts through a JS bundle + many content-addressed assets.
  app.use("/updates", updatesRoutes);

  app.use("/api/auth", authRoutes);
  app.use("/api/mobile-content", generalLimiter, mobileContentRoutes);
  app.use("/api/profile", generalLimiter, userRoutes);
  app.use("/api/user", generalLimiter, userRoutes);
  app.use("/api", generalLimiter, contentRoutes);
  app.use("/api/quiz", quizLimiter, quizRoutes);
  app.use("/api/progress", generalLimiter, progressRoutes);
  app.use("/api/attempts", generalLimiter, attemptsRoutes);
  app.use("/api/reviews", quizLimiter, reviewRoutes);
  app.use("/api/support", generalLimiter, supportRoutes);
  app.use("/api/content-reports", quizLimiter, reportRoutes);
  app.use("/api/subscriptions", generalLimiter, subscriptionRoutes);
  app.use("/api/admin", adminLimiter, adminRoutes);
  app.use(
    "/api/admin/mobile-app-content",
    adminLimiter,
    adminMobileContentRoutes,
  );
  app.use("/api/admin/content", adminLimiter, adminContentRoutes);
  app.use("/api/admin/users", adminLimiter, adminUserRoutes);
  app.use("/api/admin/analytics", adminLimiter, adminAnalyticsRoutes);
  app.use("/api/admin/announcements", adminLimiter, adminAnnouncementsRoutes);
  app.use("/api/admin/subscriptions", adminLimiter, adminSubscriptionRoutes);
  app.use("/api/admin/manual-payments", adminLimiter, adminManualPaymentRoutes);
  app.use("/api/admin/device-limits", adminLimiter, adminDeviceLimitRoutes);

  const httpServer = createServer(app);
  return httpServer;
}
