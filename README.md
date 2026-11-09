# VocabRecall Coach Pro (Modular Edition)

## Project Structure
```
vocab-recall-coach/
├── index.html                  # Semantic UI markup & modals
├── css/
│   └── style.css               # Clean themes, layout, cards, and redirect shields
├── js/
│   ├── security.js             # PIN Gate, window unload guard, and iframe sandboxing
│   ├── fsrs.js                 # Free Spaced Repetition Scheduler (FSRS v4) & date math
│   ├── audio.js                # Web Speech API pronunciation & YouGlish API player
│   ├── sync.js                 # Robust 25-column Google Sheets bidirectional synchronization
│   ├── ai.js                   # Gemini API client (lexical schema & prompt engineering)
│   ├── practice.js             # Active Recall (typing) & Flash Review routines
│   ├── vocab.js                # CRUD, bulk operations, view modals, and search
│   └── app.js                  # Routing, stats, import/export, and app bootstrap
└── google-apps-script/
    └── Code.gs                 # Full Apps Script backend supporting deletion & phrasal verbs
```

## Setup Instructions
1. Upload `google-apps-script/Code.gs` to your Google Sheet's Apps Script editor.
2. Click **Deploy > Manage deployments > Edit > New version > Deploy**.
3. Launch `index.html` in any modern web browser.
4. Go to **Settings**, paste your Apps Script Web App URL and Gemini API key.
