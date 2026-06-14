import Alert from '../models/alert.model.js';
import { emitAgentDecision } from '../config/socket.js';

export async function detectPlatformSurge({ orgId, recentViolations }) {
  const SURGE_THRESHOLD = 5;
  
  if (!Array.isArray(recentViolations) || recentViolations.length === 0) return;

  const platformCounts = {};
  for (const v of recentViolations) {
    if (!platformCounts[v.platform]) platformCounts[v.platform] = 0;
    platformCounts[v.platform]++;
  }

  for (const [platform, count] of Object.entries(platformCounts)) {
    if (count >= SURGE_THRESHOLD) {
      // Create critical alert
      try {
        const surgeAlert = await Alert.create({
          orgId,
          type: 'platform_surge',
          severity: 'critical',
          title: `${platform.toUpperCase()} Piracy Surge Detected`,
          message: `${count} violations from ${platform} in the last hour. Consider activating autonomous mode.`,
          metadata: { platform, count }
        });

        // Emit socket event
        emitAgentDecision({
          orgId,
          decision: {
            action: 'auto_escalate',
            reasoning: `SURGE DETECTED: ${count} violations from ${platform} in last 60 minutes. Threshold exceeded.`,
            autonomousMode: true,
            outcome: 'success',
            trace: {
              platform,
              surgeCount: count,
              decisionRule: 'surge_limit_exceeded',
              classifierResult: {
                severity: 5,
                threatCategory: 'coordinated_surge'
              }
            },
            timestamp: new Date().toISOString()
          }
        });
      } catch (err) {
        console.error('[surgeAgent] Failed to handle platform surge:', err.message);
      }
    }
  }
}
