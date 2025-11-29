# Webpage Scanner & Fact-Checker Extension

A browser extension built with React + TypeScript + Vite that scans webpages and provides AI-powered fact-checking capabilities.

## Features

- **Webpage Scanning**: Extract text, images, links, metadata, and structure from any webpage
- **AI Fact-Checking**: Verify information using OpenAI's GPT models
- **Detailed Analysis**: Get verdicts, confidence scores, sources, and reasoning for claims
- **Modern UI**: Clean, tabbed interface for easy navigation

## Setup

### 1. Install Dependencies

```bash
bun install
# or
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:

```env
VITE_OPENAI_API_KEY=sk-your-api-key-here
VITE_OPENAI_MODEL=gpt-4o-mini
VITE_MAX_CLAIMS=5
```

**Note**: You can also set the API key in the extension's Settings UI after installation. The key set in Settings takes priority over the .env file.

### 3. Build the Extension

```bash
bun run build
# or
npm run build
```

### 4. Load in Browser

1. Open Chrome/Edge and go to `chrome://extensions/` (or `edge://extensions/`)
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `dist` folder from this project

## Usage

1. Navigate to any webpage
2. Click the extension icon
3. View scanned data in different tabs (Overview, Text, Images, Links, Structure)
4. Click "🔍 Fact Check" to verify information (requires API key)
5. View fact-check results with verdicts and sources

## Configuration

### Environment Variables

All configuration is done through environment variables in the `.env` file:

- `VITE_OPENAI_API_KEY`: Your OpenAI API key (required for fact-checking)
- `VITE_OPENAI_MODEL`: Model to use (default: `gpt-4o-mini`)
- `VITE_MAX_CLAIMS`: Maximum claims to fact-check per page (default: 5)
- `VITE_OPENAI_API_BASE_URL`: API base URL (default: `https://api.openai.com/v1`)

### API Key Priority

1. Key set in extension Settings UI (highest priority)
2. Key from `.env` file
3. No key (fact-checking disabled)

## Development

```bash
# Development mode
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview
```

## Tech Stack

- React 19
- TypeScript
- Vite
- OpenAI API
- Chrome Extension APIs

---

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
