'use client';

import { useQuery } from '@tanstack/react-query';
import {
  InboxIcon,
  ClockIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type { ApiResponse } from '@oias/types';
import { StatCard } from '@/components/dashboard/stat-card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardStats {
  totalNew: number;
  totalInProgress: number;
  totalOverdue: number;
  resolvedToday: number;
}

interface BacklogAgent {
  assigneeId: string;
  assigneeName: string;
  openTickets: number;
  highPriority: number;
  overdue: number;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function DashboardPage() {
  const stats = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => apiFetch<ApiResponse<DashboardStats>>('/dashboard/stats'),
  });

  const backlog = useQuery({
    queryKey: ['dashboard', 'backlog'],
    queryFn: () => apiFetch<ApiResponse<BacklogAgent[]>>('/dashboard/backlog'),
  });

  const s = stats.data?.data;

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of your operations queue
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.isLoading ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-20" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <StatCard
              icon={InboxIcon}
              label="New Tickets"
              value={s?.totalNew}
            />
            <StatCard
              icon={ClockIcon}
              label="In Progress"
              value={s?.totalInProgress}
            />
            <StatCard
              icon={AlertTriangleIcon}
              label="Overdue"
              value={s?.totalOverdue}
              variant="danger"
            />
            <StatCard
              icon={CheckCircleIcon}
              label="Resolved Today"
              value={s?.resolvedToday}
              variant="success"
            />
          </>
        )}
      </div>

      {/* Backlog by agent */}
      <Card>
        <CardHeader>
          <CardTitle>Backlog by Agent</CardTitle>
          <CardDescription>Open ticket distribution across your team</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {backlog.isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-4 w-10" />
                </div>
              ))}
            </div>
          ) : !backlog.data?.data?.length ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
              <InboxIcon className="h-8 w-8 opacity-40" />
              <p className="text-sm">No agents have open tickets</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                  <TableHead className="text-right">High Priority</TableHead>
                  <TableHead className="text-right">Overdue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backlog.data.data.map((agent) => (
                  <TableRow key={agent.assigneeId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-xs">
                            {getInitials(agent.assigneeName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{agent.assigneeName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm">{agent.openTickets}</TableCell>
                    <TableCell className="text-right text-sm">{agent.highPriority}</TableCell>
                    <TableCell className="text-right">
                      {agent.overdue > 0 ? (
                        <Badge variant="destructive" className="ml-auto">
                          {agent.overdue}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
