'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { ActivityTicker } from '@/components/ActivityTicker';
import { SSEStatusProvider } from '@/contexts/SSEStatusContext';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SSEStatusProvider>
        {children}
        <ActivityTicker />
      </SSEStatusProvider>
    </QueryClientProvider>
  );
}
