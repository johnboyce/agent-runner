'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Run {
  id: number;
  project_id: number;
  goal: string;
  status: string;
  current_iteration: number;
  created_at: string;
}

interface Event {
  id: number;
  run_id: number;
  type: string;
  payload: string;
  created_at: string;
}

export default function RunDetail({ params }: { params: { id: string } }) {
  const [run, setRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [directiveText, setDirectiveText] = useState('');
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const runResponse = await fetch(`${process.env.NEXT_PUBLIC_AGENT_RUNNER_URL}/runs/${params.id}`);
        const runData = await runResponse.json();
        setRun(runData);

        const eventsResponse = await fetch(`${process.env.NEXT_PUBLIC_AGENT_RUNNER_URL}/runs/${params.id}/events`);
        const eventsData = await eventsResponse.json();
        setEvents(eventsData);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch data');
        setLoading(false);
      }
    };

    fetchData();
  }, [params.id]);

  const handleAction = async (action: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_AGENT_RUNNER_URL}/runs/${params.id}/${action}`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const updatedRun = await response.json();
        setRun(updatedRun);
      } else {
        const errorData = await response.json();
        setError(`Failed to ${action}: ${errorData.detail}`);
      }
    } catch (err) {
      setError(`Failed to ${action}`);
    }
  };

  const handleDirectiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directiveText.trim()) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_AGENT_RUNNER_URL}/runs/${params.id}/directive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: directiveText }),
      });
      
      if (response.ok) {
        const newEvent = await response.json();
        setEvents(prev => [...prev, newEvent]);
        setDirectiveText('');
      } else {
        const errorData = await response.json();
        setError(`Failed to submit directive: ${errorData.detail}`);
      }
    } catch (err) {
      setError('Failed to submit directive');
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;
  if (!run) return <div className="p-4">Run not found</div>;

  return (
    <div className="p-4">
      <div className="mb-4">
        <button 
          onClick={() => router.back()}
          className="text-blue-500 hover:underline mb-4"
        >
          ← Back to Runs
        </button>
        <h1 className="text-2xl font-bold mb-2">Run #{run.id}</h1>
        <div className="mb-4">
          <p className="font-medium">Goal: {run.goal}</p>
          <p className="text-sm text-gray-600">Status: <span className={`px-2 py-1 rounded text-xs ${
            run.status === 'RUNNING' ? 'bg-green-100 text-green-800' :
            run.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-800' :
            run.status === 'STOPPED' ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-800'
          }`}>{run.status}</span></p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Controls</h2>
        <div className="flex space-x-2">
          <button 
            onClick={() => handleAction('pause')}
            disabled={run.status === 'PAUSED' || run.status === 'STOPPED'}
            className={`px-4 py-2 rounded ${
              run.status === 'PAUSED' || run.status === 'STOPPED' 
                ? 'bg-gray-300 cursor-not-allowed' 
                : 'bg-yellow-500 hover:bg-yellow-600 text-white'
            }`}
          >
            Pause
          </button>
          <button 
            onClick={() => handleAction('resume')}
            disabled={run.status === 'RUNNING'}
            className={`px-4 py-2 rounded ${
              run.status === 'RUNNING' 
                ? 'bg-gray-300 cursor-not-allowed' 
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            Resume
          </button>
          <button 
            onClick={() => handleAction('stop')}
            disabled={run.status === 'STOPPED'}
            className={`px-4 py-2 rounded ${
              run.status === 'STOPPED' 
                ? 'bg-gray-300 cursor-not-allowed' 
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
          >
            Stop
          </button>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Submit Directive</h2>
        <form onSubmit={handleDirectiveSubmit} className="flex space-x-2">
          <input
            type="text"
            value={directiveText}
            onChange={(e) => setDirectiveText(e.target.value)}
            placeholder="Enter directive text..."
            className="flex-1 border p-2 rounded"
          />
          <button 
            type="submit"
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
          >
            Submit
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Events</h2>
        <div className="space-y-2">
          {events.map((event) => (
            <div key={event.id} className="border p-3 rounded">
              <div className="flex justify-between">
                <span className="font-medium">{event.type}</span>
                <span className="text-sm text-gray-500">{new Date(event.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-1 text-gray-700">{event.payload}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
