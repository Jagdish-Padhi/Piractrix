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
  Brain
} from 'lucide-react';
import { Card, Badge, Button, Loader, Toggle } from '../../components';
import api from '../../services/api.js';
import useAuthStore from '../../store/auth.store.js';
import { connectRealtime } from '../../services/realtime.js';
import toast from 'react-hot-toast';

export default function AgentCommandCenterPage() {

  const accessToken = useAuthStore((state) => state.accessToken);
  
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
  const liveLogsContainerRef = useRef(null);

  // Load everything
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

      // If live logs are empty, initialize with some recent decisions
      if (liveLogs.length === 0 && decisionsRes.data.items) {
        const initialLogs = decisionsRes.data.items.slice(0, 5).map((d) => ({
          id: d._id,
          type: d.decisionType,
          action: d.action,
          reason: d.reasoning,
          timestamp: new Date(d.createdAt).toLocaleTimeString(),
          success: d.outcome === 'success'
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

      // Only add to decisions list if it is a complete decision object to prevent crashes
      if (decision._id && decision.action) {
        setDecisions((prev) => {
          if (prev.some((d) => d._id === decision._id)) return prev;
          return [decision, ...prev].slice(0, 10);
        });
      }

      // Add to live visual logs
      const logEntry = {
        id: decision._id || decision.decisionId || Math.random().toString(),
        type: decision.decisionType || 'action_taken',
        action: decision.action || 'approved_action',
        reason: decision.reasoning || 'Action approved and executed.',
        timestamp: new Date().toLocaleTimeString(),
        success: decision.outcome === 'success' || decision.approved
      };

      setLiveLogs((prev) => [logEntry, ...prev].slice(0, 8));

      // Refresh Stats in background to pull full synchronized data
      loadAgentData(true);

      // Toast notification for autonomous enforcement
      if (decision.autonomousMode && decision.action) {
        toast(`[Agent Enforcement] ${decision.action.toUpperCase()}: ${decision.reasoning?.slice(0, 60)}...`, {
          icon: '🤖',
          duration: 4000,
          style: {
            borderLeft: '4px solid var(--app-color-accent)',
            fontSize: '13px'
          }
        });
      }
    };

    socket.on('agent:decision', handleRealtimeDecision);

    return () => {
      socket.off('agent:decision', handleRealtimeDecision);
    };
  }, [accessToken]);

  // Toggle Autonomous Mode
  const handleToggleMode = async (newVal) => {
    try {
      setAutonomousMode(newVal);
      const res = await api.patch('/agent/mode', { mode: newVal });
      const updatedMode = res.data.autonomousMode;
      setAutonomousMode(updatedMode);
      toast.success(updatedMode ? 'Autonomous Mode activated. Piractrix will now automatically enforce rights.' : 'Autonomous Mode deactivated. Actions now queue for review.', {
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
    
    // Optimistic update
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

  // Helper badge color
  const getSeverityColor = (sev) => {
    switch (Number(sev)) {
      case 5: return 'bg-red-500 text-white';
      case 4: return 'bg-orange-500 text-white';
      case 3: return 'bg-amber-500 text-slate-900';
      case 2: return 'bg-blue-500 text-white';
      default: return 'bg-slate-400 text-white';
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
    <div className='w-full space-y-6 lg:space-y-8 animate-in fade-in duration-500'>
      
      {/* Page Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200/60">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Enforcement Engine:</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${autonomousMode ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700'}`}>
            {autonomousMode ? 'Autonomous Mode' : 'Manual Approvals'}
          </span>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/60 px-3 py-1.5 rounded-xl">
          <span className="text-xs font-bold text-slate-500 select-none">Auto-Defense Control</span>
          <Toggle 
            checked={autonomousMode} 
            onChange={handleToggleMode} 
            className="scale-90"
          />
        </div>
      </div>

      {/* Stats row */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Ecosystem Status', value: autonomousMode ? 'AUTONOMOUS' : 'ASSISTED', subtitle: lastRun ? `Last action: ${new Date(lastRun).toLocaleTimeString()}` : 'No actions yet', icon: Activity, color: 'text-indigo-600', bg: 'bg-indigo-50/50', accent: 'border-l-indigo-600' },
          { label: 'Enforcement Rate', value: stats.totalDecisions > 0 ? `${Math.round((stats.actionsTaken / stats.totalDecisions) * 100)}%` : '100%', subtitle: `${stats.actionsTaken} direct takedowns`, icon: Zap, color: 'text-purple-600', bg: 'bg-purple-50/50', accent: 'border-l-purple-600' },
          { label: 'Active Memory Graph', value: stats.threatDomainsCount, subtitle: 'Pirate domains tracked', icon: Brain, color: 'text-violet-600', bg: 'bg-violet-50/50', accent: 'border-l-violet-600' },
          { label: 'Decisions (24h)', value: stats.decisionsLast24h, subtitle: 'Autonomous decisions', icon: History, color: 'text-sky-600', bg: 'bg-sky-50/50', accent: 'border-l-sky-600' },
        ].map((item) => (
          <div key={item.label} className={`relative group bg-white rounded-2xl border border-slate-200/60 border-l-4 ${item.accent} p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1`}>
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{item.label}</p>
              <div className={`p-2 rounded-xl ${item.bg} ${item.color} group-hover:scale-105 transition-transform`}>
                <item.icon className="w-4 h-4" />
              </div>
            </div>
            <span className="font-mono text-2xl font-bold tracking-tight text-slate-900 block">{item.value}</span>
            <span className="text-xs font-medium text-slate-400 mt-1 block">{item.subtitle}</span>
          </div>
        ))}
      </section>

      {/* Main split row */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Live Decisions Feed */}
        <div className="lg:col-span-2">
          <Card
            className="border-slate-200/60 bg-white shadow-sm overflow-hidden"
          title="Security Enforcement Queue"
          subtitle="Real-time autonomous classification & legal response logs."
          headerAction={
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => loadAgentData(true)}
                className="h-8 px-3 rounded-lg text-xs font-semibold bg-white border-slate-200 hover:bg-slate-50"
              >
                <RefreshCw className={`w-3 h-3 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button as={Link} to="/dashboard/agent-log" variant="secondary" size="sm" className="h-8 px-3 rounded-lg text-xs font-semibold hover:bg-slate-100">
                Audit Log
              </Button>
            </div>
          }
        >
            <div className="overflow-x-auto lg:overflow-x-visible">
              <table className="w-full table-fixed text-left text-sm border-separate border-spacing-0">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="w-[45%] px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">Decision details</th>
                    <th className="w-[15%] px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">Action</th>
                    <th className="w-[12%] px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">Mode</th>
                    <th className="w-[15%] px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">Outcome</th>
                    <th className="w-[13%] px-3 py-3 text-right border-b border-slate-100"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {decisions.length > 0 ? (
                    decisions.map((d) => (
                      <tr key={d._id} className="group hover:bg-slate-50/30 transition-colors">
                        <td className="px-3 py-3.5 space-y-1 min-w-0 overflow-hidden">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${getSeverityColor(d.meta?.severityResult?.severity || 3)}`}>
                              SEV {d.meta?.severityResult?.severity || 3}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                              {new Date(d.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="font-bold text-slate-800 text-xs truncate max-w-full">
                            {d.reasoning || 'Autonomous violation processing.'}
                          </p>
                          <p className="text-xs text-slate-400 font-mono truncate max-w-full italic">
                            Platform: <span className="text-slate-600 font-semibold uppercase">{d.input?.platform || 'web'}</span> | Confidence: <span className="text-slate-600 font-semibold">{d.input?.confidence || 0}%</span>
                          </p>
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className="capitalize text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200/60 px-2.5 py-1 rounded-lg">
                              {d.action.replace('_', ' ')}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <Badge variant={d.autonomousMode ? 'primary' : 'secondary'} size="sm" className="font-bold uppercase tracking-wider text-xs px-2">
                            {d.autonomousMode ? 'Auto' : 'Manual'}
                          </Badge>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className={`inline-flex items-center gap-1 text-xs font-bold ${
                            d.outcome === 'success' ? 'text-green-600' :
                            d.outcome === 'failed' ? 'text-red-500' :
                            d.outcome === 'skipped' ? 'text-slate-400' : 'text-amber-500'
                          }`}>
                            {d.outcome === 'success' ? <CheckCircle size={14} /> :
                             d.outcome === 'failed' ? <XCircle size={14} /> :
                             d.outcome === 'skipped' ? <XCircle size={14} className="text-slate-400" /> : <Activity size={14} className="animate-pulse" />}
                            <span className="uppercase text-xs tracking-wider">{d.outcome}</span>
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-right">
                          {d.outcome === 'pending' && !d.autonomousMode ? (
                            <Button 
                              variant="primary" 
                              size="sm" 
                              onClick={() => handleApprove(d._id)}
                              className="h-7 px-3 rounded-lg text-xs font-bold tracking-wider uppercase shadow-sm bg-[var(--app-color-primary)] hover:bg-[var(--app-color-primary-hover)] text-white"
                            >
                              Approve
                            </Button>
                          ) : (
                            <Link 
                              to={`/dashboard/violations/${d.violationId || ''}`}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--app-color-primary)] hover:underline group-hover:translate-x-1 transition-transform"
                            >
                              Inspect <ChevronRight size={14} />
                            </Link>
                          )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-4 py-24 text-center text-slate-400 bg-slate-50/20">
                      <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">No agent decisions logged</p>
                      <p className="text-xs text-slate-400 mt-1">Decisions stream here when scan jobs execute.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Threat Memory & Live logs stack */}
      <div className="lg:col-span-1 space-y-6">
          
          {/* Real-time Ingestion Stream */}
          <Card
            className="border-slate-200/60 bg-white shadow-sm"
            title="Discovery Telemetry"
            subtitle="Live audit signatures of agent brain activity."
          >
            <div className="relative overflow-hidden h-[250px] rounded-xl bg-slate-900 border border-slate-800 p-2">
              <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-slate-900 to-transparent z-10 pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-slate-900 to-transparent z-10 pointer-events-none" />
              <div 
                ref={liveLogsContainerRef}
                className="space-y-0.5 flex flex-col justify-end h-full p-2 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800"
              >
                {liveLogs.map((log) => (
                  <div key={log.id} className="animate-in slide-in-from-bottom-1 fade-in duration-300 flex items-start gap-2.5 py-1.5 border-b border-slate-800/40 last:border-0">
                    <div className="mt-1 flex-shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--app-color-accent)] animate-pulse" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="text-xs uppercase font-bold text-[var(--app-color-accent)] tracking-wider">{log.action.replace('_', ' ')}</span>
                        <span className="text-xs text-slate-500 font-mono">{log.timestamp}</span>
                      </div>
                      <p className="text-xs text-slate-300 font-mono mt-0.5 truncate">{log.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Threat Memory */}
          <Card
            className="border-slate-200/60 bg-white shadow-sm"
            title="Threat Memory Network"
            subtitle="Known pirate platforms & repeat domains."
          >
            <div className="space-y-3">
              {threatMemory.length > 0 ? (
                threatMemory.map((t) => (
                  <div key={t._id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                        <Globe size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{t.domain}</p>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Platforms: {t.platforms?.join(', ') || 'web'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Badge variant={t.threatLevel === 'critical' || t.threatLevel === 'high' ? 'danger' : 'warning'} size="sm" className="font-bold uppercase tracking-wider text-xs px-1.5 py-0.5">
                        {t.threatLevel}
                      </Badge>
                      <span className="text-xs font-black text-slate-800 font-mono w-6 text-right">{t.totalViolations}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <Globe className="w-8 h-8 mx-auto mb-2 opacity-25" />
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">No repeat offenders registered</p>
                </div>
              )}
            </div>
          </Card>

        </div>
      </section>
    </div>
  );
}
