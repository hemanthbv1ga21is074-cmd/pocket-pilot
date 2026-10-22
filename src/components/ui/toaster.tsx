'use client';

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <div aria-live="polite" aria-atomic="true">
      <SonnerToaster
        position="bottom-right"
        toastOptions={{
          className:
            'rounded-control border border-border bg-card text-primary shadow-lg font-sans',
        }}
      />
    </div>
  );
}
