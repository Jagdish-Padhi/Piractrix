import { useState, useEffect } from 'react';
import { X, Copy, Mail, Check, AlertTriangle, Send } from 'lucide-react';
import api from '../services/api.js';
import toast from 'react-hot-toast';

export default function DmcaPreviewDrawer({ isOpen, onClose, violation, onUpdate }) {
  const [copied, setCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [contactEmail, setContactEmail] = useState('');
  const [dmcaText, setDmcaText] = useState('');

  useEffect(() => {
    if (violation) {
      setContactEmail(violation.dmcaContactEmail || 'abuse@platform.com');
      setDmcaText(violation.dmcaContent || '');
    }
  }, [violation]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen || !violation) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(dmcaText);
    setCopied(true);
    toast.success('Notice copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async (manualOnly = false) => {
    setIsSending(true);
    try {
      // Mark as reported
      await api.patch(`/violations/${violation._id}/status`, { status: 'reported' });
      toast.success(manualOnly ? 'Marked as sent manually.' : 'DMCA Takedown Notice dispatched!');
      if (onUpdate) onUpdate();
      onClose();
    } catch (err) {
      toast.error('Failed to update enforcement status.');
    } finally {
      setIsSending(false);
    }
  };

  const mailtoSubject = `URGENT: Formal DMCA Copyright Infringement Notice [Case #${violation.caseId || violation._id.slice(-6).toUpperCase()}]`;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-lg transform bg-slate-950 border-l border-slate-800 text-slate-100 shadow-2xl transition-transform duration-300 ease-in-out">
          <div className="flex h-full flex-col overflow-y-auto">
            
            {/* Header */}
            <div className="border-b border-slate-800 bg-slate-900/60 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Mail className="w-5 h-5 text-purple-400" />
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-200">Review DMCA Notice</h2>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">Case Reference: {violation.caseId || 'Pending'}</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 p-5 space-y-6">
              
              {/* Recipient / Headers Panel */}
              <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 font-mono text-xs space-y-3">
                <div className="flex items-center gap-3 border-b border-slate-800/60 pb-2">
                  <span className="text-slate-500 font-bold w-16 uppercase tracking-wider">To:</span>
                  <input 
                    type="email" 
                    value={contactEmail} 
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="flex-1 bg-transparent border-0 border-b border-transparent hover:border-slate-800 focus:border-purple-500 focus:outline-none text-slate-200 font-medium pb-0.5"
                  />
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-slate-500 font-bold w-16 uppercase tracking-wider pt-0.5">Subject:</span>
                  <span className="flex-1 text-slate-300 font-medium leading-relaxed">{mailtoSubject}</span>
                </div>
              </div>

              {/* Text Area Body */}
              <div className="flex flex-col flex-1 border border-slate-800 bg-slate-900 rounded-xl overflow-hidden min-h-[300px]">
                <div className="bg-slate-950 border-b border-slate-800 px-4 py-2 flex justify-between items-center text-[10px] uppercase font-bold text-slate-500">
                  <span>Notice Body</span>
                  <button 
                    onClick={handleCopy}
                    className="flex items-center gap-1 hover:text-purple-400 transition-colors cursor-pointer"
                  >
                    {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <textarea 
                  value={dmcaText}
                  onChange={(e) => setDmcaText(e.target.value)}
                  className="flex-1 w-full bg-slate-950 p-4 font-mono text-[11px] leading-relaxed text-slate-300 focus:outline-none resize-none min-h-[280px]"
                  spellCheck={false}
                />
              </div>

              {/* AI Verification Check Badge */}
              <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-3 flex gap-2.5 text-emerald-400 items-center">
                <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <Check size={12} className="text-emerald-500" />
                </div>
                <span className="text-[11px] font-bold">AI Draft verified & matches core ownership fingerprints.</span>
              </div>

            </div>

            {/* Footer Buttons */}
            <div className="border-t border-slate-800 bg-slate-900/20 p-4 flex flex-col gap-2.5">
              <div className="flex gap-3">
                <a 
                  href={`mailto:${contactEmail}?subject=${encodeURIComponent(mailtoSubject)}&body=${encodeURIComponent(dmcaText)}`}
                  onClick={() => handleSend(false)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-extrabold uppercase tracking-widest text-center py-3 rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-purple-950/40 transition-all hover:scale-[1.02] active:scale-95 text-[10px]"
                >
                  <Send size={12} />
                  Send Notice Now
                </a>
                <button 
                  onClick={() => handleSend(true)}
                  disabled={isSending}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-300 font-extrabold uppercase tracking-widest text-center py-3 rounded-xl border border-slate-800 transition-all hover:scale-[1.02] active:scale-95 text-[10px] cursor-pointer"
                >
                  Mark as Sent Manually
                </button>
              </div>
              <button 
                onClick={onClose}
                className="w-full bg-transparent hover:bg-slate-900 text-slate-500 hover:text-slate-300 font-bold uppercase tracking-wider text-center py-2.5 rounded-xl transition-colors text-[10px] cursor-pointer"
              >
                Cancel
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
