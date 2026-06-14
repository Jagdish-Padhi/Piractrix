import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import models
import Organization from '../src/models/organization.model.js';
import Asset from '../src/models/asset.model.js';
import Violation from '../src/models/violation.model.js';
import ScanJob from '../src/models/scanJob.model.js';
import Alert from '../src/models/alert.model.js';
import ScanResult from '../src/models/scanResult.model.js';
import ThreatMemory from '../src/models/threatMemory.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
	console.error('MONGO_URI is missing in .env');
	process.exit(1);
}

// Helpers for random generation
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomDate = (startDaysAgo, endDaysAgo) => {
	const end = new Date();
	end.setDate(end.getDate() - endDaysAgo);
	const start = new Date();
	start.setDate(start.getDate() - startDaysAgo);
	return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

const platforms = ['youtube', 'twitter', 'telegram', 'web', 'reddit'];

// Unified lists of threat domains and their relationships to form 3 beautiful visual clusters
const threatClusters = {
	sports_iptv: [
		{ domain: 'sportsurge.net', level: 'critical', platforms: ['web', 'twitter'], related: ['daddylive.eu', 'footybite.cc'] },
		{ domain: 'daddylive.eu', level: 'critical', platforms: ['web', 'telegram'], related: ['sportsurge.net', 'weakspell.org', 'methstreams.com'] },
		{ domain: 'footybite.cc', level: 'high', platforms: ['web'], related: ['sportsurge.net', 'weakspell.org'] },
		{ domain: 'weakspell.org', level: 'high', platforms: ['web'], related: ['daddylive.eu', 'footybite.cc', 'methstreams.com', 'cricfree.live'] },
		{ domain: 'methstreams.com', level: 'medium', platforms: ['web', 'twitter'], related: ['daddylive.eu', 'weakspell.org', 'cricfree.live'] },
		{ domain: 'cricfree.live', level: 'medium', platforms: ['web'], related: ['weakspell.org', 'methstreams.com', 'vipbox.lc'] },
		{ domain: 'vipbox.lc', level: 'low', platforms: ['web'], related: ['cricfree.live'] }
	],
	p2p_torrent: [
		{ domain: '1337x.to', level: 'critical', platforms: ['web', 'reddit'], related: ['thepiratebay.org', 'yts.mx'] },
		{ domain: 'thepiratebay.org', level: 'critical', platforms: ['web'], related: ['1337x.to', 'rarbg.to', 'eztv.re'] },
		{ domain: 'yts.mx', level: 'high', platforms: ['web'], related: ['1337x.to', 'nyaa.si'] },
		{ domain: 'nyaa.si', level: 'high', platforms: ['web', 'reddit'], related: ['yts.mx', 'rutracker.org'] },
		{ domain: 'rarbg.to', level: 'medium', platforms: ['web'], related: ['thepiratebay.org', 'eztv.re'] },
		{ domain: 'eztv.re', level: 'medium', platforms: ['web'], related: ['thepiratebay.org', 'rarbg.to'] },
		{ domain: 'rutracker.org', level: 'low', platforms: ['web'], related: ['nyaa.si'] }
	],
	direct_download: [
		{ domain: 'mega.nz', level: 'high', platforms: ['web', 'telegram'], related: ['mediafire.com', 'rapidgator.net'] },
		{ domain: 'mediafire.com', level: 'high', platforms: ['web'], related: ['mega.nz', 'fitgirl-repacks.site'] },
		{ domain: 'rapidgator.net', level: 'medium', platforms: ['web'], related: ['mega.nz', 'kemono.party'] },
		{ domain: 'fitgirl-repacks.site', level: 'medium', platforms: ['web', 'reddit'], related: ['mediafire.com', 'steamunlocked.net'] },
		{ domain: 'steamunlocked.net', level: 'low', platforms: ['web'], related: ['fitgirl-repacks.site'] },
		{ domain: 'kemono.party', level: 'low', platforms: ['web', 'telegram'], related: ['rapidgator.net'] }
	]
};

const allThreatDomains = [
	...threatClusters.sports_iptv,
	...threatClusters.p2p_torrent,
	...threatClusters.direct_download
];

const violationUrls = {
	youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
	twitter: 'https://x.com/search?q=leak+download+mega',
	telegram: 'https://t.me/s/PremiumLeaksHD',
	reddit: 'https://reddit.com/r/Piracy/comments/mega_thread_2026/',
	web: 'https://fmovies.to/film/watch-online-free-hd'
};

const seedData = async () => {
	try {
		console.log('Connecting to MongoDB...');
		await mongoose.connect(MONGO_URI);
		console.log('Connected.');

		console.log('Clearing existing demo data...');
		const existingOrg = await Organization.findOne({ email: 'demo@piractrix.com' });
		if (existingOrg) {
			const orgId = existingOrg._id;
			await Promise.all([
				Asset.deleteMany({ orgId }),
				ScanJob.deleteMany({ orgId }),
				ScanResult.deleteMany({ orgId }),
				Violation.deleteMany({ orgId }),
				Alert.deleteMany({ orgId }),
				ThreatMemory.deleteMany({ orgId })
			]);
			await Organization.deleteOne({ _id: orgId });
		}

		console.log('Creating demo organization...');
		const passwordHash = await bcrypt.hash('Piractrix@2026', 10);
		const demoOrg = await Organization.create({
			orgName: 'Piractrix Enterprise Demo',
			email: 'demo@piractrix.com',
			passwordHash,
			plan: 'pro',
			createdAt: randomDate(60, 60),
			notificationPrefs: {
				whatsappEnabled: true,
				emailOnHighConfidence: true
			}
		});
		const orgId = demoOrg._id;

		console.log('Seeding curated Enterprise Assets with working URLs and previews...');
		const assetData = [
			// Videos
			{
				title: 'Dune: Part Two (2024)',
				description: 'Official theatrical release of Dune: Part Two in 4K HDR. Distributed by Warner Bros.',
				type: 'video',
				gcsUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
				thumbnailUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&auto=format&fit=crop&q=80'
			},
			{
				title: 'Deadpool & Wolverine (2024)',
				description: 'Marvel Studios summer blockbuster. High-priority tracking for leaks.',
				type: 'video',
				gcsUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
				thumbnailUrl: 'https://images.unsplash.com/photo-1608889174637-3c44f6326f1a?w=600&auto=format&fit=crop&q=80'
			},
			{
				title: 'The Bear - Season 3',
				description: 'FX on Hulu complete season drop. Binge-watching format leakage monitoring.',
				type: 'video',
				gcsUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
				thumbnailUrl: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=600&auto=format&fit=crop&q=80'
			},
			// OTT Content
			{
				title: 'House of the Dragon - Season 2',
				description: 'HBO Max flagship series. Pre-broadcast leak protection active.',
				type: 'ott_content',
				gcsUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
				thumbnailUrl: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=600&auto=format&fit=crop&q=80'
			},
			// Highlight
			{
				title: 'UEFA Champions League Final Highlight',
				description: 'Official broadcast highlights. Exclusive rights distribution.',
				type: 'highlight',
				gcsUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
				thumbnailUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&auto=format&fit=crop&q=80'
			},
			// Music (Audio master tracks)
			{
				title: 'Taylor Swift - The Tortured Poets Department',
				description: 'Studio master album tracking. Heavily targeted by leak sites.',
				type: 'music',
				gcsUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
				thumbnailUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80'
			},
			{
				title: 'Kendrick Lamar - Not Like Us',
				description: 'Viral studio single. Audio fingerprint monitoring active.',
				type: 'music',
				gcsUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
				thumbnailUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80'
			},
			// Images
			{
				title: 'Piractrix Official Concept Art Logo',
				description: 'High-res transparent SVG/PNG design assets.',
				type: 'image',
				gcsUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
				thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80'
			},
			{
				title: 'Marvel Studios Deadpool 3 Poster Design',
				description: 'Marketing distribution image asset.',
				type: 'image',
				gcsUrl: 'https://images.unsplash.com/photo-1569003339405-ea396a5a8a90?w=600&auto=format&fit=crop&q=80',
				thumbnailUrl: 'https://images.unsplash.com/photo-1569003339405-ea396a5a8a90?w=600&auto=format&fit=crop&q=80'
			},
			// Education/Exam Paper
			{
				title: 'SAT National Exam Paper 2026',
				description: 'Highly confidential examination script bundle.',
				type: 'exam_paper',
				gcsUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
				thumbnailUrl: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=600&auto=format&fit=crop&q=80'
			},
			// Document
			{
				title: 'GTA VI Source Code Document',
				description: 'Development details and architecture schema.',
				type: 'document',
				gcsUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
				thumbnailUrl: 'https://images.unsplash.com/photo-1610116306796-6fea9f4fae38?w=600&auto=format&fit=crop&q=80'
			},
			// Software
			{
				title: 'Adobe Premiere Pro 2024 Pre-Activated',
				description: 'Creative desktop application installer package.',
				type: 'software',
				gcsUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
				thumbnailUrl: 'https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?w=600&auto=format&fit=crop&q=80'
			},
			// Livestreams (Monitored separately in streams hub)
			{
				title: 'Arsenal vs Chelsea Live Stream',
				description: 'Premier League live feed monitoring.',
				type: 'livestream',
				livestreamUrl: 'https://www.twitch.tv/arsenal-vs-chelsea-live',
				thumbnailUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&auto=format&fit=crop&q=80'
			},
			{
				title: 'F1 Monaco Grand Prix Broadcast',
				description: 'Formula 1 live event feed auditing.',
				type: 'livestream',
				livestreamUrl: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8',
				thumbnailUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=600&auto=format&fit=crop&q=80'
			}
		];

		const assets = await Asset.insertMany(assetData.map((data, index) => ({
			orgId,
			...data,
			storageKey: data.type !== 'livestream' ? `demo_asset_${index}` : undefined,
			status: 'active',
			createdAt: new Date(Date.now() - (index * 86400000 * 2)),
			fileSize: data.type !== 'livestream' ? (data.type === 'video' || data.type === 'ott_content' ? randomInt(100, 800) * 1024 * 1024 : randomInt(1, 10) * 1024 * 1024) : undefined,
			fingerprint: {
				pHash: Math.random().toString(16).substring(2, 18),
				videoHash: (data.type === 'video' || data.type === 'ott_content' || data.type === 'highlight') ? Math.random().toString(16).substring(2, 18) : undefined,
				colorHistogram: [Math.random(), Math.random(), Math.random(), Math.random()]
			},
			violationsFound: 0
		})));

		console.log('Seeding 25 Scan Jobs...');
		const scanJobsData = [];
		const nonLivestreamAssets = assets.filter(a => a.type !== 'livestream');
		
		for (let i = 0; i < 25; i++) {
			const asset = randomElement(nonLivestreamAssets);
			const startedAt = randomDate(1, 15);
			const durationMins = randomInt(5, 20);
			const completedAt = new Date(startedAt.getTime() + durationMins * 60000);
			
			scanJobsData.push({
				orgId,
				assetId: asset._id,
				status: 'completed',
				platforms: [randomElement(platforms), randomElement(platforms)],
				keywords: [`${asset.title.split(' ')[0]} download`, `watch ${asset.title.split(' ')[0]} free`, `${asset.title.split(' ')[0]} leak`],
				resultsCount: randomInt(30, 150),
				violationsCount: 0,
				startedAt,
				completedAt
			});
		}
		const scanJobs = await ScanJob.insertMany(scanJobsData);

		console.log('Seeding structured Threat Memory network (20 nodes in 3 rings)...');
		const threatMemoryDocs = allThreatDomains.map((item) => {
			return {
				orgId,
				domain: item.domain,
				firstSeenAt: randomDate(30, 45),
				lastSeenAt: randomDate(0, 3),
				totalViolations: randomInt(15, item.level === 'critical' ? 120 : item.level === 'high' ? 60 : 25),
				platforms: item.platforms,
				threatLevel: item.level,
				autoEscalate: item.level === 'critical',
				relatedDomains: item.related,
				meta: {
					ipAddresses: [`104.21.32.${randomInt(10, 250)}`, `172.67.96.${randomInt(10, 250)}`],
					registrar: randomElement(['Cloudflare', 'NameCheap', 'Tucows', 'Njalla']),
					hostingProvider: randomElement(['Cloudflare', 'DigitalOcean', 'AWS', 'OVH']),
					abuseEmail: `abuse@${item.domain}`
				}
			};
		});
		await ThreatMemory.insertMany(threatMemoryDocs);

		console.log('Seeding 55 highly realistic violations...');
		const violationData = [];
		const assetViolationCounts = {};
		const scanViolationCounts = {};

		for (let i = 0; i < 55; i++) {
			const scanJob = randomElement(scanJobs);
			const asset = assets.find(a => a._id.toString() === scanJob.assetId.toString());
			const detectedAt = new Date(scanJob.completedAt.getTime() - randomInt(0, 30000));
			
			// Select domain and match platform from threat database or fallbacks
			const threat = randomElement(allThreatDomains);
			const domain = threat.domain;
			const platform = randomElement(threat.platforms);
			
			const statusRand = Math.random();
			let status = 'open';
			let caseStatus = 'open';
			let resolvedAt = null;
			let matchConfidence = randomInt(70, 99);
			let matchType = matchConfidence > 90 ? 'exact' : 'near-duplicate';

			if (statusRand < 0.15) {
				status = 'false_positive';
				caseStatus = 'false_positive';
				matchConfidence = randomInt(45, 60);
				matchType = 'partial';
			} else if (statusRand < 0.45) {
				status = 'resolved';
				caseStatus = 'resolved';
				resolvedAt = new Date(detectedAt.getTime() + randomInt(1, 24) * 3600000);
			} else if (statusRand < 0.70) {
				status = 'reported';
				caseStatus = 'dmca_sent';
			}

			// Point screenshot to the asset's high-res Unsplash thumbnail (forces 100% successful loading)
			const screenshotUrl = asset.thumbnailUrl;
			const baseUrl = violationUrls[platform] || violationUrls.web;

			violationData.push({
				orgId,
				assetId: asset._id,
				scanJobId: scanJob._id,
				platform,
				sourceUrl: baseUrl.replace(/^[https://]+[^/]+/, `https://${domain}`),
				sourceDomain: domain,
				matchConfidence,
				matchType,
				status,
				caseStatus,
				caseId: `PIR-${new Date(detectedAt).toISOString().slice(0,10).replace(/-/g,'')}-${randomInt(1000, 9999)}`,
				resolvedAt,
				screenshotUrl,
				evidenceBundle: {
					hammingDistance: randomInt(0, 10),
					colorSimilarity: Number((Math.random() * 0.3 + 0.7).toFixed(2)),
					frameMatchCount: (asset.type === 'video' || asset.type === 'ott_content') ? randomInt(3, 15) : undefined,
					visionLabelOverlapScore: randomInt(60, 95),
					visionConfidenceBoost: randomInt(5, 15),
					visionLabels: ['broadcast_logo', 'watermark', 'action_scene', 'sports_broadcast']
				},
				detectedAt,
				repeatOffenderScore: randomInt(20, 95)
			});

			assetViolationCounts[asset._id] = (assetViolationCounts[asset._id] || 0) + 1;
			scanViolationCounts[scanJob._id] = (scanViolationCounts[scanJob._id] || 0) + 1;
		}

		const violations = await Violation.insertMany(violationData);

		// Synchronize counts
		for (const asset of assets) {
			await Asset.findByIdAndUpdate(asset._id, { violationsFound: assetViolationCounts[asset._id] || 0 });
		}
		for (const job of scanJobs) {
			await ScanJob.findByIdAndUpdate(job._id, { violationsCount: scanViolationCounts[job._id] || 0 });
		}

		console.log('Generating Scan Results data...');
		const scanResultData = [];
		for (const job of scanJobs) {
			const asset = assets.find(a => a._id.toString() === job.assetId.toString());
			const resultCount = randomInt(4, 12);
			for (let r = 0; r < resultCount; r++) {
				const threat = randomElement(allThreatDomains);
				const platform = randomElement(threat.platforms);
				const baseUrl = violationUrls[platform] || violationUrls.web;
				const sourceUrl = baseUrl.replace(/^[https://]+[^/]+/, `https://${threat.domain}`);
				const confidence = randomInt(35, 99);
				const resultStatus = confidence > 85 ? 'matched' : confidence < 55 ? 'no_match' : 'pending_match';
				
				scanResultData.push({
					scanJobId: job._id,
					orgId,
					assetId: asset._id,
					sourceUrl,
					sourceDomain: threat.domain,
					platform,
					pageTitle: `${asset.title} - Free Streaming Link`,
					status: resultStatus,
					matchConfidence: confidence,
					matchType: confidence > 90 ? 'exact' : confidence > 70 ? 'near-duplicate' : 'partial',
					scrapedAt: new Date(job.completedAt.getTime() - randomInt(0, 60000)),
					evidenceBundle: {
						hammingDistance: randomInt(0, 15),
						colorSimilarity: Number((Math.random() * 0.4 + 0.6).toFixed(2))
					}
				});
			}
		}
		await ScanResult.insertMany(scanResultData);

		console.log('Seeding curated strategic Alerts...');
		const alertData = [];
		const openHighConfViolations = violations.filter(v => v.matchConfidence >= 90 && v.status === 'open').slice(0, 10);
		
		for (const v of openHighConfViolations) {
			alertData.push({
				orgId,
				violationId: v._id,
				type: 'high_confidence',
				severity: 'critical',
				title: 'High-Value Asset Leak Detected',
				message: `Automated DNA analysis identified a direct ${v.matchConfidence}% match for your asset on ${v.platform}. Target domain ${v.sourceDomain} has been prioritized.`,
				channels: ['in-app', 'email', 'whatsapp'],
				read: false,
				createdAt: new Date(v.detectedAt.getTime() + 1000)
			});
		}

		// Add platform surge alerts
		alertData.push({
			orgId,
			type: 'platform_surge',
			severity: 'high',
			title: 'IPTV Streaming Ring Triggered',
			message: 'System detected a platform surge: 4 related IPTV domains (daddylive.eu, sportsurge.net, footybite.cc, weakspell.org) are sharing identical live feeds.',
			channels: ['in-app', 'slack'],
			read: false,
			createdAt: new Date()
		});
		
		alertData.push({
			orgId,
			type: 'platform_surge',
			severity: 'medium',
			title: 'Coordinated Torrent Distribution',
			message: 'Cross-syndication detected: yts.mx and nyaa.si are syndicating the exact same movie hashes.',
			channels: ['in-app'],
			read: true,
			createdAt: new Date(Date.now() - 86400000)
		});

		await Alert.insertMany(alertData);

		console.log('\n✅ ROBUST CURATED DEMO SEEDING COMPLETED SUCCESSFULLY!');
		console.log('-----------------------------------');
		console.log(`Seeded 1 Org, ${assets.length} Assets, ${scanJobs.length} Scans, ${scanResultData.length} Results, ${violations.length} Violations, ${alertData.length} Alerts, ${allThreatDomains.length} Threats.`);
		console.log('Demo Credentials:');
		console.log('Email: demo@piractrix.com');
		console.log('Password: Piractrix@2026');
		console.log('-----------------------------------');

		process.exit(0);
	} catch (error) {
		console.error('Seeding failed:', error);
		process.exit(1);
	}
};

seedData();
