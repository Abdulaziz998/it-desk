export type LogLevel = "info" | "warn" | "error";

type LogMeta = Record<string, unknown>;

type SerializedError = {
  name?: string;
  message?: string;
  stack?: string;
};

function serializeError(error: unknown): SerializedError | undefined {
  if (!error) return undefined;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return { message: String(error) };
}

function write(level: LogLevel, message: string, meta?: LogMeta) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    app: "it-opsdesk",
    runtime: typeof window === "undefined" ? "server" : "client",
    message,
    ...meta,
  };

  const payload = JSON.stringify(entry);
  if (level === "error") {
    console.error(payload);
    return;
  }
  if (level === "warn") {
    console.warn(payload);
    return;
  }
  console.log(payload);
}

export const logger = {
  info(message: string, meta?: LogMeta) {
    write("info", message, meta);
  },
  warn(message: string, meta?: LogMeta) {
    write("warn", message, meta);
  },
  error(message: string, error?: unknown, meta?: LogMeta) {
    write("error", message, {
      ...meta,
      error: serializeError(error),
    });
  },
};
