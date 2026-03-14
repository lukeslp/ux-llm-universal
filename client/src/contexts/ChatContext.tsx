// ============================================================
// Chat Context — State management for conversations
// Design: Warm Companion — manages all chat state
// ============================================================

import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
  ChatMessage,
  Conversation,
  AppSettings,
  OllamaTool,
  OllamaModel,
  ToolCall,
  ManusTask,
} from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/types';
import { createManusTask, cancelManusTask as cancelManusTaskApi, getManusTaskStatus } from '@/lib/manus-client';
import { ollamaClient } from '@/lib/ollama-client';
import { fetchProviders, streamDreamerChat } from '@/lib/dreamer-client';
import type { Provider, DreamerStreamEvent, ToolDef } from '@/lib/dreamer-client';
import {
  getToolSchemas,
  executeTool,
  fetchToolRegistry,
  type ToolRegistry,
  type ToolCategory,
} from '@/lib/tool-service';

// State
interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  settings: AppSettings;
  models: OllamaModel[];
  providers: Provider[];
  isConnected: boolean;
  isGenerating: boolean;
  error: string | null;
  sidebarOpen: boolean;
  settingsOpen: boolean;
  toolRegistry: ToolRegistry | null;
  toolSchemas: OllamaTool[];
  // Manus task state
  manusTasks: ManusTask[];
  activeManusTaskId: string | null;
}

const initialState: ChatState = {
  conversations: [],
  activeConversationId: null,
  settings: DEFAULT_SETTINGS,
  models: [],
  providers: [],
  isConnected: false,
  isGenerating: false,
  error: null,
  sidebarOpen: false,
  settingsOpen: false,
  toolRegistry: null,
  toolSchemas: [],
  manusTasks: [],
  activeManusTaskId: null,
};

