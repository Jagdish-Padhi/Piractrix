import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';
import bcrypt from 'bcrypt';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

import Organization from '../src/models/organization.model.js';
import Asset from '../src/models/asset.model.js';
import Violation from '../src/models/violation.model.js';
import Alert from '../src/models/alert.model.js';
import ScanJob from '../src/models/scanJob.model.js';
import ThreatMemory from '../src/models/threatMemory.model.js';
import AgentDecisionLog from '../src/models/agentDecisionLog.model.js';
import NotificationLog from '../src/models/notificationLog.model.js';
import { generateCaseId } from '../src/utils/caseId.js';

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
    title: 'Confidential Rights Bidding Strategy 2026.docx',
    type: 'document',
    description: 'Internal documentation regarding rights bidding.',
    tags: ['Contract', 'Internal', 'Bidding', 'Acquisition', 'PDF'],
  },
  {
    title: 'Piractrix Brand Core Artwork.png',
    type: 'image',
    description: 'High-resolution logo and platform branding collateral.',
    tags: ['Brand', 'Artwork', 'Image', 'Asset', 'PNG'],
  }
];

const PLATFORMS = ['youtube', 'twitter', 'telegram', 'web'];

const THREAT_DOMAINS = [
  { domain: 'piratestreamhd.com', level: 'critical', violations: 12, platforms: ['youtube', 'web'], related: ['hdstream2.com'] },
  { domain: 'crackstreams.me', level: 'high', violations: 8, platforms: ['web'], related: ['buffstreams.sx'] },
  { domain: 'sportsleak.telegram', level: 'high', violations: 7, platforms: ['telegram'], related: [] },
  { domain: 'streamhd.xyz', level: 'medium', violations: 4, platforms: ['youtube', 'telegram'], related: [] },
  { domain: 'watchsports.cc', level: 'medium', violations: 3, platforms: ['web'], related: [] },
  { domain: 'freematch.net', level: 'low', violations: 1, platforms: ['twitter'], related: [] }
];

