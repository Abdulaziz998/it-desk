"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

export function ErrorListener() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      logger.error("Client runtime error", event.error, {
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        col: event.colno,
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      logger.error("Unhandled promise rejection", event.reason);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
