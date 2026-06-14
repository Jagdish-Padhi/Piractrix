import React, { useMemo, useState, useEffect, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
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

const normalizeStringList = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : String(entry).trim()))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
};

const normalizeThreatRecord = (item) => ({
  ...item,
  domain: typeof item?.domain === 'string' ? item.domain.trim().toLowerCase() : '',
  platforms: normalizeStringList(item?.platforms),
  relatedDomains: normalizeStringList(item?.relatedDomains),
});

const calculateThreatScore = (node, connectionCount) => {
  if (!node) return 0;
  let score = 0;
  // Violations (up to 40 points)
  score += Math.min(40, (node.violations || 0) * 4);
  // Connections (up to 30 points)
  score += Math.min(30, connectionCount * 5);
  // Platforms (up to 20 points)
  score += Math.min(20, (node.platforms?.length || 0) * 10);
  // Repeat Offender / Auto Escalate bonus
  if (node.autoEscalate) score += 10;
  
  return Math.min(100, score);
};

const generateAIExplanation = (node, connectionCount, score) => {
  if (!node) return [];
  const reasons = [];
  
  if (node.violations > 5) reasons.push(`Critical volume: ${node.violations} active violations`);
  else if (node.violations > 0) reasons.push(`Confirmed: ${node.violations} active violations`);
  
  if (node.platforms?.includes('telegram')) reasons.push('High-risk encrypted distribution (Telegram)');
  if (node.platforms?.length > 1) reasons.push(`Cross-platform syndication (${node.platforms.length} networks)`);
  
  if (connectionCount > 3) reasons.push(`Core hub sharing infrastructure with ${connectionCount} pirate domains`);
  else if (connectionCount > 0) reasons.push(`Linked to ${connectionCount} known threat vectors`);
  
  if (node.autoEscalate) reasons.push('Repeat offender flagged for auto-escalation');
  
  if (reasons.length === 0) reasons.push('Monitored for suspicious traffic spikes');
  
  return reasons;
};

