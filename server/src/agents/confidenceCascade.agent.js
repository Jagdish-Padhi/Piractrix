import fetch from 'node-fetch';

/**
 * Confidence cascade:
 *  Stage 1 - cheap keyword/discovery quality filter
 *  Stage 2 - fingerprint/match call to ML (/ml/match)
 *  Stage 3 - vision verify (/ml/vision-verify) for borderline matches
 *
 * Returns:
 *  { skip: true, reason }          -> short-circuit (insufficient signal)
 *  { adjustedConfidence, meta }    -> use this confidence for downstream classification
 */
const DEFAULT_MIN_QUALITY = 30;
const VISION_LOW = 40;
const VISION_HIGH = 70;

export async function runConfidenceCascade({ mlBaseUrl, asset, scanResult }) {
  const meta = { stages: [] };

  // Stage 1: cheap discovery quality check
  const quality = Number(scanResult.discoveryQualityScore || 0);
  if (quality < DEFAULT_MIN_QUALITY) {
    meta.stages.push({ stage: 'keyword_filter', pass: false, quality });
    return { skip: true, reason: 'insufficient_signal', meta };
  }
  meta.stages.push({ stage: 'keyword_filter', pass: true, quality });

  // Stage 2: fingerprint/match (ML match)
  if (!asset?.fingerprint) {
    meta.stages.push({ stage: 'fingerprint_match', pass: false, reason: 'no_reference_fingerprint' });
    // no fingerprint → don't fail, just continue with original confidence
    return { adjustedConfidence: Number(scanResult.matchConfidence || 0), meta };
  }

  try {
    const matchResp = await fetch(`${mlBaseUrl}/ml/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scrapedUrl: scanResult.thumbnailUrl || scanResult.videoUrl || scanResult.sourceUrl,
        referenceFingerprint: asset.fingerprint,
      }),
      timeout: 20000,
    });

    if (matchResp.ok) {
      const matchJson = await matchResp.json();
      const matchConfidence = Number(matchJson.matchConfidence || 0);
      meta.stages.push({ stage: 'fingerprint_match', pass: matchConfidence > 0, matchConfidence });

      // If strong match, short-circuit: high confidence -> fast path
      if (matchConfidence >= 70) {
        return { adjustedConfidence: Math.min(100, Math.max(matchConfidence, Number(scanResult.matchConfidence || 0))), meta };
      }

      // borderline -> consider vision verify
      if (matchConfidence >= VISION_LOW && matchConfidence < VISION_HIGH && asset?.gcsUrl) {
        try {
          const visionResp = await fetch(`${mlBaseUrl}/ml/vision-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              referenceUrl: asset.gcsUrl,
              candidateUrl: scanResult.thumbnailUrl || scanResult.videoUrl || scanResult.sourceUrl,
              baseConfidence: Math.max(matchConfidence, Number(scanResult.matchConfidence || 0)),
            }),
            timeout: 25000,
          });

          if (visionResp.ok) {
            const visionJson = await visionResp.json();
            const boost = Number(visionJson.visionConfidenceBoost || 0);
            const adjusted = Math.min(100, Math.max(matchConfidence, Number(scanResult.matchConfidence || 0)) + boost);
            meta.stages.push({ stage: 'vision_verify', pass: boost > 0, boost, adjusted });
            return { adjustedConfidence: adjusted, meta };
          }
        } catch (e) {
          meta.stages.push({ stage: 'vision_verify', pass: false, error: String(e) });
        }
      }

      // default: return matchConfidence-influenced value
      return { adjustedConfidence: Math.min(100, Math.max(Number(scanResult.matchConfidence || 0), matchConfidence)), meta };
    }
  } catch (e) {
    meta.stages.push({ stage: 'fingerprint_match', pass: false, error: String(e) });
  }

  // fallback: return original confidence
  meta.stages.push({ stage: 'fallback', pass: true, confidence: Number(scanResult.matchConfidence || 0) });
  return { adjustedConfidence: Number(scanResult.matchConfidence || 0), meta };
}