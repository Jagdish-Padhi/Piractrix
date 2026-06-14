# ShieldAgent: End-to-End Autonomous Enforcement Pipeline

This document details the modular pipeline comprising ShieldAgent, the core AI agent responsible for identifying, validating, and mitigating copyright infringements on the Piractrix platform.

---

## The Autonomous Cycle

ShieldAgent works in a continuous, five-stage loop designed to replicate the operations of a Security Operations Center (SOC) analyst:

```
    ┌─────────────────┐
    │   1. PERCEIVE   │ ◄─── Scrapers & Risk Tracker
    └────────┬────────┘
             ▼
    ┌─────────────────┐
    │   2. ANALYZE    │ ◄─── Confidence Cascade Validation
    └────────┬────────┘
             ▼
    ┌─────────────────┐
    │   3. CLASSIFY   │ ◄─── Gemini Severity Audit
    └────────┬────────┘
             ▼
    ┌─────────────────┐
    │   4. DECIDE     │ ◄─── Rule Engine Optimization
    └────────┬────────┘
             ▼
    ┌─────────────────┐
    │   5. ACT        │ ◄─── Multi-Channel Notices & Logs
    └─────────────────┘
```

---

## Detailed Phase Breakdown

### 1. Perceive (Scanning & Risk Assessment)
- **Agent Name:** `Perception Agent`
- **Responsibility:** Periodically wakes up via backend crons to scrape target platforms (YouTube, Twitter/X, Telegram channels, open web).
- **Self-Healing Frequency:** Analyzes historical violation volumes. If a specific asset suffers from frequent leaks, the agent auto-upgrades the scanning window from daily (`24h`) to high-risk intervals (`30m` or `2h`), emitting a socket heartbeat to notify administrators.

### 2. Analyze (Confidence Cascade)
Matches undergo a **3-stage verification** to minimize false positives:
- **Stage 1: Keyword Quality Filter:** A regex-based lookup scoring keywords to ensure context relevance.
- **Stage 2: DNA Fingerprint Match:** Validates assets using `pHash` hamming distance (distance ≤ 10) and `ColorDNA` visual overlap histograms.
- **Stage 3: Vision Verification:** Triggers secondary ML classification to detect overlay watermarks or mirror transformations, applying a confidence boost.

### 3. Classify (Gemini Audit)
- **Agent Name:** `Orchestrator Agent`
- **Responsibility:** Packages match context, platform metadata, and similarity percentages, then queries **Gemini 1.5** to evaluate threat severity (SEV 1 to 5).
- **Rule Table:**
  - `SEV 5:` Critical. Immediate threat of high-impact distribution (e.g., live streams).
  - `SEV 4:` High. Shared download mirrors or full highlights.
  - `SEV 3:` Medium. Small clips or edit reposts.
  - `SEV 1-2:` Low. Discussion threads, text logs, or unrelated content.

### 4. Decide (Rule Engine)
- **Agent Name:** `Decision Agent`
- **Responsibility:** Evaluates outputs against **Threat Memory**:
  - If the domain is a known repeat offender, the agent escalates the action category (e.g., from `queue_review` to `auto_escalate`).
  - Decisions include: `log_only` (SEV 1-2), `create_alert` (SEV 3), `queue_review` (borderline scores), and `draft_dmca` or `auto_escalate` (SEV 4-5).

### 5. Act (Enforcement)
- **Agent Name:** `Executor Agent`
- **Responsibility:** Executes decisions:
  - If **Autonomous Mode** is enabled, it automatically drafts DMCA templates using Gemini, sends email reports, triggers WhatsApp alerts, hits Slack/Telegram channel webhooks, and posts a web push.
  - If manual, it queues the case in the dashboard pending user approval.
- **Audit Trails:** Logs every dispatch trace to `AgentDecisionLog` and `NotificationLog` models.
