// ============================================================
// ChatMessage — Individual message bubble with rich content
// Design: Warm Companion — soft bubbles, friendly avatars
// ============================================================

import { useState, useMemo } from 'react';
import { Streamdown } from 'streamdown';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Wrench,
  AlertCircle,
  Cloud,
  Search,
  BookOpen,
  Globe,
  Newspaper,
  TrendingUp,
  MapPin,
  Github,
  Rocket,
  GraduationCap,
  Youtube,
  FileText,
  Archive,
  BarChart3,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ChatMessage as ChatMessageType } from '@/lib/types';
import { useTheme } from '@/contexts/ThemeContext';
import RichEmbed, { extractUrls } from '@/components/RichEmbed';

const AI_AVATAR_URL = '/images/ai-avatar.png';

// --- Tool metadata: icons, labels, and result formatters ---

interface ToolMeta {
  label: string;
  description: string;
  icon: typeof Cloud;
  color: string; // tailwind color class base e.g. "blue", "amber", "green"
}

const TOOL_META: Record<string, ToolMeta> = {
  // Weather
  weather_get_current: { label: 'Weather', description: 'Checking current conditions', icon: Cloud, color: 'sky' },
  weather_get_forecast: { label: 'Forecast', description: 'Looking up weather forecast', icon: Cloud, color: 'sky' },
  weather_get_alerts: { label: 'Weather Alerts', description: 'Checking for alerts', icon: Cloud, color: 'orange' },
  // News
  news_top_headlines: { label: 'Headlines', description: 'Fetching top stories', icon: Newspaper, color: 'rose' },
  news_search: { label: 'News Search', description: 'Searching news articles', icon: Newspaper, color: 'rose' },
  news_sources: { label: 'News Sources', description: 'Getting news sources', icon: Newspaper, color: 'rose' },
  // Finance
  finance_daily_time_series: { label: 'Stock Data', description: 'Looking up stock prices', icon: TrendingUp, color: 'emerald' },
  finance_fx_rate: { label: 'Forex Rate', description: 'Checking exchange rate', icon: TrendingUp, color: 'emerald' },
  finance_crypto_quote: { label: 'Crypto Price', description: 'Checking crypto price', icon: TrendingUp, color: 'emerald' },
  // GitHub
  github_search_repositories: { label: 'GitHub Search', description: 'Searching repositories', icon: Github, color: 'slate' },
  github_search_code: { label: 'Code Search', description: 'Searching code on GitHub', icon: Github, color: 'slate' },
  github_get_repository: { label: 'Repo Info', description: 'Getting repository details', icon: Github, color: 'slate' },
  github_search_issues: { label: 'Issue Search', description: 'Searching GitHub issues', icon: Github, color: 'slate' },
  // NASA
  nasa_get_apod: { label: 'NASA APOD', description: 'Astronomy Picture of the Day', icon: Rocket, color: 'indigo' },
  nasa_get_mars_photos: { label: 'Mars Photos', description: 'Getting Mars rover images', icon: Rocket, color: 'indigo' },
  nasa_get_earth_imagery: { label: 'Earth Imagery', description: 'Getting satellite imagery', icon: Rocket, color: 'indigo' },
  nasa_get_neo_feed: { label: 'Near Earth Objects', description: 'Checking nearby asteroids', icon: Rocket, color: 'indigo' },
  // Wikipedia
  wikipedia_search: { label: 'Wikipedia', description: 'Searching Wikipedia', icon: Globe, color: 'zinc' },
  wikipedia_get_summary: { label: 'Wikipedia', description: 'Getting article summary', icon: Globe, color: 'zinc' },
  wikipedia_get_full_content: { label: 'Wikipedia', description: 'Reading full article', icon: Globe, color: 'zinc' },
  // YouTube
  youtube_search_videos: { label: 'YouTube', description: 'Searching videos', icon: Youtube, color: 'red' },
  youtube_channel_statistics: { label: 'YouTube Channel', description: 'Getting channel stats', icon: Youtube, color: 'red' },
  youtube_playlist_items: { label: 'YouTube Playlist', description: 'Getting playlist items', icon: Youtube, color: 'red' },
  // arXiv
  arxiv_search: { label: 'arXiv', description: 'Searching academic papers', icon: GraduationCap, color: 'amber' },
  arxiv_get_paper: { label: 'arXiv Paper', description: 'Getting paper details', icon: GraduationCap, color: 'amber' },
  // Semantic Scholar
  semantic_scholar_search: { label: 'Scholar Search', description: 'Searching research papers', icon: GraduationCap, color: 'teal' },
  semantic_scholar_get_paper: { label: 'Paper Details', description: 'Getting paper info', icon: GraduationCap, color: 'teal' },
  semantic_scholar_search_author: { label: 'Author Search', description: 'Searching for authors', icon: GraduationCap, color: 'teal' },
  // Open Library
  openlibrary_search_books: { label: 'Book Search', description: 'Searching for books', icon: BookOpen, color: 'orange' },
  openlibrary_get_book: { label: 'Book Details', description: 'Getting book info', icon: BookOpen, color: 'orange' },
  openlibrary_get_author: { label: 'Author Info', description: 'Getting author details', icon: BookOpen, color: 'orange' },
  // Census
  census_fetch_population: { label: 'Census Data', description: 'Looking up population data', icon: BarChart3, color: 'cyan' },
  census_fetch_acs: { label: 'Census ACS', description: 'Getting ACS survey data', icon: BarChart3, color: 'cyan' },
  // Archive
  archive_get_latest_snapshot: { label: 'Web Archive', description: 'Looking up archived page', icon: Archive, color: 'stone' },
  archive_list_snapshots: { label: 'Archive History', description: 'Listing page snapshots', icon: Archive, color: 'stone' },
  archive_url: { label: 'Archive URL', description: 'Getting archive URL', icon: Archive, color: 'stone' },
  // Builtins
  get_current_time: { label: 'Current Time', description: 'Checking the time', icon: Cloud, color: 'blue' },
  calculate: { label: 'Calculator', description: 'Running a calculation', icon: BarChart3, color: 'blue' },
};

