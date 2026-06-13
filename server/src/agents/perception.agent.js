import Asset from '../models/asset.model.js';
import Violation from '../models/violation.model.js';
import ThreatMemory from '../models/threatMemory.model.js';
import { createScanJob, dispatchScanJob } from '../services/scans.service.js';

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
    const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now - 1 * 60 * 60 * 1000);

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
      // Only scan assets that had no violations but were updated recently
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
  const candidates = await selectAssetsForScan();
  const jobs = [];

  for (const asset of candidates) {
    const scanJob = await createScanJob({ orgId: asset.orgId, assetId: asset._id, keywords: [asset.title], platforms: ['youtube', 'web'] });
    jobs.push(scanJob);
    void dispatchScanJob(scanJob._id.toString());
  }

  return { scheduled: jobs.length };
}
