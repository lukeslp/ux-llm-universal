// ============================================================
// AudioPanel — TTS waveform + STT recording
// Theme-aware. Uses browser Web Speech API as primary.
// ============================================================

import { useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function AudioPanel() {
  const { themeName } = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      setTranscript('');
    }
  };

  const recordingColor = themeName === 'hearthstone' ? 'text-amber-500' :
    themeName === 'zurich' ? 'text-[oklch(0.55_0.22_29)]' : 'text-indigo-400';

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-6">
      {/* STT Section */}
      <div className="text-center max-w-md">
        <p className="eyebrow mb-4">SPEECH TO TEXT</p>

        {/* Recording indicator */}
        <div className="relative w-24 h-24 mx-auto mb-6">
          <AnimatePresence>
            {isRecording && (
              <>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1.5, opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className={`absolute inset-0 rounded-full border-2 ${
                    themeName === 'hearthstone' ? 'border-amber-500/30' :
                    themeName === 'zurich' ? 'border-[oklch(0.55_0.22_29)]/30 rounded-none' :
                    'border-indigo-500/30'
                  }`}
                />
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1.3, opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                  className={`absolute inset-0 rounded-full border-2 ${
                    themeName === 'hearthstone' ? 'border-amber-500/20' :
                    themeName === 'zurich' ? 'border-[oklch(0.55_0.22_29)]/20 rounded-none' :
                    'border-indigo-500/20'
                  }`}
                />
              </>
            )}
          </AnimatePresence>
          <Button
            onClick={toggleRecording}
            className={`w-24 h-24 p-0 ${
              themeName === 'zurich' ? 'rounded-none' : 'rounded-full'
            } ${
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
            className={`text-sm font-semibold ${recordingColor}`}
          >
            {themeName === 'zurich' ? 'RECORDING' : 'Listening...'}
          </motion.p>
        )}

        {transcript && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-4 p-4 bg-card border border-border ${
              themeName === 'zurich' ? 'rounded-none border-2' : 'rounded-xl'
            }`}
          >
            <p className="text-sm font-mono">{transcript}</p>
          </motion.div>
        )}

        <p className="text-xs text-muted-foreground/50 mt-4">
          Coming soon: Web Speech API + server fallback
        </p>
      </div>

      {/* TTS Section */}
      <div className="text-center max-w-md mt-8">
        <p className="eyebrow mb-4">TEXT TO SPEECH</p>

        {/* TTS waveform placeholder */}
        <div className={`h-16 flex items-center justify-center gap-0.5 ${
          themeName === 'zurich' ? 'border-2 border-border px-4' : 'px-4'
        }`}>
          {Array.from({ length: 32 }).map((_, i) => (
            <motion.div
              key={i}
              className={`w-1 rounded-full ${
                themeName === 'hearthstone' ? 'bg-amber-600/40' :
                themeName === 'zurich' ? 'bg-foreground/30' :
                'bg-indigo-500/40'
              }`}
              animate={{
                height: isSpeaking ? [4, 4 + Math.random() * 40, 4] : 4,
              }}
              transition={{
                duration: 0.4,
                repeat: isSpeaking ? Infinity : 0,
                delay: i * 0.03,
              }}
              style={{ height: 4 }}
            />
          ))}
        </div>

        <p className="text-xs text-muted-foreground/50 mt-4">
          Coming soon: ElevenLabs / browser TTS
        </p>
      </div>
    </div>
  );
}
