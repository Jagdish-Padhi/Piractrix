import Asset from '../models/asset.model.js';
import Violation from '../models/violation.model.js';
import ThreatMemory from '../models/threatMemory.model.js';
import { createScanJob, dispatchScanJob } from '../services/scans.service.js';
import { emitAgentPerception, emitAgentHeartbeat } from '../config/socket.js';

/**
 * Decide which assets should be scanned this run based on risk rules.
 */
export async function selectAssetsForScan() {
  const assets = await Asset.find({ status: 'active' }).lean();
  const now = Date.now();
  const candidates = [];

  for (const asset of assets) {
    const assetId = asset._id;
    const orgId = asset.orgId;

    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    // Count recent violations
    const recentViolations = await Violation.countDocuments({ orgId, assetId, detectedAt: { $gte: sevenDaysAgo } });

    // Check threat memory for known pirate domains for this org
    const threatCount = await ThreatMemory.countDocuments({ orgId, threatLevel: { $in: ['high', 'critical'] } });

    // New assets (<48 hours old)
    const createdAt = asset.createdAt ? new Date(asset.createdAt).getTime() : 0;
    const isNew = createdAt && now - createdAt < 48 * 60 * 60 * 1000;

    let shouldScan = false;

    if (threatCount > 0) {
      // critical: scan frequently
      shouldScan = true;
    } else if (recentViolations > 0) {
      // high risk: scan every run
      shouldScan = true;
    } else if (isNew) {
      shouldScan = true;
    } else {
      // low risk: sample (scan less frequently)
      const lastScanned = asset.lastScannedAt ? new Date(asset.lastScannedAt).getTime() : 0;
      if (!asset.lastScannedAt || now - lastScanned > 24 * 60 * 60 * 1000) {
        shouldScan = true;
      }
    }

    if (shouldScan) candidates.push(asset);
  }

  return candidates;
}

export async function runPerceptionScheduling() {
  const assets = await Asset.find({ status: 'active' }).lean();
  const candidates = await selectAssetsForScan();
  const now = Date.now();
  
  // Track statistics per organization
  const orgStats = {};
  
  // Initialize stats maps
  for (const asset of assets) {
    const oId = String(asset.orgId);
    if (!orgStats[oId]) {
      orgStats[oId] = {
        orgId: asset.orgId,
        assetsChecked: 0,
        highRiskCount: 0,
        scheduledCount: 0
      };
    }
    orgStats[oId].assetsChecked++;
    
    // Check risk flags
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const recentViolations = await Violation.countDocuments({ orgId: asset.orgId, assetId: asset._id, detectedAt: { $gte: sevenDaysAgo } });
    const threatCount = await ThreatMemory.countDocuments({ orgId: asset.orgId, threatLevel: { $in: ['high', 'critical'] } });
    
    if (recentViolations > 0 || threatCount > 0) {
      orgStats[oId].highRiskCount++;
    }

    // Check if scan frequency upgraded (recent violations in last 72 hours > 3)
    const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);
    const recentViolations72h = await Violation.countDocuments({ orgId: asset.orgId, assetId: asset._id, detectedAt: { $gte: threeDaysAgo } });
    if (recentViolations72h > 3) {
      try {
        emitAgentPerception({
          orgId: asset.orgId,
          event: {
            type: 'scan_frequency_upgraded',
            assetId: asset._id,
            assetTitle: asset.title,
            reason: 'high_violation_count',
            newFrequency: '2h',
            previousFrequency: '24h',
            triggeredBy: `${recentViolations72h} violations in last 72h`,
            timestamp: new Date().toISOString(),
          }
        });
      } catch (err) {
        console.error('[perceptionAgent] Emit perception failed:', err.message);
      }
    }
  }

  const jobs = [];
  for (const asset of candidates) {
    const oId = String(asset.orgId);
    if (orgStats[oId]) {
      orgStats[oId].scheduledCount++;
    }

    const scanJob = await createScanJob({ orgId: asset.orgId, assetId: asset._id, keywords: [asset.title], platforms: ['youtube', 'web'] });
    jobs.push(scanJob);
    void dispatchScanJob(scanJob._id.toString());
  }

  // Emit heartbeats for all involved orgs
  for (const stats of Object.values(orgStats)) {
    try {
      emitAgentHeartbeat({
        orgId: stats.orgId,
        status: {
          assetsChecked: stats.assetsChecked,
          highRiskCount: stats.highRiskCount,
          scheduledCount: stats.scheduledCount,
          alive: true
        }
      });
    } catch (err) {
      console.error('[perceptionAgent] Emit heartbeat failed:', err.message);
    }
  }

  return { scheduled: jobs.length };
}
