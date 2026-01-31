import { useEffect, useRef, useState } from 'react';

interface UsePollingOptions {
  interval?: number;
  enabled?: boolean;
}

export function usePolling<T>(
  fetcher: () => Promise<T>,
  options: UsePollingOptions = {}
): { data: T | null; loading: boolean; error: string | null; refetch: () => void } {
  const { interval = 2000, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Store fetcher in ref to avoid stale closures
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const fetchData = async () => {
    try {
      const result = await fetcherRef.current();
      if (mountedRef.current) {
        setData(result);
        setError(null);
        setLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    if (!enabled) {
      mountedRef.current = false;
      return;
    }

    const poll = async () => {
      await fetchData();
      if (mountedRef.current) {
        timeoutRef.current = setTimeout(poll, interval);
      }
    };

    // Start polling immediately
    poll();

    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [interval, enabled]);

  return { data, loading, error, refetch: fetchData };
}

export function useAdaptivePolling<T>(
  fetcher: () => Promise<T>,
  isActive: (data: T | null) => boolean
): { data: T | null; loading: boolean; error: string | null; refetch: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Store fetcher and isActive in refs to avoid stale closures
  const fetcherRef = useRef(fetcher);
  const isActiveRef = useRef(isActive);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const fetchData = async () => {
    try {
      const result = await fetcherRef.current();
      if (mountedRef.current) {
        setData(result);
        setError(null);
        setLoading(false);
      }
      return result;
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
        setLoading(false);
      }
      return null;
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    const poll = async () => {
      const result = await fetchData();
      if (!mountedRef.current) return;

      const active = isActiveRef.current(result);
      const interval = active ? 1500 : 5000; // Fast poll when active, slow when idle

      timeoutRef.current = setTimeout(poll, interval);
    };

    // Start polling immediately
    poll();

    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []); // Empty deps safe because we use refs

  return { data, loading, error, refetch: fetchData };
}
