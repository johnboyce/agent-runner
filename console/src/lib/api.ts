import { withTimeout } from './timeout';
import { TIMEOUTS } from './timeouts';

const API_URL = process.env.NEXT_PUBLIC_AGENT_RUNNER_URL || 'http://localhost:8000';

export interface Run {
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

export interface Event {
  id: number;
  run_id: number;
  type: string;
  payload: string;
  created_at: string;
}

export interface WorkerStatus {
  running: boolean;
  check_interval: number;
}

/**
 * Fetch all runs
 */
export async function fetchRuns(signal: AbortSignal): Promise<Run[]> {
  const { signal: s, cleanup } = withTimeout(signal, TIMEOUTS.runs);
  try {
    const response = await fetch(`${API_URL}/runs`, { signal: s, cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to fetch runs: ${response.status}`);
    }
    return response.json();
  } finally {
    cleanup();
  }
}

/**
 * Fetch a single run by ID
 */
export async function fetchRun(runId: number, signal: AbortSignal): Promise<Run> {
  const { signal: s, cleanup } = withTimeout(signal, TIMEOUTS.run);
  try {
    const response = await fetch(`${API_URL}/runs/${runId}`, { signal: s, cache: 'no-store' });
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Run ${runId} not found`);
      }
      throw new Error(`Failed to fetch run: ${response.status}`);
    }
    return response.json();
  } finally {
    cleanup();
  }
}

/**
 * Fetch events for a run, optionally with cursor-based pagination
 */
export async function fetchRunEvents(
  runId: number,
  afterId?: number,
  signal?: AbortSignal
): Promise<Event[]> {
  const controller = new AbortController();
  const combinedSignal = signal || controller.signal;
  
  const { signal: s, cleanup } = withTimeout(combinedSignal, TIMEOUTS.events);
  try {
    const url = afterId !== undefined && afterId > 0
      ? `${API_URL}/runs/${runId}/events?after_id=${afterId}`
      : `${API_URL}/runs/${runId}/events`;
    
    const response = await fetch(url, { signal: s, cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.status}`);
    }
    return response.json();
  } finally {
    cleanup();
  }
}

/**
 * Fetch worker status
 */
export async function fetchWorkerStatus(signal: AbortSignal): Promise<WorkerStatus> {
  const { signal: s, cleanup } = withTimeout(signal, TIMEOUTS.worker);
  try {
    const response = await fetch(`${API_URL}/worker/status`, { signal: s, cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to fetch worker status: ${response.status}`);
    }
    return response.json();
  } finally {
    cleanup();
  }
}

/**
 * Perform run actions (pause, resume, stop)
 */
export async function performRunAction(runId: number, action: 'pause' | 'resume' | 'stop'): Promise<void> {
  const response = await fetch(`${API_URL}/runs/${runId}/${action}`, {
    method: 'POST',
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || `Failed to ${action} run`);
  }
}

/**
 * Submit a directive to a run
 */
export async function submitDirective(runId: number, text: string): Promise<void> {
  const response = await fetch(`${API_URL}/runs/${runId}/directive`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to submit directive');
  }
}
