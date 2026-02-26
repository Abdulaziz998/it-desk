export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, code = "APP_ERROR", status = 500, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function asAppError(error: unknown, fallback = "Unexpected error") {
  if (error instanceof AppError) return error;
  if (error instanceof Error) {
    return new AppError(error.message, "UNEXPECTED_ERROR", 500);
  }
  return new AppError(fallback, "UNEXPECTED_ERROR", 500, error);
}

export function assertCondition(condition: unknown, message: string, code = "BAD_REQUEST", status = 400): asserts condition {
  if (!condition) {
    throw new AppError(message, code, status);
  }
}
