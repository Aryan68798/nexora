/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    screens: {
      xs: '360px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        cream: '#0D0D0D', // Dark page background (Oliver Smith theme)
        sand: {
          DEFAULT: '#141414', // Dark sections & elevated surfaces
          50: '#2A2A2A',
          100: '#222222',
          200: '#1C1C1C',
          300: '#181818',
          400: '#141414',
          500: '#101010',
          600: '#A3A3A3',
          700: '#CCCCCC',
          800: '#E5E5E5',
          900: '#F5F5F5',
        },
        card: '#1C1C1C', // Dark elevated cards
        border: '#2A2A2A', // Subtle hairline dividers & borders
        ink: '#F5F5F5', // Crisp heading & high-contrast text
        body: '#A3A3A3', // Refined neutral body text
        primary: {
          DEFAULT: '#FE6D2C', // Oliver Smith vibrant terracotta/orange
          hover: '#E55B1B',   // Primary hover
          50: '#2C1B14',
          100: '#3D2217',
          200: '#542D1C',
          300: '#7A3C21',
          400: '#B85324',
          500: '#DE6027',
          600: '#FE6D2C',
          700: '#E55B1B',
          800: '#C24810',
          900: '#943306',
        },
        terracotta: {
          DEFAULT: '#FE6D2C',
          hover: '#E55B1B',
          50: '#2C1B14',
          100: '#3D2217',
          200: '#542D1C',
          300: '#7A3C21',
          400: '#B85324',
          500: '#DE6027',
          600: '#FE6D2C',
          700: '#E55B1B',
          800: '#C24810',
          900: '#943306',
        },
        amber: {
          DEFAULT: '#FFA733',
          50: '#261C10',
          100: '#3D2A14',
          200: '#5A3D1A',
          300: '#8A5C22',
          400: '#C4812B',
          500: '#FFA733',
          600: '#E58E1B',
          700: '#BF7110',
          800: '#945308',
          900: '#693803',
        },
        success: {
          DEFAULT: '#4C8C5A',
          50: '#142618',
          100: '#1C3A24',
          500: '#4C8C5A',
          600: '#3D7449',
          700: '#2F5C39',
        },
        warning: {
          DEFAULT: '#D98E04',
          50: '#261F10',
          100: '#3D3014',
          500: '#D98E04',
          600: '#B87602',
        },
        danger: {
          DEFAULT: '#E04838',
          50: '#261412',
          100: '#3D1C1A',
          500: '#E04838',
          600: '#C23628',
          700: '#9E281C',
        },
      },
      fontFamily: {
        editorial: ['"Bodoni Moda Variable"', '"Bodoni Moda"', 'Didot', 'Bodoni MT', 'serif'],
        display: ['Fraunces Variable', 'Fraunces', 'Georgia', 'serif'],
        sans: ['Inter Variable', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        warm: '0 2px 8px -1px rgba(0, 0, 0, 0.4), 0 1px 3px -1px rgba(0, 0, 0, 0.3)',
        'warm-sm': '0 1px 3px rgba(0, 0, 0, 0.35), 0 1px 2px rgba(0, 0, 0, 0.25)',
        'warm-md': '0 4px 14px -2px rgba(0, 0, 0, 0.5), 0 2px 6px -1px rgba(0, 0, 0, 0.35)',
        'warm-lg': '0 12px 24px -4px rgba(0, 0, 0, 0.6), 0 4px 10px -2px rgba(0, 0, 0, 0.4)',
        'warm-xl': '0 20px 32px -6px rgba(0, 0, 0, 0.7), 0 8px 16px -4px rgba(0, 0, 0, 0.5)',
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      fontSize: {
        display: ['clamp(2.25rem, 4vw + 1rem, 3.75rem)', { lineHeight: '1.1', letterSpacing: '-0.025em' }],
        h1: ['clamp(1.85rem, 3vw + 0.75rem, 2.75rem)', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        h2: ['clamp(1.5rem, 2vw + 0.5rem, 2.125rem)', { lineHeight: '1.25', letterSpacing: '-0.015em' }],
        h3: ['clamp(1.25rem, 1.25vw + 0.5rem, 1.625rem)', { lineHeight: '1.3' }],
        h4: ['1.25rem', { lineHeight: '1.4' }],
        body: ['1rem', { lineHeight: '1.6' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6' }],
      },
    },
  },
  plugins: [],
};
