# 🤖 Piractrix — FAR AWAY 2026 Hackathon Plan
### Piractrix → Autonomous Rights Enforcement Agent
**Theme:** Agentic & Autonomous Systems | **Deadline:** 3 Days | **Team:** Esc(Reality);

---

## PART 1 — DEEP ANALYSIS & STRATEGIC DIRECTION

---

### 1.1 What You Currently Have (Honest Audit)

Piractrix is already a working, deployed product (top 106 Google Solution Challenge).
Here is what the codebase shows is **actually built and running**:

**ML Service (Python/FastAPI)**
- `fingerprint_service.py` — pHash + VideoHash + colorHistogram + frameHashes generation (real, working)
- `scraper_service.py` — parallel scraping of YouTube / Twitter / Telegram / Web with retry logic and Gemini query expansion (real, working)
- `matching_service.py` — multi-signal matching: Hamming distance + cosine color similarity + frame match count + Google Vision fallback (real, working)
- `gemini_service.py` — Gemini-powered search query generation with multi-model fallback (real, working)

**Server (Node.js/Express)**
- Full auth (Firebase + JWT refresh tokens)
- Full CRUD for Assets, ScanJobs, ScanResults, Violations, Alerts
- Socket.io real-time alerts when violations are detected
- Automated DMCA notice generation (template + Gemini enrichment)
- Weekly digest email via Brevo
- PDF report generation via Puppeteer
- Scheduled scan job cron

**Client (React + Vite)**
- Complete dashboard: Home, Assets, Scans, Violations, Analytics, Alerts
- Evidence deep-dive modal (Hamming, color, frame count)
- DMCA draft modal with email compose
- Real-time log simulation on homepage
- Report generation with background mode

### What This Is Right Now
```
User uploads asset
     ↓
User triggers scan manually (or cron runs it every N hours)
     ↓
ML pipeline scrapes + fingerprints + matches
     ↓
Violations appear in dashboard
     ↓
User manually reviews violations
     ↓
User manually clicks "Draft DMCA"
     ↓
User manually copies and sends DMCA
```

**The Problem:** This is a powerful **tool**. Tools don't win the Agentic theme.
Agents do. The transformation is: remove "User manually" from every step.

---

### 1.2 Hackathon Theme Deep Alignment

**"Agentic & Autonomous Systems — Build intelligent systems that can think, decide and act independently."**

The judging panel at FAR AWAY rewards:
- Systems that make decisions without human input
- Clear reasoning chains (the agent should explain WHY it decided something)
- Real-world impact and working demos
- Technical depth beyond surface-level AI wrappers
- Scalability of the concept

**Piractrix → Autonomous Enforcement Agent transformation score: 9/10**

Why? Because the problem domain is PERFECT for agentic framing:
- Rights enforcement has a clear decision tree (detect → assess → act → escalate)
- Decisions can be tiered by confidence and severity
- Actions have clear real-world consequences (takedowns, legal notices)
- The domain has provable economic impact ($25B+ annual piracy losses in sports alone)
- Most teams will build generic "AI assistant" agents. You'll build a specialized **enforcement agent**.

---

### 1.3 The New Identity

**Name:** Piractrix *(or keep Piractrix with an "Autonomous Rights Enforcement Agent" subtitle)*
**Tagline:** "The Autonomous Rights Enforcement Agent. Detect. Decide. Defend."

**The Pitch Sentence for Judges:**
> "Piractrix is an autonomous AI system that continuously monitors 4 platforms for copyright violations, independently decides severity and appropriate action, auto-drafts legal enforcement with forensic evidence, and escalates based on threat patterns — all without human intervention. Every decision is logged with full reasoning so rights holders stay in control."

**What Makes This Different from Every Other Agent Project:**
1. Domain specificity — not a generic agent, a specialized enforcement agent
2. Multi-step autonomous decision chain (detect → classify → rank → act → learn)
3. Explainable AI — the agent shows its reasoning at every step
4. Real economic stakes — $25B problem, not a toy demo
5. Working demo with real data (you have sportshield-ten.vercel.app)

---

### 1.4 The Core Transformation: Add an Agent Layer

You do NOT need to rewrite anything. You add an orchestration layer on top.

**Before:**
```
scan.job.js  →  dispatchScanJob()  →  violations created  →  user acts
```

