import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, isMysql } from "../db";
import { paymentTransactions } from "../../shared/schema";
import { logger } from "../lib/logger";

// ══════════════════════════════════════════════════════════════════
// ══  TYPES                                                      ══
// ══════════════════════════════════════════════════════════════════

export type PaymentResult = {
  success: boolean;
  transactionId?: string;
  gatewayResponse?: any;
  error?: string;
  errorCode?: string;
};

export type RefundResult = {
  success: boolean;
  refundId?: string;
  error?: string;
};

export type StandardizedWebhookEvent = {
  type:
    | "payment_succeeded"
    | "payment_failed"
    | "subscription_canceled"
    | "subscription_renewed"
    | "trial_ended"
    | "refund"
    | "dispute"
    | "unknown";
  userId: string;
  subscriptionExternalId?: string;
  productId?: string;
  amount?: number;
  currency?: string;
  expiresAt?: Date;
  rawEvent: any;
};

// ══════════════════════════════════════════════════════════════════
// ══  ADAPTER INTERFACE                                          ══
// ══════════════════════════════════════════════════════════════════

export interface PaymentGatewayAdapter {
  /** Unique gateway identifier (e.g. "revenuecat", "stripe", "manual") */
  name: string;

  /** Process a payment through this gateway */
  processPayment(params: {
    amount: number;
    currency: string;
    userId: string;
    metadata?: Record<string, any>;
  }): Promise<PaymentResult>;

  /** Refund a payment (full or partial) */
  refundPayment(params: {
    transactionId: string;
    amount?: number;
    reason?: string;
  }): Promise<RefundResult>;

  /** Verify that a webhook payload is authentic */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean;

  /** Parse a gateway-specific webhook event into a standardized format */
  parseWebhookEvent(payload: any): StandardizedWebhookEvent;

  /** Check whether the gateway has the required env vars configured */
  isConfigured(): boolean;
}

// ══════════════════════════════════════════════════════════════════
// ══  REVENUECAT ADAPTER                                         ══
// ══════════════════════════════════════════════════════════════════

/**
 * RevenueCat handles payments entirely on the client (App Store / Google Play).
 * The server's role is limited to receiving webhook events and recording them.
 */
class RevenueCatAdapter implements PaymentGatewayAdapter {
  readonly name = "revenuecat";

  /**
   * RevenueCat purchases are initiated client-side through the mobile SDK.
   * Server-side "processing" is a no-op; we simply acknowledge that the
   * purchase will be confirmed via webhook.
   */
  async processPayment(params: {
    amount: number;
    currency: string;
    userId: string;
    metadata?: Record<string, any>;
  }): Promise<PaymentResult> {
    return {
      success: true,
      gatewayResponse: {
        message:
          "RevenueCat purchases are handled client-side via the mobile SDK",
        userId: params.userId,
      },
    };
  }

  /**
   * RevenueCat does not support server-initiated refunds.
   * Refunds must be processed through Apple/Google directly.
   */
  async refundPayment(_params: {
    transactionId: string;
    amount?: number;
    reason?: string;
  }): Promise<RefundResult> {
    return {
      success: false,
      error:
        "RevenueCat does not support server-initiated refunds. " +
        "Process refunds through the App Store or Google Play console.",
    };
  }

  /**
   * RevenueCat webhooks use a Bearer token in the Authorization header.
   * The `signature` parameter should be the full Authorization header value
   * (e.g. "Bearer abc123") and `secret` is the expected token.
   */
  verifyWebhookSignature(
    _payload: string,
    signature: string,
    secret: string,
  ): boolean {
    if (!secret) return false;
    return signature === `Bearer ${secret}`;
  }