// Actions
type ChatAction =
  | { type: 'SET_CONVERSATIONS'; payload: Conversation[] }
  | { type: 'ADD_CONVERSATION'; payload: Conversation }
  | { type: 'UPDATE_CONVERSATION'; payload: { id: string; updates: Partial<Conversation> } }
  | { type: 'DELETE_CONVERSATION'; payload: string }
  | { type: 'SET_ACTIVE_CONVERSATION'; payload: string | null }
  | { type: 'ADD_MESSAGE'; payload: { conversationId: string; message: ChatMessage } }
  | { type: 'UPDATE_MESSAGE'; payload: { conversationId: string; messageId: string; updates: Partial<ChatMessage> } }
  | { type: 'SET_SETTINGS'; payload: Partial<AppSettings> }
  | { type: 'SET_MODELS'; payload: OllamaModel[] }
  | { type: 'SET_PROVIDERS'; payload: Provider[] }
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_GENERATING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SIDEBAR'; payload: boolean }
  | { type: 'TOGGLE_SETTINGS' }
  | { type: 'SET_SETTINGS_OPEN'; payload: boolean }
  | { type: 'SET_TOOL_REGISTRY'; payload: ToolRegistry }
  | { type: 'SET_TOOL_SCHEMAS'; payload: OllamaTool[] }
  // Manus task actions
  | { type: 'ADD_MANUS_TASK'; payload: ManusTask }
  | { type: 'UPDATE_MANUS_TASK'; payload: ManusTask }
  | { type: 'DELETE_MANUS_TASK'; payload: string }
  | { type: 'SET_ACTIVE_MANUS_TASK'; payload: string | null }
  | { type: 'SET_MANUS_TASKS'; payload: ManusTask[] };

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_CONVERSATIONS':
      return { ...state, conversations: action.payload };
    case 'ADD_CONVERSATION':
      return { ...state, conversations: [action.payload, ...state.conversations] };
    case 'UPDATE_CONVERSATION':
      return {
        ...state,
        conversations: state.conversations.map(c =>
          c.id === action.payload.id ? { ...c, ...action.payload.updates } : c
        ),
      };
    case 'DELETE_CONVERSATION': {
      const filtered = state.conversations.filter(c => c.id !== action.payload);
      return {
        ...state,
        conversations: filtered,
        activeConversationId:
          state.activeConversationId === action.payload
            ? filtered[0]?.id || null
            : state.activeConversationId,
      };
    }
    case 'SET_ACTIVE_CONVERSATION':
      return { ...state, activeConversationId: action.payload };
    case 'ADD_MESSAGE':
      return {
        ...state,
        conversations: state.conversations.map(c =>
          c.id === action.payload.conversationId
            ? {
                ...c,
                messages: [...c.messages, action.payload.message],
                updatedAt: Date.now(),
              }
            : c
        ),
      };
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        conversations: state.conversations.map(c =>
          c.id === action.payload.conversationId
            ? {
                ...c,
                messages: c.messages.map(m =>
                  m.id === action.payload.messageId ? { ...m, ...action.payload.updates } : m
                ),
              }
            : c
        ),
      };
    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case 'SET_MODELS':
      return { ...state, models: action.payload };
    case 'SET_PROVIDERS':
      return { ...state, providers: action.payload };
    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload };
    case 'SET_GENERATING':
      return { ...state, isGenerating: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };
    case 'SET_SIDEBAR':
      return { ...state, sidebarOpen: action.payload };
    case 'TOGGLE_SETTINGS':
      return { ...state, settingsOpen: !state.settingsOpen };
    case 'SET_SETTINGS_OPEN':
      return { ...state, settingsOpen: action.payload };
    case 'SET_TOOL_REGISTRY':
      return { ...state, toolRegistry: action.payload };
    case 'SET_TOOL_SCHEMAS':
      return { ...state, toolSchemas: action.payload };
    case 'ADD_MANUS_TASK': {
      const tasks = [action.payload, ...state.manusTasks].slice(0, 20);
      return { ...state, manusTasks: tasks };
    }
    case 'UPDATE_MANUS_TASK':
      return {
        ...state,
        manusTasks: state.manusTasks.map(t =>
          t.id === action.payload.id ? action.payload : t
        ),
      };
    case 'DELETE_MANUS_TASK':
      return {
        ...state,
        manusTasks: state.manusTasks.filter(t => t.id !== action.payload),
        activeManusTaskId:
          state.activeManusTaskId === action.payload ? null : state.activeManusTaskId,
      };
    case 'SET_ACTIVE_MANUS_TASK':
      return { ...state, activeManusTaskId: action.payload };
    case 'SET_MANUS_TASKS':
      return { ...state, manusTasks: action.payload };
    default:
      return state;
  }
}

