import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ErrorListener } from "@/components/error-listener";

export const metadata: Metadata = {
  title: "IT OpsDesk",
  description: "Multi-tenant IT operations and service desk SaaS MVP",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const showDemoBanner = process.env.APP_ENV === "production" && process.env.DEMO_MODE === "true";

  return (
    <html lang="en">
      <body className={`antialiased ${showDemoBanner ? "pt-10" : ""}`}>
        <Providers>
          <ErrorListener />
          {showDemoBanner ? (
            <div className="fixed inset-x-0 top-0 z-50 border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900">
              Demo mode: sample data environment.
            </div>
          ) : null}
          {children}
        </Providers>
      </body>
    </html>
  );
}
