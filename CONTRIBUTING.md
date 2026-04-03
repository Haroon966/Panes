# Contributing to TerminalAI

## Adding a New LLM Provider

1. Create `src/providers/llm/<provider-name>.ts`
2. Export a `createProvider(apiKey: string, modelId: string)` function that returns a Vercel AI SDK compatible provider
3. Register it in `src/providers/llm/index.ts` in the `PROVIDER_REGISTRY`
4. Add the provider's models to `src/types/models.ts`
5. Add a key field in `ApiKeyModal.tsx`

## Adding Terminal Features

Terminal I/O flows through `server/pty.ts` (server) and `src/hooks/useTerminal.ts` (client). Add new PTY features server-side; expose them via WebSocket message types.

## Code Style

- TypeScript strict mode — no `any`
- Prettier for formatting (`npm run format`)
- ESLint for linting (`npm run lint`)
- Component files: PascalCase (`ChatSidebar.tsx`)
- Hook files: camelCase with `use` prefix (`useTerminal.ts`)
- Utility files: camelCase (`errorParser.ts`)

## Vendor Code

Files in `/vendor` are cloned from external repos. Do not modify them directly — copy the relevant parts into `/src` and adapt there. Document the source in a comment at the top of the file.
