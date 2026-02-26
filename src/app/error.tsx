"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logger.error("Unhandled route error", error, {
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-lg rounded-xl border border-rose-200 bg-rose-50 p-6">
        <h2 className="text-xl font-semibold text-rose-900">Something went wrong</h2>
        <p className="mt-2 text-sm text-rose-700">The error has been logged. You can retry this page.</p>
        <Button className="mt-4" onClick={() => reset()}>
          Retry
        </Button>
      </div>
    </div>
  );
}