**After:**
```
AgentOrchestrator
  ├── Perception: monitors assets, decides WHEN to scan based on risk profile
  ├── Decision Engine: after scan, decides WHAT to do for each violation
  │     ├── severity < 30% → log only
  │     ├── severity 30-70% → create alert, queue for review
  │     └── severity > 70% → auto-draft DMCA, emit high-priority alert
  ├── Action Executor: carries out the decided action
  ├── Reasoning Logger: writes WHY to AgentDecisionLog
  └── Memory: updates ThreatMemory (known pirate domains, repeat offenders)
```

Every existing service stays exactly the same. You're adding a "brain" on top of the existing "muscles."

---

### 1.5 Why This Beats Other Teams

| What Other Teams Build | What You Build |
|------------------------|----------------|
| Chat assistant with tools | Enforcement agent with memory and decision loop |
| Single-step AI action | Multi-step autonomous pipeline with reasoning |
| No real data | Live deployed app with real violation detection |
| Generic domain | Hyper-specific: copyright enforcement |
| No economic story | $25B sports piracy problem |
| No explainability | Full reasoning audit trail every decision |
| One theme | Agentic Systems (primary) + Logistics & Transit subtext |

---

## PART 2 — ARCHITECTURE OF THE AGENT LAYER

---

### 2.1 New Components to Add

```
server/
  src/
    agents/                         ← NEW FOLDER
      orchestrator.agent.js         ← Master agent brain
      perception.agent.js           ← Decides when to scan
      decision.agent.js             ← Classifies violation + decides action
      executor.agent.js             ← Carries out the action
      memory.agent.js               ← ThreatMemory (pirate domain graph)
    models/
      agentDecisionLog.model.js     ← NEW - logs every decision with reasoning
      threatMemory.model.js         ← NEW - known bad actors, domains
    routes/
      agent.route.js                ← NEW - /api/agent/*
    controllers/
      agent.controller.js           ← NEW
    services/
      agent.service.js              ← NEW

ml-service/
  ai/
    severity_classifier.py          ← NEW - Gemini classifies threat severity
    reasoning_generator.py          ← NEW - generates human-readable reasoning

client/
  src/
    pages/dashboard/
      AgentCommandCenterPage.jsx    ← NEW - The main new page
      AgentDecisionLogPage.jsx      ← NEW - Audit trail page
    components/
      AgentStatusBadge.jsx          ← NEW - Live agent status indicator
      AgentReasoningCard.jsx        ← NEW - Show agent's thought process
      ThreatIntelCard.jsx           ← NEW - Known bad actors
```

### 2.2 Data Models to Add

**AgentDecisionLog** — Every autonomous decision:
```
{
  orgId, assetId, violationId,
  decisionType: 'scan_triggered' | 'violation_classified' | 'action_taken' | 'escalation',
  input: { confidence, platform, matchType, ... },
  reasoning: "string — the agent's explanation in natural language",
  action: 'log_only' | 'create_alert' | 'draft_dmca' | 'auto_escalate',
  outcome: 'success' | 'failed' | 'pending',
  agentVersion: '1.0',
  autonomousMode: Boolean,
  timestamp: Date
}
```

**ThreatMemory** — Persistent pirate domain knowledge:
```
{
  orgId,
  domain: 'piratestreamhd.com',
  firstSeenAt: Date,
  lastSeenAt: Date,
  totalViolations: Number,
  platforms: [String],
  threatLevel: 'low' | 'medium' | 'high' | 'critical',
  autoEscalate: Boolean,  // true if domain is a known repeat offender
  relatedDomains: [String]
}
```

### 2.3 The Agent Decision Engine Logic

```
For each new violation detected:

1. PERCEPTION PHASE
   - Get violation confidence score (already exists)
   - Check ThreatMemory for this domain — is it a known offender?
   - Calculate riskScore = confidence + repeatOffenderBonus + surgeBonus

2. CLASSIFICATION PHASE (call Gemini)
   - Input: riskScore, matchType, platform, domain reputation, asset type
   - Output: { severity: 1-5, threatCategory, recommendedAction, reasoning }

3. DECISION PHASE (rule engine)
   - severity 1 (< 30% confidence, new domain): log only
   - severity 2 (30-50%, normal): create in-app alert
   - severity 3 (50-70%, platform: YouTube/Twitter): alert + queue review
   - severity 4 (70-85%, near-duplicate): alert + auto-draft DMCA
   - severity 5 (>85%, exact match, repeat offender): alert + auto-draft DMCA + send email
   - If autonomousMode=OFF: queue all actions for user approval
   - If autonomousMode=ON: execute actions directly

4. ACTION PHASE
   - Execute the decided action
   - Update ThreatMemory for this domain
   - Emit Socket.io event for real-time UI update

5. REASONING LOG
   - Write AgentDecisionLog entry with full reasoning chain
   - This becomes the "explainability" trail judges love
```

