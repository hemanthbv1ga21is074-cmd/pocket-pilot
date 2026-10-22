'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Compass,
  LogOut,
  Moon,
  MoreHorizontal,
  Settings,
  Sun,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, getPageTitle } from './nav-config';
import { PeriodSelector } from './period-selector';
import { useTheme } from './theme-provider';
import { Dialog } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { formatMoney } from '@/lib/finance/money';

const SIDEBAR_STORAGE_KEY = 'pocketpilot_sidebar_collapsed';

export interface ReminderNotification {
  id: string;
  name: string;
  amountMinor: number;
  nextDueDate: string;
  status: 'overdue' | 'due_soon';
  statusLabel: string;
}

export interface AppShellProps {
  children: React.ReactNode;
  displayName?: string;
  userEmail?: string;
  currency?: string;
  reminders?: ReminderNotification[];
  hasSampleData?: boolean;
  onClearSampleData?: () => void;
  onReloadSampleData?: () => void;
  isSampleActionPending?: boolean;
  onSignOut?: () => void;
}

export function AppShell({
  children,
  displayName = 'there',
  userEmail,
  currency = 'INR',
  reminders = [],
  hasSampleData = false,
  onClearSampleData,
  onReloadSampleData,
  isSampleActionPending = false,
  onSignOut,
}: AppShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { resolvedTheme, setTheme } = useTheme();

  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [bellOpen, setBellOpen] = React.useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = React.useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = React.useState(false);

  const bellRef = React.useRef<HTMLDivElement>(null);
  const profileRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (stored !== null) {
        setIsCollapsed(stored === 'true');
      }
    } catch {
      // Ignore storage access errors
    }
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Preserve period query params across navigation
  const buildHref = React.useCallback(
    (targetPath: string) => {
      const period = searchParams.get('period');
      if (!period) return targetPath;
      const params = new URLSearchParams();
      params.set('period', period);
      const from = searchParams.get('from');
      const to = searchParams.get('to');
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      return `${targetPath}?${params.toString()}`;
    },
    [searchParams]
  );

  const mainNavItems = NAV_ITEMS.filter((i) => i.group === 'main');
  const toolNavItems = NAV_ITEMS.filter((i) => i.group === 'tools');
  const systemNavItems = NAV_ITEMS.filter((i) => i.group === 'system');
  const mobilePrimaryItems = NAV_ITEMS.filter((i) => i.mobilePrimary);
  const mobileMoreItems = NAV_ITEMS.filter((i) => !i.mobilePrimary);

  const pageTitle = getPageTitle(pathname);

  return (
    <div className="flex min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-page text-primary">
      {/* Desktop & Tablet Sidebar (hidden on <768px, icon-rail by default on 768-1023px, collapsible on >=1024px) */}
      <aside
        aria-label="Primary Sidebar Navigation"
        className={cn(
          'hidden md:flex md:flex-col md:shrink-0 bg-[#0E3B2C] text-[#EDEBE4] border-r border-white/10 transition-all duration-200 select-none',
          'md:w-20',
          isCollapsed ? 'lg:w-20' : 'lg:w-64'
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-white/10">
          <Link
            href={buildHref('/overview')}
            className="flex items-center gap-3 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9E6B]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-[#2E9E6B] text-white shadow-sm">
              <Compass className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className={cn('hidden overflow-hidden', !isCollapsed && 'lg:block')}>
              <span className="block text-base font-bold tracking-tight text-white">
                PocketPilot
              </span>
              <span className="block text-[11px] text-white/80 truncate">
                Plan your next move
              </span>
            </div>
          </Link>

          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control text-white/75 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9E6B]"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Main menu">
          <div className="space-y-1">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={buildHref(item.href)}
                  title={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'group flex min-h-[44px] items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9E6B]',
                    isActive
                      ? 'bg-[#14533D] text-white shadow-sm'
                      : 'text-white/75 hover:bg-white/10 hover:text-white',
                    'md:justify-center',
                    !isCollapsed && 'lg:justify-start'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className={cn('hidden truncate', !isCollapsed && 'lg:inline')}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Tools Group ("Can I Afford It?") */}
          <div className="space-y-1 pt-2 border-t border-white/10">
            <p
              className={cn(
                'hidden px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-white/80',
                !isCollapsed && 'lg:block'
              )}
            >
              Tools
            </p>
            {toolNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={buildHref(item.href)}
                  title={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'group flex min-h-[44px] items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9E6B]',
                    isActive
                      ? 'bg-[#14533D] text-white shadow-sm'
                      : 'text-white/75 hover:bg-white/10 hover:text-white',
                    'md:justify-center',
                    !isCollapsed && 'lg:justify-start'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className={cn('hidden truncate', !isCollapsed && 'lg:inline')}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Settings */}
          <div className="space-y-1 pt-2 border-t border-white/10">
            {systemNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={buildHref(item.href)}
                  title={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'group flex min-h-[44px] items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9E6B]',
                    isActive
                      ? 'bg-[#14533D] text-white shadow-sm'
                      : 'text-white/75 hover:bg-white/10 hover:text-white',
                    'md:justify-center',
                    !isCollapsed && 'lg:justify-start'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className={cn('hidden truncate', !isCollapsed && 'lg:inline')}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Bottom Profile Block */}
        <div className="border-t border-white/10 p-3">
          <div
            className={cn(
              'flex items-center gap-3 rounded-control px-2 py-2',
              'md:justify-center',
              !isCollapsed && 'lg:justify-start'
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#14533D] text-sm font-semibold text-white">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className={cn('hidden min-w-0 flex-1', !isCollapsed && 'lg:block')}>
              <p className="truncate text-sm font-medium text-white">{displayName}</p>
              <p className="truncate text-xs text-white/80">
                {userEmail || 'Personal Workspace'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden pb-20 md:pb-0">
        {/* Sample Data Banner (Section 5) */}
        {hasSampleData && (
          <div
            role="region"
            aria-label="Sample data notification"
            className="flex flex-wrap items-center justify-between gap-2 bg-[#D9A441]/20 border-b border-[#D9A441]/40 px-4 py-2.5 text-sm text-primary"
          >
            <div className="flex items-center gap-2 font-medium">
              <Badge variant="warning">Sample data</Badge>
              <span>
                You are viewing sample data rows alongside your workspace.
              </span>
            </div>
            <div className="flex items-center gap-2">
              {onReloadSampleData && (
                <button
                  type="button"
                  disabled={isSampleActionPending}
                  onClick={onReloadSampleData}
                  className="min-h-[36px] rounded-control border border-border bg-card px-3 py-1 text-xs font-medium text-primary hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
                >
                  Reload sample data
                </button>
              )}
              {onClearSampleData && (
                <button
                  type="button"
                  disabled={isSampleActionPending}
                  onClick={onClearSampleData}
                  className="min-h-[36px] rounded-control bg-[#14533D] px-3 py-1 text-xs font-medium text-white hover:bg-[#0E3B2C] disabled:opacity-50"
                >
                  Clear sample data
                </button>
              )}
            </div>
          </div>
        )}

        {/* Sticky Top Bar */}
        <header className="sticky top-0 z-30 flex min-h-[64px] flex-wrap items-center justify-between gap-3 border-b border-border bg-card/95 px-4 py-2.5 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href={buildHref('/overview')}
              className="flex md:hidden h-9 w-9 items-center justify-center rounded-control bg-[#0E3B2C] text-white"
              aria-label="PocketPilot Home"
            >
              <Compass className="h-5 w-5" aria-hidden="true" />
            </Link>
            <h1 className="text-lg font-bold tracking-tight text-primary sm:text-xl">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Global Period Selector */}
            <React.Suspense fallback={<div className="h-11 w-36 rounded-control bg-black/5" />}>
              <PeriodSelector />
            </React.Suspense>

            {/* Theme Quick Toggle */}
            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              aria-label={
                resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
              }
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control border border-border bg-card text-primary hover:bg-black/5 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9E6B]"
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            {/* Notifications Bell (Overdue + Due within 7 days) */}
            <div ref={bellRef} className="relative">
              <button
                type="button"
                onClick={() => setBellOpen((o) => !o)}
                aria-label={
                  reminders.length > 0
                    ? `Payment reminders (${reminders.length} active)`
                    : 'Payment reminders (none active)'
                }
                aria-expanded={bellOpen}
                className="relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control border border-border bg-card text-primary hover:bg-black/5 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9E6B]"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
                {reminders.length > 0 && (
                  <span
                    data-testid="bell-badge-count"
                    className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-expense px-1 text-[11px] font-bold text-white"
                  >
                    {reminders.length}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div
                  role="dialog"
                  aria-label="Upcoming and overdue payment reminders"
                  className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-card border border-border bg-card p-4 shadow-xl z-50"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <h2 className="text-sm font-semibold text-primary">
                      Payment Reminders
                    </h2>
                    <span className="text-xs text-muted">{reminders.length} active</span>
                  </div>
                  {reminders.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted">
                      No overdue payments or bills due in the next 7 days.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border max-h-64 overflow-y-auto my-2">
                      {reminders.map((rem) => (
                        <li key={rem.id} className="py-2.5">
                          <Link
                            href={buildHref('/payments')}
                            onClick={() => setBellOpen(false)}
                            className="flex items-center justify-between gap-2 rounded-control p-1.5 hover:bg-black/5 dark:hover:bg-white/5"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-primary">
                                {rem.name}
                              </p>
                              <p className="text-xs text-muted">Due {rem.nextDueDate}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold tabular-nums text-primary">
                                {formatMoney(rem.amountMinor, { currency })}
                              </p>
                              <Badge
                                variant={rem.status === 'overdue' ? 'expense' : 'warning'}
                              >
                                {rem.statusLabel}
                              </Badge>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link
                    href={buildHref('/payments')}
                    onClick={() => setBellOpen(false)}
                    className="mt-2 flex min-h-[40px] w-full items-center justify-center rounded-control bg-[#0E3B2C]/10 dark:bg-white/10 text-xs font-semibold text-primary hover:bg-[#0E3B2C]/15"
                  >
                    View all payments
                  </Link>
                </div>
              )}
            </div>

            {/* Profile Dropdown Menu */}
            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => setProfileMenuOpen((o) => !o)}
                aria-label="Account menu"
                aria-expanded={profileMenuOpen}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-control border border-border bg-card px-2.5 text-sm font-medium text-primary hover:bg-black/5 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9E6B]"
              >
                <User className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline max-w-[100px] truncate">
                  {displayName}
                </span>
              </button>

              {profileMenuOpen && (
                <div
                  role="menu"
                  aria-label="User account actions"
                  className="absolute right-0 mt-2 w-48 rounded-card border border-border bg-card p-1.5 shadow-xl z-50"
                >
                  <Link
                    href={buildHref('/settings')}
                    role="menuitem"
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex min-h-[44px] items-center gap-2.5 rounded-control px-3 py-2 text-sm text-primary hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <Settings className="h-4 w-4 text-muted" aria-hidden="true" />
                    Settings
                  </Link>
                  {onSignOut && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        onSignOut();
                      }}
                      className="flex min-h-[44px] w-full items-center gap-2.5 rounded-control px-3 py-2 text-sm text-expense hover:bg-expense/10"
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      Sign out
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Main Body */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation (<768px) */}
      <nav
        aria-label="Mobile bottom navigation"
        className="fixed bottom-0 left-0 right-0 z-30 flex md:hidden items-center justify-around border-t border-border bg-card/95 px-1 py-1 backdrop-blur"
      >
        {mobilePrimaryItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={buildHref(item.href)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex min-h-[48px] min-w-[60px] flex-col items-center justify-center gap-0.5 rounded-control px-2 py-1 text-[11px] font-medium transition-colors',
                isActive ? 'text-[#14533D] dark:text-[#45B883] font-semibold' : 'text-muted'
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="truncate">{item.label.replace('Savings ', '')}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setMoreSheetOpen(true)}
          aria-label="More navigation destinations"
          aria-expanded={moreSheetOpen}
          className="flex min-h-[48px] min-w-[60px] flex-col items-center justify-center gap-0.5 rounded-control px-2 py-1 text-[11px] font-medium text-muted"
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
          <span>More</span>
        </button>
      </nav>

      {/* Mobile "More" Sheet (Analytics, Payments, Affordability, Settings) */}
      <Dialog
        open={moreSheetOpen}
        onOpenChange={setMoreSheetOpen}
        title="More destinations"
        description="Navigate to Analytics, Upcoming Payments, Tools, and Settings."
      >
        <div className="grid grid-cols-1 gap-2">
          {mobileMoreItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={buildHref(item.href)}
                onClick={() => setMoreSheetOpen(false)}
                className={cn(
                  'flex min-h-[48px] items-center gap-3 rounded-control border border-border px-4 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[#14533D] text-white border-[#14533D]'
                    : 'bg-card text-primary hover:bg-black/5 dark:hover:bg-white/5'
                )}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </Dialog>
    </div>
  );
}
