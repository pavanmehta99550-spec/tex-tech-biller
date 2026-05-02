import React, { useEffect, useState, useCallback } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VoiceAssistantProps {
  onCommand: (command: string) => void;
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export default function VoiceAssistant({ onCommand, isEnabled, onToggle }: VoiceAssistantProps) {
  const [isListening, setIsListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const [errorHeader, setErrorHeader] = useState<string | null>(null);

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'hi-IN';
    window.speechSynthesis.speak(utterance);
  }, []);

  useEffect(() => {
    if (!isEnabled) {
      setIsListening(false);
      setErrorHeader(null);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorHeader("Browser not supported");
      return;
    }

    let recognition: any;
    try {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'hi-IN';

      recognition.onstart = () => {
        setIsListening(true);
        setErrorHeader(null);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
        setLastTranscript(transcript);
        onCommand(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === 'not-allowed') {
          setErrorHeader("Mic Access Denied");
          onToggle(false);
        } else if (event.error === 'network') {
          setErrorHeader("Network Error");
        }
      };

      recognition.onend = () => {
        if (isEnabled && !errorHeader) {
          try { recognition.start(); } catch(e) {}
        } else {
          setIsListening(false);
        }
      };

      recognition.start();
    } catch (e) {
      setErrorHeader("Initialization Failed");
    }

    return () => {
      if (recognition) recognition.stop();
    };
  }, [isEnabled, onCommand, onToggle, errorHeader]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {errorHeader && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="bg-red-500 text-white text-[10px] px-3 py-1.5 rounded-lg shadow-lg font-bold uppercase tracking-wider mb-2"
          >
            {errorHeader}: Please allow mic in browser
          </motion.div>
        )}

        {isEnabled && isListening && lastTranscript && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white dark:bg-slate-800 shadow-xl border border-blue-100 dark:border-slate-700 rounded-2xl px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 mb-2 max-w-xs text-right"
          >
            "{lastTranscript}"
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => onToggle(!isEnabled)}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-90 ${
          isEnabled 
            ? 'bg-blue-600 text-white ring-4 ring-blue-500/20' 
            : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
        }`}
        title={isEnabled ? "Disable Voice Assistant" : "Enable Voice Assistant"}
      >
        {isEnabled ? (
          <div className="relative">
            <Mic className="w-6 h-6" />
            <motion.div
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -inset-2 bg-white/30 rounded-full -z-10"
            />
          </div>
        ) : (
          <MicOff className="w-6 h-6" />
        )}
        
        {isEnabled && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-slate-800 rounded-full" />
        )}
      </button>

      {isEnabled && (
        <div className="bg-black/50 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-full uppercase tracking-widest font-black">
          {isListening ? "Listening..." : "Idle"}
        </div>
      )}
    </div>
  );
}
