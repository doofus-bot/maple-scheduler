import "dotenv/config";
import express from "express";
import session from "express-session";
import compression from "compression";
import Database from "better-sqlite3";
import fetch from "node-fetch";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import crypto from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

/* ════════════════════════════════════════
   DATABASE
   ════════════════════════════════════════ */
const dbPath = process.env.NODE_ENV === "production"
  ? "/data/data.db"
  : join(__dirname, "..", "data.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    avatar TEXT,
    timezone TEXT DEFAULT 'America/New_York',
    characters TEXT DEFAULT '[]',
    availability TEXT DEFAULT '{}',
    settings TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS parties_store (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT DEFAULT '{}'
  );

  INSERT OR IGNORE INTO parties_store (id, data) VALUES (1, '{}');
`);

// Migration — add settings column if missing
try { db.prepare("ALTER TABLE users ADD COLUMN settings TEXT DEFAULT '{}'").run(); } catch {}
// Migration — add share_token column
try { db.prepare("ALTER TABLE users ADD COLUMN share_token TEXT").run(); } catch {}

/* ════════════════════════════════════════
   MIDDLEWARE
   ════════════════════════════════════════ */
app.use(compression());
app.use(express.json({ limit: "5mb" }));

// SQLite session store — survives redeploys
const sessionDb = new Database(process.env.NODE_ENV === "production" ? "/data/sessions.db" : join(__dirname, "..", "sessions.db"));
sessionDb.pragma("journal_mode = WAL");
sessionDb.exec(`CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY, data TEXT, expires INTEGER)`);
sessionDb.exec(`CREATE INDEX IF NOT EXISTS idx_expires ON sessions(expires)`);

// Clean expired sessions every 15 min
setInterval(() => { try { sessionDb.prepare("DELETE FROM sessions WHERE expires < ?").run(Date.now()); } catch {} }, 15 * 60 * 1000);

class SQLiteStore extends session.Store {
  get(sid, cb) {
    try {
      const row = sessionDb.prepare("SELECT data, expires FROM sessions WHERE sid = ?").get(sid);
      if (!row || row.expires < Date.now()) { return cb(null, null); }
      cb(null, JSON.parse(row.data));
    } catch (e) { cb(e); }
  }
  set(sid, sess, cb) {
    try {
      const maxAge = sess.cookie?.maxAge || 30 * 24 * 60 * 60 * 1000;
      const expires = Date.now() + maxAge;
      sessionDb.prepare("INSERT OR REPLACE INTO sessions (sid, data, expires) VALUES (?, ?, ?)").run(sid, JSON.stringify(sess), expires);
      cb?.(null);
    } catch (e) { cb?.(e); }
  }
  destroy(sid, cb) {
    try { sessionDb.prepare("DELETE FROM sessions WHERE sid = ?").run(sid); cb?.(null); } catch (e) { cb?.(e); }
  }
}

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(session({
  store: new SQLiteStore(),
  secret: process.env.SESSION_SECRET || "change-me",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: "lax",
  },
}));

/* ════════════════════════════════════════
   DISCORD OAUTH
   ════════════════════════════════════════ */
const DISCORD_API = "https://discord.com/api/v10";
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

app.get("/auth/discord", (req, res) => {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "identify",
  });
  res.redirect(`${DISCORD_API}/oauth2/authorize?${params}`);
});

app.get("/auth/discord/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect("/?error=no_code");
  try {
    const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
        grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("No access token");

    const userRes = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const d = await userRes.json();
    const avatarUrl = d.avatar ? `https://cdn.discordapp.com/avatars/${d.id}/${d.avatar}.png` : null;

    const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(d.id);
    if (!existing) {
      db.prepare("INSERT INTO users (id, username, avatar) VALUES (?, ?, ?)").run(d.id, d.username, avatarUrl);
    } else {
      db.prepare("UPDATE users SET username = ?, avatar = ? WHERE id = ?").run(d.username, avatarUrl, d.id);
    }
    req.session.userId = d.id;

    // Migrate party members: if someone was added by Discord username, link to their real ID
    try {
      const row = db.prepare("SELECT data FROM parties_store WHERE id = 1").get();
      if (row?.data) {
        const parties = JSON.parse(row.data);
        let changed = false;
        for (const pid of Object.keys(parties)) {
          const p = parties[pid];
          if (p.members) {
            p.members = p.members.map(m => {
              if (m.userId !== d.id && m.userId?.toLowerCase() === d.username?.toLowerCase()) {
                changed = true;
                return { ...m, userId: d.id };
              }
              return m;
            });
            if (p.leaderId !== d.id && p.leaderId?.toLowerCase() === d.username?.toLowerCase()) { p.leaderId = d.id; changed = true; }
          }
        }
        if (changed) db.prepare("UPDATE parties_store SET data = ? WHERE id = 1").run(JSON.stringify(parties));
      }
    } catch (migErr) { console.error("Member migration error:", migErr); }

    res.redirect("/");
  } catch (err) {
    console.error("OAuth error:", err);
    res.redirect("/?error=auth_failed");
  }
});

