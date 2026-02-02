'use client';

import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { useMemo } from 'react';

/**
 * Activity Ticker - A minimal, text-only status indicator
 * Shows what the UI is currently doing based on React Query state
 */
export function ActivityTicker() {
  // Get global fetching and mutation state from React Query
  const isFetchingCount = useIsFetching();
  const isMutatingCount = useIsMutating();
  
  // Check what's being fetched (hooks must be called at top level)
  const fetchingRuns = useIsFetching({ queryKey: ['runs'] });
  const fetchingRun = useIsFetching({ queryKey: ['run'] });
  const fetchingEvents = useIsFetching({ queryKey: ['events'] });

  // Derive activity state
  const activityState = useMemo(() => {
    const parts: string[] = [];

    if (fetchingRuns > 0) {
      parts.push('Fetching runs');
    }
    if (fetchingRun > 0) {
      parts.push('Fetching run details');
    }
    if (fetchingEvents > 0) {
      parts.push('Polling events');
    }

    if (isMutatingCount > 0) {
      parts.push('Updating');
    }

    // Build status text
    if (parts.length > 0) {
      return parts.join(' · ');
    }

    // Idle state - simple and clean
    return 'Idle · All data up to date';
  }, [isMutatingCount, fetchingRuns, fetchingRun, fetchingEvents]);

  // Determine if we're actively fetching
  const isActive = isFetchingCount > 0 || isMutatingCount > 0;

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-gray-900 text-gray-300 px-4 py-1 z-50 border-t border-gray-700">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            {/* Activity indicator */}
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${
                isActive ? 'bg-blue-400 animate-pulse' : 'bg-green-400'
              }`}
            />
            {/* Status text */}
            <span>{activityState}</span>
          </div>
          
          {/* Optional: Add timestamp */}
          <span className="text-gray-500 text-[10px]">
            {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>
    </footer>
  );
}