### 2.4 Agent Autonomous Mode

This is the "wow" feature for the demo. A single toggle in settings:

```
[ AUTONOMOUS MODE ]  OFF ←→ ON

OFF: Agent detects + classifies + recommends. You approve each action.
ON:  Agent detects + classifies + acts independently. Full automation.
```

When judges see "Autonomous Mode: ON" and then watch the agent find a violation, classify it, draft a DMCA, and send an alert without any user interaction — that is the moment that wins.

---

## PART 3 — PHASE-BY-PHASE 3-DAY PLAN

---

## 🔴 DAY 1 — THE AGENT BRAIN (Backend Layer)

**Goal:** By end of Day 1, the agent is running in the background, making decisions, and logging reasoning. The existing frontend doesn't need to change — the agent just makes the system smarter under the hood.

---

### Phase 1.1 — Agent Models & DB Schema (1.5 hrs)

**Files to create:**
- `server/src/models/agentDecisionLog.model.js`
- `server/src/models/threatMemory.model.js`

**What to do:**
- Create `AgentDecisionLog` schema as described above in Section 2.2
- Create `ThreatMemory` schema as described above
- Add indexes on orgId + timestamp for fast queries

**No API yet, just the data layer.**

---

### Phase 1.2 — Severity Classifier (ML Side) (1.5 hrs)

**File to create:** `ml-service/ai/severity_classifier.py`

**What it does:**
- New FastAPI endpoint: `POST /ml/classify-severity`
- Input: `{ confidence, matchType, platform, domainReputation, assetType }`
- Uses Gemini to output: `{ severity: 1-5, threatCategory, recommendedAction, reasoning }`
- The `reasoning` field is the key — it should be a 2-3 sentence explanation in plain English
- Example output:
  ```json
  {
    "severity": 4,
    "threatCategory": "coordinated_repost",
    "recommendedAction": "draft_dmca",
    "reasoning": "This YouTube channel has a 78% confidence match and shares domain history with 3 previous violations. The near-duplicate match type and high color similarity suggest deliberate reposting rather than coincidental similarity. Immediate DMCA notice recommended."
  }
  ```

**Fallback:** If Gemini fails, use a rule-based severity calculator (confidence-to-severity mapping table). Never let the endpoint crash.

---

### Phase 1.3 — Core Agent Orchestrator (2 hrs)

**Files to create:**
- `server/src/agents/orchestrator.agent.js` — the master brain
- `server/src/agents/decision.agent.js` — decision logic
- `server/src/agents/executor.agent.js` — action execution
- `server/src/agents/memory.agent.js` — ThreatMemory CRUD

**The orchestrator is called AFTER `dispatchScanJob` completes and violations are found.**

In `scans.service.js`, after `runMatchingForScan()` completes, add:
```js
// After violations are stored:
void runAgentOnScanComplete({ orgId, scanJobId, violations });
```

**The `runAgentOnScanComplete` flow:**
1. For each violation: call `POST /ml/classify-severity`
2. Get severity + reasoning from ML
3. Check `ThreatMemory` for this domain
4. Run decision engine (Section 2.3)
5. Execute action based on decision
6. Write `AgentDecisionLog` entry
7. Update `ThreatMemory` for domain
8. Emit socket event `agent:decision` to frontend

**Keep it async / non-blocking.** Use `void` calls so the scan API response is not delayed.

---

### Phase 1.4 — Agent API Routes (1 hr)

**Files to create:**
- `server/src/routes/agent.route.js`
- `server/src/controllers/agent.controller.js`