app.get("/auth/logout", (req, res) => { req.session.destroy(() => res.redirect("/")); });
app.post("/auth/logout", (req, res) => { req.session.destroy(() => res.json({ ok: true })); });

/* ════════════════════════════════════════
   AUTH MIDDLEWARE
   ════════════════════════════════════════ */
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Not authenticated" });
  req.user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.userId);
  if (!req.user) return res.status(401).json({ error: "User not found" });
  next();
}

/* ════════════════════════════════════════
   API: USERS
   ════════════════════════════════════════ */
app.get("/api/me", requireAuth, (req, res) => {
  const u = req.user;
  const settings = JSON.parse(u.settings || "{}");
  res.json({ id: u.id, username: u.username, avatar: u.avatar, timezone: u.timezone, shareToken: u.share_token || null,
    characters: JSON.parse(u.characters || "[]"), availability: JSON.parse(u.availability || "{}"), ...settings });
});

app.patch("/api/me", requireAuth, (req, res) => {
  const { timezone, characters, availability, showSolos, notifications } = req.body;
  if (timezone) db.prepare("UPDATE users SET timezone = ? WHERE id = ?").run(timezone, req.user.id);
  if (characters !== undefined) db.prepare("UPDATE users SET characters = ? WHERE id = ?").run(JSON.stringify(characters), req.user.id);
  if (availability !== undefined) db.prepare("UPDATE users SET availability = ? WHERE id = ?").run(JSON.stringify(availability), req.user.id);
  const cur = JSON.parse(db.prepare("SELECT settings FROM users WHERE id = ?").get(req.user.id)?.settings || "{}");
  if (showSolos !== undefined) cur.showSolos = showSolos;
  if (notifications !== undefined) cur.notifications = notifications;
  db.prepare("UPDATE users SET settings = ? WHERE id = ?").run(JSON.stringify(cur), req.user.id);
  const u = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  const settings = JSON.parse(u.settings || "{}");
  res.json({ id: u.id, username: u.username, avatar: u.avatar, timezone: u.timezone, shareToken: u.share_token || null,
    characters: JSON.parse(u.characters || "[]"), availability: JSON.parse(u.availability || "{}"), ...settings });
});

app.get("/api/users", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT id, username, avatar, timezone, characters, availability FROM users").all();
  res.json(rows.map(u => ({ ...u, characters: JSON.parse(u.characters || "[]"), availability: JSON.parse(u.availability || "{}") })));
});

/* ════════════════════════════════════════
   API: PARTIES (single JSON blob)
   ════════════════════════════════════════ */
app.get("/api/parties", requireAuth, (req, res) => {
  const row = db.prepare("SELECT data FROM parties_store WHERE id = 1").get();
  res.json(JSON.parse(row?.data || "{}"));
});

