import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  ExternalLink,
  RefreshCw,
  Search,
  Network,
  ToggleLeft,
  AlertTriangle
} from 'lucide-react';
import { Card, Button, Badge, Loader } from '../../components';
import toast from 'react-hot-toast';
import api from '../../services/api.js';

const threatMeta = {
  critical: {
    label: 'Critical',
    badge: 'danger',
    tone: 'text-rose-500',
    dot: 'bg-rose-500',
    panel: 'border-rose-500/20 bg-rose-500/10',
    recommendation: 'Escalate immediately. This domain is a priority for takedown and legal review.',
  },
  high: {
    label: 'High',
    badge: 'orange',
    tone: 'text-orange-500',
    dot: 'bg-orange-500',
    panel: 'border-orange-500/20 bg-orange-500/10',
    recommendation: 'Queue for enforcement. Review platforms, related domains, and ownership evidence.',
  },
  medium: {
    label: 'Medium',
    badge: 'warning',
    tone: 'text-amber-500',
    dot: 'bg-amber-500',
    panel: 'border-amber-500/20 bg-amber-500/10',
    recommendation: 'Monitor closely. Keep the domain under observation and watch for cluster expansion.',
  },
  low: {
    label: 'Low',
    badge: 'primary',
    tone: 'text-sky-500',
    dot: 'bg-sky-500',
    panel: 'border-sky-500/20 bg-sky-500/10',
    recommendation: 'Track passively. Continue learning from the network and wait for stronger signals.',
  },
};

const getThreatMeta = (level) => threatMeta[level?.toLowerCase()] || threatMeta.low;

const formatDate = (value) => {
  if (!value) return 'N/A';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';

  return date.toLocaleDateString();
};