  /**
   * Map RevenueCat event types to standardized webhook events.
   *
   * RevenueCat event types:
   *   INITIAL_PURCHASE, RENEWAL, PRODUCT_CHANGE, CANCELLATION,
   *   UNCANCELLATION, BILLING_ISSUE, SUBSCRIBER_ALIAS,
   *   SUBSCRIPTION_PAUSED, TRANSFER, EXPIRATION,
   *   SUBSCRIPTION_EXTENDED, NON_RENEWING_PURCHASE, TEST
   */
  parseWebhookEvent(payload: any): StandardizedWebhookEvent {
    const event = payload?.event;
    if (!event) {
      return {
        type: "unknown",
        userId: "",
        rawEvent: payload,
      };
    }

    const userId: string =
      event.app_user_id || event.original_app_user_id || "";
    const productId: string = event.product_id || undefined;
    const expiresAt = event.expiration_at_ms
      ? new Date(event.expiration_at_ms)
      : undefined;
    const subscriptionExternalId: string | undefined =
      event.original_transaction_id || event.transaction_id || undefined;

    let type: StandardizedWebhookEvent["type"];

    switch (event.type as string) {
      case "INITIAL_PURCHASE":
      case "NON_RENEWING_PURCHASE":
        type = "payment_succeeded";
        break;

      case "RENEWAL":
      case "SUBSCRIPTION_EXTENDED":
      case "UNCANCELLATION":
        type = "subscription_renewed";
        break;

      case "CANCELLATION":
        type = "subscription_canceled";
        break;

      case "EXPIRATION":
        type = "trial_ended";
        break;

      case "BILLING_ISSUE":
        type = "payment_failed";
        break;

      case "TRANSFER":
      case "PRODUCT_CHANGE":
      case "SUBSCRIBER_ALIAS":
      case "SUBSCRIPTION_PAUSED":
      case "TEST":
      default:
        type = "unknown";
        break;
    }

    return {
      type,
      userId,
      subscriptionExternalId,
      productId,
      expiresAt,
      rawEvent: payload,
    };
  }

  isConfigured(): boolean {
    return !!process.env.REVENUECAT_WEBHOOK_SECRET;
  }
}

// ══════════════════════════════════════════════════════════════════
// ══  STRIPE ADAPTER (stub-ready)                                ══
// ══════════════════════════════════════════════════════════════════

/**
 * Stripe adapter with structural scaffolding.
 * When STRIPE_SECRET_KEY is set, the methods can be filled in with
 * actual Stripe SDK calls. Until then, every call returns a clear
 * "not configured" error.
 */
class StripeAdapter implements PaymentGatewayAdapter {
  readonly name = "stripe";

  async processPayment(params: {
    amount: number;
    currency: string;
    userId: string;
    metadata?: Record<string, any>;
  }): Promise<PaymentResult> {
    if (!this.isConfigured()) {
      logger.warn("Stripe is not configured — STRIPE_SECRET_KEY is missing");
      return {
        success: false,
        error:
          "Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.",
        errorCode: "GATEWAY_NOT_CONFIGURED",
      };
    }

    // TODO: Implement with Stripe SDK
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    // const paymentIntent = await stripe.paymentIntents.create({
    //   amount: Math.round(params.amount * 100), // Stripe uses cents
    //   currency: params.currency.toLowerCase(),
    //   metadata: { userId: params.userId, ...params.metadata },
    // });
    // return {
    //   success: true,
    //   transactionId: paymentIntent.id,
    //   gatewayResponse: paymentIntent,
    // };

    return {
      success: false,
      error: "Stripe payment processing is not yet implemented",
      errorCode: "NOT_IMPLEMENTED",
    };
  }