app.put("/api/parties", requireAuth, (req, res) => {
  db.prepare("UPDATE parties_store SET data = ? WHERE id = 1").run(JSON.stringify(req.body));
  res.json({ ok: true });
});

/* ════════════════════════════════════════
   API: SHARE LINK
   ════════════════════════════════════════ */
// Generate or get share token
app.post("/api/me/share", requireAuth, (req, res) => {
  try {
    let user = db.prepare("SELECT share_token FROM users WHERE id = ?").get(req.user.id);
    if (!user.share_token) {
      const token = crypto.randomBytes(8).toString("hex");
      db.prepare("UPDATE users SET share_token = ? WHERE id = ?").run(token, req.user.id);
      user = { share_token: token };
    }
    res.json({ token: user.share_token });
  } catch (err) { console.error("Share error:", err); res.status(500).json({ error: err.message }); }
});

// Regenerate share token
app.post("/api/me/share/regenerate", requireAuth, (req, res) => {
  try {
    const token = crypto.randomBytes(8).toString("hex");
    db.prepare("UPDATE users SET share_token = ? WHERE id = ?").run(token, req.user.id);
    res.json({ token });
  } catch (err) { console.error("Regenerate error:", err); res.status(500).json({ error: err.message }); }
});

// Public share endpoint — no auth required
app.get("/api/share/:token", (req, res) => {
  const user = db.prepare("SELECT id, username, avatar, timezone, characters, availability, share_token FROM users WHERE share_token = ?").get(req.params.token);
  if (!user) return res.status(404).json({ error: "Not found" });
  // Get parties where this user is a member
  const row = db.prepare("SELECT data FROM parties_store WHERE id = 1").get();
  const allParties = JSON.parse(row?.data || "{}");
  const myParties = {};
  for (const [id, p] of Object.entries(allParties)) {
    if (p.members?.some(m => m.userId === user.id || m.userId === user.username)) {
      myParties[id] = p;
    }
  }
  // Get all users for member resolution (limited fields)
  const allUsers = db.prepare("SELECT id, username, avatar, timezone, characters, availability FROM users").all()
    .map(u => ({ id: u.id, username: u.username, avatar: u.avatar, timezone: u.timezone, characters: JSON.parse(u.characters || "[]"), availability: JSON.parse(u.availability || "{}") }));
  res.json({
    owner: { username: user.username, avatar: user.avatar, timezone: user.timezone, characters: JSON.parse(user.characters || "[]") },
    parties: myParties,
    users: allUsers,
  });
});

/* ════════════════════════════════════════
   API: NEXON CHARACTER LOOKUP
   ════════════════════════════════════════ */
app.get("/api/nexon/:name", async (req, res) => {
  const name = req.params.name;
  try {
    for (const idx of [1, 0]) {
      const url = `https://www.nexon.com/api/maplestory/no-auth/ranking/v2/na?type=overall&id=legendary&reboot_index=${idx}&character_name=${encodeURIComponent(name)}`;
      const r = await fetch(url);
      const data = await r.json();
      if (data.ranks?.length > 0) {
        const match = data.ranks.find(r => r.characterName.toLowerCase() === name.toLowerCase());
        if (match) return res.json({ imgUrl: match.characterImgURL, jobName: match.jobName, level: match.characterLevel || match.level, characterName: match.characterName });
      }
    }
    res.json({ imgUrl: null, jobName: null, level: null, characterName: name });
  } catch (err) {
    console.error("Nexon API error:", err);
    res.json({ imgUrl: null, jobName: null, level: null, characterName: name });
  }
});

/* ════════════════════════════════════════
   TEST NOTIFICATION ENDPOINT
   ════════════════════════════════════════ */
