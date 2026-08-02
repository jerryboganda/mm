import crypto from "crypto";
import type { Request } from "express";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import {
  userSessions,
  users,
  type User,
  type UserSession,
} from "../../shared/schema";

export const DEVICE_LIMIT_KEYS = {
  enabled: "device_limit_enabled",
  defaultMax: "device_limit_default_max",
} as const;

const DEFAULT_DEVICE_LIMIT_MAX = 3;
const MAX_DEVICE_LIMIT = 20;
const REFRESH_TOKEN_DAYS = 30;

export interface DeviceIdentity {
  deviceId?: string;
  deviceLabel?: string;
  platform?: string;
}

export interface DeviceLimitSettings {
  enabled: boolean;
  defaultMax: number;
}

export function clampDeviceLimit(value: unknown): number {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : DEFAULT_DEVICE_LIMIT_MAX;

  if (!Number.isFinite(numericValue)) return DEFAULT_DEVICE_LIMIT_MAX;
  return Math.min(MAX_DEVICE_LIMIT, Math.max(1, Math.trunc(numericValue)));
}

export function hashRefreshToken(refreshToken: string): string {
  return crypto.createHash("sha256").update(refreshToken).digest("hex");
}

export function getRefreshTokenExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
}

function getHeaderValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value) && value[0]?.trim()) return value[0].trim();
  return null;
}

