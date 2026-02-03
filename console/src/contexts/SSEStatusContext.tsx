'use client';

import { createContext, useContext, ReactNode, useState, useCallback } from 'react';
import { SSEConnectionState } from '@/hooks/useRunEventsSSE';

interface SSEStatusContextType {
  connectionState: SSEConnectionState;
  setConnectionState: (state: SSEConnectionState) => void;
}

const SSEStatusContext = createContext<SSEStatusContextType | undefined>(undefined);

export function SSEStatusProvider({ children }: { children: ReactNode }) {
  const [connectionState, setConnectionState] = useState<SSEConnectionState>('disconnected');

  return (
    <SSEStatusContext.Provider value={{ connectionState, setConnectionState }}>
      {children}
    </SSEStatusContext.Provider>
  );
}

export function useSSEStatus() {
  const context = useContext(SSEStatusContext);
  if (context === undefined) {
    throw new Error('useSSEStatus must be used within SSEStatusProvider');
  }
  return context;
}
