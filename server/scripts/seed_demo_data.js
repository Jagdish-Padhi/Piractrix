import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);

// Mock/Model imports (relative to project structure)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

import Organization from '../src/models/organization.model.js';
import Asset from '../src/models/asset.model.js';
import Violation from '../src/models/violation.model.js';
import Alert from '../src/models/alert.model.js';
import ScanJob from '../src/models/scanJob.model.js';
import ThreatMemory from '../src/models/threatMemory.model.js';
import AgentDecisionLog from '../src/models/agentDecisionLog.model.js';

const MONGO_URI = process.env.MONGO_URI;

const ASSET_TEMPLATES = [
    {
        title: 'IPL 2026 Final: KKR vs SRH Highlights',
        type: 'video',
        description: 'Official highlights of the Indian Premier League 2026 Final match.',
        tags: ['IPL', 'Cricket', 'Final', 'KKR', 'SRH'],
    },
    {
        title: 'UEFA Champions League: Real Madrid vs Dortmund Final',
        type: 'video',
        description: 'Exclusive broadcast rights for the UCL Final 2026.',
        tags: ['UCL', 'Football', 'Final', 'Real Madrid', 'BVB'],
    },
    {
        title: 'House of the Dragon - Season 2 Episode 1 [OTT Premiere]',
        type: 'ott_content',
        description: 'High-value premium fantasy drama television series broadcast.',
        tags: ['OTT', 'HBO', 'House of the Dragon', 'HOTD', 'Premiere'],
    },
    {
        title: 'JEE Advanced Physics Mock Exam Paper 2026',
        type: 'exam_paper',
        description: 'Leaked mock examination material and solutions package.',
        tags: ['JEE', 'Physics', 'Exam', 'Leak', 'Education'],
    },
    {
        title: 'Top Hits Remix: Exclusive Pop Track 2026',
        type: 'music',
        description: 'Audio master copy of billboard release.',
        tags: ['Remix', 'Audio', 'Music', 'Pop', 'BillBoard'],
    },
    {
        title: 'Confidential Rights Acquisition Contract.docx',
        type: 'document',
        description: 'Internal documentation regarding rights bidding.',
        tags: ['Contract', 'Internal', 'Bidding', 'Acquisition', 'PDF'],
    }
];

const PLATFORMS = ['youtube', 'twitter', 'telegram', 'web'];
const DOMAINS = ['vipleague.st', 'totalsportek.to', 'hesgoal.com', 'buffstreams.sx', 'piratestream.tv', 'leakcentral.in', 'telegram/sharebot'];

