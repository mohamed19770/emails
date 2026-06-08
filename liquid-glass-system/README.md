# Liquid Glass Design System

A **deterministic and idempotent** Liquid Glass (Glassmorphism + Gooey) design system built with React, Vite, and TailwindCSS. Features pixel-perfect stability across builds with beautiful frosted glass effects, smooth liquid animations, and comprehensive accessibility support.

## ✨ Features

- **🔮 Glassmorphism Design**: Frosted glass panels with backdrop blur and subtle transparency
- **🌊 Gooey Animations**: Smooth liquid blob animations with SVG filters
- **📱 Responsive Layout**: Fully responsive design that works on all devices
- **♿ Accessibility**: WCAG compliant with proper focus management and reduced motion support
- **⚡ Performance**: Optimized for 60fps animations with minimal GPU usage
- **🎨 Customizable**: Easy theming with CSS variables and flexible component props
- **🌙 Dark/Light Mode**: Built-in theme switching with smooth transitions
- **🔒 Deterministic**: Pixel-perfect stability across builds and machines
- **🛡️ Design Lock**: Prevents visual drift with fingerprint detection

## 🚀 Quick Start

### Prerequisites

- **Node.js v18.19.0** (see `.nvmrc`)
- npm (use `npm ci` for deterministic installs)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd liquid-glass-system

# Install dependencies (deterministic)
npm ci --legacy-peer-deps

# Start development server
npm run dev

# Build for production
npm run build
```

### Deterministic Workflow

```bash
# Check design stability
npm run test:visual

# Update visual baselines (only when design intentionally changes)
npm run test:visual:update

# Verify environment
npm run verify

# Clean and reinstall (if needed)
npm run clean && npm ci --legacy-peer-deps
```

### Vanilla HTML Demo

For a build-tool-free experience, check out the `/vanilla/` directory:

```bash
# Open vanilla/index.html in your browser
open vanilla/index.html
```

## 📦 Components

### Core Components

- **`LiquidBackdrop`** - Animated gooey blob background with SVG filters
- **`LiquidGlassCard`** - Frosted glass panel with gradient borders
- **`LiquidGlassButton`** - Glass pill button with hover effects
- **`LiquidNavbar`** - Sticky glass navigation bar
- **`LiquidStats`** - Animated KPI tiles with count-up animation

### Component Props

#### LiquidBackdrop
```jsx
<LiquidBackdrop 
  intensity={1}           // Animation intensity (0-2)
  saturation={1}          // Color saturation (0-2)
  blurStrength={10}       // SVG blur strength
  className="custom"      // Additional CSS classes
>
  {children}
</LiquidBackdrop>
```

#### LiquidGlassCard
```jsx
<LiquidGlassCard 
  tone="default"          // 'default' | 'positive' | 'warning'
  hover={true}           // Enable hover effects
  as="section"           // HTML element type
  header={<h2>Title</h2>} // Optional header
  footer={<p>Footer</p>}  // Optional footer
>
  Card content
</LiquidGlassCard>
```

#### LiquidGlassButton
```jsx
<LiquidGlassButton 
  variant="primary"       // 'primary' | 'secondary' | 'ghost'
  size="md"              // 'sm' | 'md' | 'lg'
  disabled={false}       // Disabled state
  loading={false}        // Loading state
  onClick={handleClick}  // Click handler
>
  Button Text
</LiquidGlassButton>
```

#### LiquidStats
```jsx
<LiquidStats 
  stats={[
    {
      label: 'Active Users',
      value: 12543,
      suffix: '+',
      change: 12.5,
      trend: 'up',
      icon: '👥',
      sparkline: [45, 52, 48, 61, 55, 67, 72, 68, 75, 82, 78, 85],
      description: 'Monthly active users'
    }
  ]}
/>
```

## 🎨 Theming

### Design Tokens (Single Source of Truth)

**⚠️ IMPORTANT**: Only modify `src/styles/tokens.css` to change the design. All other changes will cause build failures.

```css
/* src/styles/tokens.css - ONLY file that should change design */
:root {
  /* Core Colors */
  --bg: #0b1020;
  --fg: #eaf1ff;
  --glass: rgba(255, 255, 255, 0.08);
  --glass-2: rgba(255, 255, 255, 0.14);
  
  /* Accent Colors */
  --accent-1: #6ddcff;
  --accent-2: #7f60ff;
  --accent-3: #00ffa3;
  
  /* Animation Durations (Fixed) */
  --anim-duration-fast: 8s;
  --anim-duration-med: 16s;
  --anim-duration-slow: 28s;
  
  /* Blur Values (Fixed) */
  --blur-strong: 14px;
  --blur-extra: 20px;
}
```

### Theme Switching

```jsx
const [theme, setTheme] = useState('dark');

const toggleTheme = () => {
  setTheme(prev => prev === 'dark' ? 'light' : 'dark');
};

useEffect(() => {
  document.documentElement.className = `theme-${theme}`;
}, [theme]);
```

### Theme Switching

```jsx
const [theme, setTheme] = useState('dark');

const toggleTheme = () => {
  setTheme(prev => prev === 'dark' ? 'light' : 'dark');
};

