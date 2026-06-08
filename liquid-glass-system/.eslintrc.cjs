module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    
    // Design System Guardrails
    'no-restricted-syntax': [
      'error',
      {
        selector: 'CallExpression[callee.name="Math.random"]',
        message: 'Math.random() is forbidden in UI code. Use deterministic animations from tokens instead.',
      },
      {
        selector: 'CallExpression[callee.name="random"]',
        message: 'random() is forbidden in UI code. Use deterministic animations from tokens instead.',
      },
      {
        selector: 'CallExpression[callee.property.name="random"]',
        message: 'random() is forbidden in UI code. Use deterministic animations from tokens instead.',
      },
    ],
    
    // Forbid hardcoded color values
    'no-restricted-globals': [
      'error',
      {
        name: 'Math',
        message: 'Use design tokens instead of Math.random() for deterministic animations.',
      },
    ],
    
    // Custom rules for design system
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['**/colors/**'],
            message: 'Import colors from design tokens instead of hardcoded values.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ['**/*.jsx', '**/*.tsx'],
      rules: {
        // React-specific rules
        'react-refresh/only-export-components': 'warn',
        
        // Forbid inline styles with hardcoded values
        'no-restricted-syntax': [
          'error',
          {
            selector: 'JSXAttribute[name.name="style"] Literal[value=/^#[0-9a-fA-F]{3,6}$/]',
            message: 'Hardcoded color values are forbidden. Use CSS variables from design tokens.',
          },
          {
            selector: 'JSXAttribute[name.name="style"] Literal[value=/^rgba?\\(/]',
            message: 'Hardcoded color values are forbidden. Use CSS variables from design tokens.',
          },
          {
            selector: 'JSXAttribute[name.name="style"] Literal[value=/^hsla?\\(/]',
            message: 'Hardcoded color values are forbidden. Use CSS variables from design tokens.',
          },
        ],
      },
    },
    {
      files: ['**/*.css', '**/*.scss'],
      rules: {
        // CSS-specific rules
        'no-restricted-syntax': [
          'error',
          {
            selector: 'Literal[value=/^#[0-9a-fA-F]{3,6}$/]',
            message: 'Hardcoded hex colors are forbidden. Use CSS variables from design tokens.',
          },
          {
            selector: 'Literal[value=/^rgba?\\(/]',
            message: 'Hardcoded rgba colors are forbidden. Use CSS variables from design tokens.',
          },
          {
            selector: 'Literal[value=/^hsla?\\(/]',
            message: 'Hardcoded hsla colors are forbidden. Use CSS variables from design tokens.',
          },
        ],
      },
    },
  ],
};