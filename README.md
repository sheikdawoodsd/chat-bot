# 🪐 Hi Nova! — Upgraded AI Chatbot

A production-grade, ChatGPT-style conversational AI assistant web application named **"Hi Nova!"**, powered by Google Gemini and built with **React**, **Vite**, **Tailwind CSS**, **Node.js / Express**, and **SQLite**.

![Hi Nova Logo](client/public/logo.png)

---

## ✨ Features & Upgrades

### 1. 🔊 Audible Voice Mode with Gemini TTS (Part 1)
- **Real Playable Audio (`POST /api/tts`)**: Converts Nova's text replies into lifelike speech using the Gemini Text-to-Speech model (`GEMINI_TTS_MODEL=gemini-2.5-flash-preview-tts`), returning 16-bit PCM converted to standard RIFF WAV format.
- **Persistent Audio Player**: Singleton audio manager with user gesture unlock, volume control (1.0 default, configurable), sentence-by-sentence queueing with prefetching for instant speech start without cutting off.
- **Live Captions & Voice Settings**:
  - Live captions of what Nova is speaking in real time.
  - "Test voice" button ("Hi, I'm Nova!").
  - Voice picker (Gemini prebuilt voices: `Kore`, `Puck`, `Fenrir`, `Aoede`, `Charon`) and speed control.
  - "Tap to enable sound" button when browser autoplay policy blocks audio.
  - Tap the mascot orb anytime to interrupt Nova and speak.
- **Fail-Safe Browser Voice Backup**: If `/api/tts` hits quota or fails, seamlessly transitions to an improved browser `speechSynthesis` engine (waiting for `voiceschanged`, volume 1, sentence splitting to bypass Chrome 15s freeze).

### 2. 🗂️ Sidebar Toggle, Slim Rail & Full History Search (Part 2)
- **Collapsible Sidebar**: Top-left panel toggle button collapses the sidebar into a compact rail showing the toggle, New chat, and Search icons. Collapsed state is remembered in `localStorage` (`nova_sidebar_collapsed`).
- **Keyboard Shortcuts**:
  - `Ctrl+B` / `Cmd+B`: Toggle sidebar expand/collapse.
  - `Ctrl+K` / `Cmd+K`: Focus search bar.
- **Full Chat & Message Content Search (`GET /api/chats/search?q=`)**: Debounced server-side search across both chat titles and message contents for the current user, displaying title, highlighted context snippet, and date.

### 3. 👤 Account Menu, Unique Username & Personalized (Incognito) Mode (Part 3)
- **Account Menu at Bottom-Left**: Avatar, user's full name, and `@username`. Clicking opens a popup menu:
  1. **Edit profile**: Change full name, set unique username (3-20 chars, `[a-zA-Z0-9_]`) with live availability checking (`GET /api/auth/check-username?u=`), and optional password change (current + new). Email is displayed read-only.
  2. **Personalized**: Dedicated private chat space like Chrome Incognito. UI switches to a distinct dimmer cosmic aesthetic with a privacy banner. Zero database records or disk files are stored (`isTemporary: true`), and the conversation is wiped completely upon exit or refresh.
  3. **Clear all chats (`DELETE /api/chats`)**: Permanently wipes all user conversations, messages, and uploaded files while retaining the user account.
  4. **Delete account**: Wipes account, chats, and disk files with confirmation.
  5. **Log out**: Clears session cookie and returns to login.

### 4. 🎯 Accurate Answers, Grounding & Feedback (Part 4)
- **Dynamic Real-World Time & Anti-Hallucination**: System prompt automatically injects real-time date, time, and user's timezone, coupled with low temperature (0.35) and strict anti-hallucination rules.
- **Google Search Grounding**: Enabled with `{ tools: [{ googleSearch: {} }] }` to cite real-time web facts. Sources are displayed under answers as clickable chips (title + domain). Gracefully falls back to standard generation if grounding hits quota limits.
- **Thumbs Up / Down Feedback**: Interactive buttons under each AI response calling `POST /api/messages/:id/feedback` to log response quality.

### 5. 🎨 Prompt-Following Image Generation & Multimodal Understanding (Part 5)
- **Multimodal Optimization**: Automatic image resizing (max 2048px), high media resolution, and image parts sent before text questions with explicit labels (Image 1, Image 2).
- **Prompt Expansion**: Uses Gemini text model to expand user prompts into detailed prompts capturing subjects, count, style, clothing, setting, aspect ratio, and quoted text.
- **Aspect Ratio & Style Pickers**:
  - Aspect ratios: `1:1`, `16:9`, `9:16`, `4:3`.
  - Styles: `Realistic`, `Illustration`, `3D`, `Anime`, `Minimal`.
- **Collapsible "Prompt used"**: Displayed under every generated image in the chat.
- **Image Editing**: Pass existing generated images or uploads along with edit instructions.
- **Vision Self-Check (`IMAGE_SELF_CHECK=true`)**: Verifies generated images follow user requests.
- **Dual Engine Zero-Error Fallback**: Flux & Turbo high-res fallback guarantees images are always produced even without billed quota.

---

## 🛠️ Environment Variables

Configure these variables in `server/.env` (see `server/.env.example`):

```bash
# Server Port
PORT=5000

# AI Provider (gemini, openai, claude)
AI_PROVIDER=gemini

# Google Gemini API Key & Models
# Get your free key at https://aistudio.google.com/apikey
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image

# JWT Authentication Secret (32+ character random string)
JWT_SECRET=super_secret_nova_jwt_key_change_in_production_32chars

# SQLite Database Path
DATABASE_PATH=data/nova.db
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
# Root
npm install

# Server
cd server && npm install && cd ..

# Client
cd client && npm install && cd ..
```

### 2. Configure Environment
Create `server/.env` based on `server/.env.example` and add your `GEMINI_API_KEY`.

### 3. Run Development Server
```bash
npm run dev
```
- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000](http://localhost:5000)

### 4. Run Automated Test Suite
```bash
node scripts/test-full-upgrade.js
node scripts/test-multimodal.js
```

---

## 🚢 Production Deployment Checklist

When deploying to production (e.g. Render, Railway, Fly.io, AWS, VPS):

1. **Persistent Disk Storage**:
   - SQLite requires a persistent disk mount for `server/data/nova.db` and `server/uploads/` so user accounts, messages, and uploaded files survive container restarts.
   - Alternatively, swap `server/db.js` with PostgreSQL or MongoDB without altering route or client logic.
2. **HTTPS Secure Cookies**:
   - Set `NODE_ENV=production` in your environment so the `nova_session` cookie automatically enables the `secure: true` flag.
3. **Strong JWT Secret**:
   - Generate a cryptographically secure 64-character string for `JWT_SECRET`.
