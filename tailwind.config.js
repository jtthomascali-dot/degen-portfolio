/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
        serif: ['var(--font-serif)', 'Newsreader', 'serif'],
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        ink: '#0A0E0F',
        cream: '#E7E5DF',
        paper: '#ECEAE4',
        degen: {
          green:  '#3FCF8E',
          amber:  '#F5A623',
          red:    '#FF4438',
          muted:  '#7E867F',
          dim:    '#5C635D',
        }
      },
      animation: {
        'fade-in':    'fadeIn 0.4s ease forwards',
        'slide-up':   'slideUp 0.5s ease forwards',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'deg-blink':  'degBlink 1.05s steps(1) infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        degBlink: { '0%, 50%': { opacity: 1 }, '51%, 100%': { opacity: 0 } },
      }
    },
  },
  plugins: [],
}
