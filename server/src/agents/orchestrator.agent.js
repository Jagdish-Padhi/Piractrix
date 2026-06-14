import mongoose from 'mongoose';
import fetch from 'node-fetch';
import Asset from '../models/asset.model.js';
import { runConfidenceCascade } from './confidenceCascade.agent.js';
import AgentDecisionLog from '../models/agentDecisionLog.model.js';
import Violation from '../models/violation.model.js';
import { findThreatByDomain, upsertThreat } from './memory.agent.js';
import { decideForViolation } from './decision.agent.js';
import { getAgentStatus } from '../services/agent.service.js';
import { executeAction } from './executor.agent.js';
import { emitAgentDecision } from '../config/socket.js';
import { detectPlatformSurge } from './surge.agent.js';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';

function fallbackSeverity(confidence, platform, matchType, threatEntry) {
  let sev = 1;
  if (confidence >= 85) sev = 5;
  else if (confidence >= 70) sev = 4;
  else if (confidence >= 50) sev = 3;
  else if (confidence >= 30) sev = 2;
  
  // Platform risk boost
  if (platform === 'telegram') sev = Math.min(5, sev + 1);
  
  // Repeat offender boost
  if (threatEntry?.totalViolations >= 5) sev = Math.min(5, sev + 1);
  
  // Match type boost
  if (matchType === 'exact') sev = Math.min(5, sev + 1);
  
  return sev;
}

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
        let usedFallback = false;

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
                severityResult.meta = { ...(severityResult.meta || {}), cascade: cascade.meta || {} };
              } else {
                usedFallback = true;
                const domain = violation.sourceDomain || null;
                const threatEntry = await findThreatByDomain({ orgId: violation.orgId || orgId, domain });
                const calculatedSev = fallbackSeverity(classifierPayload.confidence, violation.platform, violation.matchType, threatEntry);
                severityResult = {
                  severity: calculatedSev,
                  threatCategory: asset?.type === 'exam_paper' ? 'leak_forum' : 'stream_ripper',
                  reasoning: 'Classifier unavailable, used rule-based fallback mapping',
                  meta: { cascade: cascade.meta || {}, usedFallback: true }
                };
              }
            } catch (e) {
              usedFallback = true;
              const domain = violation.sourceDomain || null;
              const threatEntry = await findThreatByDomain({ orgId: violation.orgId || orgId, domain });
              const calculatedSev = fallbackSeverity(classifierPayload.confidence, violation.platform, violation.matchType, threatEntry);
              severityResult = {
                severity: calculatedSev,
                threatCategory: asset?.type === 'exam_paper' ? 'leak_forum' : 'stream_ripper',
                reasoning: 'Classifier request failed, used rule-based fallback mapping',
                meta: { cascade: cascade.meta || {}, error: String(e), usedFallback: true }
              };
            }
          }
        } catch (e) {
          usedFallback = true;
          const domain = violation.sourceDomain || null;
          const threatEntry = await findThreatByDomain({ orgId: violation.orgId || orgId, domain });
          const calculatedSev = fallbackSeverity(violation.matchConfidence || 0, violation.platform, violation.matchType, threatEntry);
          severityResult = {
            severity: calculatedSev,
            threatCategory: 'unknown',
            reasoning: 'Cascade failed, used rule-based fallback mapping',
            meta: { error: String(e), usedFallback: true }
          };
        }

        // 2) Check ThreatMemory
        const domain = violation.sourceDomain || null;
        const threatEntry = await findThreatByDomain({ orgId: violation.orgId || orgId, domain });

        // 3) Run decision engine
        const status = await getAgentStatus(violation.orgId || orgId) || { autonomousMode: false };
        const { autonomousMode } = status;

        const decision = await decideForViolation({
          orgId: violation.orgId || orgId,
          violation,
          severityResult,
          threatEntry,
          autonomousMode: Boolean(autonomousMode),
        });

        // 4) Pre-generate agent decision log ID to pass into execution action
        const agentDecisionId = new mongoose.Types.ObjectId();

        // 5) Execute action
        const execResult = await executeAction({
          orgId: violation.orgId || orgId,
          violationId: violation._id,
          action: decision.action,
          severity: decision.severity || severityResult?.severity || 3,
          agentDecisionId,
        });

        // 6) Write AgentDecisionLog (version 2.0)
        const savedLog = await AgentDecisionLog.create({
          _id: agentDecisionId,
          orgId: violation.orgId || orgId,
          assetId: violation.assetId || null,
          violationId: violation._id,
          decisionType: decision.decisionType || 'action_taken',
          input: payload,
          reasoning: decision.reasoning || (severityResult && severityResult.reasoning) || '',
          action: decision.action,
          outcome: execResult?.outcome || 'pending',
          agentVersion: '2.0',
          autonomousMode: decision.autonomousMode || false,
          meta: { severityResult, execResult, usedFallback },
        });

        // 7) Update ThreatMemory
        try {
          if (domain) {
            await upsertThreat({ orgId: violation.orgId || orgId, domain, platform: violation.platform });
          }
        } catch (e) {
          // ignore
        }

        // 8) Emit enriched socket event trace payload
        try {
          emitAgentDecision({
            orgId: violation.orgId || orgId,
            decision: {
              logId: savedLog._id,
              violationId: violation._id,
              action: decision.action,
              reasoning: decision.reasoning,
              autonomousMode: decision.autonomousMode,
              outcome: execResult?.outcome || 'pending',
              input: payload,
              trace: {
                platform: violation.platform,
                matchConfidence: violation.matchConfidence,
                cascadeStages: severityResult?.meta?.cascade?.stages || [],
                classifierResult: {
                  severity: severityResult?.severity,
                  threatCategory: severityResult?.threatCategory,
                },
                threatMemoryHit: Boolean(threatEntry),
                repeatOffenderCount: threatEntry?.totalViolations || 0,
                decisionRule: `sev_${severityResult?.severity}_rule${threatEntry ? '+repeat_offender' : ''}`,
                totalMs: execResult?.totalMs || null,
                usedFallback,
              },
              executionResult: execResult,
              timestamp: new Date().toISOString(),
            }
          });
        } catch (e) {
          console.error('[orchestrator] socket emit failure:', e.message);
        }
      } catch (inner) {
        console.error('[orchestrator] failure processing violation:', inner);
      }
    }

    // 9) Detect Platform Surge after batch completion
    try {
      await detectPlatformSurge({ orgId, recentViolations: violations });
    } catch (e) {
      console.error('[orchestrator] failed to trigger platform surge detection:', e.message);
    }

  } catch (error) {
    console.error('[orchestrator] runAgentOnScanComplete failed:', error);
  }
}