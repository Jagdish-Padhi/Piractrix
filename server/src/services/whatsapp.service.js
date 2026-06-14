import NotificationLog from '../models/notificationLog.model.js';

let twilioClient = null;
async function getClient() {
  if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    try {
      const twilio = await import('twilio');
      twilioClient = twilio.default(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    } catch (err) {
      console.warn('[whatsapp] Failed to import twilio package:', err.message);
    }
  }
  return twilioClient;
}

export async function sendWhatsAppAlert({ to, org, violation, dmcaDraft, severity }) {
  const client = await getClient();
  const sevEmoji = severity >= 5 ? '🚨' : severity >= 4 ? '⚠️' : 'ℹ️';
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  
  const message = severity >= 5
    ? `${sevEmoji} *PIRACTRIX CRITICAL*\n\n` +
      `Your content was found on *${violation.platform.toUpperCase()}*\n` +
      `Match: *${violation.matchConfidence}%* confidence\n` +
      `Type: ${violation.matchType}\n` +
      `Case ID: \`${violation.caseId || 'PIR-PENDING'}\`\n\n` +
      `✅ DMCA auto-drafted\n` +
      `Target: ${dmcaDraft?.contactEmail || 'platform abuse team'}\n\n` +
      `*Reply APPROVE to send DMCA immediately*\n` +
      `View case: ${clientUrl}/dashboard/violations/${violation._id}`
    : `${sevEmoji} *PIRACTRIX ALERT*\n\n` +
      `Potential violation on *${violation.platform}*\n` +
      `Confidence: ${violation.matchConfidence}%\n` +
      `Review: ${clientUrl}/dashboard/violations/${violation._id}`;

  if (!client) {
    console.log(`[whatsapp MOCK] Sending WhatsApp to ${to}:\n${message}`);
    // Log in database as delivered so it shows up in history
    await NotificationLog.create({
      orgId: org._id || org,
      violationId: violation._id,
      channel: 'whatsapp',
      status: 'delivered',
      meta: { mock: true, recipient: to, body: message }
    });
    return true;
  }

  try {
    await client.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886'}`,
      to: `whatsapp:${to}`,
      body: message,
    });
    
    await NotificationLog.create({
      orgId: org._id || org,
      violationId: violation._id,
      channel: 'whatsapp',
      status: 'delivered',
      meta: { recipient: to, twilio: true }
    });
    return true;
  } catch (err) {
    console.error('[whatsapp] Twilio send failed:', err.message);
    await NotificationLog.create({
      orgId: org._id || org,
      violationId: violation._id,
      channel: 'whatsapp',
      status: 'failed',
      meta: { error: err.message, recipient: to }
    });
    return false;
  }
}
