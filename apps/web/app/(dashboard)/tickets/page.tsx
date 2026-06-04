'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { PlusIcon, SearchIcon, InboxIcon, MoreHorizontalIcon } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type { PaginatedResponse } from '@oias/types';
import { useUsers } from '@/lib/hooks/use-users';
import { StatusBadge } from '@/components/tickets/status-badge';
import { PriorityBadge } from '@/components/tickets/priority-badge';
import { formatRelativeTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Ticket {
  id: string;
  refNumber: string;
  title: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  createdAt: string;
}

/** Simple debounce hook — no extra deps */
function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
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

// Sentinel value for "all" options — avoids empty-string in Select
const ALL_SENTINEL = '__all__';

export default function TicketsPage() {
  const [searchRaw, setSearchRaw] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL_SENTINEL);
  const [priorityFilter, setPriorityFilter] = useState(ALL_SENTINEL);
  // Cursor pagination: collect tickets across pages
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const prevFiltersRef = useRef({ searchRaw, statusFilter, priorityFilter });

  const search = useDebounce(searchRaw, 300);

  // Reset pagination whenever filters change
  useEffect(() => {
    const prev = prevFiltersRef.current;
    if (
      prev.searchRaw !== searchRaw ||
      prev.statusFilter !== statusFilter ||
      prev.priorityFilter !== priorityFilter
    ) {
      prevFiltersRef.current = { searchRaw, statusFilter, priorityFilter };
      setCursor(null);
      setAllTickets([]);
      setNextCursor(null);
    }
  }, [searchRaw, statusFilter, priorityFilter]);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter !== ALL_SENTINEL) params.set('status', statusFilter);
    if (priorityFilter !== ALL_SENTINEL) params.set('priority', priorityFilter);
    if (cursor) params.set('cursor', cursor);
    params.set('limit', '20');
    return params.toString();
  }, [search, statusFilter, priorityFilter, cursor]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['tickets', search, statusFilter, priorityFilter, cursor],
    queryFn: () => apiFetch<PaginatedResponse<Ticket>>(`/tickets?${buildParams()}`),
  });

  // Accumulate pages
  useEffect(() => {
    if (!data?.data) return;
    if (cursor === null) {
      // Fresh query — replace
      setAllTickets(data.data);
    } else {
      // Load-more append
      setAllTickets((prev) => [...prev, ...data.data]);
    }
    setNextCursor(data.meta.nextCursor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const users = useUsers();
  const userMap = new Map(
    (users.data?.data ?? []).map((u) => [u.id, u]),
  );

  const showLoadMore = nextCursor !== null;
  const isEmpty = !isLoading && allTickets.length === 0;

  return (
    <div className="space-y-6">
      {/* Heading row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Tickets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage and track all support requests
          </p>
        </div>
        <Button asChild>
          <Link href="/tickets/new">
            <PlusIcon className="mr-2 h-4 w-4" />
            New Ticket
          </Link>
        </Button>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search with icon prefix */}
        <div className="relative min-w-56 flex-1">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search tickets..."
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SENTINEL}>All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>

        {/* Priority filter */}
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SENTINEL}>All Priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main table card */}
      <Card>
        <CardContent className="p-0">
          {isLoading && allTickets.length === 0 ? (
            /* Skeleton rows */
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Ref #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                  <TableHead className="w-28">Priority</TableHead>
                  <TableHead className="w-40">Assignee</TableHead>
                  <TableHead className="w-32">Created</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-full max-w-xs" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-7 w-7 rounded-full" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : isEmpty ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <InboxIcon className="h-10 w-10 text-muted-foreground opacity-40" />
              <div>
                <p className="text-sm font-medium text-foreground">No tickets yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create a ticket to start tracking requests
                </p>
              </div>
              <Button asChild size="sm" className="mt-2">
                <Link href="/tickets/new">
                  <PlusIcon className="mr-2 h-3.5 w-3.5" />
                  New Ticket
                </Link>
              </Button>
            </div>
          ) : (
            /* Data table */
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Ref #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                  <TableHead className="w-28">Priority</TableHead>
                  <TableHead className="w-40">Assignee</TableHead>
                  <TableHead className="w-32">Created</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {allTickets.map((ticket) => {
                  const assignee = ticket.assigneeId ? userMap.get(ticket.assigneeId) : null;
                  return (
                    <TableRow key={ticket.id}>
                      {/* Ref # */}
                      <TableCell>
                        <Link
                          href={`/tickets/${ticket.id}`}
                          className="font-mono text-xs text-primary hover:underline"
                        >
                          {ticket.refNumber}
                        </Link>
                      </TableCell>

                      {/* Title */}
                      <TableCell>
                        <Link
                          href={`/tickets/${ticket.id}`}
                          className="text-sm font-medium hover:underline line-clamp-1"
                        >
                          {ticket.title}
                        </Link>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <StatusBadge status={ticket.status} />
                      </TableCell>

                      {/* Priority */}
                      <TableCell>
                        <PriorityBadge priority={ticket.priority} />
                      </TableCell>

                      {/* Assignee */}
                      <TableCell>
                        {assignee ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {getInitials(assignee.fullName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm truncate max-w-[6rem]">{assignee.fullName}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>

                      {/* Created */}
                      <TableCell className="text-xs text-muted-foreground">
                        {formatRelativeTime(ticket.createdAt)}
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontalIcon className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/tickets/${ticket.id}`}>View</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>Assign</DropdownMenuItem>
                            <DropdownMenuItem>Change status</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Load more */}
          {showLoadMore && (
            <div className="flex justify-center border-t p-4">
              <Button
                variant="outline"
                size="sm"
                disabled={isFetching}
                onClick={() => setCursor(nextCursor)}
              >
                {isFetching ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
