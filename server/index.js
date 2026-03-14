
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS parties_store (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT DEFAULT '{}'
  );

  INSERT OR IGNORE INTO parties_store (id, data) VALUES (1, '{}');
`);

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
  res.json({ id: u.id, username: u.username, avatar: u.avatar, timezone: u.timezone,
    characters: JSON.parse(u.characters || "[]"), availability: JSON.parse(u.availability || "{}") });
});

app.patch("/api/me", requireAuth, (req, res) => {
  const { timezone, characters, availability } = req.body;
  if (timezone) db.prepare("UPDATE users SET timezone = ? WHERE id = ?").run(timezone, req.user.id);
  if (characters !== undefined) db.prepare("UPDATE users SET characters = ? WHERE id = ?").run(JSON.stringify(characters), req.user.id);
  if (availability !== undefined) db.prepare("UPDATE users SET availability = ? WHERE id = ?").run(JSON.stringify(availability), req.user.id);
  const u = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  res.json({ id: u.id, username: u.username, avatar: u.avatar, timezone: u.timezone,
    characters: JSON.parse(u.characters || "[]"), availability: JSON.parse(u.availability || "{}") });
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
        if (match) return res.json({ imgUrl: match.characterImgURL, jobName: match.jobName, characterName: match.characterName });
      }
    }
    res.json({ imgUrl: null, jobName: null, characterName: name });
  } catch (err) {
    console.error("Nexon API error:", err);
    res.json({ imgUrl: null, jobName: null, characterName: name });
  }
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

app.listen(PORT, () => console.log(`🍄 Maple Scheduler running on port ${PORT}`));
