import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          base:   '#0f1229',
          card:   '#1a1f3a',
          card2:  '#232847',
          border: '#2e3460',
          hover:  '#1e2548',
          nav:    '#12173a',
        },
        brand: {
          DEFAULT: '#3B4FE8',
          600: '#3B4FE8',
          hover:   '#2d3dd0',
          700: '#1E2A78',
          dark:    '#1E2A78',
        },
        accent: { DEFAULT: '#F59E0B', light: '#fcd34d' },
        ok:     '#10b981',
        warn:   '#F59E0B',
        danger: '#ef4444',
        text: {
          primary: '#e2e8f0',
          secondary: '#a0aec0',
          muted: '#6b7280',
          dim: '#4b5563',
        },
        status: {
          green: '#10b981',
          red: '#ef4444',
        },
        critical: {
          DEFAULT: '#f87171',
          bg: '#450a0a',
        },
      },
      borderRadius: { card: '12px', card2: '10px' },
      boxShadow: {
        card:  '0 4px 16px rgba(0,0,0,.25)',
        glow:  '0 8px 24px rgba(59,79,232,.15)',
        'card-hover': '0 8px 24px rgba(59,79,232,.15)',
      },
      animation: {
        'fade-in':  'fadeIn .2s ease',
        'slide-up': 'slideUp .25s ease',
        'bounce-dot': 'bounceDot 1.2s infinite',
      },
      keyframes: {
        fadeIn:    { from:{opacity:'0'}, to:{opacity:'1'} },
        slideUp:   { from:{opacity:'0',transform:'translateY(8px)'}, to:{opacity:'1',transform:'translateY(0)'} },
        bounceDot: { '0%,80%,100%':{transform:'translateY(0)'}, '40%':{transform:'translateY(-8px)'} },
      },
    },
  },
  plugins: [],
}
export default config
