/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║         AI COMMUNITY MANAGER BOT — Powered by Groq           ║
 * ║  Web3 · Blockchain · Crypto · Tech · Full Telegram Admin      ║
 * ╚═══════════════════════════════════════════════════════════════╝
 *
 * SETUP:
 *   1. npm install node-telegram-bot-api groq-sdk dotenv node-cron
 *   2. Create .env file with TELEGRAM_BOT_TOKEN and GROQ_API_KEY
 *   3. node bot.js
 */

require("dotenv").config();
console.log("Loaded token:", process.env.TELEGRAM_TOKEN);
const TelegramBot = require("node-telegram-bot-api");
const Groq = require("groq-sdk");
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");

// ─── INIT ──────────────────────────────────────────────────────────────────
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = "openai/gpt-oss-20b"; // Best Groq model for deep knowledge tasks
const DATA_FILE = path.join(__dirname, "community_data.json");

// ─── PERSISTENT STORAGE ───────────────────────────────────────────────────
function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  }
  return {
    communities: {},   // chatId → { projectInfo, faqs, pinnedContext, history }
    warnings: {},      // chatId → { userId → count }
    members: {},       // chatId → Set of userIds (stored as array)
    announcements: {}, // chatId → [{ text, scheduledAt }]
  };
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let db = loadData();

// ─── SPAM PATTERNS ────────────────────────────────────────────────────────
const SPAM_PATTERNS = [
  /t\.me\/[^\s]+/gi,          // Telegram invite links
  /bit\.ly|tinyurl|shorturl/gi,
  /(?:earn|make)\s*\$?\d+/gi, // "earn $500/day" type messages
  /free\s+(?:nft|token|crypto|money)/gi,
  /pump\.fun|honeypot/gi,
  /(dm|message)\s+me\s+for/gi,
  /investment\s+opportunity/gi,
  /guaranteed\s+profit/gi,
  /airdrop.*claim.*now/gi,
];

const MAX_WARNINGS = 3;

// ─── CONVERSATION HISTORY ─────────────────────────────────────────────────
// Keep last 20 messages per chat for context
function getHistory(chatId) {
  const community = db.communities[chatId];
  return community?.history || [];
}

function addToHistory(chatId, role, content) {
  if (!db.communities[chatId]) db.communities[chatId] = {};
  if (!db.communities[chatId].history) db.communities[chatId].history = [];
  db.communities[chatId].history.push({ role, content });
  // Keep last 20 exchanges
  if (db.communities[chatId].history.length > 40) {
    db.communities[chatId].history = db.communities[chatId].history.slice(-40);
  }
  saveData(db);
}

// ─── SYSTEM PROMPT BUILDER ────────────────────────────────────────────────
function buildSystemPrompt(chatId) {
  const community = db.communities[chatId] || {};
  const projectInfo = community.projectInfo || "No specific project info set yet.";
  const faqs = community.faqs
    ? community.faqs.map((f, i) => `Q${i + 1}: ${f.q}\nA${i + 1}: ${f.a}`).join("\n\n")
    : "No FAQs added yet.";
  const pinnedContext = community.pinnedContext || "";

  return `You are an elite AI community manager and Web3 expert named "HanonAI". 
You serve this Telegram community 24/7 with deep knowledge and a friendly but professional tone.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 PROJECT CONTEXT FOR THIS COMMUNITY:
${projectInfo}

📌 PINNED MESSAGE CONTEXT:
${pinnedContext || "Not yet extracted."}

📌 COMMUNITY FAQs:
${faqs}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOUR DEEP KNOWLEDGE AREAS:
1. BLOCKCHAIN: Consensus mechanisms (PoW, PoS, DPoS, PoH), Layer 1 & 2 chains, bridges, 
   validators, nodes, gas optimization, EVM, Solana, Cosmos, Polkadot, Avalanche, etc.

2. WEB3: Smart contracts (Solidity, Rust, Move), DeFi protocols (AMMs, lending, yield), 
   DAOs, governance, token economics, vesting, NFTs (ERC-721, ERC-1155), oracles, 
   wallets (custodial/non-custodial), seed phrases, private keys, MetaMask, WalletConnect.

3. CRYPTO: Trading (spot, futures, options), technical analysis, market cycles, 
   Bitcoin halving, altcoin seasons, stablecoins (USDT, USDC, DAI, algorithmic), 
   CEX vs DEX, order books, liquidity, slippage, impermanent loss, APY vs APR.

4. TECH: AI, machine learning, cybersecurity, APIs, databases, cloud, SaaS, protocols, 
   zero-knowledge proofs, MPC wallets, account abstraction, cross-chain interoperability.

5. COMMUNITY: You can explain roadmaps, tokenomics, partnerships, utility, staking 
   rewards, whitelist/allowlist processes, launchpad mechanics, IDO/ICO/IEO differences.

6. GENERAL: You can also answer general questions about how to buy/sell crypto, use wallets, 
   stay safe from scams, and best practices for engaging in Web3 communities.

7. FINANCIAL ADVICE: Never give financial advice. Always encourage users to DYOR (Do Your Own Research).
8. GENERAL KNOWLEDGE: You can also answer general questions about any topic.

YOUR BEHAVIOR RULES:
- Be concise but complete. Never be dismissive.
- When answering about the project, use the PROJECT CONTEXT above as your primary source.
- If you don't know something specific to the project, say so honestly and suggest asking an admin.
- Never give financial advice. Say "DYOR – Do Your Own Research" when needed.
- Be warm and welcoming to new members.
- If someone is rude or spammy, respond firmly but professionally.
- Use emojis sparingly and appropriately (this is a Web3 community, not a children's app).
- Keep answers under 300 words unless a complex technical question requires more.
- Respond in the same language the user writes in.`;
}

