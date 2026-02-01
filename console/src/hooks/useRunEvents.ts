import { useEffect, useRef, useState, useCallback } from 'react';
import { withTimeout } from '@/lib/timeout';
import { TIMEOUTS } from '@/lib/timeouts';

interface Event {
  id: number;
  run_id: number;
  type: string;
  payload: string;
  created_at: string;
}

interface UseRunEventsOptions {
  enabled?: boolean;
  maxBuffer?: number;
  runStatus?: string;
}

const TERMINAL_STATES = ['COMPLETED', 'FAILED', 'STOPPED'];
const FAST_INTERVAL = Number(process.env.NEXT_PUBLIC_POLLING_INTERVAL_FAST) || 1500;
const MAX_BACKOFF = Number(process.env.NEXT_PUBLIC_POLLING_MAX_BACKOFF) || 30000;
const DEFAULT_MAX_BUFFER = Number(process.env.NEXT_PUBLIC_EVENT_MAX_BUFFER) || 1000;

/**
 * Hardened hook for incremental event streaming with cursor-based fetching,
 * deduplication, and automatic polling control based on run state.
 */
export function useRunEvents(runId: number | null, options: UseRunEventsOptions = {}) {
  const { enabled = true, maxBuffer = DEFAULT_MAX_BUFFER, runStatus } = options;

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorRef = useRef<number>(0); // Last event ID seen
  const seenIdsRef = useRef<Set<number>>(new Set());
  const errorCountRef = useRef<number>(0);
  const isVisibleRef = useRef<boolean>(true);
  const isMountedRef = useRef<boolean>(false);
  const eventsRef = useRef<Event[]>([]);
  const initialFetchDoneRef = useRef<boolean>(false); // Track if we've fetched at least once
  const inFlightRef = useRef<boolean>(false);
  const prevStatusRef = useRef<string | undefined>(undefined);

  const enabledRef = useRef(enabled);
  const runIdRef = useRef(runId);
  const forceFinalFetchRef = useRef(false);

  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { runIdRef.current = runId; }, [runId]);

  // Calculate next poll interval
  const getNextInterval = useCallback((): number => {
    // Stop polling if run is terminal
    if (runStatus && TERMINAL_STATES.includes(runStatus)) {
      return 0; // Don't poll
    }

    // Exponential backoff on errors
    if (errorCountRef.current > 0) {
      const backoff = Math.min(
        FAST_INTERVAL * Math.pow(2, errorCountRef.current - 1),
        MAX_BACKOFF
      );
      const jitter = backoff * 0.2 * (Math.random() - 0.5);
      return Math.floor(backoff + jitter);
    }

    return FAST_INTERVAL;
  }, [runStatus]);

  // Helper functions for cleanup
  const clearTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const abortInFlight = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  };

  const shouldRun = useCallback(() =>
    isMountedRef.current &&
    enabledRef.current &&
    runIdRef.current != null &&
    isVisibleRef.current &&
    !(runStatus && TERMINAL_STATES.includes(runStatus) && initialFetchDoneRef.current && !forceFinalFetchRef.current),
  [runStatus]);

  // Fetch events incrementally with timeout protection
  const fetchEvents = useCallback(async (signal: AbortSignal, afterId: number = 0): Promise<Event[]> => {
    const currentRunId = runIdRef.current;
    if (currentRunId == null) return [];

    const baseUrl = process.env.NEXT_PUBLIC_AGENT_RUNNER_URL || 'http://localhost:8000';
    const url = afterId > 0
      ? `${baseUrl}/runs/${currentRunId}/events?after_id=${afterId}`
      : `${baseUrl}/runs/${currentRunId}/events`;

    const { signal: s, cleanup } = withTimeout(signal, TIMEOUTS.events);
    try {
      const response = await fetch(url, { signal: s, cache: 'no-store' });

      if (!response.ok) {
        throw new Error(`Failed to fetch events: ${response.status}`);
      }

      return response.json();
    } finally {
      cleanup();
    }
  }, []);

  // Deduplicate and sort events
  const processEvents = useCallback((newEvents: Event[]): Event[] => {
    // First deduplicate within newEvents themselves (handles duplicates in same fetch)
    const uniqueNewEvents = Array.from(
      new Map(newEvents.map(event => [event.id, event])).values()
    );

    // Filter out already seen events from previous fetches
    const unseenEvents = uniqueNewEvents.filter(event => !seenIdsRef.current.has(event.id));

    // Mark new events as seen
    unseenEvents.forEach(event => seenIdsRef.current.add(event.id));

    // Merge with existing events from ref
    const allEvents = [...eventsRef.current, ...unseenEvents];

    // Sort by (created_at, id) for monotonic ordering across shards
    allEvents.sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return a.id - b.id;
    });

    // Enforce max buffer (keep last N events)
    if (allEvents.length > maxBuffer) {
      const removed = allEvents.slice(0, allEvents.length - maxBuffer);
      removed.forEach(event => seenIdsRef.current.delete(event.id));
      return allEvents.slice(-maxBuffer);
    }

    return allEvents;
  }, [maxBuffer]);

  // Main polling logic
  const poll = useCallback(async () => {
    // Don't poll if disabled, no runId, tab hidden, unmounted
    if (!shouldRun()) {
      return;
    }

    // Prevent overlapping polls
    if (inFlightRef.current) return;

    // Stop polling if run is terminal AND we've already done initial fetch
    if (runStatus && TERMINAL_STATES.includes(runStatus) && initialFetchDoneRef.current && !forceFinalFetchRef.current) {
      return;
    }

    clearTimer();
    abortInFlight();

    abortControllerRef.current = new AbortController();
    inFlightRef.current = true;

    try {
      const newEvents = await fetchEvents(abortControllerRef.current.signal, cursorRef.current);

      if (!isMountedRef.current) return;

      // Success: reset error count
      errorCountRef.current = 0;
      setError(null);
      setLoading(false);
      initialFetchDoneRef.current = true; // Mark that we've fetched at least once
      forceFinalFetchRef.current = false; // Reset force flag after successful fetch

      if (newEvents.length > 0) {
        // Process and update events
        const processedEvents = processEvents(newEvents);
        eventsRef.current = processedEvents;
        setEvents(processedEvents);

        // Update cursor to highest ID from fetched events (handles out-of-order IDs)
        cursorRef.current = newEvents.reduce((max, e) => Math.max(max, e.id), cursorRef.current);
      }

      // Schedule next poll
      const nextInterval = getNextInterval();
      if (nextInterval > 0) {
        timeoutRef.current = setTimeout(poll, nextInterval);
      }
    } catch (err: any) {
      // Ignore abort errors
      if (err?.name === 'AbortError') {
        return;
      }

      if (!isMountedRef.current) return;

      // Handle errors
      errorCountRef.current++;
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      setLoading(false);

      // Retry with backoff
      const nextInterval = getNextInterval();
      if (nextInterval > 0) {
        timeoutRef.current = setTimeout(poll, nextInterval);
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [shouldRun, runStatus, fetchEvents, processEvents, getNextInterval]);

  // Visibility change handler
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;

      if (document.hidden) {
        // Abort in-flight requests and clear timer when tab hidden
        abortInFlight();
        clearTimer();
      } else {
        // Resume polling when tab becomes visible
        if (shouldRun()) {
          poll();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [poll, shouldRun]);

  // Terminal transition handler - fetch final events when run becomes terminal
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = runStatus;

    const becameTerminal =
      runStatus &&
      TERMINAL_STATES.includes(runStatus) &&
      prev &&
      !TERMINAL_STATES.includes(prev);

    if (becameTerminal && enabledRef.current && runIdRef.current != null) {
      // One last poll to catch final events
      forceFinalFetchRef.current = true;
      poll();
    }
  }, [runStatus, poll]);

  // Mount/unmount only
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Start polling when runId/enabled changes
  useEffect(() => {
    isVisibleRef.current = !document.hidden;

    if (enabled && runId != null && isVisibleRef.current) {
      setLoading(true);
      setError(null);
      errorCountRef.current = 0;
      cursorRef.current = 0;
      seenIdsRef.current = new Set();
      eventsRef.current = [];
      initialFetchDoneRef.current = false; // Reset on runId change
      forceFinalFetchRef.current = false;
      setEvents([]);
      poll();
    } else {
      setLoading(false);
      clearTimer();
      abortInFlight();
    }

    // Cleanup on runId change or unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [runId, enabled, poll]);

  // Manual refresh function
  const refresh = useCallback(() => {
    if (!isMountedRef.current) return;
    errorCountRef.current = 0;
    setLoading(true);
    poll();
  }, [poll]);

  // Load more (for earlier events - not implemented in API yet)
  const loadMore = useCallback(() => {
    setHasMore(false); // Placeholder until API supports it
  }, []);

  return {
    events,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
  };
}
