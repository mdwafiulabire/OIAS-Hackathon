import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns a human-readable relative time string using Intl.RelativeTimeFormat.
 * No external deps — pure browser/Node Intl API.
 * @example formatRelativeTime('2024-01-01T00:00:00Z') → "3 days ago"
 */
export function formatRelativeTime(date: string | Date): string {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = then - now;
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHr = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHr / 24);
  const diffWk = Math.round(diffDay / 7);
  const diffMo = Math.round(diffDay / 30);
  const diffYr = Math.round(diffDay / 365);

  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, 'second');
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
  if (Math.abs(diffHr) < 24) return rtf.format(diffHr, 'hour');
  if (Math.abs(diffDay) < 7) return rtf.format(diffDay, 'day');
  if (Math.abs(diffWk) < 5) return rtf.format(diffWk, 'week');
  if (Math.abs(diffMo) < 12) return rtf.format(diffMo, 'month');
  return rtf.format(diffYr, 'year');
}
