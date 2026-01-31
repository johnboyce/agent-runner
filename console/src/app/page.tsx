'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Play, Search, Filter, RefreshCw, Activity, AlertCircle, Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAdaptivePolling, usePolling } from '@/hooks/usePolling';
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
  goal: string;
  status: string;
  current_iteration: number;
  created_at: string;
}

interface WorkerStatus {
  running: boolean;
  check_interval: number;
}

const API_URL = process.env.NEXT_PUBLIC_AGENT_RUNNER_URL || 'http://localhost:8000';

export default function Home() {
  const [filter, setFilter] = useState<'all' | 'active'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const router = useRouter();

  // Fetch runs with adaptive polling (fast when active, slow when idle)
  const { data: runs, loading: runsLoading, error: runsError } = useAdaptivePolling<Run[]>(
    async () => {
      const response = await fetch(`${API_URL}/runs`);
      if (!response.ok) throw new Error('Failed to fetch runs');
      return response.json();
    },
    (data) => {
      // Fast poll if any runs are active
      return data?.some(run => ['QUEUED', 'RUNNING', 'PAUSED'].includes(run.status)) || false;
    }
  );

  // Fetch worker status (slower fixed polling)
  const { data: workerStatus } = usePolling<WorkerStatus>(
    async () => {
      const response = await fetch(`${API_URL}/worker/status`);
      if (!response.ok) throw new Error('Failed to fetch worker status');
      return response.json();
    },
    { interval: 5000 } // Check every 5 seconds
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
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
                Worker: {workerStatus.running ? 'Running' : 'Stopped'}
                {workerStatus.running && (
                  <span className="text-xs opacity-75">({workerStatus.check_interval}s)</span>
                )}
              </div>
            )}
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

          {runsLoading && !runs ? (
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
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            Run #{run.id}
                          </h3>
                          <StatusPill status={run.status} />
                        </div>
                        <p className="text-gray-700 mb-2 line-clamp-2">{run.goal}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
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
        onSuccess={(runId) => router.push(`/runs/${runId}`)}
        apiUrl={API_URL}
      />
    </div>
  );
}
