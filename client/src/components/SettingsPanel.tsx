// ============================================================
// SettingsPanel — User-friendly configuration
// Design: Warm Companion — plain language, clear controls
// ============================================================

import { useState, useEffect } from 'react';
import {
  X,
  Server,
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
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useChat } from '@/contexts/ChatContext';
import { useTheme } from '@/contexts/ThemeContext';
import { motion } from 'framer-motion';

export default function SettingsPanel() {
  const { state, dispatch, refreshModels, checkConnection } = useChat();
  const { theme, toggleTheme } = useTheme();
  const { settings, models, isConnected } = state;
  const [testingConnection, setTestingConnection] = useState(false);

  const updateSetting = (key: string, value: unknown) => {
    dispatch({ type: 'SET_SETTINGS', payload: { [key]: value } });
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    await checkConnection();
    await refreshModels();
    setTestingConnection(false);
  };

  // Refresh models when URL changes
  useEffect(() => {
    const timer = setTimeout(() => {
      checkConnection();
      refreshModels();
    }, 1000);
    return () => clearTimeout(timer);
  }, [settings.ollamaUrl]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="h-full flex flex-col bg-card border-l border-border"
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

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Connection */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Server className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Connection</h3>
              {isConnected ? (
                <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-full">
                  <XCircle className="w-3 h-3" /> Disconnected
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-sm text-muted-foreground mb-1.5 block">
                  Ollama Server Address
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={settings.ollamaUrl}
                    onChange={e => updateSetting('ollamaUrl', e.target.value)}
                    placeholder="http://localhost:11434"
                    className="text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestConnection}
                    disabled={testingConnection}
                    className="shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  The URL where your Ollama server is running
                </p>
              </div>
            </div>
          </section>

          <Separator />

          {/* Model Selection */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Model</h3>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-sm text-muted-foreground mb-1.5 block">
                  Choose a Model
                </Label>
                {models.length > 0 ? (
                  <Select
                    value={settings.defaultModel}
                    onValueChange={v => updateSetting('defaultModel', v)}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map(m => (
                        <SelectItem key={m.name} value={m.name}>
                          <div className="flex items-center gap-2">
                            <span>{m.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({m.details?.parameter_size || 'unknown'})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={settings.defaultModel}
                    onChange={e => updateSetting('defaultModel', e.target.value)}
                    placeholder="glm-5"
                    className="text-sm"
                  />
                )}
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Type a model name or select from your installed models
                </p>
              </div>
            </div>
          </section>

          <Separator />

          {/* Appearance */}
          <section>
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
          </section>

          <Separator />

          {/* Generation Settings */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Thermometer className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Generation</h3>
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
                          Maximum number of words/tokens the AI can generate in one response.
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
          </section>

          <Separator />

          {/* Features */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Features</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label className="text-sm font-medium">Stream Responses</Label>
                  <p className="text-xs text-muted-foreground/60">
                    See words appear as the AI types them
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
                    Let the AI use tools like calculators and search
                  </p>
                </div>
                <Switch
                  checked={settings.enableTools}
                  onCheckedChange={v => updateSetting('enableTools', v)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label className="text-sm font-medium">Show Thinking</Label>
                  <p className="text-xs text-muted-foreground/60">
                    See the AI's reasoning process (if supported)
                  </p>
                </div>
                <Switch
                  checked={settings.enableThinking}
                  onCheckedChange={v => updateSetting('enableThinking', v)}
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* System Prompt */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">System Instructions</h3>
            </div>

            <div>
              <Textarea
                value={settings.systemPrompt}
                onChange={e => updateSetting('systemPrompt', e.target.value)}
                placeholder="Give the AI special instructions, like 'You are a helpful cooking assistant' or 'Always respond in simple language'..."
                className="text-sm min-h-24 resize-none"
                rows={4}
              />
              <p className="text-xs text-muted-foreground/60 mt-1">
                Optional instructions that shape how the AI responds
              </p>
            </div>
          </section>

          <Separator />

          {/* Help links */}
          <section>
            <div className="space-y-2">
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
          </section>
        </div>
      </ScrollArea>
    </motion.div>
  );
}
