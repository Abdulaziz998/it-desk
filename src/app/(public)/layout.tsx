export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(14,165,233,0.12),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(37,99,235,0.12),transparent_35%)]" />
      <main className="relative z-10 flex min-h-screen items-center justify-center p-4">{children}</main>
    </div>
  );
}
