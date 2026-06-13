import AgentDecisionLog from '../models/agentDecisionLog.model.js';

/**
 * Simple rule engine to decide action based on severity and threat memory.
 */
export async function decideForViolation({ orgId, violation, severityResult, threatEntry, autonomousMode = false }) {
  const severity = Number(severityResult?.severity || 1);
  let action = 'log_only';
  let decisionType = 'violation_classified';

  if (severity >= 5) {
    action = 'draft_dmca';
    decisionType = 'violation_escalated';
  } else if (severity >= 4) {
    action = 'draft_dmca';
  } else if (severity >= 3) {
    action = 'queue_review';
  } else if (severity >= 2) {
    action = 'create_alert';
  } else {
    action = 'log_only';
  }

  // Boost action for repeat offenders
  if (threatEntry && (threatEntry.totalViolations || 0) >= 3) {
    if (action === 'queue_review') action = 'draft_dmca';
    if (action === 'create_alert') action = 'queue_review';
  }

  const reasoning = (severityResult && severityResult.reasoning) || `Engine decided action ${action} for severity ${severity}.`;

  // Persist a decision-log entry (left to orchestrator to write full log), but return payload.
  return {
    decisionType,
    action,
    reasoning,
    autonomousMode: Boolean(autonomousMode),
    severity,
    sendImmediately: severity >= 5,
  };
}
