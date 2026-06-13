import 'dotenv/config';
import { decideForViolation } from '../agents/decision.agent.js';

async function run() {
  try {
    const orgId = 'demo-org';
    const violation = {
      _id: 'violation-sev5',
      matchConfidence: 95,
      matchType: 'exact-duplicate',
      platform: 'youtube',
      assetId: { type: 'video' },
    };

    const severityResult = { severity: 5, reasoning: 'Simulated ML: critical' };
    const threatEntry = { totalViolations: 0 };

    const decision = await decideForViolation({
      orgId,
      violation,
      severityResult,
      threatEntry,
      autonomousMode: false,
    });

    console.log('Decision result:', decision);
    console.log('sendImmediately?', decision.sendImmediately === true);
    console.log('decisionType escalation?', decision.decisionType === 'violation_escalated');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
