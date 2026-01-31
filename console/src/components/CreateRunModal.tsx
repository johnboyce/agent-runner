import { useState, useEffect } from 'react';
import { X, Loader2, Plus } from 'lucide-react';

interface Project {
  id: number;
  name: string;
  local_path: string;
}

interface CreateRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (runId: number) => void;
  apiUrl: string;
}

export function CreateRunModal({ isOpen, onClose, onSuccess, apiUrl }: CreateRunModalProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchingProjects, setFetchingProjects] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchProjects();

      // Load last-used project from localStorage
      const lastProjectId = localStorage.getItem('lastUsedProjectId');
      if (lastProjectId) {
        setSelectedProjectId(lastProjectId);
      }
    }
  }, [isOpen]);

  const fetchProjects = async () => {
    try {
      const response = await fetch(`${apiUrl}/projects`);
      if (!response.ok) throw new Error('Failed to fetch projects');
      const data = await response.json();
      setProjects(data);

      // Auto-select first project if none selected
      if (data.length > 0 && !selectedProjectId) {
        setSelectedProjectId(data[0].id.toString());
      }

      setFetchingProjects(false);
    } catch (err) {
      setError('Failed to load projects');
      setFetchingProjects(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !goal.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${apiUrl}/runs?project_id=${selectedProjectId}&goal=${encodeURIComponent(goal)}`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create run');
      }

      const data = await response.json();

      // Save last-used project to localStorage
      localStorage.setItem('lastUsedProjectId', selectedProjectId);

      onSuccess(data.id);

      // Reset form
      setGoal('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create run');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Create New Run</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {fetchingProjects ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
              <span className="ml-3 text-gray-600">Loading projects...</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-yellow-900 mb-2">No Projects Found</h3>
                <p className="text-yellow-700 mb-4">
                  You need to create a project before you can create a run.
                </p>
                <p className="text-sm text-yellow-600 mb-4">
                  Create a project using:
                </p>
                <code className="block bg-yellow-100 text-yellow-900 p-3 rounded text-sm font-mono">
                  curl -X POST "http://localhost:8000/projects?name=my-project&local_path=/path/to/project"
                </code>
                <button
                  type="button"
                  onClick={() => {
                    fetchProjects();
                  }}
                  className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  Refresh Projects
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Project Selection */}
              <div>
                <label htmlFor="project" className="block text-sm font-medium text-gray-700 mb-2">
                  Project
                </label>
                <select
                  id="project"
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select a project...</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name} ({project.local_path})
                    </option>
                  ))}
                </select>
              </div>

              {/* Goal Input */}
              <div>
                <label htmlFor="goal" className="block text-sm font-medium text-gray-700 mb-2">
                  Goal <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="goal"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="Describe what you want the agent to do..."
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  required
                />
                <p className="mt-2 text-sm text-gray-500">
                  Be specific about what you want the agent to accomplish.
                </p>
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !goal.trim() || !selectedProjectId}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create & Watch
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