function getToolMeta(name: string): ToolMeta {
  if (TOOL_META[name]) return TOOL_META[name];
  const readable = name.replace(/_/g, ' ').replace(/^(get|search|fetch)\s/, '');
  const capitalized = readable.charAt(0).toUpperCase() + readable.slice(1);
  return { label: capitalized, description: `Running ${readable}...`, icon: Wrench, color: 'blue' };
}

// --- Smart result formatters ---

function formatToolResult(toolName: string, rawContent: string): { summary: string; details: Array<{ label: string; value: string; link?: string }> } {
  try {
    const data = JSON.parse(rawContent);
    return formatParsedResult(toolName, data);
  } catch {
    // Not JSON — just show as text
    return { summary: rawContent.slice(0, 200), details: [] };
  }
}

function formatParsedResult(toolName: string, data: any): { summary: string; details: Array<{ label: string; value: string; link?: string }> } {
  const details: Array<{ label: string; value: string; link?: string }> = [];

  // Weather
  if (toolName.includes('weather') && toolName.includes('current')) {
    const temp = data.temperature ?? data.temp;
    const desc = data.description ?? data.conditions ?? data.weather;
    const wind = data.wind_speed ?? data.windSpeed;
    const humidity = data.humidity;
    const location = data.location ?? data.name;
    const summary = location
      ? `${location}: ${temp != null ? `${temp}°` : ''} ${desc || ''}`
      : `${temp != null ? `${temp}°` : ''} ${desc || ''}`;
    if (temp != null) details.push({ label: 'Temperature', value: `${temp}°` });
    if (desc) details.push({ label: 'Conditions', value: String(desc) });
    if (wind != null) details.push({ label: 'Wind', value: `${wind} mph` });
    if (humidity != null) details.push({ label: 'Humidity', value: `${humidity}%` });
    return { summary: summary.trim() || 'Weather data retrieved', details };
  }

  // Search results (Brave, DuckDuckGo, Tavily, Wikipedia, etc.)
  if (data.results && Array.isArray(data.results)) {
    const count = data.results.length;
    const total = data.total_count ?? data.count ?? count;
    const firstResults = data.results.slice(0, 3);
    for (const r of firstResults) {
      const title = r.title || r.name || r.query || 'Result';
      const desc = r.description || r.snippet || r.abstract || '';
      details.push({
        label: title,
        value: desc.slice(0, 120) + (desc.length > 120 ? '...' : ''),
        link: r.url || r.link || r.html_url,
      });
    }
    return { summary: `Found ${total} result${total !== 1 ? 's' : ''}`, details };
  }

  // Repositories
  if (data.repositories && Array.isArray(data.repositories)) {
    const count = data.total_count ?? data.repositories.length;
    for (const r of data.repositories.slice(0, 3)) {
      details.push({
        label: r.full_name || r.name || 'Repo',
        value: `${r.description?.slice(0, 100) || 'No description'} ★${r.stars ?? r.stargazers_count ?? 0}`,
        link: r.html_url || r.url,
      });
    }
    return { summary: `Found ${count} repositor${count !== 1 ? 'ies' : 'y'}`, details };
  }

  // Stock / Finance
  if (data.symbol && (data.price != null || data.current_price != null)) {
    const price = data.price ?? data.current_price;
    const change = data.change ?? data.change_percent;
    details.push({ label: 'Price', value: `$${price}` });
    if (change != null) details.push({ label: 'Change', value: `${change > 0 ? '+' : ''}${change}%` });
    if (data.volume) details.push({ label: 'Volume', value: String(data.volume) });
    return { summary: `${data.symbol}: $${price}${change != null ? ` (${change > 0 ? '+' : ''}${change}%)` : ''}`, details };
  }

  // NASA APOD
  if (data.title && data.explanation && (data.url || data.hdurl)) {
    details.push({ label: 'Title', value: data.title });
    details.push({ label: 'Date', value: data.date || 'Today' });
    if (data.url) details.push({ label: 'Image', value: 'View image', link: data.hdurl || data.url });
    return { summary: data.title, details };
  }

  // News headlines
  if (data.articles && Array.isArray(data.articles)) {
    for (const a of data.articles.slice(0, 3)) {
      details.push({
        label: a.source?.name || 'News',
        value: a.title || a.description || '',
        link: a.url,
      });
    }
    return { summary: `${data.articles.length} article${data.articles.length !== 1 ? 's' : ''} found`, details };
  }

  // Books
  if (data.docs && Array.isArray(data.docs)) {
    for (const b of data.docs.slice(0, 3)) {
      details.push({
        label: b.title || 'Book',
        value: b.author_name?.join(', ') || 'Unknown author',
      });
    }
    return { summary: `Found ${data.numFound ?? data.docs.length} book${(data.numFound ?? data.docs.length) !== 1 ? 's' : ''}`, details };
  }

  // Generic: try to extract a meaningful summary
  if (typeof data === 'object' && data !== null) {
    const keys = Object.keys(data);
    // Look for common summary fields
    for (const key of ['title', 'name', 'summary', 'message', 'description', 'text', 'content']) {
      if (data[key] && typeof data[key] === 'string') {
        return { summary: data[key].slice(0, 200), details: [] };
      }
    }
    // Show key-value pairs for small objects
    if (keys.length <= 6) {
      for (const k of keys) {
        const v = data[k];
        if (v != null && typeof v !== 'object') {
          details.push({ label: k.replace(/_/g, ' '), value: String(v).slice(0, 100) });
        }
      }
      return { summary: `${keys.length} field${keys.length !== 1 ? 's' : ''} returned`, details };
    }
    return { summary: `Response with ${keys.length} fields`, details: [] };
  }

  return { summary: String(data).slice(0, 200), details: [] };
}

