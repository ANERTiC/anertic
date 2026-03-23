# app.anertic.com

ANERTiC web application built with React Router v7, Tailwind CSS v4, and shadcn/ui.

## Tech Stack

- **Framework**: React Router v7 (SSR)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui (Radix UI)
- **Icons**: Remix Icon
- **Font**: Noto Sans (Variable)

## Getting Started

```bash
pnpm install
pnpm dev
```

## Scripts

| Command          | Description               |
| ---------------- | ------------------------- |
| `pnpm dev`       | Start development server  |
| `pnpm build`     | Build for production      |
| `pnpm start`     | Start production server   |
| `pnpm typecheck` | Run type checking         |
| `pnpm format`    | Format code with Prettier |

## Adding Components

```bash
npx shadcn@latest add button
```

Import using the `~/` path alias:

```tsx
import { Button } from '~/components/ui/button'
```
