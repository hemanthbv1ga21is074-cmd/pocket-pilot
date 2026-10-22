'use client';

import * as React from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatMoney } from '@/lib/finance/money';
import type { ChartBucket, EvaluatedBudget } from '@/lib/finance';

export function MonthlySavingsRateChart({
  buckets,
}: {
  buckets: ChartBucket[];
}) {
  const data = buckets.map((b) => ({
    name: b.label,
    'Savings Rate (%)':
      b.savingsRatePct !== null ? Number(b.savingsRatePct.toFixed(1)) : 0,
  }));

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(val: number) => `${val}%`}
          />
          <Tooltip
            formatter={(val: number) => [`${val.toFixed(1)}%`, 'Savings Rate']}
            contentStyle={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border)',
              borderRadius: '12px',
              color: 'var(--text-primary)',
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="Savings Rate (%)"
            stroke="var(--income)"
            strokeWidth={2.5}
            dot={{ r: 4, fill: 'var(--income)' }}
            isAnimationActive={true}
            animationDuration={250}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BudgetPerformanceChart({
  budgets,
  currency = 'INR',
}: {
  budgets: EvaluatedBudget[];
  currency?: string;
}) {
  const data = budgets.map((b) => ({
    name: b.categoryLabel,
    Limit: b.limitMinor / 100,
    Spent: b.spentMinor / 100,
  }));

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(val: number) =>
              val >= 1000 ? `₹${Math.round(val / 1000)}k` : `₹${val}`
            }
          />
          <Tooltip
            formatter={(val: number, name: string) => [
              formatMoney(Math.round(val * 100), { currency }),
              name,
            ]}
            contentStyle={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border)',
              borderRadius: '12px',
              color: 'var(--text-primary)',
            }}
          />
          <Legend />
          <Bar
            dataKey="Limit"
            fill="#7C857F"
            radius={[6, 6, 0, 0]}
            isAnimationActive={true}
            animationDuration={250}
          />
          <Bar
            dataKey="Spent"
            fill="var(--expense)"
            radius={[6, 6, 0, 0]}
            isAnimationActive={true}
            animationDuration={250}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
