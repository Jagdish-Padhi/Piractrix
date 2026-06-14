import NotificationLog from '../models/notificationLog.model.js';

let bot = null;
async function getBot() {
  if (!bot && process.env.TELEGRAM_BOT_TOKEN) {
    try {
      const { Telegraf } = await import('telegraf');
      bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    } catch (err) {
      console.warn('[telegram] Failed to import telegraf package:', err.message);
    }
  }
  return bot;
}

export async function sendTelegramAlert({ chatId, violation, severity, action }) {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const emoji = severity >= 5 ? '🚨' : severity >= 4 ? '⚠️' : 'ℹ️';
  
  const text =
    `${emoji} *Piractrix Agent Alert*\n\n` +
    `Platform: \`${violation.platform}\`\n` +
    `Confidence: \`${violation.matchConfidence}%\`\n` +
    `Match Type: \`${violation.matchType}\`\n` +
    `Action taken: \`${action?.replace(/_/g, ' ')}\`\n` +
    `Case: \`${violation.caseId || 'pending'}\`\n\n` +
    `[View in Dashboard](${clientUrl}/dashboard/violations/${violation._id})`;

  const activeBot = await getBot();
  if (!activeBot) {
    console.log(`[telegram MOCK] Sending alert to Chat ID ${chatId}:\n${text}`);
    await NotificationLog.create({
      orgId: violation.orgId,
      violationId: violation._id,
      channel: 'telegram',
      status: 'delivered',
      meta: { mock: true, recipient: chatId, body: text }
    });
    return true;
  }

  try {
    await activeBot.telegram.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });

    await NotificationLog.create({
      orgId: violation.orgId,
      violationId: violation._id,
      channel: 'telegram',
      status: 'delivered',
      meta: { recipient: chatId, telegram: true }
    });
    return true;
  } catch (err) {
    console.error('[telegram] Bot send failed:', err.message);
    await NotificationLog.create({
      orgId: violation.orgId,
      violationId: violation._id,
      channel: 'telegram',
      status: 'failed',
      meta: { error: err.message, recipient: chatId }
    });
    return false;
  }
}
