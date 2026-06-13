import { useEffect, useState } from 'react';
import {
  History,
  Cpu,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Globe,
  Clock,
  Eye,
  Info,
  Calendar
} from 'lucide-react';
import { Card, Badge, Button, Loader, Table, Pagination } from '../../components';
import api from '../../services/api.js';
import toast from 'react-hot-toast';

export default function AgentDecisionLogPage() {
  const [decisions, setDecisions] = useState([]);
  const [totalDecisions, setTotalDecisions] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [filters, setFilters] = useState({
    decisionType: '',
    outcome: '',
    mode: ''
  });
  
  // Expanded rows
  const [expandedRows, setExpandedRows] = useState({});

  const loadDecisions = async (page = 1) => {
    try {
      setIsLoading(true);
      
      let queryStr = `page=${page}&limit=15`;
      if (filters.decisionType) queryStr += `&decisionType=${filters.decisionType}`;
      if (filters.outcome) queryStr += `&outcome=${filters.outcome}`;
      if (filters.mode) queryStr += `&autonomousMode=${filters.mode === 'auto'}`;

      const res = await api.get(`/agent/decisions?${queryStr}`);
      setDecisions(res.data.items || []);
      setTotalDecisions(res.data.total || 0);
      setTotalPages(res.data.totalPages || 1);
      setCurrentPage(res.data.page || 1);
    } catch (err) {
      console.error('Failed to load decisions list', err);
      toast.error('Failed to load decision log audit trail.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDecisions(1);
  }, [filters]);

  const toggleRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({ decisionType: '', outcome: '', mode: '' });
  };

  const getSeverityColor = (sev) => {
    switch (Number(sev)) {
      case 5: return 'bg-red-500 text-white';
      case 4: return 'bg-orange-500 text-white';
      case 3: return 'bg-amber-500 text-slate-900';
      case 2: return 'bg-blue-500 text-white';
      default: return 'bg-slate-400 text-white';
    }
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-[var(--app-color-primary-soft)] text-[var(--app-color-primary)] flex items-center justify-center">
              <History size={16} />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Agent Decision Audit Log</h1>
          </div>
          <p className="text-sm text-slate-500">
            Explainable AI decision log: inspect reasons and outcomes for rights enforcement tasks.
          </p>
        </div>
      </header>

      {/* Filters Card */}
      <Card className="border-slate-200/60 bg-white shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            
            {/* Filter by Type */}
            <div className="flex flex-col min-w-44">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5">Decision Type</span>
              <select
                name="decisionType"
                value={filters.decisionType}
                onChange={handleFilterChange}
                className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-600 focus:border-[var(--app-color-primary)] focus:outline-none"
              >
                <option value="">All Types</option>
                <option value="violation_classified">Violation Classified</option>
                <option value="action_taken">Action Taken</option>
                <option value="scan_triggered">Scan Triggered</option>
                <option value="escalation">Escalation Triggered</option>
              </select>
            </div>

            {/* Filter by Mode */}
            <div className="flex flex-col min-w-40">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5">Agent Mode</span>
              <select
                name="mode"
                value={filters.mode}
                onChange={handleFilterChange}
                className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-600 focus:border-[var(--app-color-primary)] focus:outline-none"
              >
                <option value="">All Modes</option>
                <option value="auto">Autonomous Mode</option>
                <option value="manual">Manual Mode</option>
              </select>
            </div>

            {/* Filter by Outcome */}
            <div className="flex flex-col min-w-40">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5">Outcome Status</span>
              <select
                name="outcome"
                value={filters.outcome}
                onChange={handleFilterChange}
                className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-600 focus:border-[var(--app-color-primary)] focus:outline-none"
              >
                <option value="">All Outcomes</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
                <option value="skipped">Skipped</option>
              </select>
            </div>

          </div>

          <div className="flex items-center gap-2 self-end w-full md:w-auto mt-4 md:mt-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={clearFilters}
              className="h-9 px-4 rounded-xl text-xs font-bold bg-white border-slate-200 hover:bg-slate-50 w-full md:w-auto"
            >
              Reset filters
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => loadDecisions(1)}
              className="h-9 px-5 rounded-xl text-xs font-bold text-white shadow-md bg-[var(--app-color-primary)] hover:bg-[var(--app-color-primary-hover)] w-full md:w-auto"
            >
              Apply Filter
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Table Card */}
      <Card className="border-slate-200/60 bg-white shadow-sm overflow-hidden p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-8 h-8 text-[var(--app-color-primary)] animate-spin" />
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading audit trail...</p>
          </div>
        ) : decisions.length > 0 ? (
          <div className="overflow-x-auto lg:overflow-x-visible">
            <table className="w-full text-left text-sm border-separate border-spacing-0">
              <thead className="bg-slate-50/70">
                <tr>
                  <th className="w-8 px-4 py-3 border-b border-slate-100"></th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">Date/Time</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">Type</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">Action Recommended</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">Severity</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">Mode</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">Outcome</th>
                  <th className="px-4 py-3 text-right border-b border-slate-100">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {decisions.map((d) => {
                  const isExpanded = !!expandedRows[d._id];
                  return (
                    <>
                      <tr 
                        key={d._id} 
                        className={`group transition-colors hover:bg-slate-50/40 cursor-pointer ${isExpanded ? 'bg-slate-50/20' : ''}`}
                        onClick={() => toggleRow(d._id)}
                      >
                        <td className="px-4 py-4 text-center">
                          {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                        </td>
                        <td className="px-4 py-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                          {new Date(d.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-4 font-semibold text-xs text-slate-800 capitalize">
                          {d.decisionType.replace('_', ' ')}
                        </td>
                        <td className="px-4 py-4">
                          <span className="capitalize text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200/50 px-2.5 py-1 rounded-lg">
                            {d.action.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${getSeverityColor(d.meta?.severityResult?.severity || 3)}`}>
                            SEV {d.meta?.severityResult?.severity || 3}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant={d.autonomousMode ? 'primary' : 'secondary'} size="sm" className="font-bold uppercase tracking-wider text-xs px-2">
                            {d.autonomousMode ? 'Auto' : 'Manual'}
                          </Badge>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1 text-xs font-bold ${
                            d.outcome === 'success' ? 'text-green-600' :
                            d.outcome === 'failed' ? 'text-red-500' :
                            d.outcome === 'skipped' ? 'text-slate-400' : 'text-amber-500'
                          }`}>
                            {d.outcome === 'success' ? <CheckCircle size={14} /> :
                             d.outcome === 'failed' ? <XCircle size={14} /> :
                             d.outcome === 'skipped' ? <XCircle size={14} className="text-slate-400" /> : <Loader2 size={14} className="animate-spin text-amber-500" />}
                            <span className="uppercase text-xs tracking-wider">{d.outcome}</span>
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button 
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-[var(--app-color-primary)] transition-all"
                            onClick={(e) => { e.stopPropagation(); toggleRow(d._id); }}
                          >
                            <Eye size={14} />
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/20">
                          <td colSpan="8" className="px-8 py-5 border-b border-slate-100">
                            <div className="grid gap-6 md:grid-cols-2">
                              
                              {/* Reasoning */}
                              <div className="space-y-2.5">
                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                                  <Info size={13} className="text-[var(--app-color-primary)]" />
                                  Explainable Decision Reasoning
                                </h4>
                                <div className="rounded-xl border border-purple-100 bg-purple-50/30 p-4 leading-relaxed text-xs text-slate-700 font-medium border-l-4 border-l-[var(--app-color-primary)]">
                                  "{d.reasoning || 'No details provided'}"
                                </div>
                              </div>

                              {/* Technical Metadata */}
                              <div className="space-y-2.5">
                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                                  <Cpu size={13} className="text-[var(--app-color-primary)]" />
                                  Ecosystem Input Metrics
                                </h4>
                                <div className="rounded-xl border border-slate-200/60 bg-white p-4 font-mono text-xs text-slate-600 grid grid-cols-2 gap-y-3">
                                  <div>
                                    <span className="text-slate-400 block font-sans text-xs font-semibold uppercase tracking-wide">Input Confidence</span>
                                    <span className="font-semibold text-slate-800 text-xs">{d.input?.confidence || 0}%</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block font-sans text-xs font-semibold uppercase tracking-wide">Match Type</span>
                                    <span className="font-semibold text-slate-800 text-xs capitalize">{d.input?.matchType || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block font-sans text-xs font-semibold uppercase tracking-wide">Source Domain</span>
                                    <span className="font-semibold text-slate-800 text-xs truncate block max-w-[180px]" title={d.input?.domainReputation || 'N/A'}>
                                      {d.input?.domainReputation || 'N/A'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block font-sans text-xs font-semibold uppercase tracking-wide">Asset ID</span>
                                    <span className="font-semibold text-slate-800 text-xs">{d.assetId || 'N/A'}</span>
                                  </div>
                                </div>
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-24 text-center text-slate-400">
            <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-xs font-bold uppercase tracking-widest">No decisions logged match filters</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={loadDecisions}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
