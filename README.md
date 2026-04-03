# Universal Chat

Universal LLM chat interface -- streaming chat, image/video/TTS generation, tool use, and vision across Ollama and 9 cloud providers.

## What is this

I built this as a single interface for talking to pretty much any language model I use day-to-day, without switching between a dozen different vendor UIs. It connects to Ollama (local, remote, or cloud) and 9 cloud providers through a unified streaming chat, plus dedicated panels for image generation, video generation, text-to-speech, vision/alt-text, multi-agent research, and content safety evaluation.

The whole thing is a React + Express monorepo with tRPC for type-safe communication, real-time SSE streaming, and a tool-calling system that hooks into external data sources (arXiv, Wikipedia, NASA, GitHub, weather, news, and more).

## Features

**Chat**
- Streaming responses with thinking/reasoning display
- Conversation history with local persistence
- System prompt customization per conversation
- Tool calling -- models can fetch live data from 17+ external sources
- Vision -- attach images and let the model describe or analyze them
- Keyboard shortcuts throughout

**Create**
- Image generation (DALL-E, Grok Imagine, FLUX, Stable Diffusion)
- Video generation with batch support and polling
- Text-to-speech with multi-voice and batch options
- Image editing panel
- Provider comparison -- run the same prompt across multiple image providers side by side

**Research**
- Multi-agent orchestration (3-tier: belters, drummers, camina)
- Configurable agent count and provider selection
- Real-time progress tracking per agent

**Evaluate**
- Content safety classification with streaming reasoning
- Dual-panel view: live reasoning stream + structured verdict

**UX**
- Three themes: Lumen (light), Slate (dark), Nebula (neon/cyberpunk)
- Responsive -- works on desktop and mobile
- Collapsible sidebar, settings panel, command palette
- Prompt library for saving and reusing prompts
- Artifact gallery with collections

## Providers

| Provider | Chat | Vision | Image Gen | Video Gen | TTS | STT | Embeddings |
|----------|------|--------|-----------|-----------|-----|-----|------------|
| Ollama | x | x | | | | | |
| Anthropic (Claude) | x | x | | | | | |
| OpenAI (GPT) | x | x | x | x | x | x | x |
| xAI (Grok) | x | x | x | x | x | | |
| Google Gemini | x | x | x | | x | | x |
| Mistral | x | x | | | | | x |
| Cohere | x | | | | | | x |
| Perplexity | x | | | | | | |
| HuggingFace | x | | x | | | | |
| Manus | x | | | | | | |

Manus uses an async task-based workflow instead of streaming chat -- submit a task, poll for status, get structured results with artifacts.

## Quick start

```bash
# Clone and install
git clone https://github.com/lukeslp/ux-llm-universal.git
cd ux-llm-universal
pnpm install

# Set up environment
cp .env.example .env
# Add your provider API keys to .env (see Environment section below)

# Dev server (Vite HMR + tsx watch)
pnpm dev

# Production build
pnpm build
pnpm start
```

## Commands

```bash
pnpm dev          # Dev server with hot reload
pnpm build        # Production build (Vite + esbuild)
pnpm start        # Run production build
pnpm check        # TypeScript type checking
pnpm test         # Run tests (vitest)
pnpm format       # Prettier
pnpm db:push      # Generate and run Drizzle migrations
```

## Environment variables

Server-side `.env`:

```bash
# Database (MySQL, required for artifact persistence)
DATABASE_URL=mysql://user:pass@host/db

# Auth / OAuth (optional)
JWT_SECRET=
OAUTH_SERVER_URL=
VITE_APP_ID=
OWNER_OPEN_ID=

# Ollama
OLLAMA_API_KEY=            # or OLLAMA_KEY_ID + OLLAMA_KEY_SECRET

# Cloud providers (add whichever you use)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
XAI_API_KEY=
GEMINI_API_KEY=
MISTRAL_API_KEY=
COHERE_API_KEY=
PERPLEXITY_API_KEY=
HF_API_KEY=
MANUS_API_KEY=

# Dreamer API gateway (optional, for remote tool execution)
DREAMER_API_URL=
DREAMER_API_KEY=
```

Provider availability is driven by which API keys are present -- if you only set `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`, only those two providers (plus Ollama) will appear in the UI.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, TypeScript, Vite 7, wouter (routing) |
| Styling | Tailwind CSS 4, shadcn/ui (Radix primitives), Framer Motion |
| API | tRPC 11 (type-safe RPC), Express |
| Database | MySQL via Drizzle ORM |
| Streaming | Server-Sent Events (SSE) |
| State | React Context + useReducer, localStorage persistence |
| Testing | Vitest |
| Package manager | pnpm |

## Architecture

```
client/          React SPA
  src/
    components/  Chat, media panels, settings, Manus task UI, shadcn/ui
    contexts/    ChatContext, Provider, Settings, Theme, Artifact, Job, Tool
    pages/       Converse, Create, Research, Evaluate, Gallery
    lib/         API clients (ollama, dreamer, manus), types, tool service
server/          Express backend
  _core/         tRPC setup, LLM proxy logic, OAuth, image gen, TTS
  routers/       artifacts, collections, prompts, analytics
  *-proxy.ts     Ollama, Dreamer (multi-provider), Manus, Beltalowda
shared/          Types and constants shared between client and server
drizzle/         MySQL schema and migrations
```

The server acts as a proxy layer -- it holds all provider API keys and the client never touches them directly. Provider discovery happens at startup: the server checks which env keys exist, fetches live model lists (with 5-minute cache and fallback lists), and exposes a `/api/providers` endpoint the client polls.

## Tool system

Tools come from two sources:

1. **Built-in** -- simple utilities like current time and calculator, executed client-side
2. **Remote** -- fetched from a gateway API, organized by module (arXiv, Census, GitHub, NASA, News, Weather, Wikipedia, YouTube, etc.)

When a model requests a tool call during chat, the UI shows the tool execution state, the server runs it, and the result goes back to the model for a final response.

## License

MIT

## Author

Built by [Luke Steuber](https://lukesteuber.com)
