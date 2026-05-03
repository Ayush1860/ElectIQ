# ElectIQ — Indian Election Process Assistant

**Live App:** [https://electiq-148a8.web.app/](https://electiq-148a8.web.app/)

**Note:** This project is a submission for **Prompt Wars** by **Hack2skill**.

## Demo Video

<video src="./public/assets/Recording%202026-05-03%20223228.mp4" controls="controls" width="100%" style="max-width: 800px;">
  Your browser does not support the video tag.
</video>

> 🇮🇳 AI-powered, non-partisan guide to understanding Indian elections  
> Built with Google Gemini, Firebase, Maps, Cloud Translation & Charts

---

## 🎯 What is ElectIQ?

ElectIQ is an accessible, interactive web application that helps Indian citizens understand the election process — from voter registration to result declaration. It uses conversational AI (Google Gemini) to answer questions in simple language, supports 12 Indian languages, and provides tools like polling booth finder and election quizzes.

**ElectIQ does NOT advocate for any political party or candidate.**

---

## ✨ Features

| Feature | Google Service | Description |
|---------|---------------|-------------|
| 🤖 AI Chat Assistant | **Gemini 2.0 Flash** | Ask questions about Indian elections in simple language |
| 📋 Interactive Timeline | **Google Charts** | Step-by-step election process (3 phases, 11 steps) |
| 📍 Polling Booth Finder | **Maps JavaScript API + Places** | Find your nearest polling station by PIN code |
| 🌐 Multi-language Support | **Cloud Translation v3** | 12 languages including Hindi, Tamil, Telugu, Bengali |
| 🧠 Election Quizzes | **Firestore** | Test your knowledge with 10 flashcard-style questions |
| 📅 Calendar Integration | **Google Calendar API** | Add election deadlines to your calendar |
| 📊 Data Visualizations | **Google Charts** | Voter turnout trends, state-wise data, Gantt timeline |
| 🔐 User Authentication | **Firebase Auth** | Anonymous + Google Sign-In to save progress |
| 📱 PWA / Offline Support | **Firebase Hosting** | Works offline with service worker caching |
| ♿ WCAG 2.1 AA Accessible | — | Screen reader support, keyboard navigation, high contrast |

---

## 🏗 Architecture

```
┌──────────────────────────────────┐
│         Client (PWA)             │
│  Vanilla JS + Web Components     │
│  Firebase SDK + Google Charts    │
│  Maps JavaScript API (lazy)      │
└─────────┬────────────────────────┘
          │ HTTPS (Firebase Hosting)
┌─────────▼────────────────────────┐
│     Firebase Cloud Functions     │
│  ┌──────────────────────────┐    │
│  │ askElectIQ (Gemini proxy)│    │
│  │ translateText (Translate)│    │
│  │ findPollingPlaces (Maps) │    │
│  └──────────────────────────┘    │
│  Auth validation + Rate Limiting │
│  DOMPurify + Audit Logging       │
└─────────┬────────────────────────┘
          │
┌─────────▼────────────────────────┐
│       Google Cloud APIs          │
│  • Gemini 2.0 Flash              │
│  • Cloud Translation v3          │
│  • Maps/Places API               │
│  • Cloud Logging (audits)        │
└──────────────────────────────────┘
```

---

## 🔐 Security

- **API keys never exposed client-side** — all sensitive APIs proxied through Cloud Functions
- **Firebase Auth required** for all API calls (token validation server-side)
- **Rate limiting**: 20 Gemini calls per user per hour (Firestore transaction-based)
- **Input sanitization**: DOMPurify on client AND server
- **CSP headers**: Strict Content-Security-Policy via Firebase Hosting
- **Firestore Security Rules**: Users can only read/write their own documents
- **Audit logging**: All Gemini calls logged to Cloud Logging (no PII)
- **HTTPS only**: Firebase Hosting enforces HTTPS

---

## ♿ Accessibility (WCAG 2.1 AA)

- Semantic HTML5 (`<main>`, `<nav>`, `<article>`, `<section>`)
- ARIA labels on all interactive elements
- Skip-to-content link as first focusable element
- Keyboard navigation (Tab, Arrow keys, Enter/Space)
- Focus trapping in modals and chat panel
- Screen reader announcer (`aria-live="polite"`)
- 4.5:1 color contrast ratio
- `prefers-reduced-motion` respected
- 200% zoom without horizontal scroll
- Accessible data tables as chart fallbacks
- `<html lang="">` updated dynamically on language change

---

## 🚀 Setup & Deployment

### Prerequisites

- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools`
- A Firebase project with Firestore, Auth, Analytics, and Hosting enabled
- Google Cloud APIs enabled: Gemini, Maps, Translation

### 1. Clone & Install

```bash
git clone <repo-url>
cd electiq
npm install
cd functions && npm install && cd ..
```

### 2. Configure Environment

```bash
# Copy the example env file
cp .env.example .env

# Set Cloud Function secrets
firebase functions:secrets:set GEMINI_API_KEY
firebase functions:secrets:set TRANSLATE_API_KEY
firebase functions:secrets:set MAPS_API_KEY
```

Edit `src/services/firebaseService.js` and replace the `FIREBASE_CONFIG` values with your project's config (from Firebase Console → Project Settings → Your Apps).

### 3. Local Development

```bash
# Start local dev server
npm run dev

# Or use Firebase Emulators for full-stack local testing
firebase emulators:start
```

### 4. Deploy

```bash
# Deploy everything
firebase deploy

# Or deploy individually
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules
```

---

## 📁 Project Structure

```
electiq/
├── public/
│   ├── index.html              # PWA shell, semantic HTML, ARIA landmarks
│   ├── manifest.json           # PWA manifest
│   ├── sw.js                   # Service worker (offline support)
│   ├── styles/
│   │   ├── main.css            # Design system, tokens, responsive
│   │   └── components.css      # Component-specific styles
│   └── assets/
│       └── favicon.svg         # App icon
├── src/
│   ├── app.js                  # Main entry point
│   ├── components/
│   │   ├── ElectionTimeline.js # Interactive election phases
│   │   ├── ChatAssistant.js    # AI chat with streaming
│   │   ├── PollingLocator.js   # Google Maps booth finder
│   │   ├── QuizModule.js       # Flashcard quizzes
│   │   ├── LanguageSwitcher.js # 12-language selector
│   │   ├── ProgressTracker.js  # Learning progress bar
│   │   ├── DeadlineCountdown.js# Real-time countdown
│   │   └── ElectionCharts.js   # Google Charts visualizations
│   ├── services/
│   │   ├── firebaseService.js  # Auth + Firestore
│   │   ├── geminiService.js    # Gemini proxy client (streaming)
│   │   ├── calendarService.js  # Calendar + ICS generation
│   │   └── translateService.js # Translation proxy client
│   └── utils/
│       ├── sanitize.js         # DOMPurify wrapper
│       ├── accessibility.js    # ARIA helpers, focus trap
│       └── analytics.js        # Firebase Analytics (PII-free)
├── functions/
│   ├── index.js                # Cloud Functions (API proxies)
│   └── package.json
├── firestore.rules             # Security rules
├── firestore.indexes.json      # Composite indexes
├── firebase.json               # Hosting + Functions config
├── package.json
└── README.md
```

---

## 📊 Analytics Events Tracked

| Event | Parameters | PII |
|-------|-----------|-----|
| `election_topic_viewed` | topic, phase | None |
| `ai_question_asked` | category | None |
| `quiz_completed` | topic, score, passed | None |
| `polling_locator_used` | pin_prefix (3 digits only) | No full PIN |
| `language_changed` | from, to | None |
| `calendar_event_added` | event_type | None |
| `resource_link_clicked` | source, topic | None |
| `ai_response_feedback` | helpful, topic | None |

---

## 🇮🇳 Official Sources

- [Election Commission of India](https://eci.gov.in)
- [National Voters' Service Portal](https://voters.eci.gov.in)
- [Election Results](https://results.eci.gov.in)
- Voter Helpline: **1950**

---

## 📄 License

MIT License — Educational use. Not affiliated with the Election Commission of India.

---

*Built with ❤️ using Google Gemini, Firebase, Maps, Cloud Translation & Charts*
