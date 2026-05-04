import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Mic, MicOff, Volume2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VoiceAssistantProps {
  onCommand: (command: string) => void;
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  isProcessing?: boolean;
}

export default function VoiceAssistant({ onCommand, isEnabled, onToggle, isProcessing }: VoiceAssistantProps) {
  const [isListening, setIsListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const [errorHeader, setErrorHeader] = useState<string | null>(null);
  const [hasMicPermission, setHasMicPermission] = useState(true);
  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<any>(null);

  const startRecognition = useCallback(async (forceIsEnabled = false) => {
    const active = forceIsEnabled || isEnabled;
    console.log("Attempting to start recognition... isEnabled:", isEnabled, "force:", forceIsEnabled, "isProcessing:", isProcessing, "hasPermission:", hasMicPermission);
    
    if (!hasMicPermission && !forceIsEnabled) {
      console.warn("Permission denied state - not starting automatically");
      return;
    }

    if (!active || isProcessing) {
      console.log("Start cancelled: active:", active, "isProcessing:", isProcessing);
      return;
    }
    
    // Check if speaking. If so, delay start instead of failing.
    if (window.speechSynthesis.speaking) {
      console.log("Voice Engine: Waiting for TTS to finish before listening...");
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = setTimeout(() => startRecognition(forceIsEnabled), 1000);
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("SpeechRecognition not found in window");
      setErrorHeader("Browser not supported");
      return;
    }

    // Stop existing if any
    if (recognitionRef.current) {
      try { 
        recognitionRef.current.onend = null; // Prevent restart loops
        recognitionRef.current.stop(); 
      } catch (e) {
        console.warn("Error stopping recognition:", e);
      }
      recognitionRef.current = null;
    }

    try {
      // Pre-emptively request mic access to trigger browser prompt reliably
      if (forceIsEnabled && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        console.log("Voice Engine: Requesting MediaStream permission...");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Close the stream immediately as we only needed it for permission
        stream.getTracks().forEach(track => track.stop());
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false; 
      recognition.interimResults = true; 
      recognition.lang = 'hi-IN';

      recognition.onstart = () => {
        setIsListening(true);
        setErrorHeader(null);
        console.log("Voice Engine: Listening started");
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const currentText = (finalTranscript || interimTranscript).trim().toLowerCase();
        setLastTranscript(currentText);

        if (finalTranscript) {
          console.log("Voice Engine: Final Command:", finalTranscript);
          onCommand(finalTranscript.trim().toLowerCase());
          recognition.stop();
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Voice Engine Error:", event.error);
        
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setHasMicPermission(false);
          setErrorHeader("Mic Access Blocked!");
          setIsListening(false);
          onToggle(false);
          const isIframe = window.self !== window.top;
          const msg = isIframe 
            ? "Microphone Access Blocked! Bhai, ye app iframe mein hai, browser permissions allow karein ya 'New Tab' mein kholein."
            : "Microphone Access Blocked! Please check browser settings and allow mic access.";
          alert(msg);
        } else if (event.error === 'network') {
          setErrorHeader("Net error");
        } else if (event.error === 'no-speech') {
          console.log("No speech detected this cycle");
        } else {
          console.warn("Recognition error:", event.error);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
        
        // Restart logic if still enabled and no permission error
        const checkAndRestart = () => {
          if (!isEnabled || !hasMicPermission) return;
          
          const isSpeaking = window.speechSynthesis.speaking;
          if (!isProcessing && !isSpeaking && isEnabled) {
            startRecognition();
          } else {
            if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
            restartTimeoutRef.current = setTimeout(checkAndRestart, 1000);
          }
        };

        if (isEnabled && hasMicPermission) {
          if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
          restartTimeoutRef.current = setTimeout(checkAndRestart, 800);
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (e: any) {
      console.error("Voice Engine Start Exception:", e);
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setHasMicPermission(false);
        setErrorHeader("Mic Access Blocked!");
        setIsListening(false);
        onToggle(false);
        alert("Microphone Access Blocked! Please allow mic access in your browser settings.");
      } else {
        setErrorHeader("Mic init failed");
      }
    }
  }, [isEnabled, onCommand, onToggle, isProcessing, hasMicPermission]);

  useEffect(() => {
    if (isEnabled) {
      setHasMicPermission(true); // Reset on toggle on
      startRecognition(true);
    } else {
      setIsListening(false);
      setErrorHeader(null);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
    };
  }, [isEnabled, startRecognition]);

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-3 pointer-events-none">
      <AnimatePresence>
        {errorHeader && isEnabled && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="bg-red-500 text-white text-[11px] px-4 py-2 rounded-xl shadow-xl font-bold uppercase tracking-wider mb-2 pointer-events-auto flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4" />
            {errorHeader}: Check Mic Permissions
          </motion.div>
        )}

        {isEnabled && isListening && lastTranscript && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md shadow-2xl border border-blue-100 dark:border-slate-700 rounded-2xl px-5 py-3 text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2 max-w-[280px] text-right pointer-events-auto ring-1 ring-black/5"
          >
            <div className="flex items-center justify-end gap-2 mb-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest">Aap ne bola:</span>
              <Volume2 className="w-3 h-3 text-slate-400" />
            </div>
            "{lastTranscript}"
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-auto">
        <button
          onClick={() => {
            if (isEnabled) {
              onToggle(false);
            } else {
              // Direct state update and start call for better mobile/Safari support
              onToggle(true);
              setHasMicPermission(true);
              // Small delay to let the state propagate or handle directly
              console.log("Direct start attempt on click");
              startRecognition(true);
            }
          }}
          className={`group w-16 h-16 rounded-full flex items-center justify-center shadow-[0_10px_40px_-10px_rgba(37,99,235,0.5)] transition-all active:scale-95 relative ${
            isEnabled 
              ? 'bg-blue-600 text-white' 
              : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
          } ${isProcessing ? 'animate-pulse' : ''}`}
          title={isEnabled ? "Voice Assistant Band Karein" : "Voice Assistant Chalu Karein"}
        >
          {isEnabled ? (
            <div className="relative flex items-center justify-center">
              <Mic className="w-7 h-7 relative z-10" />
              
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1.5],
                  opacity: [0.5, 0.3, 0]
                }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                className="absolute inset-0 bg-white rounded-full"
              />
              <motion.div
                animate={{ 
                  scale: [1, 1.1, 1.3],
                  opacity: [0.3, 0.1, 0]
                }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
                className="absolute inset-0 bg-white rounded-full"
              />
            </div>
          ) : (
            <MicOff className="w-7 h-7" />
          )}
          
          <AnimatePresence>
            {isEnabled && (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 border-4 border-white dark:border-slate-900 rounded-full shadow-sm" 
              />
            )}
          </AnimatePresence>
        </button>

        {isEnabled && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-center"
          >
            <div className="text-[10px] font-black uppercase tracking-[0.2em] bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent drop-shadow-sm">
              {isProcessing ? "Bhai soch raha hai..." : isListening ? "Bolte rahiye..." : "Partner Active (Starting...)"}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
