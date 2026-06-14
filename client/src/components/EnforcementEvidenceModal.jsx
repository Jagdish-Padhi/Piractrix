import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ShieldCheck, Mail, MessageSquare, Send, Zap, ChevronRight, FileText, CheckCircle } from 'lucide-react';
import { connectRealtime } from '../services/realtime.js';
import useAuthStore from '../store/auth.store.js';

export default function EnforcementEvidenceModal() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!accessToken) return;
    const socket = connectRealtime(accessToken);
    if (!socket) return;

    const handleRealtimeDecision = (payload) => {
      const { decision } = payload;
      if (!decision) return;
      
      // Auto-open this receipt modal if the agent automatically drafted DMCA in Autonomous mode
      if (decision.autonomousMode && (decision.action === 'draft_dmca' || decision.action === 'auto_escalate') && decision.outcome === 'success') {
        setData(decision);
        setIsOpen(true);
      }
    };

    socket.on('agent:decision', handleRealtimeDecision);

    return () => {
      socket.off('agent:decision', handleRealtimeDecision);
    };
  }, [accessToken]);

  // Support listening to manual triggers
  useEffect(() => {
    const handleOpenTrigger = (e) => {
      setData(e.detail?.decision);
      setIsOpen(true);
    };
    window.addEventListener('piractrix:open-receipt', handleOpenTrigger);
    return () => window.removeEventListener('piractrix:open-receipt', handleOpenTrigger);
  }, []);

  if (!isOpen || !data) return null;

  const executionResult = data.executionResult || {};
  const draft = executionResult.details?.draft || {};
  const channels = executionResult.details?.channels || [];
  const caseId = executionResult.details?.caseId || data.trace?.caseId || 'PIR-PENDING';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto font-sans">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={() => setIsOpen(false)}
      />

      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xl transition-all animate-in zoom-in-95 duration-200">
          
          {/* Top Banner Gradient */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-900 px-6 py-5 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-purple-200 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider">Agent Enforcement Complete</h3>
                <p className="text-[10px] text-purple-200 font-mono mt-0.5">Case Reference: {caseId}</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            
            {/* Meta summary cards */}
            <div className="grid grid-cols-3 gap-3 font-mono text-[11px] text-slate-500">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <p className="uppercase font-bold tracking-wider text-[9px] text-slate-400">Platform</p>
                <p className="mt-1 font-black text-slate-800 uppercase">{data.trace?.platform || 'web'}</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <p className="uppercase font-bold tracking-wider text-[9px] text-slate-400">Match Rate</p>
                <p className="mt-1 font-black text-slate-800">{data.trace?.matchConfidence || 0}%</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <p className="uppercase font-bold tracking-wider text-[9px] text-slate-400">Severity</p>
                <p className="mt-1 font-black text-slate-800">SEV {data.trace?.classifierResult?.severity || 5}</p>
              </div>
            </div>

            {/* DMCA notice preview */}
            <div className="space-y-2">
              <h4 className="text-xs uppercase font-extrabold tracking-wider text-slate-400 flex items-center gap-1.5">
                <FileText size={14} className="text-purple-600" />
                DMCA Notice Preview
              </h4>
              <div className="rounded-xl border border-slate-200 bg-slate-900 overflow-hidden font-mono text-[10px]">
                <div className="border-b border-slate-800 bg-slate-950 px-4 py-2.5 space-y-1 text-slate-400">
                  <p><span className="text-slate-500 font-bold">To:</span> {draft.contactEmail || 'copyright@youtube.com'}</p>
                  <p><span className="text-slate-500 font-bold">Subject:</span> Copyright Infringement Takedown Notice</p>
                </div>
                <div className="p-4 bg-slate-950 max-h-[160px] overflow-y-auto text-slate-300 leading-relaxed scrollbar-thin scrollbar-thumb-slate-800 whitespace-pre-wrap">
                  {draft.draft || 'Notice template generation error.'}
                </div>
              </div>
            </div>

            {/* Notification logs list */}
            <div className="space-y-2.5">
              <h4 className="text-xs uppercase font-extrabold tracking-wider text-slate-400">
                Delivery Receipt Logs
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-emerald-600" />
                    <span>Notification E-Mail</span>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-black uppercase"><CheckCircle size={10} /> Sent</span>
                </div>

                {channels.includes('whatsapp') && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <MessageSquare size={14} className="text-emerald-600" />
                      <span>WhatsApp Alert</span>
                    </div>
                    <span className="flex items-center gap-1 text-[10px] font-black uppercase"><CheckCircle size={10} /> Delivered</span>
                  </div>
                )}
                {channels.includes('telegram') && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <Send size={14} className="text-emerald-600" />
                      <span>Telegram Dispatch</span>
                    </div>
                    <span className="flex items-center gap-1 text-[10px] font-black uppercase"><CheckCircle size={10} /> Sent</span>
                  </div>
                )}
                {channels.includes('slack') && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <Zap size={14} className="text-emerald-600" />
                      <span>Slack Webhook</span>
                    </div>
                    <span className="flex items-center gap-1 text-[10px] font-black uppercase"><CheckCircle size={10} /> Dispatched</span>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Footer actions */}
          <div className="border-t border-slate-200 bg-slate-50 p-4 flex justify-between gap-3">
            <button 
              onClick={() => setIsOpen(false)}
              className="flex-1 bg-white hover:bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-xs border border-slate-200 py-3 rounded-xl transition-colors cursor-pointer"
            >
              Acknowledge Receipt
            </button>
            <button 
              onClick={() => {
                setIsOpen(false);
                navigate(`/dashboard/violations`);
              }}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-extrabold uppercase tracking-widest text-xs py-3 rounded-xl flex items-center justify-center gap-1 shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              View Full Case Timeline <ChevronRight size={14} />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
