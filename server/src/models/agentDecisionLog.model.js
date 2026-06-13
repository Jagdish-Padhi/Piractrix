import mongoose from 'mongoose';

const agentDecisionLogSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    assetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      default: null,
      index: true,
    },
    violationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Violation',
      default: null,
      index: true,
    },
    decisionType: {
      type: String,
      enum: ['scan_triggered', 'violation_classified', 'action_taken', 'escalation', 'perception_change'],
      required: true,
    },
    input: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    reasoning: {
      type: String,
      default: null,
    },
    action: {
      type: String,
      enum: ['log_only', 'create_alert', 'draft_dmca', 'auto_escalate', 'queue_review', 'none'],
      default: 'none',
    },
    outcome: {
      type: String,
      enum: ['success', 'failed', 'pending', 'skipped'],
      default: 'pending',
    },
    agentVersion: {
      type: String,
      default: '1.0',
    },
    autonomousMode: {
      type: Boolean,
      default: false,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

agentDecisionLogSchema.index({ orgId: 1, createdAt: -1 });
agentDecisionLogSchema.index({ orgId: 1, decisionType: 1 });

const AgentDecisionLog = mongoose.model('AgentDecisionLog', agentDecisionLogSchema);

export default AgentDecisionLog;
