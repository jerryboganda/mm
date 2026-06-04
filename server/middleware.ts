import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getActiveSession, touchSession } from "./lib/device-sessions";

const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    "SESSION_SECRET environment variable must be set. Never use a hardcoded secret in production.",
  );
}

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  sessionId?: string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimiterOptions {
  keyPrefix?: string;
  keyGenerator?: (req: Request) => string;
}

function verifyToken(
  token: string,
): { userId: string; sessionId: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId?: string;
      sessionId?: string;
      type?: string;
    };
    if (!decoded.userId || !decoded.sessionId || decoded.type) return null;
    return { userId: decoded.userId, sessionId: decoded.sessionId };
  } catch {
    return null;
  }
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ message: "Invalid token" });
  }

  const session = await getActiveSession(decoded.sessionId);
  if (!session || session.userId !== decoded.userId) {
    return res.status(401).json({ message: "Session expired" });
  }

  req.userId = decoded.userId;
  req.sessionId = decoded.sessionId;
  void touchSession(decoded.sessionId);
  next();
}

// Rate limiting using in-memory store (use Redis in production for multi-instance)
const rateLimitStore = new Map<string, RateLimitEntry>();
let rateLimiterSequence = 0;

function getHeaderValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (Array.isArray(value) && value[0]?.trim()) {
    return value[0].trim();
  }
  return null;
}

export function getRateLimitClientId(req: Request): string {
  // Prefer forwarded headers when present (common behind reverse proxies/load balancers).
  const forwardedFor = getHeaderValue(req.headers["x-forwarded-for"]);
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = getHeaderValue(req.headers["x-real-ip"]);
  if (realIp) {
    return realIp;
  }

  return req.ip || req.socket.remoteAddress || "unknown";
}

// Periodically clean up expired entries to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60_000); // Cleanup every minute

export function rateLimiter(
  maxRequests: number,
  windowMs: number,
  options: RateLimiterOptions = {},
) {
  const limiterId = options.keyPrefix || `limiter_${++rateLimiterSequence}`;
  const keyGenerator = options.keyGenerator || getRateLimitClientId;

  return (req: Request, res: Response, next: NextFunction) => {
    const identifier = keyGenerator(req)?.trim() || "unknown";
    const key = `${limiterId}:${identifier}`;
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetTime) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (entry.count >= maxRequests) {
      res.setHeader("Retry-After", Math.ceil((entry.resetTime - now) / 1000));
      return res.status(429).json({
        message: "Too many requests. Please try again later.",
      });
    }

    entry.count++;
    next();
  };
}

// RBAC middleware
export function requireRole(...roles: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Import dynamically to avoid circular dependency
    const { storage } = await import("./storage");
    const user = await storage.getUser(req.userId);

    if (!user || !roles.includes(user.role)) {
      return res
        .status(403)
        .json({ message: "Forbidden: insufficient permissions" });
    }

    req.userRole = user.role;
    next();
  };
}
