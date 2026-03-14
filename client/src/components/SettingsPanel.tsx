// ============================================================
// SettingsPanel — Provider + model selection, generation config
// API keys are server-side only (.env) — none in UI
// ============================================================

import { useState, useEffect } from 'react';
import {
  X,
  Server,
  Monitor,
  Globe,
  Thermometer,
  MessageSquare,
  Brain,
  Zap,
  RefreshCw,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sun,
  Moon,
  Palette,
  ExternalLink,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useChat } from '@/contexts/ChatContext';
import { useTheme } from '@/contexts/ThemeContext';
import { motion } from 'framer-motion';
import type { ConnectionMode } from '@/lib/types';

const OLLAMA_MODES: { value: ConnectionMode; label: string; icon: typeof Monitor; description: string }[] = [
  {
    value: 'local',
    label: 'Local',
    icon: Monitor,
    description: 'Ollama running on this machine',
  },
  {
    value: 'remote',
    label: 'Remote',
    icon: Globe,
    description: 'Ollama on another server',
  },
];

export default function SettingsPanel() {
  const { state, dispatch, refreshModels, refreshProviders, checkConnection } = useChat();
  const { theme, toggleTheme } = useTheme();
  const { settings, models, providers, isConnected } = state;
  const [testingConnection, setTestingConnection] = useState(false);

  const updateSetting = (key: string, value: unknown) => {
    dispatch({ type: 'SET_SETTINGS', payload: { [key]: value } });
  };

  const isOllama = !settings.provider || settings.provider === 'ollama';
  const isManus = settings.provider === 'manus';

  const handleProviderChange = (id: string) => {
    updateSetting('provider', id);
    // Reset model to first available model for that provider
    const p = providers.find(p => p.id === id);
    if (p && id !== 'ollama' && p.models.length > 0) {
      updateSetting('defaultModel', p.models[0]);
    } else if (id === 'ollama') {
      updateSetting('defaultModel', 'glm-5');
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    await checkConnection();
    await refreshModels();
    setTestingConnection(false);
  };

  // Refresh when Ollama URL/mode changes
  useEffect(() => {
    if (!isOllama) return;
    const timer = setTimeout(() => {
      checkConnection();
      refreshModels();
    }, 1200);
    return () => clearTimeout(timer);
  }, [settings.ollamaUrl, settings.connectionMode, isOllama]);

  // Get model list for current provider
  const currentProvider = providers.find(p => p.id === settings.provider);
  const providerModels = isOllama ? models.map(m => m.name) : (currentProvider?.models || []);

  // Default open items
  const defaultOpen = ['provider', 'connection', 'model'];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="h-full flex flex-col bg-card border-l border-border overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-semibold text-base">Settings</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => dispatch({ type: 'SET_SETTINGS_OPEN', payload: false })}
          className="h-8 w-8 p-0 rounded-full"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4">
          <Accordion type="multiple" defaultValue={defaultOpen}>

            {/* Provider Selection */}
            <AccordionItem value="provider">
              <AccordionTrigger className="border-l-2 border-l-primary pl-3 no-underline hover:no-underline">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">Provider</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={e => { e.stopPropagation(); refreshProviders(); }}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground ml-auto mr-2"
                >
                  <RefreshCw className="w-3 h-3" />
                </Button>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pt-2 pb-2">
                  {providers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Loading providers…</p>
                  ) : (
                    <div className="space-y-2">
                      {providers.map(p => (
                        <button
                          key={p.id}
                          onClick={() => handleProviderChange(p.id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                            settings.provider === p.id
                              ? 'border-primary border-l-[3px] border-l-primary bg-primary/5 dark:bg-primary/10'
                              : 'border-border hover:border-primary/30 hover:bg-accent/30'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                            settings.provider === p.id
                              ? 'bg-primary/10 text-primary'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {p.name.slice(0, 2)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold ${
                              settings.provider === p.id ? 'text-primary' : 'text-foreground'
                            }`}>
                              {p.name}
                            </p>
                            {p.id !== 'ollama' && p.models.length > 0 && (
                              <p className="text-xs text-muted-foreground/60 truncate">
                                {p.models.length} model{p.models.length !== 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                          {settings.provider === p.id && (
                            <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Ollama Connection / Manus Banner */}
            {(isOllama || isManus) && (
              <AccordionItem value="connection">
                <AccordionTrigger className="border-l-2 border-l-primary pl-3 no-underline hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-sm">
                      {isManus ? 'Task Mode' : 'Connection'}
                    </span>
                    {isOllama && (
                      isConnected ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Connected
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-full">
                          <XCircle className="w-3 h-3" /> Disconnected
                        </span>
                      )
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {isOllama && (
                    <div className="pt-2 pb-2 space-y-3">
                      <div className="space-y-2">
                        {OLLAMA_MODES.map(mode => (
                          <button
                            key={mode.value}
                            onClick={() => {
                              const updates: Record<string, unknown> = { connectionMode: mode.value };
                              if (mode.value === 'local') updates.ollamaUrl = 'http://localhost:11434';
                              dispatch({ type: 'SET_SETTINGS', payload: updates });
                            }}
                            className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-left ${
                              settings.connectionMode === mode.value
                                ? 'border-primary bg-primary/5 dark:bg-primary/10'
                                : 'border-border hover:border-primary/30 hover:bg-accent/30'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              settings.connectionMode === mode.value
                                ? 'bg-primary/10 text-primary'
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              <mode.icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className={`text-sm font-semibold ${
                                settings.connectionMode === mode.value ? 'text-primary' : 'text-foreground'
                              }`}>
                                {mode.label}
                              </p>
                              <p className="text-xs text-muted-foreground/70">{mode.description}</p>
                            </div>
                            {settings.connectionMode === mode.value && (
                              <div className="ml-auto shrink-0 mt-1">
                                <div className="w-2 h-2 rounded-full bg-primary" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>

                      {settings.connectionMode === 'remote' && (
                        <div>
                          <Label className="text-sm text-muted-foreground mb-1.5 block">
                            Server Address
                          </Label>
                          <Input
                            value={settings.ollamaUrl}
                            onChange={e => updateSetting('ollamaUrl', e.target.value)}
                            placeholder="http://your-server:11434"
                            className="text-sm"
                          />
                        </div>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTestConnection}
                        disabled={testingConnection}
                        className="w-full gap-2"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
                        {testingConnection ? 'Testing…' : 'Test Connection'}
                      </Button>

                      <div className="bg-muted/50 rounded-lg px-3 py-2">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">URL:</span>{' '}
                          <span className="font-mono text-foreground/70">{settings.ollamaUrl}</span>
                        </p>
                      </div>
                    </div>
                  )}

                  {isManus && (
                    <div className="pt-2 pb-2">
                      <div className="rounded-lg border border-violet-200 dark:border-violet-800/50 bg-violet-50/40 dark:bg-violet-950/20 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                            <span className="text-white text-[10px] font-bold">M</span>
                          </div>
                          <p className="text-sm font-semibold text-violet-700 dark:text-violet-300">Manus Task Mode</p>
                        </div>
                        <p className="text-xs text-violet-600/70 dark:text-violet-400/70 leading-relaxed">
                          Manus is an async task agent, not a chat API. Submit a project description and it will research, plan, and execute — returning structured results.
                        </p>
                        <p className="text-xs text-violet-600/50 dark:text-violet-400/50 mt-2">
                          Generation settings (temperature, tokens, tools, streaming) do not apply to Manus tasks.
                        </p>
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Model Selection */}
            <AccordionItem value="model">
              <AccordionTrigger className="border-l-2 border-l-primary pl-3 no-underline hover:no-underline">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">Model</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pt-2 pb-2 space-y-3">
                  {providerModels.length > 0 ? (
                    <Select
                      value={settings.defaultModel}
                      onValueChange={v => updateSetting('defaultModel', v)}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        {providerModels.map(name => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={settings.defaultModel}
                      onChange={e => updateSetting('defaultModel', e.target.value)}
                      placeholder={isOllama ? 'e.g. glm-5, llama3.2' : 'Model name'}
                      className="text-sm"
                    />
                  )}
                  <p className="text-xs text-muted-foreground/60">
                    {isOllama
                      ? isConnected
                        ? providerModels.length > 0
                          ? 'Select from your installed Ollama models'
                          : 'No models found — type a model name'
                        : 'Connect to Ollama to see your models'
                      : `${currentProvider?.name || 'Provider'} models`
                    }
                  </p>
                  {isOllama && providerModels.length > 0 && (
                    <Input
                      value={settings.defaultModel}
                      onChange={e => updateSetting('defaultModel', e.target.value)}
                      placeholder="Or type a model name…"
                      className="text-sm"
                    />
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Appearance + Generation + Features — hidden for Manus */}
            {!isManus && (
              <AccordionItem value="generation">
                <AccordionTrigger className="border-l-2 border-l-primary pl-3 no-underline hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Thermometer className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-sm">Generation</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-2 pb-2 space-y-6">
                    {/* Appearance */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Palette className="w-4 h-4 text-primary" />
                        <h3 className="font-semibold text-sm">Appearance</h3>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <Label className="text-sm font-medium">Dark Mode</Label>
                          <p className="text-xs text-muted-foreground/60">
                            Easier on the eyes in low light
                          </p>
                        </div>
                        <button
                          onClick={toggleTheme}
                          className="relative w-14 h-8 rounded-full bg-muted border border-border transition-colors hover:bg-accent"
                        >
                          <div
                            className={`absolute top-1 w-6 h-6 rounded-full bg-card shadow-sm border border-border flex items-center justify-center transition-all duration-300 ${
                              theme === 'dark' ? 'left-7' : 'left-1'
                            }`}
                          >
                            {theme === 'dark' ? (
                              <Moon className="w-3.5 h-3.5 text-blue-400" />
                            ) : (
                              <Sun className="w-3.5 h-3.5 text-amber-500" />
                            )}
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Generation sliders */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Thermometer className="w-4 h-4 text-primary" />
                        <h3 className="font-semibold text-sm">Parameters</h3>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <Label className="text-sm text-muted-foreground">Creativity</Label>
                              <Tooltip>
                                <TooltipTrigger>
                                  <HelpCircle className="w-3 h-3 text-muted-foreground/40" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs max-w-48">
                                    Higher values make responses more creative and varied.
                                    Lower values make them more focused and predictable.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                              {settings.temperature.toFixed(1)}
                            </span>
                          </div>
                          <Slider
                            value={[settings.temperature]}
                            onValueChange={([v]) => updateSetting('temperature', v)}
                            min={0}
                            max={2}
                            step={0.1}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground/40 mt-1">
                            <span>Precise</span>
                            <span>Creative</span>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <Label className="text-sm text-muted-foreground">Response Length</Label>
                              <Tooltip>
                                <TooltipTrigger>
                                  <HelpCircle className="w-3 h-3 text-muted-foreground/40" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs max-w-48">
                                    Maximum tokens the model can generate in one response.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                              {settings.maxTokens}
                            </span>
                          </div>
                          <Slider
                            value={[settings.maxTokens]}
                            onValueChange={([v]) => updateSetting('maxTokens', v)}
                            min={256}
                            max={16384}
                            step={256}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground/40 mt-1">
                            <span>Short</span>
                            <span>Long</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Features */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Zap className="w-4 h-4 text-primary" />
                        <h3 className="font-semibold text-sm">Features</h3>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <Label className="text-sm font-medium">Stream Responses</Label>
                            <p className="text-xs text-muted-foreground/60">
                              See words appear as they're generated
                            </p>
                          </div>
                          <Switch
                            checked={settings.streamResponses}
                            onCheckedChange={v => updateSetting('streamResponses', v)}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <Label className="text-sm font-medium">Tool Use</Label>
                            <p className="text-xs text-muted-foreground/60">
                              Let the model use tools (weather, search, finance, etc.)
                            </p>
                          </div>
                          <Switch
                            checked={settings.enableTools}
                            onCheckedChange={v => updateSetting('enableTools', v)}
                          />
                        </div>

                        {isOllama && (
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <Label className="text-sm font-medium">Show Thinking</Label>
                              <p className="text-xs text-muted-foreground/60">
                                See the model's reasoning (if supported)
                              </p>
                            </div>
                            <Switch
                              checked={settings.enableThinking}
                              onCheckedChange={v => updateSetting('enableThinking', v)}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* System Prompt + Tool Categories — hidden for Manus */}
            {!isManus && (
              <AccordionItem value="advanced">
                <AccordionTrigger className="border-l-2 border-l-primary pl-3 no-underline hover:no-underline">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-sm">Advanced</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-2 pb-2 space-y-6">
                    {/* System Prompt */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <MessageSquare className="w-4 h-4 text-primary" />
                        <h3 className="font-semibold text-sm">System Instructions</h3>
                      </div>
                      <div>
                        <Textarea
                          value={settings.systemPrompt}
                          onChange={e => updateSetting('systemPrompt', e.target.value)}
                          placeholder="Give the model special instructions, like 'You are a helpful cooking assistant' or 'Always respond in simple language'…"
                          className="text-sm min-h-24 resize-none"
                          rows={4}
                        />
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          Optional instructions that shape how the model responds
                        </p>
                      </div>
                    </div>

                    {/* Tool Categories */}
                    {settings.enableTools && state.toolRegistry && Object.keys(state.toolRegistry.categories).length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Wrench className="w-4 h-4 text-primary" />
                          <h3 className="font-semibold text-sm">Available Tools</h3>
                          <span className="ml-auto text-xs text-muted-foreground/60">
                            {state.toolRegistry.count} tools
                          </span>
                        </div>
                        <div className="space-y-2">
                          {Object.entries(state.toolRegistry.categories).map(([moduleId, cat]) => {
                            const isEnabled = settings.enabledToolModules.length === 0 || settings.enabledToolModules.includes(moduleId);
                            return (
                              <div
                                key={moduleId}
                                className="flex items-center justify-between py-1.5"
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className="text-base">{cat.icon}</span>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{cat.name}</p>
                                    <p className="text-xs text-muted-foreground/60 truncate">
                                      {cat.tools.length} tool{cat.tools.length !== 1 ? 's' : ''}
                                    </p>
                                  </div>
                                </div>
                                <Switch
                                  checked={isEnabled}
                                  onCheckedChange={(checked) => {
                                    let modules = [...settings.enabledToolModules];
                                    if (checked) {
                                      if (modules.length > 0) {
                                        modules.push(moduleId);
                                      }
                                    } else {
                                      if (modules.length === 0) {
                                        modules = Object.keys(state.toolRegistry!.categories).filter(m => m !== moduleId);
                                      } else {
                                        modules = modules.filter(m => m !== moduleId);
                                      }
                                    }
                                    updateSetting('enabledToolModules', modules);
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

          </Accordion>

          {/* Links — always visible outside accordion */}
          <div className="mt-4 space-y-2">
            <a
              href="https://lukesteuber.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              <span>lukesteuber.com</span>
              <ExternalLink className="w-3 h-3 ml-auto" />
            </a>
            <a
              href="https://dr.eamer.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              <span>dr.eamer.dev</span>
              <ExternalLink className="w-3 h-3 ml-auto" />
            </a>
          </div>
        </div>
      </ScrollArea>
    </motion.div>
  );
}
