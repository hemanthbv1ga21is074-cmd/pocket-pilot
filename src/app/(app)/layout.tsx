import * as React from 'react';
import { AuthenticatedShell } from '@/components/layout/authenticated-shell';

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-page" />}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </React.Suspense>
  );
}
