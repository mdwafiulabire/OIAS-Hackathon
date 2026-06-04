'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { ApiResponse, PaginatedResponse, CreateNote } from '@oias/types';

interface Note {
  id: string;
  body: string;
  isInternal: boolean;
  isAiGenerated: boolean;
  authorId: string;
  createdAt: string;
}

export function useNotes(ticketId: string) {
  return useQuery({
    queryKey: ['ticket', ticketId, 'notes'],
    queryFn: () => apiFetch<PaginatedResponse<Note>>(`/tickets/${ticketId}/notes`),
    enabled: !!ticketId,
  });
}

export function useCreateNote(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateNote) =>
      apiFetch<ApiResponse<Note>>(`/tickets/${ticketId}/notes`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket', ticketId, 'notes'] }),
  });
}
