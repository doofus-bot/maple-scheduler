import "dotenv/config";
import express from "express";
import session from "express-session";
import compression from "compression";
import Database from "better-sqlite3";
import fetch from "node-fetch";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

/* ════════════════════════════════════════
   DATABASE
   ════════════════════════════════════════ */
const db = new Database(join(__dirname, "..", "data.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    avatar TEXT,
    timezone TEXT DEFAULT 'America/New_York',
    ign TEXT DEFAULT '',
    availability TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS parties (
    id TEXT PRIMARY KEY,
    boss TEXT NOT NULL,
    diff TEXT NOT NULL,
    day TEXT NOT NULL,
    time TEXT NOT NULL,
    members TEXT DEFAULT '[]',
    lead_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

/* ════════════════════════════════════════
   MIDDLEWARE
   ════════════════════════════════════════ */
app.use(compression());
app.use(express.json());

// Sessions — uses SQLite file for persistence on Railway
app.use(session({
  secret: process.env.SESSION_SECRET || "change-me-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    sameSite: process.env.NODE_ENV === "production" ? "lax" : "lax",
  },
  // Store sessions in memory (fine for small apps; swap to connect-sqlite3 for scale)
}));

// Trust Railway's proxy
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

/* ════════════════════════════════════════
   DISCORD OAUTH
   ════════════════════════════════════════ */
const DISCORD_API = "https://discord.com/api/v10";
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

// Step 1: Redirect to Discord
app.get("/auth/discord", (req, res) => {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "identify",
  });
  res.redirect(`${DISCORD_API}/oauth2/authorize?${params}`);
});

// Step 2: Discord callback
app.get("/auth/discord/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect("/?error=no_code");

  try {
    // Exchange code for token
    const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("No access token");

    // Fetch Discord user
    const userRes = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const discordUser = await userRes.json();

    // Upsert user in DB
    const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(discordUser.id);
    if (!existing) {
      db.prepare("INSERT INTO users (id, username, avatar) VALUES (?, ?, ?)")
        .run(discordUser.id, discordUser.username, discordUser.avatar);
    } else {
      db.prepare("UPDATE users SET username = ?, avatar = ? WHERE id = ?")
        .run(discordUser.username, discordUser.avatar, discordUser.id);
    }

    // Set session
    req.session.userId = discordUser.id;
    res.redirect("/");
  } catch (err) {
    console.error("OAuth error:", err);
    res.redirect("/?error=auth_failed");
  }
});

// Logout
app.get("/auth/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

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
   API ROUTES
   ════════════════════════════════════════ */

// GET /api/me — current user
app.get("/api/me", requireAuth, (req, res) => {
  const u = req.user;
  res.json({
    id: u.id,
    username: u.username,
    avatar: u.avatar,
    timezone: u.timezone,
    ign: u.ign,
    availability: JSON.parse(u.availability || "[]"),
  });
});

// PUT /api/me — update profile
app.put("/api/me", requireAuth, (req, res) => {
  const { timezone, ign, availability } = req.body;
  if (timezone) db.prepare("UPDATE users SET timezone = ? WHERE id = ?").run(timezone, req.user.id);
  if (ign !== undefined) db.prepare("UPDATE users SET ign = ? WHERE id = ?").run(ign, req.user.id);
  if (availability) db.prepare("UPDATE users SET availability = ? WHERE id = ?").run(JSON.stringify(availability), req.user.id);
  res.json({ ok: true });
});

// GET /api/parties — all parties
app.get("/api/parties", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM parties ORDER BY created_at DESC").all();
  res.json(rows.map(r => ({
    ...r,
    members: JSON.parse(r.members || "[]"),
  })));
});

// POST /api/parties — create party
app.post("/api/parties", requireAuth, (req, res) => {
  const { id, boss, diff, day, time, members } = req.body;
  const partyId = id || Date.now().toString(36);
  db.prepare("INSERT INTO parties (id, boss, diff, day, time, members, lead_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(partyId, boss, diff, day, time, JSON.stringify(members || []), req.user.id);
  res.json({ id: partyId, boss, diff, day, time, members: members || [], lead_id: req.user.id });
});

// PUT /api/parties/:id — update party
app.put("/api/parties/:id", requireAuth, (req, res) => {
  const party = db.prepare("SELECT * FROM parties WHERE id = ?").get(req.params.id);
  if (!party) return res.status(404).json({ error: "Not found" });
  // Only lead can update
  if (party.lead_id !== req.user.id) return res.status(403).json({ error: "Not party lead" });

  const { boss, diff, day, time, members } = req.body;
  if (boss) db.prepare("UPDATE parties SET boss = ? WHERE id = ?").run(boss, req.params.id);
  if (diff) db.prepare("UPDATE parties SET diff = ? WHERE id = ?").run(diff, req.params.id);
  if (day) db.prepare("UPDATE parties SET day = ? WHERE id = ?").run(day, req.params.id);
  if (time) db.prepare("UPDATE parties SET time = ? WHERE id = ?").run(time, req.params.id);
  if (members) db.prepare("UPDATE parties SET members = ? WHERE id = ?").run(JSON.stringify(members), req.params.id);
  res.json({ ok: true });
});

// DELETE /api/parties/:id — delete party
app.delete("/api/parties/:id", requireAuth, (req, res) => {
  const party = db.prepare("SELECT * FROM parties WHERE id = ?").get(req.params.id);
  if (!party) return res.status(404).json({ error: "Not found" });
  if (party.lead_id !== req.user.id) return res.status(403).json({ error: "Not party lead" });
  db.prepare("DELETE FROM parties WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

/* ════════════════════════════════════════
   SERVE FRONTEND (production)
   ════════════════════════════════════════ */
if (process.env.NODE_ENV === "production") {
  const distPath = join(__dirname, "..", "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(join(distPath, "index.html"));
  });
}

/* ════════════════════════════════════════
   START
   ════════════════════════════════════════ */
app.listen(PORT, () => {
  console.log(`🚀 Boss Organizer running on port ${PORT}`);
});