export default function ThreatGraphPage() {
  const [threats, setThreats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [sortBy, setSortBy] = useState('risk');
  const [showOnlyConnected, setShowOnlyConnected] = useState(false);
  
  // Custom force-directed simulation positions
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  
  const simulationRef = useRef(null);
  const svgRef = useRef(null);
  const draggingNodeRef = useRef(null);

  useEffect(() => {
    fetchThreatMemory();
    return () => {
      if (simulationRef.current) cancelAnimationFrame(simulationRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchThreatMemory = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/agent/threat-memory?limit=100');
      const items = data.items || [];
      setThreats(items);
      initializeSimulation(items);
    } catch (err) {
      console.error('Failed to fetch threat memory', err);
    } finally {
      setLoading(false);
    }
  };

  const initializeSimulation = (items) => {
    const width = 800;
    const height = 500;

    // Create unique nodes
    const nodeMap = {};
    const simulatedNodes = items.map((item, index) => {
      // Position nodes in a circle initially
      const angle = (index / items.length) * 2 * Math.PI;
      const radius = 150 + Math.random() * 50;
      
      const node = {
        id: item.domain,
        label: item.domain,
        size: Math.max(12, Math.min(35, 8 + (item.totalViolations || 1) * 1.5)),
        threatLevel: item.threatLevel || 'low',
        violations: item.totalViolations || 0,
        platforms: item.platforms || [],
        autoEscalate: item.autoEscalate || false,
        x: width / 2 + radius * Math.cos(angle),
        y: height / 2 + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
        rawData: item
      };
      nodeMap[item.domain] = node;
      return node;
    });

    // Create links between domains that share similar platforms or are in relatedDomains list
    const simulatedLinks = [];
    for (let i = 0; i < simulatedNodes.length; i++) {
      const source = simulatedNodes[i];
      
      // 1. Link if domains share platforms
      for (let j = i + 1; j < simulatedNodes.length; j++) {
        const target = simulatedNodes[j];
        const commonPlatforms = source.platforms.filter(p => target.platforms.includes(p));
        if (commonPlatforms.length > 0) {
          simulatedLinks.push({
            source: source.id,
            target: target.id,
            value: commonPlatforms.length
          });
        }
      }

      // 2. Link from related domains in model
      const related = source.rawData.relatedDomains || [];
      related.forEach(relDomain => {
        if (nodeMap[relDomain]) {
          simulatedLinks.push({
            source: source.id,
            target: relDomain,
            value: 2
          });
        }
      });
    }

    setNodes(simulatedNodes);
    setLinks(simulatedLinks);

    // Start simulation loop
    let alpha = 1.0;
    const decay = 0.985;
    const gravity = 0.04;
    const repulsion = 120;
    const linkStrength = 0.05;

    const updatePhysics = () => {
      if (alpha < 0.01) {
        // Stop simulation loop when positions stabilize
        return;
      }

      setNodes(prevNodes => {
        if (prevNodes.length === 0) return prevNodes;
        
        // 1. Create a shallow copy of all node objects so we can safely mutate them
        const copiedNodes = prevNodes.map(n => ({ ...n }));
        
        // 2. Repulsion force between all nodes
        for (let i = 0; i < copiedNodes.length; i++) {
          const n1 = copiedNodes[i];
          for (let j = i + 1; j < copiedNodes.length; j++) {
            const n2 = copiedNodes[j];
            const dx = n2.x - n1.x;
            const dy = n2.y - n1.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            
            if (dist < 220) {
              const force = (repulsion / (dist * dist)) * alpha;
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;
              
              if (draggingNodeRef.current?.id !== n1.id) {
                n1.vx -= fx;
                n1.vy -= fy;
              }
              if (draggingNodeRef.current?.id !== n2.id) {
                n2.vx += fx;
                n2.vy += fy;
              }
            }
          }
        }

        // 3. Attraction force on link edges
        simulatedLinks.forEach(link => {
          const sNode = copiedNodes.find(n => n.id === link.source);
          const tNode = copiedNodes.find(n => n.id === link.target);
          if (!sNode || !tNode) return;

          const dx = tNode.x - sNode.x;
          const dy = tNode.y - sNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const desiredDist = 120;
          
          const force = (dist - desiredDist) * linkStrength * alpha;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (draggingNodeRef.current?.id !== sNode.id) {
            sNode.vx += fx;
            sNode.vy += fy;
          }
          if (draggingNodeRef.current?.id !== tNode.id) {
            tNode.vx -= fx;
            tNode.vy -= fy;
          }
        });

        // 4. Gravity pulling to center & boundary clamping
        return copiedNodes.map(node => {
          if (draggingNodeRef.current?.id === node.id) {
            return node;
          }
          
          // Pull to center
          const dxCenter = width / 2 - node.x;
          const dyCenter = height / 2 - node.y;
          node.vx += dxCenter * gravity;
          node.vy += dyCenter * gravity;

          // Apply velocity and drag friction
          node.x += node.vx * 0.45;
          node.y += node.vy * 0.45;
          node.vx *= decay;
          node.vy *= decay;

          // Contain within viewport bounds
          node.x = Math.max(50, Math.min(width - 50, node.x));
          node.y = Math.max(50, Math.min(height - 50, node.y));

          return node;
        });
      });

      alpha *= decay;
      simulationRef.current = requestAnimationFrame(updatePhysics);
    };

    if (simulationRef.current) cancelAnimationFrame(simulationRef.current);
    simulationRef.current = requestAnimationFrame(updatePhysics);
  };

  const getThreatColor = (level) => {
    switch (level?.toLowerCase()) {
      case 'critical': return { bg: 'bg-rose-500', fill: '#f43f5e', stroke: '#be123c' };
      case 'high': return { bg: 'bg-orange-500', fill: '#f97316', stroke: '#c2410c' };
      case 'medium': return { bg: 'bg-amber-500', fill: '#eab308', stroke: '#a16207' };
      default: return { bg: 'bg-sky-500', fill: '#0ea5e9', stroke: '#0369a1' };
    }
  };

  // Drag interaction handlers
  const handleMouseDown = (e, node) => {
    e.preventDefault();
    draggingNodeRef.current = node;
  };

  const handleMouseMove = (e) => {
    if (!draggingNodeRef.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setNodes(prevNodes => 
      prevNodes.map(node => {
        if (node.id === draggingNodeRef.current.id) {
          return {
            ...node,
            x,
            y,
            vx: 0,
            vy: 0
          };
        }
        return node;
      })
    );
  };

  const handleMouseUpOrLeave = () => {
    draggingNodeRef.current = null;
  };

  const activeNode = useMemo(() => nodes.find((node) => node.id === selectedNode?.id) || selectedNode, [nodes, selectedNode]);

  const connectedNodeIds = useMemo(() => {
    if (!activeNode) return new Set();

    const ids = new Set([activeNode.id]);
    links.forEach((link) => {
      if (link.source === activeNode.id) ids.add(link.target);
      if (link.target === activeNode.id) ids.add(link.source);
    });
    return ids;
  }, [activeNode, links]);

  const selectedThreat = useMemo(() => threats.find((threat) => threat.domain === activeNode?.id) || null, [activeNode, threats]);

  const networkStats = useMemo(() => {
    const uniquePlatforms = new Set();
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let autoEscalated = 0;

    threats.forEach((threat) => {
      (threat.platforms || []).forEach((platform) => uniquePlatforms.add(platform));

      const level = threat.threatLevel?.toLowerCase() || 'low';
      if (level === 'critical') critical += 1;
      else if (level === 'high') high += 1;
      else if (level === 'medium') medium += 1;
      else low += 1;

      if (threat.autoEscalate) autoEscalated += 1;
    });

    return {
      total: threats.length,
      uniquePlatforms: uniquePlatforms.size,
      critical,
      high,
      medium,
      low,
      autoEscalated,
    };
  }, [threats]);

  const filteredThreats = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const items = threats.filter((threat) => {
      const matchesQuery = !query || threat.domain.toLowerCase().includes(query);
      const matchesLevel = levelFilter === 'all' || threat.threatLevel?.toLowerCase() === levelFilter;
      const matchesConnection = !showOnlyConnected || !activeNode || connectedNodeIds.has(threat.domain);

      return matchesQuery && matchesLevel && matchesConnection;
    });

    return items.sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.lastSeenAt || b.firstSeenAt || 0) - new Date(a.lastSeenAt || a.firstSeenAt || 0);
      }

      if (sortBy === 'connections') {
        const aConnections = links.filter((link) => link.source === a.domain || link.target === a.domain).length;
        const bConnections = links.filter((link) => link.source === b.domain || link.target === b.domain).length;
        return bConnections - aConnections;
      }

      if (sortBy === 'violations') {
        return (b.totalViolations || 0) - (a.totalViolations || 0);
      }

      const levelRank = { critical: 0, high: 1, medium: 2, low: 3 };
      const rankDelta = (levelRank[a.threatLevel?.toLowerCase() || 'low'] ?? 3) - (levelRank[b.threatLevel?.toLowerCase() || 'low'] ?? 3);
      if (rankDelta !== 0) return rankDelta;

      return (b.totalViolations || 0) - (a.totalViolations || 0);
    });
  }, [activeNode, connectedNodeIds, levelFilter, links, searchQuery, showOnlyConnected, sortBy, threats]);

  const connectedThreats = useMemo(() => {
    if (!activeNode) return [];

    return threats.filter((threat) => connectedNodeIds.has(threat.domain) && threat.domain !== activeNode.id);
  }, [activeNode, connectedNodeIds, threats]);

  const selectedPlatforms = activeNode?.platforms || selectedThreat?.platforms || [];
  const responseMeta = getThreatMeta(activeNode?.threatLevel || selectedThreat?.threatLevel);

  const selectedContext = useMemo(() => {
    if (!activeNode) return null;

    const threatScore = Math.min(100, (activeNode.violations || 0) * 8 + connectedThreats.length * 6 + selectedPlatforms.length * 4 + (activeNode.autoEscalate ? 8 : 0));
    return {
      score: threatScore,
      relationshipCount: Math.max(0, connectedNodeIds.size - 1),
      recommendation: responseMeta.recommendation,
    };
  }, [activeNode, connectedThreats.length, connectedNodeIds.size, responseMeta.recommendation, selectedPlatforms.length]);

  const handleSelectThreat = (domain) => {
    const matchedNode = nodes.find((node) => node.id === domain);
    if (matchedNode) setSelectedNode(matchedNode);
  };

  const handleCopyDomain = async () => {
    if (!activeNode?.id) return;

    try {
      await navigator.clipboard.writeText(activeNode.id);
      toast.success('Domain copied to clipboard.');
    } catch {
      toast.error('Unable to copy domain.');
    }
  };

  const handleClearSelection = () => setSelectedNode(null);

  const toggleAutoEscalate = async (domain) => {
    try {
      const newAutoEscalate = !activeNode?.autoEscalate;
      await api.patch('/agent/mode', { domain, autoEscalate: newAutoEscalate });

      setSelectedNode((prev) => (prev && prev.id === domain ? { ...prev, autoEscalate: newAutoEscalate } : prev));
      setThreats((prev) => prev.map((threat) => (threat.domain === domain ? { ...threat, autoEscalate: newAutoEscalate } : threat)));
      setNodes((prev) => prev.map((node) => (node.id === domain ? { ...node, autoEscalate: newAutoEscalate } : node)));
    } catch (err) {
      console.error('Failed to toggle auto escalate rule', err);
    }
  };

  return (
    <div className="h-full min-h-0 overflow-hidden animate-in fade-in duration-300">
      <section className="grid h-full min-h-0 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)]">
        <Card className="flex min-h-0 flex-col overflow-hidden border-slate-200/80 bg-slate-950 p-0 text-slate-100 shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-2 text-slate-300">
              <Network className="h-5 w-5 text-violet-400" />
              <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-200">Live graph workspace</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={fetchThreatMemory} className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button variant="secondary" size="sm" onClick={handleClearSelection} className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10">
                Clear
              </Button>
            </div>
          </div>

          <div className="flex flex-1 min-h-0 flex-col px-4 py-4">
            <div className="relative flex-1 min-h-0 overflow-hidden rounded-[28px] border border-white/10 bg-[#050816] shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
              {loading ? (
                <div className="flex h-full items-center justify-center gap-4">
                  <Loader size={0.85} />
                  <p className="text-xs font-mono text-slate-400">Resolving threat relationships...</p>
                </div>
              ) : (
                <>
                  <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/75 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 backdrop-blur">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" />Critical</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-orange-500" />High</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />Medium</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-500" />Low</span>
                    <span className="hidden text-slate-400 lg:inline">Drag nodes. Click one to inspect its cluster.</span>
                  </div>

                  <div className="absolute inset-0">
                    <svg
                      ref={svgRef}
                      width="100%"
                      height="100%"
                      viewBox="0 0 960 620"
                      preserveAspectRatio="xMidYMid meet"
                      className="cursor-grab select-none"
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUpOrLeave}
                      onMouseLeave={handleMouseUpOrLeave}
                    >
                      <defs>
                        <radialGradient id="graphGlow" cx="50%" cy="45%" r="62%">
                          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.22" />
                          <stop offset="65%" stopColor="#0f172a" stopOpacity="0.04" />
                          <stop offset="100%" stopColor="#020617" stopOpacity="0" />
                        </radialGradient>
                      </defs>

                      <rect x="0" y="0" width="960" height="620" fill="url(#graphGlow)" opacity="0.75" />
                      <circle cx="480" cy="310" r="130" fill="none" stroke="#334155" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="8 10" />
                      <circle cx="480" cy="310" r="72" fill="#7c3aed" fillOpacity="0.08" stroke="#c4b5fd" strokeOpacity="0.2" />
                      <circle cx="480" cy="310" r="12" fill="#c4b5fd" fillOpacity="0.9" />

                      {links.map((link, idx) => {
                        const sourceNode = nodes.find((node) => node.id === link.source);
                        const targetNode = nodes.find((node) => node.id === link.target);
                        if (!sourceNode || !targetNode) return null;

                        const isHighlighted = !activeNode || connectedNodeIds.has(sourceNode.id) || connectedNodeIds.has(targetNode.id);

                        return (
                          <line
                            key={idx}
                            x1={sourceNode.x}
                            y1={sourceNode.y}
                            x2={targetNode.x}
                            y2={targetNode.y}
                            stroke={isHighlighted ? '#64748b' : '#1e293b'}
                            strokeWidth={link.value * 0.7 + 0.5}
                            strokeOpacity={isHighlighted ? '0.52' : '0.08'}
                          />
                        );
                      })}

                      {nodes.map((node) => {
                        const colors = getThreatColor(node.threatLevel);
                        const isSelected = activeNode?.id === node.id;
                        const isRelevant = !activeNode || connectedNodeIds.has(node.id);

                        return (
                          <g
                            key={node.id}
                            transform={`translate(${node.x}, ${node.y})`}
                            className="transition-transform duration-75"
                            opacity={isSelected ? 1 : isRelevant ? 0.96 : 0.2}
                          >
                            <circle
                              r={Math.max(node.size, 18)}
                              fill={colors.fill}
                              stroke={isSelected ? '#ffffff' : colors.stroke}
                              strokeWidth={isSelected ? 3 : 1.5}
                              className="cursor-pointer transition-all hover:scale-110 filter drop-shadow-[0_6px_18px_rgba(0,0,0,0.55)]"
                              onMouseDown={(e) => handleMouseDown(e, node)}
                              onClick={() => setSelectedNode(node)}
                            />
                            <circle
                              r={Math.max(node.size, 18) + 8}
                              fill="none"
                              stroke={isSelected ? '#ffffff' : 'transparent'}
                              strokeOpacity="0.16"
                              strokeWidth="1"
                            />
                            <text
                              y={Math.max(node.size, 18) + 16}
                              textAnchor="middle"
                              fill={isSelected ? '#ffffff' : '#94a3b8'}
                              className="text-[11px] font-semibold select-none font-mono"
                              pointerEvents="none"
                            >
                              {node.label.length > 20 ? `${node.label.substring(0, 17)}...` : node.label}
                            </text>
                          </g>
                        );
                      })}
                    </svg>

                    <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 backdrop-blur-md">
                      <div className="flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-200">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1"><span className="h-2 w-2 rounded-full bg-violet-400" />{networkStats.total} domains</span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1"><span className="h-2 w-2 rounded-full bg-emerald-400" />{Math.max(0, connectedNodeIds.size - 1)} connected</span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1"><span className="h-2 w-2 rounded-full bg-rose-400" />{networkStats.autoEscalated} auto</span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1"><span className="h-2 w-2 rounded-full bg-sky-400" />{networkStats.uniquePlatforms} platforms</span>
                      </div>
                      <p className="mt-2 text-[11px] leading-5 text-slate-400">
                        Select a domain to inspect its cluster. Drag nodes to reshape relationships and keep the graph in focus.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </Card>

        <Card className="flex min-h-0 flex-col overflow-hidden border-slate-200/80 bg-white/95 shadow-sm">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-900">Control rail</h3>
              <p className="mt-1 text-xs text-slate-500">Search, filter, inspect, and act on the current cluster.</p>
            </div>
            <Badge variant="secondary">{filteredThreats.length}</Badge>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 pr-4 scrollbar-thin">
            <div className="space-y-5">
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search domains..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {['all', 'critical', 'high', 'medium', 'low'].map((level) => {
                    const meta = level === 'all' ? null : getThreatMeta(level);
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setLevelFilter(level)}
                        className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                          levelFilter === level
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {level === 'all' ? 'All' : meta.label}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Sort by</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400"
                    >
                      <option value="risk">Risk</option>
                      <option value="violations">Violations</option>
                      <option value="connections">Connections</option>
                      <option value="recent">Recent</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowOnlyConnected((current) => !current)}
                    className={`flex h-full items-center justify-center rounded-xl border px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                      showOnlyConnected
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Connected only
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {loading ? (
                  <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-10">
                    <Loader size={0.55} />
                  </div>
                ) : filteredThreats.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-400">
                    No threat domains match the current filters.
                  </div>
                ) : (
                  filteredThreats.map((threat) => {
                    const meta = getThreatMeta(threat.threatLevel);
                    const isActive = activeNode?.id === threat.domain;
                    const connectionCount = links.filter((link) => link.source === threat.domain || link.target === threat.domain).length;

                    return (
                      <button
                        key={threat.domain}
                        type="button"
                        onClick={() => handleSelectThreat(threat.domain)}
                        className={`w-full rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm ${
                          isActive
                            ? 'border-indigo-300 bg-indigo-50/80 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{threat.domain}</p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              {threat.totalViolations || 0} violations · {connectionCount} links · {threat.platforms?.length || 0} platforms
                            </p>
                          </div>
                          <span className={`mt-1 h-3 w-3 rounded-full ${meta.dot}`} />
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Badge variant={meta.badge} size="sm">{meta.label}</Badge>
                          {threat.autoEscalate && <Badge variant="success" size="sm">Auto</Badge>}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className={`rounded-2xl border p-4 ${activeNode ? responseMeta.panel : 'border-slate-200 bg-slate-50'}`}>
                {activeNode ? (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Focused entity</p>
                        <h3 className="break-all text-lg font-black text-slate-900">{activeNode.id}</h3>
                      </div>
                      <Badge variant={responseMeta.badge}>{responseMeta.label}</Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-white/80 p-3 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Violations</p>
                        <p className="mt-1 text-xl font-black text-slate-900 tabular-nums">{activeNode.violations}</p>
                      </div>
                      <div className="rounded-xl bg-white/80 p-3 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Risk score</p>
                        <p className="mt-1 text-xl font-black text-slate-900 tabular-nums">{selectedContext?.score || 0}</p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 rounded-xl bg-white/80 p-3 shadow-sm text-sm text-slate-600">
                      <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                        <span>First detected</span>
                        <span className="font-mono text-slate-900">{formatDate(activeNode.rawData?.firstSeenAt)}</span>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                        <span>Last active</span>
                        <span className="font-mono text-slate-900">{formatDate(activeNode.rawData?.lastSeenAt)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span>Observed on</span>
                        <span className="font-mono text-slate-900">{selectedThreat?.platforms?.length || 0} platforms</span>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 rounded-xl bg-white/80 p-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Platforms</span>
                        <span className="text-xs font-semibold text-slate-500">{selectedPlatforms.length} targets</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedPlatforms.length === 0 ? (
                          <span className="text-sm text-slate-400">No platform metadata available.</span>
                        ) : (
                          selectedPlatforms.map((platform) => (
                            <span
                              key={platform}
                              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-700"
                            >
                              {platform}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">No selection</p>
                    <p className="text-sm leading-6 text-slate-500">
                      Choose a node to pin the inspector, reveal connected domains, and access enforcement actions.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Related domains</span>
                  <span className="text-xs font-semibold text-slate-500">{connectedThreats.length}</span>
                </div>
                <div className="space-y-2">
                  {connectedThreats.slice(0, 5).map((threat) => {
                    const meta = getThreatMeta(threat.threatLevel);
                    return (
                      <button
                        key={threat.domain}
                        type="button"
                        onClick={() => handleSelectThreat(threat.domain)}
                        className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                      >
                        <span className="min-w-0 truncate text-sm font-semibold text-slate-900">{threat.domain}</span>
                        <span className={`ml-3 h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} />
                      </button>
                    );
                  })}
                  {connectedThreats.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-400">
                      No direct neighbors detected yet.
                    </div>
                  )}
                </div>
              </div>

              {activeNode && (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Response actions</span>
                    <Button variant="secondary" size="sm" onClick={handleCopyDomain}>
                      Copy domain
                    </Button>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      variant={activeNode.autoEscalate ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => toggleAutoEscalate(activeNode.id)}
                      className="justify-center"
                    >
                      <ToggleLeft className="h-4 w-4" />
                      {activeNode.autoEscalate ? 'Auto escalation on' : 'Enable auto escalation'}
                    </Button>
                    <a
                      href={`https://who.is/whois/${activeNode.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50"
                    >
                      <ExternalLink className="h-4 w-4" />
                      WHOIS lookup
                    </a>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                      <AlertTriangle className={`h-4 w-4 ${responseMeta.tone}`} />
                      Recommended posture
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{selectedContext?.recommendation}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
