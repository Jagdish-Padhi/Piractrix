# 🛡️ Piractrix : AI-Powered Autonomous Rights Enforcement

**Hackathon:** Google Solution Challenge 2026 | **Team:** Esc(Reality); | **Track:** Digital Asset Protection

---

## 🔗 Quick Links (For Real experience)

| 🚀 Live Demo | 🎥 Video Walkthrough | 📊 Presentation |
|:------------:|:-------------------:|:---------------:|
| [**Launch App**](https://sportshield-ten.vercel.app/) | [**Watch Demo**](https://www.youtube.com/watch?v=LNHvwYCQkd8) | [**View PPT**](https://canva.link/wcxppf1vd2k979i) |

---

## 🎯 Problem Statement
Digital piracy across sports, OTT, education, and publishing costs rights holders billions annually. Current detection methods are fragmented, often failing to track content across diverse platforms like Telegram, Twitter/X, and the open web. Even when detected, the legal enforcement process is manual, slow, and lacks the technical evidence and reasoning trail needed for rapid takedowns.

## 💡 Solution
Piractrix is an autonomous rights-enforcement agent that protects digital assets using **AI Video DNA Fingerprinting**. It monitors major social platforms and the open web in real-time, reasons over threat signals, ranks severity, and bridges the gap to enforcement with **AI-powered DMCA drafting** and structured decision logs, allowing rights holders to go from "detection" to "takedown" in seconds.

It is built to support **Sports | OTT | Education | Publishing** workflows without changing the core platform.

---

## 🚀 Key Features (Engineering Upgrades V2.0)

### ✅ Agentic Command Center
- **WebSocket Telemetry Stream:** A terminal-style logger listening directly to real agent events (no random simulations).
- **Explainable Reasoning Trace:** Slide-over right drawer displaying the exact step-by-step progress (Keyword -> Fingerprint -> Vision -> Gemini -> Threat Memory -> Action -> Notify).
- **Autonomous Mode Switch:** A premium confirmation workflow giving ShieldAgent direct permissions to act and draft legally binding DMCA reports.

### ✅ Interactive Threat Graph
- **Force-Directed SVG Visualization:** A custom React force-directed network graph charting connections between threat domains, platform overlaps, and shared piracy clusters.
- **Node-Scoping Intelligence:** Dynamic node sizing proportional to total violation frequency, colored by severity, with interactive side-drawers for WHOIS lookups.

### ✅ Zero-Day Piracy Predictions
- **Gemini Threat Forecasts:** Querying Gemini AI against aggregate historical scan patterns to forecast leak rates for major broadcasts before kickoff.
- **Dynamic Risk Simulation:** interactive sliders simulating viewership magnitude and agent sweep latency impacts on copyright retention levels.

### ✅ Multi-Channel Notification Hub
- **Preserved Organization Prefs:** Settings enabling toggle-routing for Email (Brevo), WhatsApp text SMS, Telegram chat notifications, and custom Slack webhook streams.
- **Web Push integration:** Client registers service workers (`sw.js`) to capture native push notifications while the browser tab is closed.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite, Zustand, Vanilla CSS, Lucide Icons |
| **Backend** | Node.js, Express.js, MongoDB Atlas, Mongoose, Socket.io |
| **ML/Scraping** | Python, FastAPI, Puppeteer, Image/Video Hashing |
| **Integrations** | Brevo (Email), Cloudinary, Twilio (WhatsApp), Telegraf (Telegram), Web-Push |
| **Auth** | JWT (Access + Refresh Tokens), Firebase Admin |

---

## 🌐 Google Technologies Used

- **Gemini Pro (Google AI):** Generates high-accuracy classification, zero-day piracy forecasting, and platform-specific DMCA drafts.
- **Firebase Authentication:** Single sign-on and Identity management for verified rights-holder sessions.
- **Google Cloud Platform:** Hosting backend containers and microservice clusters.
- **Chrome DevTools Protocol (CDP):** Puppeteer integrations rendering screenshot evidence and reports.
- **Google Vision AI:** Visual verify node scanning within our Confidence Cascade.

---

## ⚡ Quick Start

### 1. Database Seeding
To initialize the database with complete, rich data matching the new v2.0 Agent decision pipelines and domain profiles, execute the seeding script:

```bash
cd server
npm install --legacy-peer-deps
npm run seed
```

This creates the organization `demo@piractrix.com` with password `Piractrix@2026` and populates 7 assets, 28 detailed case timelines, 22 agent logs, and 12 delivery logs.

### 2. Running Locally
Run both client and server development instances:

**Backend Server:**
```bash
cd server
npm run dev
```

**React Frontend:**
```bash
cd client
npm install
npm run dev
```

---

**Built with ❤️ by Team Esc(Reality);**
