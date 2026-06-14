import { useEffect, useState, useRef } from 'react';
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

import { Card, Badge, Button, Loader } from '../../components';
import api from '../../services/api.js';
import useAuthStore from '../../store/auth.store.js';
import { connectRealtime } from '../../services/realtime.js';

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
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-700 bg-emerald-50/50 text-xs uppercase font-extrabold tracking-widest px-2.5 py-0.5">Live Feed</Badge>
          </div>
          <p className="text-xs font-semibold text-slate-400">SOC operations panel for {user?.orgName || 'Piractrix Protection'}.</p>
        </div>

        <div className="flex items-center gap-2">
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
        
        {/* Left Column (2/3 width) - Active Leak Feed & coverage */}
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

          {/* Quick Actions Row */}
          <div className="grid grid-cols-3 gap-4">
            <Link to="/dashboard/scans" className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white rounded-2xl p-4 flex flex-col justify-between h-28 shadow-xs hover:scale-[1.02] active:scale-98 transition-all">
              <Activity className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Discovery Engine</p>
                <p className="text-xs font-extrabold mt-0.5">Inspect Scans</p>
              </div>
            </Link>
            <Link to="/dashboard/assets" className="bg-white border border-slate-200/60 hover:bg-slate-50 text-slate-800 rounded-2xl p-4 flex flex-col justify-between h-28 shadow-xs hover:scale-[1.02] active:scale-98 transition-all">
              <Layers className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Library Assets</p>
                <p className="text-xs font-extrabold mt-0.5">Protect Content</p>
              </div>
            </Link>
            <Link to="/dashboard/violations" className="bg-white border border-slate-200/60 hover:bg-slate-50 text-slate-800 rounded-2xl p-4 flex flex-col justify-between h-28 shadow-xs hover:scale-[1.02] active:scale-98 transition-all">
              <Shield className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Enforcement Cases</p>
                <p className="text-xs font-extrabold mt-0.5">Takedown Queue</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Right Column (1/3 width) - Live telemetry log & agent settings indicator */}
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
                  <span className={`h-2 w-2 rounded-full ${agentStatus.autonomousMode ? 'bg-violet-600 animate-pulse' : 'bg-slate-400'}`} />
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
                  <div className="flex items-center gap-2 text-slate-500 py-10">
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                    </span>
                    <span className="font-bold">PIRACTRIX ONLINE — Monitoring {data.stats.totalAssets} assets. No threats queued.</span>
                  </div>
                )}
              </div>
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

    </div>
  );
}
