import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

import Violation from '../models/violation.model.js';

export async function listViolationsByOrg({ orgId, page = 1, limit = 10, status = '', platform = '', minConfidence = 0 }) {
	const skip = (page - 1) * limit;
	const query = {
		orgId,
		matchConfidence: { $gte: minConfidence },
	};

	if (status) {
		query.status = status;
	}

	if (platform) {
		query.platform = platform;
	}

	const [items, total] = await Promise.all([
		Violation.find(query)
			.populate('assetId', 'title')
			.sort({ detectedAt: -1, createdAt: -1 })
			.skip(skip)
			.limit(limit)
			.lean(),
		Violation.countDocuments(query),
	]);

	return {
		items,
		total,
		page,
		limit,
		totalPages: Math.max(1, Math.ceil(total / limit)),
	};
}

export async function getViolationById({ orgId, violationId }) {
	return Violation.findOne({ _id: violationId, orgId }).lean();
}

export async function updateViolationStatus({ orgId, violationId, status }) {
	let caseStatus = 'open';
	let eventDescription = 'Status updated';
	let timelineEvent = 'status_changed';
	
	if (status === 'open') {
		caseStatus = 'open';
		eventDescription = 'Case marked open.';
		timelineEvent = 'detected';
	} else if (status === 'reported') {
		caseStatus = 'takedown_requested';
		eventDescription = 'Takedown notice sent to platform abuse team.';
		timelineEvent = 'takedown_sent';
	} else if (status === 'resolved') {
		caseStatus = 'resolved';
		eventDescription = 'Violation resolved. Content successfully removed.';
		timelineEvent = 'resolved';
	} else if (status === 'false_positive') {
		caseStatus = 'false_positive';
		eventDescription = 'Case dismissed as false positive.';
		timelineEvent = 'resolved';
	}

	const update = {
		status,
		caseStatus,
		resolvedAt: status === 'resolved' ? new Date() : null,
		$push: {
			caseTimeline: {
				event: timelineEvent,
				description: eventDescription,
				timestamp: new Date()
			}
		}
	};

	return Violation.findOneAndUpdate({ _id: violationId, orgId }, update, { new: true }).lean();
}

import { cloudinary } from '../config/cloudinary.js';

async function captureViolationScreenshot(sourceUrl) {
	const puppeteer = await import('puppeteer');
	const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

	try {
		const page = await browser.newPage();
		await page.setViewport({ width: 1366, height: 768 });
		await page.goto(sourceUrl, {
			waitUntil: 'domcontentloaded',
			timeout: 30000,
		});
		const screenshotBuffer = await page.screenshot({ type: 'png', fullPage: false });
		return new Promise((resolve, reject) => {
			const uploadStream = cloudinary.uploader.upload_stream(
				{ folder: 'piractrix_screenshots', resource_type: 'image' },
				(error, result) => {
					if (error) return reject(error);
					resolve(result.secure_url);
				}
			);
			uploadStream.end(screenshotBuffer);
		});
	} finally {
		await browser.close();
	}
}

export async function createViolationScreenshot({ orgId, violationId }) {
	const violation = await Violation.findOne({ _id: violationId, orgId });

	if (!violation) {
		const error = new Error('Violation not found.');
		error.statusCode = 404;
		throw error;
	}

	if (!violation.sourceUrl) {
		const error = new Error('Violation source URL is missing.');
		error.statusCode = 400;
		throw error;
	}

	const screenshotUrl = await captureViolationScreenshot(violation.sourceUrl);

	violation.screenshotUrl = screenshotUrl;
	await violation.save();

	return violation.toObject();
}

