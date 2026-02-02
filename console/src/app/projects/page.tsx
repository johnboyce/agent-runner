'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FolderGit2, Plus, Loader2, AlertCircle, ArrowLeft, Trash2, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, EmptyState } from '@/components/ui';

interface Project {
  id: number;
  name: string;
  local_path: string;
  created_at: string;
}

const API_URL = process.env.NEXT_PUBLIC_AGENT_RUNNER_URL || 'http://localhost:8000';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectPath, setNewProjectPath] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_URL}/projects`);
      if (!response.ok) throw new Error('Failed to fetch projects');
      const data = await response.json();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !newProjectPath.trim()) return;

    setCreating(true);
    setCreateError(null);

    try {
      const response = await fetch(`${API_URL}/projects?name=${encodeURIComponent(newProjectName)}&local_path=${encodeURIComponent(newProjectPath)}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create project');
      }

      // Reset form and close modal
      setNewProjectName('');
      setNewProjectPath('');
      setIsCreateModalOpen(false);

      // Refresh projects list
      await fetchProjects();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 backdrop-blur-sm bg-white/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <FolderGit2 className="w-7 h-7 text-blue-600" />
                  Projects
                </h1>
                <p className="text-sm text-gray-500 mt-1">Manage your agent runner projects</p>
              </div>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              Create Project
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Projects</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{projects.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <FolderGit2 className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Projects List */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">All Projects</h2>

          {loading ? (
            <Card className="p-12">
              <div className="flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                <span className="ml-3 text-gray-600">Loading projects...</span>
              </div>
            </Card>
          ) : error ? (
            <Card className="p-6">
              <EmptyState
                icon={<AlertCircle className="w-12 h-12" />}
                title="Failed to load projects"
                description={error}
                action={
                  <button
                    onClick={fetchProjects}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Retry
                  </button>
                }
              />
            </Card>
          ) : projects.length === 0 ? (
            <Card className="p-6">
              <EmptyState
                icon={<FolderGit2 className="w-12 h-12" />}
                title="No projects yet"
                description="Create your first project to start running agents"
                action={
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 mx-auto"
                  >
                    <Plus className="w-4 h-4" />
                    Create Your First Project
                  </button>
                }
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => (
                <Card key={project.id} className="p-6 hover:border-blue-300 transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <FolderGit2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                      </div>
                      <p className="text-gray-700 mb-2 font-mono text-sm bg-gray-50 px-3 py-2 rounded border border-gray-200">
                        {project.local_path}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar className="w-4 h-4" />
                        <span>Created {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Project Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Create New Project</h2>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setCreateError(null);
                  setNewProjectName('');
                  setNewProjectPath('');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={creating}
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            {/* Content */}
            <form onSubmit={handleCreateProject} className="p-6 space-y-6">
              {/* Project Name */}
              <div>
                <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="projectName"
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="my-agent-project"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                  required
                  disabled={creating}
                />
                <p className="mt-1 text-xs text-gray-500">
                  A descriptive name for your project
                </p>
              </div>

              {/* Project Path */}
              <div>
                <label htmlFor="projectPath" className="block text-sm font-medium text-gray-700 mb-2">
                  Local Path <span className="text-red-500">*</span>
                </label>
                <input
                  id="projectPath"
                  type="text"
                  value={newProjectPath}
                  onChange={(e) => setNewProjectPath(e.target.value)}
                  placeholder="/path/to/your/project"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 font-mono"
                  required
                  disabled={creating}
                />
                <p className="mt-1 text-xs text-gray-500">
                  The absolute path to the project directory on the server
                </p>
              </div>

              {/* Error Display */}
              {createError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-900">Error</p>
                    <p className="text-sm text-red-700 mt-1">{createError}</p>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setCreateError(null);
                    setNewProjectName('');
                    setNewProjectPath('');
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newProjectName.trim() || !newProjectPath.trim()}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create Project
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
