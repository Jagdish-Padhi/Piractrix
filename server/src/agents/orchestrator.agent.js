import fetch from 'node-fetch';
import Asset from '../models/asset.model.js';
import { runConfidenceCascade } from './confidenceCascade.agent.js';
import AgentDecisionLog from '../models/agentDecisionLog.model.js';
import Violation from '../models/violation.model.js';
import { findThreatByDomain, upsertThreat } from './memory.agent.js';
import { decideForViolation } from './decision.agent.js';
import { executeAction } from './executor.agent.js';
import { emitAgentDecision } from '../config/socket.js';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';

export async function runAgentOnScanComplete({ orgId, scanJobId, violations }) {
  try {
    if (!Array.isArray(violations) || violations.length === 0) return;

    for (const violation of violations) {
      try {
        const payload = {
          confidence: violation.matchConfidence || 0,
          matchType: violation.matchType || null,
          platform: violation.platform || null,
          domainReputation: violation.sourceDomain || null,
          assetType: violation.assetId?.type || null,
        };

        // 0. Enrich scan/violation with asset and run confidence cascade
        let severityResult = null;
        try {
          const asset = violation.assetId ? await Asset.findById(violation.assetId).lean() : null;
        
          const cascade = await runConfidenceCascade({
            mlBaseUrl: ML_SERVICE_URL,
            asset,
            scanResult: violation,
          });
        
          // short-circuit: insufficient signal -> low severity
          if (cascade?.skip) {
            severityResult = { severity: 1, reasoning: `Cascade: ${cascade.reason}`, meta: cascade.meta };
          } else {
            // if cascade adjusted confidence, pass it to classifier
            const classifierPayload = {
              confidence: typeof cascade.adjustedConfidence !== 'undefined' ? Math.round(cascade.adjustedConfidence) : (violation.matchConfidence || 0),
              matchType: violation.matchType || null,
              platform: violation.platform || null,
              domainReputation: violation.sourceDomain || null,
              assetType: asset?.type || null,
            };
        
            // Call ML classifier (existing code) with classifierPayload
            try {
              const resp = await fetch(`${ML_SERVICE_URL}/ml/classify-severity`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(classifierPayload),
                timeout: 12000,
              });
              if (resp.ok) {
                severityResult = await resp.json();
                // attach cascade meta for logging
                severityResult.meta = { ...(severityResult.meta || {}), cascade: cascade.meta || {} };
              } else {
                // fallback to rule-based mapping if classifier fails
                severityResult = { severity: Math.min(5, Math.max(1, Math.round(classifierPayload.confidence / 20))), reasoning: 'Classifier unavailable, used fallback mapping', meta: { cascade: cascade.meta || {} } };
              }
            } catch (e) {
              severityResult = { severity: Math.min(5, Math.max(1, Math.round((classifierPayload.confidence || 0) / 20))), reasoning: 'Classifier request failed, used fallback mapping', meta: { cascade: cascade.meta || {}, error: String(e) } };
            }
          }
        } catch (e) {
          // On cascade errors, fall back to rule-based
          severityResult = { severity: Math.min(5, Math.max(1, Math.round((violation.matchConfidence || 0) / 20))), reasoning: 'Cascade failed, used fallback mapping', meta: { error: String(e) } };
        }

        // 2) Check ThreatMemory
        const domain = violation.sourceDomain || null;
        const threatEntry = await findThreatByDomain({ orgId: violation.orgId || orgId, domain });

        // 3) Run decision engine
        const decision = await decideForViolation({
          orgId: violation.orgId || orgId,
          violation,
          severityResult,
          threatEntry,
          autonomousMode: true,
        });

        // 4) Execute action
        const execResult = await executeAction({ orgId: violation.orgId || orgId, violationId: violation._id, action: decision.action });

        // 5) Write AgentDecisionLog
        await AgentDecisionLog.create({
          orgId: violation.orgId || orgId,
          assetId: violation.assetId || null,
          violationId: violation._id,
          decisionType: decision.decisionType || 'action_taken',
          input: payload,
          reasoning: decision.reasoning || (severityResult && severityResult.reasoning) || '',
          action: decision.action,
          outcome: execResult?.outcome || 'pending',
          agentVersion: '1.0',
          autonomousMode: decision.autonomousMode || false,
          meta: { severityResult, execResult },
        });

        // 6) Update ThreatMemory
        try {
          if (domain) {
            await upsertThreat({ orgId: violation.orgId || orgId, domain, platform: violation.platform });
          }
        } catch (e) {
          // ignore
        }

        // 7) Emit socket event
        try {
          emitAgentDecision({ orgId: violation.orgId || orgId, decision: { violationId: violation._id, action: decision.action, reasoning: decision.reasoning } });
        } catch (e) {
          // ignore emit errors
        }
      } catch (inner) {
        console.error('[orchestrator] failure processing violation:', inner);
      }
    }
  } catch (error) {
    console.error('[orchestrator] runAgentOnScanComplete failed:', error);
  }
}