'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { PaginatedResponse } from '@oias/types';

import { Loader2 } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useUsers } from '@/lib/hooks/use-users';
import { formatRelativeTime } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuditEntry {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  payload: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const COMMON_ACTIONS = [
  'ticket.created',
  'ticket.updated',
  'ticket.status_changed',
  'ticket.assigned',
  'ticket.reassigned',
  'ticket.resolved',
  'ticket.closed',
  'ticket.reopened',
  'note.created',
  'user.created',
  'user.deactivated',
  'ai.suggestion_created',
  'ai.suggestion_accepted',
  'ai.suggestion_dismissed',
];

const ACTION_BADGE_CLASS: Record<string, string> = {
  'ticket.created': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  'ticket.status_changed': 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  'ticket.assigned': 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  'ticket.reassigned': 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  'ticket.closed': 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  'ticket.resolved': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  'user.deactivated': 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  'user.created': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
};

function actionBadgeClass(action: string): string {
  return ACTION_BADGE_CLASS[action] ?? 'bg-muted text-muted-foreground border-border';
}

// ─── Skeleton Rows ────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {[...Array(8)].map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell><Skeleton className="h-5 w-36 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-28 font-mono" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const [cursor, setCursor] = useState<string | null>(null);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  const { data: usersData } = useUsers();
  const usersMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of usersData?.data ?? []) {
      m.set(u.id, u.fullName);
    }
    return m;
  }, [usersData]);

  const query = useQuery({
    queryKey: ['audit', cursor],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '50' });
      if (cursor) params.set('cursor', cursor);
      const res = await apiFetch<PaginatedResponse<AuditEntry>>(`/audit?${params.toString()}`);
      // Accumulate entries across pages
      setEntries((prev) => {
        const existingIds = new Set(prev.map((e) => e.id));
        const newEntries = (res.data ?? []).filter((e) => !existingIds.has(e.id));
        return cursor ? [...prev, ...newEntries] : (res.data ?? []);
      });
      return res;
    },
  });

  const nextCursor = query.data?.meta?.nextCursor ?? null;

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesAction = !actionFilter || entry.action === actionFilter;
      const matchesSearch =
        !search ||
        entry.action.toLowerCase().includes(search.toLowerCase()) ||
        entry.entityType.toLowerCase().includes(search.toLowerCase()) ||
        (entry.entityId ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (entry.actorId ? (usersMap.get(entry.actorId) ?? entry.actorId) : '').toLowerCase().includes(search.toLowerCase());
      return matchesAction && matchesSearch;
    });
  }, [entries, actionFilter, search, usersMap]);

  function handleActionFilterChange(value: string) {
    setActionFilter(value === '_all' ? '' : value);
  }

  function truncateId(id: string): string {
    return id.slice(0, 8);
  }

  function truncatePayload(payload: Record<string, unknown>): string {
    const str = JSON.stringify(payload);
    return str.length > 60 ? str.slice(0, 60) + '…' : str;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Audit Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Immutable history of every action in your workspace.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search actions, entities, actors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select onValueChange={handleActionFilterChange} defaultValue="_all">
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All actions</SelectItem>
            {COMMON_ACTIONS.map((action) => (
              <SelectItem key={action} value={action}>
                {action}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Payload</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading ? (
                <SkeletonRows />
              ) : filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No audit entries yet.
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((entry) => {
                  const actorName = entry.actorId
                    ? (usersMap.get(entry.actorId) ?? truncateId(entry.actorId))
                    : '—';
                  const payloadStr = truncatePayload(entry.payload ?? {});
                  const payloadFull = JSON.stringify(entry.payload ?? {}, null, 2);

                  return (
                    <TableRow key={entry.id}>
                      <TableCell
                        className="whitespace-nowrap text-sm"
                        title={new Date(entry.createdAt).toISOString()}
                      >
                        {formatRelativeTime(entry.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={actionBadgeClass(entry.action)}>
                          {entry.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {entry.entityType}
                          {entry.entityId && (
                            <span className="ml-1">#{truncateId(entry.entityId)}</span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{actorName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {entry.ipAddress ?? '—'}
                      </TableCell>
                      <TableCell
                        className="max-w-[200px] truncate font-mono text-xs text-muted-foreground"
                        title={payloadFull}
                      >
                        {payloadStr}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Load more */}
      {nextCursor && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setCursor(nextCursor)}
            disabled={query.isFetching}
          >
            {query.isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
