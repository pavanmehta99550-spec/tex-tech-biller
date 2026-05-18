import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Environment } from '@react-three/drei';
import { Mic, MicOff, Settings2, X } from 'lucide-react';
import * as THREE from 'three';

function FemaleAvatar({ isSpeaking, avatarScale }: { isSpeaking: boolean, avatarScale: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const mouthRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.02;
    }
    
    if (mouthRef.current) {
      if (isSpeaking) {
        const mouthOpen = Math.random() * 0.15 + 0.05;
        mouthRef.current.scale.y = THREE.MathUtils.lerp(mouthRef.current.scale.y, mouthOpen, 0.5);
        if (headRef.current) {
          headRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 15) * 0.05;
        }
      } else {
        mouthRef.current.scale.y = THREE.MathUtils.lerp(mouthRef.current.scale.y, 0.02, 0.2);
        if (headRef.current) {
          headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, 0, 0.1);
        }
      }
    }
    
    if (groupRef.current) {
      // Prompt explicitly says: update Y-axis scale (model.scale.y)
      groupRef.current.scale.y = avatarScale;
    }
  });

  return (
    <group ref={groupRef} position={[0, -1.2, 0]}>
      {/* Body / Suit */}
      <group position={[0, 0.8, 0]}>
        {/* White Shirt inside */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.18, 0.45, 1, 32]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        
        {/* Grey/Blue Blazer jacket */}
        <mesh position={[0, 0.0, 0]}>
          <cylinderGeometry args={[0.2, 0.5, 1, 32, 1, false, 0, Math.PI * 1.5]} />
          <meshStandardMaterial color="#A9B5C0" side={THREE.DoubleSide} />
        </mesh>
      </group>
      
      {/* Head Group */}
      <group ref={headRef} position={[0, 1.5, 0]}>
        {/* Head */}
        <mesh>
          <sphereGeometry args={[0.3, 32, 32]} />
          <meshStandardMaterial color="#ffeadd" />
        </mesh>
        
        {/* Hair - Brown Wavy */}
        <mesh position={[0, 0.1, -0.05]}>
          <sphereGeometry args={[0.33, 32, 32, 0, Math.PI * 2, 0, Math.PI / 1.6]} />
          <meshStandardMaterial color="#a67c52" />
        </mesh>
        
        {/* Flowing hair on sides */}
        <mesh position={[-0.2, -0.2, -0.1]} rotation={[0, 0, 0.2]}>
          <capsuleGeometry args={[0.1, 0.5, 16, 16]} />
          <meshStandardMaterial color="#a67c52" />
        </mesh>
        <mesh position={[0.2, -0.2, -0.1]} rotation={[0, 0, -0.2]}>
          <capsuleGeometry args={[0.1, 0.5, 16, 16]} />
          <meshStandardMaterial color="#a67c52" />
        </mesh>
        
        {/* Eyes */}
        <mesh position={[-0.1, 0.05, 0.26]}>
          <sphereGeometry args={[0.03, 16, 16]} />
          <meshStandardMaterial color="#1a202c" />
        </mesh>
        <mesh position={[0.1, 0.05, 0.26]}>
          <sphereGeometry args={[0.03, 16, 16]} />
          <meshStandardMaterial color="#1a202c" />
        </mesh>
        
        {/* Mouth */}
        <mesh ref={mouthRef} position={[0, -0.1, 0.28]}>
          <boxGeometry args={[0.1, 1, 0.02]} />
          <meshStandardMaterial color="#e53e3e" />
        </mesh>
      </group>
      
      {/* Arms in Blazer */}
      <mesh position={[-0.35, 1, 0]} rotation={[0, 0, Math.PI / 8]}>
        <capsuleGeometry args={[0.08, 0.6, 16, 16]} />
        <meshStandardMaterial color="#A9B5C0" />
      </mesh>
      <mesh position={[0.35, 1, 0]} rotation={[0, 0, -Math.PI / 8]}>
        <capsuleGeometry args={[0.08, 0.6, 16, 16]} />
        <meshStandardMaterial color="#A9B5C0" />
      </mesh>
    </group>
  );
}

