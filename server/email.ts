/**
 * Centralized Email Service â€” Brevo SMTP
 *
 * All email sending in the app goes through this module.
 * SMTP settings are loaded from the `app_settings` table (configurable via Admin Panel).
 * Falls back to env vars BREVO_SMTP_HOST, BREVO_SMTP_PORT, BREVO_SMTP_USER, BREVO_SMTP_PASS,
 * BREVO_FROM_EMAIL, BREVO_FROM_NAME if no DB settings exist.
 */
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { db } from "./db";
import { appSettings } from "../shared/schema";
import { inArray } from "drizzle-orm";
import { logger } from "./lib/logger";

// Setting keys in app_settings table
const SETTING_KEYS = {
  API_KEY: "brevo_api_key",
  SMTP_HOST: "brevo_smtp_host",
  SMTP_PORT: "brevo_smtp_port",
  SMTP_USER: "brevo_smtp_user",
  SMTP_PASS: "brevo_smtp_pass",
  FROM_EMAIL: "brevo_from_email",
  FROM_NAME: "brevo_from_name",
} as const;

interface SmtpConfig {
  apiKey: string;
  host: string;
  port: number;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
}

/**
 * Load SMTP config from DB first, then fall back to env vars.
 */
async function getSmtpConfig(): Promise<SmtpConfig | null> {
  try {
    const settings = await db
      .select()
      .from(appSettings)
      .where(inArray(appSettings.key, Object.values(SETTING_KEYS)));

    const settingsMap = new Map(settings.map((s: any) => [s.key, s.value]));

    const apiKey =
      settingsMap.get(SETTING_KEYS.API_KEY) ||
      process.env.BREVO_API_KEY ||
      "";
    const host =
      settingsMap.get(SETTING_KEYS.SMTP_HOST) ||
      process.env.BREVO_SMTP_HOST ||
      "";
    const port =
      settingsMap.get(SETTING_KEYS.SMTP_PORT) ||
      process.env.BREVO_SMTP_PORT ||
      "587";
    const user =
      settingsMap.get(SETTING_KEYS.SMTP_USER) ||
      process.env.BREVO_SMTP_USER ||
      "";
    const pass =
      settingsMap.get(SETTING_KEYS.SMTP_PASS) ||
      process.env.BREVO_SMTP_PASS ||
      "";
    const fromEmail =
      settingsMap.get(SETTING_KEYS.FROM_EMAIL) ||
      process.env.BREVO_FROM_EMAIL ||
      "";
    const fromName =
      settingsMap.get(SETTING_KEYS.FROM_NAME) ||
      process.env.BREVO_FROM_NAME ||
      "Maternal Mind";

    if (!fromEmail) {
      return null;
    }
    // Usable when the HTTP API key is set, or when full SMTP creds exist
    if (!apiKey && (!host || !user || !pass)) {
      return null;
    }

    return {
      apiKey,
      host,
      port: parseInt(port, 10),
      user,
      pass,
      fromEmail,
      fromName,
    };
  } catch (error) {
    logger.error("Failed to load SMTP config", { error: String(error) });
    return null;
  }
}

/**
 * Create a nodemailer transporter with the current SMTP settings.
 * Re-created on every call so admin changes take effect immediately.
 */
