'use client';

import { use, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Play, Pause, Square, MessageSquare, Clock,
  CheckCircle2, AlertCircle, Loader2, ChevronDown, ChevronUp,
  Terminal, Lightbulb, Cog, Copy, Check, ArrowDown
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useRunQuery } from '@/hooks/useRunQuery';
import { useRunEventsQuery } from '@/hooks/useRunEventsQuery';
import { useRunEventsSSE } from '@/hooks/useRunEventsSSE';
import { performRunAction, submitDirective } from '@/lib/api';
import { StatusPill, Card } from '@/components/ui';
import { ErrorBanner } from '@/components/ErrorBanner';

const EVENT_ICONS: Record<string, any> = {
  RUN_CREATED: Play,
  RUN_STARTED: Loader2,
  AGENT_THINKING: Lightbulb,
  PLAN_GENERATED: Terminal,
  EXECUTING: Cog,
  RUN_COMPLETED: CheckCircle2,
  RUN_FAILED: AlertCircle,
  DIRECTIVE: MessageSquare,
  RUN_PAUSE: Pause,
  RUN_RESUME: Play,
  RUN_STOP: Square,
};

export default function RunDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [directiveText, setDirectiveText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  const [copiedEventId, setCopiedEventId] = useState<number | null>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
    };
  }, []);

  // Guard against malformed ID
  const runId = Number.isFinite(Number(id)) ? Number(id) : null;

  // Use React Query hooks
  const {
    run,
    isLoading: runLoading,
    isFetching: runFetching,
    error: runError,
    refetch: refreshRun,
    isTerminal
  } = useRunQuery(runId);

  // Try SSE first, fall back to polling if SSE fails
  const { connectionState: sseState, error: sseError } = useRunEventsSSE(runId, runId !== null);
  
  // Use polling only as fallback when SSE is in fallback mode
  const usePolling = sseState === 'fallback' || sseState === 'disconnected';
  
  const {
    events,
    isLoading: eventsLoading,
    isFetching: eventsFetching,
    error: eventsError,
    refetch: refreshEvents
  } = useRunEventsQuery(runId, { 
    runStatus: run?.status,
    enabled: usePolling  // Only enable polling when SSE is not available
  });

  // Mutations for run actions
  const actionMutation = useMutation({
    mutationFn: ({ action }: { action: 'pause' | 'resume' | 'stop' }) =>
      performRunAction(runId!, action),
    onSuccess: () => {
      setError(null);
      // Invalidate run query to refetch updated status
      queryClient.invalidateQueries({ queryKey: ['run', runId] });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const directiveMutation = useMutation({
    mutationFn: ({ text }: { text: string }) => submitDirective(runId!, text),
    onSuccess: () => {
      setDirectiveText('');
      setError(null);
      // Invalidate events to fetch the new directive event
      queryClient.invalidateQueries({ queryKey: ['events', runId] });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  // Auto-scroll to latest event
  useEffect(() => {
    if (autoScroll && eventsEndRef.current) {
      eventsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events, autoScroll]);

  const handleAction = (action: 'pause' | 'resume' | 'stop') => {
    actionMutation.mutate({ action });
  };

  const handleDirectiveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!directiveText.trim()) return;
    directiveMutation.mutate({ text: directiveText });
  };

  const toggleEventExpand = (eventId: number) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const copyToClipboard = async (text: string, eventId: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedEventId(eventId);
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = setTimeout(() => setCopiedEventId(null), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  const scrollToLatest = () => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Get last event timestamp for "last updated"
  const lastUpdated = events && events.length > 0
    ? events[events.length - 1].created_at
    : run?.created_at;

  // Show spinner only on initial load without cached data
  if (runLoading && !run) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center pb-8">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading run details...</p>
        </div>
      </div>
    );
  }

  if (!run && !runLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center pb-8">
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Run Not Found</h2>
          <p className="text-gray-600 mb-4">The run you're looking for doesn't exist.</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-8">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 backdrop-blur-sm bg-white/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">
                  {run?.name || `Run #${run?.id}`}
                </h1>
                {run && <StatusPill status={run.status} />}
                {run?.run_type && run.run_type !== 'agent' && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                    {run.run_type}
                  </span>
                )}
                {/* Show subtle fetching indicator */}
                {runFetching && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    updating
                  </span>
                )}
              </div>
              <p className="text-gray-700 text-lg mb-2">{run?.goal}</p>
              <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Created {run && formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
                </span>
                <span>•</span>
                <span>Project ID: {run?.project_id}</span>
                <span>•</span>
                <span>Iteration: {run?.current_iteration}</span>
                {lastUpdated && lastUpdated !== run?.created_at && (
                  <>
                    <span>•</span>
                    <span>Last updated {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Banners */}
        {runError && (
          <ErrorBanner
            error={runError instanceof Error ? runError : new Error('Failed to load run')}
            onRetry={refreshRun}
            onDismiss={() => {}}
          />
        )}
        {eventsError && (
          <ErrorBanner
            error={eventsError instanceof Error ? eventsError : new Error('Failed to load events')}
            onRetry={refreshEvents}
            onDismiss={() => {}}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Controls & Directive */}
          <div className="space-y-6">
            {/* Controls */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Controls</h2>
              <div className="space-y-2">
                <button
                  onClick={() => handleAction('pause')}
                  disabled={!run || !['RUNNING'].includes(run.status) || actionMutation.isPending}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    run && ['RUNNING'].includes(run.status) && !actionMutation.isPending
                      ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Pause className="w-4 h-4" />
                  Pause
                </button>
                <button
                  onClick={() => handleAction('resume')}
                  disabled={!run || !['PAUSED'].includes(run.status) || actionMutation.isPending}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    run && ['PAUSED'].includes(run.status) && !actionMutation.isPending
                      ? 'bg-green-500 hover:bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Play className="w-4 h-4" />
                  Resume
                </button>
                <button
                  onClick={() => handleAction('stop')}
                  disabled={!run || !['RUNNING', 'PAUSED', 'QUEUED'].includes(run.status) || actionMutation.isPending}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    run && ['RUNNING', 'PAUSED', 'QUEUED'].includes(run.status) && !actionMutation.isPending
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Square className="w-4 h-4" />
                  Stop
                </button>
              </div>
            </Card>

            {/* Directive */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Send Directive</h2>
              <form onSubmit={handleDirectiveSubmit} className="space-y-3">
                <textarea
                  value={directiveText}
                  onChange={(e) => setDirectiveText(e.target.value)}
                  placeholder="Give the agent a directive..."
                  rows={4}
                  disabled={directiveMutation.isPending}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!directiveText.trim() || directiveMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {directiveMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MessageSquare className="w-4 h-4" />
                  )}
                  {directiveMutation.isPending ? 'Sending...' : 'Send Directive'}
                </button>
              </form>
            </Card>

            {/* Auto-scroll toggle and Jump to Latest */}
            <Card className="p-4 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Auto-scroll to latest</span>
              </label>
              {!autoScroll && events && events.length > 0 && (
                <button
                  onClick={scrollToLatest}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors text-sm font-medium"
                >
                  <ArrowDown className="w-4 h-4" />
                  Jump to Latest
                </button>
              )}
            </Card>
          </div>

          {/* Right Column - Timeline */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Event Timeline</h2>
                {/* Show subtle updating indicator when fetching events */}
                {eventsFetching && events.length > 0 && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    polling
                  </span>
                )}
              </div>

              {events && events.length > 0 ? (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

                  <div className="space-y-6">
                    {events.map((event) => {
                      const Icon = EVENT_ICONS[event.type] || Terminal;
                      const isExpanded = expandedEvents.has(event.id);
                      const isLongPayload = event.payload.length > 150;

                      return (
                        <div key={event.id} className="relative pl-16">
                          {/* Timeline dot */}
                          <div className="absolute left-0 w-12 h-12 bg-white border-2 border-blue-500 rounded-full flex items-center justify-center">
                            <Icon className={`w-5 h-5 ${
                              event.type.includes('COMPLETED') ? 'text-green-600' :
                              event.type.includes('FAILED') ? 'text-red-600' :
                              event.type.includes('RUNNING') || event.type.includes('EXECUTING') ? 'text-blue-600 animate-pulse' :
                              'text-gray-600'
                            }`} />
                          </div>

                          {/* Event card */}
                          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <h3 className="font-semibold text-gray-900">{event.type.replace(/_/g, ' ')}</h3>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => copyToClipboard(event.payload, event.id)}
                                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-200 rounded"
                                  title="Copy to clipboard"
                                >
                                  {copiedEventId === event.id ? (
                                    <Check className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </button>
                                <span className="text-xs text-gray-500 whitespace-nowrap">
                                  {format(new Date(event.created_at), 'HH:mm:ss')}
                                </span>
                              </div>
                            </div>

                            {event.type === 'PLAN_GENERATED' ? (
                              <div className="relative">
                                <pre className="text-sm text-gray-700 bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto font-mono">
                                  {event.payload}
                                </pre>
                              </div>
                            ) : (
                              <div>
                                <p className={`text-sm text-gray-700 ${!isExpanded && isLongPayload ? 'line-clamp-3' : ''}`}>
                                  {event.payload}
                                </p>
                                {isLongPayload && (
                                  <button
                                    onClick={() => toggleEventExpand(event.id)}
                                    className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                                  >
                                    {isExpanded ? (
                                      <>
                                        <ChevronUp className="w-4 h-4" />
                                        Show less
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown className="w-4 h-4" />
                                        Show more
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div ref={eventsEndRef} />
                </div>
              ) : eventsLoading ? (
                <div className="text-center py-12 text-gray-500">
                  <Loader2 className="w-12 h-12 mx-auto mb-4 opacity-50 animate-spin" />
                  <p>Loading events...</p>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Terminal className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No events yet. Waiting for the run to start...</p>
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* Error Toast */}
        {error && (
          <div className="fixed bottom-20 right-4 bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg max-w-md z-50">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-red-900 mb-1">Error</h4>
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-700"
              >
                ×
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
