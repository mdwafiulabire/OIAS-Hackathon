import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Status = 'new' | 'assigned' | 'in_progress' | 'resolved' | 'closed';

const STATUS_STYLES: Record<Status, string> = {
  new: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  assigned: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  in_progress: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  resolved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  closed: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
};

const STATUS_LABELS: Record<Status, string> = {
  new: 'New',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

interface StatusBadgeProps {
  status: Status | string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const s = status as Status;
  return (
    <Badge
      variant="outline"
      className={cn(STATUS_STYLES[s] ?? 'bg-muted text-muted-foreground border-border')}
    >
      {STATUS_LABELS[s] ?? status}
    </Badge>
  );
}
