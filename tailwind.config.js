/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'SF Pro Text',
          'Helvetica Neue',
          'Segoe UI',
          'Arial',
          'sans-serif',
          'Apple Color Emoji',
          'Segoe UI Emoji',
          'Segoe UI Symbol'
        ],
        mono: [
          'SF Mono',
          'Monaco',
          'Menlo',
          'Consolas',
          'Courier New',
          'monospace'
        ]
      },
      colors: {
        // Primary colors - Aureen champagne gold
        'primary': {
          light: '#D8BC85',
          DEFAULT: '#C9A86C',
          dark: '#A9863F'
        },
        // Secondary colors - deeper bronze gold
        'secondary': {
          light: '#C9A86C',
          DEFAULT: '#A9863F'
        },
        // Highlight colors - Must be in safelist for dynamic usage
        'highlight-yellow': '#F3E7C9',
        'highlight-mint': '#d1fae5',
        'highlight-coral': '#fed7d7',
        'highlight-peach': '#fde68a',
        'highlight-lavender': '#e9d5ff',
        'highlight-sky': '#dbeafe'
      }
    }
  },
  // Safelist for dynamic class names - prevents Tailwind from purging these classes
  safelist: [
    'bg-highlight-yellow',
    'bg-highlight-mint',
    'bg-highlight-coral',
    'bg-highlight-peach',
    'bg-highlight-lavender',
    'bg-highlight-sky',
    'border-highlight-yellow',
    'border-highlight-mint',
    'border-highlight-coral',
    'border-highlight-peach',
    'border-highlight-lavender',
    'border-highlight-sky',
    'text-primary',
    'text-primary-light',
    'text-primary-dark',
    'text-secondary',
    'text-secondary-light',
    'bg-primary',
    'bg-primary-light',
    'bg-primary-dark',
    'bg-secondary',
    'bg-secondary-light',
    'hover:bg-primary-dark',
    'hover:bg-secondary'
  ],
  plugins: []
};
