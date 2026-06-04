import type { ReactNode } from 'react';

interface AuthShellProps {
  children: ReactNode;
}

/**
 * Shared layout scaffold for all auth pages (login, register, forgot-password, etc.).
 * Server component — no client directive needed.
 * Provides: full-viewport centered column, brand mark at top, muted gradient background.
 */
export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-muted/20 to-muted/40 px-4 py-12">
      {/* Brand block */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
          <span className="text-lg font-bold tracking-tight">OI</span>
        </div>
        <div className="text-center">
          <p className="text-xl font-semibold tracking-tight text-foreground">OIAS</p>
          <p className="text-xs text-muted-foreground">Operations Intelligence &amp; Automation</p>
        </div>
      </div>

      {/* Auth card container */}
      <div className="w-full max-w-md">{children}</div>

      {/* Subtle footer */}
      <p className="mt-8 text-xs text-muted-foreground/60">
        &copy; {new Date().getFullYear()} OIAS. All rights reserved.
      </p>
    </div>
  );
}
