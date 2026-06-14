import { useEffect } from 'react';
import { X, Bot, Play, ShieldAlert, Cpu, Terminal, AlertTriangle, ShieldCheck } from 'lucide-react';
import useAgentTraceStore from '../store/agentTrace.store.js';

export default function AgentThinkingDrawer() {
  const { open, data, loading, error, closeTrace } = useAgentTraceStore();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeTrace();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeTrace]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={closeTrace}
      />

      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md transform bg-slate-950 border-l border-slate-800 text-slate-100 shadow-2xl transition-transform duration-300 ease-in-out">
          <div className="flex h-full flex-col overflow-y-auto">
            {/* Header */}
            <div className="border-b border-slate-800 bg-slate-900/60 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Bot className="w-5 h-5 text-purple-400 animate-pulse" />
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-200">Agent Reasoning Trace</h2>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">Audit log for decision execution</p>
                </div>
              </div>
              <button 
                onClick={closeTrace}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 p-5 space-y-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Cpu className="w-10 h-10 text-purple-400 animate-spin" />
                  <p className="text-xs font-mono text-slate-500 uppercase tracking-widest animate-pulse">Reconstructing execution trace...</p>
                </div>
              ) : error ? (
                <div className="bg-red-950/40 border border-red-900/60 rounded-xl p-4 flex gap-3 text-red-400">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <div className="text-xs">
                    <p className="font-bold uppercase tracking-wider">Trace Load Error</p>
                    <p className="mt-1 font-mono text-red-300">{error}</p>
                  </div>
                </div>
              ) : data ? (
                <div className="space-y-6">
                  {/* Top Summary Block */}
                  <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 font-mono space-y-2">
                    <div className="flex justify-between items-center text-xs border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Case ID:</span>
                      <span className="font-bold text-purple-400">{data.violation?.caseId || 'PIR-PENDING'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pt-1">
                      <span className="text-slate-400">Asset:</span>
                      <span className="font-bold text-slate-200 truncate max-w-[200px]">{data.asset?.title || 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Verdict:</span>
                      <span className="font-bold uppercase px-2 py-0.5 rounded text-[10px] bg-purple-950 border border-purple-800 text-purple-300">
                        {data.decision?.action?.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Staggered Waterfall Steps */}
                  <div className="space-y-4 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-800">
                    {data.steps?.map((step, idx) => (
                      <div 
                        key={step.name} 
                        className="flex gap-4 relative animate-in slide-in-from-left-4 fade-in duration-300"
                        style={{ animationDelay: `${idx * 100}ms` }}
                      >
                        {/* Dot indicator */}
                        <div className={`w-8 h-8 rounded-full border flex items-center justify-center z-10 shrink-0 ${
                          step.passed 
                            ? 'bg-slate-900 border-green-800 text-green-400' 
                            : step.name === 'execution' && step.value?.includes('Pending')
                            ? 'bg-slate-900 border-amber-800 text-amber-400'
                            : 'bg-slate-900 border-slate-800 text-slate-500'
                        }`}>
                          <span className="font-mono text-xs font-bold">{step.step}</span>
                        </div>
                        {/* Box details */}
                        <div className="flex-1 bg-slate-900/40 border border-slate-900 rounded-xl p-3.5 hover:border-slate-800 transition-colors">
                          <div className="flex justify-between items-start">
                            <h4 className="text-xs uppercase font-extrabold tracking-wider text-slate-300">{step.label}</h4>
                            <span className="text-[10px] font-mono text-slate-500">{step.ms > 0 ? `${step.ms}ms` : ''}</span>
                          </div>
                          <p className="text-xs font-mono mt-1.5 text-slate-400 leading-relaxed">{step.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Fully formatted reasoning */}
                  <div className="border-t border-slate-800 pt-5 space-y-2.5">
                    <h4 className="text-xs uppercase font-extrabold tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Terminal size={14} className="text-purple-400" />
                      Agent Executive Verdict
                    </h4>
                    <div className="bg-slate-900/60 border border-slate-900 rounded-xl p-4 font-mono text-xs text-slate-300 leading-relaxed italic">
                      "{data.reasoning || 'No details provided.'}"
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 text-slate-500 text-xs">No trace data available.</div>
              )}
            </div>

            {/* Footer */}
            {data && data.violation && (
              <div className="border-t border-slate-800 bg-slate-900/20 p-4 flex gap-3">
                <Link 
                  to={`/dashboard/violations`}
                  onClick={closeTrace}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-extrabold uppercase tracking-widest text-center py-3 rounded-xl shadow-lg shadow-purple-950/40 transition-all hover:scale-[1.02] active:scale-95 text-[10px]"
                >
                  View Infringement Case
                </Link>
                {data.decision?.action === 'draft_dmca' && (
                  <button 
                    onClick={() => {
                      closeTrace();
                      window.dispatchEvent(new CustomEvent('piractrix:open-dmca', { detail: { violationId: data.violation?._id } }));
                    }}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold uppercase tracking-widest text-center py-3 rounded-xl border border-slate-700 transition-all hover:scale-[1.02] active:scale-95 text-[10px] cursor-pointer"
                  >
                    View DMCA Draft
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