async function createTransporter(
  config?: SmtpConfig,
): Promise<Transporter | null> {
  const cfg = config ?? (await getSmtpConfig());
  if (!cfg) return null;

  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
    // Don't hang the request forever on blocked/slow SMTP ports
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email via the Brevo HTTPS API (api.brevo.com, port 443).
 * Preferred transport: works where outbound SMTP ports are blocked and
 * surfaces Brevo-side rejections with a clear message. Never logs the key.
 */
async function sendViaBrevoApi(args: {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  const recipients = (Array.isArray(args.to) ? args.to : [args.to]).map(
    (email) => ({ email }),
  );
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": args.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: args.fromName, email: args.fromEmail },
        to: recipients,
        subject: args.subject,
        htmlContent: args.html,
        ...(args.text ? { textContent: args.text } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) return true;
    const body = await res.text().catch(() => "");
    logger.error("Brevo API send failed", {
      status: res.status,
      to: recipients.map((r) => r.email).join(", "),
      subject: args.subject,
      error: body.slice(0, 300),
    });
    return false;
  } catch (error) {
    logger.error("Brevo API send failed", { error: String(error) });
    return false;
  }
}

/**
 * Send an email via Brevo SMTP.
 * Returns true if sent successfully, false otherwise.
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const config = await getSmtpConfig();
  if (!config) {
    if (process.env.NODE_ENV !== "production") {
      logger.debug("Email not sent (no email config)", {
        to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
        subject: options.subject,
      });
    } else {
      logger.warn("Email not configured, email not sent");
    }
    return false;
  }

  // Preferred: HTTPS API. Falls back to SMTP when the API fails and SMTP
  // credentials are also configured.
  if (config.apiKey) {
    const ok = await sendViaBrevoApi({
      apiKey: config.apiKey,
      fromEmail: config.fromEmail,
      fromName: config.fromName,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    if (ok) return true;
    if (!config.host || !config.user || !config.pass) return false;
    logger.warn("Brevo API failed, falling back to SMTP");
  }

  const transporter = await createTransporter(config);
  if (!transporter) return false;

  const toHeader = Array.isArray(options.to)
    ? options.to.join(", ")
    : options.to;
  try {
    await transporter.sendMail({
      from: `${config.fromName} <${config.fromEmail}>`,
      to: toHeader,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    return true;
  } catch (error) {
    logger.error("Email send failed", {
      to: toHeader,
      subject: options.subject,
      error: String(error),
    });
    return false;
  }
}

/**
 * Shared body for the admin-panel connection test email.
 */
function smtpTestHtml(args: {
  host: string;
  port: number | string;
  fromEmail: string;
  fromName: string;
}): string {
  return `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #00d4ff; margin: 0;">Maternal Mind</h1>
            <p style="color: #666; margin-top: 5px;">Email System Test</p>
          </div>
          <div style="background: linear-gradient(135deg, #f0f9ff, #e0f2fe); padding: 30px; border-radius: 16px; border: 1px solid #bae6fd;">
            <h2 style="color: #0284c7; margin-top: 0;">🎉 Email Configuration Successful!</h2>
            <p style="color: #334155; line-height: 1.6;">
              Your Brevo email settings are working correctly.
              All email notifications (verification, password reset, support) will now be delivered through this configuration.
            </p>
            <div style="background: white; padding: 15px; border-radius: 8px; margin-top: 15px;">
              <p style="margin: 0; color: #64748b; font-size: 14px;"><strong>Host:</strong> ${args.host}</p>
              <p style="margin: 5px 0 0; color: #64748b; font-size: 14px;"><strong>Port:</strong> ${args.port}</p>
              <p style="margin: 5px 0 0; color: #64748b; font-size: 14px;"><strong>From:</strong> ${args.fromName} &lt;${args.fromEmail}&gt;</p>
            </div>
          </div>
          <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 30px;">
            This is an automated test email from Maternal Mind Admin Panel.
          </p>
        </div>
      `;
}

/**
 * Test Brevo HTTPS API delivery (used by admin panel "Test" button when an
 * API key is provided). Does NOT read from DB — uses the provided values.
 */
export async function testBrevoApiConnection(config: {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  testRecipient: string;
}): Promise<{ success: boolean; error?: string }> {
  const ok = await sendViaBrevoApi({
    apiKey: config.apiKey,
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    to: config.testRecipient,
    subject: "✅ Maternal Mind — Email Test Successful",
    html: smtpTestHtml({
      host: "api.brevo.com (HTTPS API)",
      port: 443,
      fromEmail: config.fromEmail,
      fromName: config.fromName,
    }),
  });
  return ok
    ? { success: true }
    : { success: false, error: "Brevo API rejected the request (see server logs)" };
}
/**
 * Test the SMTP connection with given config (used by admin panel "Test" button).
 * Does NOT read from DB — uses the provided config directly.
 */
export async function testSmtpConnection(config: {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
  testRecipient: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
    });

    // Verify connection
    await transporter.verify();

    // Send test email
    await transporter.sendMail({
      from: `${config.fromName} <${config.fromEmail}>`,
      to: config.testRecipient,
      subject: "âœ… Maternal Mind â€” SMTP Test Successful",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #00d4ff; margin: 0;">Maternal Mind</h1>
            <p style="color: #666; margin-top: 5px;">Email System Test</p>
          </div>
          <div style="background: linear-gradient(135deg, #f0f9ff, #e0f2fe); padding: 30px; border-radius: 16px; border: 1px solid #bae6fd;">
            <h2 style="color: #0284c7; margin-top: 0;">ðŸŽ‰ SMTP Configuration Successful!</h2>
            <p style="color: #334155; line-height: 1.6;">
              Your Brevo SMTP email settings are working correctly.
              All email notifications (verification, password reset, support) will now be delivered through this configuration.
            </p>
            <div style="background: white; padding: 15px; border-radius: 8px; margin-top: 15px;">
              <p style="margin: 0; color: #64748b; font-size: 14px;"><strong>SMTP Host:</strong> ${config.host}</p>
              <p style="margin: 5px 0 0; color: #64748b; font-size: 14px;"><strong>Port:</strong> ${config.port}</p>
              <p style="margin: 5px 0 0; color: #64748b; font-size: 14px;"><strong>From:</strong> ${config.fromName} &lt;${config.fromEmail}&gt;</p>
            </div>
          </div>
          <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 30px;">
            This is an automated test email from Maternal Mind Admin Panel.
          </p>
        </div>
      `,
    });

    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown SMTP error",
    };
  }
}

// â”€â”€ Pre-built email templates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function verificationEmailHtml(otp: string): string {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #00d4ff; margin: 0;">Maternal Mind</h1>
      </div>
      <div style="background: linear-gradient(135deg, #f0f9ff, #e0f2fe); padding: 30px; border-radius: 16px; border: 1px solid #bae6fd;">
        <h2 style="color: #0284c7; margin-top: 0;">Welcome! Verify Your Email</h2>
        <p style="color: #334155; line-height: 1.6;">Your verification code is:</p>
        <div style="text-align: center; margin: 20px 0;">
          <span style="background: #0284c7; color: white; padding: 15px 30px; font-size: 28px; letter-spacing: 8px; border-radius: 12px; display: inline-block; font-weight: bold;">${otp}</span>
        </div>
        <p style="color: #64748b; font-size: 14px; text-align: center;">This code will expire in 15 minutes.</p>
      </div>
      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 30px;">
        If you didn't create an account, you can safely ignore this email.
      </p>
    </div>
  `;
}

export function passwordResetOtpEmailHtml(
  userName: string,
  otp: string,
): string {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #00d4ff; margin: 0;">Maternal Mind</h1>
      </div>
      <div style="background: linear-gradient(135deg, #f0f9ff, #e0f2fe); padding: 30px; border-radius: 16px; border: 1px solid #bae6fd;">
        <h2 style="color: #0284c7; margin-top: 0;">Reset Your Password</h2>
        <p style="color: #334155; line-height: 1.6;">Hello ${userName},</p>
        <p style="color: #334155; line-height: 1.6;">You requested to reset your password. Enter the code below in the Maternal Mind app:</p>
        <div style="text-align: center; margin: 20px 0;">
          <span style="background: #0284c7; color: white; padding: 15px 30px; font-size: 28px; letter-spacing: 8px; border-radius: 12px; display: inline-block; font-weight: bold;">${otp}</span>
        </div>
        <p style="color: #64748b; font-size: 14px; text-align: center;">This code will expire in 1 hour.</p>
      </div>
      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 30px;">
        If you didn't request a password reset, you can safely ignore this email.
      </p>
    </div>
  `;
}

export function supportIssueEmailHtml(
  type: string,
  email: string,
  description: string,
): string {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #00d4ff; margin: 0;">Maternal Mind</h1>
        <p style="color: #666; margin-top: 5px;">Support Issue Report</p>
      </div>
      <div style="background: #fff7ed; padding: 30px; border-radius: 16px; border: 1px solid #fed7aa;">
        <h2 style="color: #c2410c; margin-top: 0;">[${type.toUpperCase()}] New Issue Report</h2>
        <div style="background: white; padding: 20px; border-radius: 8px; margin-top: 15px;">
          <p style="margin: 0 0 10px;"><strong>Type:</strong> ${type}</p>
          <p style="margin: 0 0 10px;"><strong>User:</strong> ${email}</p>
          <p style="margin: 0 0 10px;"><strong>Description:</strong></p>
          <p style="background: #f5f5f5; padding: 15px; border-radius: 8px; color: #334155; line-height: 1.6;">${description}</p>
        </div>
      </div>
    </div>
  `;
}