function buildDmcaTemplate({ organizationName, violation }) {
	const assetTitle = violation.assetId?.title || 'proprietary copyrighted content';
	const platformName = (violation.platform || 'the platform').charAt(0).toUpperCase() + (violation.platform || 'the platform').slice(1);
	const detectedDate = new Date(violation.detectedAt).toUTCString();
	const matchType = (violation.matchType || 'near-duplicate').replace('-', ' ');
	const confidence = violation.matchConfidence || 95;
	const hammingDist = violation.evidenceBundle?.hammingDistance ?? 'N/A';
	const colorSim = violation.evidenceBundle?.colorSimilarity != null ? `${(violation.evidenceBundle.colorSimilarity * 100).toFixed(1)}%` : 'N/A';

	return `FORMAL DMCA TAKEDOWN NOTICE
Pursuant to 17 U.S.C. § 512 (Digital Millennium Copyright Act)

Date: ${new Date().toUTCString()}
To: ${platformName} Copyright/Trust & Safety Team

RE: Unauthorized Distribution of Copyrighted Content — "${assetTitle}"

I. IDENTIFICATION OF RIGHTS HOLDER
${organizationName} is the exclusive rights holder and authorized distributor of the copyrighted work identified herein. This notice is issued on behalf of the rights holder pursuant to the protections afforded under the DMCA and applicable international copyright treaties.

II. DESCRIPTION OF INFRINGING MATERIAL
The following URL hosts unauthorized content that is a ${matchType} of the protected work titled "${assetTitle}":

  Infringing URL:     ${violation.sourceUrl}
  Platform:           ${platformName}
  Domain:             ${violation.sourceDomain || new URL(violation.sourceUrl).hostname}
  Detection Time:     ${detectedDate}

III. FORENSIC EVIDENCE OF INFRINGEMENT
Our proprietary AI-powered Rights Detection System (Piractrix) has confirmed infringement via multi-signal forensic analysis:
  - Match Confidence Score:  ${confidence}%
  - Match Classification:    ${matchType}
  - Perceptual Hash Distance: ${hammingDist} (lower = higher similarity)
  - Color DNA Similarity:    ${colorSim}
  - Verdict: This material is a direct unauthorized copy of the protected work.

IV. DEMAND FOR IMMEDIATE ACTION
We hereby demand that ${platformName} immediately and permanently remove or disable access to the above-identified infringing content. Failure to act within 24 hours of receipt of this notice will compel us to pursue all available legal remedies, including but not limited to injunctive relief and statutory damages.

V. GOOD FAITH STATEMENT
I have a good faith belief that the use of the copyrighted material described in this notice is not authorized by the copyright owner, its agent, or the law. (17 U.S.C. § 512(c)(3)(A)(v))

VI. ACCURACY AND AUTHORITY STATEMENT
I swear, under penalty of perjury, that the information in this notification is accurate and that I am authorized to act on behalf of the copyright owner of the exclusive rights being infringed. (17 U.S.C. § 512(c)(3)(A)(vi))

Sincerely,

[Authorized Representative Name & Title]
${organizationName}
[Address], [City, State, ZIP]
[Phone Number]
[Email Address]

Case Reference ID: ${violation._id}
`;
}

