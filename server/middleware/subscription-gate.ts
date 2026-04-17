import { Response, NextFunction } from "express";
import { type AuthRequest } from "../middleware";
import { subscriptionService } from "../services/subscription-service";
import { logger } from "../lib/logger";

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

export interface SubscriptionRequest extends AuthRequest {
  subscription?: {
    id: string;
    status: string;
    packageSlug: string;
    features: string[];
    isInGracePeriod: boolean;
  };
}

// ══════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════

/**
 * Resolves the feature keys for a given package.
 * Features with valueType "cross" are explicitly excluded.
 */
async function resolvePackageFeatures(packageId: string): Promise<string[]> {
  const features = await subscriptionService.getFeaturesByPackage(packageId);
  return features
    .filter((f) => f.valueType !== "cross" && f.featureKey != null)
    .map((f) => f.featureKey!) as string[];
}

/**
 * Resolves the package slug for a given package ID.
 */
async function resolvePackageSlug(packageId: string): Promise<string> {
  const pkg = await subscriptionService.getPackage(packageId);
  return pkg?.slug ?? "unknown";
}

/**
 * Populates the subscription info on the request object.
 * Returns `null` if the user has no subscription data at all.
 */
async function populateSubscriptionInfo(
  userId: string,
): Promise<SubscriptionRequest["subscription"] | null> {
  const access = await subscriptionService.checkSubscriptionAccess(userId);

  if (!access.subscription) {
    return null;
  }

  const [packageSlug, features] = await Promise.all([
    resolvePackageSlug(access.subscription.packageId),
    resolvePackageFeatures(access.subscription.packageId),
  ]);

  return {
    id: access.subscription.id,
    status: access.subscription.status,
    packageSlug,
    features,
    isInGracePeriod: access.inGracePeriod ?? false,
  };
}

// ══════════════════════════════════════════════════════════════
// Middleware factories
// ══════════════════════════════════════════════════════════════

/**
 * Middleware that requires an active subscription.
 * Returns 403 if the user doesn't have access.
 *
 * Usage:
 *   router.get("/premium", authMiddleware, requireSubscription(), handler);
 */
export function requireSubscription() {
  return async (
    req: SubscriptionRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const access = await subscriptionService.checkSubscriptionAccess(
        req.userId,
      );

      if (!access.hasAccess) {
        return res.status(403).json({
          message: "An active subscription is required to access this resource",
          code: "SUBSCRIPTION_REQUIRED",
          subscriptionStatus: access.subscription?.status ?? "none",
        });
      }

      // Attach subscription info to the request for downstream handlers
      const [packageSlug, features] = await Promise.all([
        resolvePackageSlug(access.subscription!.packageId),
        resolvePackageFeatures(access.subscription!.packageId),
      ]);

      req.subscription = {
        id: access.subscription!.id,
        status: access.subscription!.status,
        packageSlug,
        features,
        isInGracePeriod: access.inGracePeriod ?? false,
      };

      next();
    } catch (error) {
      logger.error("SubscriptionGate requireSubscription error", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ message: "Failed to verify subscription access" });
    }
  };
}

/**
 * Middleware that checks if the user's package includes a specific feature.
 * Returns 403 if the feature is not included in the user's plan.
 *
 * Usage:
 *   router.get("/advanced-quiz", authMiddleware, requireFeature("advanced_quiz"), handler);
 */
export function requireFeature(featureKey: string) {
  return async (
    req: SubscriptionRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const access = await subscriptionService.checkSubscriptionAccess(
        req.userId,
        featureKey,
      );

      if (!access.hasAccess) {
        // Determine whether the user has no subscription at all or
        // simply lacks this specific feature
        const hasAnySub = access.subscription != null;

        return res.status(403).json({
          message: hasAnySub
            ? `Your current plan does not include the "${featureKey}" feature. Please upgrade to access this.`
            : "An active subscription is required to access this resource",
          code: hasAnySub ? "FEATURE_NOT_INCLUDED" : "SUBSCRIPTION_REQUIRED",
          feature: featureKey,
          subscriptionStatus: access.subscription?.status ?? "none",
        });
      }

      // Attach subscription info to the request for downstream handlers
      const [packageSlug, features] = await Promise.all([
        resolvePackageSlug(access.subscription!.packageId),
        resolvePackageFeatures(access.subscription!.packageId),
      ]);

      req.subscription = {
        id: access.subscription!.id,
        status: access.subscription!.status,
        packageSlug,
        features,
        isInGracePeriod: access.inGracePeriod ?? false,
      };

      next();
    } catch (error) {
      logger.error("SubscriptionGate requireFeature error", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ message: "Failed to verify feature access" });
    }
  };
}

/**
 * Middleware that attaches subscription info to the request but doesn't
 * block access. Useful for mixed free/premium endpoints where behavior
 * varies based on subscription status.
 *
 * Usage:
 *   router.get("/content", authMiddleware, optionalSubscriptionInfo(), handler);
 *   // In handler: if (req.subscription) { ... premium ... } else { ... free ... }
 */
export function optionalSubscriptionInfo() {
  return async (
    req: SubscriptionRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.userId) {
        // No user — skip subscription info, let downstream handle auth
        return next();
      }

      const info = await populateSubscriptionInfo(req.userId);
      if (info) {
        req.subscription = info;
      }

      next();
    } catch (error) {
      // Non-blocking — log and continue without subscription info
      logger.error("SubscriptionGate optionalSubscriptionInfo error", {
        error: error instanceof Error ? error.message : String(error),
      });
      next();
    }
  };
}