  async refundPayment(params: {
    transactionId: string;
    amount?: number;
    reason?: string;
  }): Promise<RefundResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error:
          "Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.",
      };
    }

    // TODO: Implement with Stripe SDK
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    // const refund = await stripe.refunds.create({
    //   payment_intent: params.transactionId,
    //   amount: params.amount ? Math.round(params.amount * 100) : undefined,
    //   reason: params.reason as Stripe.RefundCreateParams.Reason,
    // });
    // return { success: true, refundId: refund.id };

    return {
      success: false,
      error: "Stripe refund processing is not yet implemented",
    };
  }

  /**
   * Stripe uses HMAC-SHA256 to sign webhooks.
   * Once the Stripe SDK is integrated, use `stripe.webhooks.constructEvent()`.
   */
  verifyWebhookSignature(
    _payload: string,
    _signature: string,
    _secret: string,
  ): boolean {
    if (!this.isConfigured()) return false;

    // TODO: Implement with Stripe SDK
    // try {
    //   const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    //   stripe.webhooks.constructEvent(payload, signature, secret);
    //   return true;
    // } catch {
    //   return false;
    // }

    return false;
  }

  /**
   * Map Stripe event types to standardized webhook events.
   *
   * Key Stripe events:
   *   invoice.paid, invoice.payment_failed, customer.subscription.updated,
   *   customer.subscription.deleted, charge.refunded, charge.dispute.created
   */
  parseWebhookEvent(payload: any): StandardizedWebhookEvent {
    const eventType: string = payload?.type || "";
    const data = payload?.data?.object || {};

    const userId: string = data.metadata?.userId || data.customer || "";
    const subscriptionExternalId: string | undefined =
      data.subscription || data.id;

    let type: StandardizedWebhookEvent["type"];

    switch (eventType) {
      case "invoice.paid":
      case "payment_intent.succeeded":
        type = "payment_succeeded";
        break;

      case "invoice.payment_failed":
      case "payment_intent.payment_failed":
        type = "payment_failed";
        break;

      case "customer.subscription.deleted":
        type = "subscription_canceled";
        break;

      case "customer.subscription.updated": {
        // Distinguish between renewal and cancellation
        const status = data.status;
        if (status === "active") {
          type = "subscription_renewed";
        } else if (status === "canceled" || status === "unpaid") {
          type = "subscription_canceled";
        } else if (status === "trialing") {
          type = "unknown"; // Trial start/continuation
        } else {
          type = "unknown";
        }
        break;
      }

      case "customer.subscription.trial_will_end":
        type = "trial_ended";
        break;

      case "charge.refunded":
        type = "refund";
        break;

      case "charge.dispute.created":
        type = "dispute";
        break;

      default:
        type = "unknown";
        break;
    }

    // Extract amount — Stripe uses smallest currency unit (cents)
    const amount =
      data.amount_paid != null
        ? data.amount_paid / 100
        : data.amount != null
          ? data.amount / 100
          : undefined;

    const currency: string | undefined = data.currency?.toUpperCase();

    const expiresAt = data.current_period_end
      ? new Date(data.current_period_end * 1000)
      : undefined;

    return {
      type,
      userId,
      subscriptionExternalId,
      productId: data.plan?.id || data.price?.id,
      amount,
      currency,
      expiresAt,
      rawEvent: payload,
    };
  }

  isConfigured(): boolean {
    return !!(
      process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET
    );
  }
}

// ══════════════════════════════════════════════════════════════════
// ══  MANUAL ADAPTER (admin-granted subscriptions)               ══
// ══════════════════════════════════════════════════════════════════

/**
 * Used for admin-granted subscriptions where no real payment occurs.
 * All payment operations succeed automatically.
 */
class ManualAdapter implements PaymentGatewayAdapter {
  readonly name = "manual";

  /**
   * Manual payments always succeed — the admin is granting access directly.
   */
  async processPayment(params: {
    amount: number;
    currency: string;
    userId: string;
    metadata?: Record<string, any>;
  }): Promise<PaymentResult> {
    return {
      success: true,
      transactionId: `manual_${Date.now()}_${params.userId}`,
      gatewayResponse: {
        type: "admin_override",
        userId: params.userId,
        amount: params.amount,
        currency: params.currency,
        grantedAt: new Date().toISOString(),
        ...(params.metadata || {}),
      },
    };
  }

  /**
   * Manual refunds always succeed — the admin is revoking or adjusting.
   */
  async refundPayment(params: {
    transactionId: string;
    amount?: number;
    reason?: string;
  }): Promise<RefundResult> {
    return {
      success: true,
      refundId: `manual_refund_${Date.now()}_${params.transactionId}`,
    };
  }

  /**
   * Manual adapter does not use webhooks.
   */
  verifyWebhookSignature(
    _payload: string,
    _signature: string,
    _secret: string,
  ): boolean {
    return false;
  }

  /**
   * Manual adapter does not receive webhook events.
   */
  parseWebhookEvent(payload: any): StandardizedWebhookEvent {
    return {
      type: "unknown",
      userId: "",
      rawEvent: payload,
    };
  }

  /**
   * Manual adapter is always available — no external configuration needed.
   */
  isConfigured(): boolean {
    return true;
  }
}

// ══════════════════════════════════════════════════════════════════
// ══  PAYMENT GATEWAY MANAGER (factory / registry)               ══
// ══════════════════════════════════════════════════════════════════

class PaymentGatewayManager {
  private adapters: Map<string, PaymentGatewayAdapter>;