**Endpoints:**

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/agent/status` | Current agent status, mode, last run |
| `GET` | `/api/agent/decisions` | Paginated decision log |
| `GET` | `/api/agent/decisions/:id` | Single decision with full reasoning |
| `GET` | `/api/agent/threat-memory` | Known pirate domains |
| `PATCH` | `/api/agent/mode` | Toggle autonomous mode ON/OFF |
| `POST` | `/api/agent/approve/:decisionId` | Manually approve a queued action (for non-autonomous mode) |
| `GET` | `/api/agent/stats` | Total decisions, actions taken, accuracy |

Register in `server/src/routes/index.js`.

---

### Phase 1.5 — Agent-Aware Scan Scheduling (Perception Agent) (1 hr)

**File to create:** `server/src/agents/perception.agent.js`

**What it does:** Replace the dumb cron job with smart scan scheduling.

Current cron (`scan.job.js`): scans ALL assets at fixed intervals.

**Smart perception logic:**
- Assets with recent violations → scan every 2 hours (high risk)
- Assets with no violations in 7 days → scan every 24 hours (low risk)
- Assets where ThreatMemory shows known pirate domains → scan every 1 hour (critical)
- New assets (< 48 hours old) → scan every 6 hours (onboarding)

This is "autonomous intelligence" in the perception phase. The agent DECIDES when to look.

**Update `scan.job.js`** to call `perception.agent.js` instead of static scheduling.

---

### ⭐ DAY 1 BONUS — Agent "Confidence Cascade" Architecture

Instead of running full ML pipeline on every candidate, add staged processing:

```
Stage 1 — Keyword Filter (free, instant)
  → If keyword match quality < threshold: discard, log "insufficient_signal"

Stage 2 — Fingerprint Match (fast, cheap)
  → Only for Stage 1 survivors
  → If confidence < 30%: log as "low_confidence_candidate"

Stage 3 — Vision Verify (slower, costs more)
  → Only for Stage 2 survivors with 30-70% confidence
  → Final boost to confidence score

Stage 4 — Agent Decision (free, Gemini call)
  → Only for Stage 3 survivors
```

This architecture is a **standout feature** for judges. It shows:
1. Intelligent resource allocation (the agent doesn't waste compute)
2. Real engineering depth
3. This is exactly how production systems work at scale

Implement as `cascade_processor.py` in ml-service. Plug into the existing `run_scrape_job` flow.

---

## 🟡 DAY 2 — THE AGENT FACE (Frontend + Expansion)

**Goal:** Judges can SEE the agent working. The UI shows real-time agent decisions, reasoning chains, and the dramatic "Autonomous Mode" toggle.

---

### Phase 2.1 — Agent Command Center Page (3 hrs)

**File to create:** `client/src/pages/dashboard/AgentCommandCenterPage.jsx`

This becomes the **new homepage** of the dashboard. Replace or extend `DashboardHomePage.jsx`.

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│  🤖 Piractrix                     [AUTONOMOUS MODE: ●ON / OFF] │
│  Status: Active | Last action: 2 min ago | Decisions today: 47  │
├──────────────────────┬──────────────────────────────────────────┤
│  AGENT LIVE FEED     │  THREAT MEMORY                           │
│                      │  ┌─────────────────────────────────────┐ │
│  [Real-time stream   │  │ piratestreamhd.com  ●CRITICAL  12↑  │ │
│   of agent reasoning │  │ telegram/sharebot   ●HIGH      8↑   │ │
│   decisions as they  │  │ reddit/sportsleaks  ●MEDIUM    3↑   │ │
│   happen - animated] │  │ watch-sports.xyz    ●LOW       1↑   │ │
│                      │  └─────────────────────────────────────┘ │
├──────────────────────┴──────────────────────────────────────────┤
│  RECENT AGENT DECISIONS                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 🔴 SEVERITY 5  |  YouTube  |  IPL Match Highlights  →    │   │
│  │ "78% confidence near-duplicate from known repeat         │   │
│  │  offender. Auto-drafted DMCA notice. Email queued."       │   │
│  │ Action: DMCA AUTO-DRAFTED  ✓ Executed                     │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ 🟡 SEVERITY 3  |  Telegram |  Champions League Final  →  │   │
│  │ "52% confidence match from new domain. Queued for         │   │
│  │  human review — insufficient repeat offender data."       │   │
│  │ Action: REVIEW REQUESTED   [Approve] [Dismiss]            │   │
│  └──────────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────┤
│  STATS: 847 Violations Intercepted | 312 DMCAs Auto-Drafted      │
│         94.2% Detection Accuracy   | 2.3 min Avg Response Time   │
└──────────────────────────────────────────────────────────────────┘
```

**Key components to build:**
- `AgentStatusBanner` — shows mode, last action, health
- `AgentLiveFeed` — real-time WebSocket stream of `agent:decision` events (replace the fake log simulation)
- `ThreatIntelPanel` — list of `ThreatMemory` domains with threat level badges
- `AgentDecisionCard` — each decision with reasoning, action taken, approve/dismiss buttons
- Autonomous Mode toggle — PATCH to `/api/agent/mode` — should have satisfying ON/OFF animation

**The Live Feed is the Visual Centerpiece.** When the agent makes a decision, it should stream into the feed with a typewriter animation showing the reasoning text.

---

