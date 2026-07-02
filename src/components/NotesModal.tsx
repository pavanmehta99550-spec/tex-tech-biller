import React, { useState } from 'react';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import { Note } from '../types';

interface NotesModalProps {
  notes: Note[];
  setNotes: (notes: Note[]) => void;
  onClose: () => void;
}

export default function NotesModal({ notes, setNotes, onClose }: NotesModalProps) {
  const [newNote, setNewNote] = useState('');

  const handleSaveNote = () => {
    if (!newNote.trim()) return;
    const note: Note = {
      id: Date.now().toString(),
      text: newNote,
      createdAt: new Date().toISOString(),
    };
    setNotes([...notes, note]);
    setNewNote('');
  };

  const handleDeleteNote = (id: string) => {
    setNotes(notes.filter(n => n.id !== id));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-black text-slate-900 uppercase">My Notes</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
            <X size={20} />
          </button>
        </div>
        <div className="mb-4">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none"
            placeholder="Write your note here..."
            rows={3}
          />
          <button
            onClick={handleSaveNote}
            className="mt-2 w-full bg-indigo-600 text-white py-2 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all"
          >
            <Plus size={18} />
            Add Note
          </button>
        </div>
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {notes.map(note => (
            <div key={note.id} className="p-3 bg-slate-50 rounded-xl flex justify-between items-start">
              <div>
                <p className="text-sm text-slate-800">{note.text}</p>
                <p className="text-[10px] text-slate-400 mt-1">{new Date(note.createdAt).toLocaleDateString()}</p>
              </div>
              <button onClick={() => handleDeleteNote(note.id)} className="p-1 hover:bg-red-100 text-red-500 rounded-full">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
