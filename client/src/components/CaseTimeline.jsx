import { Bot, Clock, ShieldAlert, Sparkles, Mail, CheckCircle, FileText } from 'lucide-react';
import useAgentTraceStore from '../store/agentTrace.store.js';

export default function CaseTimeline({ violation, onOpenDmca }) {
  const openTrace = useAgentTraceStore((state) => state.openTrace);

  if (!violation) return null;

  const timeline = violation.caseTimeline || [];
  const caseId = violation.caseId || 'PIR-PENDING';
  const hasDmca = violation.caseStatus === 'dmca_drafted' || violation.dmcaContent;

  const getEventIcon = (event) => {
    switch (event) {
      case 'detected': return <Clock size={14} className="text-blue-500" />;
      case 'agent_classified': return <Bot size={14} className="text-purple-500" />;
      case 'queued_review': return <ShieldAlert size={14} className="text-amber-500" />;
      case 'dmca_drafted': return <Sparkles size={14} className="text-purple-500" />;
      case 'notified': return <Mail size={14} className="text-emerald-500" />;
      case 'resolved': return <CheckCircle size={14} className="text-emerald-500" />;
      default: return <Clock size={14} className="text-slate-400" />;
    }
  };

  return (
    <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-xs space-y-5">
      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
        <h3 className="text-xs uppercase font-extrabold tracking-wider text-slate-400">Case Timeline</h3>
        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200/60 px-2.5 py-1 rounded-lg">
          {caseId}
        </span>
      </div>

      {/* Timeline List */}
      <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
        {timeline.map((item, idx) => (
          <div key={item._id || idx} className="relative flex flex-col gap-1 text-xs">
            {/* Node Circle */}
            <div className="absolute -left-6 top-0.5 w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-xs">
              {getEventIcon(item.event)}
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 capitalize">{item.event?.replace('_', ' ')}</span>
              <span className="font-mono text-[10px] text-slate-400">
                {new Date(item.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', month: 'short', day: 'numeric' })}
              </span>
            </div>
            <p className="text-slate-500 leading-relaxed font-medium">{item.description}</p>
          </div>
        ))}

        {/* Pending Stage */}
        {violation.caseStatus !== 'resolved' && violation.caseStatus !== 'false_positive' && (
          <div className="relative flex flex-col gap-1 text-xs opacity-60">
            <div className="absolute -left-6 top-0.5 w-6 h-6 rounded-full bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center animate-pulse">
              <Clock size={12} className="text-slate-400" />
            </div>
            <span className="font-bold text-slate-400">Pending Takedown Confirmation</span>
            <p className="text-[11px] text-slate-400 italic font-medium">Awaiting response from platform abuse team.</p>
          </div>
        )}
      </div>

      {/* Action panel at bottom */}
      <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-2.5">
        {violation.agentDecisionId && (
          <button
            onClick={() => openTrace(violation.agentDecisionId)}
            className="flex-1 min-w-[140px] bg-slate-900 hover:bg-slate-800 text-slate-100 font-extrabold uppercase tracking-widest text-[9px] py-3 rounded-xl border border-slate-800 flex items-center justify-center gap-1.5 shadow-sm transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
          >
            <Bot size={13} className="text-purple-400 animate-pulse" />
            Agent Reason Trace
          </button>
        )}
        {hasDmca && (
          <button
            onClick={onOpenDmca}
            className="flex-1 min-w-[140px] bg-purple-600 hover:bg-purple-700 text-white font-extrabold uppercase tracking-widest text-[9px] py-3 rounded-xl flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
          >
            <FileText size={13} className="text-purple-200" />
            View DMCA Draft
          </button>
        )}
      </div>
    </div>
  );
}
