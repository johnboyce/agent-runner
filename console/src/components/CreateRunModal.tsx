import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, Loader2, Plus, AlertCircle } from 'lucide-react';

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

interface RunOptions {
  dry_run: boolean;
  verbose: boolean;
  max_steps: number | null;
}

/**
 * CreateRunModal - Modal dialog for creating new agent runs
 * 
 * Provides a comprehensive form for creating runs with:
 * - Project selection
 * - Run configuration (name, type, goal)
 * - Execution options (dry run, verbose, max steps)
 * - Custom metadata in JSON format
 * 
 * @param isOpen - Controls modal visibility
 * @param onClose - Callback when modal is closed
 * @param onSuccess - Callback with run ID when run is created successfully
 * @param apiUrl - Base URL for the API
 * @returns Modal component for run creation
 */
export function CreateRunModal({ isOpen, onClose, onSuccess, apiUrl }: CreateRunModalProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [runName, setRunName] = useState('');
  const [runType, setRunType] = useState<string>('agent');
  const [goal, setGoal] = useState('');
  const [metadataJson, setMetadataJson] = useState('{}');
  const [options, setOptions] = useState<RunOptions>({
    dry_run: false,
    verbose: false,
    max_steps: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [fetchingProjects, setFetchingProjects] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Example JSON for metadata field
  const metadataExample = '{"priority": "high", "team": "backend"}';

  // Generate default run name
  const getDefaultRunName = () => {
    const now = new Date();
    return `Run - ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (isOpen) {
      fetchProjects();

      // Load last-used project from localStorage
      const lastProjectId = localStorage.getItem('lastUsedProjectId');
      if (lastProjectId) {
        setSelectedProjectId(lastProjectId);
      }

      // Reset form
      setRunName('');
      setRunType('agent');
      setGoal('');
      setMetadataJson('{}');
      setOptions({
        dry_run: false,
        verbose: false,
        max_steps: null,
      });
      setError(null);
      setJsonError(null);
      setShowAdvanced(false);
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

  const validateJson = (jsonString: string): boolean => {
    // Allow empty string - means no metadata
    if (!jsonString.trim()) {
      setJsonError(null);
      return true;
    }

    try {
      JSON.parse(jsonString);
      setJsonError(null);
      return true;
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Invalid JSON format');
      return false;
    }
  };

  const handleMetadataChange = (value: string) => {
    setMetadataJson(value);
    validateJson(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !goal.trim()) return;

    // Validate JSON before submission
    if (!validateJson(metadataJson)) {
      setError('Please fix JSON errors before submitting');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Parse metadata only if non-empty
      const metadata = metadataJson.trim() ? JSON.parse(metadataJson) : undefined;

      // Prepare options object
      const runOptions: any = {
        dry_run: options.dry_run,
        verbose: options.verbose,
      };
      if (options.max_steps !== null && options.max_steps > 0) {
        runOptions.max_steps = options.max_steps;
      }

      // Prepare request body
      const requestBody = {
        project_id: parseInt(selectedProjectId),
        goal: goal.trim(),
        name: runName.trim() || getDefaultRunName(),
        run_type: runType,
        options: runOptions,
        metadata: metadata,  // Will be undefined if empty
      };

      const response = await fetch(`${apiUrl}/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create run');
      }

      const data = await response.json();

      // Save last-used project to localStorage
      localStorage.setItem('lastUsedProjectId', selectedProjectId);

      // Close modal and notify parent of success
      onClose();
      onSuccess(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create run');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>

      {/* Modal */}
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
            <h2 className="text-xl font-bold text-gray-900">Create New Run</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={loading}
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
                    Create a project using the UI or the API:
                  </p>
                  <code className="block bg-yellow-100 text-yellow-900 p-3 rounded text-sm font-mono mb-4">
                    curl -X POST "http://localhost:8000/projects?name=my-project&local_path=/path/to/project"
                  </code>
                  <div className="flex gap-3 justify-center">
                    <Link
                      href="/projects"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Go to Projects
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        fetchProjects();
                      }}
                      className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
                    >
                      Refresh Projects
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Project Selection */}
                <div>
                  <label htmlFor="project" className="block text-sm font-medium text-gray-700 mb-2">
                    Project <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="project"
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                    required
                    disabled={loading}
                  >
                    {!selectedProjectId && (
                      <option value="" disabled>Select a project...</option>
                    )}
                    {projects.map((project) => (
                      <option key={project.id} value={project.id.toString()}>
                        {project.name} ({project.local_path})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    The project repository where the agent will work
                  </p>
                </div>

                {/* Run Name (Optional) */}
                <div>
                  <label htmlFor="runName" className="block text-sm font-medium text-gray-700 mb-2">
                    Run Name <span className="text-gray-400 text-xs">(optional)</span>
                  </label>
                  <input
                    id="runName"
                    type="text"
                    value={runName}
                    onChange={(e) => setRunName(e.target.value)}
                    placeholder={getDefaultRunName()}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Leave empty to auto-generate
                  </p>
                </div>

                {/* Run Type */}
                <div>
                  <label htmlFor="runType" className="block text-sm font-medium text-gray-700 mb-2">
                    Run Type
                  </label>
                  <select
                    id="runType"
                    value={runType}
                    onChange={(e) => setRunType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                    disabled={loading}
                  >
                    <option value="agent">Agent</option>
                    <option value="workflow">Workflow</option>
                    <option value="pipeline">Pipeline</option>
                    <option value="task">Task</option>
                  </select>
                  <div className="mt-2 text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="font-medium text-blue-900 mb-1">Run Type Descriptions:</p>
                    <ul className="space-y-1 ml-2">
                      <li><strong>Agent:</strong> Autonomous AI agent that executes tasks independently</li>
                      <li><strong>Workflow:</strong> Multi-step process with defined stages and transitions</li>
                      <li><strong>Pipeline:</strong> Sequential data processing with input/output stages</li>
                      <li><strong>Task:</strong> Single-purpose execution unit for specific operations</li>
                    </ul>
                  </div>
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
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    required
                    disabled={loading}
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Be specific about what you want the agent to accomplish.
                  </p>
                </div>

                {/* Options */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Options
                  </label>
                  <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={options.dry_run}
                        onChange={(e) => setOptions({ ...options, dry_run: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        disabled={loading}
                      />
                      <div>
                        <div className="font-medium text-gray-900">Dry Run</div>
                        <div className="text-xs text-gray-500">Simulate execution without making changes</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={options.verbose}
                        onChange={(e) => setOptions({ ...options, verbose: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        disabled={loading}
                      />
                      <div>
                        <div className="font-medium text-gray-900">Verbose Logging</div>
                        <div className="text-xs text-gray-500">Enable detailed execution logs</div>
                      </div>
                    </label>

                    <div className="flex items-center gap-3">
                      <label htmlFor="maxSteps" className="flex-1">
                        <div className="font-medium text-gray-900">Max Steps</div>
                        <div className="text-xs text-gray-500">Limit the number of execution steps</div>
                      </label>
                      <input
                        id="maxSteps"
                        type="number"
                        min="1"
                        max="1000"
                        value={options.max_steps || ''}
                        onChange={(e) => setOptions({ ...options, max_steps: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="Unlimited"
                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>

                {/* Metadata (JSON) */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-700 mb-2 hover:text-gray-900 transition-colors"
                  >
                    <span>Advanced Options</span>
                    <span className={`transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </button>
                  
                  {showAdvanced && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                      <div>
                        <label htmlFor="metadata" className="block text-sm font-medium text-gray-700 mb-2">
                          Custom Metadata <span className="text-gray-400 text-xs">(optional)</span>
                        </label>
                        <textarea
                          id="metadata"
                          value={metadataJson}
                          onChange={(e) => handleMetadataChange(e.target.value)}
                          placeholder='{"key": "value", "priority": "high"}'
                          rows={4}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm ${
                            jsonError ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                          }`}
                          disabled={loading}
                        />
                        {jsonError && (
                          <div className="mt-2 flex items-start gap-2 text-sm text-red-600">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{jsonError}</span>
                          </div>
                        )}
                        <div className="mt-2 text-xs text-gray-600 space-y-1">
                          <p className="font-medium">Add custom key-value pairs as JSON:</p>
                          <ul className="list-disc ml-4 space-y-0.5">
                            <li>Example: <code className="bg-gray-200 px-1 rounded">{metadataExample}</code></li>
                            <li>Leave as <code className="bg-gray-200 px-1 rounded">{"{}"}</code> if no metadata needed</li>
                            <li>Must be valid JSON format</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Error Display */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-900">Error</p>
                      <p className="text-sm text-red-700 mt-1">{error}</p>
                    </div>
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
                    disabled={loading || !goal.trim() || !selectedProjectId || !!jsonError}
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
                        Create & Start
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      </div>
    </>
  );
}
