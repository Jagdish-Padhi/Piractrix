import fetch from 'node-fetch';
import NotificationLog from '../models/notificationLog.model.js';

export async function sendSlackAlert({ webhookUrl, violation, severity, action, dmcaDraft }) {
  if (!webhookUrl) {
    console.warn('[slack] No webhook URL configured');
    return false;
  }

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const color = severity >= 5 ? '#E24B4A' : severity >= 4 ? '#BA7517' : '#3B8BD4';
  
  const body = {
    attachments: [{
      color,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: `${severity >= 5 ? '🚨' : '⚠️'} Piractrix Alert — ${action?.replace(/_/g, ' ').toUpperCase()}` } },
        { type: 'section', fields: [
          { type: 'mrkdwn', text: `*Platform:*\n${violation.platform}` },
          { type: 'mrkdwn', text: `*Confidence:*\n${violation.matchConfidence}%` },
          { type: 'mrkdwn', text: `*Match Type:*\n${violation.matchType}` },
          { type: 'mrkdwn', text: `*Severity:*\nSEV ${severity}` },
        ]},
        { type: 'section', text: { type: 'mrkdwn', text: `*Case ID:* \`${violation.caseId || 'PIR-PENDING'}\`` } },
        { type: 'actions', elements: [{
          type: 'button', style: 'primary',
          text: { type: 'plain_text', text: 'View Case' },
          url: `${clientUrl}/dashboard/violations/${violation._id}`
        }]}
      ]
    }]
  };

  try {
    if (webhookUrl.includes('mock-slack') || webhookUrl.startsWith('mock')) {
      console.log(`[slack MOCK] Dispatching to webhook:\n`, JSON.stringify(body, null, 2));
      await NotificationLog.create({
        orgId: violation.orgId,
        violationId: violation._id,
        channel: 'slack',
        status: 'delivered',
        meta: { mock: true, body }
      });
      return true;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}`);
    }

    await NotificationLog.create({
      orgId: violation.orgId,
      violationId: violation._id,
      channel: 'slack',
      status: 'delivered',
      meta: { slack: true }
    });
    return true;
  } catch (err) {
    console.error('[slack] Webhook push failed:', err.message);
    await NotificationLog.create({
      orgId: violation.orgId,
      violationId: violation._id,
      channel: 'slack',
      status: 'failed',
      meta: { error: err.message, webhook: webhookUrl }
    });
    return false;
  }
}
