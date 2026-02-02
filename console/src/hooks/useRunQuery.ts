import { useQuery } from '@tanstack/react-query';
import { fetchRun, Run } from '@/lib/api';

const TERMINAL_STATES = ['COMPLETED', 'FAILED', 'STOPPED'];
const FAST_INTERVAL = Number(process.env.NEXT_PUBLIC_POLLING_INTERVAL_FAST) || 1500;

export interface UseRunQueryOptions {
  enabled?: boolean;
}

export function useRunQuery(runId: number | null, options: UseRunQueryOptions = {}) {
  const { enabled = true } = options;

  const query = useQuery({
    queryKey: ['run', runId],
    queryFn: ({ signal }) => fetchRun(runId!, signal),
    enabled: enabled && runId != null,
    staleTime: 2000,
    // Keep previous data to avoid blank screens during refetch
    placeholderData: (previousData) => previousData,
    // Adaptive polling based on run status
    refetchInterval: (query) => {
      const data = query.state.data as Run | undefined;
      if (!data) return false;
      
      // Stop polling if run is in terminal state
      if (TERMINAL_STATES.includes(data.status)) {
        return false;
      }
      
      // Fast polling for active runs
      return FAST_INTERVAL;
    },
  });

  const run = query.data;

  return {
    run,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    // Helper flags
    isTerminal: run ? TERMINAL_STATES.includes(run.status) : false,
    isActive: run ? ['QUEUED', 'RUNNING'].includes(run.status) : false,
    isPaused: run?.status === 'PAUSED',
    isStopped: run?.status === 'STOPPED',
    isCompleted: run?.status === 'COMPLETED',
    isFailed: run?.status === 'FAILED',
  };
}