app.post("/api/me/test-notification", requireAuth, async (req, res) => {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return res.status(500).json({ error: "DISCORD_BOT_TOKEN not set" });
  try {
    const msg = `🧪 **Test notification from Maple Scheduler!**\n\nIf you see this, DM notifications are working for your account.\n\nBot token present: ✅\nYour Discord ID: ${req.user.id}`;
    // Open DM channel
    const chRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ recipient_id: req.user.id }),
    });
    const chBody = await chRes.text();
    if (!chRes.ok) return res.json({ success: false, step: "open_dm", status: chRes.status, body: chBody });
    const ch = JSON.parse(chBody);
    // Send message
    const msgRes = await fetch(`https://discord.com/api/v10/channels/${ch.id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content: msg }),
    });
    const msgBody = await msgRes.text();
    if (!msgRes.ok) return res.json({ success: false, step: "send_msg", status: msgRes.status, body: msgBody });
    res.json({ success: true });
  } catch (err) { res.json({ success: false, step: "exception", error: err.message }); }
});

/* ════════════════════════════════════════
   DAILY SUMMARY BUILDER
   ════════════════════════════════════════ */
const DIFF_ABBR_SERVER = { Easy: "E", Normal: "N", Hard: "H", Chaos: "C", Extreme: "X" };

function buildDailySummary(userId, username, userTZ) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return null;

  const now = new Date();
  const nowUTC = now.getUTCDay();
  const nowDay = (nowUTC + 6) % 7;
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();

  // Load parties
  const row = db.prepare("SELECT data FROM parties_store WHERE id = 1").get();
  const parties = JSON.parse(row?.data || "{}");
  const users = db.prepare("SELECT id, username, timezone FROM users").all();

  // Find all bosses this user is in within the next 24 hours
  const upcoming = [];

  for (const [pid, party] of Object.entries(parties)) {
    if (party.skipped || party.utcDay == null) continue;
    const isMember = party.members?.some(m => m.userId === userId || m.userId === username);
    if (!isMember) continue;

    // Convert stored local time to UTC using leader's TZ
    const leaderId = party.leaderId;
    const leaderUser = users.find(u => u.id === leaderId);
    const leaderTZ = leaderUser?.timezone || "America/New_York";
    const refDate = new Date();
    const localStr = refDate.toLocaleString("en-US", { timeZone: leaderTZ });
    const localDate = new Date(localStr);
    const tzOffsetMs = refDate.getTime() - localDate.getTime();
    const tzOffsetMins = Math.round(tzOffsetMs / 60000);

    let bossUTCMin = (party.utcHour * 60 + party.utcMin) + tzOffsetMins;
    let bossDay = party.utcDay;
    while (bossUTCMin >= 24 * 60) { bossUTCMin -= 24 * 60; bossDay = (bossDay + 1) % 7; }
    while (bossUTCMin < 0) { bossUTCMin += 24 * 60; bossDay = (bossDay - 1 + 7) % 7; }

    // Calculate minutes from now to this boss
    let minsUntil = (bossDay - nowDay) * 24 * 60 + (bossUTCMin - nowMin);
    if (minsUntil < 0) minsUntil += 7 * 24 * 60;
    if (minsUntil > 24 * 60) continue; // skip if > 24 hours away

    // Build unix timestamp
    const bossDate = new Date(now);
    const daysUntil = ((bossDay - nowDay) % 7 + 7) % 7;
    bossDate.setUTCDate(bossDate.getUTCDate() + (daysUntil === 0 && nowMin > bossUTCMin + 2 ? 7 : daysUntil));
    bossDate.setUTCHours(Math.floor(bossUTCMin / 60), bossUTCMin % 60, 0, 0);
    const startUnix = Math.floor(bossDate.getTime() / 1000);

    // Reset relation
    const minsFromReset = party.utcHour * 60 + party.utcMin;
    const minsToReset = 24 * 60 - minsFromReset;
    const useNeg = minsToReset <= 8 * 60 && minsFromReset > 0;
    const absMins = useNeg ? minsToReset : minsFromReset;
    const rH = Math.floor(absMins / 60), rM = absMins % 60;
    const resetStr = "Reset " + (useNeg ? "-" : "+") + rH + (rM > 0 ? ":" + String(rM).padStart(2, "0") : "");

    const bossName = party.bosses?.[0]?.bossName || "Boss";
    const diff = party.bosses?.[0]?.difficulty || "";
    const charName = party.members?.find(m => m.userId === userId || m.userId === username)?.charName || "—";

    upcoming.push({ startUnix, minsUntil, bossName, diff, charName, resetStr, pid });
  }

  if (upcoming.length === 0) return null;

  // Sort chronologically
  upcoming.sort((a, b) => a.startUnix - b.startUnix);

  // Greeting based on user's local time
  const userNow = new Date(now.toLocaleString("en-US", { timeZone: userTZ || "America/New_York" }));
  const userHour = userNow.getHours();
  const greeting = userHour < 12 ? "Morning" : userHour < 17 ? "Afternoon" : "Evening";

  // Build embed
  const lines = upcoming.map(b => {
    const da = DIFF_ABBR_SERVER[b.diff] || "";
    return `<t:${b.startUnix}:t> <t:${b.startUnix}:R> · ${b.resetStr} · **${b.charName}** · **${da} ${b.bossName}**`;
  });

  const embed = {
    title: `Good ${greeting}, ${username}`,
    description: `You have **${upcoming.length}** boss${upcoming.length !== 1 ? "es" : ""} in the next 24 hours.\n\n${lines.join("\n")}`,
    color: 0x2563eb,
    footer: { text: "Maple Scheduler · Daily Reminder" },
  };

  return { embeds: [embed] };
}

app.post("/api/me/test-daily", requireAuth, async (req, res) => {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return res.status(500).json({ error: "DISCORD_BOT_TOKEN not set" });
  try {
    const u = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    const userTZ = u?.timezone || "America/New_York";
    const payload = buildDailySummary(req.user.id, u?.username, userTZ);
    if (!payload) return res.json({ success: false, noBosses: true });
    await sendDiscordDM(req.user.id, payload, 24 * 60 * 60 * 1000);
    res.json({ success: true });
  } catch (err) { res.json({ success: false, step: "exception", error: err.message }); }
});

/* ════════════════════════════════════════
   SERVE FRONTEND
   ════════════════════════════════════════ */
// Always serve public/ for logo.png etc
app.use(express.static(join(__dirname, "..", "public")));

if (process.env.NODE_ENV === "production") {
  const distPath = join(__dirname, "..", "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => res.sendFile(join(distPath, "index.html")));
}

/* ════════════════════════════════════════
   DM NOTIFICATION SCHEDULER
   ════════════════════════════════════════ */
// Table to track sent notifications (avoid duplicates)
db.exec(`
  CREATE TABLE IF NOT EXISTS notifications_sent (
    id TEXT PRIMARY KEY,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
// Clean old entries (>24 hours — weekly bosses get fresh notifications each week)
try { db.prepare("DELETE FROM notifications_sent WHERE sent_at < datetime('now', '-24 hours')").run(); } catch {}

const NOTIFY_INTERVALS = [60, 30, 15, 10, 5, 0]; // minutes before boss time

async function sendDiscordDM(userId, payload, deleteAfterMs = 30 * 60 * 1000) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return;
  const body = typeof payload === "string" ? { content: payload } : payload;
  try {
    // Open DM channel
    const chRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ recipient_id: userId }),
    });
    if (!chRes.ok) { console.error(`DM channel failed for ${userId}:`, chRes.status); return; }
    const ch = await chRes.json();
    // Send message
    const msgRes = await fetch(`https://discord.com/api/v10/channels/${ch.id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!msgRes.ok) { console.error(`DM send failed for ${userId}:`, msgRes.status); return; }
    const msgData = await msgRes.json();
    // Auto-delete after 30 minutes
    if (msgData.id) {
      setTimeout(async () => {
        try {
          await fetch(`https://discord.com/api/v10/channels/${ch.id}/messages/${msgData.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bot ${token}` },
          });
        } catch {}
      }, deleteAfterMs);
    }
  } catch (err) { console.error(`DM error for ${userId}:`, err.message); }
}

