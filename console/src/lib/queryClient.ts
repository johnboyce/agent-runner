import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Prevent automatic refetches on window focus in dev mode to reduce noise
      refetchOnWindowFocus: false,
      // Keep data fresh for a reasonable time
      staleTime: 2000,
      // Retry failed requests with exponential backoff
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Don't throw errors, handle them in components
      throwOnError: false,
    },
    mutations: {
      // Don't throw errors, handle them in components
      throwOnError: false,
    },
  },
});
