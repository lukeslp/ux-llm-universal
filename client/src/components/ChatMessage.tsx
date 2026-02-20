// ============================================================
// ChatMessage — Individual message bubble with rich content
// Design: Warm Companion — soft bubbles, friendly avatars
// ============================================================

import { useState, useMemo } from 'react';
import { Streamdown } from 'streamdown';
import { motion } from 'framer-motion';
import {
  User,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Wrench,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ChatMessage as ChatMessageType } from '@/lib/types';
import RichEmbed, { extractUrls } from '@/components/RichEmbed';

const AI_AVATAR_URL = 'https://private-us-east-1.manuscdn.com/sessionFile/ZczeSqT83YLrkFvT86EGKx/sandbox/zSRkqiRASQwD6PeiLPQbhP-img-2_1771472983000_na1fn_YWktYXZhdGFy.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvWmN6ZVNxVDgzWUxya0Z2VDg2RUdLeC9zYW5kYm94L3pTUmtxaVJBU1F3RDZQZWlMUFFiaFAtaW1nLTJfMTc3MTQ3Mjk4MzAwMF9uYTFmbl9ZV2t0WVhaaGRHRnkucG5nP3gtb3NzLXByb2Nlc3M9aW1hZ2UvcmVzaXplLHdfMTkyMCxoXzE5MjAvZm9ybWF0LHdlYnAvcXVhbGl0eSxxXzgwIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk4NzYxNjAwfX19XX0_&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=gXGJ1cfIoY64fheopaxagmOvfKFwGzRqRVORx-eg2zT9c4ozItE6M46llD-Wja9fq52RR17GgTyTjk-zDVfrWdWO3aLwc7ZolMdck81S1d8nk~l-NNPuz0srkYT2Wwr-mIxaQzPv1Hug-ta1i-LaFwDKZ~sM2w1BPX8mdV3cavAlreYXQGtzKFEbM8RWMiPEb4pvNYzxILQ4q-Z~83tlcQ5nhUg1ybw02ptnZpfJ2d1VO~~ctbMw82QEUdX7ccH4rLU7nYNor4Us0dDEe1AAXZLPQkQ5~ESN8uPEkfSkJQtA0Qp5GI6JukrbLmMx49kpvQy6yh4BkntXvXp33dogGg__';

// Friendly tool name mapping — includes builtins + common API gateway tools
const TOOL_LABELS: Record<string, { label: string; description: string }> = {
  // Builtins
  get_current_time: { label: 'Checking the time', description: 'Looking up the current date and time' },
  calculate: { label: 'Doing math', description: 'Running a calculation' },
  // Weather
  get_current_weather: { label: 'Checking weather', description: 'Getting current conditions' },
  get_weather_forecast: { label: 'Getting forecast', description: 'Looking up weather forecast' },
  get_weather_alerts: { label: 'Checking alerts', description: 'Looking for weather alerts' },
  // News
  get_top_headlines: { label: 'Reading headlines', description: 'Fetching top news stories' },
  search_news: { label: 'Searching news', description: 'Looking for news articles' },
  // Finance
  get_stock_quote: { label: 'Checking stocks', description: 'Looking up stock price' },
  get_forex_rate: { label: 'Checking forex', description: 'Looking up exchange rate' },
  get_crypto_quote: { label: 'Checking crypto', description: 'Looking up crypto price' },
  // GitHub
  search_github_repos: { label: 'Searching GitHub', description: 'Looking for repositories' },
  search_github_code: { label: 'Searching code', description: 'Looking for code on GitHub' },
  get_github_repo_info: { label: 'Checking repo', description: 'Getting repository details' },
  // NASA
  get_nasa_apod: { label: 'NASA APOD', description: 'Getting Astronomy Picture of the Day' },
  get_mars_rover_photos: { label: 'Mars photos', description: 'Getting Mars rover images' },
  // Wikipedia
  search_wikipedia: { label: 'Searching Wikipedia', description: 'Looking up an article' },
  get_wikipedia_article: { label: 'Reading Wikipedia', description: 'Getting article content' },
  // YouTube
  search_youtube: { label: 'Searching YouTube', description: 'Looking for videos' },
  // arXiv
  search_arxiv: { label: 'Searching arXiv', description: 'Looking for academic papers' },
  // Books
  search_books: { label: 'Searching books', description: 'Looking for books' },
  // Semantic Scholar
  search_papers: { label: 'Searching papers', description: 'Looking for research papers' },
  // Census
  get_population: { label: 'Census lookup', description: 'Getting population data' },
  // Archive
  get_wayback_snapshot: { label: 'Web archive', description: 'Looking up archived page' },
};

/** Generate a friendly label from a tool name like "get_stock_quote" → "Getting stock quote" */
function getToolLabel(name: string): { label: string; description: string } {
  if (TOOL_LABELS[name]) return TOOL_LABELS[name];
  // Dynamic fallback: convert snake_case to readable
  const readable = name.replace(/_/g, ' ').replace(/^(get|search|fetch)\s/, '');
  const capitalized = readable.charAt(0).toUpperCase() + readable.slice(1);
  return { label: capitalized, description: `Running ${readable}...` };
}

interface Props {
  message: ChatMessageType;
  isLast?: boolean;
}

