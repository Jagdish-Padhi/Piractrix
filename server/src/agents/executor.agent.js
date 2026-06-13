import { createAlertFromViolation } from '../services/alerts.service.js';
import { draftDmcaNotice } from '../services/violations.service.js';

export async function executeAction({ orgId, violationId, action }) {
  try {
    if (action === 'create_alert') {
      const alerts = await createAlertFromViolation({ orgId, violationId, platform: 'unknown', matchConfidence: 0 });
      return { outcome: 'success', details: { alertsCount: alerts.length } };
    }

    if (action === 'draft_dmca') {
      const draft = await draftDmcaNotice({ orgId, violationId });
      // For safety we don't auto-send; we store/return the draft
      return { outcome: 'success', details: { draft } };
    }

    if (action === 'queue_review') {
      // A review queue can be implemented later; for now create an alert
      const alerts = await createAlertFromViolation({ orgId, violationId, platform: 'unknown', matchConfidence: 0 });
      return { outcome: 'pending', details: { queued: true, alertsCount: alerts.length } };
    }

    return { outcome: 'skipped' };
  } catch (error) {
    return { outcome: 'failed', error: error?.message || String(error) };
  }
}
