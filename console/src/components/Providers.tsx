'use client';

import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { ActivityTicker } from '@/components/ActivityTicker';
import { ReactNode, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import type { Event } from '@/lib/api';

function ActivityTickerWrapper() {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  
  // Extract last event info from query cache if we're on a run detail page
  const lastEventInfo = useMemo(() => {
    const match = pathname?.match(/\/runs\/(\d+)/);
    if (!match) return undefined;
    
    const runId = parseInt(match[1], 10);
    const events = queryClient.getQueryData<Event[]>(['events', runId]);
    
    if (!events || events.length === 0) return undefined;
    
    const lastEvent = events[events.length - 1];
    return {
      lastEventId: lastEvent.id,
      lastEventTime: lastEvent.created_at,
    };
  }, [pathname, queryClient]);
  
  return <ActivityTicker {...lastEventInfo} />;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ActivityTickerWrapper />
    </QueryClientProvider>
  );
}
