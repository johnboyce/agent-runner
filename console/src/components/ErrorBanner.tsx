import { AlertCircle, X } from 'lucide-react';

interface ErrorBannerProps {
  error: Error;
  onRetry: () => void;
  onDismiss?: () => void;
}

/**
 * ErrorBanner - Displays an error message with retry and dismiss actions
 * 
 * @param error - Error object to display
 * @param onRetry - Callback function to retry the failed operation
 * @param onDismiss - Optional callback to dismiss the banner
 * @returns Error banner component with retry and dismiss buttons
 */
export function ErrorBanner({ error, onRetry, onDismiss }: ErrorBannerProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 animate-slide-in">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-red-900">Error Loading Data</h3>
          <p className="text-sm text-red-700 mt-1 wrap-break-word">{error.message}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onRetry}
            className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
          >
            Retry
          </button>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1.5 text-red-600 hover:text-red-700 rounded-md hover:bg-red-100 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
