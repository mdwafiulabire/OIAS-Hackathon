'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, MoreVertical } from 'lucide-react';

import { useTicket, useTicketHistory, useChangeStatus, useAssignTicket } from '@/lib/hooks/use-tickets';
import { useNotes } from '@/lib/hooks/use-notes';
import { useUsers } from '@/lib/hooks/use-users';
import { NoteList } from '@/components/tickets/note-list';
import { NoteComposer } from '@/components/tickets/note-composer';
import { StatusBadge } from '@/components/tickets/status-badge';
import { PriorityBadge } from '@/components/tickets/priority-badge';
import { formatRelativeTime } from '@/lib/utils';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatusHistoryEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  actorId: string;
  reason: string | null;
  durationSeconds: number | null;
  createdAt: string;
}

const STATUS_OPTIONS = ['new', 'assigned', 'in_progress', 'resolved', 'closed'] as const;
type TicketStatus = (typeof STATUS_OPTIONS)[number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function labelStatus(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Status change dialog
// ---------------------------------------------------------------------------

interface StatusDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticketId: string;
  currentStatus: string;
}

function StatusDialog({ open, onOpenChange, ticketId, currentStatus }: StatusDialogProps) {
  const [status, setStatus] = useState<TicketStatus>(currentStatus as TicketStatus);
  const [reason, setReason] = useState('');
  const changeStatus = useChangeStatus(ticketId);

  const handleSubmit = () => {
    changeStatus.mutate(
      { status, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Status updated');
          onOpenChange(false);
          setReason('');
        },
        onError: (err) => {
          toast.error(err.message ?? 'Failed to update status');
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change status</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Select value={status} onValueChange={(v) => setStatus(v as TicketStatus)}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {labelStatus(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for change (optional)"
            rows={3}
            className="resize-none"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={changeStatus.isPending}>
            {changeStatus.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Assign dialog
// ---------------------------------------------------------------------------

interface AssignDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticketId: string;
}

function AssignDialog({ open, onOpenChange, ticketId }: AssignDialogProps) {
  const [assigneeId, setAssigneeId] = useState<string>('__unassigned__');
  const users = useUsers();
  const assignTicket = useAssignTicket(ticketId);

  const handleSubmit = () => {
    assignTicket.mutate(
      { assigneeId: assigneeId === '__unassigned__' ? null : assigneeId },
      {
        onSuccess: () => {
          toast.success('Ticket assigned');
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(err.message ?? 'Failed to assign ticket');
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign ticket</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger>
              <SelectValue placeholder="Select assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__unassigned__">Unassigned</SelectItem>
              {users.data?.data?.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={assignTicket.isPending}>
            {assignTicket.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loading state
// ---------------------------------------------------------------------------

function TicketDetailSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-8 w-3/4 mt-2" />
          <Skeleton className="h-4 w-full mt-2" />
          <div className="flex gap-2 mt-4">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </CardHeader>
      </Card>
      <Skeleton className="h-10 w-64" />
      <Card>
        <CardContent className="pt-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  const ticketQuery = useTicket(id);
  const notesQuery = useNotes(id);
  const historyQuery = useTicketHistory(id);

  const t = ticketQuery.data?.data;
  const notes = (notesQuery.data?.data ?? []) as Array<{
    id: string;
    body: string;
    isInternal: boolean;
    authorId: string;
    authorName?: string;
    createdAt: string;
  }>;
  const history = (historyQuery.data?.data ?? []) as StatusHistoryEntry[];

  // Loading state
  if (ticketQuery.isLoading) {
    return <TicketDetailSkeleton />;
  }

  // 404 / error state
  if (!t) {
    return (
      <div className="mx-auto max-w-4xl flex flex-col items-center justify-center py-24 text-center gap-4">
        <p className="text-xl font-semibold">Ticket not found</p>
        <p className="text-sm text-muted-foreground">
          This ticket may have been deleted or you may not have access.
        </p>
        <Button variant="outline" onClick={() => router.push('/tickets')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to tickets
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back link */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-muted-foreground"
        onClick={() => router.push('/tickets')}
      >
        <ArrowLeft className="h-4 w-4" />
        Tickets
      </Button>

      {/* Header card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Ref badge + type */}
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="font-mono text-xs">
                  {t.refNumber}
                </Badge>
                <span className="text-xs text-muted-foreground capitalize">{t.type}</span>
              </div>
              {/* Title */}
              <h1 className="text-2xl font-semibold tracking-tight truncate">{t.title}</h1>
              {/* Description */}
              {t.description && (
                <p className="mt-1.5 text-sm text-muted-foreground whitespace-pre-wrap">
                  {t.description}
                </p>
              )}
              {/* Badges row */}
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <StatusBadge status={t.status} />
                <PriorityBadge priority={t.priority} />
                {t.assigneeId && (
                  <div className="flex items-center gap-1.5">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[10px]">
                        {t.assigneeId.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">Assigned</span>
                  </div>
                )}
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(t.createdAt)}
                </span>
              </div>
            </div>

            {/* Actions dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setStatusDialogOpen(true)}>
                  Change status
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAssignDialogOpen(true)}>
                  Assign…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>Edit (coming soon)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="notes">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Details tab */}
        <TabsContent value="details" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <div>
                  <dt className="text-muted-foreground font-medium mb-0.5">Type</dt>
                  <dd className="capitalize">{t.type}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-medium mb-0.5">Status</dt>
                  <dd>
                    <StatusBadge status={t.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-medium mb-0.5">Priority</dt>
                  <dd>
                    <PriorityBadge priority={t.priority} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-medium mb-0.5">Category</dt>
                  <dd className="text-muted-foreground">{t.categoryId ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-medium mb-0.5">Assignee</dt>
                  <dd className="text-muted-foreground">{t.assigneeId ?? 'Unassigned'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-medium mb-0.5">Created</dt>
                  <dd>{new Date(t.createdAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-medium mb-0.5">Last updated</dt>
                  <dd>{new Date(t.updatedAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-medium mb-0.5">Ticket ID</dt>
                  <dd className="font-mono text-xs text-muted-foreground">{t.id}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes tab */}
        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {notesQuery.isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <NoteList notes={notes} />
                  <Separator className="my-4" />
                  <NoteComposer ticketId={id} />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History tab */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {historyQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : history.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No status history yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-muted-foreground">
                          {entry.fromStatus ? labelStatus(entry.fromStatus) : '—'}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={entry.toStatus} />
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">
                          {entry.reason ?? '—'}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground text-sm">
                          {formatRelativeTime(entry.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <StatusDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        ticketId={id}
        currentStatus={t.status}
      />
      <AssignDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        ticketId={id}
      />
    </div>
  );
}
