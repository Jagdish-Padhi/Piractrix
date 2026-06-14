import NotificationLog from '../models/notificationLog.model.js';

let webpush = null;
async function getWebPush() {
  if (!webpush && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    try {
      const wp = await import('web-push');
      webpush = wp.default;
      webpush.setVapidDetails(
        `mailto:${process.env.VAPID_EMAIL || 'security@piractrix.com'}`,
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );
    } catch (err) {
      console.warn('[push] Failed to import web-push package:', err.message);
    }
  }
  return webpush;
}

export async function sendPushNotification({ subscription, title, body, url, orgId, violationId }) {
  const wp = await getWebPush();
  
  if (!wp || !subscription) {
    console.log(`[push MOCK] Dispatching notification: ${title} - ${body} (URL: ${url})`);
    if (orgId && violationId) {
      await NotificationLog.create({
        orgId,
        violationId,
        channel: 'push',
        status: 'delivered',
        meta: { mock: true, title, body, url }
      });
    }
    return true;
  }

  try {
    const payload = JSON.stringify({
      title,
      body,
      url,
      icon: '/navlogo.png',
      badge: '/badge.png'
    });

    await wp.sendNotification(subscription, payload);

    if (orgId && violationId) {
      await NotificationLog.create({
        orgId,
        violationId,
        channel: 'push',
        status: 'delivered',
        meta: { push: true }
      });
    }
    return true;
  } catch (err) {
    console.error('[push] Send failed:', err.message);
    if (orgId && violationId) {
      await NotificationLog.create({
        orgId,
        violationId,
        channel: 'push',
        status: 'failed',
        meta: { error: err.message }
      });
    }
    return false;
  }
}
