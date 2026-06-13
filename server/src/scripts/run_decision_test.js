import 'dotenv/config';
import { decideForViolation } from '../agents/decision.agent.js';

async function run() {
  try {
    const orgId = 'demo-org';
    const violation = {
      _id: 'violation-1',
      matchConfidence: 78,
      matchType: 'near-duplicate',
      platform: 'youtube',
      assetId: { type: 'video' },
    };

    // Simulate ML output + threat memory
    const severityResult = { severity: 4, reasoning: 'Simulated ML: high severity' };
    const threatEntry = { totalViolations: 3 }; // triggers repeat-offender boost

    const decision = await decideForViolation({
      orgId,
      violation,
      severityResult,
      threatEntry,
      autonomousMode: false,
    });

    console.log('Decision result:', decision);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();