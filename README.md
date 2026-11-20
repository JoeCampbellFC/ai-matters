# AI Matters

A React + TypeScript starter application.

## Stack

- [React 19](https://react.dev/) with [TypeScript](https://www.typescriptlang.org/) (strict mode)
- [Vite](https://vite.dev/) for development and build tooling
- [Tailwind CSS](https://tailwindcss.com/) for styling (via `@tailwindcss/vite`)
- [ESLint](https://eslint.org/) for linting

## Project structure

```text
src/
  components/   Reusable UI components
  pages/        Top-level page components
  hooks/        Custom React hooks
  services/     API clients and external integrations
  types/        Shared TypeScript types
  utils/        Helper functions
  assets/       Images, fonts, and other static assets
```

## Getting started

Requires [Node.js](https://nodejs.org/) and npm.

```bash
npm install
npm run dev
```

The app will be available at the URL printed in the terminal (typically http://localhost:5173).

## Scripts

| Script            | Description                              |
| ----------------- | ----------------------------------------- |
| `npm run dev`      | Start the local development server        |
| `npm run build`    | Type-check and build for production       |
| `npm run lint`     | Run ESLint                                 |
| `npm run preview`  | Preview the production build locally      |
