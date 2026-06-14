import { Router } from 'express';
import { verifyToken } from '../middlewares/verifyToken.js';
import {
	getOrganizationById,
	updateOrganizationNotificationPrefs,
} from '../services/auth.service.js';

const organizationRouter = Router();

organizationRouter.use(verifyToken);


organizationRouter.get('/me', async (req, res, next) => {
	try {
		const organization = await getOrganizationById(req.auth.orgId);

		if (!organization) {
			return res.status(404).json({ message: 'Organization not found.' });
		}

		return res.status(200).json({
			organization: {
				id: organization._id.toString(),
				orgName: organization.orgName,
				email: organization.email,
				plan: organization.plan,
				notificationPrefs: organization.notificationPrefs,
				createdAt: organization.createdAt,
				lastLoginAt: organization.lastLoginAt,
			},
			vapidPublicKey: process.env.VAPID_PUBLIC_KEY || null,
		});
	} catch (error) {
		return next(error);
	}
});

organizationRouter.patch('/notification-prefs', async (req, res, next) => {
	try {
		const updated = await updateOrganizationNotificationPrefs({
			organizationId: req.auth.orgId,
			payload: req.body,
		});

		return res.status(200).json({
			message: 'Notification preferences updated successfully.',
			notificationPrefs: updated?.notificationPrefs,
		});
	} catch (error) {
		return next(error);
	}
});

import { sendWhatsAppAlert } from '../services/whatsapp.service.js';

organizationRouter.post('/test-whatsapp', async (req, res, next) => {
	try {
		const organization = await getOrganizationById(req.auth.orgId);
		const { whatsappNumber } = req.body;
		if (!whatsappNumber) {
			return res.status(400).json({ message: 'WhatsApp number is required.' });
		}

		const success = await sendWhatsAppAlert({
			to: whatsappNumber,
			org: organization,
			violation: {
				_id: '000000000000000000000000',
				platform: 'youtube',
				matchConfidence: 99,
				matchType: 'manual_test',
				caseId: 'PIR-TEST-000'
			},
			severity: 5
		});

		if (success) {
			return res.status(200).json({ message: 'Test message dispatched to WhatsApp.' });
		} else {
			return res.status(500).json({ message: 'Failed to send WhatsApp message. Check server logs or Twilio config.' });
		}
	} catch (error) {
		return next(error);
	}
});

export default organizationRouter;
