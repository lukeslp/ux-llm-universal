// ============================================================
// Research Page — Multi-agent orchestration (beltalowda)
// Route: /research, /research/:taskId
// 3-tier agent grid: belters → drummers → camina
// ============================================================

import { useState } from 'react';
import {
  Network, Send, Square, Loader2, Download, FileText,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
import { useOrchestration, OrchestrationProvider, type AgentState } from '@/contexts/OrchestrationContext';
import { useProviders } from '@/contexts/ProviderContext';
import { apiUrl } from '@/lib/api-base';
import { cn } from '@/lib/utils';

// Agent card component
function AgentCard({ agent }: { agent: AgentState }) {
  const [expanded, setExpanded] = useState(false);
  const tierColors = {
    belter: 'border-t-blue-500',
    drummer: 'border-t-rose-500',
    camina: 'border-t-purple-500',
  };

  const tierBg = {
    belter: 'bg-blue-500/5',
    drummer: 'bg-rose-500/5',
    camina: 'bg-purple-500/5',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border border-border/50 p-3 border-t-2',
        tierColors[agent.type],
        tierBg[agent.type],
        agent.type === 'drummer' && 'col-span-2',
        agent.type === 'camina' && 'col-span-full',
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            {agent.type}
          </span>
          {agent.name && (
            <span className="text-xs text-foreground/70 truncate">{agent.name}</span>
          )}
        </div>
        {agent.status === 'running' && (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
        )}
        {agent.status === 'complete' && (
          <span className="text-xs text-emerald-500 font-medium">Done</span>
        )}
        {agent.status === 'error' && (
          <span className="text-xs text-destructive font-medium">Failed</span>
        )}
      </div>

      {agent.task && (
        <p className="text-sm text-foreground/80 line-clamp-2 mb-2">{agent.task}</p>
      )}

      {agent.status === 'running' && (
        <div className="space-y-1">
          <Progress value={agent.progress} className="h-1.5" />
          {agent.description && (
            <p className="text-[11px] text-muted-foreground/60 truncate">{agent.description}</p>
          )}
        </div>
      )}

      {agent.preview && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? 'Collapse' : 'Preview'}
        </button>
      )}
      {expanded && agent.preview && (
        <p className="mt-1 text-xs text-muted-foreground/80 bg-muted/30 rounded p-2">{agent.preview}</p>
      )}
    </motion.div>
  );
}