### Phase 2.2 — Agent Decision Log Page (1 hr)

**File to create:** `client/src/pages/dashboard/AgentDecisionLogPage.jsx`

A full audit trail. Judges LOVE explainability.

**Layout:** Simple table + filters
- Date range filter
- Decision type filter (scan_triggered | classified | action_taken | escalation)
- Autonomous vs manual filter
- Each row expands to show full reasoning text
- Export to CSV button

Add to Sidebar navigation as "Agent Log" or "Decision Audit".

---

### Phase 2.3 — Update Sidebar + Routing (30 min)

**File to update:** `client/src/components/Sidebar.jsx`

Add new nav items:
- 🤖 Agent Center (primary nav item, make it stand out)
- 🧠 Decision Log
- 🎯 Threat Intel (can link to threat memory view)

Update `client/src/routes/AppRoutes.jsx` to include new routes.

---

### Phase 2.4 — Content Domain Expansion (1.5 hrs)

**This is the "bigger story" move. One of the biggest differentiators.**

Currently asset types are: `video | image | highlight`

Expand to: `video | image | highlight | exam_paper | document | music | ott_content`

**Why this matters:**
- Connects to the **Examinations theme** from the hackathon (exam paper piracy is a real problem in India — leaked papers are shared on Telegram daily)
- Makes the agent's scope "Digital Asset Defense" not just "sports piracy"
- Makes the pitch 10x bigger: "We protect sports, OTT, education, and publishing"

**What to change:**
- `asset.model.js` → expand `type` enum
- `DashboardAssetsPage.jsx` → add asset type icons for new types (📄 for exam_paper, 🎵 for music)
- Seed data → add a few demo exam paper assets and document assets
- `AgentCommandCenterPage` → show "Protecting: Sports | OTT | Education | Documents" banner
- Landing page → update hero copy to reference expanded scope

**Effort: minimal changes, massive pitch impact.**

---

### Phase 2.5 — Landing Page Rebrand (1 hr)

**File to update:** `client/src/pages/landing/LandingPage.jsx`

Update the landing page to emphasize the **autonomous agent** angle, not just the piracy detector angle.

**Key copy changes:**
- Hero headline: "Introducing Piractrix. The Autonomous Rights Enforcement Agent."
- Sub-headline: "Detect. Decide. Defend. Automatically."
- Replace static feature cards with a flow diagram showing the agent decision loop
- Add a "Powered by" section: Gemini AI, pHash fingerprinting, multi-platform scraping
- Add credibility badge: "Top 106 — Google Solution Challenge 2026"
- Add the domains: Sports | OTT | Education | Publishing

**Key visual to add:** An animated agent loop diagram showing:
`Perceive → Analyze → Classify → Decide → Act → Learn → Perceive...`

This can be a CSS animation, SVG, or even a simple React component. Make it the hero visual.

---

### ⭐ DAY 2 BONUS — Agent "Prediction Mode" (Piracy Forecast)

This is the most impressive bonus feature if you can build it:

**Concept:** Before a major sports event, the agent can predict expected violation volume.

**Implementation:**
- New endpoint: `POST /api/agent/predict`
- Input: asset title, scheduled broadcast time, platform popularity signals
- Call Gemini with prompt: "Based on similar events, estimate violation count and time distribution for the next 24 hours after broadcast"
- Output: `{ expectedViolations: 45, peakHour: 2, riskLevel: 'high', topPlatforms: ['telegram', 'youtube'] }`
- Show in Agent Command Center as "Upcoming Event Forecast" card

**In the demo:** "In 6 hours, the IPL Final broadcasts. Piractrix predicts 45+ violations within 2 hours. Autonomous mode is active."

This is genuinely novel. No other team will have this.

---

### ⭐ DAY 2 BONUS 2 — Agent Self-Improvement (Query Learning)

Track which search keywords from Gemini actually found violations vs which found nothing.

**Implementation:**
- After each scan completes, log `{ keyword, platform, violations_found: boolean }`
- New endpoint: `GET /api/agent/keyword-intelligence`
- Show in UI as "Top Performing Search Queries" and "Low Signal Queries"
- Over time, agent weights effective queries higher (simple frequency scoring)

**Pitch to judges:** "Piractrix continuously learns which search patterns find pirates most effectively, improving scan precision with each enforcement cycle."

---

## 🟢 DAY 3 — POLISH, DEMO, SUBMISSION

**Goal:** Record the best possible demo video. Clean the GitHub. Write the README. Submit.

---

### Phase 3.1 — Demo Data & Seed Script (1 hr)

