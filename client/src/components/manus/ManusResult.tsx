// ============================================================
// ManusResult — Structured results display for Manus tasks
// Summary card, artifacts grid, Fork to Chat button
// ============================================================

import { useState } from 'react';
import { Copy, Check, Download, ExternalLink, MessageSquare, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ManusTask, ManusArtifact } from '@/lib/types';
import { useChat } from '@/contexts/ChatContext';

interface Props {
  task: ManusTask;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 w-7 p-0 opacity-60 hover:opacity-100">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </Button>
  );
}

function ArtifactCard({ artifact }: { artifact: ManusArtifact }) {
  const [expanded, setExpanded] = useState(artifact.type !== 'code' || artifact.content.length < 500);

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground/60 uppercase tracking-wide">
            {artifact.type}
          </span>
          <span className="text-sm font-medium truncate max-w-48">{artifact.name}</span>
        </div>
        <div className="flex items-center gap-1">
          {artifact.type === 'code' && <CopyButton text={artifact.content} />}
          {artifact.type === 'file' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1 text-xs opacity-60 hover:opacity-100"
              onClick={() => {
                const blob = new Blob([artifact.content]);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = artifact.name;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="w-3 h-3" />
              Download
            </Button>
          )}
          {artifact.type === 'link' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1 text-xs opacity-60 hover:opacity-100"
              onClick={() => window.open(artifact.content, '_blank')}
            >
              <ExternalLink className="w-3 h-3" />
              Open
            </Button>
          )}
          {artifact.type === 'code' && artifact.content.length > 500 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 opacity-60 hover:opacity-100"
              onClick={() => setExpanded(e => !e)}
            >
              {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="p-3">
          {artifact.type === 'image' ? (
            <img
              src={artifact.content}
              alt={artifact.name}
              className="max-w-full rounded-lg"
            />
          ) : artifact.type === 'link' ? (
            <a
              href={artifact.content}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-violet-600 dark:text-violet-400 hover:underline break-all"
            >
              {artifact.content}
            </a>
          ) : (
            <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap break-words overflow-auto max-h-80">
              {artifact.content}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function ResultSection({ title, content }: { title: string; content: string }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
      >
        <span className="text-sm font-semibold">{title}</span>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-4 py-3">
          <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{content}</p>
        </div>
      )}
    </div>
  );
}

// Parse result into sections (look for ## headings)
function parseResultSections(result: string): Array<{ title: string; content: string }> {
  const lines = result.split('\n');
  const sections: Array<{ title: string; content: string }> = [];
  let currentTitle = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^#+\s+(.+)/);
    if (headingMatch) {
      if (currentContent.length > 0 || currentTitle) {
        sections.push({ title: currentTitle || 'Summary', content: currentContent.join('\n').trim() });
      }
      currentTitle = headingMatch[1];
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentContent.length > 0 || currentTitle) {
    sections.push({ title: currentTitle || 'Result', content: currentContent.join('\n').trim() });
  }

  return sections.filter(s => s.content.length > 0);
}

export default function ManusResult({ task }: Props) {
  const { dispatch, createConversation } = useChat();

  if (!task.result && (!task.artifacts || task.artifacts.length === 0)) return null;

  const sections = task.result ? parseResultSections(task.result) : [];
  const hasMultipleSections = sections.length > 1;

  const handleForkToChat = () => {
    const convId = createConversation();
    // Set the provider back to a chat-capable one
    dispatch({
      type: 'SET_SETTINGS',
      payload: { provider: 'ollama' },
    });
    dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: convId });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Task Result</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleForkToChat}
          className="h-7 px-3 gap-1.5 text-xs border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30"
        >
          <MessageSquare className="w-3 h-3" />
          Fork to Chat
        </Button>
      </div>

      {/* Result content */}
      {task.result && (
        <div>
          {hasMultipleSections ? (
            <div className="space-y-2">
              {sections.map((section, i) => (
                <ResultSection key={i} title={section.title} content={section.content} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-xs text-muted-foreground/60 font-medium uppercase tracking-wide">Result</span>
                <CopyButton text={task.result} />
              </div>
              <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{task.result}</p>
            </div>
          )}
        </div>
      )}

      {/* Artifacts */}
      {task.artifacts && task.artifacts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wide px-1">
            Artifacts ({task.artifacts.length})
          </h4>
          {task.artifacts.map((artifact, i) => (
            <ArtifactCard key={i} artifact={artifact} />
          ))}
        </div>
      )}
    </div>
  );
}
