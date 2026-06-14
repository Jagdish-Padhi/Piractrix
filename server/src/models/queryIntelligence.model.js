import mongoose from 'mongoose';

const queryIntelligenceSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    keyword: {
      type: String,
      required: true,
      trim: true,
    },
    platform: {
      type: String,
      required: true,
      index: true,
    },
    timesUsed: {
      type: Number,
      default: 0,
    },
    violationsFound: {
      type: Number,
      default: 0,
    },
    hitRate: {
      type: Number,
      default: 0, // violationsFound / timesUsed
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

queryIntelligenceSchema.index({ orgId: 1, keyword: 1, platform: 1 }, { unique: true });

const QueryIntelligence = mongoose.model('QueryIntelligence', queryIntelligenceSchema);
export default QueryIntelligence;
