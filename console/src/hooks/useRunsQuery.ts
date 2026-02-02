import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchRuns, Run } from '@/lib/api';
import { useEffect } from 'react';

const ACTIVE_STATES = ['QUEUED', 'RUNNING', 'PAUSED'];
const FAST_INTERVAL = Number(process.env.NEXT_PUBLIC_POLLING_INTERVAL_FAST) || 1500;
const SLOW_INTERVAL = 5000;

export interface UseRunsOptions {
  enabled?: boolean;
}

export function useRuns(options: UseRunsOptions = {}) {
  const { enabled = true } = options;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['runs'],
    queryFn: ({ signal }) => fetchRuns(signal),
    enabled,
    staleTime: 2000,
    // Keep previous data to avoid blank screens during refetch
    placeholderData: (previousData) => previousData,
    // Adaptive polling based on active runs
    refetchInterval: (query) => {
      const data = query.state.data as Run[] | undefined;
      if (!data) return false;
      
      // Fast polling if any runs are active
      const hasActiveRuns = data.some(run => ACTIVE_STATES.includes(run.status));
      return hasActiveRuns ? FAST_INTERVAL : SLOW_INTERVAL;
    },
  });

  // Helper to get filtered runs
  const getFilteredRuns = (filter?: 'active') => {
    if (!query.data) return [];
    if (filter === 'active') {
      return query.data.filter(run => ACTIVE_STATES.includes(run.status));
    }
    return query.data;
  };

  // Count active runs
  const activeCount = query.data?.filter(r => ACTIVE_STATES.includes(r.status)).length || 0;

  return {
    runs: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    getFilteredRuns,
    activeCount,
  };
}
