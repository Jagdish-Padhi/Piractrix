import { createAlertFromViolation } from '../services/alerts.service.js';
import { draftDmcaNotice } from '../services/violations.service.js';
import { sendViolationAlertEmail } from '../services/email.service.js';
import { sendWhatsAppAlert } from '../services/whatsapp.service.js';
import { sendTelegramAlert } from '../services/telegram.service.js';
import { sendSlackAlert } from '../services/slack.service.js';
import Violation from '../models/violation.model.js';
import Organization from '../models/organization.model.js';
import { generateCaseId } from '../utils/caseId.js';

async function notifyAllChannels({ org, violation, dmcaDraft, severity, action }) {
  const channels = [];
  const prefs = org.notificationPrefs || {};
  const minSev = prefs.alertMinSeverity || 3;

  if (severity < minSev) return { channels };

  // Email (always if enabled)
  if (prefs.emailOnHighConfidence && org.email) {
    try {
      await sendViolationAlertEmail(org.email, violation);
      channels.push('email');
    } catch (e) {
      console.warn('[executor] email failed:', e.message);
    }
  }

  // WhatsApp (for high severity)
  if (prefs.whatsappEnabled && prefs.whatsappNumber && severity >= (prefs.whatsappMinSeverity || 5)) {
    try {
      await sendWhatsAppAlert({ to: prefs.whatsappNumber, org, violation, dmcaDraft, severity });
      channels.push('whatsapp');
    } catch (e) {
      console.warn('[executor] whatsapp failed:', e.message);
    }
  }

  // Telegram
  if (prefs.telegramEnabled && prefs.telegramChatId) {
    try {
      await sendTelegramAlert({ chatId: prefs.telegramChatId, violation, severity, action });
      channels.push('telegram');
    } catch (e) {
      console.warn('[executor] telegram failed:', e.message);
    }
  }

  // Slack
  if (prefs.slackEnabled && prefs.slackWebhookUrl) {
    try {
      await sendSlackAlert({ webhookUrl: prefs.slackWebhookUrl, violation, severity, action, dmcaDraft });
      channels.push('slack');
    } catch (e) {
      console.warn('[executor] slack failed:', e.message);
    }
  }

  return { channels };
}

export async function executeAction({ orgId, violationId, action, severity = 3, agentDecisionId = null }) {
  const start = Date.now();
  try {
    const [violationDoc, org] = await Promise.all([
      Violation.findById(violationId),
      Organization.findById(orgId).lean(),
    ]);
    if (!violationDoc) return { outcome: 'failed', error: 'Violation not found' };

    const violation = violationDoc.toObject();
    const caseId = violation.caseId || generateCaseId();
    const timelineBase = { timestamp: new Date() };

    if (action === 'log_only') {
      await Violation.findByIdAndUpdate(violationId, {
        caseStatus: 'open',
        caseId,
        agentDecisionId,
        $push: { caseTimeline: { ...timelineBase, event: 'detected', description: 'Violation logged in passive telemetry mode.' } }
      });
      return { outcome: 'skipped', details: { reason: 'severity_below_threshold', caseId }, totalMs: Date.now() - start };
    }

    if (action === 'create_alert') {
      const alerts = await createAlertFromViolation({ orgId, violationId, platform: violation.platform, matchConfidence: violation.matchConfidence });
      await Violation.findByIdAndUpdate(violationId, {
        caseStatus: 'agent_reviewing',
        caseId,
        agentDecisionId,
        $push: { caseTimeline: { ...timelineBase, event: 'agent_classified', description: `Agent reviewed and created alert. Confidence: ${violation.matchConfidence}%` } }
      });
      const { channels } = await notifyAllChannels({ org, violation: { ...violation, caseId }, severity, action });
      
      if (channels.length > 0) {
        await Violation.findByIdAndUpdate(violationId, {
          $push: { caseTimeline: { ...timelineBase, event: 'notified', description: `Rights holder alerted via: ${channels.join(', ')}` } }
        });
      }

      return { outcome: 'success', details: { alertsCount: alerts.length, channels, caseId }, totalMs: Date.now() - start };
    }

    if (action === 'queue_review') {
      await Violation.findByIdAndUpdate(violationId, {
        caseStatus: 'agent_reviewing',
        caseId,
        agentDecisionId,
        $push: { caseTimeline: { ...timelineBase, event: 'queued_review', description: 'Agent queued for human review. Confidence borderline or new domain.' } }
      });
      await createAlertFromViolation({ orgId, violationId, platform: violation.platform, matchConfidence: violation.matchConfidence });
      return { outcome: 'pending', details: { queued: true, caseId }, totalMs: Date.now() - start };
    }

    if (action === 'draft_dmca' || action === 'auto_escalate') {
      const draft = await draftDmcaNotice({ orgId, violationId });

      await Violation.findByIdAndUpdate(violationId, {
        caseStatus: 'dmca_drafted',
        caseId,
        agentDecisionId,
        dmcaContent: draft.draft,
        dmcaContactEmail: draft.contactEmail,
        dmcaGeneratedAt: new Date(),
        dmcaGeneratedBy: draft.generatedBy,
        $push: { caseTimeline: { ...timelineBase, event: 'dmca_drafted', description: `DMCA notice drafted by ${draft.generatedBy === 'gemini' ? 'Gemini AI' : 'template'}. Contact: ${draft.contactEmail}`, meta: { contactEmail: draft.contactEmail } } }
      });

      const { channels } = await notifyAllChannels({ org, violation: { ...violation, caseId }, dmcaDraft: draft, severity, action });

      if (channels.length > 0) {
        await Violation.findByIdAndUpdate(violationId, {
          $push: { caseTimeline: { ...timelineBase, event: 'notified', description: `Rights holder notified via: ${channels.join(', ')}` } }
        });
      }

      // For auto_escalate: also create a critical alert
      if (action === 'auto_escalate') {
        await createAlertFromViolation({ orgId, violationId, platform: violation.platform, matchConfidence: violation.matchConfidence });
      }

      return {
        outcome: 'success',
        details: { draft, channels, caseId, notified: channels.length > 0 },
        totalMs: Date.now() - start,
        channels,
      };
    }

    return { outcome: 'skipped', totalMs: Date.now() - start };
  } catch (error) {
    console.error('[executor] executeAction error:', error);
    return { outcome: 'failed', error: error?.message || String(error), totalMs: Date.now() - start };
  }
}
