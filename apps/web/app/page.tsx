import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold">OIAS</h1>
      <p className="text-[var(--muted-foreground)]">
        Operational Intelligence and Automation System
      </p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded-lg bg-[var(--primary)] px-6 py-2 text-[var(--primary-foreground)] hover:opacity-90"
        >
          Login
        </Link>
      </div>
    </div>
  );
}
