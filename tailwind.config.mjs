/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        ivory:      'var(--ivory)',
        'ivory-2':  'var(--ivory-2)',
        cream:      'var(--cream)',
        ink:        'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        muted:      'var(--muted)',
        line:       'var(--line)',
        'line-2':   'var(--line-2)',
        forest:     'var(--forest)',
        'forest-2': 'var(--forest-2)',
        'forest-deep': 'var(--forest-deep)',
        coral:      'var(--coral)',
        'coral-2':  'var(--coral-2)',
        sunset:     'var(--sunset)',
        gold:       'var(--gold)',
        blush:      'var(--blush)',
        ok:         'var(--ok)',
      },
      fontFamily: {
        display: ['Poppins', 'system-ui', 'sans-serif'],
        serif:   ['Poppins', 'system-ui', 'sans-serif'],
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['Inter', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '14px',
        lg: '22px',
        sm: '8px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(255,107,157,0.08), 0 2px 6px rgba(255,107,157,0.06)',
        DEFAULT: '0 4px 14px rgba(255,107,157,0.12), 0 12px 32px rgba(255,107,157,0.10)',
        lg: '0 20px 60px rgba(255,107,157,0.22)',
      },
    },
  },
  plugins: [],
};
