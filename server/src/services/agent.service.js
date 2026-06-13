import AgentDecisionLog from '../models/agentDecisionLog.model.js';
import ThreatMemory from '../models/threatMemory.model.js';
import { executeAction } from '../agents/executor.agent.js';
import { emitAgentDecision } from '../config/socket.js';

// In-memory mode store per org. For demo/demo seed this is fine.
const modeByOrg = new Map();

export function getAgentStatus(orgId) {
  const mode = modeByOrg.get(String(orgId)) || false;
  return { autonomousMode: Boolean(mode), lastRun: null };
}

export async function listDecisions({ orgId, page = 1, limit = 20 }) {
  const skip = (page - 1) * limit;
  const query = { orgId };
  const [items, total] = await Promise.all([
    AgentDecisionLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AgentDecisionLog.countDocuments(query),
  ]);

  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getDecision({ orgId, id }) {
  return AgentDecisionLog.findOne({ _id: id, orgId }).lean();
}

export async function listThreatMemory({ orgId, page = 1, limit = 50 }) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    ThreatMemory.find({ orgId }).sort({ lastSeenAt: -1 }).skip(skip).limit(limit).lean(),
    ThreatMemory.countDocuments({ orgId }),
  ]);
  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export function setMode({ orgId, mode }) {
  modeByOrg.set(String(orgId), Boolean(mode));
  return { autonomousMode: Boolean(mode) };
}

export async function approveDecision({ orgId, decisionId }) {
  const decision = await AgentDecisionLog.findOne({ _id: decisionId, orgId });
  if (!decision) {
    const err = new Error('Decision not found');
    err.statusCode = 404;
    throw err;
  }

  // Execute the stored action
  const action = decision.action;
  const violationId = decision.violationId;

  const result = await executeAction({ orgId, violationId, action });

  decision.outcome = result?.outcome || 'pending';
  await decision.save();

  emitAgentDecision({ orgId, decision: { decisionId, approved: true, outcome: decision.outcome } });

  return { success: true, outcome: decision.outcome };
}

export async function getStats({ orgId }) {
  const total = await AgentDecisionLog.countDocuments({ orgId });
  const actionsTaken = await AgentDecisionLog.countDocuments({ orgId, outcome: 'success' });
  return { totalDecisions: total, actionsTaken };
}
