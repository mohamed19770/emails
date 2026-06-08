/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Disable JIT variability - use explicit safelist for deterministic builds
  safelist: [
    'glass',
    'glass-strong', 
    'glass-subtle',
    'hairline',
    'noise',
    'animate-float-slow',
    'animate-float-medium', 
    'animate-float-fast',
    'animate-drift-x',
    'animate-drift-y',
    'animate-rotate-slow',
    'animate-rotate-reverse',
    'animate-pulse-glow',
    'animate-shimmer',
    'blob--1',
    'blob--2', 
    'blob--3',
    'blob--4',
    'blob--5',
    'blob--6',
    'focus-ring',
    'hover-lift',
    'hover-glow'
  ],
  theme: {
    extend: {
      colors: {
        // Liquid Glass color system - ALL values from tokens
        'bg': 'var(--bg)',
        'fg': 'var(--fg)',
        'glass': 'var(--glass)',
        'glass-2': 'var(--glass-2)',
        'glass-strong': 'var(--glass-strong)',
        'glass-subtle': 'var(--glass-subtle)',
        'accent-1': 'var(--accent-1)',
        'accent-2': 'var(--accent-2)',
        'accent-3': 'var(--accent-3)',
        'accent-4': 'var(--accent-4)',
        'accent-5': 'var(--accent-5)',
        'success': 'var(--success)',
        'warning': 'var(--warning)',
        'error': 'var(--error)',
        'info': 'var(--info)',
      },
      spacing: {
        'xs': 'var(--space-xs)',
        'sm': 'var(--space-sm)',
        'md': 'var(--space-md)',
        'lg': 'var(--space-lg)',
        'xl': 'var(--space-xl)',
        '2xl': 'var(--space-2xl)',
        '3xl': 'var(--space-3xl)',
        '4xl': 'var(--space-4xl)',
      },
      borderRadius: {
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
        'full': 'var(--radius-full)',
      },
      backdropBlur: {
        'subtle': 'var(--blur-subtle)',
        'medium': 'var(--blur-medium)',
        'strong': 'var(--blur-strong)',
        'extra': 'var(--blur-extra)',
      },
      boxShadow: {
        'soft': 'var(--shadow-soft)',
        'medium': 'var(--shadow-medium)',
        'strong': 'var(--shadow-strong)',
        'glow': 'var(--shadow-glow)',
      },
      fontSize: {
        'xs': 'var(--font-size-xs)',
        'sm': 'var(--font-size-sm)',
        'base': 'var(--font-size-base)',
        'lg': 'var(--font-size-lg)',
        'xl': 'var(--font-size-xl)',
        '2xl': 'var(--font-size-2xl)',
        '3xl': 'var(--font-size-3xl)',
        '4xl': 'var(--font-size-4xl)',
        '5xl': 'var(--font-size-5xl)',
      },
      fontWeight: {
        'normal': 'var(--font-weight-normal)',
        'medium': 'var(--font-weight-medium)',
        'semibold': 'var(--font-weight-semibold)',
        'bold': 'var(--font-weight-bold)',
      },
      lineHeight: {
        'tight': 'var(--line-height-tight)',
        'normal': 'var(--line-height-normal)',
        'relaxed': 'var(--line-height-relaxed)',
      },
      animation: {
        // Deterministic animations with fixed durations from tokens
        'float-slow': 'float-slow var(--anim-duration-slow) var(--ease-ease-in-out) infinite',
        'float-medium': 'float-medium var(--anim-duration-med) var(--ease-ease-in-out) infinite',
        'float-fast': 'float-fast var(--anim-duration-fast) var(--ease-ease-in-out) infinite',
        'drift-x': 'drift-x var(--anim-duration-slow) var(--ease-linear) infinite',
        'drift-y': 'drift-y var(--anim-duration-med) var(--ease-linear) infinite',
        'rotate-slow': 'rotate-slow var(--anim-duration-ultra) var(--ease-linear) infinite',
        'rotate-reverse': 'rotate-reverse var(--anim-duration-slow) var(--ease-linear) infinite',
        'pulse-glow': 'pulse-glow 2s var(--ease-ease-in-out) infinite',
        'shimmer': 'shimmer 2s var(--ease-linear) infinite',
      },
      keyframes: {
        // Fixed keyframes - no randomness
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '25%': { transform: 'translateY(-12px) rotate(1deg)' },
          '50%': { transform: 'translateY(-8px) rotate(0deg)' },
          '75%': { transform: 'translateY(-16px) rotate(-1deg)' },
        },
        'float-medium': {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '33%': { transform: 'translateY(-8px) rotate(0.5deg)' },
          '66%': { transform: 'translateY(-4px) rotate(-0.5deg)' },
        },
        'float-fast': {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-6px) rotate(0.3deg)' },
        },
        'drift-x': {
          '0%, 100%': { transform: 'translateX(0px)' },
          '50%': { transform: 'translateX(20px)' },
        },
        'drift-y': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(15px)' },
        },
        'rotate-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'rotate-reverse': {
          '0%': { transform: 'rotate(360deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
        'pulse-glow': {
          '0%, 100%': { 
            boxShadow: '0 0 20px rgba(109, 220, 255, 0.3)',
            transform: 'scale(1)'
          },
          '50%': { 
            boxShadow: '0 0 30px rgba(109, 220, 255, 0.5)',
            transform: 'scale(1.02)'
          },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      fontFamily: {
        'sans': ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
      },
      zIndex: {
        'dropdown': 'var(--z-dropdown)',
        'sticky': 'var(--z-sticky)',
        'fixed': 'var(--z-fixed)',
        'modal-backdrop': 'var(--z-modal-backdrop)',
        'modal': 'var(--z-modal)',
        'popover': 'var(--z-popover)',
        'tooltip': 'var(--z-tooltip)',
        'toast': 'var(--z-toast)',
      },
    },
  },
  plugins: [
    // Disabled - all utilities now in liquid.css for deterministic builds
  ],
}
