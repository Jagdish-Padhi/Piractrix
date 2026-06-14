import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Keyboard, HelpCircle, X } from 'lucide-react';
import api from '../services/api.js';
import toast from 'react-hot-toast';

export default function KeyboardShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore key events when the user is typing in inputs or textareas
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.isContentEditable)
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      
      // Navigate routes
      if (key === 'a') {
        e.preventDefault();
        navigate('/dashboard/agent');
        toast('Navigating to Agent Command Center', { icon: '🤖', id: 'kb-nav' });
      } else if (key === 'v') {
        e.preventDefault();
        navigate('/dashboard/violations');
        toast('Navigating to Violations Queue', { icon: '⚖️', id: 'kb-nav' });
      } else if (key === 's' && !e.shiftKey) {
        e.preventDefault();
        navigate('/dashboard/scans');
        toast('Navigating to Scans History', { icon: '🔍', id: 'kb-nav' });
      } else if (key === 'n') {
        e.preventDefault();
        navigate('/dashboard/alerts');
        toast('Navigating to Alerts Inbox', { icon: '🔔', id: 'kb-nav' });
      } else if (key === '?' || (e.shiftKey && e.key === '?')) {
        e.preventDefault();
        setIsOpen(true);
      } else if (key === 't') {
        e.preventDefault();
        // Fire a custom event that components like AgentCommandCenter or Sidebar listen to
        window.dispatchEvent(new CustomEvent('piractrix:toggle-autonomous'));
      } else if (e.shiftKey && key === 's') {
        e.preventDefault();
        // Fire event to start new scan modal on scans page
        window.dispatchEvent(new CustomEvent('piractrix:open-scan-modal'));
        navigate('/dashboard/scans');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 z-40 bg-white border border-slate-200/80 hover:border-slate-300 text-slate-400 hover:text-slate-700 shadow-sm p-3 rounded-full hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
        title="Keyboard Shortcuts (?)"
      >
        <Keyboard size={18} />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
        onClick={() => setIsOpen(false)}
      />

      {/* Card Content */}
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xl transition-all animate-in zoom-in-95 duration-200 p-6 select-none font-sans">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <HelpCircle size={16} className="text-purple-600 animate-bounce" />
            <h3 className="text-xs uppercase font-extrabold tracking-wider text-slate-800">Keyboard Shortcuts</h3>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 font-mono text-[11px]">
          {[
            { key: 'A', action: 'Go to Agent Command Center' },
            { key: 'V', action: 'Go to Violations Case Queue' },
            { key: 'S', action: 'Go to Scans History' },
            { key: 'N', action: 'Go to Alerts Inbox' },
            { key: 'T', action: 'Toggle Autonomous Mode' },
            { key: 'Shift + S', action: 'Start a new Scan Job' },
            { key: '?', action: 'Open this helper checklist' },
            { key: 'Esc', action: 'Dismiss modals / drawers' }
          ].map((item) => (
            <div key={item.key} className="flex justify-between items-center py-1.5 border-b border-slate-100 last:border-0">
              <span className="text-slate-500 font-semibold">{item.action}</span>
              <kbd className="bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded text-[10px] text-slate-700 font-black shadow-xs">
                {item.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
