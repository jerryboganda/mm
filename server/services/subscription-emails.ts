/**
 * Subscription Email Notification Service
 *
 * Sends branded transactional emails for subscription lifecycle events:
 * welcome, renewal reminders, payment confirmations, failures, expiry
 * warnings, cancellations, trial endings, and reactivations.
 *
 * Uses the central `sendEmail` module (Brevo SMTP) and returns true/false
 * to indicate delivery success.
 */

import { sendEmail } from "../email";
import { logger } from "../lib/logger";

// ── Brand constants ──────────────────────────────────────────────
const BRAND = {
  appName: "Maternal Mind",
  supportEmail: "support@maternalmind.com.pk",
  bgColor: "#0c1e2e",
  bgOuter: "#101d22",
  accent: "#11a4d4",
  textPrimary: "#ffffff",
  textSecondary: "#a0b4c0",
  textMuted: "#6b8599",
  cardBg: "#132a3a",
  borderColor: "#1a3a4f",
} as const;

// ── Shared HTML helpers ──────────────────────────────────────────

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${BRAND.appName}</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.bgOuter};font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.bgOuter};">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${BRAND.bgColor};border-radius:16px;border:1px solid ${BRAND.borderColor};">
          <!-- Header -->
          <tr>
            <td style="padding:30px 40px 20px;text-align:center;border-bottom:1px solid ${BRAND.borderColor};">
              <h1 style="margin:0;font-size:26px;font-weight:700;color:${BRAND.accent};letter-spacing:1px;">${BRAND.appName}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:30px 40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 30px;border-top:1px solid ${BRAND.borderColor};text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;color:${BRAND.textMuted};line-height:1.6;">
                If you have questions, contact us at
                <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.accent};text-decoration:none;">${BRAND.supportEmail}</a>
              </p>
              <p style="margin:0;font-size:12px;color:${BRAND.textMuted};line-height:1.6;">
                You are receiving this email because you have an account with ${BRAND.appName}.<br>
                To stop receiving subscription emails, update your notification preferences in the app.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function heading(text: string): string {
  return `<h2 style="margin:0 0 16px;font-size:22px;font-weight:600;color:${BRAND.textPrimary};">${text}</h2>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:${BRAND.textSecondary};">${text}</p>`;
}

function greeting(userName: string): string {
  return paragraph(`Hello ${userName},`);
}

