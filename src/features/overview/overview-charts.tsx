'use client';

import * as React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { formatMoney } from '@/lib/finance/money';
import type { CategoryBreakdownItem, ChartBucket } from '@/lib/finance';

const DONUT_COLORS = [
  '#14533D',
  '#2E9E6B',
  '#D9695F',
  '#D9A441',
  '#3B7A57',
  '#6B8E78',
  '#B85D54',
  '#C28E2E',
  '#4F7CAC',
  '#7C857F',
];

export function CashflowBarChart({
  buckets,
  currency = 'INR',
}: {
  buckets: ChartBucket[];
  currency?: string;
}) {
  const data = buckets.map((b) => ({
    name: b.label,
    Income: b.incomeMinor / 100,
    Expenses: b.expenseMinor / 100,
    incomeMinor: b.incomeMinor,
    expenseMinor: b.expenseMinor,
  }));

  return (
    <div className="h-[280px] w-full">
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
            formatter={(value: number, name: string) => [
              formatMoney(Math.round(value * 100), { currency }),
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
            dataKey="Income"
            fill="var(--income)"
            radius={[6, 6, 0, 0]}
            isAnimationActive={true}
            animationDuration={250}
          />
          <Bar
            dataKey="Expenses"
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

export function CategoryDonutChart({
  items,
  selectedCategory,
  onSelectCategory,
  currency = 'INR',
}: {
  items: CategoryBreakdownItem[];
  selectedCategory: string | null;
  onSelectCategory: (category: string) => void;
  currency?: string;
}) {
  const data = items.map((item) => ({
    name: item.label,
    category: item.category,
    value: item.amountMinor / 100,
    amountMinor: item.amountMinor,
    percentage: item.percentage,
  }));

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={58}
            outerRadius={92}
            paddingAngle={2}
            isAnimationActive={true}
            animationDuration={250}
            onClick={(entry) => {
              if (entry?.category) {
                onSelectCategory(entry.category);
              }
            }}
          >
            {data.map((entry, idx) => (
              <Cell
                key={entry.category}
                fill={DONUT_COLORS[idx % DONUT_COLORS.length]}
                stroke={
                  selectedCategory === entry.category ? 'var(--text-primary)' : 'var(--bg-card)'
                }
                strokeWidth={selectedCategory === entry.category ? 2.5 : 1}
                style={{ cursor: 'pointer' }}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [
              formatMoney(Math.round(value * 100), { currency }),
              name,
            ]}
            contentStyle={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border)',
              borderRadius: '12px',
              color: 'var(--text-primary)',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
