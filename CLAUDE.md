# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A multi-provider LLM chat interface built with React 19 + Express + tRPC. Supports Ollama (local/remote/cloud), 9 cloud providers (Anthropic, OpenAI, xAI, Gemini, Mistral, Cohere, Perplexity, HuggingFace, Manus) via a "Dreamer API" gateway on dr.eamer.dev. Includes tool calling, streaming, thinking/reasoning display, and async task-based workflows (Manus).

## Commands

```bash
pnpm install                # Install dependencies
pnpm dev                    # Dev server (tsx watch + Vite HMR), port 3000+
pnpm build                  # Production build (Vite + esbuild)
pnpm start                  # Run production build
pnpm check                  # TypeScript type checking (tsc --noEmit)
pnpm test                   # Run tests (vitest, server-side only)
pnpm format                 # Prettier
pnpm db:push                # Generate and run Drizzle migrations
```

Production runs from `/home/coolhand/servers/geepers-chat` on dr.eamer.dev via `start.sh`. Deployed at `https://dr.eamer.dev/io/media/` (Caddy → port 3460). Deploy: `pnpm build && rsync -avz --delete dist/ dreamer:~/servers/geepers-chat/dist/ && ssh dreamer "sm restart geepers-chat"`. Database requires `DATABASE_URL` in server `.env` — without it, artifact persistence silently no-ops.

## Architecture

**Monorepo layout** — single package.json, three source directories sharing types:

- `client/` — React 19 SPA (Vite, wouter routing, shadcn/ui new-york style, Tailwind 4)
- `server/` — Express server (tRPC API + proxy routes + OAuth)
- `shared/` — Types and constants shared between client and server
- `drizzle/` — MySQL schema and migrations (Drizzle ORM)

**Path aliases**: `@/` → `client/src/`, `@shared/` → `shared/`, `@assets/` → `attached_assets/`

**Base path**: `/io/media/` in production only. Dev mode uses `/` (controlled by `NODE_ENV` in `vite.config.ts`).

### Server Layer

Entry: `server/_core/index.ts` → Express app with four route groups:

1. **tRPC** (`/api/trpc`) — auth routes (me, logout), system router, artifacts, collections, prompts, analytics. Uses `publicProcedure`, `protectedProcedure`, `adminProcedure` from `server/_core/trpc.ts`. Sub-routers in `server/routers/`.
2. **Ollama proxy** (`/api/ollama/*`) — CORS-bypassing relay to local/remote/cloud Ollama. Supports streaming via SSE (`/api/ollama/chat/stream`).
3. **Dreamer proxy** (`/api/dreamer/*`, `/api/providers`, `/api/tools/*`) — Multi-provider streaming chat with tool calling. Routes directly to provider APIs (Anthropic, OpenAI, xAI, Mistral, HuggingFace) when tools are present, falls back to dr.eamer.dev gateway otherwise.
4. **Manus proxy** (`/api/manus/*`) — Async task-based agent API. Proxies to `https://api.manus.im`. Uses custom `API_KEY` header (not Bearer). Endpoints: create task, poll status, list tasks, upload files.

### Client Layer

- **ChatContext** (`contexts/ChatContext.tsx`) — Central state via `useReducer`. Manages conversations, settings, models, providers, tool registry, and Manus tasks. Conversations persist to localStorage, Manus tasks to separate `'manus-tasks'` key.
- **Two chat UX modes**: Standard chat (Ollama/Dreamer streaming) vs Manus task view (async submit → poll → structured results). Controlled by `provider.taskBased` flag from `/api/providers`.
- **Key clients**: `lib/ollama-client.ts` (Ollama), `lib/dreamer-client.ts` (multi-provider streaming), `lib/manus-client.ts` (task CRUD + polling), `lib/tool-service.ts` (tool registry)
- **Manus components** (`components/manus/`): `ManusTaskView`, `ManusTaskInput`, `ManusTimeline`, `ManusResult`, `ManusTaskHistory`, `ManusStatusBadge`
- **Polling**: `hooks/useManusPolling.ts` — exponential backoff (3s → 10s cap), stops on terminal status
- **ArtifactContext** (`contexts/ArtifactContext.tsx`) — Optimistic local state + async tRPC persistence for images, video, audio. Server ID backfill from mutation response.
- **JobContext** (`contexts/JobContext.tsx`) — Async job tracking for image/video/TTS/research. Video jobs persist to localStorage across page refresh. `onJobComplete` callback registry for cross-context side effects.
- **Create page panels** (`components/`): `ImageGenPanel` (seed, batch, provider-specific controls), `VideoGenPanel` (bulk gen, polling), `TTSPanel` (multi-voice, batch), `ImageEditPanel`, `ProviderComparePanel` (parallel multi-provider image gen)
- **PromptLibrary** (`components/PromptLibrary.tsx`) — Save/load reusable prompts per category via tRPC

### Provider Architecture

Providers are discovered via `/api/providers`. Each has:
- `id`, `name`, `models[]`, `defaultModel`, `available`, `supportsTools`
- `capabilities[]` — `chat`, `image_generation`, `video_generation`, `vision`, `tts`, `stt`, `embeddings`
- `imageGenModels/Default`, `videoGenModels/Default`, `ttsModels/Default` — per-capability model lists
- `taskBased?: boolean` — when true, client switches from chat to task UX (currently only Manus)

Provider keys come from server `.env` only — never exposed to client. The `getProviderKeys()` function in `dreamer-proxy.ts` maps env vars to provider IDs. Model lists are fetched live from each provider API with 5-minute cache and fallback lists.

### Tool System

Tools come from two sources:
- **Built-in tools** defined in `client/src/lib/tool-service.ts`
- **Remote tools** fetched from dr.eamer.dev gateway (`/api/tools`), organized by module (arXiv, Census, GitHub, NASA, News, Weather, Wikipedia, YouTube, etc.)

Tool execution flows: model requests tool → UI shows running state → `executeTool()` calls server → result sent back to model for final response.

## Environment Variables

Server-side (in `.env`):
- `DATABASE_URL` — MySQL connection string (Drizzle)
- `JWT_SECRET`, `OAUTH_SERVER_URL`, `VITE_APP_ID`, `OWNER_OPEN_ID` — Auth/OAuth
- `OLLAMA_KEY_ID`, `OLLAMA_KEY_SECRET` (or `OLLAMA_API_KEY`) — Ollama Cloud auth
- `DREAMER_API_URL`, `DREAMER_API_KEY` — dr.eamer.dev gateway
- Provider keys: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `XAI_API_KEY`, `GEMINI_API_KEY`, `MISTRAL_API_KEY`, `COHERE_API_KEY`, `PERPLEXITY_API_KEY`, `HF_API_KEY`, `MANUS_API_KEY`

## Key Conventions

- **pnpm** only (not npm/yarn), patched wouter dependency
- **shadcn/ui** components in `client/src/components/ui/` (new-york style, neutral base color, CSS variables)
- Default model is `glm-5`, hardcoded in ChatContext storage loader
- Tests live alongside server code (`server/**/*.test.ts`), run with vitest in node environment
- Debug logs collected via custom Vite plugin to `.debug-logs/` in dev mode
- Manus uses violet/purple color theme to distinguish from the orange/rose chat theme
- All client API calls use `apiUrl()` from `lib/api-base.ts` to handle base path