function infoCard(rows: { label: string; value: string }[]): string {
  const items = rows
    .map(
      (r) =>
        `<tr>
          <td style="padding:8px 12px;font-size:14px;color:${BRAND.textMuted};white-space:nowrap;vertical-align:top;">${r.label}</td>
          <td style="padding:8px 12px;font-size:14px;color:${BRAND.textPrimary};font-weight:600;">${r.value}</td>
        </tr>`,
    )
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.cardBg};border-radius:10px;border:1px solid ${BRAND.borderColor};margin:20px 0;">
    ${items}
  </table>`;
}

function ctaButton(text: string, url: string = "#"): string {
  return `<div style="text-align:center;margin:24px 0;">
    <a href="${url}" style="display:inline-block;padding:14px 36px;background-color:${BRAND.accent};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">${text}</a>
  </div>`;
}

function signOff(): string {
  return `<p style="margin:24px 0 0;font-size:15px;line-height:1.7;color:${BRAND.textSecondary};">
    Thank you for choosing ${BRAND.appName}.<br>
    <span style="color:${BRAND.textMuted};font-size:13px;">— The ${BRAND.appName} Team</span>
  </p>`;
}

// ══════════════════════════════════════════════════════════════════
// ══  1. WELCOME EMAIL                                           ══
// ══════════════════════════════════════════════════════════════════

function subscriptionWelcomeHtml(
  userName: string,
  packageName: string,
): string {
  return emailWrapper(`
    ${heading("Welcome to Premium! 🎉")}
    ${greeting(userName)}
    ${paragraph(`Your <strong style="color:${BRAND.accent};">${packageName}</strong> subscription is now active. You have full access to all premium features designed to support your maternal health journey.`)}
    ${infoCard([
      { label: "Plan", value: packageName },
      { label: "Status", value: "✅ Active" },
    ])}
    ${paragraph("Here's what you can do now:")}
    <ul style="margin:0 0 16px;padding-left:20px;color:${BRAND.textSecondary};font-size:15px;line-height:2;">
      <li>Access all premium screening tools</li>
      <li>Get personalized insights and reports</li>
      <li>Enjoy priority support</li>
    </ul>
    ${ctaButton("Open Maternal Mind")}
    ${signOff()}
  `);
}

export async function sendSubscriptionWelcomeEmail(
  to: string,
  userName: string,
  packageName: string,
): Promise<boolean> {
  try {
    const html = subscriptionWelcomeHtml(userName, packageName);
    await sendEmail({
      to,
      subject: "Welcome to Maternal Mind Premium! 🎉",
      html,
    });
    return true;
  } catch (error) {
    logger.error("subscription-emails: Failed to send welcome email", { error: String(error) });
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════
// ══  2. RENEWAL REMINDER EMAIL                                  ══
// ══════════════════════════════════════════════════════════════════

function renewalReminderHtml(
  userName: string,
  packageName: string,
  renewalDate: string,
  price: string,
): string {
  return emailWrapper(`
    ${heading("Subscription Renewal Reminder")}
    ${greeting(userName)}
    ${paragraph(`Your <strong style="color:${BRAND.accent};">${packageName}</strong> subscription will automatically renew soon. No action is needed if you'd like to continue enjoying premium features.`)}
    ${infoCard([
      { label: "Plan", value: packageName },
      { label: "Renewal Date", value: renewalDate },
      { label: "Amount", value: price },
    ])}
    ${paragraph("If you wish to make changes to your subscription or update your payment method, please do so before the renewal date.")}
    ${ctaButton("Manage Subscription")}
    ${signOff()}
  `);
}

export async function sendRenewalReminderEmail(
  to: string,
  userName: string,
  packageName: string,
  renewalDate: string,
  price: string,
): Promise<boolean> {
  try {
    const html = renewalReminderHtml(userName, packageName, renewalDate, price);
    await sendEmail({
      to,
      subject: `Your Maternal Mind subscription renews on ${renewalDate}`,
      html,
    });
    return true;
  } catch (error) {
    logger.error("subscription-emails: Failed to send renewal reminder", { error: String(error) });
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════
// ══  3. PAYMENT SUCCESS EMAIL                                   ══
// ══════════════════════════════════════════════════════════════════

function paymentSuccessHtml(
  userName: string,
  packageName: string,
  amount: string,
  invoiceNumber: string,
): string {
  return emailWrapper(`
    ${heading("Payment Confirmed ✅")}
    ${greeting(userName)}
    ${paragraph("We've successfully processed your payment. Here are the details:")}
    ${infoCard([
      { label: "Plan", value: packageName },
      { label: "Amount Paid", value: amount },
      { label: "Invoice", value: `#${invoiceNumber}` },
    ])}
    ${paragraph("A copy of this receipt has been saved to your account. You can view your billing history at any time from the app.")}
    ${ctaButton("View Billing History")}
    ${signOff()}
  `);
}

export async function sendPaymentSuccessEmail(
  to: string,
  userName: string,
  packageName: string,
  amount: string,
  invoiceNumber: string,
): Promise<boolean> {
  try {
    const html = paymentSuccessHtml(
      userName,
      packageName,
      amount,
      invoiceNumber,
    );
    await sendEmail({
      to,
      subject: `Payment Confirmed — Invoice #${invoiceNumber}`,
      html,
    });
    return true;
  } catch (error) {
    logger.error("subscription-emails: Failed to send payment success email", { error: String(error) });
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════
// ══  4. PAYMENT FAILED EMAIL                                    ══
// ══════════════════════════════════════════════════════════════════

function paymentFailedHtml(
  userName: string,
  packageName: string,
  retryDate: string,
): string {
  return emailWrapper(`
    ${heading("Payment Failed ⚠️")}
    ${greeting(userName)}
    ${paragraph(`We were unable to process the payment for your <strong style="color:${BRAND.accent};">${packageName}</strong> subscription. This can happen if your card has expired or has insufficient funds.`)}
    ${infoCard([
      { label: "Plan", value: packageName },
      { label: "Next Retry", value: retryDate },
      { label: "Status", value: "⚠️ Payment Failed" },
    ])}
    ${paragraph("To avoid any interruption to your premium access, please update your payment method before we retry.")}
    ${ctaButton("Update Payment Method")}
    ${paragraph(`<em style="color:${BRAND.textMuted};font-size:13px;">If you've recently updated your payment details, you can disregard this notice — we'll retry automatically on ${retryDate}.</em>`)}
    ${signOff()}
  `);
}

export async function sendPaymentFailedEmail(
  to: string,
  userName: string,
  packageName: string,
  retryDate: string,
): Promise<boolean> {
  try {
    const html = paymentFailedHtml(userName, packageName, retryDate);
    await sendEmail({
      to,
      subject: "Action Required: Payment Failed — Maternal Mind",
      html,
    });
    return true;
  } catch (error) {
    logger.error("subscription-emails: Failed to send payment failed email", { error: String(error) });
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════
// ══  5. SUBSCRIPTION EXPIRING EMAIL                             ══
// ══════════════════════════════════════════════════════════════════

function subscriptionExpiringHtml(
  userName: string,
  packageName: string,
  expiryDate: string,
): string {
  return emailWrapper(`
    ${heading("Your Subscription Is Expiring Soon")}
    ${greeting(userName)}
    ${paragraph(`Your <strong style="color:${BRAND.accent};">${packageName}</strong> subscription is set to expire on <strong>${expiryDate}</strong>. After this date, you'll lose access to premium features.`)}
    ${infoCard([
      { label: "Plan", value: packageName },
      { label: "Expires On", value: expiryDate },
    ])}
    ${paragraph("Renew now to continue benefiting from personalized maternal health insights, advanced screening tools, and priority support.")}
    ${ctaButton("Renew Subscription")}
    ${signOff()}
  `);
}

export async function sendSubscriptionExpiringEmail(
  to: string,
  userName: string,
  packageName: string,
  expiryDate: string,
): Promise<boolean> {
  try {
    const html = subscriptionExpiringHtml(userName, packageName, expiryDate);
    await sendEmail({
      to,
      subject: `Your Maternal Mind subscription expires on ${expiryDate}`,
      html,
    });
    return true;
  } catch (error) {
    logger.error("subscription-emails: Failed to send expiring email", { error: String(error) });
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════
// ══  6. SUBSCRIPTION CANCELED EMAIL                             ══
// ══════════════════════════════════════════════════════════════════

function subscriptionCanceledHtml(
  userName: string,
  packageName: string,
  accessUntilDate?: string,
): string {
  const accessNote = accessUntilDate
    ? paragraph(
        `You'll continue to have access to all premium features until <strong>${accessUntilDate}</strong>. After that date, your account will revert to the free tier.`,
      )
    : paragraph(
        "Your premium access has been removed. Your account has been reverted to the free tier.",
      );

  return emailWrapper(`
    ${heading("Subscription Canceled")}
    ${greeting(userName)}
    ${paragraph(`Your <strong style="color:${BRAND.accent};">${packageName}</strong> subscription has been canceled as requested.`)}
    ${accessNote}
    ${infoCard([
      { label: "Plan", value: packageName },
      { label: "Status", value: "Canceled" },
      ...(accessUntilDate
        ? [{ label: "Access Until", value: accessUntilDate }]
        : []),
    ])}
    ${paragraph("We're sorry to see you go. If you change your mind, you can reactivate your subscription at any time.")}
    ${ctaButton("Reactivate Subscription")}
    ${signOff()}
  `);
}

export async function sendSubscriptionCanceledEmail(
  to: string,
  userName: string,
  packageName: string,
  accessUntilDate?: string,
): Promise<boolean> {
  try {
    const html = subscriptionCanceledHtml(
      userName,
      packageName,
      accessUntilDate,
    );
    await sendEmail({
      to,
      subject: "Your Maternal Mind Subscription Has Been Canceled",
      html,
    });
    return true;
  } catch (error) {
    logger.error("subscription-emails: Failed to send canceled email", { error: String(error) });
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════
// ══  7. TRIAL ENDING EMAIL                                      ══
// ══════════════════════════════════════════════════════════════════

function trialEndingHtml(
  userName: string,
  packageName: string,
  trialEndDate: string,
  price: string,
): string {
  return emailWrapper(`
    ${heading("Your Free Trial Ends Soon")}
    ${greeting(userName)}
    ${paragraph(`Your free trial of <strong style="color:${BRAND.accent};">${packageName}</strong> ends on <strong>${trialEndDate}</strong>. After that, your subscription will begin at <strong>${price}</strong>.`)}
    ${infoCard([
      { label: "Plan", value: packageName },
      { label: "Trial Ends", value: trialEndDate },
      { label: "Price After Trial", value: price },
    ])}
    ${paragraph("If you'd like to continue, no action is needed — your subscription will start automatically. To avoid being charged, cancel before the trial ends.")}
    ${ctaButton("Manage Subscription")}
    ${signOff()}
  `);
}

export async function sendTrialEndingEmail(
  to: string,
  userName: string,
  packageName: string,
  trialEndDate: string,
  price: string,
): Promise<boolean> {
  try {
    const html = trialEndingHtml(userName, packageName, trialEndDate, price);
    await sendEmail({
      to,
      subject: `Your free trial ends on ${trialEndDate} — Maternal Mind`,
      html,
    });
    return true;
  } catch (error) {
    logger.error("subscription-emails: Failed to send trial ending email", { error: String(error) });
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════
// ══  8. SUBSCRIPTION REACTIVATED EMAIL                          ══
// ══════════════════════════════════════════════════════════════════

function subscriptionReactivatedHtml(
  userName: string,
  packageName: string,
): string {
  return emailWrapper(`
    ${heading("Welcome Back! 🎉")}
    ${greeting(userName)}
    ${paragraph(`Your <strong style="color:${BRAND.accent};">${packageName}</strong> subscription has been reactivated. You once again have full access to all premium features.`)}
    ${infoCard([
      { label: "Plan", value: packageName },
      { label: "Status", value: "✅ Active" },
    ])}
    ${paragraph("We're glad to have you back. Continue your maternal health journey with the best tools and insights at your fingertips.")}
    ${ctaButton("Open Maternal Mind")}
    ${signOff()}
  `);
}

export async function sendSubscriptionReactivatedEmail(
  to: string,
  userName: string,
  packageName: string,
): Promise<boolean> {
  try {
    const html = subscriptionReactivatedHtml(userName, packageName);
    await sendEmail({
      to,
      subject: "Welcome Back to Maternal Mind Premium! 🎉",
      html,
    });
    return true;
  } catch (error) {
    logger.error("subscription-emails: Failed to send reactivated email", { error: String(error) });
    return false;
  }
}
