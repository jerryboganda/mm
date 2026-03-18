import express from "express";
import type { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { pool } from "./db";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const app = express();
const log = console.log;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function setupCors(app: express.Application) {
  const ALLOWED_ORIGINS = [
    process.env.ALLOWED_ORIGIN || "https://maternalmind.com.pk",
    "https://maternalmind.com.pk",
    "http://localhost:8081", // Expo dev
    "http://localhost:19006", // Expo web
  ];

  app.use((req, res, next) => {
    const origin = req.header("origin");

    // For mobile apps without origin header, allow the request
    // For web requests, validate origin against allowlist
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
    } else if (!origin) {
      // Mobile apps typically don't send Origin header - allow these
      res.header("Access-Control-Allow-Origin", "*");
    }

    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    );
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });
}

function setupSecurityHeaders(app: express.Application) {
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
    res.removeHeader("X-Powered-By");
    next();
  });
}

function setupRequestId(app: express.Application) {
  app.use((req, _res, next) => {
    (req as any).id = crypto.randomUUID();
    next();
  });
}

function setupHealthCheck(app: express.Application) {
  app.get("/health", async (_req, res) => {
    try {
      // Check DB connectivity
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || "1.0.0",
      });
    } catch {
      res.status(503).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: "Database connection failed",
      });
    }
  });

  app.get("/ready", async (_req, res) => {
    res.json({ status: "ready" });
  });
}

function setupBodyParsing(app: express.Application) {
  app.use(
    express.json({
      limit: "5mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false, limit: "5mb" }));
}

function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    const requestId = (req as any).id;

    res.on("finish", () => {
      if (!path.startsWith("/api")) return;

      const duration = Date.now() - start;

      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (requestId) {
        logLine += ` [reqId=${requestId}]`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    });

    next();
  });
}

function getAppName(): string {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveExpoManifest(platform: string, res: Response) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json",
  );

  if (!fs.existsSync(manifestPath)) {
    return res
      .status(404)
      .json({ error: `Manifest not found for platform: ${platform}` });
  }

  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");

  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}

function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName,
}: {
  req: Request;
  res: Response;
  landingPageTemplate: string;
  appName: string;
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

function configureExpoAndLanding(app: express.Application) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html",
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  const webDistPath = path.resolve(process.cwd(), "web_dist");

  log("Serving static Expo files with dynamic manifest routing");

  // ── Serve Admin Panel SPA at /admin/* ──
  const adminDistPath = path.resolve(process.cwd(), "admin_dist");
  if (fs.existsSync(adminDistPath)) {
    app.use("/admin", express.static(adminDistPath));
    // SPA fallback: any /admin/* route serves index.html
    app.get("/admin/{*splat}", (_req: Request, res: Response) => {
      const indexPath = path.join(adminDistPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Admin panel not built");
      }
    });
    log("Admin panel: serving from /admin/");
  } else {
    log("Admin panel: admin_dist not found — skipping");
  }

  if (fs.existsSync(webDistPath)) {
    app.use("/app", express.static(webDistPath));
    app.get("/app", (_req: Request, res: Response) => {
      res.sendFile(path.join(webDistPath, "index.html"));
    });
    app.get("/app/{*splat}", (_req: Request, res: Response) => {
      res.sendFile(path.join(webDistPath, "index.html"));
    });
    log("Mobile web app: serving from /app/");
  } else {
    log("Mobile web app: web_dist not found — skipping");
  }

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }

    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }

    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName,
      });
    }

    next();
  });

  app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app.use(express.static(path.resolve(process.cwd(), "static-build")));

  log("Expo routing: Checking expo-platform header on / and /manifest");
}

function setupErrorHandler(app: express.Application) {
  // 404 catch-all for unmatched API routes (Express 5 named wildcard syntax)
  app.use("/api/{*path}", (_req: Request, res: Response) => {
    res.status(404).json({ message: "Endpoint not found" });
  });

  // Global error handler
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
    };

    const status = error.status || error.statusCode || 500;
    const message =
      status >= 500 && process.env.NODE_ENV === "production"
        ? "Internal Server Error"
        : error.message || "Internal Server Error";

    if (status >= 500) {
      console.error("Internal Server Error:", err);
    }

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });
}

(async () => {
  setupSecurityHeaders(app);
  setupRequestId(app);
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  setupHealthCheck(app);

  configureExpoAndLanding(app);

  const server = await registerRoutes(app);

  setupErrorHandler(app);

  const port = parseInt(process.env.PORT || "5000", 10);
  const listenOptions: Parameters<typeof server.listen>[0] = {
    port,
    host: "0.0.0.0",
  };

  // `reusePort` is not supported on some Windows/socket setups used for local dev.
  if (process.platform !== "win32") {
    (listenOptions as any).reusePort = true;
  }

  server.listen(listenOptions, () => {
    log(`express server serving on port ${port}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    log(`\n${signal} received — shutting down gracefully...`);
    server.close(() => {
      log("HTTP server closed");
      pool
        .end()
        .then(() => {
          log("DB pool drained");
          process.exit(0);
        })
        .catch((err) => {
          console.error("Error draining DB pool:", err);
          process.exit(1);
        });
    });

    // Force exit after 10s
    setTimeout(() => {
      console.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
})();
