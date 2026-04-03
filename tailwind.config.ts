import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        terminalai: {
          bg: '#0d1117',
          terminal: '#0a0e13',
          chat: '#161b22',
          border: '#30363d',
          text: '#e6edf3',
          muted: '#8b949e',
          accent: '#58a6ff',
          success: '#3fb950',
          warning: '#f0883e',
          danger: '#ff7b72',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
