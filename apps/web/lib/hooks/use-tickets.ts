'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { ApiResponse, PaginatedResponse, CreateTicket, ChangeStatus, AssignTicket } from '@oias/types';

interface Ticket {
  id: string;
  refNumber: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  categoryId: string | null;
  assigneeId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface TicketFilters {
  status?: string;
  priority?: string;
  assigneeId?: string;
  search?: string;
}

export function useTickets(filters: TicketFilters = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v);
  }

  return useQuery({
    queryKey: ['tickets', filters],
    queryFn: () => apiFetch<PaginatedResponse<Ticket>>(`/tickets?${params.toString()}`),
  });
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: ['ticket', id],
    queryFn: () => apiFetch<ApiResponse<Ticket>>(`/tickets/${id}`),
    enabled: !!id,
  });
}

export function useTicketHistory(id: string) {
  return useQuery({
    queryKey: ['ticket', id, 'history'],
    queryFn: () => apiFetch<ApiResponse<unknown[]>>(`/tickets/${id}/history`),
    enabled: !!id,
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTicket) =>
      apiFetch<ApiResponse<Ticket>>('/tickets', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets'] }),
  });
}

export function useUpdateTicket(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiFetch<ApiResponse<Ticket>>(`/tickets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', id] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useChangeStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ChangeStatus) =>
      apiFetch(`/tickets/${id}/status`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', id] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['ticket', id, 'history'] });
    },
  });
}

export function useAssignTicket(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AssignTicket) =>
      apiFetch(`/tickets/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', id] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}
