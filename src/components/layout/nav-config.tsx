import {
  LayoutDashboard,
  ArrowLeftRight,
  PieChart,
  Target,
  BarChart3,
  CalendarClock,
  Calculator,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  group: 'main' | 'tools' | 'system';
  mobilePrimary?: boolean;
}

export const NAV_ITEMS: ReadonlyArray<NavItem> = [
  {
    href: '/overview',
    label: 'Overview',
    icon: LayoutDashboard,
    group: 'main',
    mobilePrimary: true,
  },
  {
    href: '/transactions',
    label: 'Transactions',
    icon: ArrowLeftRight,
    group: 'main',
    mobilePrimary: true,
  },
  {
    href: '/budgets',
    label: 'Budgets',
    icon: PieChart,
    group: 'main',
    mobilePrimary: true,
  },
  {
    href: '/goals',
    label: 'Savings Goals',
    icon: Target,
    group: 'main',
    mobilePrimary: true,
  },
  {
    href: '/analytics',
    label: 'Analytics',
    icon: BarChart3,
    group: 'main',
    mobilePrimary: false,
  },
  {
    href: '/payments',
    label: 'Upcoming Payments',
    icon: CalendarClock,
    group: 'main',
    mobilePrimary: false,
  },
  {
    href: '/affordability',
    label: 'Can I Afford It?',
    icon: Calculator,
    group: 'tools',
    mobilePrimary: false,
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
    group: 'system',
    mobilePrimary: false,
  },
];

export function getPageTitle(pathname: string): string {
  const match = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
  return match?.label ?? 'Overview';
}
