# Project TODO

- [x] Add backend API proxy routes for Ollama (bypass CORS)
- [x] Update frontend to use backend proxy instead of direct ollama.com calls
- [x] Fix Home.tsx conflict from upgrade (restore chat UI)
- [x] Fix package.json conflict (keep highlight.js and uuid deps)
- [x] Run pnpm db:push to sync database schema
- [x] Test cloud connection end-to-end with API key
- [x] Write vitest tests for ollama-proxy routes (9 tests passing)
- [x] Research dr.eamer.dev/code/api and api-gateway docs
- [x] Fix Ollama API key truncation (two-part env var workaround)
- [x] Verify GLM-5 streaming works end-to-end through proxy
- [x] Push code to GitHub (lukeslp/ollama-chat)
- [ ] Fix 413 error on image uploads (increase proxy body size limit)
- [ ] Integrate real web search API tool via dr.eamer.dev
- [ ] Integrate image generation tool
- [ ] Integrate dr.eamer.dev API tools (news, data sources, TTS)
- [ ] Wire all tool results into chat flow and UI
- [ ] Test end-to-end tool use with streaming