export function getRequestIpAddress(req: Request): string {
  const forwardedFor = getHeaderValue(req.headers["x-forwarded-for"]);
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return (
    getHeaderValue(req.headers["x-real-ip"]) ||
    req.ip ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

export async function getDeviceLimitSettings(): Promise<DeviceLimitSettings> {
  const settings = await storage.getAppSettings(
    Object.values(DEVICE_LIMIT_KEYS),
  );
  const settingsMap = new Map(
    settings.map((entry) => [entry.key, entry.value]),
  );

  return {
    enabled: settingsMap.get(DEVICE_LIMIT_KEYS.enabled) === "true",
    defaultMax: clampDeviceLimit(settingsMap.get(DEVICE_LIMIT_KEYS.defaultMax)),
  };
}

export async function setDeviceLimitSettings(
  settings: DeviceLimitSettings,
): Promise<DeviceLimitSettings> {
  const normalized = {
    enabled: Boolean(settings.enabled),
    defaultMax: clampDeviceLimit(settings.defaultMax),
  };

  await storage.setAppSettings([
    { key: DEVICE_LIMIT_KEYS.enabled, value: String(normalized.enabled) },
    { key: DEVICE_LIMIT_KEYS.defaultMax, value: String(normalized.defaultMax) },
  ]);

  return getDeviceLimitSettings();
}

export async function getEffectiveDeviceLimit(
  user: Pick<User, "deviceLimitOverrideEnabled" | "deviceLimitMax">,
): Promise<number | null> {
  if (user.deviceLimitOverrideEnabled) {
    return clampDeviceLimit(user.deviceLimitMax);
  }

  const settings = await getDeviceLimitSettings();
  return settings.enabled ? settings.defaultMax : null;
}

export async function createOrReplaceUserSession(options: {
  sessionId: string;
  user: User;
  refreshToken: string;
  device: DeviceIdentity;
  req: Request;
}): Promise<UserSession> {
  const now = new Date();
  const deviceId =
    options.device.deviceId?.trim() || crypto.randomBytes(16).toString("hex");
  const refreshTokenHash = hashRefreshToken(options.refreshToken);

  await db
    .update(userSessions)
    .set({
      isActive: false,
      revokedAt: now,
      revokeReason: "same_device_replaced",
    })
    .where(
      and(
        eq(userSessions.userId, options.user.id),
        eq(userSessions.deviceId, deviceId),
        eq(userSessions.isActive, true),
      ),
    );

  const [session] = await db
    .insert(userSessions)
    .values({
      id: options.sessionId,
      userId: options.user.id,
      deviceId,
      deviceLabel: options.device.deviceLabel?.trim() || null,
      platform: options.device.platform?.trim() || null,
      userAgent: getHeaderValue(options.req.headers["user-agent"]),
      ipAddress: getRequestIpAddress(options.req),
      refreshTokenHash,
      expiresAt: getRefreshTokenExpiry(),
      lastSeenAt: now,
    })
    .returning();

  await enforceDeviceLimit(
    options.user.id,
    await getEffectiveDeviceLimit(options.user),
    session.id,
  );
  return session;
}

export async function enforceDeviceLimit(
  userId: string,
  limit: number | null,
  protectedSessionId?: string,
): Promise<void> {
  if (!limit) return;

  const activeSessions = await db
    .select()
    .from(userSessions)
    .where(
      and(eq(userSessions.userId, userId), eq(userSessions.isActive, true)),
    )
    .orderBy(asc(userSessions.lastSeenAt), asc(userSessions.createdAt));

  const revokeCount = activeSessions.length - limit;
  if (revokeCount <= 0) return;

  const sessionsToRevoke = activeSessions
    .filter((session) => session.id !== protectedSessionId)
    .slice(0, revokeCount);

  if (sessionsToRevoke.length === 0) return;

  await revokeSessionsByIds(
    sessionsToRevoke.map((session) => session.id),
    "device_limit_kick_oldest",
  );
}

export async function getActiveSession(
  sessionId: string,
): Promise<UserSession | undefined> {
  const [session] = await db
    .select()
    .from(userSessions)
    .where(
      and(
        eq(userSessions.id, sessionId),
        eq(userSessions.isActive, true),
        sql`${userSessions.expiresAt} > now()`,
      ),
    );
  return session;
}

export async function touchSession(sessionId: string): Promise<void> {
  await db
    .update(userSessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(userSessions.id, sessionId));
}

export async function revokeSession(
  sessionId: string,
  reason: string,
  revokedBy?: string,
): Promise<void> {
  await db
    .update(userSessions)
    .set({
      isActive: false,
      revokedAt: new Date(),
      revokedBy: revokedBy || null,
      revokeReason: reason,
    })
    .where(eq(userSessions.id, sessionId));
}

export async function revokeSessionsByIds(
  sessionIds: string[],
  reason: string,
  revokedBy?: string,
): Promise<void> {
  if (sessionIds.length === 0) return;
  await db
    .update(userSessions)
    .set({
      isActive: false,
      revokedAt: new Date(),
      revokedBy: revokedBy || null,
      revokeReason: reason,
    })
    .where(inArray(userSessions.id, sessionIds));
}

export async function revokeUserSessions(
  userId: string,
  reason: string,
  revokedBy?: string,
): Promise<void> {
  await db
    .update(userSessions)
    .set({
      isActive: false,
      revokedAt: new Date(),
      revokedBy: revokedBy || null,
      revokeReason: reason,
    })
    .where(
      and(eq(userSessions.userId, userId), eq(userSessions.isActive, true)),
    );
}

export async function countActiveSessionsByUserIds(
  userIds: string[],
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();

  const rows = await db
    .select({
      userId: userSessions.userId,
      activeDeviceCount: count(),
    })
    .from(userSessions)
    .where(
      and(
        inArray(userSessions.userId, userIds),
        eq(userSessions.isActive, true),
        sql`${userSessions.expiresAt} > now()`,
      ),
    )
    .groupBy(userSessions.userId);

  return new Map(
    rows.map((row) => [row.userId, Number(row.activeDeviceCount)]),
  );
}

export async function listUserSessions(userId: string): Promise<UserSession[]> {
  return db
    .select()
    .from(userSessions)
    .where(
      and(eq(userSessions.userId, userId), eq(userSessions.isActive, true)),
    )
    .orderBy(desc(userSessions.lastSeenAt));
}

export async function enforceGlobalDeviceLimits(): Promise<void> {
  const settings = await getDeviceLimitSettings();
  if (!settings.enabled) return;

  const rows = await db
    .select({
      id: users.id,
      deviceLimitOverrideEnabled: users.deviceLimitOverrideEnabled,
      deviceLimitMax: users.deviceLimitMax,
    })
    .from(users)
    .where(eq(users.deviceLimitOverrideEnabled, false));

  for (const user of rows) {
    await enforceDeviceLimit(user.id, settings.defaultMax);
  }
}