async function seed() {
    try {
        console.log('🚀 Starting Piractrix Demo Data Seeding...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // 1. Create or Get Demo Organization
        let org = await Organization.findOne({ email: 'demo@sportshield.ai' });
        if (!org) {
            org = await Organization.create({
                orgName: 'Piractrix Defense Systems',
                email: 'demo@sportshield.ai',
                passwordHash: '$2b$12$o8/UIs.UxIhqtzxx6eMI6.qlUVw/Dg10xc8HaRDF2QK5lVItpFCsy', // "password123"
                plan: 'pro',
                notificationPrefs: {
                    emailOnHighConfidence: true,
                    emailDigest: true,
                    inAppAlerts: true,
                }
            });
            console.log('✅ Created Demo Organization');
        } else {
            org.orgName = 'Piractrix Defense Systems';
            await org.save();
            console.log('✅ Updated Organization name to Piractrix');
        }

        const orgId = org._id;

        // 2. Clear existing demo data
        await Asset.deleteMany({ orgId });
        await Violation.deleteMany({ orgId });
        await Alert.deleteMany({ orgId });
        await ScanJob.deleteMany({ orgId });
        await ThreatMemory.deleteMany({ orgId });
        await AgentDecisionLog.deleteMany({ orgId });
        console.log('🧹 Cleaned existing demo data for this org');

        // 3. Create Assets
        const createdAssets = [];
        for (const template of ASSET_TEMPLATES) {
            const ext = template.type === 'music' ? 'mp3' : (template.type === 'exam_paper' || template.type === 'document' ? 'pdf' : 'mp4');
            const asset = await Asset.create({
                orgId,
                ...template,
                status: 'active',
                violationsFound: 0,
                storageKey: `assets/${orgId}/${Date.now()}.${ext}`,
                gcsUrl: `https://storage.googleapis.com/piractrix-assets/demo/${template.title.replace(/\s+/g, '_')}.${ext}`,
                fileSize: template.type === 'exam_paper' ? 2400000 : (template.type === 'music' ? 6800000 : 45000000), 
                fingerprint: {
                    pHash: 'f0f0f0f0f0f0f0f0',
                    colorHistogram: Array.from({ length: 64 }, () => Math.random()),
                    frameHashes: ['a1a1', 'b2b2', 'c3c3'],
                },
                createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)
            });
            createdAssets.push(asset);
        }
        console.log(`✅ Created ${createdAssets.length} Assets`);

        // 4. Create ThreatMemory entries (4 domains)
        const threatMemoryEntries = [
            {
                orgId,
                domain: 'piratestreamhd.com',
                firstSeenAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
                lastSeenAt: new Date(),
                totalViolations: 82,
                platforms: ['youtube', 'web'],
                threatLevel: 'critical',
                autoEscalate: true,
                relatedDomains: ['hdstream2.com', 'vipstream.net']
            },
            {
                orgId,
                domain: 'telegram/sportsleaks',
                firstSeenAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
                lastSeenAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
                totalViolations: 43,
                platforms: ['telegram'],
                threatLevel: 'high',
                autoEscalate: true,
                relatedDomains: []
            },
            {
                orgId,
                domain: 'exampaperleaks.in',
                firstSeenAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
                lastSeenAt: new Date(),
                totalViolations: 12,
                platforms: ['web', 'telegram'],
                threatLevel: 'critical',
                autoEscalate: true,
                relatedDomains: ['jee-leaks.blogspot.com']
            },
            {
                orgId,
                domain: 'audiomack-leaks.net',
                firstSeenAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
                lastSeenAt: new Date(),
                totalViolations: 3,
                platforms: ['web'],
                threatLevel: 'medium',
                autoEscalate: false,
                relatedDomains: []
            }
        ];
        await ThreatMemory.insertMany(threatMemoryEntries);
        console.log('✅ Injected Threat Memory entries');

        // 5. Create Historical Violations (30-day timeline)
        const totalViolations = 320;
        const now = new Date();
        const violations = [];

        console.log(`⏳ Generating ${totalViolations} historical violations...`);
        for (let i = 0; i < totalViolations; i++) {
            const asset = createdAssets[i % createdAssets.length];
            const platform = PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)];
            const domain = DOMAINS[Math.floor(Math.random() * DOMAINS.length)];
            
            // Distribute across last 30 days
            const daysAgo = Math.floor(Math.random() * 30);
            const detectedAt = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
            
            // Random status distribution
            const statusRand = Math.random();
            const status = statusRand > 0.4 ? 'resolved' : (statusRand > 0.1 ? 'open' : 'false_positive');
            
            const confidence = 45 + Math.floor(Math.random() * 50);
            
            // Generate a realistic thumbnail based on the asset
            let screenshotUrl = 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&q=80'; // Generic Stadium
            if (asset.title.includes('IPL') || asset.title.includes('Cricket')) {
                screenshotUrl = 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&q=80'; // Cricket
            } else if (asset.title.includes('Champions League') || asset.title.includes('Football')) {
                screenshotUrl = 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80'; // Football
            } else if (asset.type === 'exam_paper') {
                screenshotUrl = 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&q=80'; // Book/Paper
            } else if (asset.type === 'music') {
                screenshotUrl = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80'; // Audio mic
            } else if (asset.type === 'ott_content') {
                screenshotUrl = 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&q=80'; // Movie scene
            }

            // For YouTube, use a real-looking thumbnail structure
            if (platform === 'youtube') {
                const mockIds = ['3VmsnL8Vdqc', 'dQw4w9WgXcQ', 'y6120QOlsfU', 'L_jWHffIx5E'];
                screenshotUrl = `https://img.youtube.com/vi/${mockIds[Math.floor(Math.random() * mockIds.length)]}/maxresdefault.jpg`;
            }
            
            violations.push({
                orgId,
                assetId: asset._id,
                scanJobId: new mongoose.Types.ObjectId(),
                sourceUrl: platform === 'youtube' 
                    ? `https://youtube.com/watch?v=${Math.random().toString(36).substring(7)}` 
                    : `https://${domain}/stream/${Math.random().toString(36).substring(7)}`,
                sourceDomain: domain,
                platform,
                matchConfidence: confidence,
                matchType: confidence > 85 ? 'exact' : 'partial',
                status,
                screenshotUrl,
                detectedAt,
                resolvedAt: status === 'resolved' ? new Date(detectedAt.getTime() + (Math.random() * 48 * 60 * 60 * 1000)) : null,
                discoveryKeyword: asset.tags[Math.floor(Math.random() * asset.tags.length)] + ' free leak',
                evidenceBundle: {
                    hammingDistance: Math.floor(Math.random() * 15),
                    colorSimilarity: 0.7 + (Math.random() * 0.25),
                    visionConfidenceBoost: confidence > 80 ? 15 : 0,
                    visionLabels: asset.title.includes('Cricket') ? ['cricket', 'stadium', 'batsman'] : ['document', 'text', 'watermark'],
                    reasoning: 'AI Verification engine confirmed signature match.'
                }
            });
        }

        await Violation.insertMany(violations);
        console.log('✅ Injected historical violation data');

        // 6. Update Asset counts
        for (const asset of createdAssets) {
            const count = await Violation.countDocuments({ assetId: asset._id, orgId });
            await Asset.findByIdAndUpdate(asset._id, { violationsFound: count });
        }

        // 7. Create Recent Critical Alerts
        const criticalViolations = await Violation.find({ orgId, matchConfidence: { $gt: 90 } }).limit(5);
        const alerts = criticalViolations.map(v => ({
            orgId,
            violationId: v._id,
            type: 'high_confidence',
            severity: 'high',
            title: 'Critical Infringement Detected',
            message: `High-confidence match found on ${v.platform}. Automatic takedown notice drafted.`,
            read: false,
            createdAt: new Date()
        }));
        await Alert.insertMany(alerts);
        console.log('🔔 Created 5 Critical Demo Alerts');

        // 8. Create Agent Decision Logs
        const decisionLogs = [];
        console.log('⏳ Generating 25 Agent Decision Logs...');
        for (let i = 0; i < 25; i++) {
            const asset = createdAssets[i % createdAssets.length];
            const platform = PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)];
            const domain = DOMAINS[Math.floor(Math.random() * DOMAINS.length)];
            const autonomousMode = Math.random() > 0.45;
            const severity = Math.min(5, Math.max(1, Math.round((i * 4 + 40) / 20))); // dynamic severity 2-5
            
            const action = severity === 5 ? 'auto_escalate' : (severity === 4 ? 'draft_dmca' : (severity === 3 ? 'create_alert' : 'log_only'));
            const outcome = i < 4 ? 'pending' : (Math.random() > 0.15 ? 'success' : 'failed');

            let reasoning = '';
            if (severity === 5) {
                reasoning = `Severity classified as Critical (5) due to high confidence match (${90 + i}%) of ${asset.type} asset on ${platform} domain: ${domain}. The domain has multiple entries in ThreatMemory and is flagged as a repeat offender. Escalating to legal department and drafting DMCA notice automatically.`;
            } else if (severity === 4) {
                reasoning = `Severity classified as High (4) based on ${80 + i}% match on ${platform}. Detected signature overlaps matching core broadcast content. Autonomous action taken: drafted DMCA notice and queued notification.`;
            } else if (severity === 3) {
                reasoning = `Severity classified as Medium (3). Identified ${60 + i}% match on ${platform} by search expansion logic. Action executed: created internal alert. Insufficient history for automatic escalation.`;
            } else {
                reasoning = `Severity classified as Low (1-2) with match confidence ${40 + i}%. Logged in database for observational telemetry. Action: log only.`;
            }

            decisionLogs.push({
                orgId,
                assetId: asset._id,
                violationId: criticalViolations[i % criticalViolations.length]?._id || null,
                decisionType: i % 4 === 0 ? 'violation_classified' : (i % 4 === 1 ? 'action_taken' : (i % 4 === 2 ? 'scan_triggered' : 'escalation')),
                input: {
                    confidence: 45 + i * 2,
                    matchType: i % 2 === 0 ? 'exact' : 'partial',
                    platform,
                    domainReputation: domain,
                    assetType: asset.type
                },
                reasoning,
                action,
                outcome,
                autonomousMode,
                agentVersion: '1.0',
                createdAt: new Date(Date.now() - i * 4 * 60 * 60 * 1000),
                meta: {
                    severityResult: {
                        severity,
                        threatCategory: asset.type === 'exam_paper' ? 'leak_forum' : 'stream_ripper',
                        recommendedAction: action,
                        reasoning
                    }
                }
            });
        }
        await AgentDecisionLog.insertMany(decisionLogs);
        console.log('✅ Injected 25 Agent Decision Logs');

        console.log('\n✨ PIRACTRIX DEMO DATA SEEDED SUCCESSFULLY!');
        console.log(`   Organization: ${org.email}`);
        console.log(`   Password: password123`);
        console.log(`   Dashboard: http://localhost:5173/login`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
}

seed();