function ResearchContent() {
  const { activeTask, taskHistory, startResearch, cancelResearch } = useOrchestration();
  const { providers } = useProviders();
  const [prompt, setPrompt] = useState('');
  const [agentCount, setAgentCount] = useState(5);
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [selectedModel, setSelectedModel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Get available chat providers
  const chatProviders = providers.filter(p => p.id !== 'manus' && p.models.length > 0);

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    setSubmitting(true);
    try {
      await startResearch(prompt.trim(), selectedProvider, selectedModel, agentCount);
      setPrompt('');
    } catch (err) {
      // Error handled by context
    } finally {
      setSubmitting(false);
    }
  };

  const isRunning = activeTask && !['complete', 'error', 'cancelled'].includes(activeTask.status);

  // Group agents by tier
  const belters = activeTask ? Array.from(activeTask.agents.values()).filter(a => a.type === 'belter') : [];
  const drummers = activeTask ? Array.from(activeTask.agents.values()).filter(a => a.type === 'drummer') : [];
  const caminas = activeTask ? Array.from(activeTask.agents.values()).filter(a => a.type === 'camina') : [];

  // If no active task, show input
  if (!activeTask) {
    return (
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-2xl space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4">
                <Network className="w-8 h-8 text-blue-500/60" />
              </div>
              <h2 className="text-xl font-semibold text-foreground/80 mb-2">Research Orchestration</h2>
              <p className="text-sm text-muted-foreground/60">
                Submit a research prompt and watch a team of AI agents work in parallel
              </p>
            </div>

            {/* Task prompt */}
            <div>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Describe your research task..."
                rows={4}
                className="w-full resize-none border border-border bg-card px-4 py-3 text-[15px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all rounded-xl"
              />
            </div>

            {/* Config row */}
            <div className="flex items-center gap-4 flex-wrap">
              {chatProviders.length > 0 && (
                <Select value={selectedProvider} onValueChange={v => { setSelectedProvider(v); setSelectedModel(''); }}>
                  <SelectTrigger className="h-9 text-sm w-auto min-w-[140px]">
                    <SelectValue placeholder="Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {chatProviders.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {agentCount} agent{agentCount !== 1 ? 's' : ''}
                </span>
                <Slider
                  value={[agentCount]}
                  onValueChange={([v]) => setAgentCount(v)}
                  min={1}
                  max={30}
                  step={1}
                  className="flex-1"
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={!prompt.trim() || submitting}
                className="gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Start Research
              </Button>
            </div>

            {/* Past tasks */}
            {taskHistory.length > 0 && (
              <div className="pt-6 border-t border-border/30">
                <p className="eyebrow mb-3">Previous Research</p>
                <div className="space-y-2">
                  {taskHistory.slice(0, 5).map(task => (
                    <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                      <Network className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{task.prompt}</p>
                        <p className="text-xs text-muted-foreground/60">
                          {task.agentCount} agents · {task.status}
                          {task.executionTime ? ` · ${Math.round(task.executionTime)}s` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Active task view — agent grid
  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      {/* Task header */}
      <div className="px-6 py-4 border-b border-border/30 bg-background/60 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{activeTask.prompt}</p>
            <p className="text-xs text-muted-foreground/60">
              {activeTask.agentCount} agents · {activeTask.provider} · {activeTask.status}
            </p>
          </div>
          {isRunning && (
            <Button variant="outline" size="sm" onClick={cancelResearch} className="gap-1.5 shrink-0">
              <Square className="w-3.5 h-3.5" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Agent execution grid */}
      <div className="flex-1 p-6 space-y-6">
        {/* Belters */}
        {belters.length > 0 && (
          <div>
            <p className="eyebrow mb-3 text-blue-500/80">Belter Agents ({belters.length})</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              <AnimatePresence>
                {belters.map(agent => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Drummers */}
        {drummers.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1 bg-border/30" />
              <span className="eyebrow text-rose-500/80">Synthesis</span>
              <div className="h-px flex-1 bg-border/30" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <AnimatePresence>
                {drummers.map(agent => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Camina */}
        {caminas.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1 bg-border/30" />
              <span className="eyebrow text-purple-500/80">Executive</span>
              <div className="h-px flex-1 bg-border/30" />
            </div>
            <AnimatePresence>
              {caminas.map(agent => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </AnimatePresence>

            {/* Streaming camina content */}
            {activeTask.caminaContent && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 p-4 rounded-xl bg-purple-500/5 border border-purple-500/10"
              >
                <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                  {activeTask.caminaContent}
                </p>
              </motion.div>
            )}
          </div>
        )}

        {/* Artifacts */}
        {activeTask.artifacts.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1 bg-border/30" />
              <span className="eyebrow">Artifacts ({activeTask.artifacts.length})</span>
              <div className="h-px flex-1 bg-border/30" />
            </div>
            <div className="flex flex-wrap gap-2">
              {activeTask.artifacts.map((artifact, i) => (
                <a
                  key={i}
                  href={apiUrl(`/api/beltalowda/download/${activeTask.id}/${artifact.downloadPath}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border/50 hover:bg-muted transition-colors text-sm"
                >
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="truncate max-w-[200px]">{artifact.filename}</span>
                  <Download className="w-3.5 h-3.5 text-muted-foreground" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Completion summary */}
        {activeTask.status === 'complete' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center"
          >
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              Research complete
              {activeTask.executionTime ? ` in ${Math.round(activeTask.executionTime)}s` : ''}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 gap-2"
              asChild
            >
              <a
                href={apiUrl(`/api/beltalowda/download/${activeTask.id}/final-report`)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="w-4 h-4" />
                Download Report
              </a>
            </Button>
          </motion.div>
        )}

        {activeTask.status === 'error' && (
          <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 text-center">
            <p className="text-sm text-destructive">{activeTask.error || 'Research task failed'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Wrap with OrchestrationProvider
export default function ResearchPage() {
  return (
    <OrchestrationProvider>
      <ResearchContent />
    </OrchestrationProvider>
  );
}
