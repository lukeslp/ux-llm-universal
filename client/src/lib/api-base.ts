// ============================================================
// API Base Path — Ensures fetch calls use the correct prefix
// When deployed under a subpath (e.g. /io/chat/), all API
// calls must go through that subpath for Caddy to route them.
// ============================================================

/**
 * The base path for API calls, derived from Vite's base config.
 * In dev: "" (empty, APIs are at /api/...)
 * In prod under /io/chat/: "/io/chat" (APIs at /io/chat/api/...)
 */
const rawBase = import.meta.env.BASE_URL || '/';
export const API_BASE = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;

/**
 * Prepend the base path to an API route.
 * Usage: apiUrl('/api/ollama/health') → '/io/chat/api/ollama/health'
 */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
