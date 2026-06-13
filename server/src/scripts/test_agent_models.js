import 'dotenv/config';
import { connectDatabase } from '../config/database.js';
import AgentDecisionLog from '../models/agentDecisionLog.model.js';
import ThreatMemory from '../models/threatMemory.model.js';
import Organization from '../models/organization.model.js';

async function run() {
  try {
    await connectDatabase();

    const org = await Organization.findOneAndUpdate(
      { email: 'demo@local' },
      { orgName: 'Demo Org', email: 'demo@local', passwordHash: 'DEMO_HASH' },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const orgId = org._id;

    const sampleThreat = await ThreatMemory.findOneAndUpdate(
      { orgId, domain: 'example-pirate.test' },
      {
        orgId,
        domain: 'example-pirate.test',
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        totalViolations: 1,
        platforms: ['youtube'],
        threatLevel: 'medium',
        autoEscalate: false,
      },
      { upsert: true, new: true },
    );

    console.log('ThreatMemory sample upserted:', sampleThreat.domain);

    const sampleDecision = await AgentDecisionLog.create({
      orgId,
      assetId: null,
      violationId: null,
      decisionType: 'violation_classified',
      input: { confidence: 72, matchType: 'near-duplicate', platform: 'youtube' },
      reasoning: 'Sample reasoning: near-duplicate with moderate confidence.',
      action: 'queue_review',
      outcome: 'success',
      autonomousMode: false,
    });

    console.log('AgentDecisionLog sample created:', sampleDecision._id.toString());

    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

run();