// Context
interface ChatContextType {
  state: ChatState;
  dispatch: React.Dispatch<ChatAction>;
  sendMessage: (content: string, images?: string[]) => Promise<void>;
  createConversation: () => string;
  deleteConversation: (id: string) => void;
  stopGeneration: () => void;
  refreshModels: () => Promise<void>;
  refreshProviders: () => Promise<void>;
  refreshTools: () => Promise<void>;
  checkConnection: () => Promise<void>;
  activeConversation: Conversation | null;
  // Manus task operations
  submitManusTask: (prompt: string, model: string, files?: string[]) => Promise<string>;
  cancelManusTask: (id: string) => Promise<void>;
  refreshManusTask: (id: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Storage helpers
const STORAGE_KEY = 'ollama-chat-data';
const SETTINGS_KEY = 'ollama-chat-settings';
const MANUS_TASKS_KEY = 'manus-tasks';

function loadFromStorage(): { conversations: Conversation[]; settings: AppSettings; manusTasks: ManusTask[] } {
  try {
    const convData = localStorage.getItem(STORAGE_KEY);
    const settingsData = localStorage.getItem(SETTINGS_KEY);
    const manusData = localStorage.getItem(MANUS_TASKS_KEY);
    let storedSettings: Partial<AppSettings> = settingsData ? JSON.parse(settingsData) : {};
    // Ensure defaultModel is always glm-5 regardless of stored settings
    storedSettings.defaultModel = 'glm-5';
    return {
      conversations: convData ? JSON.parse(convData) : [],
      settings: { ...DEFAULT_SETTINGS, ...storedSettings },
      manusTasks: manusData ? JSON.parse(manusData) : [],
    };
  } catch {
    return { conversations: [], settings: DEFAULT_SETTINGS, manusTasks: [] };
  }
}

function saveConversations(conversations: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch {
    // Storage full or unavailable
  }
}

function saveSettings(settings: AppSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage full or unavailable
  }
}

function saveManusTasks(tasks: ManusTask[]) {
  try {
    // Cap at 20
    localStorage.setItem(MANUS_TASKS_KEY, JSON.stringify(tasks.slice(0, 20)));
  } catch {
    // Storage full or unavailable
  }
}

// Provider
export function ChatProvider({ children }: { children: React.ReactNode }) {
  const stored = loadFromStorage();
  const [state, dispatch] = useReducer(chatReducer, {
    ...initialState,
    conversations: stored.conversations,
    settings: stored.settings,
    activeConversationId: stored.conversations[0]?.id || null,
    manusTasks: stored.manusTasks,
    activeManusTaskId: stored.manusTasks[0]?.id || null,
  });

  const abortRef = useRef<AbortController | null>(null);

  // Persist conversations
  useEffect(() => {
    saveConversations(state.conversations);
  }, [state.conversations]);

  // Persist Manus tasks
  useEffect(() => {
    saveManusTasks(state.manusTasks);
  }, [state.manusTasks]);

  // Persist settings and sync client configuration
  useEffect(() => {
    saveSettings(state.settings);
    ollamaClient.configure({
      baseUrl: state.settings.ollamaUrl,
      connectionMode: state.settings.connectionMode,
    });
  }, [state.settings]);

  // Check connection on mount and when URL changes
  const checkConnection = useCallback(async () => {
    const connected = await ollamaClient.checkConnection();
    dispatch({ type: 'SET_CONNECTED', payload: connected });
    if (connected) {
      dispatch({ type: 'SET_ERROR', payload: null });
    }
  }, []);

  const refreshModels = useCallback(async () => {
    try {
      const models = await ollamaClient.listModels();
      dispatch({ type: 'SET_MODELS', payload: models });
    } catch {
      dispatch({ type: 'SET_MODELS', payload: [] });
    }
  }, []);

  const refreshProviders = useCallback(async () => {
    try {
      const providers = await fetchProviders();
      dispatch({ type: 'SET_PROVIDERS', payload: providers });
    } catch {
      dispatch({ type: 'SET_PROVIDERS', payload: [] });
    }
  }, []);

  // Fetch tool registry and build schemas
  const refreshTools = useCallback(async () => {
    try {
      const registry = await fetchToolRegistry();
      dispatch({ type: 'SET_TOOL_REGISTRY', payload: registry });

      // Build tool schemas with module filtering
      const enabledModules = state.settings.enabledToolModules.length > 0
        ? new Set(state.settings.enabledToolModules)
        : undefined; // undefined = all enabled
      const schemas = await getToolSchemas(enabledModules);
      dispatch({ type: 'SET_TOOL_SCHEMAS', payload: schemas });
    } catch {
      // Silently fail — builtins still work
    }
  }, [state.settings.enabledToolModules]);

  useEffect(() => {
    checkConnection();
    refreshModels();
    refreshProviders();
    refreshTools();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, [checkConnection, refreshModels, refreshProviders, refreshTools]);

  const activeConversation = state.conversations.find(c => c.id === state.activeConversationId) || null;

  const createConversation = useCallback(() => {
    const id = uuidv4();
    const conv: Conversation = {
      id,
      title: 'New Chat',
      messages: [],
      model: state.settings.defaultModel,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      systemPrompt: state.settings.systemPrompt,
    };
    dispatch({ type: 'ADD_CONVERSATION', payload: conv });
    dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: id });
    return id;
  }, [state.settings.defaultModel, state.settings.systemPrompt]);

  const deleteConversation = useCallback((id: string) => {
    dispatch({ type: 'DELETE_CONVERSATION', payload: id });
  }, []);