// ─── GROQ AI CALL ─────────────────────────────────────────────────────────
async function askGroq(chatId, userMessage) {
  const history = getHistory(chatId);
  const messages = [
    { role: "system", content: buildSystemPrompt(chatId) },
    ...history,
    { role: "user", content: userMessage },
  ];

  const response = await groq.chat.completions.create({
    model: MODEL,
    messages,
    max_tokens: 1024,
    temperature: 0.7,
  });

  const reply = response.choices[0].message.content;
  addToHistory(chatId, "user", userMessage);
  addToHistory(chatId, "assistant", reply);
  return reply;
}

// ─── SPAM DETECTION ───────────────────────────────────────────────────────
function isSpam(text) {
  return SPAM_PATTERNS.some((pattern) => pattern.test(text));
}

async function handleSpam(msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

  // Init warnings
  if (!db.warnings[chatId]) db.warnings[chatId] = {};
  if (!db.warnings[chatId][userId]) db.warnings[chatId][userId] = 0;
  db.warnings[chatId][userId]++;
  saveData(db);

  const count = db.warnings[chatId][userId];

  try {
    // Delete the spam message
    await bot.deleteMessage(chatId, msg.message_id);

    if (count >= MAX_WARNINGS) {
      // Ban after 3 warnings
      await bot.banChatMember(chatId, userId);
      await bot.sendMessage(
        chatId,
        `🚫 *${username}* has been banned after ${MAX_WARNINGS} warnings for repeated spam.\nKeep this community safe and genuine! 🛡️`,
        { parse_mode: "Markdown" }
      );
      // Reset warnings after ban
      db.warnings[chatId][userId] = 0;
      saveData(db);
    } else {
      await bot.sendMessage(
        chatId,
        `⚠️ *${username}*, your message was removed for violating community rules.\n` +
        `Warning *${count}/${MAX_WARNINGS}*. Reaching ${MAX_WARNINGS} warnings results in a ban.\n` +
        `_Please read the community guidelines._`,
        { parse_mode: "Markdown" }
      );
    }
  } catch (err) {
    console.error("Spam handling error:", err.message);
  }
}

// ─── WELCOME NEW MEMBERS ──────────────────────────────────────────────────
bot.on("new_chat_members", async (msg) => {
  const chatId = msg.chat.id;
  const community = db.communities[chatId] || {};
  const projectName = community.projectName || msg.chat.title || "this community";

  for (const member of msg.new_chat_members) {
    if (member.is_bot) continue;
    const name = member.first_name;

    try {
      const welcomePrompt = `Write a warm, exciting welcome message for a new Telegram community member named "${name}" 
      who just joined the ${projectName} community. Keep it under 100 words. 
      Include a brief prompt to read pinned messages and not share private keys. Use 1-2 relevant emojis.`;

      const welcomeMsg = await askGroq(chatId, welcomePrompt);
      await bot.sendMessage(chatId, welcomeMsg, { parse_mode: "Markdown" });
    } catch (err) {
      // Fallback welcome
      await bot.sendMessage(
        chatId,
        `👋 Welcome to *${projectName}*, *${name}*!\n\nPlease read the pinned messages to get started. ` +
        `Our AI assistant is here 24/7 to answer your questions.\n\n🔐 _Never share your private keys or seed phrase with anyone._`,
        { parse_mode: "Markdown" }
      );
    }
  }
});

// ─── COMMANDS ─────────────────────────────────────────────────────────────

