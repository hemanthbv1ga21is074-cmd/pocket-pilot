import * as React from 'react';
import {
  Utensils,
  Car,
  ShoppingBag,
  Zap,
  Home,
  Film,
  HeartPulse,
  GraduationCap,
  Repeat,
  CircleDot,
  Briefcase,
  Laptop,
  Gift,
  RotateCcw,
  Wallet,
} from 'lucide-react';
import type { CategoryKey } from '@/lib/finance/types';

export function CategoryIcon({
  category,
  className = 'h-4 w-4',
}: {
  category: CategoryKey | string;
  className?: string;
}) {
  switch (category) {
    case 'food_dining':
      return <Utensils className={className} aria-hidden="true" />;
    case 'transport':
      return <Car className={className} aria-hidden="true" />;
    case 'shopping':
      return <ShoppingBag className={className} aria-hidden="true" />;
    case 'bills_utilities':
      return <Zap className={className} aria-hidden="true" />;
    case 'housing_rent':
      return <Home className={className} aria-hidden="true" />;
    case 'entertainment':
      return <Film className={className} aria-hidden="true" />;
    case 'healthcare':
      return <HeartPulse className={className} aria-hidden="true" />;
    case 'education':
      return <GraduationCap className={className} aria-hidden="true" />;
    case 'subscriptions':
      return <Repeat className={className} aria-hidden="true" />;
    case 'salary':
      return <Briefcase className={className} aria-hidden="true" />;
    case 'freelance':
      return <Laptop className={className} aria-hidden="true" />;
    case 'gift':
      return <Gift className={className} aria-hidden="true" />;
    case 'refund':
      return <RotateCcw className={className} aria-hidden="true" />;
    case 'other_income':
      return <Wallet className={className} aria-hidden="true" />;
    case 'other_expense':
    default:
      return <CircleDot className={className} aria-hidden="true" />;
  }
}