// --- Color utility ---
function toolColorClasses(color: string) {
  const map: Record<string, { bg: string; border: string; text: string; icon: string; badge: string }> = {
    sky: { bg: 'bg-sky-50/80 dark:bg-sky-950/20', border: 'border-sky-200/60 dark:border-sky-800/30', text: 'text-sky-800 dark:text-sky-300', icon: 'bg-sky-100 dark:bg-sky-900/40 text-sky-500', badge: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300' },
    blue: { bg: 'bg-blue-50/80 dark:bg-blue-950/20', border: 'border-blue-200/60 dark:border-blue-800/30', text: 'text-blue-800 dark:text-blue-300', icon: 'bg-blue-100 dark:bg-blue-900/40 text-blue-500', badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
    violet: { bg: 'bg-violet-50/80 dark:bg-violet-950/20', border: 'border-violet-200/60 dark:border-violet-800/30', text: 'text-violet-800 dark:text-violet-300', icon: 'bg-violet-100 dark:bg-violet-900/40 text-violet-500', badge: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300' },
    green: { bg: 'bg-green-50/80 dark:bg-green-950/20', border: 'border-green-200/60 dark:border-green-800/30', text: 'text-green-800 dark:text-green-300', icon: 'bg-green-100 dark:bg-green-900/40 text-green-500', badge: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
    emerald: { bg: 'bg-emerald-50/80 dark:bg-emerald-950/20', border: 'border-emerald-200/60 dark:border-emerald-800/30', text: 'text-emerald-800 dark:text-emerald-300', icon: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-500', badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
    rose: { bg: 'bg-rose-50/80 dark:bg-rose-950/20', border: 'border-rose-200/60 dark:border-rose-800/30', text: 'text-rose-800 dark:text-rose-300', icon: 'bg-rose-100 dark:bg-rose-900/40 text-rose-500', badge: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300' },
    amber: { bg: 'bg-amber-50/80 dark:bg-amber-950/20', border: 'border-amber-200/60 dark:border-amber-800/30', text: 'text-amber-800 dark:text-amber-300', icon: 'bg-amber-100 dark:bg-amber-900/40 text-amber-500', badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
    orange: { bg: 'bg-orange-50/80 dark:bg-orange-950/20', border: 'border-orange-200/60 dark:border-orange-800/30', text: 'text-orange-800 dark:text-orange-300', icon: 'bg-orange-100 dark:bg-orange-900/40 text-orange-500', badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' },
    red: { bg: 'bg-red-50/80 dark:bg-red-950/20', border: 'border-red-200/60 dark:border-red-800/30', text: 'text-red-800 dark:text-red-300', icon: 'bg-red-100 dark:bg-red-900/40 text-red-500', badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
    indigo: { bg: 'bg-indigo-50/80 dark:bg-indigo-950/20', border: 'border-indigo-200/60 dark:border-indigo-800/30', text: 'text-indigo-800 dark:text-indigo-300', icon: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-500', badge: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' },
    teal: { bg: 'bg-teal-50/80 dark:bg-teal-950/20', border: 'border-teal-200/60 dark:border-teal-800/30', text: 'text-teal-800 dark:text-teal-300', icon: 'bg-teal-100 dark:bg-teal-900/40 text-teal-500', badge: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300' },
    cyan: { bg: 'bg-cyan-50/80 dark:bg-cyan-950/20', border: 'border-cyan-200/60 dark:border-cyan-800/30', text: 'text-cyan-800 dark:text-cyan-300', icon: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-500', badge: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300' },
    slate: { bg: 'bg-slate-50/80 dark:bg-slate-800/20', border: 'border-slate-200/60 dark:border-slate-700/30', text: 'text-slate-800 dark:text-slate-300', icon: 'bg-slate-100 dark:bg-slate-800/40 text-slate-500', badge: 'bg-slate-100 dark:bg-slate-800/30 text-slate-700 dark:text-slate-300' },
    zinc: { bg: 'bg-zinc-50/80 dark:bg-zinc-800/20', border: 'border-zinc-200/60 dark:border-zinc-700/30', text: 'text-zinc-800 dark:text-zinc-300', icon: 'bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500', badge: 'bg-zinc-100 dark:bg-zinc-800/30 text-zinc-700 dark:text-zinc-300' },
    stone: { bg: 'bg-stone-50/80 dark:bg-stone-800/20', border: 'border-stone-200/60 dark:border-stone-700/30', text: 'text-stone-800 dark:text-stone-300', icon: 'bg-stone-100 dark:bg-stone-800/40 text-stone-500', badge: 'bg-stone-100 dark:bg-stone-800/30 text-stone-700 dark:text-stone-300' },
  };
  return map[color] || map.blue;
}

// --- Tool Result Card (for tool role messages) ---
function ToolResultCard({ message }: { message: ChatMessageType }) {
  const [expanded, setExpanded] = useState(false);
  const meta = getToolMeta(message.toolName || '');
  const colors = toolColorClasses(meta.color);
  const Icon = meta.icon;
  const { summary, details } = useMemo(
    () => formatToolResult(message.toolName || '', message.content),
    [message.toolName, message.content],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex gap-3 px-4 py-1.5 max-w-3xl mx-auto"
    >
      <div className="w-8 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className={`${colors.bg} border ${colors.border} rounded-xl overflow-hidden`}>
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-2.5">
            <div className={`w-7 h-7 rounded-lg ${colors.icon} flex items-center justify-center shrink-0`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className={`text-sm font-semibold ${colors.text}`}>
                {meta.label}
              </span>
            </div>
            <span className="text-[11px] text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40 px-2 py-0.5 rounded-full font-medium shrink-0">
              Done
            </span>
          </div>

          {/* Summary */}
          {summary && (
            <div className="px-4 pb-2">
              <p className={`text-sm ${colors.text} opacity-80`}>{summary}</p>
            </div>
          )}

          {/* Structured details */}
          {details.length > 0 && (
            <div className="px-4 pb-2 space-y-1.5">
              {details.map((d, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className={`font-medium ${colors.text} opacity-70 shrink-0 min-w-[80px]`}>
                    {d.label}
                  </span>
                  <span className={`${colors.text} opacity-60 flex-1 min-w-0`}>
                    {d.value}
                    {d.link && (
                      <a
                        href={d.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 ml-1 text-blue-500 hover:text-blue-600 dark:text-blue-400"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Expandable raw JSON */}
          <div className="px-4 pb-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className={`flex items-center gap-1 text-[11px] ${colors.text} opacity-50 hover:opacity-80 transition-opacity`}
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? 'Hide' : 'Show'} raw data
            </button>
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <pre className="mt-1.5 bg-white/60 dark:bg-black/20 rounded-lg px-3 py-2 whitespace-pre-wrap font-mono text-[11px] text-foreground/60 break-all leading-relaxed max-h-48 overflow-y-auto chat-scroll">
                    {message.content}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// --- Tool Call Card (for assistant messages with tool_calls) ---
function ToolCallCard({ tc, isExecuting }: { tc: { function: { name: string; arguments: Record<string, unknown> } }; isExecuting?: boolean }) {
  const meta = getToolMeta(tc.function.name);
  const colors = toolColorClasses(meta.color);
  const Icon = meta.icon;
  const args = tc.function.arguments;
  const argEntries = Object.entries(args).filter(([, v]) => v != null && v !== '');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`${colors.bg} border ${colors.border} rounded-lg overflow-hidden`}
    >
      <div className="flex items-center gap-2.5 px-4 py-2.5">
        <div className={`w-7 h-7 rounded-lg ${colors.icon} flex items-center justify-center shrink-0`}>
          {isExecuting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Icon className="w-3.5 h-3.5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${colors.text}`}>{meta.label}</p>
          <p className={`text-xs ${colors.text} opacity-60`}>{meta.description}</p>
        </div>
        {isExecuting && (
          <span className={`text-[11px] ${colors.badge} px-2 py-0.5 rounded-full font-medium shrink-0`}>
            Running...
          </span>
        )}
      </div>
      {argEntries.length > 0 && (
        <div className="px-4 pb-2.5 flex flex-wrap gap-1.5">
          {argEntries.map(([k, v]) => (
            <span key={k} className={`inline-flex items-center gap-1 text-[11px] ${colors.badge} px-2 py-0.5 rounded-full`}>
              <span className="opacity-70">{k}:</span> {String(v).slice(0, 50)}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// --- Main ChatMessage Component ---

interface Props {
  message: ChatMessageType;
  isLast?: boolean;
}

export default function ChatMessage({ message, isLast }: Props) {
  const [copied, setCopied] = useState(false);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const { themeName } = useTheme();

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

  // Tool result message — smart formatted card
  if (isTool) {
    return <ToolResultCard message={message} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`flex gap-3 px-4 py-3 max-w-3xl mx-auto ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar — theme-aware */}
      <div className="shrink-0 mt-0.5">
        {isUser ? (
          <div className={`w-8 h-8 flex items-center justify-center ${
            themeName === 'zurich' ? 'rounded-none bg-[oklch(0.13_0_0)] dark:bg-[oklch(0.95_0_0)]' :
            themeName === 'nebula' ? 'rounded-full bg-indigo-900/40' :
            'rounded-full bg-amber-900/30'
          }`}>
            <User className={`w-4 h-4 ${
              themeName === 'zurich' ? 'text-white dark:text-[oklch(0.13_0_0)]' :
              themeName === 'nebula' ? 'text-indigo-300' :
              'text-amber-300'
            }`} />
          </div>
        ) : (
          <div className={`w-8 h-8 overflow-hidden shadow-sm ${
            themeName === 'zurich' ? 'rounded-none ring-2 ring-[oklch(0.13_0_0)] dark:ring-[oklch(0.95_0_0)]' :
            themeName === 'nebula' ? 'rounded-full ring-2 ring-indigo-500/30' :
            'rounded-full ring-2 ring-amber-700/30'
          }`}>
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
              <span className="eyebrow group-hover:underline">
                {thinkingExpanded ? 'HIDE' : 'SHOW'} REASONING
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

        {/* Tool calls display — color-coded cards */}
        {isAssistant && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-2 space-y-2 w-full max-w-lg">
            {message.toolCalls.map((tc, i) => (
              <ToolCallCard key={i} tc={tc} isExecuting={message.isStreaming} />
            ))}
          </div>
        )}

        {/* Message bubble — theme-aware */}
        <div
          className={`px-4 py-3 ${
            isUser
              ? themeName === 'zurich'
                ? 'rounded-none bg-[oklch(0.13_0_0)] text-white dark:bg-[oklch(0.95_0_0)] dark:text-[oklch(0.13_0_0)] border-l-[4px] border-l-[oklch(0.13_0_0)] dark:border-l-[oklch(0.95_0_0)] max-w-lg'
                : themeName === 'nebula'
                ? 'rounded-2xl rounded-br-md bg-indigo-900/40 text-white border border-indigo-500/20 max-w-lg'
                : 'rounded-2xl rounded-br-md bg-amber-900/30 text-amber-50 border border-amber-700/20 max-w-lg'
              : themeName === 'zurich'
              ? 'rounded-none bg-card border-[3px] border-border border-l-[4px] border-l-primary shadow-none w-full max-w-none'
              : themeName === 'nebula'
              ? 'rounded-2xl rounded-bl-md bg-card border border-border border-l-2 border-l-indigo-500/40 shadow-sm w-full max-w-none'
              : 'rounded-2xl rounded-bl-md bg-card border border-border border-l-2 border-l-amber-600/30 shadow-sm w-full max-w-none'
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
