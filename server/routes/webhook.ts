import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { subscriptionService } from "../services/subscription-service";
import {
  sendSubscriptionWelcomeEmail,
  sendPaymentFailedEmail,
  sendSubscriptionCanceledEmail,
} from "../services/subscription-emails";
import { logger } from "../lib/logger";

const router = Router();

/**
 * RevenueCat Webhook Endpoint
 *
 * RevenueCat sends POST requests to this endpoint when subscription events occur
 * (new purchase, renewal, cancellation, expiration, etc.).
 *
 * Configure this URL in RevenueCat Dashboard:
 *   https://your-server.com/api/webhooks/revenuecat
 *
 * Optional: Set REVENUECAT_WEBHOOK_SECRET in your .env and docker-compose.yml
 * to verify the webhook authenticity via the Authorization header.
 */

const WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET || "";

// RevenueCat event types
type RCEventType =
  | "INITIAL_PURCHASE"
  | "RENEWAL"
  | "PRODUCT_CHANGE"
  | "CANCELLATION"
  | "UNCANCELLATION"
  | "BILLING_ISSUE"
  | "SUBSCRIBER_ALIAS"
  | "SUBSCRIPTION_PAUSED"
  | "TRANSFER"
  | "EXPIRATION"
  | "SUBSCRIPTION_EXTENDED"
  | "NON_RENEWING_PURCHASE"
  | "TEST";

interface RCWebhookEvent {
  api_version: string;
  event: {
    type: RCEventType;
    app_user_id: string;
    aliases?: string[];
    product_id: string;
    entitlement_ids?: string[];
    period_type: string;
    purchased_at_ms: number;
    expiration_at_ms: number | null;
    environment: string;
    store: string;
    is_trial_conversion?: boolean;
    cancel_reason?: string;
    original_app_user_id: string;
  };
}

// Map RevenueCat event types to audit log actions
function rcEventToAuditAction(eventType: RCEventType): string {
  switch (eventType) {
    case "INITIAL_PURCHASE":
      return "activated";
    case "RENEWAL":
      return "renewed";
    case "CANCELLATION":
      return "canceled";
    case "UNCANCELLATION":
      return "reactivated";
    case "BILLING_ISSUE":
      return "payment_failed";
    case "SUBSCRIPTION_PAUSED":
      return "paused";
    case "EXPIRATION":
      return "expired";
    case "SUBSCRIPTION_EXTENDED":
      return "renewed";
    case "NON_RENEWING_PURCHASE":
      return "activated";
    case "PRODUCT_CHANGE":
      return "upgraded";
    default:
      return "webhook_event";
  }
}

router.post("/revenuecat", async (req: Request, res: Response) => {
  try {
    // Optional: Verify webhook secret
    if (WEBHOOK_SECRET) {
      const authHeader = req.headers.authorization;
      if (authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
        logger.warn("RC Webhook invalid auth header");
        return res.status(401).json({ message: "Unauthorized" });
      }
    }

    const payload = req.body as RCWebhookEvent;
    const event = payload?.event;

    if (!event) {
      return res.status(400).json({ message: "Invalid webhook payload" });
    }

    logger.info("RC Webhook event", {
      type: event.type,
      userId: event.app_user_id,
      productId: event.product_id,
      environment: event.environment,
    });

    // Resolve the user ID — RevenueCat app_user_id should match our server user ID
    const userId = event.app_user_id;

    // Determine subscription status based on event type
    let subscriptionStatus: string | null = null;

    switch (event.type) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
      case "UNCANCELLATION":
      case "SUBSCRIPTION_EXTENDED":
      case "NON_RENEWING_PURCHASE":
        subscriptionStatus = "active";
        break;

      case "CANCELLATION":
        // Subscription is cancelled but may still be active until expiration
        subscriptionStatus = "canceled";
        break;

      case "EXPIRATION":
        subscriptionStatus = "expired";
        break;

      case "BILLING_ISSUE":
        subscriptionStatus = "past_due";
        break;

      case "SUBSCRIPTION_PAUSED":
        subscriptionStatus = "paused";
        break;

      case "TEST":
        // Just acknowledge test events
        logger.info("RC Webhook test event received");
        return res.json({ received: true });

      default:
        // Events like PRODUCT_CHANGE, TRANSFER, SUBSCRIBER_ALIAS
        logger.info("RC Webhook unhandled event type", { type: event.type });
        return res.json({ received: true });
    }

    if (subscriptionStatus && userId) {
      // Check if user exists first
      const user = await storage.getUser(userId);
      if (user) {
        const previousStatus = user.subscriptionStatus;

        // Update legacy user subscription fields
        const data: {
          subscriptionStatus: string;
          subscriptionPlan?: string;
          subscriptionExpiresAt?: Date | null;
        } = {
          subscriptionStatus,
          subscriptionPlan: event.product_id,
        };

        if (event.expiration_at_ms) {
          data.subscriptionExpiresAt = new Date(event.expiration_at_ms);
        }

        await storage.updateSubscription(userId, data);

        // Log to subscription audit trail
        try {
          await subscriptionService.logSubscriptionEvent({
            userId,
            action: rcEventToAuditAction(event.type),
            previousStatus,
            newStatus: subscriptionStatus,
            source: "webhook",
            details: {
              eventType: event.type,
              productId: event.product_id,
              environment: event.environment,
              store: event.store,
              periodType: event.period_type,
              expirationAtMs: event.expiration_at_ms,
              cancelReason: event.cancel_reason,
              isTrialConversion: event.is_trial_conversion,
            },
          });
        } catch (auditErr) {
          logger.error("RC Webhook failed to log audit event", {
            error: String(auditErr),
          });
        }

        // Send email notifications for key events
        try {
          if (
            event.type === "INITIAL_PURCHASE" &&
            previousStatus !== "active"
          ) {
            await sendSubscriptionWelcomeEmail(
              user.email,
              user.name,
              event.product_id,
            );
          } else if (event.type === "BILLING_ISSUE") {
            const retryDate = new Date();
            retryDate.setDate(retryDate.getDate() + 1);
            await sendPaymentFailedEmail(
              user.email,
              user.name,
              event.product_id,
              retryDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              }),
            );
          } else if (event.type === "CANCELLATION") {
            const accessUntil = event.expiration_at_ms
              ? new Date(event.expiration_at_ms).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })
              : undefined;
            await sendSubscriptionCanceledEmail(
              user.email,
              user.name,
              event.product_id,
              accessUntil,
            );
          }
        } catch (emailErr) {
          logger.error("RC Webhook failed to send email", {
            error: String(emailErr),
          });
        }

        logger.info("RC Webhook updated user subscription", {
          userId,
          status: subscriptionStatus,
          productId: event.product_id,
        });
      } else {
        // Try matching by aliases if direct user ID doesn't work
        logger.warn("RC Webhook user not found", { userId });
      }
    }

    // Always respond 200 to acknowledge receipt
    res.json({ received: true });
  } catch (error) {
    logger.error("RC Webhook error processing event", { error: String(error) });
    // Still respond 200 to prevent retries for permanent errors
    res.json({ received: true, error: "Internal processing error" });
  }
});

export default router;
