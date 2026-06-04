'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { ApiResponse } from '@oias/types';

export interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  plan: string;
  timezone: string;
}

export interface PluginInfo {
  id: string;
  pluginKey: string;
  isEnabled: boolean;
  config: Record<string, unknown>;
}

export interface CategoryInfo {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
}

export function useOrganisation() {
  return useQuery({
    queryKey: ['settings', 'org'],
    queryFn: () => apiFetch<ApiResponse<OrgInfo>>('/settings/org'),
  });
}

export function useUpdateOrganisation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<OrgInfo>) =>
      apiFetch<ApiResponse<OrgInfo>>('/settings/org', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'org'] }),
  });
}

export function usePlugins() {
  return useQuery({
    queryKey: ['settings', 'plugins'],
    queryFn: () => apiFetch<ApiResponse<PluginInfo[]>>('/settings/plugins'),
  });
}

export function useTogglePlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) =>
      apiFetch(`/settings/plugins/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isEnabled }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'plugins'] }),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => apiFetch<ApiResponse<CategoryInfo[]>>('/categories'),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; color?: string }) =>
      apiFetch<ApiResponse<CategoryInfo>>('/categories', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}