async function seed() {
  try {
    console.log('🚀 Starting Piractrix Demo Data Seeding...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // 1. Create or Get Demo Organization
    const passwordHash = await bcrypt.hash('Piractrix@2026', 10);
    let org = await Organization.findOne({ email: 'demo@piractrix.com' });
    if (!org) {
      org = await Organization.create({
        orgName: 'Piractrix Defense Systems',
        email: 'demo@piractrix.com',
        passwordHash,
        plan: 'pro',
        notificationPrefs: {
          emailOnHighConfidence: true,
          emailDigest: false,
          inAppAlerts: true,
          whatsappEnabled: true,
          whatsappNumber: '+1234567890',
          telegramEnabled: true,
          telegramChatId: '987654321',
          slackEnabled: true,
          slackWebhookUrl: 'https://hooks.slack.com/services/T00/B00/X00',
          pushEnabled: true,
          alertMinSeverity: 3,
          whatsappMinSeverity: 5
        }
      });
      console.log('✅ Created Demo Organization (demo@piractrix.com / Piractrix@2026)');
    } else {
      org.orgName = 'Piractrix Defense Systems';
      org.passwordHash = passwordHash;
      await org.save();
      console.log('✅ Re-seeded demo@piractrix.com Credentials');
    }

    const orgId = org._id;

    // 2. Clean existing demo data
    await Asset.deleteMany({ orgId });
    await Violation.deleteMany({ orgId });
    await Alert.deleteMany({ orgId });
    await ScanJob.deleteMany({ orgId });
    await ThreatMemory.deleteMany({ orgId });
    await AgentDecisionLog.deleteMany({ orgId });
    await NotificationLog.deleteMany({ orgId });
    console.log('🧹 Cleaned existing demo database tables');

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
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      });
      createdAssets.push(asset);
    }
    console.log(`✅ Seeded ${createdAssets.length} Brand Assets`);

    // 4. Create ThreatMemory entries
    const threatMemoryEntries = THREAT_DOMAINS.map(t => ({
      orgId,
      domain: t.domain,
      firstSeenAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      lastSeenAt: new Date(),
      totalViolations: t.violations,
      platforms: t.platforms,
      threatLevel: t.level,
      autoEscalate: t.level === 'critical',
      relatedDomains: t.related
    }));
    const createdThreats = await ThreatMemory.insertMany(threatMemoryEntries);
    console.log(`✅ Seeded ${createdThreats.length} Threat Memory Domain Nodes`);

    // 5. Create active and historical scan job
    const scanJob = await ScanJob.create({
      orgId,
      assetId: createdAssets[0]._id,
      status: 'completed',
      violationsFound: 28,
      assetsScanned: createdAssets.length,
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 110 * 60 * 1000)
    });

    // 6. Create 28 rich violations (mix of caseStatus, caseTimeline and DMCA drafts)
    const violations = [];
    const now = new Date();
    
    const caseStatuses = ['open', 'agent_reviewing', 'dmca_drafted', 'dmca_sent', 'takedown_requested', 'resolved', 'false_positive'];

    for (let i = 0; i < 28; i++) {
      const asset = createdAssets[i % createdAssets.length];
      const platform = PLATFORMS[i % PLATFORMS.length];
      const threatDomain = THREAT_DOMAINS[i % THREAT_DOMAINS.length];
      
      const caseStatus = caseStatuses[i % caseStatuses.length];
      const caseId = generateCaseId();
      const confidence = 55 + (i * 1.5);

      const detectedAt = new Date(now.getTime() - (i * 6 * 60 * 60 * 1000)); // staggered over last 7 days

      // Build caseTimeline details
      const caseTimeline = [
        { event: 'detected', description: `Detected by Scan Job #${scanJob._id.toString().substring(18)}. Confidence ${confidence}%`, timestamp: detectedAt },
      ];

      if (caseStatus !== 'open') {
        caseTimeline.push({ event: 'agent_classified', description: `Agent analyzed and assigned SEV ${Math.min(5, Math.ceil(confidence / 20))}. Cascade verified.`, timestamp: new Date(detectedAt.getTime() + 2 * 60 * 1000) });
      }

      let dmcaContent = null;
      let dmcaContactEmail = null;
      if (['dmca_drafted', 'dmca_sent', 'takedown_requested', 'resolved'].includes(caseStatus)) {
        dmcaContactEmail = `abuse@${threatDomain.domain}`;
        dmcaContent = `DMCA COPYRIGHT INFRINGEMENT NOTICE\n\nTo Whom It May Concern at ${threatDomain.domain},\n\nWe represent Piractrix Defense Systems. It has come to our attention that your website is distributing copyrighted material belonging to our client:\n\nAsset Title: ${asset.title}\nInfringing URL: https://${threatDomain.domain}/stream/leak_id_${i}\n\nPlease remove this material immediately.\n\nSincerely,\nShieldAgent\nPiractrix Platform`;
        caseTimeline.push({ event: 'dmca_drafted', description: `DMCA takedown notice auto-drafted by Gemini AI. Contact: ${dmcaContactEmail}`, timestamp: new Date(detectedAt.getTime() + 4 * 60 * 1000) });
      }

      if (['dmca_sent', 'takedown_requested', 'resolved'].includes(caseStatus)) {
        caseTimeline.push({ event: 'notified', description: `Rights holder notified. Action executed: ${caseStatus}.`, timestamp: new Date(detectedAt.getTime() + 6 * 60 * 1000) });
      }

      if (caseStatus === 'resolved') {
        caseTimeline.push({ event: 'resolved', description: 'Infringing stream removed. Target offline.', timestamp: new Date(detectedAt.getTime() + 24 * 60 * 60 * 1000) });
      } else if (caseStatus === 'false_positive') {
        caseTimeline.push({ event: 'false_positive', description: 'Marked as false positive by human reviewer.', timestamp: new Date(detectedAt.getTime() + 10 * 60 * 1000) });
      }

      violations.push({
        orgId,
        assetId: asset._id,
        scanJobId: scanJob._id,
        sourceUrl: `https://${threatDomain.domain}/stream/leak_id_${i}`,
        sourceDomain: threatDomain.domain,
        platform,
        matchConfidence: confidence,
        matchType: confidence > 80 ? 'exact' : 'partial',
        status: caseStatus === 'resolved' ? 'resolved' : caseStatus === 'false_positive' ? 'false_positive' : 'open',
        caseStatus,
        caseId,
        dmcaContent,
        dmcaContactEmail,
        dmcaGeneratedAt: dmcaContent ? new Date(detectedAt.getTime() + 4 * 60 * 1000) : null,
        dmcaGeneratedBy: dmcaContent ? 'gemini' : null,
        caseTimeline,
        detectedAt,
        screenshotUrl: platform === 'youtube' 
          ? 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg' 
          : 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&q=80'
      });
    }

    const createdViolations = await Violation.insertMany(violations);
    console.log(`✅ Seeded ${createdViolations.length} Detailed Cases & CaseTimelines`);

    // Update Asset counts
    for (const asset of createdAssets) {
      const count = await Violation.countDocuments({ assetId: asset._id, orgId });
      await Asset.findByIdAndUpdate(asset._id, { violationsFound: count });
    }

    // 7. Create 20+ Agent Decision Logs
    const decisionLogs = [];
    for (let i = 0; i < 22; i++) {
      const asset = createdAssets[i % createdAssets.length];
      const platform = PLATFORMS[i % PLATFORMS.length];
      const threatDomain = THREAT_DOMAINS[i % THREAT_DOMAINS.length];
      const severity = Math.min(5, Math.max(1, Math.round((i * 4 + 35) / 20))); // SEV 2-5
      const autonomousMode = i % 2 === 0;

      const action = severity === 5 ? 'auto_escalate' : (severity === 4 ? 'draft_dmca' : (severity === 3 ? 'create_alert' : 'log_only'));
      const outcome = i % 8 === 0 ? 'failed' : i % 5 === 0 ? 'pending' : 'success';

      const reasoning = `ShieldAgent v2.0 evaluated scanned record at ${platform} domain ${threatDomain.domain}. Match confidence is ${60 + i * 1.8}% (PHash match). ThreatMemory lookup shows ${threatDomain.violations} prior infringements. Action decided: ${action}.`;

      decisionLogs.push({
        orgId,
        assetId: asset._id,
        violationId: createdViolations[i]._id,
        decisionType: 'violation_classified',
        input: {
          confidence: 60 + i * 1.8,
          matchType: 'partial',
          platform,
          domainReputation: threatDomain.domain,
          assetType: asset.type
        },
        reasoning,
        action,
        outcome,
        autonomousMode,
        agentVersion: '2.0',
        createdAt: new Date(now.getTime() - (i * 8 * 60 * 60 * 1000)),
        meta: {
          severityResult: {
            severity,
            threatCategory: 'stream_mirror',
            decisionRule: `sev_${severity}_rule`,
            meta: {
              cascade: {
                stages: [
                  { step: 1, name: 'keyword_filter', passed: true, score: 90, ms: 12 },
                  { step: 2, name: 'fingerprint_match', passed: true, ms: 80 },
                  { step: 3, name: 'vision_verify', passed: true, ms: 250 }
                ]
              }
            }
          },
          execResult: {
            outcome,
            totalMs: 1420,
            channels: ['email', 'slack', 'whatsapp'],
            details: { repeatOffenderCount: threatDomain.violations }
          }
        }
      });
    }
    const createdDecisions = await AgentDecisionLog.insertMany(decisionLogs);
    console.log(`✅ Seeded ${createdDecisions.length} Agent Decision Logs (Agent v2.0)`);

    // 8. Create 5 active Alerts
    const alerts = createdViolations.slice(0, 5).map((v, i) => ({
      orgId,
      violationId: v._id,
      type: 'high_confidence',
      severity: 'high',
      title: `Critical Alert: ${v.sourceDomain}`,
      message: `Gemini classified violation as SEV 5. Auto-escalated enforcement notice generated.`,
      read: false,
      createdAt: new Date()
    }));
    await Alert.insertMany(alerts);
    console.log('🔔 Seeded 5 Active Alert Records');

    // 9. Seed 12 Notification Logs
    const notificationLogs = [];
    const channels = ['email', 'whatsapp', 'telegram', 'slack', 'push'];
    for (let i = 0; i < 12; i++) {
      notificationLogs.push({
        orgId,
        violationId: createdViolations[i]._id,
        channel: channels[i % channels.length],
        status: i % 10 === 0 ? 'failed' : 'delivered',
        sentAt: new Date(now.getTime() - (i * 12 * 60 * 60 * 1000)),
        meta: { receiver: 'rights_holder' }
      });
    }
    await NotificationLog.insertMany(notificationLogs);
    console.log(`✅ Seeded 12 Audited Notification Channel Deliveries`);

    console.log('\n✨ PIRACTRIX DEMO SEED COMPLETED SUCCESSFULLY!');
    console.log(`   Demo Org Username: demo@piractrix.com`);
    console.log(`   Demo Org Password: Piractrix@2026`);
    console.log(`   Ready for full operations simulation.`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seed();
