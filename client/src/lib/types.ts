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

export interface AppSettings {
  // Connection
  connectionMode: ConnectionMode;
  ollamaUrl: string;
  apiKey: string;
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
}

export const OLLAMA_CLOUD_URL = 'https://ollama.com';

export const DEFAULT_SETTINGS: AppSettings = {
  connectionMode: 'cloud',
  ollamaUrl: OLLAMA_CLOUD_URL,
  apiKey: '',
  defaultModel: 'glm-5',
  systemPrompt: '',
  temperature: 0.7,
  topP: 0.9,
  maxTokens: 4096,
  enableTools: true,
  enableThinking: false,
  streamResponses: true,
};

// Built-in tools that the frontend can handle
export const BUILT_IN_TOOLS: OllamaTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_current_time',
      description: 'Get the current date and time',
      parameters: {
        type: 'object',
        properties: {
          timezone: {
            type: 'string',
            description: 'The timezone to get the time for, e.g. "America/New_York"',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate',
      description: 'Perform a mathematical calculation',
      parameters: {
        type: 'object',
        required: ['expression'],
        properties: {
          expression: {
            type: 'string',
            description: 'The mathematical expression to evaluate, e.g. "2 + 2" or "Math.sqrt(144)"',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for information on a topic',
      parameters: {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            description: 'The search query',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_image',
      description: 'Generate a description for an image based on a prompt',
      parameters: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt: {
            type: 'string',
            description: 'The image generation prompt',
          },
        },
      },
    },
  },
];