export function VoiceAssistant({ onAction }: { onAction: (result: any) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [statusText, setStatusText] = useState("Mai apki assistant hoon. Kahiye, main kya madad kar sakti hoon?");
  const [avatarScaleY, setAvatarScaleY] = useState(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      
      let selectedVoice = voices.find(v => v.lang.includes('hi') && v.name.toLowerCase().includes('female'));
      if (!selectedVoice) selectedVoice = voices.find(v => v.lang.includes('hi'));
      if (!selectedVoice) selectedVoice = voices.find(v => v.lang.includes('en-IN'));
      if (selectedVoice) utterance.voice = selectedVoice;
      
      utterance.pitch = 1.2;
      utterance.rate = 1.0;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    if (isOpen && statusText === "Mai apki assistant hoon. Kahiye, main kya madad kar sakti hoon?") {
      speak(statusText);
    }
  }, [isOpen]);

  const toggleListen = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatusText("Sorry, speech recognition is not supported in this browser.");
      speak("Speech recognition is not supported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'hi-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setStatusText("Sun rahi hoon...");
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setStatusText('Aapne kaha: ' + transcript);
      
      try {
        const res = await fetch('/api/voice-command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: transcript })
        });
        
        const data = await res.json();
        
        if (data.response) {
          setStatusText(data.response);
          speak(data.response);
        }

        if (data.action !== 'unknown') {
          onAction(data);
        }
      } catch (err) {
        console.error(err);
        setStatusText("Network error processing command.");
        speak("Maaf kijiye, mujhe network issue ke karan samajh mein nahi aaya.");
      }
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      setStatusText("Network/Mic Error. Please try again.");
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-pink-500 text-white p-4 rounded-full shadow-2xl hover:bg-pink-600 transition-all hover:scale-110 z-50 flex items-center justify-center cursor-pointer print:hidden"
        style={{ zIndex: 9999 }}
      >
        <Mic className="animate-pulse" size={32} />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-white/40 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
      <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl overflow-hidden shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col relative">
        
        {/* Header */}
        <div className="bg-pink-500/90 backdrop-blur-sm text-white p-4 flex justify-between items-center">
          <h2 className="font-black text-xl flex items-center gap-2">
            AI Voice Assistant
          </h2>
          <button onClick={() => {
            setIsOpen(false);
            window.speechSynthesis.cancel();
          }} className="hover:bg-pink-600 p-2 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* 3D Canvas Area */}
        <div className="flex-1 relative bg-gradient-to-b from-sky-50 to-pink-50">
          <Canvas camera={{ position: [0, 1.5, 4], fov: 45 }}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[2, 5, 2]} intensity={1.5} castShadow />
            <Environment preset="city" />
            <FemaleAvatar isSpeaking={isSpeaking} avatarScale={avatarScaleY} />
            <ContactShadows position={[0, -1.2, 0]} opacity={0.4} scale={5} blur={2} />
            <OrbitControls enableZoom={false} enablePan={false} maxPolarAngle={Math.PI / 2} minPolarAngle={Math.PI / 3} />
          </Canvas>

          {/* Scale Slider Overlay */}
          <div className="absolute top-4 right-4 bg-white/70 backdrop-blur-md p-4 rounded-2xl shadow-lg flex flex-col items-center border border-white">
            <Settings2 size={20} className="text-pink-500 mb-2" />
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Height</label>
            <input 
              type="range" 
              min="0.8" 
              max="1.5" 
              step="0.05" 
              value={avatarScaleY} 
              onChange={(e) => setAvatarScaleY(parseFloat(e.target.value))}
              className="h-[100px] accent-pink-500 cursor-pointer"
              style={{ writingMode: 'vertical-lr', direction: 'rtl' }} 
            />
          </div>
        </div>

        {/* Control Area */}
        <div className="p-8 bg-white/60 backdrop-blur-md border-t border-white flex flex-col items-center">
          <div className="min-h-[4rem] flex items-center justify-center w-full px-4 mb-4">
            <p className="text-xl font-bold text-slate-800 text-center leading-tight">
              {statusText}
            </p>
          </div>
          
          <button 
            onClick={toggleListen}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-xl cursor-pointer \${isListening ? 'bg-red-500 text-white animate-pulse shadow-red-200' : 'bg-pink-500 text-white hover:bg-pink-600 hover:scale-110 shadow-pink-200'}`}
          >
            {isListening ? <MicOff size={32} /> : <Mic size={32} />}
          </button>
          
          <p className="text-[10px] font-black text-slate-400 mt-4 uppercase tracking-widest">
            {isListening ? 'Tap to Stop Listening' : 'Tap to Speak Command'}
          </p>
        </div>
      </div>
    </div>
  );
}
