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
  // First increment and get the updated document
  const doc = await ThreatMemory.findOneAndUpdate({ orgId, domain }, update, opts).lean();
  if (!doc) return null;

  const count = doc.totalViolations || 0;
  let level = 'low';
  if (count >= 10) level = 'critical';
  else if (count >= 6) level = 'high';
  else if (count >= 3) level = 'medium';

  if (doc.threatLevel !== level) {
    const updated = await ThreatMemory.findOneAndUpdate({ orgId, domain }, { $set: { threatLevel: level } }, { new: true }).lean();
    return updated;
  }

  return doc;
}

export async function setThreatLevel({ orgId, domain, level }) {
  if (!domain) return null;
  return ThreatMemory.findOneAndUpdate({ orgId, domain }, { $set: { threatLevel: level } }, { new: true }).lean();
}
