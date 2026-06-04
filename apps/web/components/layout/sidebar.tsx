'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Ticket,
  Users,
  ScrollText,
  Settings,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { signOut, useSession } from '@/lib/auth-client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Tickets', href: '/tickets', icon: Ticket },
  { label: 'Users', href: '/users', icon: Users },
  { label: 'Audit Log', href: '/audit', icon: ScrollText },
  { label: 'Settings', href: '/settings', icon: Settings },
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const userName = session?.user?.name ?? '';
  const userEmail = session?.user?.email ?? '';
  const initials = userName ? getInitials(userName) : '?';

  async function handleSignOut() {
    await signOut();
    queryClient.clear();
    router.replace('/login');
  }

  return (
    <aside className="flex w-60 flex-col border-r border-border bg-sidebar">
      {/* Brand block */}
      <div className="px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold select-none">
            OI
          </div>
          <div>
            <div className="text-sm font-bold leading-none text-sidebar-foreground">OIAS</div>
            <div className="text-[10px] leading-tight text-muted-foreground mt-0.5">
              Operations Intelligence
            </div>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex flex-1 flex-col gap-0.5 px-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-sidebar-foreground">
                  {userName}
                </div>
                {userEmail && (
                  <div className="truncate text-xs text-muted-foreground">{userEmail}</div>
                )}
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-52">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{userName}</p>
              {userEmail && (
                <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
