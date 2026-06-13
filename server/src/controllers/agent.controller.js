import * as AgentService from '../services/agent.service.js';

export async function getStatus(req, res, next) {
  try {
    const orgId = req.user.orgId;
    const status = AgentService.getAgentStatus(orgId);
    return res.json(status);
  } catch (error) {
    next(error);
  }
}

export async function listDecisions(req, res, next) {
  try {
    const orgId = req.user.orgId;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const result = await AgentService.listDecisions({ orgId, page, limit });
    return res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getDecision(req, res, next) {
  try {
    const orgId = req.user.orgId;
    const id = req.params.id;
    const item = await AgentService.getDecision({ orgId, id });
    if (!item) return res.status(404).json({ error: 'Not found' });
    return res.json(item);
  } catch (error) {
    next(error);
  }
}

export async function listThreatMemory(req, res, next) {
  try {
    const orgId = req.user.orgId;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 50);
    const result = await AgentService.listThreatMemory({ orgId, page, limit });
    return res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function setMode(req, res, next) {
  try {
    const orgId = req.user.orgId;
    const mode = req.body?.mode === true || req.body?.mode === 'true' || false;
    const result = AgentService.setMode({ orgId, mode });
    return res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function approveDecision(req, res, next) {
  try {
    const orgId = req.user.orgId;
    const decisionId = req.params.decisionId;
    const result = await AgentService.approveDecision({ orgId, decisionId });
    return res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getStats(req, res, next) {
  try {
    const orgId = req.user.orgId;
    const result = await AgentService.getStats({ orgId });
    return res.json(result);
  } catch (error) {
    next(error);
  }
}
