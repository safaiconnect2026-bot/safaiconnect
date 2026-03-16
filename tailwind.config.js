/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#22c55e', // green-500
          dark: '#15803d',    // green-800
          light: '#bbf7d0',   // green-200
        },
        secondary: {
          DEFAULT: '#ffffff', // white
          dark: '#e5e7eb',   // gray-200
          light: '#f9fafb',  // gray-50
        },
        accent: {
          DEFAULT: '#16a34a', // green-600
          dark: '#166534',    // green-700
          light: '#86efac',   // green-300
        },
        success: '#22c55e',   // green-500
        warning: '#eab308',   // yellow-500
        error: '#ef4444',     // red-500
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },
        white: '#ffffff',
      },
    },
  },
  plugins: [],
};