Update `server/scripts/seed_demo_data.js` to include:
- 5+ assets across different types (2 sports videos, 1 exam paper, 1 OTT clip, 1 highlight)
- 20+ violations with varied severity levels and platforms
- 15+ agent decision log entries showing the full reasoning chain
- 4-5 threat memory entries with known pirate domains
- Realistic timestamps spread over the last 7 days

The demo data should tell a story when the judge clicks through the dashboard.

---

### Phase 3.2 — Performance & Polish (1 hr)

Go through each page and fix obvious visual issues:
- Make sure AgentCommandCenterPage renders cleanly on 1080p
- Autonomous mode toggle should have a satisfying animation
- Agent decision feed should auto-scroll to new entries
- Severity badges should be color-coded: red=5, orange=4, yellow=3, blue=2, gray=1
- Loading states for all new API calls
- Empty states for when there are no decisions yet

---

### Phase 3.3 — GitHub README Rewrite (1 hr)

The README is what judges read before they watch the demo. Make it count.

**Structure:**
```
# Piractrix — Autonomous Rights Enforcement Agent
## FAR AWAY 2026 | Agentic & Autonomous Systems Theme
[Live Demo] [Demo Video] [Presentation]

## The Problem (2 paragraphs with real numbers)
## The Solution (agent loop diagram as ASCII art)
## How the Agent Works (5-step decision chain)
## Architecture (3-service diagram)
## Tech Stack (table)
## Agent Features (with screenshots)
## Quick Start
## Google Technologies Used (keep the existing table - it's great)
```

Key additions:
- Add the confidence cascade architecture diagram
- Add an Agent Decision example (real JSON output with reasoning field)
- Mention: "Top 106, Google Solution Challenge 2026" as credibility signal

---

### Phase 3.4 — Demo Video Script (2 hrs to record)

**The demo video is worth 40% of the Round 1 score. Invest here.**

Recommended 3-minute structure:

```
0:00-0:20 — HOOK
  "Every day, thousands of pirated sports clips flood the internet.
   Rights holders lose billions. Current detection is slow, manual, and reactive.
  Piractrix changes this."

0:20-0:40 — SHOW THE PROBLEM
  Open a Telegram group showing pirated match clips
  "By the time a human reviews this, the link has 50,000 views."

0:40-1:20 — INTRODUCE THE AGENT
  Show Agent Command Center
  Turn on Autonomous Mode
  "We give Piractrix one asset: the IPL Final highlights."
  Upload a video → fingerprint generates
  "The agent begins monitoring. Watch the live feed."

1:20-2:00 — LIVE DECISION
  Show a violation being detected
  Show the reasoning stream populating in real-time:
  "78% confidence match... checking domain reputation...
   known repeat offender... severity classified as 5...
   auto-drafting DMCA notice..."
  Show the DMCA draft appearing
  "Time from detection to enforcement ready: 12 seconds."

2:00-2:30 — THE BIGGER PICTURE
  Switch to analytics page briefly
  Show Threat Memory: "The agent remembers 23 known pirate domains"
  Show asset expansion: "Works for sports, OTT, exam papers, documents"
  "Piractrix doesn't just detect piracy. It builds a persistent intelligence network."

2:30-3:00 — OUTRO
  Show the GitHub, live demo link
  "Built on pHash fingerprinting, Gemini AI classification, and an autonomous
   enforcement pipeline — powered by Google technologies."
  Team name + FAR AWAY logo
```

**Technical note for recording:**
- Use the live deployment at sportshield-ten.vercel.app if it's updated
- Or run locally with seed data
- Screen record at 1080p
- Add subtle background music (calm, tech-y)
- Keep captions for the reasoning text that appears

---

### Phase 3.5 — Presentation Slides (1 hr)

If you have time, update the existing Canva presentation to:
- Slide 1: Piractrix — Autonomous Rights Enforcement Agent
- Slide 2: The Problem (numbers, piracy stats)
- Slide 3: The Agent Loop (animated diagram)
- Slide 4: How It Works (5-step decision chain with icons)
- Slide 5: Architecture (3-service diagram)
- Slide 6: Confidence Cascade (show the staged processing)
- Slide 7: Agent Decision Log (show real reasoning output)
- Slide 8: Expansion (Sports + OTT + Education + Documents)
- Slide 9: Tech Stack (Google tech table is already strong)
- Slide 10: Results + Live Demo QR code

Keep it to 10-12 slides max. FAR AWAY rules say max 15 slides but judges skim.

---