  const stopGeneration = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    dispatch({ type: 'SET_GENERATING', payload: false });
  }, []);

  const sendMessage = useCallback(async (content: string, images?: string[]) => {
    let convId = state.activeConversationId;
    
    // Create conversation if none active
    if (!convId) {
      convId = createConversation();
    }

    const currentConv = state.conversations.find(c => c.id === convId);

    // Add user message
    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: Date.now(),
      images,
    };
    dispatch({ type: 'ADD_MESSAGE', payload: { conversationId: convId!, message: userMsg } });

    // Auto-title from first message
    if (!currentConv || currentConv.messages.length === 0) {
      const title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
      dispatch({ type: 'UPDATE_CONVERSATION', payload: { id: convId!, updates: { title } } });
    }

    // Create assistant message placeholder
    const assistantMsgId = uuidv4();
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
      model: state.settings.defaultModel,
    };
    dispatch({ type: 'ADD_MESSAGE', payload: { conversationId: convId!, message: assistantMsg } });
    dispatch({ type: 'SET_GENERATING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    // Build messages array for API
    const allMessages = [...(currentConv?.messages || []), userMsg];
    const apiMessages = [];

    // Add system prompt if set
    const sysPrompt = currentConv?.systemPrompt || state.settings.systemPrompt;
    if (sysPrompt) {
      apiMessages.push({ role: 'system', content: sysPrompt });
    }

    for (const m of allMessages) {
      if (m.role === 'system') continue;
      const apiMsg: Record<string, unknown> = { role: m.role, content: m.content };
      if (m.images?.length) apiMsg.images = m.images;
      if (m.toolCalls?.length) apiMsg.tool_calls = m.toolCalls;
      if (m.toolName) apiMsg.tool_name = m.toolName;
      apiMessages.push(apiMsg as { role: string; content: string; images?: string[]; tool_calls?: ToolCall[]; tool_name?: string });
    }

    const abortController = new AbortController();
    abortRef.current = abortController;

    const isOllama = !state.settings.provider || state.settings.provider === 'ollama';
    const isManus = state.settings.provider === 'manus';

    // Manus is task-based — sendMessage is not used for Manus
    if (isManus) {
      dispatch({ type: 'SET_GENERATING', payload: false });
      dispatch({
        type: 'UPDATE_MESSAGE',
        payload: {
          conversationId: convId!,
          messageId: assistantMsgId,
          updates: { isStreaming: false, content: 'Switch to a chat provider to use chat. Manus is task-based.' },
        },
      });
      return;
    }

    // Get current tool schemas (builtins + remote)
    const currentTools = state.settings.enableTools ? state.toolSchemas : [];

    try {
      let fullContent = '';
      let thinkingContent = '';
      let isInThinking = false;
      let collectedToolCalls: ToolCall[] = [];

      // Non-Ollama provider — route through dreamer proxy (with tool calling)
      if (!isOllama) {
        // Convert tool schemas to OpenAI format for dreamer providers
        const dreamerTools: ToolDef[] | undefined =
          state.settings.enableTools && currentTools.length > 0
            ? currentTools.map(t => ({
                type: 'function' as const,
                function: {
                  name: t.function.name,
                  description: t.function.description,
                  parameters: t.function.parameters as Record<string, unknown>,
                },
              }))
            : undefined;

        // Check if this provider supports tools
        const providerInfo = state.providers.find(p => p.id === state.settings.provider);
        const providerSupportsTools = providerInfo?.supportsTools ?? false;
        const toolsToSend = providerSupportsTools ? dreamerTools : undefined;

        // Helper: stream a dreamer chat round and handle tool calls
        const streamDreamerRound = async (
          msgs: Array<{ role: string; content: string; tool_call_id?: string; tool_use_id?: string; name?: string }>,
          tools: ToolDef[] | undefined,
          msgId: string,
        ): Promise<{ content: string; toolCalls: Array<{ id: string; name: string; arguments: string }> }> => {
          let roundContent = '';
          const pendingToolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();
          let gotToolCallFinish = false;

          for await (const chunk of streamDreamerChat(
            state.settings.provider,
            state.settings.defaultModel,
            msgs,
            {
              temperature: state.settings.temperature,
              maxTokens: state.settings.maxTokens,
              systemPrompt: sysPrompt || undefined,
              tools,
            },
            abortController.signal
          )) {
            if (chunk.done) break;

            // Text content
            if (chunk.content) {
              roundContent += chunk.content;
              dispatch({
                type: 'UPDATE_MESSAGE',
                payload: {
                  conversationId: convId!,
                  messageId: msgId,
                  updates: { content: roundContent },
                },
              });
            }

            // Tool call start
            if (chunk.tool_call) {
              const tc = chunk.tool_call;
              pendingToolCalls.set(tc.index, {
                id: tc.id,
                name: tc.name,
                arguments: tc.arguments || '',
              });
            }

            // Tool call argument continuation
            if (chunk.tool_call_delta) {
              const existing = pendingToolCalls.get(chunk.tool_call_delta.index);
              if (existing) {
                existing.arguments += chunk.tool_call_delta.arguments;
              }
            }

            // Finish reason: tool_calls
            if (chunk.finish_reason === 'tool_calls') {
              gotToolCallFinish = true;
            }
          }

          const toolCalls = Array.from(pendingToolCalls.values());
          return { content: roundContent, toolCalls };
        };

        // First round
        const dreamerMessages = apiMessages.map(m => ({ role: m.role, content: String(m.content) }));
        const firstRound = await streamDreamerRound(dreamerMessages, toolsToSend, assistantMsgId);
        fullContent = firstRound.content;

        // Handle tool calls if any
        if (firstRound.toolCalls.length > 0) {
          // Update assistant message with tool calls
          const convertedToolCalls: ToolCall[] = firstRound.toolCalls.map(tc => {
            let parsedArgs: Record<string, unknown> = {};
            try { parsedArgs = JSON.parse(tc.arguments); } catch { parsedArgs = {}; }
            return { function: { name: tc.name, arguments: parsedArgs } };
          });

          dispatch({
            type: 'UPDATE_MESSAGE',
            payload: {
              conversationId: convId!,
              messageId: assistantMsgId,
              updates: {
                content: fullContent,
                toolCalls: convertedToolCalls,
                isStreaming: false,
              },
            },
          });

          // Execute each tool call
          const toolResults: Array<{ id: string; name: string; result: string }> = [];
          for (const tc of firstRound.toolCalls) {
            // Show pending tool message
            const toolMsg: ChatMessage = {
              id: uuidv4(),
              role: 'tool',
              content: '',
              toolName: tc.name,
              timestamp: Date.now(),
              toolResults: [{ toolName: tc.name, result: '', status: 'running' }],
            };
            dispatch({ type: 'ADD_MESSAGE', payload: { conversationId: convId!, message: toolMsg } });

            // Execute
            let parsedArgs: Record<string, unknown> = {};
            try { parsedArgs = JSON.parse(tc.arguments); } catch { parsedArgs = {}; }
            const result = await executeTool(tc.name, parsedArgs);
            toolResults.push({ id: tc.id, name: tc.name, result });

            // Update tool message with result
            dispatch({
              type: 'UPDATE_MESSAGE',
              payload: {
                conversationId: convId!,
                messageId: toolMsg.id,
                updates: {
                  content: result,
                  toolResults: [{ toolName: tc.name, result, status: 'success' }],
                },
              },
            });
          }

          // Build follow-up messages with tool results
          const followUpMsgs = [
            ...dreamerMessages,
            { role: 'assistant', content: fullContent },
            ...toolResults.map(tr => ({
              role: 'tool' as const,
              content: tr.result,
              tool_call_id: tr.id,
              tool_use_id: tr.id,
              name: tr.name,
            })),
          ];

          // Create follow-up assistant message
          const followUpMsgId = uuidv4();
          const followUpMsg: ChatMessage = {
            id: followUpMsgId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            isStreaming: true,
            model: state.settings.defaultModel,
          };
          dispatch({ type: 'ADD_MESSAGE', payload: { conversationId: convId!, message: followUpMsg } });

          // Stream follow-up (no tools this time to avoid infinite loops)
          const secondRound = await streamDreamerRound(followUpMsgs, undefined, followUpMsgId);

          dispatch({
            type: 'UPDATE_MESSAGE',
            payload: {
              conversationId: convId!,
              messageId: followUpMsgId,
              updates: { content: secondRound.content, isStreaming: false },
            },
          });
        } else {
          // No tool calls — finalize
          dispatch({
            type: 'UPDATE_MESSAGE',
            payload: {
              conversationId: convId!,
              messageId: assistantMsgId,
              updates: { content: fullContent, isStreaming: false },
            },
          });
        }
        return;
      }

      // Ollama path
      const request = ollamaClient.buildRequest(apiMessages, state.settings);

      // Add dynamic tools if enabled
      if (state.settings.enableTools && currentTools.length > 0) {
        request.tools = currentTools;
      }

      if (state.settings.streamResponses) {
        for await (const chunk of ollamaClient.streamChat(request, abortController.signal)) {
          const text = chunk.message?.content || '';

          // Handle thinking tags
          if (text.includes('<think>')) {
            isInThinking = true;
            continue;
          }
          if (text.includes('</think>')) {
            isInThinking = false;
            continue;
          }

          if (isInThinking) {
            thinkingContent += text;
            dispatch({
              type: 'UPDATE_MESSAGE',
              payload: {
                conversationId: convId!,
                messageId: assistantMsgId,
                updates: { thinking: thinkingContent },
              },
            });
          } else if (chunk.message?.tool_calls?.length) {
            collectedToolCalls = [...collectedToolCalls, ...chunk.message.tool_calls];
          } else {
            fullContent += text;
            dispatch({
              type: 'UPDATE_MESSAGE',
              payload: {
                conversationId: convId!,
                messageId: assistantMsgId,
                updates: { content: fullContent },
              },
            });
          }

          if (chunk.done) {
            break;
          }
        }
      } else {
        const response = await ollamaClient.chat(request, abortController.signal);
        fullContent = response.message?.content || '';
        if (response.message?.tool_calls?.length) {
          collectedToolCalls = response.message.tool_calls;
        }
      }

      // Handle tool calls — execute via tool-service (builtin or remote)
      if (collectedToolCalls.length > 0) {
        dispatch({
          type: 'UPDATE_MESSAGE',
          payload: {
            conversationId: convId!,
            messageId: assistantMsgId,
            updates: {
              content: fullContent,
              toolCalls: collectedToolCalls,
              isStreaming: false,
              thinking: thinkingContent || undefined,
            },
          },
        });

        // Execute each tool call (async — may be remote)
        const toolResults: Array<{ name: string; result: string }> = [];
        for (const tc of collectedToolCalls) {
          // Show pending tool execution in UI
          const toolMsg: ChatMessage = {
            id: uuidv4(),
            role: 'tool',
            content: '',
            toolName: tc.function.name,
            timestamp: Date.now(),
            toolResults: [{
              toolName: tc.function.name,
              result: '',
              status: 'running',
            }],
          };
          dispatch({ type: 'ADD_MESSAGE', payload: { conversationId: convId!, message: toolMsg } });

          // Execute the tool (routes to builtin or remote via tool-service)
          const result = await executeTool(tc.function.name, tc.function.arguments);
          toolResults.push({ name: tc.function.name, result });

          // Update tool message with result
          dispatch({
            type: 'UPDATE_MESSAGE',
            payload: {
              conversationId: convId!,
              messageId: toolMsg.id,
              updates: {
                content: result,
                toolResults: [{
                  toolName: tc.function.name,
                  result,
                  status: 'success',
                }],
              },
            },
          });
        }

        // Send tool results back to model for final response
        const followUpMessages = [
          ...apiMessages,
          {
            role: 'assistant' as const,
            content: fullContent,
            tool_calls: collectedToolCalls,
          },
          ...toolResults.map(tr => ({
            role: 'tool' as const,
            content: tr.result,
            tool_name: tr.name,
          })),
        ];

        const followUpRequest = ollamaClient.buildRequest(followUpMessages, state.settings);
        
        const followUpMsgId = uuidv4();
        const followUpMsg: ChatMessage = {
          id: followUpMsgId,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          isStreaming: true,
          model: state.settings.defaultModel,
        };
        dispatch({ type: 'ADD_MESSAGE', payload: { conversationId: convId!, message: followUpMsg } });

        let followUpContent = '';
        for await (const chunk of ollamaClient.streamChat(followUpRequest, abortController.signal)) {
          const text = chunk.message?.content || '';
          if (text.includes('<think>') || text.includes('</think>')) continue;
          if (!isInThinking) {
            followUpContent += text;
            dispatch({
              type: 'UPDATE_MESSAGE',
              payload: {
                conversationId: convId!,
                messageId: followUpMsgId,
                updates: { content: followUpContent },
              },
            });
          }
          if (chunk.done) break;
        }

        dispatch({
          type: 'UPDATE_MESSAGE',
          payload: {
            conversationId: convId!,
            messageId: followUpMsgId,
            updates: { isStreaming: false },
          },
        });
      } else {
        // Finalize message
        dispatch({
          type: 'UPDATE_MESSAGE',
          payload: {
            conversationId: convId!,
            messageId: assistantMsgId,
            updates: {
              content: fullContent,
              isStreaming: false,
              thinking: thinkingContent || undefined,
            },
          },
        });
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        dispatch({
          type: 'UPDATE_MESSAGE',
          payload: {
            conversationId: convId!,
            messageId: assistantMsgId,
            updates: { isStreaming: false, content: assistantMsg.content || '[Stopped]' },
          },
        });
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Something went wrong';
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        dispatch({
          type: 'UPDATE_MESSAGE',
          payload: {
            conversationId: convId!,
            messageId: assistantMsgId,
            updates: {
              isStreaming: false,
              content: `Sorry, I couldn't respond. ${errorMessage}`,
            },
          },
        });
      }
    } finally {
      dispatch({ type: 'SET_GENERATING', payload: false });
      abortRef.current = null;
    }
  }, [state.activeConversationId, state.conversations, state.settings, state.toolSchemas, createConversation]);

  // Submit a Manus task
  const submitManusTask = useCallback(async (prompt: string, model: string, files?: string[]) => {
    const tempId = `pending-${Date.now()}`;
    const pendingTask: ManusTask = {
      id: tempId,
      prompt,
      model,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    dispatch({ type: 'ADD_MANUS_TASK', payload: pendingTask });
    dispatch({ type: 'SET_ACTIVE_MANUS_TASK', payload: tempId });

    try {
      const { taskId } = await createManusTask({ prompt, model, files });
      const task: ManusTask = { ...pendingTask, id: taskId, status: 'pending' };
      dispatch({ type: 'DELETE_MANUS_TASK', payload: tempId });
      dispatch({ type: 'ADD_MANUS_TASK', payload: task });
      dispatch({ type: 'SET_ACTIVE_MANUS_TASK', payload: taskId });
      return taskId;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create task';
      const failedTask: ManusTask = { ...pendingTask, status: 'failed', error: errorMsg };
      dispatch({ type: 'UPDATE_MANUS_TASK', payload: failedTask });
      throw err;
    }
  }, []);

  // Cancel a Manus task
  const cancelManusTask = useCallback(async (id: string) => {
    try {
      await cancelManusTaskApi(id);
      const existing = state.manusTasks.find(t => t.id === id);
      if (existing) {
        dispatch({ type: 'UPDATE_MANUS_TASK', payload: { ...existing, status: 'cancelled', updatedAt: Date.now() } });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel task';
      dispatch({ type: 'SET_ERROR', payload: msg });
    }
  }, [state.manusTasks]);

  // Refresh a single Manus task status
  const refreshManusTask = useCallback(async (id: string) => {
    try {
      const task = await getManusTaskStatus(id);
      dispatch({ type: 'UPDATE_MANUS_TASK', payload: task });
    } catch {
      // Silently fail — polling will retry
    }
  }, []);

  return (
    <ChatContext.Provider
      value={{
        state,
        dispatch,
        sendMessage,
        createConversation,
        deleteConversation,
        stopGeneration,
        refreshModels,
        refreshProviders,
        refreshTools,
        checkConnection,
        activeConversation,
        submitManusTask,
        cancelManusTask,
        refreshManusTask,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
