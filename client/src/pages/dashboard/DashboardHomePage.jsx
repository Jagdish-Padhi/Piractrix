import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Activity,
  AlertTriangle,
  ChevronRight,
  Globe,
  Zap,
  Clock,
  ArrowUpRight,
  Play,
  Share2,
  Send,
  Layout,
  RefreshCw,
  FileText,
  Layers,
  Shield,
  MessageSquare
} from 'lucide-react';

import { Card, Badge, Button, Loader, Modal } from '../../components';
import api from '../../services/api.js';
import useAuthStore from '../../store/auth.store.js';
import { connectRealtime } from '../../services/realtime.js';
import toast from 'react-hot-toast';

export default function DashboardHomePage() {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const [data, setData] = useState({
    stats: { totalAssets: 0, activeScans: 0, violations: 0, alertsSent: 0, protectionScore: 100 },
    recentViolations: [],
    discoveryPulse: [],
    coverage: { youtube: 0, twitter: 0, telegram: 0, web: 0 }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [liveLogs, setLiveLogs] = useState([]);
  const [agentStatus, setAgentStatus] = useState({ autonomousMode: false, status: 'assisted', lastRun: null, heartbeat: null });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingModeValue, setPendingModeValue] = useState(false);

  const loadDashboardData = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      else setIsSyncing(true);

      const [dashRes, statusRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/agent/status')
      ]);

      setData({
        stats: dashRes.data.stats || { totalAssets: 0, activeScans: 0, violations: 0, alertsSent: 0, protectionScore: 100 },
        recentViolations: dashRes.data.recentViolations || [],
        discoveryPulse: dashRes.data.discoveryPulse || [],
        coverage: dashRes.data.coverage || { youtube: 0, twitter: 0, telegram: 0, web: 0 }
      });
      setAgentStatus(statusRes.data);
    } catch (err) {
      console.warn('Dashboard sync failed', err.message);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const pollInterval = setInterval(() => loadDashboardData(true), 30000);
    return () => clearInterval(pollInterval);
  }, []);

  // WebSockets for Real-Time telemetry
  useEffect(() => {
    if (!accessToken) return;
    const socket = connectRealtime(accessToken);
    if (!socket) return;

    socket.on('agent:decision', (payload) => {
      const { decision } = payload;
      if (!decision) return;
      
      setLiveLogs(prev => [{
        id: decision.logId || Date.now(),
        platform: decision.trace?.platform || decision.input?.platform || 'web',
        text: decision.trace?.cascadeStages
          ? `[CASCADE] Stage 3 passed — ${decision.trace?.classifierResult?.severity ? `SEV ${decision.trace.classifierResult.severity}` : 'classified'}`
          : (decision.reasoning?.slice(0, 90) || 'Agent decision processed'),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        action: decision.action,
        severity: decision.trace?.classifierResult?.severity || null,
        isReal: true,
      }, ...prev].slice(0, 6));

      // Refresh stats
      loadDashboardData(true);
    });

    socket.on('agent:perception', (payload) => {
      if (!payload?.event) return;
      setLiveLogs(prev => [{
        id: Date.now(),
        platform: 'PERCEPTION',
        text: payload.event.triggeredBy || 'Asset scan frequency updated',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        action: 'perception_change',
        isPerception: true,
      }, ...prev].slice(0, 6));
      
      loadDashboardData(true);
    });

    return () => {
      socket.off('agent:decision');
      socket.off('agent:perception');
    };
  }, [accessToken]);

  const getPlatformIcon = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'youtube': return <Play size={14} className="text-red-500 fill-red-500" />;
      case 'twitter': return <Share2 size={14} className="text-slate-900" />;
      case 'telegram': return <MessageSquare size={14} className="text-sky-500" />;
      default: return <Globe size={14} className="text-slate-400" />;
    }
  };

  const getLogColor = (log) => {
    if (log.isPerception) return 'text-violet-400';
    if (log.severity >= 4) return 'text-red-400 font-bold';
    return 'text-slate-300';
  };

  const handleToggleModeClick = () => {
    setPendingModeValue(!agentStatus.autonomousMode);
    setIsModalOpen(true);
  };

  const confirmToggleMode = async () => {
    setIsModalOpen(false);
    setIsSyncing(true);
    try {
      await api.patch('/agent/mode', { mode: pendingModeValue });
      setAgentStatus(prev => ({ ...prev, autonomousMode: pendingModeValue }));
      toast.success(
        pendingModeValue
          ? 'Autonomous Mode activated. ShieldAgent is live.'
          : 'Autonomous Mode disabled. Manual review loop active.'
      );
      window.dispatchEvent(new CustomEvent('piractrix:agent:mode-changed'));
    } catch (err) {
      toast.error('Failed to update agent mode.');
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <Loader size={0.7} />
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400 animate-pulse">Syncing Security Operations...</p>
      </div>
    );
  }

  return (
    <div className='w-full space-y-6 lg:space-y-8 animate-in fade-in duration-500 select-none'>
      
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Security Command Center</h1>
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest bg-emerald-950/80 border border-emerald-500/30 rounded-full text-emerald-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
              </span>
              Live Feed
            </div>
          </div>
          <p className="text-xs font-semibold text-slate-400">SOC operations panel for {user?.orgName || 'Piractrix Protection'}.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Autonomous Mode Toggle */}
          <div className={`flex items-center gap-2.5 border px-3.5 py-1.5 rounded-xl transition-all duration-300 ${
            agentStatus.autonomousMode 
              ? 'bg-purple-50/20 border-purple-500/40 shadow-[0_0_12px_rgba(147,51,234,0.15)]' 
              : 'bg-slate-50 border-slate-200/80 shadow-xs'
          }`}>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Autonomous Shield</span>
            <button
              onClick={handleToggleModeClick}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                agentStatus.autonomousMode ? 'bg-purple-600 shadow-[0_0_8px_#8b5cf6]' : 'bg-slate-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  agentStatus.autonomousMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => loadDashboardData(true)}
            className="h-9 px-4 rounded-xl text-xs font-bold bg-white border-slate-200 hover:bg-slate-50 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            as={Link}
            to="/dashboard/analytics"
            variant="secondary"
            size="sm"
            className="h-9 px-4 rounded-xl text-xs font-bold bg-white border-slate-200 hover:bg-slate-50 transition-all cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 mr-2" />
            Reports
          </Button>
        </div>
      </header>

      {/* Stats Cards Row */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Ecosystem Health', value: `${data.stats.protectionScore}%`, icon: Zap, bg: 'bg-emerald-50 text-emerald-600', color: 'from-emerald-500 to-teal-600' },
          { label: 'Active Leaks', value: data.stats.violations, icon: AlertTriangle, bg: 'bg-red-50 text-red-600', color: 'from-red-500 to-rose-600' },
          { label: 'Protected Content', value: data.stats.totalAssets, icon: Layers, bg: 'bg-purple-50 text-purple-600', color: 'from-purple-500 to-indigo-600' },
          { label: 'Enforced Timelines', value: data.stats.alertsSent, icon: Shield, bg: 'bg-blue-50 text-blue-600', color: 'from-blue-500 to-sky-600' }
        ].map((item) => (
          <div key={item.label} className="relative overflow-hidden bg-white rounded-2xl border border-slate-200/60 p-5 shadow-xs flex items-center justify-between group transition-all duration-300 hover:shadow-md hover:-translate-y-1">
            <div className="space-y-1.5 z-10">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">{item.label}</span>
              <span className="font-mono text-3xl font-black text-slate-900 tracking-tight">{item.value}</span>
            </div>
            <div className={`p-3 rounded-2xl ${item.bg} group-hover:scale-105 transition-transform z-10`}>
              <item.icon className="w-5 h-5" />
            </div>
            {/* Soft decorative background glow */}
            <div className="absolute right-0 bottom-0 w-24 h-24 bg-slate-50 rounded-full translate-x-8 translate-y-8 group-hover:scale-110 transition-transform -z-0" />
          </div>
        ))}
      </section>

      {/* Main split dashboard view */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (2/3 width) - Active Leak Feed & Telemetry */}
        <div className="lg:col-span-2 space-y-6">
          <Card
            className="border-slate-200/60 bg-white shadow-xs"
            title="Real-Time Active Leaks"
            subtitle="Confidence-verified copyright infringements identified on active streams."
            headerAction={
              <Link to="/dashboard/violations" className="text-xs font-bold text-purple-600 hover:underline flex items-center gap-0.5">
                Manage Cases <ChevronRight size={14} />
              </Link>
            }
          >
            <div className="divide-y divide-slate-100">
              {data.recentViolations.slice(0, 5).map((v) => (
                <div key={v._id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0 hover:bg-slate-50/40 px-2 rounded-xl transition-colors">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="h-9 w-9 rounded-xl bg-slate-100 border border-slate-200/50 flex items-center justify-center shrink-0">
                      {getPlatformIcon(v.platform)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate max-w-[200px] sm:max-w-[320px]">{v.assetId?.title || 'Exclusive Protected Content'}</p>
                      <a href={v.sourceUrl} target="_blank" rel="noreferrer" className="text-[10px] text-purple-600 font-mono block truncate max-w-[200px] sm:max-w-[320px] hover:underline mt-0.5">{v.sourceUrl}</a>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={v.matchConfidence >= 80 ? 'danger' : 'warning'} className="font-mono text-[10px] font-bold px-2 py-0.5">
                      {v.matchConfidence}% Match
                    </Badge>
                    <Link to={`/dashboard/violations/${v._id}`} className="text-slate-400 hover:text-purple-600 transition-colors p-1" title="Review Case">
                      <ArrowUpRight size={16} />
                    </Link>
                  </div>
                </div>
              ))}
              {data.recentViolations.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-xs font-semibold">
                  <ShieldCheck className="w-10 h-10 text-emerald-500/20 mx-auto mb-2" />
                  No active leaks in current cycle. Shield online.
                </div>
              )}
            </div>
          </Card>

          {/* Telemetry Terminal */}
          <Card
            className="border-slate-200/60 bg-white shadow-xs"
            title="Discovery Telemetry"
            subtitle="Live audit signatures of agent brain activity."
          >
            <div className="relative overflow-hidden h-[180px] rounded-xl bg-slate-950 border border-slate-900 p-3">
              <div className="space-y-1.5 flex flex-col justify-end h-full overflow-y-auto scrollbar-none font-mono text-[10px]">
                {liveLogs.length > 0 ? (
                  liveLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2 border-b border-slate-900/60 pb-1.5 last:border-0 last:pb-0 animate-in slide-in-from-bottom-1 fade-in duration-200">
                      <span className="text-slate-500 shrink-0">{log.time}</span>
                      <span className="text-purple-400 uppercase font-bold shrink-0">[{log.platform}]</span>
                      <span className={`truncate ${getLogColor(log)}`}>{log.text}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center h-full py-10">
                    <div className="flex items-center gap-2.5 bg-slate-900 px-4 py-2 rounded-xl border border-slate-800 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500 shadow-[0_0_8px_#a855f7]"></span>
                      </span>
                      <span className="font-bold text-slate-300 tracking-wide">PIRACTRIX ONLINE — Monitoring {data.stats.totalAssets} assets. No threats queued.</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column (1/3 width) - Agent status and platform distribution */}
        <div className="space-y-6">
          
          {/* Agent Status Widget */}
          <Card
            className="border-slate-200/60 bg-white shadow-xs"
            title="Agent Integration"
            subtitle="ShieldAgent configurations status."
          >
            <div className="space-y-3.5">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${agentStatus.autonomousMode ? 'animate-ping bg-violet-400' : ''}`}></span>
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${agentStatus.autonomousMode ? 'bg-violet-500 shadow-[0_0_10px_#8b5cf6]' : 'bg-slate-400'}`}></span>
                  </span>
                  <span className="text-xs font-bold text-slate-800">Defense Status</span>
                </div>
                <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded ${agentStatus.autonomousMode ? 'bg-violet-100 text-violet-800' : 'bg-slate-200 text-slate-600'}`}>
                  {agentStatus.autonomousMode ? 'Autonomous' : 'Assisted'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs px-2">
                <span className="text-slate-400 font-bold">Decision Cycle:</span>
                <span className="font-mono text-slate-600 font-bold">5 Min Interval</span>
              </div>
              <div className="flex items-center justify-between text-xs px-2 pb-1 border-b border-slate-100">
                <span className="text-slate-400 font-bold">Protected Scope:</span>
                <span className="font-mono text-slate-600 font-bold">{data.stats.totalAssets} Asset Profiles</span>
              </div>
              <Link to="/dashboard/agent" className="block text-center bg-slate-100 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900 font-bold uppercase tracking-widest text-[9px] py-3 rounded-xl transition-all">
                Access Agent Settings
              </Link>
            </div>
          </Card>

          {/* Platform coverage */}
          <Card
            className="border-slate-200/60 bg-white shadow-xs"
            title="Platform Distribution"
            subtitle="Violation matches across index databases."
          >
            <div className="space-y-2.5">
              {[
                { name: 'YouTube', val: data.coverage.youtube || 0, color: 'bg-red-500', bar: 'bg-red-100', icon: Play },
                { name: 'Twitter / X', val: data.coverage.twitter || 0, color: 'bg-slate-900', bar: 'bg-slate-100', icon: Share2 },
                { name: 'Telegram', val: data.coverage.telegram || 0, color: 'bg-sky-500', bar: 'bg-sky-100', icon: Send },
                { name: 'Global Web', val: data.coverage.web || 0, color: 'bg-teal-500', bar: 'bg-teal-100', icon: Globe }
              ].map((p) => {
                const total = Object.values(data.coverage).reduce((a, b) => a + b, 0) || 1;
                const percentage = Math.round((p.val / total) * 100);
                return (
                  <div key={p.name} className="space-y-1">
                    <div className="flex justify-between items-center text-xs text-slate-500">
                      <span className="font-bold flex items-center gap-1.5">
                        <p.icon size={12} className={p.color.replace('bg-', 'text-')} />
                        {p.name}
                      </span>
                      <span className="font-mono font-bold text-slate-800">{p.val} leaks ({percentage}%)</span>
                    </div>
                    <div className={`h-1.5 w-full ${p.bar} rounded-full overflow-hidden`}>
                      <div className={`h-full ${p.color} rounded-full`} style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={pendingModeValue ? "Activate Autonomous Mode?" : "Deactivate Autonomous Mode?"}
        size="md"
        footer={
          <div className="flex w-full gap-3 justify-end">
            <Button
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold border-slate-200 hover:bg-slate-50 transition-all cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmToggleMode}
              className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer ${
                pendingModeValue 
                  ? 'bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-600/20' 
                  : 'bg-red-600 hover:bg-red-700 shadow-md shadow-red-600/20'
              }`}
            >
              {pendingModeValue ? 'Confirm Activation' : 'Confirm Deactivation'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className={`p-4 rounded-2xl border flex gap-3.5 items-start ${
            pendingModeValue 
              ? 'bg-purple-50/50 border-purple-100 text-purple-900' 
              : 'bg-amber-50/50 border-amber-100 text-amber-900'
          }`}>
            <div className={`p-2 rounded-xl shrink-0 ${
              pendingModeValue ? 'bg-purple-100 text-purple-600' : 'bg-amber-100 text-amber-600'
            }`}>
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase tracking-wider">
                {pendingModeValue ? 'Safety & Liability Warning' : 'Response Delay Notice'}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                {pendingModeValue 
                  ? 'Autonomous Mode authorizes Piractrix ShieldAgent to issue legal takedown requests automatically. Ensure your whitelists are fully up-to-date.'
                  : 'Manual approval overrides the automated defense grid. Any new infringements discovered will remain online until explicitly reviewed.'}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">System Consequences:</h3>
            <ul className="space-y-2.5">
              {pendingModeValue ? (
                <>
                  <li className="flex gap-2.5 text-xs text-slate-600 font-semibold items-start">
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                    <span><strong>No Human Verification:</strong> Actions are fired instantly upon confidence thresholds match.</span>
                  </li>
                  <li className="flex gap-2.5 text-xs text-slate-600 font-semibold items-start">
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                    <span><strong>Immediate Webhook Notice:</strong> Takedowns are transmitted live to Twilio, Telegram, or Slack.</span>
                  </li>
                  <li className="flex gap-2.5 text-xs text-slate-600 font-semibold items-start">
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                    <span><strong>Automatic Case Management:</strong> Case timelines and DMCA drafts will be logged as executed.</span>
                  </li>
                </>
              ) : (
                <>
                  <li className="flex gap-2.5 text-xs text-slate-600 font-semibold items-start">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <span><strong>Review Queue Hold:</strong> Inbound infringements will sit in the command queue.</span>
                  </li>
                  <li className="flex gap-2.5 text-xs text-slate-600 font-semibold items-start">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <span><strong>Manual Compliance Burden:</strong> Compliance officers must manually review and dispatch each case.</span>
                  </li>
                  <li className="flex gap-2.5 text-xs text-slate-600 font-semibold items-start">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <span><strong>Ecosystem Threat Exposure:</strong> Leaks will persist until an admin approves actions.</span>
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>
      </Modal>
    </div>
  );
}
