type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const isProduction = process.env.NODE_ENV === "production";

function getConfiguredLevel(): LogLevel {
  const env = process.env.LOG_LEVEL?.toLowerCase();
  if (env && env in LOG_LEVELS) {
    return env as LogLevel;
  }
  return isProduction ? "info" : "debug";
}

const minLevel = getConfiguredLevel();

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[minLevel];
}

function formatDev(entry: LogEntry): string {
  const tag = `[${entry.level.toUpperCase()}]`;
  const ctx =
    entry.context && Object.keys(entry.context).length > 0
      ? " " + JSON.stringify(entry.context)
      : "";
  return `${tag} ${entry.timestamp} ${entry.message}${ctx}`;
}

function formatProd(entry: LogEntry): string {
  return JSON.stringify(entry);
}

const format = isProduction ? formatProd : formatDev;

function write(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (context !== undefined) {
    entry.context = context;
  }

  const line = format(entry);

  if (level === "error") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>): void {
    write("debug", message, context);
  },
  info(message: string, context?: Record<string, unknown>): void {
    write("info", message, context);
  },
  warn(message: string, context?: Record<string, unknown>): void {
    write("warn", message, context);
  },
  error(message: string, context?: Record<string, unknown>): void {
    write("error", message, context);
  },
} as const;

export default logger;