export default function ChatMessage({ message, isLast }: Props) {
  const [copied, setCopied] = useState(false);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);

  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';
  const isAssistant = message.role === 'assistant';

  // Extract URLs for rich embeds (only for assistant messages)
  const urls = useMemo(() => {
    if (!isAssistant || message.isStreaming) return [];
    return extractUrls(message.content);
  }, [message.content, isAssistant, message.isStreaming]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Tool result message — friendly card style
  if (isTool) {
    const toolInfo = getToolLabel(message.toolName || '');
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex gap-3 px-4 py-2 max-w-3xl mx-auto"
      >
        <div className="w-8 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/30 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-6 h-6 rounded bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <Wrench className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  {toolInfo.label || message.toolName || 'Tool Result'}
                </span>
                {toolInfo.description && (
                  <p className="text-xs text-amber-600/70 dark:text-amber-400/60">{toolInfo.description}</p>
                )}
              </div>
              <span className="ml-auto text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40 px-2 py-0.5 rounded-full font-medium">
                Done
              </span>
            </div>
            <div className="bg-white/60 dark:bg-black/20 rounded-lg px-3 py-2">
              <pre className="whitespace-pre-wrap font-mono text-xs text-amber-900/80 dark:text-amber-200/80 break-all leading-relaxed">
                {message.content}
              </pre>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`flex gap-3 px-4 py-3 max-w-3xl mx-auto ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <div className="shrink-0 mt-0.5">
        {isUser ? (
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
            <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full overflow-hidden shadow-sm ring-2 ring-orange-100 dark:ring-orange-900/40">
            <img src={AI_AVATAR_URL} alt="AI" className="w-full h-full object-cover" />
          </div>
        )}
      </div>

      {/* Message content */}
      <div className={`flex-1 min-w-0 ${isUser ? 'flex flex-col items-end' : ''}`}>
        {/* Role label */}
        <div className={`flex items-center gap-2 mb-1 ${isUser ? 'flex-row-reverse' : ''}`}>
          <span className="text-xs font-semibold text-muted-foreground">
            {isUser ? 'You' : 'Assistant'}
          </span>
          <span className="text-xs text-muted-foreground/50">
            {formatTime(message.timestamp)}
          </span>
          {message.model && isAssistant && (
            <span className="text-xs text-muted-foreground/40 bg-muted px-1.5 py-0.5 rounded text-[10px]">
              {message.model}
            </span>
          )}
        </div>

        {/* Thinking block */}
        {isAssistant && message.thinking && (
          <div className="mb-2 w-full max-w-lg">
            <button
              onClick={() => setThinkingExpanded(!thinkingExpanded)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1 group"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary/60 thinking-pulse" />
              <span className="group-hover:underline">
                {thinkingExpanded ? 'Hide' : 'Show'} thinking process
              </span>
              {thinkingExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {thinkingExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-purple-50/50 dark:bg-purple-950/20 rounded-xl px-4 py-3 text-xs text-muted-foreground border border-purple-100/50 dark:border-purple-800/30 max-h-64 overflow-y-auto chat-scroll"
              >
                <pre className="whitespace-pre-wrap font-mono leading-relaxed">{message.thinking}</pre>
              </motion.div>
            )}
          </div>
        )}

        {/* Tool calls display — friendly "working on it" style */}
        {isAssistant && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-2 space-y-2 w-full max-w-lg">
            {message.toolCalls.map((tc, i) => {
              const toolInfo = getToolLabel(tc.function.name);
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-blue-50/80 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/30 rounded-xl px-4 py-3"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                      <Wrench className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                        {toolInfo.label || tc.function.name.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-blue-600/70 dark:text-blue-400/60">
                        {toolInfo.description || 'Running a tool...'}
                      </p>
                    </div>
                  </div>
                  {Object.keys(tc.function.arguments).length > 0 && (
                    <div className="mt-2 bg-white/60 dark:bg-black/20 rounded-lg px-3 py-2">
                      <p className="text-xs text-blue-700/70 dark:text-blue-300/70 font-mono">
                        {Object.entries(tc.function.arguments).map(([k, v]) => (
                          <span key={k} className="block">
                            <span className="text-blue-500 dark:text-blue-400">{k}:</span> {String(v)}
                          </span>
                        ))}
                      </p>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Message bubble */}
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-blue-500 text-white rounded-br-md max-w-lg'
              : 'bg-card border border-border shadow-sm rounded-bl-md w-full max-w-none'
          }`}
        >
          {/* User images */}
          {message.images && message.images.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {message.images.map((img, i) => (
                <img
                  key={i}
                  src={`data:image/png;base64,${img}`}
                  alt="Uploaded"
                  className="max-w-48 max-h-48 rounded-lg object-cover"
                />
              ))}
            </div>
          )}

          {message.content ? (
            isUser ? (
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
            ) : (
              <div className={`prose-chat ${message.isStreaming && isLast ? 'streaming-cursor' : ''}`}>
                <Streamdown>{message.content}</Streamdown>
              </div>
            )
          ) : message.isStreaming ? (
            <div className="flex items-center gap-1.5 py-1">
              <div className="typing-dot w-2 h-2 rounded-full bg-primary/40" />
              <div className="typing-dot w-2 h-2 rounded-full bg-primary/40" />
              <div className="typing-dot w-2 h-2 rounded-full bg-primary/40" />
            </div>
          ) : null}
        </div>

        {/* Rich embeds for URLs in assistant messages */}
        {urls.length > 0 && (
          <div className="space-y-1">
            {urls.slice(0, 3).map((url, i) => (
              <RichEmbed key={i} url={url} />
            ))}
          </div>
        )}

        {/* Error indicator */}
        {message.content?.startsWith('Sorry, I couldn\'t respond') && (
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-destructive">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>There was an issue getting a response</span>
          </div>
        )}

        {/* Actions bar for assistant messages */}
        {isAssistant && !message.isStreaming && message.content && (
          <div className="flex items-center gap-0.5 mt-2 opacity-0 group-hover:opacity-100 hover:!opacity-100 transition-opacity duration-200">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground rounded-lg"
              onClick={handleCopy}
              title="Copy response"
            >
              {copied ? <Check className="w-3.5 h-3.5 mr-1 text-green-500" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
