import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    "SESSION_SECRET environment variable must be set. Never use a hardcoded secret in production.",
  );
}

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string };
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

  req.userId = decoded.userId;
  next();
}

// Rate limiting using in-memory store (use Redis in production for multi-instance)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Periodically clean up expired entries to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60_000); // Cleanup every minute

export function rateLimiter(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || "unknown";
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
