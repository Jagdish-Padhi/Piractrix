import mongoose from 'mongoose';

const agentStatusSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
      index: true,
    },
    autonomousMode: {
      type: Boolean,
      default: false,
    },
    lastRun: {
      type: Date,
      default: null,
    },
    lastHeartbeat: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const AgentStatus = mongoose.model('AgentStatus', agentStatusSchema);
export default AgentStatus;