useEffect(() => {
  document.documentElement.className = `theme-${theme}`;
}, [theme]);
```

## 🎯 Performance

### Optimization Features

- **Reduced Motion Support**: Respects `prefers-reduced-motion` media query
- **GPU Optimization**: Uses `will-change` sparingly and efficiently
- **Smart Caching**: DNS and component-level caching
- **Lazy Loading**: Components load only when needed
- **Bundle Splitting**: Automatic code splitting for optimal loading

### Performance Guidelines

1. **Animation Performance**: Use `transform` and `opacity` for animations
2. **Backdrop Filters**: Limit blur radius on large elements
3. **SVG Filters**: Use sparingly and with appropriate fallbacks
4. **Memory Management**: Clean up event listeners and timers

## ♿ Accessibility

### WCAG Compliance

- **Contrast Ratio**: ≥ 4.5:1 for text on glass backgrounds
- **Focus Management**: Visible focus indicators with 2px outline offset
- **Keyboard Navigation**: Full keyboard support for all interactive elements
- **Screen Readers**: Proper ARIA labels and semantic HTML
- **Reduced Motion**: Respects user preferences for reduced motion

### Accessibility Features

```jsx
// Focus ring utility
.focus-ring:focus-visible {
  outline: 2px solid var(--accent-1);
  outline-offset: 2px;
}

// Reduced motion support
@media (prefers-reduced-motion: reduce) {
  .animate-float {
    animation: none;
  }
}
```

## 🛠️ Development

### Project Structure

```
liquid-glass-system/
├── src/
│   ├── components/          # React components
│   │   ├── LiquidBackdrop.jsx
│   │   ├── LiquidGlassCard.jsx
│   │   ├── LiquidGlassButton.jsx
│   │   ├── LiquidNavbar.jsx
│   │   └── LiquidStats.jsx
│   ├── pages/               # Page components
│   │   └── LiquidGlassDemo.jsx
│   ├── styles/              # CSS styles
│   │   └── liquid.css
│   ├── App.jsx
│   └── main.jsx
├── vanilla/                 # Pure HTML/CSS demo
│   ├── index.html
│   └── styles.css
├── package.json
├── tailwind.config.js
├── vite.config.js
└── README.md
```

### Scripts

```bash
# Development
npm run dev                    # Start development server
npm run build                  # Build for production
npm run preview                # Preview production build

# Testing & Quality
npm run test                   # Run unit tests
npm run test:visual            # Run visual regression tests
npm run test:visual:update     # Update visual baselines
npm run lint                   # Run ESLint

# Deterministic Workflow
npm run verify                 # Check environment
npm run clean                  # Clean caches
npm ci --legacy-peer-deps      # Deterministic install
```

### Design Stability

This system enforces **pixel-perfect stability**:

- **Design Fingerprint**: Automatically detects visual drift
- **Visual Regression**: Screenshots compared against baselines
- **Code Guardrails**: ESLint prevents hardcoded values and randomness
- **Token-Only Changes**: Only `tokens.css` can alter the design

### Troubleshooting

**Build fails with "Design drift detected":**
1. Check for hardcoded values in components
2. Verify no `Math.random()` usage
3. Ensure all animations use tokens
4. Only modify `src/styles/tokens.css`

**Visual tests failing:**
1. Run `npm run test:visual:update` to update baselines
2. Review changes are intentional
3. Commit updated baselines with clear message

### Tailwind Configuration

The project includes custom Tailwind configuration with:

- Custom color system using CSS variables
- Backdrop blur utilities
- Custom animations and keyframes
- Glass utility classes
- Responsive design tokens

## 📱 Responsive Design

### Breakpoints

- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

### Mobile Optimizations

- Reduced blur effects on mobile devices
- Touch-friendly button sizes (44px minimum)
- Optimized animation performance
- Responsive typography scaling

## 🎨 Design Tokens

### Colors

```css
/* Primary Accents */
--accent-1: #6ddcff;  /* Cyan */
--accent-2: #7f60ff;  /* Purple */
--accent-3: #00ffa3;  /* Green */

/* Glass Effects */
--glass: rgba(255, 255, 255, 0.08);
--glass-2: rgba(255, 255, 255, 0.14);
```

### Typography

- **Font Family**: Inter (system fallbacks)
- **Font Weights**: 300, 400, 500, 600, 700, 800, 900
- **Line Height**: 1.6 (base), 1.4 (headings)

### Spacing

- **Base Unit**: 0.25rem (4px)
- **Scale**: 0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 20, 24

## 🚀 Deployment

### Build Process

```bash
# Production build
npm run build

# Preview build locally
npm run preview
```

### Deployment Options

- **Vercel**: Automatic deployment with `vercel`
- **Netlify**: Drag and drop the `dist` folder
- **GitHub Pages**: Use GitHub Actions for automated deployment
- **CDN**: Upload `dist` folder to any static hosting service

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style
- Add tests for new components
- Update documentation for API changes
- Ensure accessibility compliance
- Test on multiple devices and browsers

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Inter Font**: Beautiful typeface by Rasmus Andersson
- **TailwindCSS**: Utility-first CSS framework
- **React**: Component-based UI library
- **Vite**: Fast build tool and dev server

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)
- **Documentation**: [Storybook](https://your-storybook-url.com)

---

Built with ❤️ using React, Vite, and TailwindCSS
