import mongoose from 'mongoose';

const notificationLogSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    violationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Violation',
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ['email', 'whatsapp', 'telegram', 'slack', 'push'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'failed'],
      required: true,
      index: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

const NotificationLog = mongoose.model('NotificationLog', notificationLogSchema);
export default NotificationLog;
