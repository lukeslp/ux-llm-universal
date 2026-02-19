# Ollama Cloud API Research Notes

## Two modes of operation:

### 1. Local Ollama (traditional)
- Base URL: `http://localhost:11434`
- No authentication needed
- User runs `ollama serve` locally
- Cloud models accessed via local proxy: `ollama run gpt-oss:120b-cloud`

### 2. Direct Cloud API (ollama.com)
- Base URL: `https://ollama.com`
- API endpoints: `https://ollama.com/api/chat`, `https://ollama.com/api/tags`, `https://ollama.com/api/generate`
- Authentication: `Authorization: Bearer <OLLAMA_API_KEY>` header
- API key created at: https://ollama.com/settings/keys
- Same API format as local, just different host + auth header
- Models don't need `-cloud` suffix: `gpt-oss:120b` instead of `gpt-oss:120b-cloud`

## Key takeaway:
The API is identical between local and cloud. The only differences are:
1. Base URL changes from `http://localhost:11434` to `https://ollama.com`
2. Cloud requires `Authorization: Bearer <key>` header
3. Cloud model names may differ slightly (no `-cloud` suffix)

## What the app needs:
- Connection mode toggle: Local vs Cloud
- API key input field (for cloud mode)
- Preset base URL for cloud: `https://ollama.com`
- Authorization header injection when API key is set
- Model listing works the same way: `/api/tags`
