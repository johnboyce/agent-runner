'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_AGENT_RUNNER_URL}/projects`);
        const projectsData = await response.json();
        setProjects(projectsData);

        const runsResponse = await fetch(`${process.env.NEXT_PUBLIC_AGENT_RUNNER_URL}/runs`);
        const runsData = await runsResponse.json();
        setRuns(runsData);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch data');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Agent Runner Console</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Projects</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div key={project.id} className="border p-4 rounded">
              <h3 className="font-medium">{project.name}</h3>
              <p className="text-sm text-gray-600">{project.local_path}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Runs</h2>
        <div className="space-y-2">
          {runs.map((run) => (
            <div key={run.id} className="border p-4 rounded">
              <div className="flex justify-between items-center">
                <Link href={`/runs/${run.id}`} className="font-medium">
                  Run #{run.id} - {run.goal}
                </Link>
                <span className={`px-2 py-1 rounded text-xs ${
                  run.status === 'RUNNING' ? 'bg-green-100 text-green-800' :
                  run.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-800' :
                  run.status === 'STOPPED' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {run.status}
                </span>
              </div>
              <p className="text-sm text-gray-600">Project ID: {run.project_id}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
