import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema(
	{
		orgName: {
			type: String,
			required: true,
			trim: true,
		},
		email: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
			trim: true,
		},
		passwordHash: {
			type: String,
			select: false,
			required: true,
		},
		refreshTokenHash: {
			type: String,
			select: false,
			default: null,
		},
		plan: {
			type: String,
			enum: ['free', 'pro'],
			default: 'free',
		},
		lastLoginAt: {
			type: Date,
			default: null,
		},
		notificationPrefs: {
			emailOnHighConfidence: {
				type: Boolean,
				default: true,
			},
			emailDigest: {
				type: Boolean,
				default: false,
			},
			inAppAlerts: {
				type: Boolean,
				default: true,
			},
			whatsappEnabled: {
				type: Boolean,
				default: false,
			},
			whatsappNumber: {
				type: String,
				default: null,
			},
			telegramEnabled: {
				type: Boolean,
				default: false,
			},
			telegramChatId: {
				type: String,
				default: null,
			},
			slackEnabled: {
				type: Boolean,
				default: false,
			},
			slackWebhookUrl: {
				type: String,
				default: null,
			},
			pushEnabled: {
				type: Boolean,
				default: false,
			},
			pushSubscription: {
				type: mongoose.Schema.Types.Mixed,
				default: null,
			},
			alertMinSeverity: {
				type: Number,
				default: 3,
				min: 1,
				max: 5,
			},
			whatsappMinSeverity: {
				type: Number,
				default: 5,
				min: 1,
				max: 5,
			},
		},
	},
	{
		timestamps: true,
	},
);

const Organization = mongoose.model('Organization', organizationSchema);

export default Organization;