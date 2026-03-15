// ============================================================
// Conversation Context — Conversation & message state + streaming
// Refactored from ChatContext — uses ProviderContext, SettingsContext, ToolContext
// Uses useRef for streaming content to eliminate per-token re-renders
// ============================================================

import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
  ChatMessage,
  Conversation,
  OllamaTool,
  ToolCall,
  ManusTask,
} from '@/lib/types';
import { createManusTask, cancelManusTask as cancelManusTaskApi, getManusTaskStatus } from '@/lib/manus-client';
import { ollamaClient } from '@/lib/ollama-client';
import { streamDreamerChat } from '@/lib/dreamer-client';
import type { ToolDef } from '@/lib/dreamer-client';
import { executeTool } from '@/lib/tool-service';
import { useSettings } from './SettingsContext';
import { useProviders } from './ProviderContext';
import { useTools } from './ToolContext';

// State
interface ConversationState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isGenerating: boolean;
  error: string | null;
  // Manus task state
  manusTasks: ManusTask[];
  activeManusTaskId: string | null;
}

type ConversationAction =
  | { type: 'SET_CONVERSATIONS'; payload: Conversation[] }
  | { type: 'ADD_CONVERSATION'; payload: Conversation }
  | { type: 'UPDATE_CONVERSATION'; payload: { id: string; updates: Partial<Conversation> } }
  | { type: 'DELETE_CONVERSATION'; payload: string }
  | { type: 'SET_ACTIVE_CONVERSATION'; payload: string | null }
  | { type: 'ADD_MESSAGE'; payload: { conversationId: string; message: ChatMessage } }
  | { type: 'UPDATE_MESSAGE'; payload: { conversationId: string; messageId: string; updates: Partial<ChatMessage> } }
  | { type: 'SET_GENERATING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  // Manus task actions
  | { type: 'ADD_MANUS_TASK'; payload: ManusTask }
  | { type: 'UPDATE_MANUS_TASK'; payload: ManusTask }
  | { type: 'DELETE_MANUS_TASK'; payload: string }
  | { type: 'SET_ACTIVE_MANUS_TASK'; payload: string | null }
  | { type: 'SET_MANUS_TASKS'; payload: ManusTask[] };

function conversationReducer(state: ConversationState, action: ConversationAction): ConversationState {
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
    case 'SET_GENERATING':
      return { ...state, isGenerating: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
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
interface ConversationContextType {
  state: ConversationState;
  dispatch: React.Dispatch<ConversationAction>;
  sendMessage: (content: string, images?: string[]) => Promise<void>;
  createConversation: () => string;
  deleteConversation: (id: string) => void;
  stopGeneration: () => void;
  activeConversation: Conversation | null;
  // Manus task operations
  submitManusTask: (prompt: string, model: string, files?: string[]) => Promise<string>;
  cancelManusTask: (id: string) => Promise<void>;
  refreshManusTask: (id: string) => Promise<void>;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

// Storage helpers
const STORAGE_KEY = 'ollama-chat-data';
const MANUS_TASKS_KEY = 'manus-tasks';

function loadConversations(): { conversations: Conversation[]; manusTasks: ManusTask[] } {
  try {
    const convData = localStorage.getItem(STORAGE_KEY);
    const manusData = localStorage.getItem(MANUS_TASKS_KEY);
    return {
      conversations: convData ? JSON.parse(convData) : [],
      manusTasks: manusData ? JSON.parse(manusData) : [],
    };
  } catch {
    return { conversations: [], manusTasks: [] };
  }
}

function saveConversations(conversations: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch { /* Storage full or unavailable */ }
}

function saveManusTasks(tasks: ManusTask[]) {
  try {
    localStorage.setItem(MANUS_TASKS_KEY, JSON.stringify(tasks.slice(0, 20)));
  } catch { /* Storage full or unavailable */ }
}

export function ConversationProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const { providers } = useProviders();
  const { toolSchemas } = useTools();

  const stored = loadConversations();
  const [state, dispatch] = useReducer(conversationReducer, {
    conversations: stored.conversations,
    activeConversationId: stored.conversations[0]?.id || null,
    isGenerating: false,
    error: null,
    manusTasks: stored.manusTasks,
    activeManusTaskId: stored.manusTasks[0]?.id || null,
  });

  const abortRef = useRef<AbortController | null>(null);
  // Streaming content ref — accumulates tokens without re-rendering
  const streamContentRef = useRef('');
  const streamThinkingRef = useRef('');

  // Persist conversations
  useEffect(() => {
    saveConversations(state.conversations);
  }, [state.conversations]);

  // Persist Manus tasks
  useEffect(() => {
    saveManusTasks(state.manusTasks);
  }, [state.manusTasks]);

  const activeConversation = state.conversations.find(c => c.id === state.activeConversationId) || null;

  const createConversation = useCallback(() => {
    const id = uuidv4();
    const conv: Conversation = {
      id,
      title: 'New Chat',
      messages: [],
      model: settings.defaultModel,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      systemPrompt: settings.systemPrompt,
    };
    dispatch({ type: 'ADD_CONVERSATION', payload: conv });
    dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: id });
    return id;
  }, [settings.defaultModel, settings.systemPrompt]);

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
      model: settings.defaultModel,
    };
    dispatch({ type: 'ADD_MESSAGE', payload: { conversationId: convId!, message: assistantMsg } });
    dispatch({ type: 'SET_GENERATING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    // Reset streaming refs
    streamContentRef.current = '';
    streamThinkingRef.current = '';

    // Build messages array for API
    const allMessages = [...(currentConv?.messages || []), userMsg];
    const apiMessages = [];

    const sysPrompt = currentConv?.systemPrompt || settings.systemPrompt;
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

    const isOllama = !settings.provider || settings.provider === 'ollama';
    const isManus = settings.provider === 'manus';

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

    const currentTools = settings.enableTools ? toolSchemas : [];

    // Batched UI update — dispatch content at intervals instead of per-token
    let updateScheduled = false;
    const scheduleContentUpdate = (msgId: string) => {
      if (updateScheduled) return;
      updateScheduled = true;
      requestAnimationFrame(() => {
        dispatch({
          type: 'UPDATE_MESSAGE',
          payload: {
            conversationId: convId!,
            messageId: msgId,
            updates: {
              content: streamContentRef.current,
              ...(streamThinkingRef.current ? { thinking: streamThinkingRef.current } : {}),
            },
          },
        });
        updateScheduled = false;
      });
    };

    try {
      let collectedToolCalls: ToolCall[] = [];
      let isInThinking = false;

      // Non-Ollama provider — dreamer proxy
      if (!isOllama) {
        const dreamerTools: ToolDef[] | undefined =
          settings.enableTools && currentTools.length > 0
            ? currentTools.map(t => ({
                type: 'function' as const,
                function: {
                  name: t.function.name,
                  description: t.function.description,
                  parameters: t.function.parameters as Record<string, unknown>,
                },
              }))
            : undefined;

        const providerInfo = providers.find(p => p.id === settings.provider);
        const providerSupportsTools = providerInfo?.supportsTools ?? false;
        const toolsToSend = providerSupportsTools ? dreamerTools : undefined;

        const streamDreamerRound = async (
          msgs: Array<{ role: string; content: string; tool_call_id?: string; tool_use_id?: string; name?: string }>,
          tools: ToolDef[] | undefined,
          msgId: string,
        ): Promise<{ content: string; toolCalls: Array<{ id: string; name: string; arguments: string }> }> => {
          let roundContent = '';
          const pendingToolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();

          for await (const chunk of streamDreamerChat(
            settings.provider,
            settings.defaultModel,
            msgs,
            {
              temperature: settings.temperature,
              maxTokens: settings.maxTokens,
              systemPrompt: sysPrompt || undefined,
              tools,
            },
            abortController.signal
          )) {
            if (chunk.done) break;

            if (chunk.content) {
              roundContent += chunk.content;
              streamContentRef.current = roundContent;
              scheduleContentUpdate(msgId);
            }

            if (chunk.tool_call) {
              const tc = chunk.tool_call;
              pendingToolCalls.set(tc.index, {
                id: tc.id,
                name: tc.name,
                arguments: tc.arguments || '',
              });
            }

            if (chunk.tool_call_delta) {
              const existing = pendingToolCalls.get(chunk.tool_call_delta.index);
              if (existing) {
                existing.arguments += chunk.tool_call_delta.arguments;
              }
            }
          }

          const toolCalls = Array.from(pendingToolCalls.values());
          return { content: roundContent, toolCalls };
        };

        const dreamerMessages = apiMessages.map(m => ({ role: m.role, content: String(m.content) }));
        streamContentRef.current = '';
        const firstRound = await streamDreamerRound(dreamerMessages, toolsToSend, assistantMsgId);
        const fullContent = firstRound.content;

        if (firstRound.toolCalls.length > 0) {
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
              updates: { content: fullContent, toolCalls: convertedToolCalls, isStreaming: false },
            },
          });

          const toolResults: Array<{ id: string; name: string; result: string }> = [];
          for (const tc of firstRound.toolCalls) {
            const toolMsg: ChatMessage = {
              id: uuidv4(),
              role: 'tool',
              content: '',
              toolName: tc.name,
              timestamp: Date.now(),
              toolResults: [{ toolName: tc.name, result: '', status: 'running' }],
            };
            dispatch({ type: 'ADD_MESSAGE', payload: { conversationId: convId!, message: toolMsg } });

            let parsedArgs: Record<string, unknown> = {};
            try { parsedArgs = JSON.parse(tc.arguments); } catch { parsedArgs = {}; }
            const result = await executeTool(tc.name, parsedArgs);
            toolResults.push({ id: tc.id, name: tc.name, result });

            dispatch({
              type: 'UPDATE_MESSAGE',
              payload: {
                conversationId: convId!,
                messageId: toolMsg.id,
                updates: { content: result, toolResults: [{ toolName: tc.name, result, status: 'success' }] },
              },
            });
          }

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

          const followUpMsgId = uuidv4();
          const followUpMsg: ChatMessage = {
            id: followUpMsgId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            isStreaming: true,
            model: settings.defaultModel,
          };
          dispatch({ type: 'ADD_MESSAGE', payload: { conversationId: convId!, message: followUpMsg } });

          streamContentRef.current = '';
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
      let fullContent = '';
      let thinkingContent = '';
      const request = ollamaClient.buildRequest(apiMessages, settings);

      if (settings.enableTools && currentTools.length > 0) {
        request.tools = currentTools;
      }

      if (settings.streamResponses) {
        for await (const chunk of ollamaClient.streamChat(request, abortController.signal)) {
          const text = chunk.message?.content || '';

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
            streamThinkingRef.current = thinkingContent;
            scheduleContentUpdate(assistantMsgId);
          } else if (chunk.message?.tool_calls?.length) {
            collectedToolCalls = [...collectedToolCalls, ...chunk.message.tool_calls];
          } else {
            fullContent += text;
            streamContentRef.current = fullContent;
            scheduleContentUpdate(assistantMsgId);
          }

          if (chunk.done) break;
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

        const toolResults: Array<{ name: string; result: string }> = [];
        for (const tc of collectedToolCalls) {
          const toolMsg: ChatMessage = {
            id: uuidv4(),
            role: 'tool',
            content: '',
            toolName: tc.function.name,
            timestamp: Date.now(),
            toolResults: [{ toolName: tc.function.name, result: '', status: 'running' }],
          };
          dispatch({ type: 'ADD_MESSAGE', payload: { conversationId: convId!, message: toolMsg } });

          const result = await executeTool(tc.function.name, tc.function.arguments);
          toolResults.push({ name: tc.function.name, result });

          dispatch({
            type: 'UPDATE_MESSAGE',
            payload: {
              conversationId: convId!,
              messageId: toolMsg.id,
              updates: {
                content: result,
                toolResults: [{ toolName: tc.function.name, result, status: 'success' }],
              },
            },
          });
        }

        const followUpMessages = [
          ...apiMessages,
          { role: 'assistant' as const, content: fullContent, tool_calls: collectedToolCalls },
          ...toolResults.map(tr => ({ role: 'tool' as const, content: tr.result, tool_name: tr.name })),
        ];

        const followUpRequest = ollamaClient.buildRequest(followUpMessages, settings);

        const followUpMsgId = uuidv4();
        const followUpMsg: ChatMessage = {
          id: followUpMsgId,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          isStreaming: true,
          model: settings.defaultModel,
        };
        dispatch({ type: 'ADD_MESSAGE', payload: { conversationId: convId!, message: followUpMsg } });

        let followUpContent = '';
        streamContentRef.current = '';
        for await (const chunk of ollamaClient.streamChat(followUpRequest, abortController.signal)) {
          const text = chunk.message?.content || '';
          if (text.includes('<think>') || text.includes('</think>')) continue;
          if (!isInThinking) {
            followUpContent += text;
            streamContentRef.current = followUpContent;
            scheduleContentUpdate(followUpMsgId);
          }
          if (chunk.done) break;
        }

        dispatch({
          type: 'UPDATE_MESSAGE',
          payload: {
            conversationId: convId!,
            messageId: followUpMsgId,
            updates: { content: followUpContent, isStreaming: false },
          },
        });
      } else {
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
            updates: { isStreaming: false, content: streamContentRef.current || '[Stopped]' },
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
  }, [state.activeConversationId, state.conversations, settings, toolSchemas, providers, createConversation]);

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

  const refreshManusTask = useCallback(async (id: string) => {
    try {
      const task = await getManusTaskStatus(id);
      dispatch({ type: 'UPDATE_MANUS_TASK', payload: task });
    } catch {
      // Silently fail — polling will retry
    }
  }, []);

  return (
    <ConversationContext.Provider
      value={{
        state,
        dispatch,
        sendMessage,
        createConversation,
        deleteConversation,
        stopGeneration,
        activeConversation,
        submitManusTask,
        cancelManusTask,
        refreshManusTask,
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
}

export function useConversation() {
  const ctx = useContext(ConversationContext);
  if (!ctx) throw new Error('useConversation must be used within ConversationProvider');
  return ctx;
}
