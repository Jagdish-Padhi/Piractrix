import ThreatMemory from '../models/threatMemory.model.js';

export async function findThreatByDomain({ orgId, domain }) {
  if (!domain) return null;
  return ThreatMemory.findOne({ orgId, domain }).lean();
}

export async function upsertThreat({ orgId, domain, platform }) {
  if (!domain) return null;

  const now = new Date();
  const update = {
    $set: { lastSeenAt: now },
    $inc: { totalViolations: 1 },
    $addToSet: { platforms: platform },
  };

  const opts = { upsert: true, new: true, setDefaultsOnInsert: true };
  return ThreatMemory.findOneAndUpdate({ orgId, domain }, update, opts).lean();
}

export async function setThreatLevel({ orgId, domain, level }) {
  if (!domain) return null;
  return ThreatMemory.findOneAndUpdate({ orgId, domain }, { $set: { threatLevel: level } }, { new: true }).lean();
}
