import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        green: {
          900: 'var(--green-900)',
          700: 'var(--green-700)',
        },
        income: 'var(--income)',
        expense: 'var(--expense)',
        warning: 'var(--warning)',
        page: 'var(--bg-page)',
        card: 'var(--bg-card)',
        primary: 'var(--text-primary)',
        muted: 'var(--text-muted)',
        border: 'var(--border)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.125rem' }],     // 12px
        sm: ['0.875rem', { lineHeight: '1.25rem' }],     // 14px
        base: ['1rem', { lineHeight: '1.5rem' }],        // 16px
        lg: ['1.25rem', { lineHeight: '1.75rem' }],      // 20px
        xl: ['1.5rem', { lineHeight: '2rem' }],          // 24px
        '2xl': ['2rem', { lineHeight: '2.5rem' }],       // 32px
      },
      borderRadius: {
        card: '16px',
        control: '12px',
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
    },
  },
  plugins: [],
};

export default config;
