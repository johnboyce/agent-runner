import { renderHook, waitFor } from '@testing-library/react';
import { useRun } from '../useRun';

// Mock fetch globally
global.fetch = jest.fn();

describe('useRun', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should fetch run data on mount', async () => {
    const mockRun = {
      id: 1,
      project_id: 1,
      goal: 'Test goal',
      status: 'RUNNING',
      current_iteration: 0,
      created_at: '2026-02-01T00:00:00Z',
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockRun,
    });

    const { result } = renderHook(() => useRun(1));

    // Initially loading
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    // Wait for data to load
    await waitFor(() => {
      if (result.current.loading) {
        throw new Error('Still loading');
      }
    });

    expect(result.current.data).toEqual(mockRun);
    expect(result.current.error).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should not be loading if runId is null', () => {
    const { result } = renderHook(() => useRun(null));
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should handle 404 errors and stop polling', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const { result } = renderHook(() => useRun(999));

    await waitFor(() => {
      if (result.current.loading) {
        throw new Error('Still loading');
      }
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toContain('not found');
    expect(result.current.data).toBeNull();
  });

  it('should poll active runs every 1.5s', async () => {
    jest.useFakeTimers();

    const mockRun = {
      id: 1,
      project_id: 1,
      goal: 'Test',
      status: 'RUNNING',
      current_iteration: 0,
      created_at: '2026-02-01T00:00:00Z',
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockRun,
    });

    const { unmount } = renderHook(() => useRun(1));

    // Initial fetch
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    }, { timeout: 3000 });

    // Fast forward 1.5s and run pending promises
    await jest.advanceTimersByTimeAsync(1500);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    }, { timeout: 3000 });

    unmount();
    jest.useRealTimers();
  });

  it('should stop polling terminal runs', async () => {
    jest.useFakeTimers();

    const mockRun = {
      id: 1,
      project_id: 1,
      goal: 'Test',
      status: 'COMPLETED',
      current_iteration: 5,
      created_at: '2026-02-01T00:00:00Z',
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockRun,
    });

    renderHook(() => useRun(1));

    // Initial fetch
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    // Fast forward - should NOT poll again since it's terminal
    jest.advanceTimersByTime(5000);

    expect(global.fetch).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it('should use exponential backoff on errors', async () => {
    jest.useFakeTimers();

    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, status: 'RUNNING' }),
      });

    renderHook(() => useRun(1));

    // First fetch fails
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    // Should retry with backoff (1.5s * 2^0 = 1.5s)
    jest.advanceTimersByTime(1500);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    // Should retry with longer backoff (1.5s * 2^1 = 3s)
    jest.advanceTimersByTime(3000);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    jest.useRealTimers();
  });

  it('should cleanup on unmount', async () => {
    const mockRun = {
      id: 1,
      status: 'RUNNING',
      created_at: '2026-02-01T00:00:00Z',
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockRun,
    });

    const { unmount } = renderHook(() => useRun(1));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    const fetchCount = (global.fetch as jest.Mock).mock.calls.length;
    unmount();

    // Wait a bit - should not fetch after unmount
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(global.fetch).toHaveBeenCalledTimes(fetchCount);
  });

  it('should allow manual refresh', async () => {
    const mockRun = {
      id: 1,
      status: 'COMPLETED',
      created_at: '2026-02-01T00:00:00Z',
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockRun,
    });

    const { result } = renderHook(() => useRun(1));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const initialFetchCount = (global.fetch as jest.Mock).mock.calls.length;

    // Manual refresh
    result.current.refresh();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(initialFetchCount + 1);
    });
  });

  it('should mark run as terminal correctly', async () => {
    const mockRun = {
      id: 1,
      status: 'COMPLETED',
      created_at: '2026-02-01T00:00:00Z',
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockRun,
    });

    const { result } = renderHook(() => useRun(1));

    await waitFor(() => {
      expect(result.current.isTerminal).toBe(true);
    });
  });

  it('should not poll when disabled', async () => {
    const mockRun = {
      id: 1,
      status: 'RUNNING',
      created_at: '2026-02-01T00:00:00Z',
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockRun,
    });

    renderHook(() => useRun(1, { enabled: false }));

    // Wait a bit - should not fetch when disabled
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should call onError callback on fetch failure', async () => {
    const onError = jest.fn();
    const error = new Error('Fetch failed');

    (global.fetch as jest.Mock).mockRejectedValueOnce(error);

    renderHook(() => useRun(1, { onError }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