function runNotificationCheck() {
  if (!process.env.DISCORD_BOT_TOKEN) return;
  try {
    const now = new Date();
    const nowUTC = now.getUTCDay(); // 0=Sun
    const nowDay = (nowUTC + 6) % 7; // convert to 0=Mon..6=Sun
    const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();

    // Load parties
    const row = db.prepare("SELECT data FROM parties_store WHERE id = 1").get();
    const parties = JSON.parse(row?.data || "{}");

    // Load all users with notification prefs
    const users = db.prepare("SELECT id, username, settings, timezone FROM users").all();
    const userMap = {};
    const usernameMap = {};
    users.forEach(u => {
      const s = JSON.parse(u.settings || "{}");
      if (s.notifications?.enabled) {
        userMap[u.id] = { ...u, notifs: s.notifications };
        if (u.username) usernameMap[u.username.toLowerCase()] = userMap[u.id];
      }
    });

    // Get the local timezone offset so we can convert stored local times to UTC
    // Party times are stored as local hours/mins (named utcHour/utcMin but actually local)
    const offsetMin = new Date().getTimezoneOffset(); // minutes to add to local to get UTC
    // On Railway (UTC server), offsetMin = 0, so we need the user's/site's offset instead
    // Since all parties are created from the same UI using the browser's local time,
    // we figure out the offset from the current UTC time vs what a PT user would see
    // Actually: the frontend stores times relative to the user's LOCAL clock.
    // The simplest fix: for each party, figure out who created it and use their timezone.
    // But since all users share parties, we use the site-wide convention:
    // The schedule grid uses the BROWSER's local timezone, so party times = browser local.
    // The party creator's timezone is stored on their user record.
    // For now, use the party leader's timezone to convert.

    const siteUrl = process.env.SITE_URL || "https://maplescheduler.com";

    for (const [pid, party] of Object.entries(parties)) {
      if (party.skipped || party.utcDay == null) continue;

      // Convert stored local time to actual UTC
      // Find leader's timezone (or fall back to first member's, or America/New_York)
      const leaderId = party.leaderId;
      const leaderUser = users.find(u => u.id === leaderId);
      const leaderTZ = leaderUser?.timezone || "America/New_York";

      // Calculate the offset: create a date in the leader's timezone and compare to UTC
      const refDate = new Date();
      const localStr = refDate.toLocaleString("en-US", { timeZone: leaderTZ });
      const localDate = new Date(localStr);
      const tzOffsetMs = refDate.getTime() - localDate.getTime();
      const tzOffsetMins = Math.round(tzOffsetMs / 60000);

      // Stored time is local, convert to UTC by adding the offset
      let bossUTCMin = (party.utcHour * 60 + party.utcMin) + tzOffsetMins;
      let bossDay = party.utcDay;
      while (bossUTCMin >= 24 * 60) { bossUTCMin -= 24 * 60; bossDay = (bossDay + 1) % 7; }
      while (bossUTCMin < 0) { bossUTCMin += 24 * 60; bossDay = (bossDay - 1 + 7) % 7; }

      const bossName = party.bosses?.[0]?.bossName || "Boss";
      const diff = party.bosses?.[0]?.difficulty || "";
      const duration = party.duration || 30;
      const isSolo = (party.members?.length || 0) <= 1;

      for (const member of (party.members || [])) {
        const userId = member.userId;
        const userPref = userMap[userId] || usernameMap[userId?.toLowerCase()];
        if (!userPref?.notifs?.enabled) continue;
        const realDiscordId = userPref.id; // always use actual Discord ID for DMs

        // Skip solos unless user opted in
        if (isSolo && !userPref.notifs.solos) continue;

        // For solos, only notify at start time (0 min before)
        const timings = isSolo ? [0] : (userPref.notifs.timings || []);

        for (const minsBefore of timings) {

          // Calculate when this notification should fire (in UTC)
          let notifyMin = bossUTCMin - minsBefore;
          let notifyDay = bossDay;
          if (notifyMin < 0) { notifyMin += 24 * 60; notifyDay = (notifyDay - 1 + 7) % 7; }
          if (notifyMin >= 24 * 60) { notifyMin -= 24 * 60; notifyDay = (notifyDay + 1) % 7; }

          // Is it time? (within 1 minute window)
          if (notifyDay === nowDay && Math.abs(nowMin - notifyMin) <= 1) {
            const sentKey = `${pid}_${realDiscordId}_${minsBefore}_${bossDay}_${bossUTCMin}`;
            const already = db.prepare("SELECT id FROM notifications_sent WHERE id = ?").get(sentKey);
            if (already) continue;

            // Calculate Unix timestamp for the boss start
            const bossDate = new Date(now);
            const daysUntil = ((bossDay - nowDay) % 7 + 7) % 7;
            bossDate.setUTCDate(bossDate.getUTCDate() + (daysUntil === 0 && nowMin > bossUTCMin + 2 ? 7 : daysUntil));
            bossDate.setUTCHours(Math.floor(bossUTCMin / 60), bossUTCMin % 60, 0, 0);
            const startUnix = Math.floor(bossDate.getTime() / 1000);
            const endUnix = startUnix + duration * 60;

            // Reset relation (use original stored time for display)
            const minsFromReset = party.utcHour * 60 + party.utcMin;
            const minsToReset = 24 * 60 - minsFromReset;
            const useNeg = minsToReset <= 8 * 60 && minsFromReset > 0;
            const absMins = useNeg ? minsToReset : minsFromReset;
            const rH = Math.floor(absMins / 60), rM = absMins % 60;
            const resetStr = "Reset " + (useNeg ? "-" : "+") + rH + (rM > 0 ? ":" + String(rM).padStart(2, "0") : "");

            // Party members list
            const partySize = party.members?.length || 1;
            const memberNames = party.members?.map(m => m.charName).filter(Boolean).join(", ") || "—";

            // Boss GIFs
            const BOSS_GIFS = {
              "Lotus": "https://media.discordapp.net/attachments/1447721739030364251/1447722529899941930/Lotus.gif",
              "Black Mage": "https://media.discordapp.net/attachments/1447721739030364251/1447722830358909168/BlackMage2.gif",
              "Seren": "https://media.discordapp.net/attachments/1447721739030364251/1447722852806688869/Seren2.gif",
              "Kalos": "https://media.discordapp.net/attachments/1447721739030364251/1447722948445339799/Kalos2.gif",
              "Kaling": "https://media.discordapp.net/attachments/1447721739030364251/1447722960696770571/Kaling2.gif",
              "Limbo": "https://media.discordapp.net/attachments/1447721739030364251/1447722991575371910/Limbo2.gif",
              "Baldrix": "https://media.discordapp.net/attachments/1447721739030364251/1447723005768896703/Baldrix2.gif",
              "Adversary": "https://media.discordapp.net/attachments/1447721739030364251/1447723017449898108/FirstAdversary2.gif",
            };

            // Difficulty colors for embed sidebar
            const EMBED_COLORS = { "Easy": 0x989898, "Normal": 0x49B8C6, "Hard": 0xCE506D, "Chaos": 0xDCBA87, "Extreme": 0xED7421 };

            // Build embed
            const partyLink = `${siteUrl}/party/${pid}`;
            const gif = BOSS_GIFS[bossName];
            const embedColor = EMBED_COLORS[diff] || 0x2563eb;

            let title;
            if (minsBefore === 0) {
              title = `${diff} ${bossName} — Starting NOW!`;
            } else {
              title = `${diff} ${bossName} — ${minsBefore}min`;
            }

            const timeField = `<t:${startUnix}:R> — <t:${startUnix}:F>`;
            const partyField = partySize > 1 ? `**${member.charName || "—"}** | ${partySize}p — ${memberNames}` : `**${member.charName || "—"}** | Solo`;

            const embed = {
              title,
              url: partyLink,
              color: embedColor,
              fields: [
                { name: "Time", value: timeField, inline: false },
                { name: "Party", value: partyField, inline: false },
              ],
              footer: { text: resetStr },
            };
            if (gif) embed.thumbnail = { url: gif };

            // Check if this is the user's first notification
            const prevNotif = db.prepare("SELECT id FROM notifications_sent WHERE id LIKE ? LIMIT 1").get(`%_${realDiscordId}_%`);
            if (!prevNotif) {
              embed.fields.push({ name: "\u200b", value: `[Notification settings](${siteUrl}) can be changed in Profile Settings`, inline: false });
            }

            const msgPayload = { embeds: [embed] };

            // Send and mark as sent
            sendDiscordDM(realDiscordId, msgPayload);
            db.prepare("INSERT OR IGNORE INTO notifications_sent (id) VALUES (?)").run(sentKey);
            console.log(`📨 Notified ${realDiscordId} for ${diff} ${bossName} (${minsBefore}min before)`);
          }
        }
      }
    }
  } catch (err) { console.error("Notification check error:", err); }
}

