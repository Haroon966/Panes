---
name: terminalai-frontend
description: Builds and refactors the TerminalAI (terminalai) React/Vite client with UI/UX, accessibility, and responsive layout for desktop, tablet, and intermediate widths. Use when editing src/, Vite/Tailwind config, breakpoints, panels, touch targets, or when the user mentions frontend, responsive UI, tablet layout, or the Electron web shell for this repo.
---

# TerminalAI frontend

## UI/UX (apply to every change)

- **Clarity**: One primary action per focused area; labels and tooltips explain outcomes, not only control names.
- **Consistency**: Reuse `src/components/ui/` and existing chat/terminal/workbench patterns before new primitives.
- **Feedback**: Loading, empty, error, and success states visible near the action; disabled controls read as disabled.
- **Efficiency**: Preserve keyboard flows and shortcuts; do not hide critical actions behind hover-only affordances (touch and keyboard users).
- **Accessibility**: Correct semantics (`button`, `label`, headings order), visible `:focus-visible`, meaningful names for icon-only controls, don’t rely on color alone for state. Respect **`prefers-reduced-motion`** for non-essential animation.
- **Forgiveness**: Destructive actions need confirmation or undo patterns consistent with the rest of the app.

For deeper UX review patterns, also load the **ui-ux-expert** skill when the task is primarily design or usability critique.

## Responsive layout (desktop, tablet, in-between)

**Canonical breakpoint in this app:** **`900px`** — below that width the agent/chat panel is a **slide-over**; at **`min-[900px]`** it is a **fixed-width column** alongside the main work area. New layout work should align with `MainLayout` unless the PRD explicitly changes this.

- **Tailwind defaults** (use when they fit): `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px, `2xl` 1536px. Use **arbitrary breakpoints** (`min-[900px]`, `max-[899px]`) when matching existing panel behavior or when a design needs a value between defaults.
- **Fluid between breakpoints**: Prefer **`min-w-0`**, **`max-w-*`**, **`w-full`**, **`min(100vw, …)`**, and **`flex-1` / `shrink-0`** so panels don’t overflow at odd widths (e.g. 820px, 1100px). Avoid hard `w-[NNNpx]` on full-width regions unless paired with responsive overrides.
- **Height and scroll**: Root areas use **`h-screen min-h-0`**; nested scroll regions need **`min-h-0`** on flex ancestors so content scrolls inside panes instead of the whole window breaking.
- **Tablet and touch**: Aim for **~44×44px** minimum hit targets on primary actions where the UI is tappable; adequate spacing between adjacent controls. Don’t shrink interactive targets only on “desktop” classes without a touch-friendly alternative on narrower viewports.
- **Verify mentally** at roughly **768**, **820–900** (around the app split), **1024**, and **1440+** px widths; ensure no horizontal clipping, overlapping fixed layers, or unusable split handles.

**`react-resizable-panels`**: Preserve resize behavior across widths; if adding constraints, use **`minSize` / `maxSize`** (and CSS) so terminals and sidebars remain usable on medium screens.

## Stack

- **React 18** + **TypeScript**, **Vite 6** (`vite.config.ts`), dev server **5173**; `/api` and `/ws` proxy to backend (**3001** by default, `PORT`).
- **Tailwind 3** + **tailwindcss-animate**; **Radix**-style primitives under `src/components/ui/` with **class-variance-authority** and **`cn()`** from `@/lib/utils` (clsx + tailwind-merge).
- **Zustand** stores in `src/store/`; **react-router-dom** v7 in `App.tsx` (`/`, `/terminal-only`).
- **Monaco**, **xterm**, **lucide-react**, **react-markdown** where those features live.

## Paths and imports

- Use the **`@/`** alias for `src/` (see `vite.config.ts` `resolve.alias`).
- **Feature components**: `src/components/{Chat,Terminal,Layout,WorkspaceEditor,ModelSelector,Update,Agent,ui}/`
- **State**: `src/store/*.ts`
- **Hooks**: `src/hooks/*.ts`
- **Providers**: `src/providers/`
- **Shared lib**: `src/lib/` (API helpers, theme, streams, etc.)
- **Pages**: `src/pages/`
- **Global styles**: `src/styles/globals.css` (CSS variables + Tailwind layers), plus `chat.css` / `terminal.css` as needed.

## Theming and colors

- App theme is driven by **`document.documentElement.dataset.terminalaiTheme`** (`dark` | `light`). Helpers: `src/lib/terminalaiTheme.ts` (`resolveEffectiveTerminalTheme`, `applyTerminalaiThemeDataset`).
- **Product palette**: Tailwind namespace **`terminalai.*`** (e.g. `bg-terminalai-surface`, `text-terminalai-muted`) maps to CSS vars in `globals.css`.
- **shadcn-aligned tokens**: `background`, `foreground`, `primary`, `muted`, `border`, `destructive`, etc. (HSL vars)—use for Radix/shadcn components and focus rings.
- Prefer **semantic tokens** over raw hex in new UI; match existing components in the same area.

## UI patterns

- **New or extended controls**: reuse **`src/components/ui/`** (`Button`, `Dialog`, `DropdownMenu`, etc.) before adding one-off styled elements.
- Compose classes with **`cn(...)`**; follow existing **CVA** `variants` / `size` patterns where components use them.
- **Responsive classes**: layer breakpoints on one structure (e.g. column → row at `min-[900px]` or `md:`) instead of maintaining separate mobile/desktop components unless behavior truly diverges.
- **Icons**: `lucide-react`, sizes consistent with neighboring buttons (often `size-4` on buttons per `button.tsx`).
- Keep **accessibility** in line with existing chat/terminal patterns (labels, focus visible, announcers where present).

## Data and side effects

- **Persistence / settings**: follow `PersistenceProvider` and `src/lib/persistenceApi.ts`; do not invent new storage keys without aligning with server prefs if applicable.
- **Agent/chat streaming**: respect existing hooks and stores (`useChatStream`, `chatStore`, `agentStreamFetch`); avoid duplicating stream protocol logic in components.

## Commands (verify locally)

- `npm run dev` — Vite only  
- `npm run dev:web` — Vite + API server  
- `npm run typecheck` / `npm run lint` — after non-trivial TS/React changes  
- Targeted tests: `npm test` includes some `src/lib` tests; run full test if touching shared libs

## Scope boundaries

- **Electron shell** lives under `electron/`; **Express agent API** under `server/`. This skill focuses on **`src/`** and Vite/Tailwind front-door config unless the change explicitly crosses those boundaries.

## Principles

- Match **file placement, naming, and import style** of adjacent code; minimal diffs.
- Do not add standalone markdown docs unless the user asks; prefer code and concise comments only where necessary.
