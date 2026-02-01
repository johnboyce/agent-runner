import { useEffect, useRef, useState, useCallback } from 'react';
import { withTimeout } from '@/lib/timeout';
import { TIMEOUTS } from '@/lib/timeouts';

export interface UsePollingOptions {
  interval?: number;
  enabled?: boolean;
  immediate?: boolean;
  stopOnHidden?: boolean;
  timeout?: number;
}

export function usePolling<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: UsePollingOptions = {}
): { data: T | null; loading: boolean; error: string | null; refetch: () => void } {
  const {
    interval = 2000,
    enabled = true,
    immediate = true,
    stopOnHidden = true,
    timeout = TIMEOUTS.health,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const mountedRef = useRef(false);
  const enabledRef = useRef(enabled);
  const visibleRef = useRef(true);
  const inFlightRef = useRef(false);
  const stopOnHiddenRef = useRef(stopOnHidden);

  const fetcherRef = useRef(fetcher);
  useEffect(() => { fetcherRef.current = fetcher; }, [fetcher]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { stopOnHiddenRef.current = stopOnHidden; }, [stopOnHidden]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const clearTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const abortInFlight = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  const shouldRun = () =>
    mountedRef.current &&
    enabledRef.current &&
    (!stopOnHiddenRef.current || visibleRef.current);

  const fetchData = useCallback(async () => {
    if (!shouldRun()) return;
    if (inFlightRef.current) return;

    clearTimer();
    abortInFlight();

    abortRef.current = new AbortController();
    inFlightRef.current = true;

    const { signal, cleanup } = withTimeout(abortRef.current.signal, timeout);

    try {
      const result = await fetcherRef.current(signal);

      if (!shouldRun()) return;
      setData(result);
      setError(null);
      setLoading(false);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      if (!shouldRun()) return;

      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      setLoading(false);
    } finally {
      cleanup();
      inFlightRef.current = false;

      if (shouldRun()) {
        timeoutRef.current = setTimeout(fetchData, interval);
      }
    }
  }, [interval, timeout]);

  // Visibility handling (always installed; shouldRun() decides behavior)
  useEffect(() => {
    const onVis = () => {
      visibleRef.current = !document.hidden;

      if (shouldRun()) {
        fetchData(); // kick immediately on visible
      } else {
        clearTimer();
        abortInFlight();
      }
    };

    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [fetchData]);

  // Start/stop polling lifecycle
  useEffect(() => {
    clearTimer();
    abortInFlight();

    visibleRef.current = !document.hidden;

    if (!enabled) {
      setLoading(false);
      return;
    }

    // If we’re configured to stop on hidden and we’re hidden, we pause cleanly
    if (stopOnHiddenRef.current && document.hidden) {
      setLoading(false);
      return;
    }

    if (immediate) {
      setLoading(true);
      fetchData();
    } else {
      timeoutRef.current = setTimeout(fetchData, interval);
    }

    return () => {
      clearTimer();
      abortInFlight();
    };
  }, [enabled, interval, immediate, fetchData]);

  const refetch = useCallback(() => {
    if (!mountedRef.current) return;
    setLoading(true);
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
}

export interface UseAdaptivePollingOptions {
  enabled?: boolean;
  activeInterval?: number;
  idleInterval?: number;
  immediate?: boolean;
  stopOnHidden?: boolean;
  timeout?: number;
}

export function useAdaptivePolling<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  isActive: (data: T | null) => boolean,
  options: UseAdaptivePollingOptions = {}
): { data: T | null; loading: boolean; error: string | null; refetch: () => void } {
  const {
    enabled = true,
    activeInterval = 1500,
    idleInterval = 5000,
    immediate = true,
    stopOnHidden = true,
    timeout = TIMEOUTS.worker,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const mountedRef = useRef(false);
  const enabledRef = useRef(enabled);
  const visibleRef = useRef(true);
  const inFlightRef = useRef(false);
  const stopOnHiddenRef = useRef(stopOnHidden);

  const fetcherRef = useRef(fetcher);
  const isActiveRef = useRef(isActive);

  useEffect(() => { fetcherRef.current = fetcher; }, [fetcher]);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { stopOnHiddenRef.current = stopOnHidden; }, [stopOnHidden]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const clearTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const abortInFlight = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  const shouldRun = () =>
    mountedRef.current &&
    enabledRef.current &&
    (!stopOnHiddenRef.current || visibleRef.current);

  const poll = useCallback(async () => {
    if (!shouldRun()) return;
    if (inFlightRef.current) return;

    clearTimer();
    abortInFlight();

    abortRef.current = new AbortController();
    inFlightRef.current = true;

    const { signal, cleanup } = withTimeout(abortRef.current.signal, timeout);

    try {
      const result = await fetcherRef.current(signal);

      if (!shouldRun()) return;

      setData(result);
      setError(null);
      setLoading(false);

      const next = isActiveRef.current(result) ? activeInterval : idleInterval;
      timeoutRef.current = setTimeout(poll, next);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      if (!shouldRun()) return;

      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      setLoading(false);

      timeoutRef.current = setTimeout(poll, idleInterval);
    } finally {
      cleanup();
      inFlightRef.current = false;
    }
  }, [activeInterval, idleInterval, timeout]);

  // Visibility handling (always installed)
  useEffect(() => {
    const onVis = () => {
      visibleRef.current = !document.hidden;

      if (shouldRun()) {
        poll();
      } else {
        clearTimer();
        abortInFlight();
      }
    };

    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [poll]);

  useEffect(() => {
    clearTimer();
    abortInFlight();

    visibleRef.current = !document.hidden;

    if (!enabled) {
      setLoading(false);
      return;
    }

    if (stopOnHiddenRef.current && document.hidden) {
      setLoading(false);
      return;
    }

    if (immediate) {
      setLoading(true);
      poll();
    } else {
      timeoutRef.current = setTimeout(poll, idleInterval);
    }

    return () => {
      clearTimer();
      abortInFlight();
    };
  }, [enabled, immediate, idleInterval, poll]);

  const refetch = useCallback(() => {
    if (!mountedRef.current) return;
    setLoading(true);
    poll();
  }, [poll]);

  return { data, loading, error, refetch };
}