// Run every 60 seconds
setInterval(runNotificationCheck, 60 * 1000);
// Run once on startup after a short delay
setTimeout(runNotificationCheck, 5000);

/* ════════════════════════════════════════
   DAILY REMINDER SCHEDULER
   ════════════════════════════════════════ */
db.exec(`CREATE TABLE IF NOT EXISTS daily_sent (id TEXT PRIMARY KEY, sent_at DATETIME DEFAULT CURRENT_TIMESTAMP);`);
try { db.prepare("DELETE FROM daily_sent WHERE sent_at < datetime('now', '-25 hours')").run(); } catch {}

function runDailyCheck() {
  if (!process.env.DISCORD_BOT_TOKEN) return;
  try {
    const now = new Date();
    const users = db.prepare("SELECT id, username, settings, timezone FROM users").all();

    for (const u of users) {
      const s = JSON.parse(u.settings || "{}");
      if (!s.notifications?.enabled || !s.notifications?.daily?.enabled) continue;
      const dailyTime = s.notifications.daily.time || "08:00";

      // Convert user's desired local time to UTC
      const userTZ = u.timezone || "America/New_York";
      const [dH, dM] = dailyTime.split(":").map(Number);

      // Calculate what time it is in the user's timezone
      const userNow = new Date(now.toLocaleString("en-US", { timeZone: userTZ }));
      const userNowMin = userNow.getHours() * 60 + userNow.getMinutes();
      const targetMin = dH * 60 + dM;

      // Check if within 1-minute window
      if (Math.abs(userNowMin - targetMin) > 1) continue;

      // Dedup — one per user per day
      const dateKey = `${u.id}_${now.getUTCFullYear()}_${now.getUTCMonth()}_${now.getUTCDate()}`;
      const already = db.prepare("SELECT id FROM daily_sent WHERE id = ?").get(dateKey);
      if (already) continue;

      const payload = buildDailySummary(u.id, u.username, userTZ);
      if (!payload) continue; // no bosses → skip

      sendDiscordDM(u.id, payload, 24 * 60 * 60 * 1000);
      db.prepare("INSERT OR IGNORE INTO daily_sent (id) VALUES (?)").run(dateKey);
      console.log(`📅 Daily summary sent to ${u.username}`);
    }
  } catch (err) { console.error("Daily check error:", err); }
}

setInterval(runDailyCheck, 60 * 1000);
setTimeout(runDailyCheck, 8000);

app.listen(PORT, () => console.log(`🍄 Maple Scheduler running on port ${PORT}`));
