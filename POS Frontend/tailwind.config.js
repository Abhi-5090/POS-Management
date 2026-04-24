/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        /* App chrome — deep cool navy with slight blue cast */
        navy: {
          950: '#0B1524',
          900: '#112135',
          800: '#172B43',
          700: '#1E3653',
          600: '#2B3F5C',
          500: '#3B506E',
        },
        /* Inner panels / dark cards */
        panel: {
          900: '#1A2B41',
          800: '#22344E',
          700: '#2D4259',
        },
        /* Accent "Dine-In" blue (gradient-friendly) */
        brand: {
          50: '#EAF3FF',
          100: '#CFE3FF',
          500: '#3B8CF0',
          600: '#2F79DE',
          700: '#225FB8',
          900: '#143A77',
        },
        /* Accent orange (Takeaway / Send to Kitchen) */
        flame: {
          50: '#FFF3E2',
          400: '#F5A623',
          500: '#F39421',
          600: '#E77E1C',
          700: '#C8621A',
        },
        /* Green (Available / Generate Bill) */
        leaf: {
          500: '#28A85C',
          600: '#239950',
          700: '#1E8546',
        },
        /* Red (Occupied / Clear / cancel) */
        ember: {
          500: '#E0443C',
          600: '#CA3A34',
          700: '#A7302B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 6px 18px -4px rgba(8, 14, 24, 0.45), 0 2px 6px -2px rgba(8,14,24,0.25)',
        'card-lg': '0 18px 40px -12px rgba(8, 14, 24, 0.55)',
        'inset-panel': 'inset 0 1px 0 rgba(255,255,255,0.04)',
        'btn-orange': '0 8px 0 -2px #C8621A, 0 14px 18px -10px rgba(231,126,28,0.6)',
        'btn-green': '0 8px 0 -2px #1E8546, 0 14px 18px -10px rgba(30,133,70,0.5)',
        'btn-red': '0 6px 0 -2px #A7302B, 0 12px 16px -10px rgba(224,68,60,0.5)',
        'btn-blue': '0 10px 0 -2px #225FB8, 0 20px 30px -12px rgba(34,95,184,0.55)',
      },
      backgroundImage: {
        'navy-grad': 'linear-gradient(160deg, #172B43 0%, #0B1524 100%)',
        'blue-card': 'linear-gradient(160deg, #4F9AF5 0%, #265FC5 100%)',
        'orange-card': 'linear-gradient(160deg, #F7A53B 0%, #E27915 100%)',
        'green-pill': 'linear-gradient(180deg, #2FB96A 0%, #1E8546 100%)',
        'red-pill': 'linear-gradient(180deg, #EB5950 0%, #A7302B 100%)',
        'flame-pill': 'linear-gradient(180deg, #F7A53B 0%, #C8621A 100%)',
        'panel-grad': 'linear-gradient(180deg, #22344E 0%, #1A2B41 100%)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
};
