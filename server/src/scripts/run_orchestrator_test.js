import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import Organization from '../models/organization.model.js';
import Asset from '../models/asset.model.js';
import Violation from '../models/violation.model.js';
import { runAgentOnScanComplete } from '../agents/orchestrator.agent.js';

async function run() {
  try {
    await connectDatabase();

    // Ensure demo org
    const org = await Organization.findOneAndUpdate(
      { email: 'demo@local' },
      { orgName: 'Demo Org', email: 'demo@local', passwordHash: 'DEMO_HASH' },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const orgId = org._id;

    // Ensure demo asset
    const asset = await Asset.findOneAndUpdate(
      { orgId, title: 'Demo Asset' },
      {
        orgId,
        title: 'Demo Asset',
        type: 'video',
        storageKey: 'demo',
        gcsUrl: 'http://example.com/video.mp4',
        fileSize: 123,
        uploadedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const scanJobId = new mongoose.Types.ObjectId();

    // Create a Violation record the orchestrator expects
    const violation = await Violation.create({
      orgId,
      assetId: asset._id,
      scanJobId,
      sourceUrl: 'http://pirate.example/video/1',
      sourceDomain: 'example-pirate.test',
      platform: 'youtube',
      matchConfidence: 78,
      matchType: 'near-duplicate',
      detectedAt: new Date(),
    });

    console.log('Created violation:', violation._id.toString());

    // Run orchestrator (will call ML service if available; falls back safely)
    await runAgentOnScanComplete({ orgId, scanJobId, violations: [violation.toObject()] });

    console.log('Orchestrator run complete.');
    process.exit(0);
  } catch (err) {
    console.error('Orchestrator test failed:', err);
    process.exit(1);
  }
}

run();