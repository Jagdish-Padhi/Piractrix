import React, { useState, useEffect, useRef } from 'react';
import {
  Globe,
  ShieldAlert,
  Flame,
  Clock,
  ExternalLink,
  RefreshCw,
  Search,
  Layout,
  Network,
  Zap,
  ToggleLeft,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { Card, Button, Badge, Loader, Input, PageHeader } from '../../components';
import api from '../../services/api.js';

export default function ThreatGraphPage() {
  const [threats, setThreats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
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

  const toggleAutoEscalate = async (domain) => {
    try {
      const newAutoEscalate = !selectedNode.autoEscalate;
      // PATCH call to toggles
      await api.patch('/agent/mode', { domain, autoEscalate: newAutoEscalate });
      
      setSelectedNode(prev => ({ ...prev, autoEscalate: newAutoEscalate }));
      setThreats(prev => prev.map(t => t.domain === domain ? { ...t, autoEscalate: newAutoEscalate } : t));
      setNodes(prev => prev.map(n => n.id === domain ? { ...n, autoEscalate: newAutoEscalate } : n));
    } catch (err) {
      console.error('Failed to toggle auto escalate rule', err);
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

  const filteredThreats = threats.filter(t => 
    t.domain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full space-y-6 lg:space-y-8 animate-in fade-in duration-300 pb-12">
      <PageHeader
        title="Pirate Threat Graph"
        subtitle="Visualizing organizational relationships, infrastructure networks, and repeat offender domains."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_3fr_1.5fr]">
        
        {/* Domain Search Column */}
        <div className="space-y-4">
          <Card className="p-4 space-y-4 h-full flex flex-col">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Threat Domains</h3>
            
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search domains..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-purple-500 transition-colors"
              />
            </div>

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-10">
                <Loader size={0.5} />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 max-h-[400px] pr-1">
                {filteredThreats.length === 0 ? (
                  <div className="text-xs text-slate-400 text-center py-6">No threat domains found.</div>
                ) : (
                  filteredThreats.map((threat) => {
                    const colors = getThreatColor(threat.threatLevel);
                    return (
                      <button
                        key={threat.domain}
                        onClick={() => {
                          const matchedNode = nodes.find(n => n.id === threat.domain);
                          if (matchedNode) {
                            setSelectedNode(matchedNode);
                          }
                        }}
                        className={`w-full p-3 text-left rounded-xl border transition-all flex items-center justify-between hover:scale-[1.01] active:scale-99 ${
                          selectedNode?.id === threat.domain 
                            ? 'bg-purple-50 border-purple-200' 
                            : 'bg-white border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-slate-900 block truncate max-w-[130px]">
                            {threat.domain}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {threat.totalViolations} violations
                          </span>
                        </div>
                        <span className={`h-2.5 w-2.5 rounded-full ${colors.bg}`} />
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Network Graph Interactive Card */}
        <div className="space-y-4">
          <Card className="p-6 relative overflow-hidden flex flex-col bg-slate-950 border-none text-slate-100">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Network className="h-5 w-5 text-purple-400 animate-pulse" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Infrastructure Relationship Graph
                </span>
              </div>
              <Button 
                variant="secondary" 
                size="xs" 
                onClick={fetchThreatMemory} 
                className="bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 flex items-center gap-1.5"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Stabilize Graph</span>
              </Button>
            </div>

            {loading ? (
              <div className="h-[480px] flex flex-col items-center justify-center gap-4">
                <Loader size={0.8} />
                <p className="text-xs font-mono text-slate-400">Loading neural relationships...</p>
              </div>
            ) : (
              <div className="relative flex-1">
                {/* SVG Visualizer */}
                <svg
                  ref={svgRef}
                  width="100%"
                  height="450"
                  viewBox="0 0 800 500"
                  className="cursor-grab select-none"
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUpOrLeave}
                  onMouseLeave={handleMouseUpOrLeave}
                >
                  {/* Link connections */}
                  {links.map((link, idx) => {
                    const sourceNode = nodes.find(n => n.id === link.source);
                    const targetNode = nodes.find(n => n.id === link.target);
                    if (!sourceNode || !targetNode) return null;
                    return (
                      <line
                        key={idx}
                        x1={sourceNode.x}
                        y1={sourceNode.y}
                        x2={targetNode.x}
                        y2={targetNode.y}
                        stroke="#334155"
                        strokeWidth={link.value * 0.8 + 0.5}
                        strokeOpacity="0.45"
                      />
                    );
                  })}

                  {/* Domain nodes */}
                  {nodes.map((node) => {
                    const colors = getThreatColor(node.threatLevel);
                    const isSelected = selectedNode?.id === node.id;
                    return (
                      <g 
                        key={node.id}
                        transform={`translate(${node.x}, ${node.y})`}
                        className="transition-transform duration-75"
                      >
                        <circle
                          r={node.size}
                          fill={colors.fill}
                          stroke={isSelected ? '#ffffff' : colors.stroke}
                          strokeWidth={isSelected ? 3 : 1.5}
                          className="transition-all hover:scale-110 cursor-pointer filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
                          onMouseDown={(e) => handleMouseDown(e, node)}
                          onClick={() => setSelectedNode(node)}
                        />
                        <text
                          y={node.size + 14}
                          textAnchor="middle"
                          fill={isSelected ? '#ffffff' : '#94a3b8'}
                          className="text-[10px] font-semibold select-none font-mono"
                          pointerEvents="none"
                        >
                          {node.label.length > 20 ? node.label.substring(0, 17) + '...' : node.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Graph Legend overlay */}
                <div className="absolute bottom-4 left-4 p-3 bg-slate-900/95 border border-slate-800 rounded-xl flex flex-wrap gap-4 text-[10px] font-mono backdrop-blur-md">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    <span>Critical Threat</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-orange-500" />
                    <span>High Threat</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    <span>Medium Threat</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-sky-500" />
                    <span>Low Threat</span>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Selected Domain details sidebar panel */}
        <div className="space-y-4">
          {!selectedNode ? (
            <Card className="p-6 text-center space-y-4 h-full flex flex-col items-center justify-center min-h-[300px]">
              <Globe className="h-8 w-8 text-slate-300 animate-bounce" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-800">Select Threat Node</p>
                <p className="text-[10px] text-slate-400 max-w-xs">
                  Click on any node in the graph or list to inspect domain infrastructure, active platforms, and historical infringements.
                </p>
              </div>
            </Card>
          ) : (
            <Card className="p-5 space-y-5 h-full flex flex-col justify-between border-l-4 border-l-purple-500 animate-in slide-in-from-right duration-200">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Inspect Entity</span>
                    <h3 className="text-sm font-black text-slate-900 break-all">{selectedNode.id}</h3>
                  </div>
                  <Badge 
                    variant={
                      selectedNode.threatLevel === 'critical' ? 'danger' :
                      selectedNode.threatLevel === 'high' ? 'orange' :
                      selectedNode.threatLevel === 'medium' ? 'warning' : 'primary'
                    }
                  >
                    {selectedNode.threatLevel}
                  </Badge>
                </div>

                <div className="space-y-3 pt-3 border-t border-slate-100 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-400">Total Violations:</span>
                    <span className="font-bold text-slate-900">{selectedNode.violations}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-400">First Detected:</span>
                    <span className="font-mono text-slate-700">
                      {selectedNode.rawData.firstSeenAt 
                        ? new Date(selectedNode.rawData.firstSeenAt).toLocaleDateString() 
                        : 'N/A'}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-400">Last Active Seen:</span>
                    <span className="font-mono text-slate-700">
                      {selectedNode.rawData.lastSeenAt 
                        ? new Date(selectedNode.rawData.lastSeenAt).toLocaleDateString() 
                        : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Platform targets */}
                <div className="space-y-2 pt-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Platform Distribution</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedNode.platforms.map((platform, i) => (
                      <span 
                        key={i} 
                        className="px-2 py-1 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                      >
                        {platform}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Auto Escalate Rule */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Auto-Escalate Takedowns</span>
                    <input
                      type="checkbox"
                      checked={selectedNode.autoEscalate}
                      onChange={() => toggleAutoEscalate(selectedNode.id)}
                      className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    When enabled, any violation matches originating from {selectedNode.id} bypass the review queue and trigger direct DMCA requests immediately.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <a 
                  href={`https://who.is/whois/${selectedNode.id}`}
                  target="_blank" 
                  rel="noreferrer"
                  className="w-full text-xs font-bold py-2.5 text-center bg-white border border-slate-200 text-slate-800 rounded-xl hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Run External WHOIS lookup</span>
                </a>
              </div>

            </Card>
          )}
        </div>

      </div>
    </div>
  );
}
