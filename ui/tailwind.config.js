/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sakura: {
          50:  '#FFF5F8',
          100: '#FFE4EF',
          200: '#FFB7C5',
          300: '#FF8FAB',
          400: '#FF6B8E',
          500: '#E8547A',
          600: '#C73D62',
        },
        sky: {
          50:  '#F0F8FF',
          100: '#E0F2FE',
          200: '#BAE6FD',
          300: '#87CEEB',
          400: '#5BA4CF',
          500: '#3B82C4',
        },
        cloud: {
          DEFAULT: '#FAFAFA',
          50: '#FFFFFF',
          100: '#F8F9FA',
          200: '#F1F3F5',
        },
        petal: '#FFF0F5',
        mist:  '#F7F5F8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'sakura': '0 2px 16px 0 rgba(255,183,197,0.25)',
        'sakura-lg': '0 4px 32px 0 rgba(255,143,171,0.20)',
        'message': '0 1px 6px 0 rgba(0,0,0,0.06)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'pulse-dot': {
          '0%, 80%, 100%': { transform: 'scale(0.8)', opacity: '0.4' },
          '40%': { transform: 'scale(1)', opacity: '1' },
        },
        'petal-fall': {
          '0%':   { transform: 'translateY(-10px) rotate(0deg)',   opacity: '0.8' },
          '100%': { transform: 'translateY(60px)  rotate(180deg)', opacity: '0' },
        },
      },
      animation: {
        'fade-in':   'fade-in 0.25s ease-out',
        'slide-in':  'slide-in 0.2s ease-out',
        'pulse-dot': 'pulse-dot 1.2s infinite ease-in-out',
        'petal-fall':'petal-fall 3s ease-in infinite',
      },
    },
  },
  plugins: [],
};
