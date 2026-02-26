import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <h2 className="text-2xl font-semibold text-slate-900">Page not found</h2>
        <p className="mt-2 text-sm text-slate-600">The requested resource does not exist.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm font-medium text-sky-700 hover:text-sky-800">
          Return to dashboard
        </Link>
      </div>
    </div>
  );
}
