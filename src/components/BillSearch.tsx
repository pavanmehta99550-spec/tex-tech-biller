import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

interface BillSearchProps {
  onSearch: (billNo: string) => Promise<boolean>;
  onClear?: () => void;
  isLoaded?: boolean;
}

export default function BillSearch({ onSearch, onClear, isLoaded = false }: BillSearchProps) {
  const [billNo, setBillNo] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus input when component loads
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSearchClick = async () => {
    if (!billNo.trim()) return;
    setIsSearching(true);
    setErrorMsg('');
    try {
      const found = await onSearch(billNo.trim());
      if (!found) {
        setErrorMsg('Bill not found! Please check the invoice number.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearchClick();
    }
  };

  const handleClearClick = () => {
    setBillNo('');
    setErrorMsg('');
    if (onClear) {
      onClear();
    }
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="p-6 bg-slate-50 border border-slate-200/80 rounded-[24px] space-y-2 shadow-sm transition-all hover:shadow-md max-w-full">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
            {isSearching ? (
              <Loader2 className="animate-spin text-indigo-500" size={18} />
            ) : (
              <Search size={18} />
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            placeholder="Enter Bill No. to Edit..."
            value={billNo}
            onChange={(e) => {
              setBillNo(e.target.value);
              if (errorMsg) setErrorMsg('');
            }}
            onKeyDown={handleKeyDown}
            disabled={isSearching}
            className="w-full pl-11 pr-11 py-3 border-2 border-slate-200/80 rounded-xl font-bold bg-white outline-none focus:border-indigo-500 transition-all shadow-sm text-slate-700 placeholder-slate-400 text-sm disabled:bg-slate-50 disabled:text-slate-400"
          />
          {(billNo || isLoaded) && (
            <button
              type="button"
              onClick={handleClearClick}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              title="Clear search and start new"
            >
              <X size={16} className="bg-slate-100 hover:bg-slate-200 p-0.5 rounded-full" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleSearchClick}
          disabled={isSearching || !billNo.trim()}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
        >
          {isSearching && <Loader2 className="animate-spin" size={16} />}
          {isSearching ? 'Searching...' : 'Open Bill'}
        </button>
      </div>

      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          💡 Press Enter or click "Open Bill" to retrieve from Firebase
        </span>
        {errorMsg && (
          <span className="text-[11px] font-bold text-rose-500 animate-pulse">
            ⚠️ {errorMsg}
          </span>
        )}
      </div>
    </div>
  );
}
