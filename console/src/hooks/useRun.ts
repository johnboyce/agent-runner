import { useEffect, useRef, useState, useCallback } from 'react';
import { withTimeout } from '@/lib/timeout';
import { TIMEOUTS } from '@/lib/timeouts';

interface UseRunOptions {
  enabled?: boolean;
  onError?: (error: Error) => void;
}

interface Run {
  id: number;
  project_id: number;
  name?: string;
  goal: string;
  run_type?: string;
  status: string;
  current_iteration: number;
  options?: Record<string, any>;
  metadata?: Record<string, any>;
  created_at: string;
}

const TERMINAL_STATES = ['COMPLETED', 'FAILED', 'STOPPED'];
const FAST_INTERVAL = Number(process.env.NEXT_PUBLIC_POLLING_INTERVAL_FAST) || 1500;
const MAX_BACKOFF = Number(process.env.NEXT_PUBLIC_POLLING_MAX_BACKOFF) || 30000;

/**
 * Hardened hook for polling run metadata with adaptive intervals,
 * backoff, abort handling, and visibility-aware polling.
 */
export function useRun(runId: number | null, options: UseRunOptions = {}) {
  const { enabled = true, onError } = options;

  const [data, setData] = useState<Run | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorCountRef = useRef<number>(0);
  const isVisibleRef = useRef<boolean>(true);
  const isMountedRef = useRef<boolean>(false);
  const dataRef = useRef<Run | null>(null);
  const inFlightRef = useRef<boolean>(false);

  const enabledRef = useRef(enabled);
  const runIdRef = useRef(runId);

  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { runIdRef.current = runId; }, [runId]);

  // Calculate next poll interval based on state and errors
  const getNextInterval = useCallback((run: Run | null): number => {
    if (!run) return FAST_INTERVAL;

    // Terminal states don't poll (stopped completely)
    if (TERMINAL_STATES.includes(run.status)) {
      return 0;
    }

    // Active states with errors: exponential backoff with jitter
    if (errorCountRef.current > 0) {
      const backoff = Math.min(
        FAST_INTERVAL * Math.pow(2, errorCountRef.current - 1),
        MAX_BACKOFF
      );
      // Add jitter (±20%)
      const jitter = backoff * 0.2 * (Math.random() - 0.5);
      return Math.floor(backoff + jitter);
    }

    // Active states: fast polling
    return FAST_INTERVAL;
  }, []);

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
    isVisibleRef.current, []);

  // Fetch run data with timeout protection
  const fetchRun = useCallback(async (signal: AbortSignal): Promise<Run | null> => {
    const currentRunId = runIdRef.current;
    if (currentRunId == null) return null;

    const baseUrl = process.env.NEXT_PUBLIC_AGENT_RUNNER_URL || 'http://localhost:8000';
    const { signal: s, cleanup } = withTimeout(signal, TIMEOUTS.run);
    try {
      const response = await fetch(
        `${baseUrl}/runs/${currentRunId}`,
        { signal: s, cache: 'no-store' }
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Run ${currentRunId} not found`);
        }
        throw new Error(`Failed to fetch run: ${response.status}`);
      }

      return response.json();
    } finally {
      cleanup();
    }
  }, []);

  // Main polling logic
  const poll = useCallback(async () => {
    // Don't poll if disabled, no runId, tab hidden, or unmounted
    if (!shouldRun()) {
      return;
    }

    // Prevent overlapping polls
    if (inFlightRef.current) return;

    clearTimer();
    abortInFlight();

    abortControllerRef.current = new AbortController();
    inFlightRef.current = true;

    try {
      const run = await fetchRun(abortControllerRef.current.signal);

      if (!isMountedRef.current) return;

      // Success: reset error count
      errorCountRef.current = 0;
      setError(null);
      setLoading(false);
      setData(run);
      dataRef.current = run;

      // Stop polling for terminal states (manual refresh still works)
      if (run && TERMINAL_STATES.includes(run.status)) {
        return;
      }

      // Schedule next poll based on state
      const nextInterval = getNextInterval(run);
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

      if (onError) {
        onError(error);
      }

      // Retry with backoff (unless it's a 404)
      if (!error.message.includes('not found')) {
        const nextInterval = getNextInterval(dataRef.current);
        if (nextInterval > 0) {
          timeoutRef.current = setTimeout(poll, nextInterval);
        }
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [shouldRun, fetchRun, getNextInterval, onError]);

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

  // Mount/unmount only
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Start polling when runId/enabled changes
  useEffect(() => {
    isVisibleRef.current = !document.hidden;

    clearTimer();
    abortInFlight();

    if (!enabled || runId == null || !isVisibleRef.current) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    errorCountRef.current = 0;
    poll();

    // Cleanup on runId change or unmount
    return () => {
      clearTimer();
      abortInFlight();
    };
  }, [runId, enabled, poll]);

  // Manual refresh function
  const refresh = useCallback(() => {
    if (!isMountedRef.current) return;
    errorCountRef.current = 0;
    setLoading(true);
    poll();
  }, [poll]);

  return {
    data,
    loading,
    error,
    refresh,
    isTerminal: data ? TERMINAL_STATES.includes(data.status) : false,
    isActive: data ? ['QUEUED', 'RUNNING'].includes(data.status) : false,
    isPaused: data?.status === 'PAUSED',
    isStopped: data?.status === 'STOPPED',
    isCompleted: data?.status === 'COMPLETED',
    isFailed: data?.status === 'FAILED',
  };
}
