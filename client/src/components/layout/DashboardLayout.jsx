import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Badge from '../Badge';
import Button from '../Button';
import Container from '../Container';
import api from '../../services/api.js';
import { connectRealtime, disconnectRealtime } from '../../services/realtime.js';
import useAuthStore from '../../store/auth.store.js';
import useReportStore from '../../store/report.store.js';
import ReportGenerationModal from '../ReportGenerationModal';
import toast from 'react-hot-toast';

import {
	BarChart3,
	Bell,
	Building2,
	Layers,
	LogOut,
	Radar,
	ShieldAlert,
	Bot,
	History,
	Menu,
	X,
	ChevronLeft,
	ChevronRight
} from 'lucide-react';

const getBreadcrumbs = (pathname) => {
	const parts = pathname.split('/').filter(Boolean);
	if (parts.length === 0) return [{ label: 'Home', path: '/' }];
	
	const breadcrumbs = [];
	
	const segmentMap = {
		dashboard: 'Platform',
		assets: 'Asset Library',
		scans: 'Threat Discovery',
		'agent-log': 'Decision Log',
		analytics: 'Analytics & Reports',
		alerts: 'Alert Inbox',
		violations: 'Enforcement Queue',
	};

	let currentPath = '';
	parts.forEach((part, index) => {
		currentPath += `/${part}`;
		let label = segmentMap[part];
		if (!label) {
			if (/^[0-9a-fA-F]{24}$/.test(part) || part.length > 10) {
				label = `Detail: ${part.slice(-6).toUpperCase()}`;
			} else {
				label = part.charAt(0).toUpperCase() + part.slice(1);
			}
		}
		
		breadcrumbs.push({
			label,
			path: currentPath,
			isLast: index === parts.length - 1
		});
	});
	
	if (parts.length === 1 && parts[0] === 'dashboard') {
		return [
			{ label: 'Platform', path: '/dashboard' },
			{ label: 'Agent Center', path: '/dashboard', isLast: true }
		];
	}
	
	return breadcrumbs;
};

const routeMetadata = {
	'/dashboard': {
		title: 'Command Center',
		description: 'Autonomous Digital Rights Defense: streaming & leak vector control.',
	},
	'/dashboard/agent-log': {
		title: 'Agent Decision Log',
		description: 'Explainable AI audit trail: reasons, confidence levels, and legal actions.',
	},
	'/dashboard/assets': {
		title: 'Asset Library',
		description: 'Upload media files, manage core assets, and analyze content fingerprints.',
	},
	'/dashboard/scans': {
		title: 'Threat Discovery',
		description: 'Configure search criteria, schedule scans, and review platform results.',
	},
	'/dashboard/analytics': {
		title: 'Analytics & Reports',
		description: 'Track violation metrics, revenue-at-risk, and export PDF summaries.',
	},
	'/dashboard/alerts': {
		title: 'Alert Inbox',
		description: 'Real-time security notifications and urgent candidate matching logs.',
	},
	'/dashboard/violations': {
		title: 'Enforcement Queue',
		description: 'Verify copyright violations, draft notices, and track legal cases.',
	},
};

const getRouteMetadata = (pathname) => {
	if (routeMetadata[pathname]) {
		return routeMetadata[pathname];
	}
	if (pathname.startsWith('/dashboard/scans/')) {
		return {
			title: 'Scan Details',
			description: 'Deep-dive scan job diagnostics, matched candidates, and platform logs.',
		};
	}
	if (pathname.startsWith('/dashboard/violations/')) {
		return {
			title: 'Violation Case Review',
			description: 'Analyze captured match evidence, Hamming distance metrics, and draft DMCA notices.',
		};
	}
	return {
		title: 'Security Dashboard',
		description: 'Piractrix content protection system.',
	};
};

const routeIcons = {
	'/dashboard': Bot,
	'/dashboard/agent-log': History,
	'/dashboard/assets': Layers,
	'/dashboard/scans': Radar,
	'/dashboard/analytics': BarChart3,
	'/dashboard/alerts': Bell,
	'/dashboard/violations': ShieldAlert,
};

const getRouteIcon = (pathname) => {
	if (pathname.startsWith('/dashboard/scans/')) return Radar;
	if (pathname.startsWith('/dashboard/violations/')) return ShieldAlert;
	
	const matched = Object.keys(routeIcons).find(route => pathname === route);
	return matched ? routeIcons[matched] : Bot;
};

