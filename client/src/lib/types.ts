// ============================================================
// Ollama GLM-5 Chat — Type Definitions
// Design: Warm Companion — Friendly Conversational Interface
// Supports: Local Ollama, Remote Ollama, Ollama Cloud API
// ============================================================

export type ConnectionMode = 'local' | 'remote' | 'cloud';

export interface OllamaToolFunction {
  name: string;
  description: string;
  parameters: {
    type: string;
    required?: string[];
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
    }>;
  };
}

export interface OllamaTool {
  type: 'function';
  function: OllamaToolFunction;
}

export interface ToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface ToolResult {
  toolName: string;
  result: string;
  status: 'pending' | 'running' | 'success' | 'error';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  toolName?: string;
  thinking?: string;
  timestamp: number;
  isStreaming?: boolean;
  model?: string;
  images?: string[];
  // Modality extensions
  audioUrl?: string;
  generatedImages?: string[];
  altText?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  model: string;
  createdAt: number;
  updatedAt: number;
  systemPrompt?: string;
}

export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model?: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

export interface OllamaChatRequest {
  model: string;
  messages: Array<{
    role: string;
    content: string;
    images?: string[];
    tool_calls?: ToolCall[];
    tool_name?: string;
  }>;
  stream?: boolean;
  tools?: OllamaTool[];
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
    seed?: number;
    repeat_penalty?: number;
  };
  think?: boolean;
}

export interface OllamaChatChunk {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
    tool_calls?: ToolCall[];
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
}

export type AppMode = 'chat' | 'generate' | 'task' | 'research' | 'process';

export interface AppSettings {
  // Provider — which LLM backend to use
  provider: string; // 'ollama' | 'xai' | 'anthropic' | 'openai' | etc.
  // Connection (Ollama-specific)
  connectionMode: ConnectionMode;
  ollamaUrl: string;
  // Model
  defaultModel: string;
  systemPrompt: string;
  // Generation
  temperature: number;
  topP: number;
  maxTokens: number;
  // Features
  enableTools: boolean;
  enableThinking: boolean;
  streamResponses: boolean;
  // Tool modules — which remote tool categories are enabled
  // Empty array = all enabled; populated = only those modules
  enabledToolModules: string[];
  // Mode — which UX mode is active
  mode: AppMode;
}

export const OLLAMA_CLOUD_URL = 'https://ollama.com';

export const DEFAULT_SETTINGS: AppSettings = {
  provider: 'ollama',
  connectionMode: 'cloud',
  ollamaUrl: 'https://ollama.com',
  defaultModel: 'glm-5',
  systemPrompt: '',
  temperature: 0.7,
  topP: 0.9,
  maxTokens: 4096,
  enableTools: true,
  enableThinking: false,
  streamResponses: true,
  enabledToolModules: [], // empty = all enabled
  mode: 'chat',
};

// Built-in tools are now defined in tool-service.ts
// Remote tools are fetched dynamically from the API gateway

// ============================================================
// Manus Task Types — Async task-based agent (NOT chat)
// ============================================================

export type ManusTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ManusArtifact {
  type: 'text' | 'file' | 'code' | 'image' | 'link';
  name: string;
  content: string;
  mimeType?: string;
  altText?: string;
  duration?: number;
  thumbnail?: string;
}

export interface ManusStep {
  label: string;
  status: 'pending' | 'running' | 'done';
  timestamp: number;
  detail?: string;
}

export interface ManusTask {
  id: string;
  prompt: string;
  model: string;
  status: ManusTaskStatus;
  createdAt: number;
  updatedAt: number;
  result?: string;
  artifacts?: ManusArtifact[];
  error?: string;
  steps?: ManusStep[];
}
