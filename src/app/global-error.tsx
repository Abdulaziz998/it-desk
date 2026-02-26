"use client";

export default function GlobalError() {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen items-center justify-center">
          <div className="rounded-xl border border-rose-300 bg-rose-50 p-6">
            <h1 className="text-lg font-semibold text-rose-800">Fatal application error</h1>
            <p className="mt-2 text-sm text-rose-700">Restart the app and review server logs.</p>
          </div>
        </div>
      </body>
    </html>
  );
}