const navigationItems = [
	{ label: 'Agent Center', path: '/dashboard', icon: Bot },
	{ label: 'Assets', path: '/dashboard/assets', icon: Layers },
	{ label: 'Scans', path: '/dashboard/scans', icon: Radar },
	{ label: 'Decision Log', path: '/dashboard/agent-log', icon: History },
	{ label: 'Analytics', path: '/dashboard/analytics', icon: BarChart3 },
	{ label: 'Alerts', path: '/dashboard/alerts', icon: Bell },
	{ label: 'Violations', path: '/dashboard/violations', icon: ShieldAlert },
];

const shellBackground = {
	background: 'var(--app-gradient-shell)',
};

export default function DashboardLayout() {
	const location = useLocation();
	const navigate = useNavigate();
	const user = useAuthStore((state) => state.user);
	const accessToken = useAuthStore((state) => state.accessToken);
	const clearAuth = useAuthStore((state) => state.clearAuth);
	const setTransitioning = useAuthStore((state) => state.setTransitioning);
	const isTransitioning = useAuthStore((state) => state.isTransitioning);
	const [unreadAlerts, setUnreadAlerts] = useState(0);
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

	useEffect(() => {
		let mounted = true;
		let socket;

		async function loadUnreadAlerts() {
			try {
				const response = await api.get('/alerts/unread-count');
				if (mounted) {
					setUnreadAlerts(Number(response.data?.unreadCount || 0));
				}
			} catch {
				if (mounted) {
					setUnreadAlerts(0);
				}
			}
		}

		loadUnreadAlerts();
		const timer = setInterval(loadUnreadAlerts, 30000);

		if (accessToken) {
			socket = connectRealtime(accessToken);

			const updateUnreadCount = (payload) => {
				if (mounted) {
					setUnreadAlerts(Number(payload?.unreadCount || 0));
				}
			};

			const handleAlertCreated = (payload) => {
				updateUnreadCount(payload);
				window.dispatchEvent(new CustomEvent('piractrix:alerts:new', { detail: payload }));
			};

			const handleAlertsUpdated = (payload) => {
				updateUnreadCount(payload);
				window.dispatchEvent(new CustomEvent('piractrix:alerts:updated', { detail: payload }));
			};

			socket?.on('alerts:unread-count', updateUnreadCount);
			socket?.on('alerts:new', handleAlertCreated);
			socket?.on('alerts:updated', handleAlertsUpdated);
		}

		return () => {
			mounted = false;
			clearInterval(timer);
			if (socket) {
				socket.off('alerts:unread-count');
				socket.off('alerts:new');
				socket.off('alerts:updated');
				disconnectRealtime();
			}
		};
	}, [accessToken]);

	const handleLogout = async () => {
		setTransitioning(true);
		try {
			await api.post('/auth/logout');
		} finally {
			clearAuth();
			navigate('/login');
		}
	};

	const { isGenerating, progress, generatedReport, dismissModal, hideGenerating } = useReportStore();

	const handleDownloadReport = async (report) => {
		if (!report.fileUrl) return toast.error('Download link not available.');
		
		try {
			let downloadUrl = report.fileUrl;
			if (!/^https?:\/\//i.test(downloadUrl)) {
				const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
				const apiOrigin = new URL(apiBaseUrl).origin;
				downloadUrl = `${apiOrigin}${downloadUrl.startsWith('/') ? '' : '/'}${downloadUrl}`;
			}

			const response = await api.get(downloadUrl, {
				responseType: 'blob',
			});

			const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
			const anchor = document.createElement('a');
			anchor.href = blobUrl;
			anchor.download = `Piractrix_Report_${report._id || 'Generated'}.pdf`;
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			window.URL.revokeObjectURL(blobUrl);
		} catch (error) {
			console.error('Download error:', error);
			window.open(report.fileUrl, '_blank');
		}
	};

	return (
		<div className={`flex min-h-screen text-(--app-color-text) ${isTransitioning ? 'animate-dashboard-exit' : 'animate-dashboard-land'}`} style={shellBackground}>
			{(isGenerating || generatedReport) && (
				<ReportGenerationModal
					isGenerating={isGenerating}
					progress={progress}
					report={generatedReport}
					onClose={dismissModal}
					onBackground={hideGenerating}
					onDownload={handleDownloadReport}
				/>
			)}

			{/* Desktop Sidebar Layout */}
			<aside 
				className={`hidden md:flex flex-col justify-between border-r border-slate-200/50 bg-slate-50/90 backdrop-blur-xl h-screen sticky top-0 z-20 transition-all duration-300 relative ${
					isCollapsed ? 'w-20' : 'w-64'
				}`}
			>
				{/* Floating Collapse Tab aligned with the top header strip */}
				<button
					onClick={() => setIsCollapsed(!isCollapsed)}
					className="absolute top-[26px] -right-3.5 h-7 w-7 rounded-full border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-600 shadow-xs flex items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 z-30"
					title={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
				>
					<ChevronLeft size={14} className={`transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
				</button>

				{/* Header/Logo */}
				<div className={`flex items-center gap-3 p-6 border-b border-slate-200/50 ${isCollapsed ? 'justify-center p-4' : ''}`}>
					<Link to="/" className="flex items-center gap-3 group shrink-0">
						<img src="/navlogo.png" alt="Piractrix" className="h-10 w-10 object-contain transition-transform duration-500 group-hover:scale-105" />
						{!isCollapsed && (
							<div className="logo-brand select-none animate-in fade-in duration-300">
								<span className="text-(--app-color-text) text-xl!">Pirac</span>
								<span className="logo-shield text-xl!">trix</span>
							</div>
						)}
					</Link>
				</div>

				{/* Nav Menu Items */}
				<nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto scrollbar-thin">
					{navigationItems.map((item) => {
						const isActive = location.pathname === item.path;
						const Icon = item.icon;

						return (
							<Link
								key={item.path}
								to={item.path}
								className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all relative group ${
									isActive
										? 'bg-[var(--app-color-primary-soft)] text-[var(--app-color-primary)] shadow-xs font-bold'
										: 'text-slate-500 hover:bg-slate-100/70 hover:text-slate-800'
								} ${isCollapsed ? 'justify-center px-0' : ''}`}
								title={isCollapsed ? item.label : ''}
							>
								{/* Active vertical pill indicator on left edge */}
								{isActive && (
									<div className="absolute left-0 top-3.5 bottom-3.5 w-1 bg-[var(--app-color-primary)] rounded-r-lg animate-in slide-in-from-left-1 duration-200" />
								)}
								
								<Icon 
									size={18} 
									className={`transition-colors duration-300 shrink-0 ${
										isActive ? 'text-[var(--app-color-primary)]' : 'text-slate-400 group-hover:text-slate-600'
									}`} 
								/>

								{!isCollapsed && (
									<span className="animate-in fade-in duration-300 truncate">
										{item.label}
									</span>
								)}

								{/* Badge */}
								{item.label === 'Alerts' && unreadAlerts > 0 && (
									<Badge
										variant="danger"
										size="sm"
										className={`justify-center font-bold px-1.5 py-0.5 text-xs min-w-5 shrink-0 ${
											isCollapsed ? 'absolute top-1 right-2 scale-90 shadow-sm' : 'ml-auto'
										}`}
									>
										{unreadAlerts > 99 ? '99+' : unreadAlerts}
									</Badge>
								)}
							</Link>
						);
					})}
				</nav>

				{/* Sidebar Footer Controls */}
				<div className="p-4 border-t border-slate-200/50 space-y-2.5 shrink-0">
					{/* Org profile Info */}
					<div 
						className={`flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-100 border border-slate-200/60 select-none ${
							isCollapsed ? 'justify-center' : ''
						}`}
						title={user?.orgName || 'Guest'}
					>
						<Building2 size={16} className="text-slate-400 shrink-0" />
						{!isCollapsed && (
							<span className="text-xs font-bold text-slate-600 truncate max-w-[160px]">
								{user?.orgName || 'Guest'}
							</span>
						)}
					</div>

					{/* Logout action */}
					<button
						onClick={handleLogout}
						className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 transition-all w-full cursor-pointer ${
							isCollapsed ? 'justify-center px-0' : ''
						}`}
						title={isCollapsed ? 'Logout' : ''}
					>
						<LogOut size={16} className="shrink-0" />
						{!isCollapsed && <span>Logout</span>}
					</button>
				</div>
			</aside>

			{/* Main Pane (Header on mobile, content scrolls next to sidebar) */}
			<div className="flex-1 flex flex-col min-h-screen md:h-screen md:overflow-hidden overflow-x-hidden">
				
				{/* Mobile top bar */}
				<header className="flex md:hidden sticky top-0 z-20 border-b border-white/60 bg-white/75 backdrop-blur-xl h-16 items-center justify-between px-4 shrink-0">
					<Link to="/" className="flex items-center gap-2.5">
						<img src="/navlogo.png" alt="Piractrix" className="h-9 w-9 object-contain" />
						<div className="logo-brand select-none">
							<span className="text-(--app-color-text) text-lg!">Pirac</span>
							<span className="logo-shield text-lg!">trix</span>
						</div>
					</Link>

					<button
						onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
						className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white/50 text-slate-700 hover:bg-white transition-all cursor-pointer"
						title="Toggle navigation"
					>
						{isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
					</button>
				</header>

				{/* Mobile Navigation Dropdown Drawer */}
				{isMobileMenuOpen && (
					<div className="border-b border-slate-100 bg-white/95 backdrop-blur-xl md:hidden sticky top-16 z-20 animate-in fade-in slide-in-from-top-4 duration-300 shrink-0 shadow-sm">
						<Container className="py-4 flex flex-col gap-1.5">
							{navigationItems.map((item) => {
								const isActive = location.pathname === item.path;
								const Icon = item.icon;

								return (
									<Link
										key={item.path}
										to={item.path}
										onClick={() => setIsMobileMenuOpen(false)}
										className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
											isActive
												? 'bg-[var(--app-color-primary-soft)] text-[var(--app-color-primary)] font-bold'
												: 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
										}`}
									>
										<Icon size={18} />
										<span>{item.label}</span>
										{item.label === 'Alerts' && unreadAlerts > 0 ? (
											<Badge variant="danger" size="sm" className="ml-auto min-w-6 justify-center px-2 py-0.5 text-xs">
												{unreadAlerts > 99 ? '99+' : unreadAlerts}
											</Badge>
										) : null}
									</Link>
								);
							})}
							
							<div className="h-px bg-slate-100 my-2" />
							
							<div className="flex items-center gap-3 px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
								<Building2 size={16} />
								<span>{user?.orgName || 'Guest'}</span>
							</div>

							<button
								onClick={() => {
									setIsMobileMenuOpen(false);
									handleLogout();
								}}
								className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-all text-left w-full cursor-pointer"
							>
								<LogOut size={18} />
								<span>Logout</span>
							</button>
						</Container>
					</div>
				)}

				{/* Desktop Sticky Header Strip */}
				<header className="hidden md:flex sticky top-0 z-10 border-b border-slate-200/50 bg-white/80 backdrop-blur-md h-20 items-center justify-between px-8 shrink-0 select-none">
					{/* Left: Dynamic Title, Breadcrumbs, & Description */}
					<div className="flex flex-col min-w-0">
						<div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
							{getBreadcrumbs(location.pathname).map((crumb, idx) => (
								<div key={crumb.path} className="flex items-center gap-1.5">
									{idx > 0 && <ChevronRight size={12} className="text-slate-300 shrink-0" />}
									{crumb.isLast ? (
										<div className="flex items-center gap-1.5">
											{(() => {
												const Icon = getRouteIcon(location.pathname);
												return <Icon size={14} className="text-[var(--app-color-primary)] shrink-0" />;
											})()}
											<span className="text-slate-800 font-extrabold text-sm tracking-tight">{crumb.label}</span>
										</div>
									) : (
										<Link to={crumb.path} className="hover:text-slate-500 transition-colors">
											{crumb.label}
										</Link>
									)}
								</div>
							))}
						</div>
						<p className="text-xs text-slate-400 font-medium truncate mt-0.5 max-w-[600px]" title={getRouteMetadata(location.pathname).description}>
							{getRouteMetadata(location.pathname).description}
						</p>
					</div>

					{/* Right: Actions */}
					<div className="flex items-center gap-4">
						{/* Real-time status pill */}
						<div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1">
							<span className="relative flex h-1.5 w-1.5">
								<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
								<span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
							</span>
							<span className="text-xs font-semibold text-emerald-800">
								Shield Active
							</span>
						</div>

						{/* Notification bell */}
						<Link 
							to="/dashboard/alerts" 
							className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100/50 rounded-xl transition-all cursor-pointer"
							title="Alerts Inbox"
						>
							<Bell size={18} />
							{unreadAlerts > 0 && (
								<span className="absolute top-1.5 right-1.5 flex h-2 w-2">
									<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
									<span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
								</span>
							)}
						</Link>

						{/* Profile Display & Avatar */}
						<div className="flex items-center gap-3 border-l border-slate-200/60 pl-4">
							<div className="flex flex-col items-end">
								<span className="text-xs font-bold text-slate-800 leading-none max-w-[150px] truncate">{user?.orgName || 'Guest Org'}</span>
								<span className="text-xs text-slate-400 font-medium mt-1 max-w-[150px] truncate">{user?.email || ''}</span>
							</div>
							<div 
								className="h-8 w-8 rounded-lg bg-[var(--app-color-primary-soft)] text-[var(--app-color-primary)] font-black text-xs flex items-center justify-center border border-[var(--app-color-primary)]/10 shadow-xs uppercase"
								title={user?.email || 'Guest User'}
							>
								{user?.orgName ? user.orgName.slice(0, 2) : 'G'}
							</div>
						</div>
					</div>
				</header>

				{/* Main dashboard content pane */}
				<main className="flex-1 py-8 px-8 lg:px-12 w-full max-w-none md:overflow-y-auto scrollbar-thin">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
