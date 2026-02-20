// ============================================================
// Chat Context — State management for conversations
// Design: Warm Companion — manages all chat state
// ============================================================

import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
  ChatMessage,
  Conversation,
  AppSettings,
  OllamaTool,
  OllamaModel,
  ToolCall,
} from '@/lib/types';
import { DEFAULT_SETTINGS, BUILT_IN_TOOLS } from '@/lib/types';
import { ollamaClient, executeBuiltInTool } from '@/lib/ollama-client';
import { fetchProviders, streamDreamerChat } from '@/lib/dreamer-client';
import type { Provider } from '@/lib/dreamer-client';

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
  | { type: 'SET_SETTINGS_OPEN'; payload: boolean };

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
  checkConnection: () => Promise<void>;
  activeConversation: Conversation | null;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Storage helpers
const STORAGE_KEY = 'ollama-chat-data';
const SETTINGS_KEY = 'ollama-chat-settings';

function loadFromStorage(): { conversations: Conversation[]; settings: AppSettings } {
  try {
    const convData = localStorage.getItem(STORAGE_KEY);
    const settingsData = localStorage.getItem(SETTINGS_KEY);
    let storedSettings: Partial<AppSettings> = settingsData ? JSON.parse(settingsData) : {};
    // Ensure defaultModel is always glm-5 regardless of stored settings
    storedSettings.defaultModel = 'glm-5';
    return {
      conversations: convData ? JSON.parse(convData) : [],
      settings: { ...DEFAULT_SETTINGS, ...storedSettings },
    };
  } catch {
    return { conversations: [], settings: DEFAULT_SETTINGS };
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

// Provider
export function ChatProvider({ children }: { children: React.ReactNode }) {
  const stored = loadFromStorage();
  const [state, dispatch] = useReducer(chatReducer, {
    ...initialState,
    conversations: stored.conversations,
    settings: stored.settings,
    activeConversationId: stored.conversations[0]?.id || null,
  });

  const abortRef = useRef<AbortController | null>(null);

  // Persist conversations
  useEffect(() => {
    saveConversations(state.conversations);
  }, [state.conversations]);

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
      // Silent fail — not connected to Ollama yet, which is fine
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

  useEffect(() => {
    checkConnection();
    refreshModels();
    refreshProviders();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, [checkConnection, refreshModels, refreshProviders]);

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

    // Get the latest conversation state
    const conv = state.conversations.find(c => c.id === convId);
    if (!conv && convId !== state.activeConversationId) {
      // New conversation was just created, it's in the next render
    }

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
    const currentConv = state.conversations.find(c => c.id === convId);
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

    try {
      let fullContent = '';
      let thinkingContent = '';
      let isInThinking = false;
      let collectedToolCalls: ToolCall[] = [];

      // Non-Ollama provider — route through dreamer proxy
      if (!isOllama) {
        const dreamerMessages = apiMessages.map(m => ({ role: m.role, content: String(m.content) }));
        for await (const chunk of streamDreamerChat(
          state.settings.provider,
          state.settings.defaultModel,
          dreamerMessages,
          {
            temperature: state.settings.temperature,
            maxTokens: state.settings.maxTokens,
          },
          abortController.signal
        )) {
          if (chunk.done) break;
          if (chunk.content) {
            fullContent += chunk.content;
            dispatch({
              type: 'UPDATE_MESSAGE',
              payload: {
                conversationId: convId!,
                messageId: assistantMsgId,
                updates: { content: fullContent },
              },
            });
          }
        }

        dispatch({
          type: 'UPDATE_MESSAGE',
          payload: {
            conversationId: convId!,
            messageId: assistantMsgId,
            updates: { content: fullContent, isStreaming: false },
          },
        });
        return;
      }

      // Ollama path
      const request = ollamaClient.buildRequest(apiMessages, state.settings);

      // Add tools if enabled
      if (state.settings.enableTools) {
        request.tools = BUILT_IN_TOOLS;
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

      // Handle tool calls
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

        // Execute tools and send results back
        for (const tc of collectedToolCalls) {
          const toolResult = executeBuiltInTool(tc.function.name, tc.function.arguments);
          
          // Add tool result message
          const toolMsg: ChatMessage = {
            id: uuidv4(),
            role: 'tool',
            content: toolResult,
            toolName: tc.function.name,
            timestamp: Date.now(),
            toolResults: [{
              toolName: tc.function.name,
              result: toolResult,
              status: 'success',
            }],
          };
          dispatch({ type: 'ADD_MESSAGE', payload: { conversationId: convId!, message: toolMsg } });
        }

        // Send tool results back to model for final response
        const followUpMessages = [
          ...apiMessages,
          {
            role: 'assistant' as const,
            content: fullContent,
            tool_calls: collectedToolCalls,
          },
          ...collectedToolCalls.map(tc => ({
            role: 'tool' as const,
            content: executeBuiltInTool(tc.function.name, tc.function.arguments),
            tool_name: tc.function.name,
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
  }, [state.activeConversationId, state.conversations, state.settings, createConversation]);

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
        checkConnection,
        activeConversation,
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
