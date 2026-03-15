// ============================================================
// EmptyState — Welcome screen for new conversations
// Design: Warm Companion — inviting, with suggested prompts
// ============================================================

import { MessageCircle, Calculator, Globe, Lightbulb, Sparkles } from 'lucide-react';
import { useChat } from '@/contexts/ChatContext';
import { useTheme } from '@/contexts/ThemeContext';
import { motion } from 'framer-motion';

const suggestions = [
  {
    icon: MessageCircle,
    label: 'Write something',
    prompt: 'Help me write a friendly email to my team about our upcoming project deadline.',
    iconColor: 'text-white',
    bgColor: 'bg-blue-500/80',
  },
  {
    icon: Lightbulb,
    label: 'Explain a concept',
    prompt: 'Explain how the internet works in simple terms that a 10-year-old could understand.',
    iconColor: 'text-white',
    bgColor: 'bg-amber-500/80',
  },
  {
    icon: Calculator,
    label: 'Solve a problem',
    prompt: 'I need to plan a budget for a small birthday party for 15 people. Can you help?',
    iconColor: 'text-white',
    bgColor: 'bg-green-500/80',
  },
  {
    icon: Globe,
    label: 'Learn something new',
    prompt: 'What are some interesting facts about space that most people don\'t know?',
    iconColor: 'text-white',
    bgColor: 'bg-purple-500/80',
  },
];

export default function EmptyState() {
  const { sendMessage, state } = useChat();
  const { themeName } = useTheme();

  const handleSuggestion = (prompt: string) => {
    if (!state.isConnected) return;
    sendMessage(prompt);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="text-center max-w-lg"
      >
        {/* Icon — theme-aware gradient */}
        <div className={`w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center shadow-lg ${
          themeName === 'nebula' ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
          : themeName === 'slate' ? 'bg-gradient-to-br from-teal-600 to-cyan-700'
          : 'bg-gradient-to-br from-amber-600 to-orange-700'
        }`}>
          <Sparkles className="w-8 h-8 text-white" />
        </div>

        {/* Welcome text */}
        <p className="eyebrow mb-2">NEW CONVERSATION</p>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Hi there! How can I help?
        </h1>
        <p className="text-muted-foreground text-base mb-8">
          Powered by{' '}
          <span className="font-semibold text-primary">{state.settings.defaultModel}</span>.
          Ask me anything or try one of these ideas:
        </p>

        {/* Suggestion cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
          {suggestions.map((s, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 + i * 0.08 }}
              onClick={() => handleSuggestion(s.prompt)}
              disabled={!state.isConnected}
              className="flex items-start gap-3 p-3.5 border border-border/40 bg-card/50 backdrop-blur-sm hover:bg-accent/30 hover:border-border/60 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
            >
              <div className={`w-8 h-8 rounded-lg ${s.bgColor} ${s.iconColor} flex items-center justify-center shrink-0`}>
                <s.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  {s.label}
                </p>
                <p className="text-xs text-muted-foreground/70 line-clamp-2 mt-0.5">
                  {s.prompt}
                </p>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Connection status */}
        {!state.isConnected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 flex flex-col items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-5 py-3 rounded-2xl max-w-sm"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="font-medium">
                {state.settings.connectionMode === 'cloud'
                  ? 'Not connected. Add your API key in Settings.'
                  : 'Not connected to Ollama. Check Settings.'
                }
              </span>
            </div>
            {state.settings.connectionMode === 'cloud' && (
              <p className="text-xs text-amber-500/70 dark:text-amber-400/60 text-center">
                API keys are configured server-side in .env
              </p>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
