import { createAlertFromViolation } from '../services/alerts.service.js';
import { draftDmcaNotice } from '../services/violations.service.js';
import Violation from '../models/violation.model.js';

export async function executeAction({ orgId, violationId, action }) {
  try {
    if (action === 'create_alert') {
      const violation = violationId ? await Violation.findById(violationId).lean() : null;
      const platform = violation?.platform || 'unknown';
      const matchConfidence = violation?.matchConfidence ?? 0;
      const alerts = await createAlertFromViolation({ orgId, violationId, platform, matchConfidence });
      return { outcome: 'success', details: { alertsCount: alerts.length } };
    }

    if (action === 'draft_dmca') {
      const draft = await draftDmcaNotice({ orgId, violationId });
      // For safety we don't auto-send; we store/return the draft
      return { outcome: 'success', details: { draft } };
    }

    if (action === 'queue_review') {
      // A review queue can be implemented later; for now create an alert
      const violation = violationId ? await Violation.findById(violationId).lean() : null;
      const platform = violation?.platform || 'unknown';
      const matchConfidence = violation?.matchConfidence ?? 0;
      const alerts = await createAlertFromViolation({ orgId, violationId, platform, matchConfidence });
      return { outcome: 'pending', details: { queued: true, alertsCount: alerts.length } };
    }

    return { outcome: 'skipped' };
  } catch (error) {
    return { outcome: 'failed', error: error?.message || String(error) };
  }
}
