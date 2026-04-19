/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark Strawberry — "Warm Night" palette (v2)
        // Warm dark neutrals — no purple, no fantasy. Think: well-lit night cafe.
        //
        // bg:             #111110  — warm near-black (charcoal, not void)
        // surface:        #1c1a18  — warm dark card surface
        // surface-high:   #272420  — elevated surface / hover state
        // border:         #38342e  — warm gray border
        // border-bright:  #5a5248  — brighter warm border / focus
        // text:           #f4efe8  — warm off-white (cream, not blue-white)
        // muted:          #9c9188  — warm gray-tan muted text
        // accent:         #e8614a  — deep coral-red (strawberry fruit, not fuchsia)
        // accent-sec:     #f5a623  — warm amber (secondary accent — warmth)
        // accent-soft:    #f28b74  — soft coral for hover states
        // red-deep:       #9b3a2a  — deep warm red (brand anchor)
        primary: {
          50:  '#fef3f0',
          100: '#fde0d8',
          200: '#fbbfb0',
          300: '#f89280',
          400: '#f28b74',
          500: '#e8614a',
          600: '#c94a35',
          700: '#9b3a2a',
          800: '#6b2518',
          900: '#3d1509',
        },
        ds: {
          bg:           '#111110',
          surface:      '#1c1a18',
          'surface-hi': '#272420',
          border:       '#38342e',
          'border-hi':  '#5a5248',
          text:         '#f4efe8',
          muted:        '#9c9188',
          accent:       '#e8614a',
          'accent-sec': '#f5a623',
          'accent-soft':'#f28b74',
          'red-deep':   '#9b3a2a',
        },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'ds-gradient':    'linear-gradient(135deg, #111110 0%, #1c1a18 50%, #1e1b17 100%)',
        'accent-gradient':'linear-gradient(135deg, #e8614a, #f5a623)',
        'card-gradient':  'linear-gradient(135deg, rgba(39,36,32,0.7) 0%, rgba(28,26,24,0.85) 100%)',
      },
      boxShadow: {
        'glow-accent':    '0 0 20px rgba(232,97,74,0.3), 0 0 60px rgba(232,97,74,0.08)',
        'glow-accent-lg': '0 0 30px rgba(232,97,74,0.45), 0 0 80px rgba(232,97,74,0.12)',
        'card':           '0 4px 24px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.04) inset',
        'card-hover':     '0 8px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(232,97,74,0.25), 0 0 24px rgba(232,97,74,0.1)',
      },
      animation: {
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
        'float':      'float 6s ease-in-out infinite',
        'mesh-shift': 'mesh-shift 12s ease-in-out infinite alternate',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { opacity: '0.7' },
          '50%':      { opacity: '1'   },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)'  },
          '50%':      { transform: 'translateY(-8px)' },
        },
        'mesh-shift': {
          '0%':   { backgroundPosition: '0% 0%'     },
          '100%': { backgroundPosition: '100% 100%' },
        },
      },
    },
  },
  plugins: [],
}
