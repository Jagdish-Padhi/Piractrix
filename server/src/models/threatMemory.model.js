import mongoose from 'mongoose';

const threatMemorySchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    domain: {
      type: String,
      required: true,
      index: true,
    },
    firstSeenAt: {
      type: Date,
      default: Date.now,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    totalViolations: {
      type: Number,
      default: 0,
      min: 0,
    },
    platforms: {
      type: [String],
      default: [],
    },
    threatLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low',
    },
    autoEscalate: {
      type: Boolean,
      default: false,
    },
    relatedDomains: {
      type: [String],
      default: [],
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

threatMemorySchema.index({ orgId: 1, domain: 1 }, { unique: true });
threatMemorySchema.index({ orgId: 1, lastSeenAt: -1 });

const ThreatMemory = mongoose.model('ThreatMemory', threatMemorySchema);

export default ThreatMemory;
