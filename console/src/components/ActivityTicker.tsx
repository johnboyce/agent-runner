'use client';

import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useSSEStatus } from '@/contexts/SSEStatusContext';

/**
 * Activity Ticker - A minimal, text-only status indicator
 * Shows what the UI is currently doing based on React Query state and SSE connection
 */
export function ActivityTicker() {
  // Get global fetching and mutation state from React Query
  const isFetchingCount = useIsFetching();
  const isMutatingCount = useIsMutating();

  // Check what's being fetched (hooks must be called at top level)
  const fetchingRuns = useIsFetching({ queryKey: ['runs'] });
  const fetchingRun = useIsFetching({ queryKey: ['run'] });
  const fetchingEvents = useIsFetching({ queryKey: ['events'] });

  // Get SSE connection state
  const { connectionState } = useSSEStatus();

  // Client-only clock to avoid hydration mismatch
  const [clock, setClock] = useState<string>(''); // blank on SSR + initial render

  useEffect(() => {
    const update = () => setClock(new Date().toLocaleTimeString());
    update(); // set immediately after mount
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Derive activity state
  const activityState = useMemo(() => {
    const parts: string[] = [];

    // SSE connection status
    if (connectionState === 'connected') {
      parts.push('Live streaming');
    } else if (connectionState === 'connecting') {
      parts.push('Connecting to stream...');
    } else if (connectionState === 'error') {
      parts.push('Reconnecting...');
    } else if (connectionState === 'fallback') {
      parts.push('Polling (fallback mode)');
    }

    // Other fetching states
    if (fetchingRuns > 0) parts.push('Fetching runs');
    if (fetchingRun > 0) parts.push('Fetching run details');
    if (fetchingEvents > 0 && connectionState !== 'connected') parts.push('Polling events');
    if (isMutatingCount > 0) parts.push('Updating');

    if (parts.length > 0) return parts.join(' · ');

    return 'Idle · All data up to date';
  }, [isMutatingCount, fetchingRuns, fetchingRun, fetchingEvents, connectionState]);

  // Determine if we're actively fetching
  const isActive = isFetchingCount > 0 || isMutatingCount > 0 || 
                   connectionState === 'connecting' || connectionState === 'error';
  
  // Use green for live streaming, blue for active, yellow for reconnecting
  const indicatorColor = 
    connectionState === 'connected' ? 'bg-green-400' :
    connectionState === 'error' ? 'bg-yellow-400 animate-pulse' :
    isActive ? 'bg-blue-400 animate-pulse' : 'bg-gray-400';

  return (
      <footer className="fixed bottom-0 left-0 right-0 bg-gray-900 text-gray-300 px-4 py-1 z-50 border-t border-gray-700">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2">
              {/* Activity indicator */}
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${indicatorColor}`} />
              {/* Status text */}
              <span>{activityState}</span>
            </div>

            {/* Clock: render only after mount to avoid hydration mismatch */}
            <span className="text-gray-500 text-[10px] tabular-nums">
            {clock || '\u00A0'}
          </span>
          </div>
        </div>
      </footer>
  );
}
