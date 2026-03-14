// ============================================================
// AudioPanel — TTS + STT with browser Speech API and provider fallback
// Shows provider-capable models for TTS/STT when available
// ============================================================

import { useState, useRef, useMemo, useCallback } from 'react';
import { Mic, Square, Volume2, VolumeX, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useChat } from '@/contexts/ChatContext';
import { useTheme } from '@/contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function AudioPanel() {
  const { themeName } = useTheme();
  const { state } = useChat();

  // STT state
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // TTS state
  const [ttsText, setTtsText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const synthRef = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null);

  // Provider filtering
  const ttsProviders = useMemo(
    () => state.providers.filter(p => p.capabilities?.includes('tts') && p.ttsModels?.length),
    [state.providers],
  );
  const sttProviders = useMemo(
    () => state.providers.filter(p => p.capabilities?.includes('stt') && p.sttModels?.length),
    [state.providers],
  );

  const hasBrowserSTT = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  const hasBrowserTTS = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // STT — browser Speech API
  const startRecording = useCallback(() => {
    if (!hasBrowserSTT) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      setTranscript(finalTranscript + interimTranscript);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
    setTranscript('');
  }, [hasBrowserSTT]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsRecording(false);
  }, []);

  // TTS — browser Speech API
  const speakText = useCallback(() => {
    if (!hasBrowserTTS || !ttsText.trim()) return;
    synthRef.current?.cancel();
    const utterance = new SpeechSynthesisUtterance(ttsText.trim());
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    synthRef.current?.speak(utterance);
  }, [hasBrowserTTS, ttsText]);

  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel();
    setIsSpeaking(false);
  }, []);

  const recordingColor = themeName === 'nebula' ? 'text-indigo-400' :
    themeName === 'slate' ? 'text-teal-400' : 'text-amber-500';

  const waveColor = themeName === 'nebula' ? 'bg-indigo-500/40' :
    themeName === 'slate' ? 'bg-teal-500/40' : 'bg-amber-600/40';

  const waveActiveColor = themeName === 'nebula' ? 'bg-indigo-500' :
    themeName === 'slate' ? 'bg-teal-500' : 'bg-amber-500';

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-8 overflow-y-auto chat-scroll">
      {/* STT Section */}
      <div className="text-center max-w-md w-full">
        <div className="flex items-center justify-center gap-3 mb-4">
          <p className="eyebrow">SPEECH TO TEXT</p>
          {hasBrowserSTT && (
            <span className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
              Browser API
            </span>
          )}
          {sttProviders.length > 0 && (
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              +{sttProviders.map(p => p.name).join(', ')}
            </span>
          )}
        </div>

        {!hasBrowserSTT && sttProviders.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No speech recognition available. Use Chrome/Edge for browser STT, or configure an OpenAI API key for Whisper.
          </p>
        ) : (
          <>
            {/* Recording button */}
            <div className="relative w-24 h-24 mx-auto mb-4">
              <AnimatePresence>
                {isRecording && (
                  <>
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1.5, opacity: 0 }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="absolute inset-0 rounded-full border-2 border-primary/30"
                    />
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1.3, opacity: 0 }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                      className="absolute inset-0 rounded-full border-2 border-primary/20"
                    />
                  </>
                )}
              </AnimatePresence>
              <Button
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-24 h-24 p-0 rounded-full ${
                  isRecording
                    ? 'bg-destructive hover:bg-destructive/90'
                    : 'bg-card border-2 border-border hover:bg-accent'
                }`}
                variant={isRecording ? 'destructive' : 'outline'}
              >
                {isRecording ? (
                  <Square className="w-8 h-8" />
                ) : (
                  <Mic className={`w-8 h-8 ${recordingColor}`} />
                )}
              </Button>
            </div>

            {isRecording && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`text-sm font-semibold ${recordingColor} mb-2`}
              >
                Listening...
              </motion.p>
            )}

            {transcript && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 p-4 bg-card border border-border text-left rounded-xl"
              >
                <p className="eyebrow mb-1">TRANSCRIPT</p>
                <p className="text-sm">{transcript}</p>
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Divider */}
      <div className="w-full max-w-md border-t border-border" />

      {/* TTS Section */}
      <div className="text-center max-w-md w-full">
        <div className="flex items-center justify-center gap-3 mb-4">
          <p className="eyebrow">TEXT TO SPEECH</p>
          {hasBrowserTTS && (
            <span className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
              Browser API
            </span>
          )}
          {ttsProviders.length > 0 && (
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              +{ttsProviders.map(p => p.name).join(', ')}
            </span>
          )}
        </div>

        {/* Waveform visualization */}
        <div className="h-16 flex items-center justify-center gap-0.5 mb-4 px-4">
          {Array.from({ length: 32 }).map((_, i) => (
            <motion.div
              key={i}
              className={`w-1 rounded-full ${isSpeaking ? waveActiveColor : waveColor}`}
              animate={{
                height: isSpeaking ? [4, 4 + Math.random() * 40, 4] : 4,
              }}
              transition={{
                duration: 0.3 + Math.random() * 0.2,
                repeat: isSpeaking ? Infinity : 0,
                delay: i * 0.02,
              }}
              style={{ height: 4 }}
            />
          ))}
        </div>

        {/* TTS input */}
        <div className="flex items-end gap-2">
          <textarea
            value={ttsText}
            onChange={e => setTtsText(e.target.value)}
            placeholder="Type text to speak..."
            rows={2}
            className="flex-1 resize-none border border-border bg-card px-4 py-3 text-[15px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all rounded-xl"
          />
          <Button
            size="sm"
            disabled={!ttsText.trim() && !isSpeaking}
            onClick={isSpeaking ? stopSpeaking : speakText}
            className={`h-10 w-10 shrink-0 p-0 rounded-full ${isSpeaking ? 'bg-destructive hover:bg-destructive/90' : ''}`}
            variant={isSpeaking ? 'destructive' : 'default'}
          >
            {isSpeaking ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </Button>
        </div>

        {!hasBrowserTTS && ttsProviders.length === 0 && (
          <p className="text-xs text-muted-foreground/50 mt-2">
            No TTS available. Use a modern browser or configure an OpenAI API key.
          </p>
        )}
      </div>
    </div>
  );
}