  constructor() {
    this.adapters = new Map<string, PaymentGatewayAdapter>();

    // Register built-in adapters
    const builtIn: PaymentGatewayAdapter[] = [
      new RevenueCatAdapter(),
      new StripeAdapter(),
      new ManualAdapter(),
    ];

    for (const adapter of builtIn) {
      this.adapters.set(adapter.name, adapter);
    }
  }

  // ── Adapter access ───────────────────────────────────────────

  /**
   * Retrieve an adapter by gateway name.
   * Throws if the gateway is unknown.
   */
  getAdapter(gateway: string): PaymentGatewayAdapter {
    const adapter = this.adapters.get(gateway);
    if (!adapter) {
      throw new Error(
        `Unknown payment gateway: "${gateway}". ` +
          `Available gateways: ${[...this.adapters.keys()].join(", ")}`,
      );
    }
    return adapter;
  }

  /**
   * List all gateways that have valid configuration (env vars set).
   */
  getAvailableGateways(): string[] {
    return [...this.adapters.entries()]
      .filter(([, adapter]) => adapter.isConfigured())
      .map(([name]) => name);
  }

  /**
   * List all registered gateway names (regardless of configuration).
   */
  getAllGateways(): string[] {
    return [...this.adapters.keys()];
  }

  /**
   * Register a custom adapter (e.g. PayPal, Paddle) at runtime.
   */
  registerAdapter(adapter: PaymentGatewayAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  // ── Transaction persistence ──────────────────────────────────

  /**
   * Record a payment transaction in the database.
   */
  async recordTransaction(data: {
    invoiceId?: string;
    userId: string;
    status: "pending" | "succeeded" | "failed" | "refunded" | "disputed";
    amount: string; // numeric string for Drizzle (e.g. "29.99")
    currency: string;
    paymentGateway: string;
    gatewayTransactionId?: string;
    gatewayResponse?: any;
    failureReason?: string;
    failureCode?: string;
    refundedAmount?: string;
    refundedAt?: Date;
    refundReason?: string;
    metadata?: any;
  }) {
    const txnId = crypto.randomUUID();
    const insertValues = {
      id: txnId,
      invoiceId: data.invoiceId || null,
      userId: data.userId,
      status: data.status,
      amount: data.amount,
      currency: data.currency,
      paymentGateway: data.paymentGateway,
      gatewayTransactionId: data.gatewayTransactionId || null,
      gatewayResponse: data.gatewayResponse || null,
      failureReason: data.failureReason || null,
      failureCode: data.failureCode || null,
      refundedAmount: data.refundedAmount || null,
      refundedAt: data.refundedAt || null,
      refundReason: data.refundReason || null,
      metadata: data.metadata || null,
    };

    if (isMysql) {
      await db.insert(paymentTransactions).values(insertValues);
      const [transaction] = await db
        .select()
        .from(paymentTransactions)
        .where(eq(paymentTransactions.id, txnId));
      return transaction!;
    }

    const [transaction] = await db
      .insert(paymentTransactions)
      .values(insertValues)
      .returning();
    return transaction!;
  }

  /**
   * Retrieve a single transaction by its primary key.
   */
  async getTransaction(id: string) {
    const [transaction] = await db
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.id, id))
      .limit(1);

    return transaction || null;
  }

  /**
   * List all transactions associated with an invoice.
   */
  async getTransactionsByInvoice(invoiceId: string) {
    return db
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.invoiceId, invoiceId));
  }

  /**
   * List all transactions for a user, ordered by most recent first.
   */
  async getTransactionsByUser(userId: string) {
    return db
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.userId, userId))
      .orderBy(paymentTransactions.createdAt);
  }

  /**
   * Update a transaction's status (e.g. pending → succeeded, or mark as refunded).
   */
  async updateTransactionStatus(
    id: string,
    updates: {
      status?: "pending" | "succeeded" | "failed" | "refunded" | "disputed";
      gatewayResponse?: any;
      failureReason?: string;
      failureCode?: string;
      refundedAmount?: string;
      refundedAt?: Date;
      refundReason?: string;
    },
  ) {
    const [transaction] = (await db
      .update(paymentTransactions)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(paymentTransactions.id, id))) as any;
    return transaction || null;
  }
}

// ══════════════════════════════════════════════════════════════════
// ══  SINGLETON EXPORT                                           ══
// ══════════════════════════════════════════════════════════════════

export const paymentGatewayManager = new PaymentGatewayManager();