## PART 4 — BONUS FEATURES PRIORITY TABLE

| Feature | Impact | Effort | Priority | Phase |
|---------|--------|--------|----------|-------|
| Autonomous Mode toggle | ⭐⭐⭐⭐⭐ | Low | P0 | Day 2 |
| Agent Reasoning Log | ⭐⭐⭐⭐⭐ | Medium | P0 | Day 1 |
| Threat Memory UI | ⭐⭐⭐⭐ | Low | P1 | Day 2 |
| Severity Classifier (Gemini) | ⭐⭐⭐⭐⭐ | Medium | P0 | Day 1 |
| Confidence Cascade | ⭐⭐⭐⭐ | Medium | P1 | Day 1 |
| Content Domain Expansion | ⭐⭐⭐⭐⭐ | Low | P0 | Day 2 |
| Live Agent Feed (real) | ⭐⭐⭐⭐⭐ | Low | P0 | Day 2 |
| Piracy Prediction Mode | ⭐⭐⭐⭐⭐ | Medium | P1 | Day 2 |
| Query Intelligence Learning | ⭐⭐⭐ | Medium | P2 | Day 2 |
| Landing page rebrand | ⭐⭐⭐ | Low | P1 | Day 2 |
| Demo seed data | ⭐⭐⭐⭐ | Low | P0 | Day 3 |

---

## PART 5 — JUDGING CRITERIA ALIGNMENT

| Criteria | How Piractrix Scores |
|----------|----------------------|
| **Innovation & Technical Depth** | Multi-agent architecture, confidence cascade, pHash + Vision AI + Gemini chain, ThreatMemory persistence |
| **Engineering Quality** | 3-service microarchitecture, real deployed app, proper models/controllers/services separation, Socket.io real-time |
| **Real-World Impact** | $25B+ piracy problem, proven in Google Solution Challenge (Top 106), exam paper piracy relevance for India |
| **Scalability** | Parallel ML scraping, staged cascade processing, MongoDB indexing, per-org data isolation |
| **Design & UX** | Professional dashboard (already built), new Agent Command Center, reasoning stream animation |
| **Execution Quality** | Working live demo, real fingerprint + DMCA pipeline, not a fake demo |

---

## PART 6 — WHAT NOT TO BUILD (TIME PROTECTION)

With 3 days, these are explicitly NOT worth building:

- ❌ Mobile app (no time, not needed for Round 1)
- ❌ Blockchain evidence anchoring (complex, marginal judge impact)
- ❌ Direct platform API integrations (legal complexity, major scope creep)
- ❌ Full multi-tenancy rework (org isolation already exists)
- ❌ Automated actual email sending in live demo (risky, demo it as "queued")
- ❌ Rebuilding the existing scraper (it already works)
- ❌ Changing the existing auth system (not needed)

---

## PART 7 — FILE-LEVEL CHANGE SUMMARY

### Create (new files):
```
server/src/agents/orchestrator.agent.js
server/src/agents/decision.agent.js
server/src/agents/executor.agent.js
server/src/agents/memory.agent.js
server/src/agents/perception.agent.js
server/src/models/agentDecisionLog.model.js
server/src/models/threatMemory.model.js
server/src/routes/agent.route.js
server/src/controllers/agent.controller.js
server/src/services/agent.service.js
ml-service/ai/severity_classifier.py
ml-service/ai/reasoning_generator.py
ml-service/ai/cascade_processor.py  (optional bonus)
client/src/pages/dashboard/AgentCommandCenterPage.jsx
client/src/pages/dashboard/AgentDecisionLogPage.jsx
client/src/components/AgentStatusBadge.jsx
client/src/components/AgentReasoningCard.jsx
client/src/components/ThreatIntelCard.jsx
```

### Modify (existing files — minimal changes):
```
server/src/services/scans.service.js   → call agent after violations created
server/src/jobs/scan.job.js            → use perception agent for smart scheduling
server/src/routes/index.js             → register agent.route.js
server/src/models/asset.model.js       → expand type enum
server/src/config/socket.js            → add agent:decision event emit
ml-service/app/main.py                 → add /ml/classify-severity endpoint
client/src/components/Sidebar.jsx      → add Agent Center nav items
client/src/routes/AppRoutes.jsx        → add new page routes
client/src/pages/dashboard/DashboardHomePage.jsx → redirect or replace with AgentCommandCenter
client/src/pages/landing/LandingPage.jsx → copy + visual update
server/scripts/seed_demo_data.js       → add agent decisions and threat memory
```

---

