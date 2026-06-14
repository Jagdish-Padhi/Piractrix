import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import { 
	AlertTriangle, 
	CheckCircle, 
	Clock, 
	ExternalLink, 
	Eye, 
	Filter, 
	FolderOpen, 
	Gavel, 
	Globe, 
	ShieldCheck, 
	Sparkles, 
	Video, 
	Share2,
	MessageSquare,
	Search,
	ChevronRight,
	FileText,
	AlertCircle
} from 'lucide-react';
import { Badge, Button, Card, EmptyState, Loader, Modal, Pagination, Select } from '../../components';
import CaseTimeline from '../../components/CaseTimeline';
import DmcaPreviewDrawer from '../../components/DmcaPreviewDrawer';
import api from '../../services/api.js';

const statusFilters = ['', 'open', 'agent_reviewing', 'dmca_drafted', 'takedown_requested', 'resolved', 'false_positive'];
const platformFilters = ['', 'youtube', 'twitter', 'telegram', 'web'];
const statusOptions = ['open', 'agent_reviewing', 'dmca_drafted', 'dmca_sent', 'takedown_requested', 'resolved', 'false_positive'];

export default function DashboardViolationsPage() {
	const { violationId } = useParams();
	const [violations, setViolations] = useState([]);
	const [selectedViolation, setSelectedViolation] = useState(null);
	const [isDetailsOpen, setIsDetailsOpen] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState('');
	
	const [filters, setFilters] = useState({
		status: '',
		platform: '',
		minConfidence: 0,
		dmcaReadyOnly: false
	});

	const [pagination, setPagination] = useState({
		page: 1,
		limit: 10,
		totalPages: 1,
	});

	const [isDraftingDmca, setIsDraftingDmca] = useState(false);
	const [isDmcaDrawerOpen, setIsDmcaDrawerOpen] = useState(false);

	useEffect(() => {
		if (violationId) {
			openDetails(violationId);
		}
	}, [violationId]);

	const openCount = useMemo(() => violations.filter((item) => item.caseStatus === 'open').length, [violations]);

	const loadViolations = useCallback(async () => {
		try {
			setIsLoading(true);
			const response = await api.get('/violations', {
				params: {
					page: pagination.page,
					limit: pagination.limit,
					status: filters.status || undefined,
					platform: filters.platform || undefined,
					minConfidence: filters.minConfidence || undefined,
				},
			});

			let items = response.data.items || [];
			
			// Quick Filter: Show DMCA-ready only (match confidence >= 70 and not resolved/false positive)
			if (filters.dmcaReadyOnly) {
				items = items.filter(v => v.matchConfidence >= 70 && !['resolved', 'false_positive'].includes(v.caseStatus));
			}

			setViolations(items);
			setPagination((current) => ({
				...current,
				totalPages: response.data.totalPages || 1,
			}));
			setError('');
		} catch {
			setError('Unable to load violations right now.');
		} finally {
			setIsLoading(false);
		}
	}, [filters.minConfidence, filters.platform, filters.status, filters.dmcaReadyOnly, pagination.limit, pagination.page]);

	useEffect(() => {
		loadViolations();
	}, [loadViolations]);

	useEffect(() => {
		const handleGlobalDmcaOpen = (e) => {
			if (e.detail?.violationId) {
				openDetails(e.detail.violationId).then(() => {
					setIsDmcaDrawerOpen(true);
				});
			}
		};
		window.addEventListener('piractrix:open-dmca', handleGlobalDmcaOpen);
		return () => window.removeEventListener('piractrix:open-dmca', handleGlobalDmcaOpen);
	}, []);

	const openDetails = async (vId) => {
		try {
			const response = await api.get(`/violations/${vId}`);
			setSelectedViolation(response.data.violation || null);
			setIsDetailsOpen(true);
		} catch {
			toast.error('Unable to load violation evidence.');
		}
	};

	const updateStatus = async (vId, status) => {
		try {
			await api.patch(`/violations/${vId}/status`, { status });
			toast.success('Violation status updated.');

			if (selectedViolation?._id === vId) {
				// Re-fetch details to sync timelines
				const detailRes = await api.get(`/violations/${vId}`);
				setSelectedViolation(detailRes.data.violation);
			}

			await loadViolations();
		} catch {
			toast.error('Unable to update violation status.');
		}
	};

	const handleDraftDmca = async () => {
		if (!selectedViolation?._id) return;
		setIsDraftingDmca(true);
		try {
			// Trigger DMCA generation on backend
			await api.post(`/violations/${selectedViolation._id}/draft-dmca`);
			
			// Refresh local state
			const detailRes = await api.get(`/violations/${selectedViolation._id}`);
			setSelectedViolation(detailRes.data.violation);
			
			setIsDmcaDrawerOpen(true);
			toast.success('DMCA drafted successfully by Gemini.');
			await loadViolations();
		} catch (requestError) {
			const message = requestError.response?.data?.message || 'Failed to draft DMCA notice.';
			toast.error(message);
		} finally {
			setIsDraftingDmca(false);
		}
	};

	const handleFilterChange = (name, value) => {
		setFilters((current) => ({
			...current,
			[name]: value,
		}));
		setPagination((current) => ({
			...current,
			page: 1,
		}));
	};

	const getCaseStatusColor = (status) => {
		switch (status) {
			case 'open': return 'bg-slate-100 border-slate-200 text-slate-700';
			case 'agent_reviewing': return 'bg-violet-100 border-violet-200 text-violet-800';
			case 'dmca_drafted': return 'bg-amber-100 border-amber-200 text-amber-800';
			case 'dmca_sent': return 'bg-orange-100 border-orange-200 text-orange-800';
			case 'takedown_requested': return 'bg-blue-100 border-blue-200 text-blue-800';
			case 'resolved': return 'bg-green-100 border-green-200 text-green-800';
			case 'false_positive': return 'bg-red-100 border-red-200 text-red-800';
			default: return 'bg-slate-100 border-slate-200 text-slate-750';
		}
	};

	const getConfidenceColor = (val) => {
		if (val >= 80) return 'danger';
		if (val >= 60) return 'warning';
		if (val >= 30) return 'info';
		return 'secondary';
	};

	const getPlatformIcon = (platform) => {
		switch (platform?.toLowerCase()) {
			case 'youtube': return Video;
			case 'twitter': return Share2;
			case 'telegram': return MessageSquare;
			default: return Globe;
		}
	};

	return (
		<div className="space-y-6 animate-in fade-in duration-500">
			<div className="flex items-center justify-end gap-2 pb-2 border-b border-slate-200/60">
				<Badge variant="outline" className="font-bold border-red-250 bg-red-50 text-red-700">Open cases: {openCount}</Badge>
			</div>

			{/* Stats Row */}
			<section className="grid gap-6 sm:grid-cols-3">
				<Card className="border-slate-200/60 shadow-xs group hover:border-purple-500/50 transition-all duration-300 bg-white">
					<div className="flex items-center justify-between">
						<div className="space-y-1">
							<p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Listed</p>
							<p className="text-3xl font-black text-slate-900 tabular-nums">{violations.length}</p>
						</div>
						<div className="h-12 w-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
							<Gavel size={22} />
						</div>
					</div>
				</Card>
				<Card className="border-slate-200/60 shadow-xs group hover:border-red-500/50 transition-all duration-300 bg-white">
					<div className="flex items-center justify-between">
						<div className="space-y-1">
							<p className="text-xs font-bold uppercase tracking-wider text-slate-400">Open Cases</p>
							<p className="text-3xl font-black text-slate-900 tabular-nums">{openCount}</p>
						</div>
						<div className="h-12 w-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform">
							<FolderOpen size={22} />
						</div>
					</div>
				</Card>
				<Card className="border-slate-200/60 shadow-xs group hover:border-emerald-500/50 transition-all duration-300 bg-white">
					<div className="flex items-center justify-between">
						<div className="space-y-1">
							<p className="text-xs font-bold uppercase tracking-wider text-slate-400">Resolved Cases</p>
							<p className="text-3xl font-black text-slate-900 tabular-nums">
								{violations.filter((item) => item.caseStatus === 'resolved').length}
							</p>
						</div>
						<div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
							<ShieldCheck size={22} />
						</div>
					</div>
				</Card>
			</section>

			{/* Filter & Lists Block */}
			<Card
				className="border-slate-200/60 shadow-xs bg-white"
				title="Detected Violations"
				subtitle="Confidence-scored matches from active scanning pipelines."
			>
				{/* Filter Toolbar */}
				<div className="mb-6 grid gap-4 sm:grid-cols-5 items-end">
					<Select
						label="Status"
						value={filters.status}
						onChange={(event) => handleFilterChange('status', event.target.value)}
						options={statusFilters.map(s => ({
							label: s ? s.replace('_', ' ').charAt(0).toUpperCase() + s.replace('_', ' ').slice(1) : 'All statuses',
							value: s
						}))}
					/>
					<Select
						label="Platform"
						value={filters.platform}
						onChange={(event) => handleFilterChange('platform', event.target.value)}
						options={platformFilters.map(p => ({
							label: p ? p.charAt(0).toUpperCase() + p.slice(1) : 'All platforms',
							value: p
						}))}
					/>
					<div className="space-y-1">
						<label className="block text-xs font-semibold uppercase tracking-wider text-slate-450">Min confidence (%)</label>
						<input
							type="number"
							min="0"
							max="100"
							value={filters.minConfidence}
							onChange={(event) => handleFilterChange('minConfidence', Number(event.target.value || 0))}
							className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:border-purple-500 focus:bg-white focus:outline-none h-[42px] font-bold"
						/>
					</div>
					<div className="pb-0.5">
						<button
							onClick={() => handleFilterChange('dmcaReadyOnly', !filters.dmcaReadyOnly)}
							className={`w-full h-[42px] flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all cursor-pointer ${
								filters.dmcaReadyOnly 
									? 'bg-purple-100 border-purple-200 text-purple-800' 
									: 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
							}`}
						>
							<Sparkles size={14} className={filters.dmcaReadyOnly ? 'animate-pulse' : ''} />
							Show DMCA-Ready
						</button>
					</div>
					<div className="pb-0.5">
						<Button
							type="button"
							variant="secondary"
							fullWidth
							className="h-[42px] flex items-center justify-center gap-2 rounded-xl"
							onClick={() => {
								handleFilterChange('status', '');
								handleFilterChange('platform', '');
								handleFilterChange('minConfidence', 0);
								handleFilterChange('dmcaReadyOnly', false);
							}}
						>
							<Filter size={14} />
							Clear
						</Button>
					</div>
				</div>

				{/* Table Area */}
				{error ? (
					<p className="text-sm text-red-650 font-bold">{error}</p>
				) : isLoading ? (
					<div className="flex flex-col items-center justify-center py-12 gap-4 text-xs font-bold text-slate-400">
						<Loader size={0.6} />
						<p className="uppercase tracking-widest animate-pulse">Scanning database violations...</p>
					</div>
				) : violations.length === 0 ? (
					<EmptyState title="No violations found" message="Active threat scans will display detected violations here." />
				) : (
					<div className="overflow-x-auto lg:overflow-x-visible">
						<table className="min-w-full divide-y divide-slate-100 text-sm">
							<thead>
								<tr className="text-left text-xs font-extrabold uppercase tracking-wider text-slate-400">
									<th className="px-3 py-3">Case ID</th>
									<th className="px-3 py-3">Platform</th>
									<th className="px-3 py-3">Asset</th>
									<th className="px-3 py-3">Source URL</th>
									<th className="px-3 py-3">Match Confidence</th>
									<th className="px-3 py-3">Case Status</th>
									<th className="px-3 py-3 text-right"></th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{violations.map((item) => {
									const PlatformIcon = getPlatformIcon(item.platform);
									return (
										<tr key={item._id} className="hover:bg-slate-50/45 transition-colors group">
											{/* Case ID Link */}
											<td className="px-3 py-4 font-mono text-xs font-bold text-slate-700">
												<button 
													onClick={() => openDetails(item._id)}
													className="hover:text-purple-600 transition-colors hover:underline cursor-pointer"
												>
													{item.caseId || `PIR-${item._id.slice(-6).toUpperCase()}`}
												</button>
											</td>
											<td className="px-3 py-4">
												<div className="flex items-center gap-2">
													<div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-white transition-colors">
														<PlatformIcon size={14} />
													</div>
													<span className="font-bold capitalize text-slate-800">{item.platform}</span>
												</div>
											</td>
											<td className="px-3 py-4 font-bold text-slate-800 uppercase tracking-tight line-clamp-1">
												{item.assetId?.title || 'System Asset'}
											</td>
											<td className="px-3 py-4">
												<a href={item.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-800 font-bold hover:underline">
													Open Source <ExternalLink size={12} />
												</a>
											</td>
											<td className="px-3 py-4">
												<Badge variant={getConfidenceColor(Number(item.matchConfidence || 0))} className="font-mono font-bold tracking-wider px-2 py-0.5">
													{item.matchConfidence || 0}%
												</Badge>
											</td>
											<td className="px-3 py-4">
												<span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${getCaseStatusColor(item.caseStatus || 'open')}`}>
													<span className="h-1.5 w-1.5 rounded-full bg-current" />
													{(item.caseStatus || 'open').replace('_', ' ')}
												</span>
											</td>
											<td className="px-3 py-4 text-right">
												<button
													onClick={() => openDetails(item._id)}
													className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest text-purple-600 hover:bg-purple-50 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer"
												>
													<Eye size={13} /> Inspect
												</button>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}

				{pagination.totalPages > 1 && (
					<Pagination
						currentPage={pagination.page}
						totalPages={pagination.totalPages}
						hasPreviousPage={pagination.page > 1}
						hasNextPage={pagination.page < pagination.totalPages}
						onPageChange={(nextPage) => {
							setPagination((current) => ({
								...current,
								page: Math.min(Math.max(1, nextPage), Math.max(1, current.totalPages)),
							}));
						}}
						className="mt-6"
					/>
				)}
			</Card>

			{/* Details Modal */}
			<Modal
				isOpen={isDetailsOpen}
				onClose={() => setIsDetailsOpen(false)}
				title="Violation Case Review"
				size="5xl"
			>
				{selectedViolation ? (
					<div className="grid grid-cols-1 gap-6 lg:grid-cols-2 text-sm select-none">
						{/* Left Column: Timelines & Statuses */}
						<div className="space-y-5">
							{/* Case Stats */}
							<div className="grid gap-3 sm:grid-cols-2 font-sans">
								<div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
									<p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Match Rate</p>
									<p className="mt-1 text-xl font-black text-slate-900">{selectedViolation.matchConfidence}%</p>
								</div>
								<div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
									<p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Match Signature</p>
									<p className="mt-1 text-xl font-black capitalize text-slate-900">{selectedViolation.matchType}</p>
								</div>
							</div>

							{/* Case Timeline Component */}
							<CaseTimeline 
								violation={selectedViolation} 
								onOpenDmca={handleDraftDmca} 
							/>

							{/* Actions panel */}
							<div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
								<div className="flex items-center justify-between">
									<span className="text-xs uppercase font-extrabold text-slate-450 tracking-wider">Takedown Drafting</span>
									<button
										onClick={handleDraftDmca}
										disabled={isDraftingDmca}
										className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold uppercase tracking-widest text-[9px] py-2.5 px-4 rounded-xl flex items-center justify-center gap-1 shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
									>
										{isDraftingDmca ? <Loader size={0.3} className="text-white shrink-0" /> : <Sparkles size={12} className="animate-pulse" />}
										Draft Notice
									</button>
								</div>

								<div className="flex items-center justify-between border-t border-slate-150 pt-3">
									<span className="text-xs uppercase font-extrabold text-slate-450 tracking-wider">Manual Resolution</span>
									<div className="inline-flex gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200 select-none">
										{['open', 'reported', 'resolved'].map((status) => (
											<button
												key={status}
												onClick={() => updateStatus(selectedViolation._id, status)}
												className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
													selectedViolation.status === status 
													? 'bg-purple-600 text-white shadow-sm' 
													: 'text-slate-400 hover:text-slate-600 hover:bg-white/40'
												}`}
											>
												{status}
											</button>
										))}
									</div>
								</div>
							</div>
						</div>

						{/* Right Column: Evidence capture */}
						<div className="flex flex-col h-full bg-slate-900 border border-slate-950 rounded-2xl p-4 text-white">
							<h3 className="text-xs uppercase font-extrabold tracking-wider text-slate-400 mb-3 flex items-center gap-1">
								<Eye size={14} className="text-purple-400" />
								Captured Telemetry Screenshot
							</h3>
							{selectedViolation.screenshotUrl ? (
								<div className="flex min-h-[350px] flex-1 items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-slate-950 relative group">
									<img src={selectedViolation.screenshotUrl} alt="Infringement telemetry capture" className="max-h-[500px] max-w-full object-contain" />
								</div>
							) : (
								<div className="flex min-h-[350px] flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-850 bg-slate-950 p-6 text-slate-500 font-mono text-center gap-3">
									<AlertCircle size={24} className="text-slate-600 animate-pulse" />
									<span>Screenshot buffer missing from pipeline scans.</span>
								</div>
							)}
						</div>
					</div>
				) : (
					<p className="text-xs text-slate-400 font-semibold py-6 text-center">Select violation case to verify.</p>
				)}
			</Modal>

			{/* Dmca Notice Preview Drawer */}
			<DmcaPreviewDrawer 
				isOpen={isDmcaDrawerOpen}
				onClose={() => setIsDmcaDrawerOpen(false)}
				violation={selectedViolation}
				onUpdate={async () => {
					// Refresh violation in detail modal
					if (selectedViolation?._id) {
						const detailRes = await api.get(`/violations/${selectedViolation._id}`);
						setSelectedViolation(detailRes.data.violation);
					}
					await loadViolations();
				}}
			/>
		</div>
	);
}
