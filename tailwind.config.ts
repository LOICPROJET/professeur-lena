import type { Config } from 'tailwindcss'

// ─── Design system Lumio ───────────────────────────────────────────────────────
// Palette issue de la maquette : Bleu Lumio #4F7CFF, Vert Réussite #34C759,
// Orange Motivation #FF9F0A, Rouge Doux #FF6B6B, Violet Doux #A78BFA
const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#F0F4FF',
          100: '#DEE8FF',
          200: '#C2D4FF',
          300: '#9BBAFF',
          400: '#7299FF',
          500: '#4F7CFF',
          600: '#3D63E0',
          700: '#2F4DB8',
        },
        success: '#34C759',
        warning: '#FF9F0A',
        danger: '#FF6B6B',
        info: '#4F7CFF',
        violet: {
          soft: '#A78BFA',
        },
        app: {
          bg: '#F7F9FC',
          card: '#FFFFFF',
          text: '#1D1D1F',
          muted: '#4B5563',
          border: '#E5E7EB',
        }
      },
      fontFamily: {
        sans: ['var(--font-app)', '-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'lumio': '0 8px 24px -6px rgba(79, 124, 255, 0.35)',
        'card': '0 2px 12px rgba(29, 29, 31, 0.06)',
        'card-lg': '0 8px 28px rgba(29, 29, 31, 0.10)',
      },
      animation: {
        'bounce-soft': 'bounce 1.5s ease-in-out infinite',
        'pulse-soft': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'float-slow': 'floatY 7s ease-in-out infinite',
        'float-mid': 'floatY 5s ease-in-out infinite',
        'float-fast': 'floatY 3.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        floatY: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
