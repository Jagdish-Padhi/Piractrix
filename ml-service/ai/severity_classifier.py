from __future__ import annotations

import json
import os
import requests

from . import gemini_service

GEMINI_API_BASE = getattr(gemini_service, 'GEMINI_API_BASE', 'https://generativelanguage.googleapis.com/v1beta/models')


def _rule_based_severity(confidence: int) -> dict:
    severity = 1
    if confidence >= 85:
        severity = 5
    elif confidence >= 70:
        severity = 4
    elif confidence >= 50:
        severity = 3
    elif confidence >= 30:
        severity = 2
    else:
        severity = 1

    mapping = {
        5: ('exact', 'draft_dmca'),
        4: ('coordinated_repost', 'draft_dmca'),
        3: ('possible_repost', 'queue_review'),
        2: ('weak_match', 'create_alert'),
        1: ('insufficient_signal', 'log_only'),
    }

    category, action = mapping.get(severity, ('unknown', 'log_only'))

    reasoning = f"Rule-based fallback: confidence {confidence} mapped to severity {severity}."

    return {
        'severity': severity,
        'threatCategory': category,
        'recommendedAction': action,
        'reasoning': reasoning,
    }


def classify_severity(payload: dict, timeout: int = 15) -> dict:
    api_key = os.getenv('GEMINI_API_KEY', '').strip()
    confidence = int(payload.get('confidence') or 0)

    if not api_key:
        return _rule_based_severity(confidence)

    prompt_lines = [
        'You are an expert threat assessor for copyright enforcement. '
        'Given the input data, output ONLY a single JSON object with keys: severity (1-5), threatCategory (short string), recommendedAction (one of draft_dmca, create_alert, queue_review, log_only), reasoning (2-3 sentence explanation).',
        f"confidence: {confidence}",
        f"matchType: {payload.get('matchType')}",
        f"platform: {payload.get('platform')}",
        f"domainReputation: {payload.get('domainReputation')}",
        f"assetType: {payload.get('assetType')}",
    ]

    prompt = '\n'.join([line for line in prompt_lines if line])

    last_error = None
    for model in gemini_service._candidate_models():
        try:
            response = requests.post(
                f"{GEMINI_API_BASE}/{model}:generateContent",
                params={"key": api_key},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.2,
                        "maxOutputTokens": 250,
                        "responseMimeType": "application/json",
                    },
                },
                timeout=timeout,
            )

            if not response.ok:
                last_error = RuntimeError(f"Gemini request failed ({response.status_code}).")
                continue

            payload_json = response.json()
            text = gemini_service._extract_json_text(payload_json)
            if not text:
                last_error = RuntimeError("Gemini returned empty response.")
                continue

            # Try to extract JSON object from the text
            json_start = text.find('{')
            json_end = text.rfind('}')
            if json_start != -1 and json_end != -1 and json_end > json_start:
                snippet = text[json_start:json_end + 1]
                try:
                    parsed = json.loads(snippet)
                    # Ensure keys
                    if 'severity' in parsed and 'reasoning' in parsed:
                        return parsed
                except Exception:
                    last_error = RuntimeError('Failed to parse Gemini JSON output.')
                    continue

        except Exception as error:
            last_error = error

    # If all models failed, fallback to rule-based mapping
    return _rule_based_severity(confidence)
