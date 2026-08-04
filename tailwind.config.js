/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand — dynamic theme colors via CSS variables
        brand: {
          50: 'var(--color-brand-50, #EAF3EE)',
          100: 'var(--color-brand-100, #D6E9DF)',
          200: 'var(--color-brand-200, #A9D3BF)',
          300: 'var(--color-brand-300, #7CBBA0)',
          400: 'var(--color-brand-400, #4FA480)',
          500: 'var(--color-brand-500, #2E8C66)',
          600: 'var(--color-brand-600, #237451)',
          700: 'var(--color-brand-700, #1B5C40)',
          800: 'var(--color-brand-800, #144430)',
          900: 'var(--color-brand-900, #0D2C20)',
        },
        // Turquoise accent (logo "Flow")
        flow: {
          50: 'var(--color-flow-50, #E6FBF7)',
          100: 'var(--color-flow-100, #C2F4E9)',
          200: 'var(--color-flow-200, #8EE9D5)',
          300: 'var(--color-flow-300, #5ADDC0)',
          400: 'var(--color-flow-400, #2FC9A8)',
          500: 'var(--color-flow-500, #14B594)',
          600: 'var(--color-flow-600, #0E9A7C)',
          700: 'var(--color-flow-700, #0A7E64)',
          800: 'var(--color-flow-800, #07614C)',
          900: 'var(--color-flow-900, #054534)',
        },
        // Orange action / primary buttons
        action: {
          50: 'var(--color-action-50, #FFF3EC)',
          100: 'var(--color-action-100, #FFE3D0)',
          200: 'var(--color-action-200, #FFC7A0)',
          300: 'var(--color-action-300, #FFA770)',
          400: 'var(--color-action-400, #FF8A4A)',
          500: 'var(--color-action-500, #F96F22)',
          600: 'var(--color-action-600, #E25A16)',
          700: 'var(--color-action-700, #BC4813)',
          800: 'var(--color-action-800, #963913)',
          900: 'var(--color-action-900, #7A3013)',
        },
        success: { 50: '#E8F8EE', 100: '#C6ECD3', 500: '#22A559', 600: '#1B8A48', 700: '#157038' },
        warning: { 50: '#FFF6E5', 100: '#FFE9B8', 500: '#F5A623', 600: '#D48A12' },
        error: { 50: '#FDECEC', 100: '#F9D2D2', 500: '#E5484D', 600: '#C8363B' },
        ink: {
          50: '#F7F8F7',
          100: '#EEF1EF',
          200: '#DCE2DD',
          300: '#C2CCC4',
          400: '#9BA89E',
          500: '#748478',
          600: '#5A675E',
          700: '#465047',
          800: '#2F372F',
          900: '#1A201A',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        xl2: '1.25rem',
        '2xl2': '1.5rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(20, 68, 48, 0.04), 0 1px 3px rgba(20, 68, 48, 0.06)',
        float: '0 10px 30px -10px rgba(20, 68, 48, 0.18)',
        glow: '0 0 0 1px rgba(46, 140, 102, 0.12), 0 8px 24px -12px rgba(46, 140, 102, 0.25)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(1.4)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
          '50%': { opacity: '0.9', transform: 'scale(1.08)' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'fade-up': 'fade-up 0.6s ease-out both',
        shimmer: 'shimmer 2.5s linear infinite',
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
