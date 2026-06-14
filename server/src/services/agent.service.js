import AgentDecisionLog from '../models/agentDecisionLog.model.js';
import ThreatMemory from '../models/threatMemory.model.js';
import AgentStatus from '../models/agentStatus.model.js';
import QueryIntelligence from '../models/queryIntelligence.model.js';
import { executeAction } from '../agents/executor.agent.js';
import { emitAgentDecision } from '../config/socket.js';

export async function getAgentStatus(orgId) {
  let statusDoc = await AgentStatus.findOne({ orgId }).lean();
  if (!statusDoc) {
    statusDoc = await AgentStatus.create({ orgId, autonomousMode: false });
  }
  const lastDecision = await AgentDecisionLog.findOne({ orgId }).sort({ createdAt: -1 }).lean();
  return {
    autonomousMode: statusDoc.autonomousMode || false,
    status: statusDoc.autonomousMode ? 'active' : 'assisted',
    lastRun: statusDoc.lastRun || (lastDecision ? lastDecision.createdAt : null),
    heartbeat: statusDoc.lastHeartbeat || null
  };
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

export async function setMode({ orgId, mode }) {
  const statusDoc = await AgentStatus.findOneAndUpdate(
    { orgId },
    { autonomousMode: Boolean(mode) },
    { upsert: true, new: true }
  );
  return { autonomousMode: statusDoc.autonomousMode };
}

export async function setThreatEscalate({ orgId, domain, autoEscalate }) {
  const doc = await ThreatMemory.findOneAndUpdate(
    { orgId, domain },
    { autoEscalate: Boolean(autoEscalate) },
    { new: true }
  );
  if (!doc) {
    const err = new Error('Threat memory not found');
    err.statusCode = 404;
    throw err;
  }
  return doc;
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

  // Pass severity & log reference to the executor
  const severity = decision.meta?.severityResult?.severity || 3;
  const result = await executeAction({ orgId, violationId, action, severity, agentDecisionId: decisionId });

  decision.outcome = result?.outcome || 'pending';
  await decision.save();

  emitAgentDecision({ orgId, decision: { decisionId, approved: true, outcome: decision.outcome } });

  return { success: true, outcome: decision.outcome };
}

export async function getStats({ orgId }) {
  const total = await AgentDecisionLog.countDocuments({ orgId });
  const actionsTaken = await AgentDecisionLog.countDocuments({ orgId, outcome: 'success' });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const decisionsLast24h = await AgentDecisionLog.countDocuments({ orgId, createdAt: { $gte: since } });

  const breakdownAgg = await AgentDecisionLog.aggregate([
    { $match: { orgId } },
    { $group: { _id: '$action', count: { $sum: 1 } } },
  ]);
  const breakdown = breakdownAgg.reduce((acc, cur) => { acc[cur._id] = cur.count; return acc; }, {});

  const threatDomainsCount = await ThreatMemory.countDocuments({ orgId });

  return { totalDecisions: total, actionsTaken, decisionsLast24h, breakdown, threatDomainsCount };
}

export async function listQueryIntelligence({ orgId, page = 1, limit = 20 }) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    QueryIntelligence.find({ orgId }).sort({ hitRate: -1, timesUsed: -1 }).skip(skip).limit(limit).lean(),
    QueryIntelligence.countDocuments({ orgId }),
  ]);
  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
