import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchRunEvents, Event } from '@/lib/api';
import { useEffect, useRef, useCallback } from 'react';

const TERMINAL_STATES = ['COMPLETED', 'FAILED', 'STOPPED'];
const FAST_INTERVAL = Number(process.env.NEXT_PUBLIC_POLLING_INTERVAL_FAST) || 1500;

export interface UseRunEventsQueryOptions {
  enabled?: boolean;
  runStatus?: string;
  maxBuffer?: number;
}

/**
 * Custom hook for fetching and managing run events with incremental updates
 * Uses React Query with custom merge logic to preserve existing events
 */
export function useRunEventsQuery(
  runId: number | null,
  options: UseRunEventsQueryOptions = {}
) {
  const { enabled = true, runStatus, maxBuffer = 1000 } = options;
  const queryClient = useQueryClient();
  
  // Track the highest event ID we've seen for incremental fetching
  const cursorRef = useRef<number>(0);
  const seenIdsRef = useRef<Set<number>>(new Set());
  const prevStatusRef = useRef<string | undefined>(undefined);

  // Reset cursor and seen IDs when runId changes
  useEffect(() => {
    cursorRef.current = 0;
    seenIdsRef.current = new Set();
  }, [runId]);

  const query = useQuery({
    queryKey: ['events', runId],
    queryFn: async ({ signal }) => {
      if (!runId) return [];
      
      // Fetch new events using cursor for incremental loading
      const newEvents = await fetchRunEvents(runId, cursorRef.current, signal);
      
      // Get existing events from cache
      const existingEvents = queryClient.getQueryData<Event[]>(['events', runId]) || [];
      
      // Deduplicate within newEvents themselves
      const uniqueNewEvents = Array.from(
        new Map(newEvents.map(event => [event.id, event])).values()
      );
      
      // Filter out already seen events
      const unseenEvents = uniqueNewEvents.filter(event => !seenIdsRef.current.has(event.id));
      
      // Mark new events as seen
      unseenEvents.forEach(event => seenIdsRef.current.add(event.id));
      
      // Merge with existing events
      const allEvents = [...existingEvents, ...unseenEvents];
      
      // Sort by (created_at, id) for monotonic ordering
      allEvents.sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return a.id - b.id;
      });
      
      // Update cursor to highest ID seen
      if (newEvents.length > 0) {
        cursorRef.current = newEvents.reduce((max, e) => Math.max(max, e.id), cursorRef.current);
      }
      
      // Enforce max buffer
      if (allEvents.length > maxBuffer) {
        const removed = allEvents.slice(0, allEvents.length - maxBuffer);
        removed.forEach(event => seenIdsRef.current.delete(event.id));
        return allEvents.slice(-maxBuffer);
      }
      
      return allEvents;
    },
    enabled: enabled && runId != null,
    staleTime: 2000,
    // CRITICAL: Keep previous data to avoid clearing events during refetch
    placeholderData: (previousData) => previousData,
    // Adaptive polling based on run status
    refetchInterval: (query) => {
      // Stop polling if run is in terminal state
      if (runStatus && TERMINAL_STATES.includes(runStatus)) {
        return false;
      }
      
      // Fast polling for active runs
      return FAST_INTERVAL;
    },
    // Don't refetch on mount to avoid duplicate initial fetch
    refetchOnMount: false,
  });

  // Handle terminal state transition - fetch final events
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = runStatus;

    const becameTerminal =
      runStatus &&
      TERMINAL_STATES.includes(runStatus) &&
      prev &&
      !TERMINAL_STATES.includes(prev);

    if (becameTerminal && enabled && runId != null) {
      // One last refetch to catch final events
      query.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runStatus, enabled, runId]); // Intentionally not including query to avoid excess reruns

  return {
    events: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