// /start — Introduction
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(
    chatId,
    `🤖 *HanonAI — AI Community Manager*\n\n` +
    `I'm your 24/7 Web3 & crypto expert, community moderator, and project assistant.\n\n` +
    `*Admin Commands:*\n` +
    `🔧 /setup — Configure this community\n` +
    `📌 /setproject — Set project info\n` +
    `❓ /addfaq — Add a FAQ\n` +
    `📢 /announce — Send an announcement\n` +
    `📋 /listfaqs — View all FAQs\n\n` +
    `*Everyone:*\n` +
    `💬 Just type any question — I'll answer!\n` +
    `🔍 /faq — Browse FAQs\n` +
    `📖 /about — About this project\n` +
    `⚠️ /warnings — Check your warning count\n\n` +
    `/info — Get project info (if set)\n` +
    `_ · Built for Web3 communities_`,
    { parse_mode: "Markdown" }
  );
});

// /setproject — Admin sets project info
bot.onText(/\/setproject (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!(await isAdmin(chatId, msg.from.id))) {
    return bot.sendMessage(chatId, "❌ Only admins can use this command.");
  }

  const projectInfo = match[1];
  if (!db.communities[chatId]) db.communities[chatId] = {};
  db.communities[chatId].projectInfo = projectInfo;
  db.communities[chatId].projectName = msg.chat.title || "Unknown";
  saveData(db);

  await bot.sendMessage(
    chatId,
    `✅ *Project info updated!*\n\nI now have context about this project and will use it to answer community questions accurately.\n\n_Tip: Also use /addfaq to add specific FAQs._`,
    { parse_mode: "Markdown" }
  );
});

// /setup — Interactive setup guide
bot.onText(/\/setup/, async (msg) => {
  const chatId = msg.chat.id;
  if (!(await isAdmin(chatId, msg.from.id))) {
    return bot.sendMessage(chatId, "❌ Only admins can use /setup.");
  }

  await bot.sendMessage(
    chatId,
    `⚙️ *HanonAI Setup Guide*\n\n` +
    `Follow these steps to fully configure me for your community:\n\n` +
    `*Step 1 — Set Project Info:*\n` +
    `\`/setproject [your full project description]\`\n` +
    `_Include: name, what it does, chain, token ticker, website, socials_\n\n` +
    `*Step 2 — Add FAQs:*\n` +
    `\`/addfaq Q: [question] | A: [answer]\`\n` +
    `_Repeat for each FAQ_\n\n` +
    `*Step 3 — I auto-learn from pinned messages!*\n` +
    `Just pin important messages — I scan them automatically.\n\n` +
    `*Step 4 — Make me admin*\n` +
    `Give me: Delete messages, Ban users, Pin messages permissions.\n\n` +
    `That's it! I'll handle the rest 24/7 🚀`,
    { parse_mode: "Markdown" }
  );
});

// /addfaq — Admin adds a FAQ
bot.onText(/\/addfaq (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!(await isAdmin(chatId, msg.from.id))) {
    return bot.sendMessage(chatId, "❌ Only admins can add FAQs.");
  }

  const input = match[1];
  const parts = input.split("|");
  if (parts.length < 2) {
    return bot.sendMessage(chatId, `❌ Format: /addfaq Q: your question | A: your answer`);
  }

  const q = parts[0].replace(/^Q:\s*/i, "").trim();
  const a = parts[1].replace(/^A:\s*/i, "").trim();

  if (!db.communities[chatId]) db.communities[chatId] = {};
  if (!db.communities[chatId].faqs) db.communities[chatId].faqs = [];
  db.communities[chatId].faqs.push({ q, a });
  saveData(db);

  await bot.sendMessage(chatId, `✅ FAQ added!\n\n*Q:* ${q}\n*A:* ${a}`, { parse_mode: "Markdown" });
});

// /listfaqs — List all FAQs
bot.onText(/\/listfaqs/, async (msg) => {
  const chatId = msg.chat.id;
  const faqs = db.communities[chatId]?.faqs || [];

  if (faqs.length === 0) {
    return bot.sendMessage(chatId, "No FAQs set yet. Admins can use /addfaq to add some.");
  }

  const text = faqs.map((f, i) => `*${i + 1}. ${f.q}*\n${f.a}`).join("\n\n");
  await bot.sendMessage(chatId, `📋 *Community FAQs*\n\n${text}`, { parse_mode: "Markdown" });
});

