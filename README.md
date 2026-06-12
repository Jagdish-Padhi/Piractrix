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



## 🚀 Key Features

### ✅ AI Asset Library
- **Video DNA Ingestion**: Upload match highlights, courses, documents, or images to generate a unique digital fingerprint.
- **Asset Intelligence**: View similarity metrics, scan history, and enforcement outcomes for every protected file.
- **Cloud Management**: Secure storage and metadata management for rights holders across multiple content domains.

### ✅ Autonomous Scan Discovery
- **Cross-Platform Monitoring**: Scans YouTube, Twitter (X), Telegram, and the open web simultaneously.
- **AI Auto-Suggest**: Automatically generates search keywords and metadata based on asset context.
- **Confidence Scoring**: Prioritizes results based on AI-calculated match probability and threat likelihood.
- **Adaptive Discovery**: Helps the agent decide when a scan should trigger based on signal strength.

### ✅ Violation Command Center (USP)
- **Evidence Audit**: Deep-dive into match explainability with color similarity, Hamming distance, and frame match count.
- **Reasoning Trail**: Review the agent's decision path and why a case was classified a certain way.
- **One-Click DMCA Draft**: Instantly generates legally-compliant, platform-specific takedown notices.
- **Resolution Workflow**: Track cases through `OPEN` → `REPORTED` → `RESOLVED` statuses.
- **Threat Memory**: Surface repeat offenders and known domains so the agent can escalate faster.
- **Deep Linking**: Direct navigation from email alerts to specific evidence records.

### ✅ Intelligence Analytics
- **Professional Reporting**: Generate high-fidelity PDF reports with embedded SVG charts.
- **Background Ops**: Start complex report generation and continue working; the service follows you globally.
- **Risk Assessment**: Automated AI insights into piracy hotspots, repeat offenders, and distribution trends.
- **Forecast Mode**: Preview likely violation spikes around major broadcasts and release windows.

### ✅ Real-Time Alerts
- **High-Confidence Notifications**: Instant email alerts for matches >85% similarity.
- **Piracy Surge Alerts**: Automated warnings for coordinated sharing or repeat-offender behavior.
- **Direct Enforcement Links**: "View Evidence" buttons in emails take you straight to the action.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, Vanilla CSS (Premium Themes), Lucide Icons, Chart.js |
| **Backend** | Node.js, Express.js, MongoDB Atlas (Mongoose) |
| **ML/Scraping** | Python, FastAPI, Puppeteer (PDF Rendering), Image/Video Hashing |
| **Integrations** | Brevo (Email), Cloudinary (Asset Hosting), Gemini AI (Reasoning + Legal Drafting) |
| **Auth** | JWT (Access + Refresh Tokens), Firebase (Social Login) |

---

## 🌐 Google Technologies Used

| Google Technology | Implementation Detail | Status |
|-------------------|-----------------------|--------|
| **Gemini Pro (Google AI)** | **AI Reasoning:** Generates high-accuracy classification, legal context, and platform-specific DMCA drafts in <3s using structured JSON outputs. | 🚀 Active |
| **Firebase Authentication** | **Identity Management:** Seamless Google One-Tap integration for verified rights-holder sessions. | 🚀 Active |
| **Google Cloud Platform** | **Microservice Target:** Proposed for serverless Cloud Run deployment to handle bursty agent and ML workloads during live events. | 🛡️ Target |
| **Chrome DevTools Protocol** | **Evidence Engine:** Native Puppeteer integration for high-fidelity PDF renders and automated screenshot evidence. | 🚀 Active |
| **Google Search API** | **Smart Scrapers:** Used specialized Puppeteer nodes to bypass **API rate-limits** and monitor dynamic threat domains in real-time. | 💎 Optimized |
| **Google Vision AI** | **Hybrid Matching:** Local **pHash & Transformers** used for 1M+ frame analysis to ensure **low-latency throughput** and cost scaling. | 💎 Optimized |
| **Google Maps Platform** | **Tactical Viz:** SVG-based Geo-Mapping used for **zero-latency distribution tracking** during high-traffic match windows. | 💎 Optimized |

---

## ⚡ Quick Start

```bash
# Clone repository
git clone <repo-url>
cd Piractrix

# Backend setup
cd server
npm install
# Configure .env (MONGO_URI, BREVO_API_KEY, etc.)
npm run dev           # Runs on :5000

# ML/Scraper setup (new terminal)
cd ml-service
pip install -r requirements.txt
uvicorn app.main:app --reload  # Runs on :8000

# Frontend setup (new terminal)
cd client
npm install
npm run dev           # Runs on :5173
```

### Environment Variables

**Server (.env)**
```env
MONGO_URI=your_mongodb_uri
CLIENT_URL=http://localhost:5173
BREVO_API_KEY=your_brevo_key
BREVO_SENDER_EMAIL=your_verified_sender
CLOUDINARY_CLOUD_NAME=your_name
GEMINI_API_KEY=your_gemini_key
```

**Client (.env)**
```env
VITE_API_URL=http://localhost:5000/api
```

---

## 🔮 Future Scope
- **IoT Live Stream Integration**: Direct ingestion from broadcast feeds.
- **Blockchain Evidence Anchoring**: Immutably record proof of infringement for court cases.
- **Automated Takedown API**: Direct integration with platform copyright APIs for zero-click resolution.
- **Predictive Piracy Heatmaps**: AI forecasting of where leaks are likely to occur based on match popularity.

---

**Built with ❤️ by Team Esc(Reality);**
