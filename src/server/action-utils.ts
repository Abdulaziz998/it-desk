"use server";

import { asAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

export async function runSafeAction<T>(actionName: string, handler: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await handler();
    return { ok: true, data };
  } catch (error) {
    const appError = asAppError(error);
    logger.error(`Server action failed: ${actionName}`, error, {
      code: appError.code,
      status: appError.status,
    });
    return {
      ok: false,
      error: appError.message,
      code: appError.code,
    };
  }
}
