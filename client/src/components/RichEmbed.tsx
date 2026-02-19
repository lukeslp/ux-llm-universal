// ============================================================
// RichEmbed — Detects and renders rich media from URLs
// Design: Warm Companion — friendly media cards
// ============================================================

import { useState } from 'react';
import { ExternalLink, Play, Image as ImageIcon, Link2, FileText } from 'lucide-react';
import { motion } from 'framer-motion';

interface EmbedData {
  type: 'youtube' | 'image' | 'link' | 'twitter' | 'github' | 'codepen';
  url: string;
  title?: string;
  thumbnail?: string;
  embedUrl?: string;
}

function detectEmbed(url: string): EmbedData | null {
  try {
    const u = new URL(url);

    // YouTube
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      let videoId = '';
      if (u.hostname.includes('youtu.be')) {
        videoId = u.pathname.slice(1);
      } else {
        videoId = u.searchParams.get('v') || '';
      }
      if (videoId) {
        return {
          type: 'youtube',
          url,
          title: 'YouTube Video',
          thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          embedUrl: `https://www.youtube.com/embed/${videoId}`,
        };
      }
    }

    // Image URLs
    if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(u.pathname)) {
      return { type: 'image', url, title: 'Image' };
    }

    // GitHub
    if (u.hostname === 'github.com') {
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return {
          type: 'github',
          url,
          title: `${parts[0]}/${parts[1]}`,
          thumbnail: `https://opengraph.githubassets.com/1/${parts[0]}/${parts[1]}`,
        };
      }
    }

    // Twitter/X
    if (u.hostname === 'twitter.com' || u.hostname === 'x.com') {
      return { type: 'twitter', url, title: 'Tweet' };
    }

    // CodePen
    if (u.hostname === 'codepen.io') {
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 3 && parts[1] === 'pen') {
        return {
          type: 'codepen',
          url,
          title: 'CodePen',
          embedUrl: `https://codepen.io/${parts[0]}/embed/${parts[2]}?default-tab=result`,
        };
      }
    }

    // Generic link
    return { type: 'link', url, title: u.hostname };
  } catch {
    return null;
  }
}

// Extract URLs from text
export function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>\"')\]]+/g;
  return text.match(urlRegex) || [];
}

interface Props {
  url: string;
}

export default function RichEmbed({ url }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const embed = detectEmbed(url);

  if (!embed) return null;

  if (embed.type === 'youtube') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-2 rounded-xl overflow-hidden border border-border bg-card max-w-md"
      >
        {expanded ? (
          <div className="aspect-video">
            <iframe
              src={embed.embedUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="YouTube video"
            />
          </div>
        ) : (
          <button
            onClick={() => setExpanded(true)}
            className="relative w-full aspect-video group"
          >
            <img
              src={embed.thumbnail}
              alt="Video thumbnail"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
              <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                <Play className="w-6 h-6 text-white ml-1" fill="white" />
              </div>
            </div>
          </button>
        )}
        <div className="p-3 flex items-center gap-2">
          <Play className="w-4 h-4 text-red-500 shrink-0" />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-foreground hover:text-primary truncate font-medium"
          >
            YouTube Video
          </a>
          <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0 ml-auto" />
        </div>
      </motion.div>
    );
  }

  if (embed.type === 'image' && !imgError) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-2 max-w-md"
      >
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img
            src={url}
            alt="Embedded image"
            className="rounded-xl border border-border max-h-80 object-contain"
            onError={() => setImgError(true)}
          />
        </a>
      </motion.div>
    );
  }

  if (embed.type === 'github') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-2 rounded-xl overflow-hidden border border-border bg-card max-w-md"
      >
        {embed.thumbnail && (
          <img
            src={embed.thumbnail}
            alt="GitHub preview"
            className="w-full aspect-[2/1] object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        <div className="p-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-foreground hover:text-primary truncate font-medium"
          >
            {embed.title}
          </a>
          <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0 ml-auto" />
        </div>
      </motion.div>
    );
  }

  if (embed.type === 'codepen' && embed.embedUrl) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-2 rounded-xl overflow-hidden border border-border bg-card max-w-md"
      >
        {expanded ? (
          <iframe
            src={embed.embedUrl}
            className="w-full h-64"
            title="CodePen embed"
          />
        ) : (
          <button
            onClick={() => setExpanded(true)}
            className="w-full p-4 text-center hover:bg-accent/50 transition-colors"
          >
            <p className="text-sm font-medium">Click to load CodePen</p>
          </button>
        )}
        <div className="p-3 flex items-center gap-2 border-t border-border">
          <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-foreground hover:text-primary truncate font-medium"
          >
            CodePen
          </a>
          <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0 ml-auto" />
        </div>
      </motion.div>
    );
  }

  // Generic link card
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-2 rounded-xl border border-border bg-card max-w-md"
    >
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 p-3 hover:bg-accent/30 transition-colors rounded-xl"
      >
        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Link2 className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{embed.title}</p>
          <p className="text-xs text-muted-foreground truncate">{url}</p>
        </div>
        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      </a>
    </motion.div>
  );
}
