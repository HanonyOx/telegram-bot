# 🤖 HANON AI — AI Web3 Community Manager

Powered by **Groq AI (LLaMA 3 70B)**. Runs 24/7 as an expert Telegram community manager for any Web3 / crypto project.

---

## ⚡ Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env
```
Edit `.env` and fill in:
- `TELEGRAM_BOT_TOKEN` → Get from [@BotFather](https://t.me/BotFather)
- `GROQ_API_KEY` → Get from [console.groq.com](https://console.groq.com)

### 3. Run the bot
```bash
node bot.js
```

---

## 🔑 Getting Your Keys

### Telegram Bot Token
1. Open Telegram → search **@BotFather**
2. Send `/newbot`
3. Follow prompts → copy your token

### Groq API Key
1. Go to [console.groq.com](https://console.groq.com)
2. Sign up (free)
3. Create API key → copy it

---

## 🛠 Admin Commands

| Command | Description |
|---------|-------------|
| `/setup` | Full setup guide |
| `/setproject [info]` | Tell bot about your project |
| `/addfaq Q: ... \| A: ...` | Add a FAQ |
| `/listfaqs` | View all FAQs |
| `/announce [text]` | AI-formatted announcement |
| `/warn` | Warn a user (reply to their message) |
| `/ban` | Ban a user (reply to their message) |
| `/unban [userId]` | Unban a user |
| `/clearwarnings` | Clear warnings (reply to message) |
| `/stats` | Community statistics |

## 💬 Public Commands

| Command | Description |
|---------|-------------|
| `/start` | Introduction & command list |
| `/faq` | View FAQs |
| `/about` | Project summary |
| `/warnings` | Your own warning count |

---

## 🧠 How the Bot Learns Your Project

The bot learns about your project **3 ways**:

1. **`/setproject`** — Admin provides a description directly
2. **Pinned messages** — Bot auto-reads all pinned messages
3. **`/addfaq`** — Specific Q&A pairs for precise answers

---

## 🛡 Auto-Moderation

The bot automatically:
- Detects and deletes spam (invite links, scam patterns, fake giveaways)
- Issues warnings (warn 1 → warn 2 → warn 3 → **auto-ban**)
- Welcomes new members with an AI-generated message
- Operates in groups only when **mentioned** or **replied to**

### Required Bot Permissions in Telegram:
- ✅ Delete messages
- ✅ Ban users
- ✅ Pin messages (optional)

---

## 🌐 Hosting 24/7

### Option A: Railway (Recommended — free tier available)
```bash
# Install Railway CLI
npm install -g @railway/cli
railway login
railway init
railway up
```
Set env vars in Railway dashboard.

### Option B: VPS (DigitalOcean / Hetzner)
```bash
npm install -g pm2
pm2 start bot.js --name nebulabot
pm2 save
pm2 startup
```

### Option C: Render
- Connect your GitHub repo
- Set env vars in dashboard
- Deploy as a background worker

---

## 📁 Data Storage

All community data (project info, FAQs, warnings, conversation history) is stored in `community_data.json` locally. For production, consider replacing with a real database (MongoDB, PostgreSQL).

---

## 🔧 Customization

- **Model**: Change `MODEL` in `bot.js` to use different Groq models
- **Spam patterns**: Edit `SPAM_PATTERNS` array
- **Warning limit**: Change `MAX_WARNINGS` (default: 3)
- **Daily cron**: Uncomment the cron block for daily Web3 insights
- **Conversation memory**: Adjust the `40` limit in `addToHistory()`

---

Built with ❤️ for Web3 communities.


## 👤 Author Information

**Name:** ANTHONY CHUKWUEBUKA OMEH (HANONY)  
**Position:** Developer / Project Manager  
**Email:** tonyomehukwuji@gmail.com
**Telegram:** https://t.me/HanonyOx



> _This is the first version of the project (V1). More updates and features will be added as development progresses._

      AI COMMUNITY MANAGER BOT    Web3 · Blockchain · Crypto · Tech · Full Telegram Admin   
