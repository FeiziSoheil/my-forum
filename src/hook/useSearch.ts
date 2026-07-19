'use client';

import { api } from '@/lib/api/axios';
import { ChatUser } from '@/types/chat';
import { useQuery } from '@tanstack/react-query';

export function useSearchUsers(q: string, enabled = true) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: ['search-users', trimmed],
    queryFn: async () => {
      const res = await api.get('/users/search', { params: { q: trimmed } });
      return (res.data.users || []) as ChatUser[];
    },
    enabled: enabled && trimmed.length >= 1,
  });
}

export function useSearchTags(q: string, enabled = true) {
  const trimmed = q.trim().toLowerCase();
  return useQuery({
    queryKey: ['search-tags', trimmed],
    queryFn: async () => {
      const res = await api.get('/tags/suggest', {
        params: { q: trimmed, limit: 20 },
      });
      return (res.data.tags || []) as string[];
    },
    enabled,
  });
}
