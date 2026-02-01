import { renderHook, waitFor } from '@testing-library/react';
import { useRunEvents } from '../useRunEvents';

// Mock fetch globally
global.fetch = jest.fn();

describe('useRunEvents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  const mockEvents = [
    {
      id: 1,
      run_id: 1,
      type: 'RUN_CREATED',
      payload: 'Run created',
      created_at: '2026-02-01T00:00:00Z',
    },
    {
      id: 2,
      run_id: 1,
      type: 'RUN_STARTED',
      payload: 'Run started',
      created_at: '2026-02-01T00:01:00Z',
    },
  ];

  it('should fetch events on mount', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockEvents,
    });

    const { result } = renderHook(() => useRunEvents(1));

    expect(result.current.loading).toBe(true);
    expect(result.current.events).toEqual([]);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.events).toEqual(mockEvents);
    expect(result.current.error).toBeNull();
  });

  it('should not be loading if runId is null', () => {
    const { result } = renderHook(() => useRunEvents(null));
    expect(result.current.loading).toBe(false);
    expect(result.current.events).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('CRITICAL: should fetch events for terminal runs on initial load', async () => {
    // This test prevents regression of the terminal state bug
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockEvents,
    });

    // Pass terminal status immediately
    const { result } = renderHook(() =>
      useRunEvents(1, { runStatus: 'COMPLETED' })
    );

    // Should still fetch on initial load despite terminal state
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should have events even though status is terminal
    expect(result.current.events).toEqual(mockEvents);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should stop polling after initial fetch for terminal runs', async () => {
    jest.useFakeTimers();

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockEvents,
    });

    renderHook(() => useRunEvents(1, { runStatus: 'COMPLETED' }));

    // Initial fetch
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    // Fast forward - should NOT poll again
    jest.advanceTimersByTime(5000);

    expect(global.fetch).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it('should continue polling for active runs', async () => {
    jest.useFakeTimers();

    const newEvent = {
      id: 3,
      run_id: 1,
      type: 'AGENT_THINKING',
      payload: 'Thinking...',
      created_at: '2026-02-01T00:02:00Z',
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockEvents,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [newEvent],
      });

    const { unmount } = renderHook(() => useRunEvents(1, { runStatus: 'RUNNING' }));

    // Initial fetch
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    }, { timeout: 3000 });

    // Should poll again after 1.5s
    await jest.advanceTimersByTimeAsync(1500);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    }, { timeout: 3000 });

    unmount();
    jest.useRealTimers();
  });

  it('should deduplicate events by ID', async () => {
    const duplicateEvents = [
      mockEvents[0],
      mockEvents[1],
      mockEvents[0], // Duplicate
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => duplicateEvents,
    });

    const { result } = renderHook(() => useRunEvents(1));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 5000 });

    // Should only have 2 events, not 3
    expect(result.current.events).toHaveLength(2);
    expect(result.current.events).toEqual(mockEvents);
  });

  it('should sort events by timestamp and ID', async () => {
    const unsortedEvents = [
      {
        id: 3,
        run_id: 1,
        type: 'EVENT_3',
        payload: '3',
        created_at: '2026-02-01T00:02:00Z',
      },
      {
        id: 1,
        run_id: 1,
        type: 'EVENT_1',
        payload: '1',
        created_at: '2026-02-01T00:00:00Z',
      },
      {
        id: 2,
        run_id: 1,
        type: 'EVENT_2',
        payload: '2',
        created_at: '2026-02-01T00:01:00Z',
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => unsortedEvents,
    });

    const { result } = renderHook(() => useRunEvents(1));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 5000 });

    // Should be sorted by timestamp
    expect(result.current.events[0].id).toBe(1);
    expect(result.current.events[1].id).toBe(2);
    expect(result.current.events[2].id).toBe(3);
  });

  it('should enforce max buffer size', async () => {
    const manyEvents = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      run_id: 1,
      type: 'EVENT',
      payload: `Event ${i + 1}`,
      created_at: `2026-02-01T00:${String(i).padStart(2, '0')}:00Z`,
    }));

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => manyEvents,
    });

    const { result } = renderHook(() =>
      useRunEvents(1, { maxBuffer: 20 })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 5000 });

    // Should only keep last 20 events
    expect(result.current.events).toHaveLength(20);
    expect(result.current.events[0].id).toBe(31); // Last 20
    expect(result.current.events[19].id).toBe(50);
  });

  it('should handle fetch errors with backoff', async () => {
    jest.useFakeTimers();

    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockEvents,
      });

    const { result, unmount } = renderHook(() => useRunEvents(1));

    // First fetch fails
    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    }, { timeout: 5000 });

    // Should retry with backoff
    await jest.advanceTimersByTimeAsync(1500);

    await waitFor(() => {
      expect(result.current.events).toEqual(mockEvents);
      expect(result.current.error).toBeNull();
    }, { timeout: 5000 });

    unmount();
    jest.useRealTimers();
  });

  it('should use cursor for incremental fetching', async () => {
    jest.useFakeTimers();

    const initialEvents = mockEvents;
    const newEvent = {
      id: 3,
      run_id: 1,
      type: 'NEW_EVENT',
      payload: 'New',
      created_at: '2026-02-01T00:03:00Z',
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => initialEvents,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [newEvent],
      });

    const { unmount } = renderHook(() => useRunEvents(1, { runStatus: 'RUNNING' }));

    // Initial fetch without cursor
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    }, { timeout: 5000 });

    // Second fetch should happen after timer
    await jest.advanceTimersByTimeAsync(1500);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    }, { timeout: 5000 });

    unmount();
    jest.useRealTimers();
  });

  it('should cleanup on unmount', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockEvents,
    });

    const { unmount } = renderHook(() => useRunEvents(1));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    }, { timeout: 3000 });

    const fetchCount = (global.fetch as jest.Mock).mock.calls.length;
    unmount();

    // Wait a bit - should not fetch after unmount
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(global.fetch).toHaveBeenCalledTimes(fetchCount);
  });

  it('should allow manual refresh', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockEvents,
    });

    const { result } = renderHook(() => useRunEvents(1, { runStatus: 'RUNNING' })); // Use RUNNING instead of COMPLETED

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 5000 });

    const initialFetchCount = (global.fetch as jest.Mock).mock.calls.length;

    // Manual refresh
    result.current.refresh();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(initialFetchCount + 1);
    }, { timeout: 5000 });
  });

  it('should not poll when disabled', async () => {
    renderHook(() => useRunEvents(1, { enabled: false }));

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should reset state when runId changes', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockEvents,
    });

    const { result, rerender } = renderHook(
      ({ runId }) => useRunEvents(runId),
      { initialProps: { runId: 1 } }
    );

    await waitFor(() => {
      expect(result.current.events).toEqual(mockEvents);
    });

    // Change runId
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    rerender({ runId: 2 });

    await waitFor(() => {
      expect(result.current.events).toEqual([]);
    });
  });

  it('REGRESSION: terminal run with FAILED status should fetch events', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockEvents,
    });

    const { result } = renderHook(() =>
      useRunEvents(1, { runStatus: 'FAILED' })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.events).toEqual(mockEvents);
  });

  it('REGRESSION: terminal run with STOPPED status should fetch events', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockEvents,
    });

    const { result } = renderHook(() =>
      useRunEvents(1, { runStatus: 'STOPPED' })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.events).toEqual(mockEvents);
  });
});
