import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

// ─── Response Helpers ────────────────────────────────────────────────────────

/**
 * Send a successful JSON response.
 *
 * @param res     Express response object
 * @param data    Payload to return
 * @param statusCode  HTTP status (defaults to 200)
 */
export function success<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json(data);
}

/**
 * Send an error JSON response.
 *
 * @param res         Express response object
 * @param message     Human-readable error description
 * @param statusCode  HTTP status (defaults to 500)
 * @param details     Optional machine-readable detail payload (e.g. validation issues)
 */
export function error(
  res: Response,
  message: string,
  statusCode = 500,
  details?: unknown,
): void {
  const body: { message: string; details?: unknown } = { message };
  if (details !== undefined) {
    body.details = details;
  }
  res.status(statusCode).json(body);
}

/**
 * Send a paginated JSON response.
 *
 * The shape matches a common envelope:
 * ```json
 * { "data": [...], "pagination": { "total", "page", "pageSize", "totalPages" } }
 * ```
 */
export function paginated<T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): void {
  res.status(200).json({
    data,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
    },
  });
}

// ─── Zod Validation Middleware ────────────────────────────────────────────────

/**
 * Returns Express middleware that validates `req.body` against the supplied Zod
 * schema.  On success the parsed (and potentially transformed) value replaces
 * `req.body`.  On failure a `400` response is returned with the first
 * validation issue.
 *
 * Usage:
 * ```ts
 * router.post("/items", validateBody(createItemSchema), async (req, res) => {
 *   // req.body is now typed & validated
 * });
 * ```
 */
export function validateBody<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const formatted = result.error.errors
        .map((e) =>
          e.path.length ? `${e.path.join(".")}: ${e.message}` : e.message,
        )
        .join("; ");

      error(res, formatted, 400, result.error.flatten());
      return;
    }

    req.body = result.data;
    next();
  };
}

// ─── Async Route Handler ─────────────────────────────────────────────────────

/**
 * Wraps an async Express route handler so that rejected promises are forwarded
 * to the Express error-handling middleware via `next(err)`.  Eliminates the
 * need for try/catch in every route.
 *
 * Usage:
 * ```ts
 * router.get("/items", asyncHandler(async (req, res) => {
 *   const items = await db.select().from(itemsTable);
 *   success(res, items);
 * }));
 * ```
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ─── Input Sanitisation Utilities ────────────────────────────────────────────

/**
 * Minimal string sanitisation:
 * - trims leading/trailing whitespace
 * - normalises to Unicode NFC form
 * - strips null bytes (`\0`)
 *
 * Intentionally does **not** HTML-escape — that is the renderer's
 * responsibility (React, EJS, etc.).
 */
export function sanitizeString(input: string): string {
  return input.trim().normalize("NFC").replace(/\0/g, "");
}

/**
 * Strips dangerous HTML constructs while preserving safe markup suitable for
 * content rendering:
 *
 * 1. Removes `<script>…</script>` blocks (incl. multiline).
 * 2. Removes inline event handlers (`on*="…"`, `on*='…'`, `on*=…`).
 * 3. Removes `javascript:` URIs from attributes.
 *
 * For user-generated rich-text you should still prefer a proper allowlist
 * sanitiser (e.g. DOMPurify on the client).  This utility is a server-side
 * safety net for admin-authored HTML content.
 */
export function sanitizeHtml(input: string): string {
  let html = input;

  // 1. Remove <script> … </script> (case-insensitive, multiline)
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "");

  // 2. Remove on* event handler attributes
  //    Matches: onclick="…"  onLoad='…'  onerror=alert(1)
  html = html.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  // 3. Remove javascript: URIs inside attribute values
  //    Handles optional whitespace / casing / entity encoding of the colon
  html = html.replace(
    /(?<=\s(?:href|src|action|formaction|data|background)\s*=\s*["']?\s*)javascript\s*:/gi,
    "",
  );

  return html;
}
