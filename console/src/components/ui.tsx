import { ReactNode } from 'react';

interface StatusPillProps {
  status: string;
  size?: 'sm' | 'md';
}

export function StatusPill({ status, size = 'md' }: StatusPillProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
    QUEUED: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
    RUNNING: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500 animate-pulse' },
    PAUSED: { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
    STOPPED: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
    COMPLETED: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    FAILED: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  };

  const config = statusConfig[status] || { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-500' };

  return (
    <span className={`inline-flex items-center gap-1.5 ${sizeClasses} rounded-full font-medium ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {status}
    </span>
  );
}

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow ${className}`}>
      {children}
    </div>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      {icon && <div className="flex justify-center mb-4 text-gray-400">{icon}</div>}
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 mb-4">{description}</p>
      {action}
    </div>
  );
}
