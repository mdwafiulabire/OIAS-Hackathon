import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Priority = 'low' | 'medium' | 'high' | 'urgent';

const PRIORITY_STYLES: Record<Priority, string> = {
  low: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  medium: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  high: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  urgent: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 font-semibold',
};

const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

interface PriorityBadgeProps {
  priority: Priority | string;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const p = priority as Priority;
  return (
    <Badge
      variant="outline"
      className={cn(PRIORITY_STYLES[p] ?? 'bg-muted text-muted-foreground border-border')}
    >
      {PRIORITY_LABELS[p] ?? priority}
    </Badge>
  );
}
