import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  trend?: { value: number; positive?: boolean };
  variant?: 'default' | 'danger' | 'success';
}

const ICON_VARIANTS: Record<NonNullable<StatCardProps['variant']>, string> = {
  default: 'bg-muted text-muted-foreground',
  danger: 'bg-destructive/10 text-destructive',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

const VALUE_VARIANTS: Record<NonNullable<StatCardProps['variant']>, string> = {
  default: 'text-foreground',
  danger: 'text-destructive',
  // accent color approved in PM decision: emerald for resolved-today
  success: 'text-emerald-500 dark:text-emerald-400',
};

export function StatCard({ icon: Icon, label, value, trend, variant = 'default' }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 pb-2">
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', ICON_VARIANTS[variant])}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </CardHeader>
      <CardContent className="pt-0">
        <p className={cn('text-3xl font-bold tracking-tight', VALUE_VARIANTS[variant])}>
          {value ?? '—'}
        </p>
        {trend !== undefined && (
          <p className={cn(
            'mt-1 flex items-center gap-1 text-xs font-medium',
            trend.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
          )}>
            {trend.positive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {Math.abs(trend.value)}%
          </p>
        )}
      </CardContent>
    </Card>
  );
}
