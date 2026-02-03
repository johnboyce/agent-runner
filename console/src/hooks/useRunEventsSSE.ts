import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Event } from '@/lib/api';
import { useSSEStatus } from '@/contexts/SSEStatusContext';

const API_URL = process.env.NEXT_PUBLIC_AGENT_RUNNER_URL || 'http://localhost:8000';

export type SSEConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error' | 'fallback';

export interface UseRunEventsSSEResult {
  connectionState: SSEConnectionState;
  error: Error | null;
}

/**
 * Hook to stream run events via Server-Sent Events (SSE)
 * Falls back to polling if SSE is unavailable or fails
 */
export function useRunEventsSSE(
  runId: number | null,
  enabled: boolean = true
): UseRunEventsSSEResult {
  const queryClient = useQueryClient();
  const { setConnectionState: setGlobalConnectionState } = useSSEStatus();
  const [connectionState, setConnectionState] = useState<SSEConnectionState>('disconnected');
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenIdsRef = useRef<Set<number>>(new Set());
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;

  // Update both local and global state
  const updateConnectionState = useCallback((state: SSEConnectionState) => {
    setConnectionState(state);
    setGlobalConnectionState(state);
  }, [setGlobalConnectionState]);

  // Get the highest event ID we've seen for resuming
  const getLastEventId = useCallback(() => {
    if (!runId) return 0;
    const events = queryClient.getQueryData<Event[]>(['events', runId]) || [];
    return events.length > 0 ? Math.max(...events.map(e => e.id)) : 0;
  }, [queryClient, runId]);

  // Merge a new event into the React Query cache
  const mergeEvent = useCallback((event: Event) => {
    if (!runId) return;
    
    // Skip if we've already seen this event
    if (seenIdsRef.current.has(event.id)) {
      return;
    }
    seenIdsRef.current.add(event.id);

    // Get existing events from cache
    const existingEvents = queryClient.getQueryData<Event[]>(['events', runId]) || [];
    
    // Add new event and sort
    const updatedEvents = [...existingEvents, event].sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return a.id - b.id;
    });

    // Update cache
    queryClient.setQueryData(['events', runId], updatedEvents);
  }, [queryClient, runId]);

  // Connect to SSE stream
  const connect = useCallback(() => {
    if (!runId || !enabled) return;

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      updateConnectionState('connecting');
      setError(null);

      const lastEventId = getLastEventId();
      const url = `${API_URL}/runs/${runId}/events/stream${lastEventId > 0 ? `?after_id=${lastEventId}` : ''}`;
      
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        updateConnectionState('connected');
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      eventSource.onerror = (e) => {
        console.error('SSE connection error:', e);
        updateConnectionState('error');
        
        // Attempt to reconnect with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          // Fall back to polling after max reconnect attempts
          updateConnectionState('fallback');
          setError(new Error('SSE connection failed, falling back to polling'));
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
        }
      };

      // Handle all event types dynamically
      eventSource.addEventListener('message', (e) => {
        try {
          const event = JSON.parse(e.data) as Event;
          mergeEvent(event);
        } catch (err) {
          console.error('Failed to parse SSE event:', err);
        }
      });

      // Handle specific event types (FastAPI sends event: field)
      const eventTypes = [
        'RUN_CREATED', 'RUN_STARTED', 'RUN_COMPLETED', 'RUN_FAILED',
        'RUN_PAUSE', 'RUN_RESUME', 'RUN_STOP',
        'AGENT_THINKING', 'PLAN_GENERATED', 'EXECUTING', 'DIRECTIVE'
      ];
      
      eventTypes.forEach(eventType => {
        eventSource.addEventListener(eventType, (e: any) => {
          try {
            const event = JSON.parse(e.data) as Event;
            mergeEvent(event);
          } catch (err) {
            console.error(`Failed to parse ${eventType} event:`, err);
          }
        });
      });

    } catch (err) {
      console.error('Failed to create EventSource:', err);
      updateConnectionState('error');
      setError(err instanceof Error ? err : new Error('Failed to connect to SSE'));
    }
  }, [runId, enabled, getLastEventId, mergeEvent, updateConnectionState]);

  // Clean up on unmount or when runId/enabled changes
  useEffect(() => {
    // Reset seen IDs when runId changes
    if (runId) {
      seenIdsRef.current = new Set();
    }

    // Only connect if EventSource is supported
    if (typeof EventSource === 'undefined') {
      updateConnectionState('fallback');
      setError(new Error('EventSource not supported, using polling'));
      return;
    }

    if (enabled && runId) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      updateConnectionState('disconnected');
    };
  }, [runId, enabled, connect, updateConnectionState]);

  return {
    connectionState,
    error,
  };
}
