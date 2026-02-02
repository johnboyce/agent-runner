'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Play, Search, Filter, RefreshCw, Activity, AlertCircle, Plus, CheckCircle, FolderGit2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAdaptivePolling, usePolling } from '@/hooks/usePolling';
import { TIMEOUTS } from '@/lib/timeouts';
import { StatusPill, Card, EmptyState } from '@/components/ui';
import { CreateRunModal } from '@/components/CreateRunModal';

interface Project {
  id: number;
  name: string;
  local_path: string;
  created_at: string;
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

interface WorkerStatus {
  running: boolean;
  check_interval: number;
}

const API_URL = process.env.NEXT_PUBLIC_AGENT_RUNNER_URL || 'http://localhost:8000';
const FORGEJO_URL = process.env.NEXT_PUBLIC_FORGEJO_URL || 'http://localhost:3000';
const TAIGA_URL = process.env.NEXT_PUBLIC_TAIGA_URL || 'http://localhost:9000';

export default function Home() {
  const [filter, setFilter] = useState<'all' | 'active'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const router = useRouter();

  // Track timeouts for cleanup
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
    };
  }, []);

  // Fetch runs with adaptive polling (fast when active, slow when idle)
  const { data: runs, loading: runsLoading, error: runsError } = useAdaptivePolling<Run[]>(
    async (signal) => {
      const response = await fetch(`${API_URL}/runs`, { signal, cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch runs');
      return response.json();
    },
    (data) => {
      // Fast poll if any runs are active
      return data?.some(run => ['QUEUED', 'RUNNING', 'PAUSED'].includes(run.status)) || false;
    },
    { timeout: TIMEOUTS.runs }
  );

  // Fetch worker status (slower fixed polling)
  const { data: workerStatus } = usePolling<WorkerStatus>(
    async (signal) => {
      const response = await fetch(`${API_URL}/worker/status`, { signal, cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch worker status');
      return response.json();
    },
    { interval: 5000, timeout: TIMEOUTS.worker } // Check every 5 seconds
  );

  // Filter and search runs
  const filteredRuns = useMemo(() => {
    if (!runs) return [];

    let filtered = runs;

    // Apply status filter
    if (filter === 'active') {
      filtered = filtered.filter(run =>
        ['QUEUED', 'RUNNING', 'PAUSED'].includes(run.status)
      );
    }

    // Apply search
    if (searchQuery) {
      filtered = filtered.filter(run =>
        run.goal.toLowerCase().includes(searchQuery.toLowerCase()) ||
        run.id.toString().includes(searchQuery)
      );
    }

    return filtered;
  }, [runs, filter, searchQuery]);

  const activeCount = runs?.filter(r => ['QUEUED', 'RUNNING', 'PAUSED'].includes(r.status)).length || 0;

  // Check Forgejo and Taiga status
  const { data: forgejoStatus } = usePolling<{ status: string }>(
    async (signal) => {
      try {
        await fetch(FORGEJO_URL, {
          method: 'HEAD',
          mode: 'no-cors',
          signal,
          cache: 'no-store',
        });
        return { status: 'online' };
      } catch {
        // Network error, timeout, or abort means service is down/unreachable
        return { status: 'offline' };
      }
    },
    { interval: 30000, timeout: TIMEOUTS.health } // Check every 30 seconds
  );

  const { data: taigaStatus } = usePolling<{ status: string }>(
    async (signal) => {
      try {
        await fetch(TAIGA_URL, {
          method: 'HEAD',
          mode: 'no-cors',
          signal,
          cache: 'no-store',
        });
        return { status: 'online' };
      } catch {
        // Network error, timeout, or abort means service is down/unreachable
        return { status: 'offline' };
      }
    },
    { interval: 30000, timeout: TIMEOUTS.health } // Check every 30 seconds
  );

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
      {/* Success Toast */}
      {showToast && (
        <div className="fixed top-4 right-4 z-60 animate-slide-in">
          <div className="bg-green-600 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Run created successfully!</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 backdrop-blur-sm bg-white/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Activity className="w-7 h-7 text-blue-600" />
                Agent Runner Console
              </h1>
              <p className="text-sm text-gray-500 mt-1">Monitor and control your AI agent runs</p>
            </div>

            {/* Navigation and Status Indicators */}
            <div className="flex items-center gap-3">
              {/* Projects Link */}
              <Link
                href="/projects"
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium text-sm"
              >
                <FolderGit2 className="w-4 h-4" />
                Projects
              </Link>

              {/* Worker Status Badge */}
              {workerStatus && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                  workerStatus.running 
                    ? 'bg-green-50 text-green-700 border border-green-200' 
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    workerStatus.running ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                  }`} />
                  Worker
                  {workerStatus.running && (
                    <span className="text-xs opacity-75">({workerStatus.check_interval}s)</span>
                  )}
                </div>
              )}

              {/* Forgejo Status (Optional) */}
              {forgejoStatus && (
                <a
                  href={FORGEJO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80 ${
                    forgejoStatus.status === 'online'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-gray-50 text-gray-500 border border-gray-200'
                  }`}
                  title={forgejoStatus.status === 'online' ? 'Forgejo port reachable (click to open)' : 'Forgejo port not reachable'}
                >
                  <span className={`w-2 h-2 rounded-full ${
                    forgejoStatus.status === 'online' ? 'bg-blue-500' : 'bg-gray-400'
                  }`} />
                  Forgejo
                </a>
              )}

              {/* Taiga Status (Optional) */}
              {taigaStatus && (
                <a
                  href={TAIGA_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80 ${
                    taigaStatus.status === 'online'
                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                      : 'bg-gray-50 text-gray-500 border border-gray-200'
                  }`}
                  title={taigaStatus.status === 'online' ? 'Taiga port reachable (click to open)' : 'Taiga port not reachable'}
                >
                  <span className={`w-2 h-2 rounded-full ${
                    taigaStatus.status === 'online' ? 'bg-purple-500' : 'bg-gray-400'
                  }`} />
                  Taiga
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Runs</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{runs?.length || 0}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Play className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{activeCount}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <RefreshCw className="w-6 h-6 text-green-600 animate-spin" style={{ animationDuration: '3s' }} />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-3xl font-bold text-emerald-600 mt-1">
                  {runs?.filter(r => r.status === 'COMPLETED').length || 0}
                </p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-lg">
                <Activity className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Failed</p>
                <p className="text-3xl font-bold text-red-600 mt-1">
                  {runs?.filter(r => r.status === 'FAILED').length || 0}
                </p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card className="p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Runs
              </button>
              <button
                onClick={() => setFilter('active')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                  filter === 'active'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Filter className="w-4 h-4" />
                Active Only
                {activeCount > 0 && (
                  <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs">
                    {activeCount}
                  </span>
                )}
              </button>
            </div>

            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by goal or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </Card>

        {/* Runs List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Runs {filter === 'active' && '(Active)'}
            </h2>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus className="w-4 h-4" />
              Create Run
            </button>
          </div>

          {runsLoading && !runs && !runsError ? (
            <Card className="p-12">
              <div className="flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
                <span className="ml-3 text-gray-600">Loading runs...</span>
              </div>
            </Card>
          ) : runsError ? (
            <Card className="p-6">
              <EmptyState
                icon={<AlertCircle className="w-12 h-12" />}
                title="Failed to load runs"
                description={runsError}
              />
            </Card>
          ) : filteredRuns.length === 0 ? (
            <Card className="p-6">
              <EmptyState
                icon={<Play className="w-12 h-12" />}
                title={searchQuery ? 'No runs found' : 'No runs yet'}
                description={searchQuery ? 'Try adjusting your search query' : 'Create your first run to get started'}
                action={
                  !searchQuery && (
                    <button
                      onClick={() => setIsCreateModalOpen(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 mx-auto"
                    >
                      <Plus className="w-4 h-4" />
                      Create Your First Run
                    </button>
                  )
                }
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredRuns.map((run) => (
                <Link key={run.id} href={`/runs/${run.id}`}>
                  <Card className="p-6 hover:border-blue-300 transition-all cursor-pointer">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {run.name || `Run #${run.id}`}
                          </h3>
                          <StatusPill status={run.status} />
                          {run.run_type && run.run_type !== 'agent' && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                              {run.run_type}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-700 mb-2 line-clamp-2">{run.goal}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                          <span>Project ID: {run.project_id}</span>
                          <span>•</span>
                          <span>Iteration: {run.current_iteration}</span>
                          <span>•</span>
                          <span>{formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}</span>
                        </div>
                      </div>

                      {['QUEUED', 'RUNNING'].includes(run.status) && (
                        <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Processing...
                        </div>
                      )}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Run Modal */}
      <CreateRunModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(runId) => {
          // Clear any existing timeouts
          if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
          if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);

          // Show toast
          setShowToast(true);
          toastTimeoutRef.current = setTimeout(() => setShowToast(false), 3000);
          navTimeoutRef.current = setTimeout(() => router.push(`/runs/${runId}`), 500);
        }}
        apiUrl={API_URL}
      />
    </div>
  );
}