// /faq — Same as listfaqs (public alias)
bot.onText(/\/faq/, async (msg) => {
  const chatId = msg.chat.id;
  const faqs = db.communities[chatId]?.faqs || [];
  if (faqs.length === 0) {
    return bot.sendMessage(chatId, "No FAQs available yet. Check back soon!");
  }
  const text = faqs.map((f, i) => `*${i + 1}. ${f.q}*\n${f.a}`).join("\n\n");
  await bot.sendMessage(chatId, `📋 *Frequently Asked Questions*\n\n${text}`, { parse_mode: "Markdown" });
});

// /about — Info about the project
bot.onText(/\/about/, async (msg) => {
  const chatId = msg.chat.id;
  const projectInfo = db.communities[chatId]?.projectInfo;
  if (!projectInfo) {
    return bot.sendMessage(chatId, "No project info set yet. Admins can use /setproject to configure this.");
  }
  const reply = await askGroq(chatId, `Give a clear, engaging summary of this project based on what you know: ${projectInfo}. Keep it under 200 words.`);
  await bot.sendMessage(chatId, `📖 *About This Project*\n\n${reply}`, { parse_mode: "Markdown" });
});

// /announce — Admin sends announcement
bot.onText(/\/announce (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!(await isAdmin(chatId, msg.from.id))) {
    return bot.sendMessage(chatId, "❌ Only admins can make announcements.");
  }

  const rawText = match[1];

  // Use AI to format the announcement nicely
  const formatted = await askGroq(
    chatId,
    `Format this announcement professionally for a Web3 Telegram community. 
    Keep the original meaning, add relevant emojis, make it clean and readable. 
    Announcement: "${rawText}"`
  );

  await bot.sendMessage(chatId, `📢 *ANNOUNCEMENT*\n\n${formatted}`, { parse_mode: "Markdown" });
});

// /warn — Admin manually warns a user (reply to their message)
bot.onText(/\/warn/, async (msg) => {
  const chatId = msg.chat.id;
  if (!(await isAdmin(chatId, msg.from.id))) return;
  if (!msg.reply_to_message) {
    return bot.sendMessage(chatId, "Reply to a message to warn the user.");
  }

  const target = msg.reply_to_message.from;
  const userId = target.id;
  const username = target.username ? `@${target.username}` : target.first_name;

  if (!db.warnings[chatId]) db.warnings[chatId] = {};
  if (!db.warnings[chatId][userId]) db.warnings[chatId][userId] = 0;
  db.warnings[chatId][userId]++;
  saveData(db);

  const count = db.warnings[chatId][userId];
  await bot.sendMessage(
    chatId,
    `⚠️ *${username}* has been warned by an admin.\nWarnings: *${count}/${MAX_WARNINGS}*`,
    { parse_mode: "Markdown" }
  );

  if (count >= MAX_WARNINGS) {
    await bot.banChatMember(chatId, userId);
    await bot.sendMessage(chatId, `🚫 *${username}* has been banned after ${MAX_WARNINGS} warnings.`, { parse_mode: "Markdown" });
  }
});

// /ban — Admin bans a user (reply to their message)
bot.onText(/\/ban/, async (msg) => {
  const chatId = msg.chat.id;
  if (!(await isAdmin(chatId, msg.from.id))) return;
  if (!msg.reply_to_message) return bot.sendMessage(chatId, "Reply to a message to ban the user.");

  const target = msg.reply_to_message.from;
  try {
    await bot.banChatMember(chatId, target.id);
    const username = target.username ? `@${target.username}` : target.first_name;
    await bot.sendMessage(chatId, `🚫 *${username}* has been banned.`, { parse_mode: "Markdown" });
  } catch (e) {
    await bot.sendMessage(chatId, "❌ Could not ban this user. Make sure I have Ban permissions.");
  }
});

// /unban — Admin unbans
bot.onText(/\/unban (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!(await isAdmin(chatId, msg.from.id))) return;
  const userId = parseInt(match[1]);
  try {
    await bot.unbanChatMember(chatId, userId);
    await bot.sendMessage(chatId, `✅ User ${userId} has been unbanned.`);
  } catch (e) {
    await bot.sendMessage(chatId, "❌ Could not unban this user.");
  }
});

// /warnings — Check your own warning count
bot.onText(/\/warnings/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const count = db.warnings?.[chatId]?.[userId] || 0;
  await bot.sendMessage(
    chatId,
    `Your current warnings: *${count}/${MAX_WARNINGS}*`,
    { parse_mode: "Markdown", reply_to_message_id: msg.message_id }
  );
});