export default function ThreatGraphPage() {
  const [threats, setThreats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [sortBy, setSortBy] = useState('risk');
  const [showOnlyConnected, setShowOnlyConnected] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (containerRef.current) {
      const observer = new ResizeObserver((entries) => {
        for (let entry of entries) {
          setDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height
          });
        }
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, []);

  useEffect(() => {
    fetchThreatMemory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchThreatMemory = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/agent/threat-memory?limit=100');
      const items = Array.isArray(data.items) ? data.items.map(normalizeThreatRecord).filter((item) => item.domain) : [];
      setThreats(items);
      initializeSimulation(items);
    } catch (err) {
      console.error('Failed to fetch threat memory', err);
      toast.error('Unable to load threat graph.');
      setThreats([]);
      setNodes([]);
      setLinks([]);
    } finally {
      setLoading(false);
    }
  };

  const initializeSimulation = (items) => {
    const safeItems = Array.isArray(items) ? items : [];

    if (safeItems.length === 0) {
      setNodes([]);
      setLinks([]);
      return;
    }

    const nodeMap = {};
    const platformMap = {};

    // 1. Create Domain nodes and tally Platforms
    const domainNodes = safeItems.map((item) => {
      const node = {
        id: item.domain,
        label: item.domain,
        size: Math.max(12, Math.min(35, 8 + (item.totalViolations || 1) * 1.5)),
        threatLevel: item.threatLevel || 'low',
        violations: item.totalViolations || 0,
        platforms: item.platforms || [],
        autoEscalate: item.autoEscalate || false,
        rawData: item,
        nodeType: 'domain'
      };
      nodeMap[item.domain] = node;

      node.platforms.forEach(platform => {
        if (!platformMap[platform]) platformMap[platform] = 0;
        platformMap[platform] += 1;
      });

      return node;
    });

    // 2. Create Platform Nodes
    const platformNodes = Object.keys(platformMap).map((platform) => ({
      id: `platform-${platform}`,
      label: platform.toUpperCase(),
      size: Math.max(20, Math.min(45, 15 + platformMap[platform] * 2)),
      threatLevel: 'platform',
      nodeType: 'platform',
      domainCount: platformMap[platform]
    }));

    const simulatedNodes = [...platformNodes, ...domainNodes];
    const simulatedLinks = [];
    const linkSet = new Set();

    const addLink = (sourceId, targetId, value, type) => {
      const pair = [sourceId, targetId].sort().join('::');
      if (!linkSet.has(pair)) {
        linkSet.add(pair);
        simulatedLinks.push({ source: sourceId, target: targetId, value, type });
      }
    };

    domainNodes.forEach((domainNode) => {
      // Link domain to its platforms
      domainNode.platforms.forEach((platform) => {
        addLink(domainNode.id, `platform-${platform}`, 1, 'Exploits Platform');
      });

      // Link to related domains
      const related = domainNode.rawData.relatedDomains || [];
      related.forEach((relDomain) => {
        if (nodeMap[relDomain]) {
          addLink(domainNode.id, relDomain, 2, 'Direct Relation');
        }
      });
    });

    setNodes(simulatedNodes);
    setLinks(simulatedLinks);
  };

  const getThreatColor = (level) => {
    switch (level?.toLowerCase()) {
      case 'critical': return { bg: 'bg-rose-500', fill: '#f43f5e', stroke: '#be123c' };
      case 'high': return { bg: 'bg-orange-500', fill: '#f97316', stroke: '#c2410c' };
      case 'medium': return { bg: 'bg-amber-500', fill: '#eab308', stroke: '#a16207' };
      case 'platform': return { bg: 'bg-slate-300', fill: '#e2e8f0', stroke: '#94a3b8' };
      default: return { bg: 'bg-sky-500', fill: '#0ea5e9', stroke: '#0369a1' };
    }
  };

  const activeNode = useMemo(() => nodes.find((node) => node.id === selectedNode?.id) || selectedNode, [nodes, selectedNode]);
  const highlightedNodeId = hoveredNodeId || activeNode?.id || null;

  const connectedNodeIds = useMemo(() => {
    if (!activeNode) return new Set();

    const ids = new Set([activeNode.id]);
    links.forEach((link) => {
      const srcId = typeof link.source === 'object' ? link.source.id : link.source;
      const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
      if (srcId === activeNode.id) ids.add(tgtId);
      if (tgtId === activeNode.id) ids.add(srcId);
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
        const getLinkNodeId = (n) => typeof n === 'object' ? n.id : n;
        const aConnections = links.filter((link) => getLinkNodeId(link.source) === a.domain || getLinkNodeId(link.target) === a.domain).length;
        const bConnections = links.filter((link) => getLinkNodeId(link.source) === b.domain || getLinkNodeId(link.target) === b.domain).length;
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

  const activeNodeConnections = useMemo(() => {
    if (!activeNode) return 0;
    return links.filter((link) => {
      const srcId = typeof link.source === 'object' ? link.source.id : link.source;
      const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
      return srcId === activeNode.id || tgtId === activeNode.id;
    }).length;
  }, [activeNode, links]);

  const activeNodeScore = calculateThreatScore(activeNode, activeNodeConnections);
  const activeNodeAI = generateAIExplanation(activeNode, activeNodeConnections, activeNodeScore);

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

  const handleClearSelection = () => {
    setSelectedNode(null);
    setHoveredNodeId(null);
  };

  const toggleAutoEscalate = async (domain) => {
    try {
      const newAutoEscalate = !activeNode?.autoEscalate;
      await api.patch('/agent/threat-memory/escalate', { domain, autoEscalate: newAutoEscalate });

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
            <div ref={containerRef} style={{ minHeight: '600px' }} className="relative flex-1 min-h-0 overflow-hidden rounded-[28px] border border-white/10 bg-[#050816] shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
              {loading ? (
                <div className="flex h-full items-center justify-center gap-4">
                  <Loader size={0.85} />
                  <p className="text-xs font-mono text-slate-400">Resolving threat relationships...</p>
                </div>
              ) : (
                <>
                  <div className="pointer-events-none absolute left-4 bottom-4 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/75 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 backdrop-blur">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" />Critical</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-orange-500" />High</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />Medium</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-500" />Low</span>
                    <span className="hidden text-slate-400 lg:inline border-l border-white/10 pl-2">Hubs = Platforms</span>
                  </div>

                    <div className="absolute inset-0 z-10 overflow-hidden">
                      {nodes.length > 0 && dimensions.width > 0 && (
                        <ForceGraph2D
                          width={dimensions.width}
                          height={dimensions.height || 600}
                          backgroundColor="rgba(0,0,0,0)"
                          graphData={{ nodes, links }}
                          nodeRelSize={1}
                          nodeVal={node => node.size}
                          nodeLabel=""
                          linkDirectionalParticles={2}
                          linkDirectionalParticleWidth={1.5}
                          d3VelocityDecay={0.3}
                          d3AlphaDecay={0.02}
                          onEngineStop={() => {}}
                          cooldownTicks={100}
                          nodeCanvasObject={(node, ctx, globalScale) => {
                            ctx.save();
                            const isSelected = activeNode?.id === node.id;
                            const isHovered = hoveredNodeId === node.id;
                            const isRelevant = !highlightedNodeId || connectedNodeIds.has(node.id);
                            const colors = getThreatColor(node.threatLevel);
                            
                            const size = Math.max(node.size, 18) / 3;

                            ctx.globalAlpha = isSelected || isHovered ? 1 : isRelevant ? 0.96 : 0.18;
                            
                            ctx.beginPath();
                            if (node.nodeType === 'platform') {
                              // Platform hubs look distinct
                              ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
                              ctx.fillStyle = isSelected ? '#ffffff' : colors.fill;
                              ctx.fill();
                              ctx.lineWidth = isSelected ? 3 / globalScale : 1.5 / globalScale;
                              ctx.strokeStyle = isSelected ? '#64748b' : colors.stroke;
                              ctx.stroke();

                              // Inner dot
                              ctx.beginPath();
                              ctx.arc(node.x, node.y, size * 0.4, 0, 2 * Math.PI, false);
                              ctx.fillStyle = '#64748b';
                              ctx.fill();
                            } else {
                              // Domain nodes
                              ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
                              ctx.fillStyle = colors.fill;
                              ctx.fill();
                              ctx.lineWidth = isSelected ? 2 / globalScale : 1 / globalScale;
                              ctx.strokeStyle = isSelected ? '#ffffff' : colors.stroke;
                              ctx.stroke();
                            }

                            if (isSelected || isHovered) {
                              ctx.beginPath();
                              ctx.arc(node.x, node.y, size + 4/globalScale, 0, 2 * Math.PI, false);
                              ctx.strokeStyle = '#ffffff';
                              ctx.globalAlpha = 0.3;
                              ctx.stroke();
                            }
                            
                            const fontSize = 11 / globalScale;
                            ctx.font = `600 ${fontSize}px monospace`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillStyle = isSelected ? '#ffffff' : '#94a3b8';
                            ctx.globalAlpha = isSelected || isHovered ? 1 : isRelevant ? 0.96 : 0.18;
                            const label = node.label.length > 20 ? `${node.label.substring(0, 17)}...` : node.label;
                            ctx.fillText(label, node.x, node.y + size + fontSize + 2/globalScale);
                            ctx.restore();
                          }}
                          linkCanvasObjectMode={() => 'after'}
                          linkCanvasObject={(link, ctx, globalScale) => {
                            const srcId = typeof link.source === 'object' ? link.source.id : link.source;
                            const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
                            const isHighlighted = !highlightedNodeId || connectedNodeIds.has(srcId) || connectedNodeIds.has(tgtId);
                            
                            if (isHighlighted && globalScale > 1.2 && link.type) {
                              const MAX_FONT_SIZE = 4;
                              const LABEL_NODE_MARGIN = 6;
                              const start = link.source;
                              const end = link.target;
                              if (typeof start !== 'object' || typeof end !== 'object') return;

                              const textPos = Object.assign(...['x', 'y'].map(c => ({
                                [c]: start[c] + (end[c] - start[c]) / 2
                              })));
                              const relLink = { x: end.x - start.x, y: end.y - start.y };
                              let textAngle = Math.atan2(relLink.y, relLink.x);
                              if (textAngle > Math.PI / 2) textAngle = -(Math.PI - textAngle);
                              if (textAngle < -Math.PI / 2) textAngle = -(-Math.PI - textAngle);

                              ctx.font = `${MAX_FONT_SIZE}px Sans-Serif`;
                              ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
                              ctx.save();
                              ctx.translate(textPos.x, textPos.y);
                              ctx.rotate(textAngle);
                              ctx.textAlign = 'center';
                              ctx.textBaseline = 'middle';
                              ctx.fillText(link.type, 0, -3);
                              ctx.restore();
                            }
                          }}
                          linkColor={link => {
                            const srcId = typeof link.source === 'object' ? link.source.id : link.source;
                            const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
                            const isHighlighted = !highlightedNodeId || connectedNodeIds.has(srcId) || connectedNodeIds.has(tgtId);
                            return isHighlighted ? 'rgba(100, 116, 139, 0.52)' : 'rgba(30, 41, 59, 0.08)';
                          }}
                          linkWidth={link => link.value * 0.7 + 0.5}
                          onNodeClick={node => {
                            handleSelectThreat(node.id);
                          }}
                          onNodeHover={node => setHoveredNodeId(node ? node.id : null)}
                          onBackgroundClick={() => handleClearSelection()}
                          d3Force={(d3ForceName, force) => {
                            if (d3ForceName === 'charge' && force) force.strength(-300);
                            if (d3ForceName === 'link' && force) force.distance(60);
                          }}
                        />
                      )}
                    </div>

                    {!loading && nodes.length === 0 && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8 text-center">
                        <div className="max-w-sm rounded-3xl border border-white/10 bg-slate-950/80 px-6 py-5 shadow-[0_20px_60px_rgba(2,6,23,0.45)] backdrop-blur">
                          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-300">Graph idle</p>
                          <p className="mt-2 text-sm leading-6 text-slate-400">
                            No normalized domain nodes were available to render. Check the threat-memory records feeding this view.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="pointer-events-none absolute inset-x-4 top-4 rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 backdrop-blur-md">
                      <div className="flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-200">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1"><span className="h-2 w-2 rounded-full bg-violet-400" />{networkStats.total} domains</span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1"><span className="h-2 w-2 rounded-full bg-emerald-400" />{Math.max(0, connectedNodeIds.size - 1)} connected</span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1"><span className="h-2 w-2 rounded-full bg-rose-400" />{networkStats.autoEscalated} auto</span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1"><span className="h-2 w-2 rounded-full bg-slate-400" />{networkStats.uniquePlatforms} platforms</span>
                      </div>
                      <p className="mt-2 text-[11px] leading-5 text-slate-400">
                        Select a domain or platform hub to inspect its cluster. Drag nodes to reshape relationships.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </Card>

        <Card className="flex min-h-0 flex-col overflow-hidden border-slate-200/80 bg-white/95 shadow-sm p-0">
          <div className="flex-none p-4 pb-3 border-b border-slate-100 bg-slate-50/50 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search domains..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-400"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {['all', 'critical', 'high', 'medium', 'low'].map((level) => {
                const meta = level === 'all' ? null : getThreatMeta(level);
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setLevelFilter(level)}
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] transition-colors ${
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

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <Badge variant="secondary" size="sm" className="font-mono">{filteredThreats.length} domains</Badge>
              <div className="flex items-center gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-600 outline-none focus:border-indigo-400 cursor-pointer"
                >
                  <option value="risk">Risk</option>
                  <option value="violations">Violations</option>
                  <option value="connections">Links</option>
                  <option value="recent">Recent</option>
                </select>
                <button
                  type="button"
                  onClick={() => setShowOnlyConnected((current) => !current)}
                  className={`flex items-center justify-center rounded-lg border px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] transition-colors ${
                    showOnlyConnected
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  Connected
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent overscroll-contain">

              <div className="space-y-2.5">
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
                        className={`w-full rounded-2xl border p-2.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm ${
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

                        <div className="mt-2.5 flex flex-nowrap items-center gap-1.5 overflow-hidden">
                          <Badge variant={meta.badge} size="sm">{meta.label}</Badge>
                          {threat.autoEscalate && <Badge variant="success" size="sm" className="whitespace-nowrap">Auto</Badge>}
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
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Threat score</p>
                        <div className="mt-1 flex items-baseline gap-1">
                          <p className="text-xl font-black text-slate-900 tabular-nums">{activeNodeScore}</p>
                          <p className="text-xs font-semibold text-slate-400">/100</p>
                        </div>
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

              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Related domains</span>
                  <span className="text-xs font-semibold text-slate-500">{connectedThreats.length}</span>
                </div>
                <div className="space-y-1.5">
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
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Response actions</span>
                    <Button variant="secondary" size="sm" onClick={handleCopyDomain} className="h-8 px-2.5 text-[11px]">
                      Copy domain
                    </Button>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      variant={activeNode.autoEscalate ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => toggleAutoEscalate(activeNode.id)}
                      className="h-9 justify-center px-3 text-xs"
                    >
                      <ToggleLeft className="h-4 w-4" />
                      {activeNode.autoEscalate ? 'Auto escalation on' : 'Enable auto escalation'}
                    </Button>
                    <a
                      href={`https://who.is/whois/${activeNode.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50"
                    >
                      <ExternalLink className="h-4 w-4" />
                      WHOIS lookup
                    </a>
                  </div>

                  <div className="rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50/50 to-white p-4 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 mb-3">
                      <AlertTriangle className="h-4 w-4" />
                      AI Analyst Reasoning
                    </div>
                    <ul className="space-y-2">
                      {activeNodeAI.map((reason, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-[13px] leading-5 text-slate-700">
                          <span className="mt-0.5 text-indigo-500 font-bold">✓</span>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
        </Card>
      </section>
    </div>
  );
}
