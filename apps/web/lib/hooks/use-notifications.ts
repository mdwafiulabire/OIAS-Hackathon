'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { PaginatedResponse } from '@oias/types';

interface Notification {
  id: string;
  channel: string;
  subject: string | null;
  body: string;
  status: string;
  relatedType: string | null;
  relatedId: string | null;
  readAt: string | null;
  createdAt: string;
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiFetch<PaginatedResponse<Notification>>('/notifications?limit=20'),
    refetchInterval: 30000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