// /clearwarnings — Admin clears warnings for a user
bot.onText(/\/clearwarnings/, async (msg) => {
  const chatId = msg.chat.id;
  if (!(await isAdmin(chatId, msg.from.id))) return;
  if (!msg.reply_to_message) return bot.sendMessage(chatId, "Reply to a message to clear that user's warnings.");
  const userId = msg.reply_to_message.from.id;
  if (db.warnings?.[chatId]) db.warnings[chatId][userId] = 0;
  saveData(db);
  await bot.sendMessage(chatId, `✅ Warnings cleared for ${msg.reply_to_message.from.first_name}.`);
});

// /stats — Community stats
bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const count = await bot.getChatMemberCount(chatId);
    const community = db.communities[chatId] || {};
    const faqCount = community.faqs?.length || 0;
    const totalWarnings = Object.values(db.warnings?.[chatId] || {}).reduce((a, b) => a + b, 0);
    await bot.sendMessage(
      chatId,
      `📊 *Community Stats*\n\n` +
      `👥 Members: *${count}*\n` +
      `❓ FAQs: *${faqCount}*\n` +
      `⚠️ Total Warnings Issued: *${totalWarnings}*\n` +
      `🤖 Bot Status: *Online 24/7*`,
      { parse_mode: "Markdown" }
    );
  } catch (e) {
    await bot.sendMessage(chatId, "Could not fetch stats right now.");
  }
});

// ─── PINNED MESSAGE SCANNER ───────────────────────────────────────────────
bot.on("pinned_message", async (msg) => {
  const chatId = msg.chat.id;
  const pinnedText = msg.pinned_message?.text || msg.pinned_message?.caption || "";
  if (!pinnedText) return;

  if (!db.communities[chatId]) db.communities[chatId] = {};
  // Accumulate pinned context
  const existing = db.communities[chatId].pinnedContext || "";
  db.communities[chatId].pinnedContext = (existing + "\n\n" + pinnedText).trim().slice(0, 3000);
  saveData(db);

  console.log(`📌 [${chatId}] Pinned message context updated.`);
});

// ─── MAIN MESSAGE HANDLER ─────────────────────────────────────────────────
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || msg.caption || "";
  if (!text || msg.from?.is_bot) return;

  // Skip command messages (already handled above)
  if (text.startsWith("/")) return;

  // ── Spam Check ──
  if (isSpam(text)) {
    return handleSpam(msg);
  }

  // ── In groups: only respond if mentioned or replied to ──
  const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";
  const botInfo = await bot.getMe();
  const mentioned = text.includes(`@${botInfo.username}`);
  const repliedToBot = msg.reply_to_message?.from?.username === botInfo.username;
  const isPrivate = msg.chat.type === "private";

  if (isGroup && !mentioned && !repliedToBot) return;

  // Clean mention from text
  const cleanText = text.replace(`@${botInfo.username}`, "").trim();
  if (!cleanText) return;

  try {
    // Typing indicator
    await bot.sendChatAction(chatId, "typing");

    const reply = await askGroq(chatId, cleanText);

    await bot.sendMessage(chatId, reply, {
      parse_mode: "Markdown",
      reply_to_message_id: msg.message_id,
      disable_web_page_preview: true,
    });
  } catch (err) {
    console.error("AI response error:", err.message);
    await bot.sendMessage(
      chatId,
      "⚡ I'm processing too many requests right now. Please try again in a moment!",
      { reply_to_message_id: msg.message_id }
    );
  }
});

// ─── ADMIN CHECK HELPER ───────────────────────────────────────────────────
async function isAdmin(chatId, userId) {
  try {
    const member = await bot.getChatMember(chatId, userId);
    return ["administrator", "creator"].includes(member.status);
  } catch {
    return false;
  }
}

// ─── DAILY ENGAGEMENT CRON (optional) ────────────────────────────────────
// Uncomment to send a daily Web3 insight to all communities at 9am UTC

cron.schedule("0 9 * * *", async () => {
  for (const chatId of Object.keys(db.communities)) {
    try {
      const insight = await askGroq(
        chatId,
        "Generate a brief, insightful Web3 or crypto fact/tip for today. Keep it under 100 words. Make it educational and community-appropriate."
      );
      await bot.sendMessage(chatId, `🌅 *Daily Web3 Insight*\n\n${insight}`, { parse_mode: "Markdown" });
    } catch (e) {
      console.error(`Cron error for ${chatId}:`, e.message);
    }
  }
});


// ─── ERROR HANDLING ───────────────────────────────────────────────────────
bot.on("polling_error", (err) => console.error("Polling error:", err.message));
process.on("unhandledRejection", (err) => console.error("Unhandled:", err));

console.log(`
╔══════════════════════════════════════╗
║   HANON AI is LIVE 🚀               ║
║   Web3 AI Community Manager          ║
║   Powered by Groq (${MODEL})  ║
╚══════════════════════════════════════╝
`);