## PART 8 — THE DEMO MOMENT (Most Important Section)

### The Single Most Important Moment in Your Demo

At the 1:30 mark of your video, this sequence must happen live:

1. You say: "Autonomous Mode is ON"
2. You upload a new video asset
3. The fingerprint generates (10 seconds)
4. You say: "Piractrix is now monitoring"
5. You trigger a scan (or it auto-triggers)
6. The Agent Live Feed starts populating with reasoning text — animated, real-time
7. A SEVERITY 4 violation appears in the feed
8. The reasoning text reads: `"Detected near-duplicate on YouTube channel [X]. Domain has 3 prior violations in ThreatMemory. Confidence: 74%. Classifying as coordinated repost. Auto-drafting platform-specific DMCA notice..."`
9. The violation appears in the Violations tab with status "DMCA AUTO-DRAFTED"
10. You say: "Time from detection to enforcement ready: under 15 seconds."

**This 45-second sequence is your entire pitch.**

If you nail this sequence, you win. Everything else is supporting evidence.

---

## PART 9 — EMERGENCY PRIORITIZATION (If Time Runs Short)

If you're running behind, here is the absolute minimum needed to still be competitive:

**Minimum Viable Agent (5-6 hours total):**
1. `AgentDecisionLog` model (30 min)
2. `severity_classifier.py` with Gemini (1 hr)  
3. Call classifier after violations created, write to log (1 hr)
4. `AgentCommandCenterPage.jsx` showing decision log with reasoning (2 hrs)
5. Autonomous Mode toggle (30 min)
6. Update landing page copy to say "Autonomous Rights Enforcement Agent" (30 min)

Even this minimum transforms the positioning from "tool" to "agent" and makes the demo story coherent.

---

## PART 10 — SUBMISSION CHECKLIST

```
GitHub Repository
[ ] All new agent files committed with clean commit messages
[ ] README.md fully rewritten (Piractrix framing)
[ ] .env.example updated with any new env vars
[ ] docker-compose.yml tested locally
[ ] Seed script working (npm run seed:demo)
[ ] No API keys in any committed file

Demo Video
[ ] 3 minutes or less
[ ] Shows the agent decision sequence (Section 8)
[ ] Shows Autonomous Mode toggle
[ ] Shows reasoning text streaming
[ ] Shows domain expansion (exam papers visible)
[ ] Shows DMCA auto-draft
[ ] Uploaded to YouTube (unlisted)

Presentation (optional but recommended)
[ ] 10-12 slides max
[ ] Agent loop diagram on slide 3
[ ] Tech stack table with Google tech (important for this team's history)
[ ] Live demo QR code on final slide

Submission Form
[ ] GitHub link (public repo)
[ ] Demo video link
[ ] Optional: live deployment URL
[ ] Team member details (all 1-5 members)
```

---

## APPENDIX — AGENT REASONING EXAMPLES FOR DEMO DATA

These are real reasoning strings to pre-populate your seed data. They make the demo look impressive and authentic:

```
"Detected exact match on YouTube with 91% confidence. Video uploaded 3 hours ago, 
12,000 views. Domain youtube.com/channel/UCxxxx has 2 prior violations on record. 
Color histogram shows 0.97 cosine similarity with source asset. Escalating 
to severity 5. Auto-drafting DMCA notice targeted at YouTube Trust & Safety team."

"Near-duplicate identified on Telegram channel @sportsfreestreams. 
Hamming distance of 8 bits (threshold: 12). New domain — no ThreatMemory entry. 
Insufficient repeat offender data to auto-escalate. Queuing for human review 
at severity 3. Human approval required before enforcement action."

"Scan triggered for IPL Qualifier 2 highlights — asset flagged as high-risk 
based on 8 violations in previous 72 hours for similar assets. Scheduled 
scan interval reduced from 24h to 2h. Expanding keyword set using Gemini 
to include transliterated Hindi search queries."

"Platform surge detected: 7 violations from telegram.org in last 58 minutes. 
Threshold exceeded (5 per hour). Generating platform_surge CRITICAL alert. 
Adding telegram.org to ThreatMemory with threat level: HIGH. 
Notifying organization via email."

"Candidate URL discarded at Stage 1 of confidence cascade. Keyword quality 
score: 12/100. Title similarity: 0.14. No fingerprint computation needed — 
insufficient signal for match. Logged as low_confidence_discard. 
Compute resources preserved."
```

---

*Built for FAR AWAY 2026 | Team Esc(Reality); | Agentic & Autonomous Systems Theme*