async function generateDmcaWithGemini({ organizationName, violation }) {
	const apiKey = process.env.GEMINI_API_KEY?.trim();
	if (!apiKey) {
		return null;
	}

	const assetTitle = violation.assetId?.title || 'exclusive copyrighted content';
	const platformName = (violation.platform || 'the platform').charAt(0).toUpperCase() + (violation.platform || 'the platform').slice(1);
	const detectedDate = new Date(violation.detectedAt).toUTCString();
	const matchType = (violation.matchType || 'near-duplicate').replace('-', ' ');
	const confidence = violation.matchConfidence || 95;
	const sourceDomain = violation.sourceDomain || (violation.sourceUrl ? new URL(violation.sourceUrl).hostname : 'unknown');
	const hammingDist = violation.evidenceBundle?.hammingDistance ?? 'not available';
	const colorSim = violation.evidenceBundle?.colorSimilarity != null
		? `${(violation.evidenceBundle.colorSimilarity * 100).toFixed(1)}%`
		: 'not available';
	const frameMatch = violation.evidenceBundle?.frameMatchCount != null
		? `${violation.evidenceBundle.frameMatchCount} matching frames detected`
		: null;
	const visionBoost = violation.evidenceBundle?.visionConfidenceBoost != null
		? `Google Cloud Vision API independently boosted match confidence by ${violation.evidenceBundle.visionConfidenceBoost}%`
		: null;
	const repeatScore = violation.repeatOffenderScore > 50
		? `NOTE: This domain (${sourceDomain}) is a known repeat offender with a persistent threat score of ${violation.repeatOffenderScore}/100.`
		: '';

	const model = process.env.GEMINI_MODEL?.trim() || 'gemini-1.5-flash';
	const prompt = `You are the senior legal counsel for ${organizationName}, a premier digital rights protection firm.

Draft a formal, legally rigorous DMCA Takedown Notice for the specific copyright infringement case described below.

CASE DETAILS:
- Protected Work Title: "${assetTitle}"
- Rights Holder: ${organizationName}
- Infringing Platform: ${platformName}
- Infringing URL: ${violation.sourceUrl}
- Hosting Domain: ${sourceDomain}
- Infringement Detected: ${detectedDate}
- Match Classification: ${matchType} (${confidence}% confidence)
${repeatScore}

FORENSIC EVIDENCE SUMMARY (from Piractrix AI Detection Engine):
- Perceptual Hash (pHash) Hamming Distance: ${hammingDist} — a distance below 12 confirms near-identical content
- Color DNA Similarity: ${colorSim} — spatial color fingerprint match across frames
${frameMatch ? `- Temporal Fingerprint: ${frameMatch}` : ''}
${visionBoost ? `- Vision AI Verification: ${visionBoost}` : ''}
- Overall Verdict: Forensic analysis confirms unauthorized reproduction of "${assetTitle}"

INSTRUCTIONS FOR THE NOTICE:
1. Address the notice specifically to ${platformName}'s copyright/legal team using the correct formal salutation.
2. Open with a strong, declarative statement of copyright ownership for "${assetTitle}".
3. Cite the exact infringing URL and all forensic evidence provided above — do NOT omit or generalize the evidence, cite specific numbers.
4. Include citations to 17 U.S.C. § 512(c)(3)(A) (DMCA safe harbor removal obligations)${platformName === 'Youtube' || platformName === 'YouTube' ? ', YouTube\u2019s Content ID Policy,' : ''} and any relevant international treaties (e.g. Berne Convention for international platforms).
5. Set a strict 24-hour deadline for content removal with explicit warning that failure will result in legal proceedings for statutory damages under 17 U.S.C. § 504.
6. Include the mandatory DMCA good-faith belief statement (17 U.S.C. § 512(c)(3)(A)(v)).
7. Include the mandatory penalty-of-perjury accuracy statement (17 U.S.C. § 512(c)(3)(A)(vi)).
8. Use placeholder brackets for the signatory fields: [Authorized Representative], [Title], [Phone], [Email], [Address].
9. End with the internal Case Reference ID: ${violation._id}

Tone: Authoritative, precise, and unambiguous. This is a real legal document dispatched by a legal team, not a template.
Format: Plain text only. No markdown. No bullet points. Use formal legal letter structure with numbered sections.
Length: Comprehensive but focused — between 400 and 600 words.`;

	try {
		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contents: [{ parts: [{ text: prompt }] }],
					generationConfig: {
						temperature: 0.2,
						maxOutputTokens: 1200,
					},
				}),
			},
		);

		if (!response.ok) {
			return null;
		}

		const payload = await response.json();
		const text = payload?.candidates?.[0]?.content?.parts
			?.map((part) => part?.text || '')
			.join('\n')
			.trim();

		return text || null;
	} catch {
		return null;
	}
}

const platformAbuseEmails = {
	'youtube': 'copyright@youtube.com',
	'twitter': 'copyright@twitter.com',
	'tiktok': 'copyright@tiktok.com',
	'instagram': 'ip@instagram.com',
	'facebook': 'ip@fb.com',
	'reddit': 'copyright@reddit.com',
	'twitch': 'dmca@twitch.tv'
};

export async function draftDmcaNotice({ orgId, violationId }) {
	const violation = await Violation.findOne({ _id: violationId, orgId }).populate('assetId', 'title type').lean();
	if (!violation) {
		const error = new Error('Violation not found.');
		error.statusCode = 404;
		throw error;
	}

	const organizationName = 'Piractrix Rights Team';
	const geminiDraft = await generateDmcaWithGemini({ organizationName, violation });

	const draftContent = geminiDraft || buildDmcaTemplate({ organizationName, violation });
	const generatedBy = geminiDraft ? 'gemini' : 'template';
	const contactEmail = platformAbuseEmails[violation.platform.toLowerCase()] || 'abuse@platform.com';

	// Persist the generated DMCA content back to the violation document
	await Violation.findByIdAndUpdate(violationId, {
		dmcaContent: draftContent,
		dmcaContactEmail: contactEmail,
		dmcaGeneratedAt: new Date(),
		dmcaGeneratedBy: generatedBy,
		caseStatus: 'dmca_drafted',
		$push: {
			caseTimeline: {
				event: 'dmca_drafted',
				description: `DMCA notice auto-drafted by ${generatedBy === 'gemini' ? 'Gemini AI' : 'template engine'}.`,
				timestamp: new Date()
			}
		}
	});

	return {
		violationId: violation._id.toString(),
		platform: violation.platform,
		sourceUrl: violation.sourceUrl,
		draft: draftContent,
		generatedBy,
		contactEmail
	};
}
