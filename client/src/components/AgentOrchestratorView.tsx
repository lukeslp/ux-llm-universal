// ============================================================
// AgentOrchestratorView — Multi-agent visualization
// Extends ManusTaskView concept for orchestration patterns.
// Theme-aware from start.
// ============================================================

import { Network, Bot, Activity } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { motion } from 'framer-motion';

interface AgentNode {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'active' | 'done' | 'error';
}

const DEMO_AGENTS: AgentNode[] = [
  { id: '1', name: 'Researcher', role: 'belter', status: 'idle' },
  { id: '2', name: 'Synthesizer', role: 'drummer', status: 'idle' },
  { id: '3', name: 'Reporter', role: 'camina', status: 'idle' },
  { id: '4', name: 'Validator', role: 'belter', status: 'idle' },
];

export default function AgentOrchestratorView() {
  const { themeName } = useTheme();

  const getStatusColor = (status: AgentNode['status']) => {
    switch (status) {
      case 'active':
        return themeName === 'hearthstone' ? 'border-amber-500 bg-amber-500/10' :
          themeName === 'zurich' ? 'border-[oklch(0.55_0.22_29)] bg-[oklch(0.55_0.22_29)]/5' :
          'border-indigo-500 bg-indigo-500/10';
      case 'done':
        return 'border-green-500 bg-green-500/10';
      case 'error':
        return 'border-destructive bg-destructive/10';
      default:
        return 'border-border bg-card';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'belter': return themeName === 'zurich' ? 'bg-blue-600' : 'bg-blue-500';
      case 'drummer': return themeName === 'zurich' ? 'bg-[oklch(0.55_0.22_29)]' : 'bg-rose-500';
      case 'camina': return themeName === 'zurich' ? 'bg-[oklch(0.13_0_0)] dark:bg-[oklch(0.95_0_0)]' : 'bg-purple-500';
      default: return 'bg-muted-foreground';
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
      <div className="text-center max-w-2xl">
        <div className={`w-16 h-16 mx-auto mb-6 flex items-center justify-center ${
          themeName === 'hearthstone' ? 'rounded-2xl bg-amber-900/20' :
          themeName === 'zurich' ? 'rounded-none border-2 border-border' :
          'rounded-2xl bg-indigo-900/20'
        }`}>
          <Network className="w-8 h-8 text-muted-foreground" />
        </div>

        <p className="eyebrow mb-2">AGENT ORCHESTRATION</p>
        <h2 className="text-xl font-bold mb-2">Multi-Agent Coordination</h2>
        <p className="text-sm text-muted-foreground mb-8">
          Coordinate multiple AI agents for complex research and task execution
        </p>

        {/* Agent grid */}
        <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
          {DEMO_AGENTS.map((agent, i) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`p-4 border-2 ${getStatusColor(agent.status)} transition-all ${
                themeName === 'zurich' ? 'rounded-none' : 'rounded-xl'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${getRoleColor(agent.role)}`} />
                <span className="eyebrow">{agent.role.toUpperCase()}</span>
              </div>
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold">{agent.name}</span>
              </div>
              <div className="flex items-center gap-1 mt-2">
                <Activity className="w-3 h-3 text-muted-foreground/60" />
                <span className="text-xs text-muted-foreground/60 capitalize">{agent.status}</span>
              </div>
            </motion.div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground/50 mt-6">
          Coming soon: beltalowda/swarm/hive orchestration patterns
        </p>
      </div>
    </div>
  );
}
