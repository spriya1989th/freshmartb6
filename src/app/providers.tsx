'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
  }));
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster position="top-right" toastOptions={{
        style: { borderRadius: '10px', fontSize: '13px', fontWeight: '500' },
        success: { iconTheme: { primary: '#059669', secondary: '#fff' } },
        error:   { iconTheme: { primary: '#dc2626', secondary: '#fff' } },
      }} />
    </QueryClientProvider>
  );
}
