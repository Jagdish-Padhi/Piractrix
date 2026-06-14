import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Zap, Activity, WifiOff, ChevronRight, CheckCircle } from 'lucide-react';
import api from '../services/api.js';
import useAuthStore from '../store/auth.store.js';
import { connectRealtime, getRealtimeSocket } from '../services/realtime.js';

export default function AgentStatusBar() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [autonomousMode, setAutonomousMode] = useState(false);
  const [lastAction, setLastAction] = useState(null);
  const [lastActionTime, setLastActionTime] = useState(null);
  const [queuedCount, setQueuedCount] = useState(0);
  const [channels, setChannels] = useState({ email: true, whatsapp: false, telegram: false, slack: false });
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');

  const fetchStatus = async () => {
    try {
      const res = await api.get('/agent/status');
      setAutonomousMode(res.data.autonomousMode || false);
      if (res.data.lastAction) {
        setLastAction(res.data.lastAction.action);
        setLastActionTime(new Date(res.data.lastAction.timestamp));
      }
      setQueuedCount(res.data.queuedDecisions || 0);
      if (res.data.channels) {
        setChannels(res.data.channels);
      }
    } catch (err) {
      console.warn('Failed to fetch agent status:', err.message);
    }
  };

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    const socket = connectRealtime(accessToken);
    if (!socket) return;

    setIsConnected(socket.connected);

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    const handleDecision = (payload) => {
      setIsProcessing(false);
      const { decision } = payload;
      if (!decision) return;
      if (decision.action) {
        setLastAction(decision.action);
        setLastActionTime(new Date());
      }
      // Re-fetch status to get updated queued numbers
      fetchStatus();
    };

    const handlePerception = (payload) => {
      setIsProcessing(true);
      setProcessingMsg(payload?.event?.triggeredBy || 'Updating scan frequencies...');
      setTimeout(() => setIsProcessing(false), 5000);
      fetchStatus();
    };

    const handleHeartbeat = () => {
      setIsConnected(true);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('agent:decision', handleDecision);
    socket.on('agent:perception', handlePerception);
    socket.on('agent:heartbeat', handleHeartbeat);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('agent:decision', handleDecision);
      socket.off('agent:perception', handlePerception);
      socket.off('agent:heartbeat', handleHeartbeat);
    };
  }, [accessToken]);

  // Format time ago
  const formatTime = () => {
    if (!lastActionTime) return '';
    const diff = Math.floor((new Date() - lastActionTime) / 60000);
    if (diff < 1) return 'Just now';
    if (diff === 1) return '1m ago';
    if (diff < 60) return `${diff}m ago`;
    return lastActionTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Render based on state
  if (!isConnected) {
    return (
      <div className="bg-red-50/90 border-b border-red-100 text-red-800 px-6 py-2.5 flex items-center justify-between text-xs font-bold transition-all duration-300 backdrop-blur-md sticky top-20 z-10">
        <div className="flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-red-500 animate-pulse" />
          <span className="uppercase tracking-wider">Agent Offline</span>
          <span className="font-medium text-red-600">WebSocket disconnected. Reconnecting...</span>
        </div>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="bg-amber-50/90 border-b border-amber-100 text-amber-800 px-6 py-2.5 flex items-center justify-between text-xs font-bold transition-all duration-300 backdrop-blur-md sticky top-20 z-10">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-amber-500 animate-pulse" />
          <span className="uppercase tracking-wider">Processing</span>
          <span className="font-medium text-amber-600">{processingMsg}</span>
        </div>
      </div>
    );
  }

  if (autonomousMode) {
    return (
      <div className="bg-violet-50/80 border-b border-violet-100 text-violet-900 px-6 py-2.5 flex items-center justify-between text-xs font-bold transition-all duration-300 backdrop-blur-md sticky top-20 z-10">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-600"></span>
            </span>
            <span className="uppercase tracking-widest text-violet-950 font-black">Piractrix Agent</span>
            <span className="bg-violet-600 text-white font-extrabold text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded">Autonomous</span>
          </div>
          <div className="hidden sm:block text-violet-700 font-medium border-l border-violet-200/60 pl-6">
            Last Action: <span className="font-extrabold text-violet-900 capitalize">{lastAction ? lastAction.replace('_', ' ') : 'None'}</span> {lastActionTime && `(${formatTime()})`}
          </div>
          <div className="hidden md:block text-violet-700 font-medium border-l border-violet-200/60 pl-6">
            Channels: <span className="text-violet-900 font-extrabold">{Object.entries(channels).filter(([_, v]) => v).map(([k]) => k.toUpperCase()).join(' • ') || 'None'}</span>
          </div>
        </div>
        <Link to="/dashboard/agent" className="flex items-center gap-1 text-violet-700 hover:text-violet-950 transition-colors uppercase tracking-wider text-[10px] font-black">
          Command Center <ChevronRight size={12} />
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-slate-50/90 border-b border-slate-200 text-slate-800 px-6 py-2.5 flex items-center justify-between text-xs font-bold transition-all duration-300 backdrop-blur-md sticky top-20 z-10">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-slate-400"></span>
          <span className="uppercase tracking-widest text-slate-950 font-black">Piractrix Agent</span>
          <span className="bg-slate-400 text-white font-extrabold text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded">Manual Approvals</span>
        </div>
        {queuedCount > 0 ? (
          <div className="text-amber-700 font-extrabold border-l border-slate-200 pl-6 animate-pulse">
            🚨 {queuedCount} decisions require approval
          </div>
        ) : (
          <div className="hidden sm:block text-slate-500 font-medium border-l border-slate-200 pl-6">
            No threats queued for approval. System idle.
          </div>
        )}
      </div>
      {queuedCount > 0 ? (
        <Link to="/dashboard/agent" className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-extrabold uppercase px-3 py-1 rounded-lg shadow-sm flex items-center gap-1 transition-all">
          Review Queue <ChevronRight size={12} />
        </Link>
      ) : (
        <Link to="/dashboard/agent" className="flex items-center gap-1 text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-wider text-[10px] font-black">
          Agent Settings <ChevronRight size={12} />
        </Link>
      )}
    </div>
  );
}
