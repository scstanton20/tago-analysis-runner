// eslint.config.js
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import nodePlugin from 'eslint-plugin-n';
import securityPlugin from 'eslint-plugin-security';
import ymlPlugin from 'eslint-plugin-yml';

export default [
  // Common ignores
  { ignores: ['**/dist/**', '**/node_modules/**', '**/build/**', '**/.pnpm/**', 'dist/', 'node_modules/', 'build/', '.pnpm/'] },

  // Common base configuration for all JavaScript files
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      indent: ['error', 2],
      'linebreak-style': ['error', 'unix'],
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'always'],
      'comma-dangle': ['error', 'always-multiline'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },

  // Frontend React specific configuration
  {
    files: ['**/frontend/**/*.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      react: react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },

  // Backend Express/Node.js specific configuration
  {
    files: ['**/backend/**/*.{js,ts}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      node: nodePlugin,
      security: securityPlugin,
    },
    rules: {
      // Error prevention for Node.js
      'no-console': 'warn',
      'no-return-await': 'error',
      'require-atomic-updates': 'error',

      // Security
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'warn',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-non-literal-require': 'warn',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-unsafe-regex': 'error',

      // Express/Node specific
      'node/exports-style': ['error', 'module.exports'],
      'node/file-extension-in-import': ['error', 'always'],
      'node/prefer-global/buffer': ['error', 'always'],
      'node/prefer-global/console': ['error', 'always'],
      'node/prefer-global/process': ['error', 'always'],
      'node/prefer-global/url-search-params': ['error', 'always'],
      'node/prefer-global/url': ['error', 'always'],
      'node/prefer-promises/dns': 'error',
      'node/prefer-promises/fs': 'error',
      'node/no-unpublished-require': 'off',
    },
  },
  // YAML configuration for Docker files
  {
    files: ['*.{yaml}'],
    plugins: {
      yml: ymlPlugin,
    },
    languageOptions: {
      parser: ymlPlugin.parser,
    },
    rules: {
      'yml/quotes': ['error', { prefer: 'single', avoidEscape: true }],
      'yml/no-empty-document': 'error',
      'yml/no-empty-mapping-value': 'error',
      'yml/no-empty-sequence-entry': 'error',
      'yml/no-irregular-whitespace': 'error',
      'yml/plain-scalar': ['error', { forbidMultiline: true }],
      'yml/indent': ['error', 2],
      'yml/spaced-comment': ['error', 'always'],
    },
  },
];