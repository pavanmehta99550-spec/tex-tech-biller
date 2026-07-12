import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function Calculator({ onClose }: { onClose: () => void }) {
  const [input, setInput] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      
      const isNumber = /[0-9]/.test(e.key);
      const isOperator = ['+', '-', '*', '/', '.'].includes(e.key);
      
      if (isNumber || isOperator) {
        e.preventDefault();
        handleButtonClick(e.key);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleButtonClick('=');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setInput(prev => prev.slice(0, -1));
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleButtonClick('C');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleButtonClick = (value: string) => {
    if (value === '=') {
      setInput(prev => {
        try {
          // eslint-disable-next-line no-new-func
          return new Function('return ' + prev)().toString();
        } catch {
          return 'Error';
        }
      });
    } else if (value === 'C') {
      setInput('');
    } else {
      setInput(prev => prev + value);
    }
  };

  const getButtonClass = (btn: string) => {
    const base = "p-4 rounded-2xl font-black text-lg transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-md";
    if (btn === 'C') return `${base} bg-rose-500 text-white hover:bg-rose-600`;
    if (['/', '*', '-', '+', '='].includes(btn)) return `${base} bg-indigo-500 text-white hover:bg-indigo-600`;
    return `${base} bg-white text-slate-800 hover:bg-slate-100`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gradient-to-br from-indigo-900 to-purple-900 p-8 rounded-3xl w-full max-w-sm shadow-2xl border border-white/10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-white tracking-widest uppercase">Calculator</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded-full hover:bg-white/20">
            <X size={24} />
          </button>
        </div>
        <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl mb-6 text-right text-4xl font-mono font-bold text-white shadow-inner border border-white/5">
          {input || '0'}
        </div>
        <div className="grid grid-cols-4 gap-3">
          {['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '=', '+', 'C'].map((btn) => (
            <button
              key={btn}
              onClick={() => handleButtonClick(btn)}
              className={getButtonClass(btn)}
            >
              {btn}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
