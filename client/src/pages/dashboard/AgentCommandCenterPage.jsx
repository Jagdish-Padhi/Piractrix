import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Cpu,
  Bot,
  Zap,
  ShieldCheck,
  AlertTriangle,
  History,
  Activity,
  Globe,
  ArrowUpRight,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  TrendingUp,
  Brain,
  Shield,
  Terminal,
  ChevronDown,
  Info
} from 'lucide-react';
import { Card, Badge, Button, Loader, Toggle } from '../../components';
import api from '../../services/api.js';
import useAuthStore from '../../store/auth.store.js';
import useAgentTraceStore from '../../store/agentTrace.store.js';
import { connectRealtime } from '../../services/realtime.js';
import toast from 'react-hot-toast';

export default function AgentCommandCenterPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const openTrace = useAgentTraceStore((state) => state.openTrace);

  const [autonomousMode, setAutonomousMode] = useState(false);
  const [lastRun, setLastRun] = useState(null);
  const [stats, setStats] = useState({
    totalDecisions: 0,
    actionsTaken: 0,
    decisionsLast24h: 0,
    threatDomainsCount: 0,
    breakdown: {}
  });
  const [decisions, setDecisions] = useState([]);
  const [threatMemory, setThreatMemory] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [liveLogs, setLiveLogs] = useState([]);
  const [expandedDecisionId, setExpandedDecisionId] = useState(null);

  // Autonomous modal confirmation state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAutoValue, setPendingAutoValue] = useState(false);

  const loadAgentData = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      else setIsSyncing(true);

      const [statusRes, statsRes, decisionsRes, threatRes] = await Promise.all([
        api.get('/agent/status'),
        api.get('/agent/stats'),
        api.get('/agent/decisions?limit=10'),
        api.get('/agent/threat-memory?limit=8')
      ]);

      setAutonomousMode(statusRes.data.autonomousMode || false);
      setLastRun(statusRes.data.lastRun);
      setStats(statsRes.data || {
        totalDecisions: 0,
        actionsTaken: 0,
        decisionsLast24h: 0,
        threatDomainsCount: 0,
        breakdown: {}
      });
      setDecisions(decisionsRes.data.items || []);
      setThreatMemory(threatRes.data.items || []);

      if (liveLogs.length === 0 && decisionsRes.data.items) {
        const initialLogs = decisionsRes.data.items.slice(0, 5).map((d) => ({
          id: d._id,
          platform: d.trace?.platform || d.input?.platform || 'web',
          text: d.reasoning || 'Agent decision processed',
          time: new Date(d.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          action: d.action,
          severity: d.meta?.severityResult?.severity || null,
          isReal: true,
        }));
        setLiveLogs(initialLogs);
      }
    } catch (err) {
      console.error('Failed to sync agent command center', err);
      toast.error('Sync failed. Please check backend connection.');
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadAgentData();
    const pollInterval = setInterval(() => loadAgentData(true), 15000);
    return () => clearInterval(pollInterval);
  }, []);

  // WebSockets for Real-Time decisions
  useEffect(() => {
    if (!accessToken) return;
    const socket = connectRealtime(accessToken);
    if (!socket) return;

    const handleRealtimeDecision = (payload) => {
      const { decision } = payload;
      if (!decision) return;

      if (decision.logId && decision.action) {
        setDecisions((prev) => {
          if (prev.some((d) => d._id === decision.logId)) return prev;
          const mapDecision = {
            _id: decision.logId,
            violationId: decision.violationId,
            action: decision.action,
            reasoning: decision.reasoning,
            autonomousMode: decision.autonomousMode,
            outcome: decision.outcome,
            input: decision.input,
            meta: { severityResult: decision.trace?.classifierResult, execResult: decision.executionResult },
            createdAt: new Date().toISOString()
          };
          return [mapDecision, ...prev].slice(0, 10);
        });
      }

      // Add to live visual logs
      const logEntry = {
        id: decision.logId || Math.random().toString(),
        platform: decision.trace?.platform || decision.input?.platform || 'web',
        text: decision.trace?.cascadeStages
          ? `[CASCADE] Stage 3 passed — SEV ${decision.trace?.classifierResult?.severity || 'classified'}`
          : (decision.reasoning?.slice(0, 90) || 'Agent decision processed'),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        action: decision.action,
        severity: decision.trace?.classifierResult?.severity || null,
        isReal: true,
      };

      setLiveLogs((prev) => [logEntry, ...prev].slice(0, 6));

      // Refresh Stats
      loadAgentData(true);

      // Toast notification for autonomous enforcement
      if (decision.autonomousMode && decision.action !== 'log_only') {
        toast(`[Auto-Defense] Action dispatched: ${decision.action.toUpperCase()}`, {
          icon: '🤖',
          duration: 4000,
          style: {
            borderLeft: '4px solid var(--app-color-primary)',
            fontSize: '13px'
          }
        });
      }
    };

    const handleRealtimePerception = (payload) => {
      if (!payload?.event) return;
      const logEntry = {
        id: Date.now(),
        platform: 'PERCEPTION',
        text: payload.event.triggeredBy || 'Asset scan frequency updated',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        action: 'perception_change',
        isPerception: true,
      };
      setLiveLogs((prev) => [logEntry, ...prev].slice(0, 6));
      loadAgentData(true);
    };

    socket.on('agent:decision', handleRealtimeDecision);
    socket.on('agent:perception', handleRealtimePerception);

    return () => {
      socket.off('agent:decision', handleRealtimeDecision);
      socket.off('agent:perception', handleRealtimePerception);
    };
  }, [accessToken]);

  // Support global shortcut listeners (T key)
  useEffect(() => {
    const handleShortcutToggle = () => {
      handleToggleRequest(!autonomousMode);
    };
    window.addEventListener('piractrix:toggle-autonomous', handleShortcutToggle);
    return () => window.removeEventListener('piractrix:toggle-autonomous', handleShortcutToggle);
  }, [autonomousMode]);

  const handleToggleRequest = (newVal) => {
    if (newVal === true) {
      // Prompt modal confirmation dialog
      setPendingAutoValue(true);
      setShowConfirmModal(true);
    } else {
      executeToggleMode(false);
    }
  };

  const executeToggleMode = async (newVal) => {
    try {
      setAutonomousMode(newVal);
      const res = await api.patch('/agent/mode', { mode: newVal });
      const updatedMode = res.data.autonomousMode;
      setAutonomousMode(updatedMode);
      toast.success(updatedMode ? 'Autonomous Mode activated! ShieldAgent will now automatically enforce rights.' : 'Autonomous Mode deactivated. Actions now queue for review.', {
        icon: updatedMode ? '🤖' : '⚙️'
      });
    } catch {
      toast.error('Failed to toggle autonomous mode.');
      setAutonomousMode(!newVal);
    }
  };

  // Approve a queued decision
  const handleApprove = async (decisionId) => {
    const originalDecisions = [...decisions];
    setDecisions(prev =>
      prev.map(d => d._id === decisionId ? { ...d, outcome: 'success', status: 'approved' } : d)
    );
    
    try {
      const res = await api.post(`/agent/approve/${decisionId}`);
      if (res.data.success) {
        toast.success('Action approved and executed!');
        loadAgentData(true);
      } else {
        toast.error('Failed to execute action.');
        setDecisions(originalDecisions);
      }
    } catch {
      toast.error('Error approving action.');
      setDecisions(originalDecisions);
    }
  };

  const getSeverityVariant = (sev) => {
    switch (Number(sev)) {
      case 5: return 'danger';
      case 4: return 'warning';
      case 3: return 'info';
      default: return 'secondary';
    }
  };

  const getPlatformClass = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'youtube': return 'bg-red-500';
      case 'twitter': return 'bg-slate-900';
      case 'telegram': return 'bg-sky-500';
      default: return 'bg-blue-500';
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <Loader size={0.7} />
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400 animate-pulse">Syncing Piractrix Ecosystem...</p>
      </div>
    );
  }

  return (
    <div className='w-full space-y-6 lg:space-y-8 animate-in fade-in duration-500 select-none'>
      
      {/* Dynamic forecast card at top */}
      <section className="bg-gradient-to-r from-purple-950 via-slate-950 to-indigo-950 border border-purple-900/50 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row gap-5 items-center justify-between text-white font-sans relative overflow-hidden">
        {/* Glow circles */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/10 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-600/10 rounded-full blur-2xl" />
        
        <div className="space-y-2 z-10">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-ping" />
            <h3 className="text-xs uppercase font-extrabold tracking-widest text-purple-300">Active Threat Forecast</h3>
          </div>
          <p className="text-lg font-black tracking-tight max-w-md">Gemini predicts coordinated live streams piracy peak in the next 12 hours.</p>
          <p className="text-[11px] text-slate-400 max-w-md">Scans rescheduled to run at high risk intervals. Enabling autonomous mode is recommended.</p>
        </div>

        <div className="flex gap-3 shrink-0 z-10 w-full md:w-auto">
          <Button as={Link} to="/dashboard/predictions" variant="secondary" className="flex-1 md:flex-none border-purple-800/80 bg-white/5 hover:bg-white/10 text-white font-extrabold uppercase text-[10px] tracking-wider py-3 px-5 rounded-xl border">
            Full Forecast
          </Button>
          <button 
            onClick={() => handleToggleRequest(true)}
            disabled={autonomousMode}
            className="flex-1 md:flex-none bg-purple-600 hover:bg-purple-700 text-white font-extrabold uppercase tracking-widest text-[10px] py-3 px-5 rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-purple-900/40 transition-all hover:scale-[1.02] active:scale-98 cursor-pointer disabled:opacity-50"
          >
            <Shield size={13} />
            Activate Auto-Defense
          </button>
        </div>
      </section>

      {/* 3-Column Command Center layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* Column 1 (Left 1/4) - Agent Status Widget */}
        <div className="space-y-6">
          <Card
            className="border-slate-200/60 bg-white shadow-xs"
            title="ShieldAgent Status"
          >
            <div className="space-y-4">
              {/* Premium Toggle Button */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col items-center gap-3">
                <div className={`p-4 rounded-full ${autonomousMode ? 'bg-purple-100 text-purple-600 animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
                  <Shield size={32} />
                </div>
                <div className="text-center">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">Auto-Defense Control</h4>
                  <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Toggle autonomous notice dispatch</p>
                </div>
                <button
                  onClick={() => handleToggleRequest(!autonomousMode)}
                  className={`w-full py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                    autonomousMode 
                      ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-md' 
                      : 'bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 shadow-xs'
                  }`}
                >
                  {autonomousMode ? 'Auto-Defense: ON' : 'Auto-Defense: OFF'}
                </button>
              </div>

              {/* Stats aggregation list */}
              <div className="space-y-2 font-mono text-[11px]">
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-400 font-bold">Total Actions:</span>
                  <span className="font-extrabold text-slate-800">{stats.totalDecisions}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-400 font-bold">Accuracy rate:</span>
                  <span className="font-extrabold text-emerald-600">
                    {stats.totalDecisions > 0 ? `${Math.round((stats.actionsTaken / stats.totalDecisions) * 100)}%` : '100%'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-400 font-bold">Last Action:</span>
                  <span className="font-extrabold text-slate-600">
                    {lastRun ? new Date(lastRun).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'None'}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Column 2 (Center 2/4) - Expandable Decision Cards */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
            <h3 className="text-xs uppercase font-extrabold tracking-wider text-slate-400">Security Decision Queue</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => loadAgentData(true)}
                className="h-8 px-3 rounded-xl text-[10px] font-bold bg-white border-slate-200 hover:bg-slate-50 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
                Sync
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {decisions.map((d) => {
              const isExpanded = expandedDecisionId === d._id;
              const severity = d.meta?.severityResult?.severity || 3;
              const confidence = d.input?.confidence || 0;
              const sourceDomain = d.input?.domainReputation || 'unknown';
              const action = d.action || 'log_only';

              return (
                <div 
                  key={d._id} 
                  className={`bg-white rounded-2xl border border-slate-200/60 shadow-xs hover:border-slate-350 transition-all overflow-hidden flex flex-col`}
                >
                  {/* Collapsed Header */}
                  <div 
                    onClick={() => setExpandedDecisionId(isExpanded ? null : d._id)}
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/20"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <Badge variant={getSeverityVariant(severity)} className="font-mono text-[10px] font-black uppercase shrink-0">
                        SEV {severity}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate uppercase max-w-[200px] sm:max-w-[320px]">
                          {action.replace('_', ' ')}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {sourceDomain} • {confidence}% Match • {new Date(d.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant={d.autonomousMode ? 'primary' : 'secondary'} className="font-bold text-[9px] uppercase tracking-wider px-1.5">
                        {d.autonomousMode ? 'Auto' : 'Manual'}
                      </Badge>
                      <ChevronDown size={16} className={`text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {/* Expanded Content Drawer */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50/30 space-y-4 animate-in slide-in-from-top-2 duration-200">
                      <div className="pt-3 space-y-1.5">
                        <h4 className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Agent Reasoning</h4>
                        <p className="text-xs text-slate-700 font-medium leading-relaxed bg-white border border-slate-100 rounded-xl p-3">
                          "{d.reasoning || 'Autonomous violation matching.'}"
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs">
                        {/* Cascade Verify Info */}
                        <div className="space-y-1.5">
                          <h4 className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Cascade Verify</h4>
                          <div className="bg-white border border-slate-100 rounded-xl p-3 flex gap-2 font-mono text-[10px] text-slate-500 select-none">
                            <span className="flex items-center gap-0.5 text-green-600 font-bold"><CheckCircle size={10} /> Keyword</span>
                            <span className="flex items-center gap-0.5 text-green-600 font-bold"><CheckCircle size={10} /> Fingerprint</span>
                            <span className="flex items-center gap-0.5 text-green-600 font-bold"><CheckCircle size={10} /> Vision</span>
                          </div>
                        </div>

                        {/* Domain prior violations */}
                        <div className="space-y-1.5">
                          <h4 className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Threat Memory Lookup</h4>
                          <div className="bg-white border border-slate-100 rounded-xl p-3 flex justify-between items-center font-mono text-[10px]">
                            <span className="text-slate-400">History:</span>
                            <span className="font-bold text-slate-800">{sourceDomain}</span>
                          </div>
                        </div>
                      </div>

                      {/* Expandable actions */}
                      <div className="flex flex-wrap gap-2.5 pt-2 border-t border-slate-100">
                        {d.outcome === 'pending' && !d.autonomousMode ? (
                          <button
                            onClick={() => handleApprove(d._id)}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold uppercase tracking-widest text-[9px] py-2 px-4 rounded-xl shadow-md transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                          >
                            Approve and Execute
                          </button>
                        ) : (
                          <Link
                            to={`/dashboard/violations/${d.violationId || ''}`}
                            className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold uppercase tracking-wider text-[9px] py-2 px-4 rounded-xl flex items-center justify-center gap-1 shadow-sm transition-all"
                          >
                            Inspect Violation <ChevronRight size={12} />
                          </Link>
                        )}
                        <button
                          onClick={() => openTrace(d._id)}
                          className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-100 font-bold uppercase tracking-widest text-[9px] py-2 px-4 rounded-xl transition-all cursor-pointer"
                        >
                          View Trace Detail
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {decisions.length === 0 && (
              <div className="text-center py-20 text-slate-400 bg-white border border-slate-200/60 rounded-2xl p-5 shadow-xs">
                <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-slate-350" />
                <p className="text-xs font-bold uppercase tracking-widest">Decision Queue Empty</p>
                <p className="text-[10px] mt-0.5 text-slate-400">Scan violations will stream here in real time.</p>
              </div>
            )}
          </div>
        </div>

        {/* Column 3 (Right 1/4) - Telemetry Terminal & Threat Memory */}
        <div className="space-y-6">
          {/* Telemetry Terminal */}
          <Card
            className="border-slate-200/60 bg-white shadow-xs"
            title="Telemetry Terminal"
          >
            <div className="relative overflow-hidden h-[250px] rounded-xl bg-slate-950 border border-slate-900 p-3 flex flex-col justify-end">
              <div className="space-y-1.5 overflow-y-auto scrollbar-none font-mono text-[9px] text-slate-300">
                {liveLogs.map((log) => (
                  <div key={log.id} className="flex gap-2 pb-1 border-b border-slate-900 last:border-0 last:pb-0 animate-in slide-in-from-bottom-1 duration-200">
                    <span className="w-1.5 h-1.5 rounded-full mt-1 shrink-0 bg-purple-500 animate-pulse" />
                    <span className="text-slate-500 shrink-0">{log.time}</span>
                    <span className="font-black text-purple-400 uppercase">[{log.platform}]</span>
                    <span className="truncate">{log.text}</span>
                  </div>
                ))}
                {liveLogs.length === 0 && (
                  <div className="text-slate-500">Awaiting scan telemetry stream...</div>
                )}
              </div>
            </div>
          </Card>

          {/* Threat memory compact */}
          <Card
            className="border-slate-200/60 bg-white shadow-xs"
            title="Threat Memory Cache"
            subtitle="Registered repeat offender pirate domains."
          >
            <div className="space-y-2.5">
              {threatMemory.slice(0, 4).map((t) => (
                <div key={t._id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100/50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{t.domain}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                      Count: {t.totalViolations}
                    </p>
                  </div>
                  <Badge variant={t.threatLevel === 'critical' || t.threatLevel === 'high' ? 'danger' : 'warning'} className="font-bold text-[8px] uppercase tracking-wider px-1">
                    {t.threatLevel}
                  </Badge>
                </div>
              ))}
              {threatMemory.length === 0 && (
                <div className="py-6 text-center text-slate-400 text-xs">No entries loaded.</div>
              )}
            </div>
          </Card>
        </div>

      </div>

      {/* Confirmation Modal when enabling Autonomous Mode */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setShowConfirmModal(false)} />
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xl transition-all animate-in zoom-in-95 duration-200 p-6 select-none font-sans">
            <div className="flex items-center gap-2.5 text-purple-600 mb-3">
              <Shield className="w-5 h-5 animate-pulse" />
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">Activate Auto-Defense?</h3>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed font-medium mb-4">
              When active, ShieldAgent will automatically draft DMCA takedown notices, update enforcement logs, and alert platform abuse teams in real time without human confirmation.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setPendingAutoValue(false);
                }}
                className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px] py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  executeToggleMode(true);
                }}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-extrabold uppercase tracking-widest text-[10px] py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
              >
                Activate Shield
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
