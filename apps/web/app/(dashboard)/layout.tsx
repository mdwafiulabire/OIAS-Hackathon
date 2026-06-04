import { Sidebar } from '@/components/layout/sidebar';
import { AuthGuard } from '@/components/auth/auth-guard';
import { ThemeToggle } from '@/components/theme-toggle';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top bar */}
          <header className="flex h-14 shrink-0 items-center justify-end border-b border-border bg-background px-6">
            <ThemeToggle />
          </header>
          {/* Main scroll area */}
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
