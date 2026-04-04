import { useState, useEffect, useRef, useMemo, useCallback } from "react";

/* ═══ BOSSES, DROPS, CONSTANTS ═══ */
const BOSSES = [
  { name: "Lotus", diffs: ["Normal", "Hard", "Extreme"] }, { name: "Ctene", diffs: ["Chaos"] },
  { name: "Black Mage", diffs: ["Hard", "Extreme"] }, { name: "Seren", diffs: ["Normal", "Hard", "Extreme"] },
  { name: "Kalos", diffs: ["Easy", "Normal", "Chaos", "Extreme"] }, { name: "Adversary", diffs: ["Easy", "Normal", "Hard", "Extreme"] },
  { name: "Kaling", diffs: ["Easy", "Normal", "Hard", "Extreme"] }, { name: "Limbo", diffs: ["Normal", "Hard"] },
  { name: "Baldrix", diffs: ["Normal", "Hard"] }, { name: "Other", diffs: [""] },
];
const BOSS_DROPS = {
  "Lotus": [{ name: "Total Control", diffs: ["Extreme"] }, { name: "Berserked", diffs: ["Hard", "Extreme"] }, { name: "Black Heart", diffs: ["Hard", "Extreme"] }],
  "Ctene": [{ name: "Pitched Boss", diffs: null }],
  "Black Mage": [{ name: "Genesis Badge", diffs: null }, { name: "Enhancement Hammer", diffs: ["Extreme"] }],
  "Seren": [{ name: "Mitra's Rage", diffs: null }, { name: "Enhancement Hammer", diffs: ["Extreme"] }],
  "Kalos": [{ name: "Grindstone of Life", diffs: ["Normal", "Chaos", "Extreme"] }, { name: "Enhancement Hammer", diffs: ["Extreme"] }],
  "Adversary": [{ name: "Grindstone of Life", diffs: ["Normal", "Hard", "Extreme"] }, { name: "Immortal Legacy", diffs: ["Hard", "Extreme"] }, { name: "Enhancement Hammer", diffs: ["Extreme"] }],
  "Kaling": [{ name: "Grindstone of Life", diffs: ["Normal"] }, { name: "Grindstone of Faith", diffs: ["Hard", "Extreme"] }, { name: "Enhancement Hammer", diffs: ["Extreme"] }],
  "Limbo": [{ name: "Grindstone of Faith", diffs: null }, { name: "Whisper of the Source", diffs: ["Hard"] }],
  "Baldrix": [{ name: "Grindstone of Faith", diffs: null }, { name: "Oath of Death", diffs: ["Hard"] }, { name: "Enhancement Hammer", diffs: ["Extreme"] }],
  "Other": [],
};
const BOSS_ORDER = ["Baldrix", "Limbo", "Kaling", "Adversary", "Kalos", "Seren", "Black Mage", "Lotus", "Ctene", "Other"];
const BOSS_LEVEL_REQ = { Seren: 260, Kalos: 265, Adversary: 270, Kaling: 275, Limbo: 285, Baldrix: 290 };
const MONTHLY_BOSSES = new Set(["Black Mage|Hard", "Black Mage|Extreme"]);
const isMonthlyBoss = (bossName, diff) => MONTHLY_BOSSES.has(`${bossName}|${diff}`);
const DIFF_ABBR = { Easy: "E", Normal: "N", Hard: "H", Chaos: "C", Extreme: "X" };
const DIFF_COLORS = { Easy: "#989898", Normal: "#49B8C6", Hard: "#CE506D", Chaos: "#DCBA87", Extreme: "#ED7421" };
const DIFF_BADGE_STYLE = {
  Easy:    { background: "#989898", color: "#fff", border: "none" },
  Normal:  { background: "#49B8C6", color: "#fff", border: "none" },
  Hard:    { background: "#CE506D", color: "#fff", border: "none" },
  Chaos:   { background: "#424243", color: "#DCBA87", border: "1px solid #CAA78A", backgroundImage: "linear-gradient(135deg,#DCBA87,#CAA78A)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", borderImage: "linear-gradient(135deg,#DCBA87,#CAA78A) 1" },
  Extreme: { background: "#424243", color: "#ED7421", border: "1px solid #C03655", borderImage: "linear-gradient(135deg,#C03655,#C83958) 1", backgroundImage: "linear-gradient(135deg,#ED7421,#A63647)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
};
// Simplified badge for small inline use (no gradient text — too complex for tiny badges)
const getDiffBadge = (diff) => {
  const s = DIFF_BADGE_STYLE[diff];
  if (!s) return {};
  if (diff === "Chaos") return { background: "#424243", color: "#DCBA87", border: "1px solid #CAA78A" };
  if (diff === "Extreme") return { background: "#424243", color: "#ED7421", border: "1px solid #C03655" };
  return { background: s.background, color: s.color, border: "none" };
};
const DIFF_GRADIENTS = {
  Easy: "#989898",
  Normal: "#49B8C6",
  Hard: "#CE506D",
  Chaos: "#424243",
  Extreme: "#424243",
};
const ACCENT = "#2563eb", ACCENT_LIGHT = "rgba(37,99,235,0.15)", ACCENT_BORDER = "rgba(37,99,235,0.3)";
const SOLO_COLOR = "#c45c5c", SOLO_BG = "rgba(196,92,92,0.18)", SOLO_BORDER = "rgba(196,92,92,0.35)";
const BACKDROP = { background: "rgba(11,14,26,0.95)", backdropFilter: "blur(12px)", borderRadius: 14, border: "1px solid rgba(30,36,64,0.6)" };
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// Week starts on the local day that Thursday 0:00 UTC falls on
// PT (UTC-7): Thu 0 UTC = Wed 5PM → starts Wed. UTC/East: starts Thu.
const _localResetHour = -new Date().getTimezoneOffset() / 60;
const _resetLocalDay = ((3 + Math.floor(_localResetHour / 24)) % 7 + 7) % 7;
const DAY_ORDER = Array.from({ length: 7 }, (_, i) => (_resetLocalDay + i) % 7);
const TIMEZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu", "America/Toronto", "America/Vancouver", "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Asia/Seoul", "Asia/Shanghai", "Asia/Singapore", "Australia/Sydney", "America/Sao_Paulo", "America/Mexico_City", "UTC"];
function getMaxParty(b, d) { if (b === "Lotus" && d === "Extreme") return 2; if (["Adversary", "Limbo", "Baldrix"].includes(b)) return 3; return 6; }
function getDropsForBoss(b, d) { return (BOSS_DROPS[b] || []).filter(x => x.diffs === null || x.diffs.includes(d)); }
const DROP_ABBR = { "Total Control": "TC", "Berserked": "Zerk", "Black Heart": "BH", "Pitched Boss": "Pitched", "Genesis Badge": "Badge", "Enhancement Hammer": "Hammer", "Mitra's Rage": "Emblem", "Grindstone of Life": "GS 4→5", "Immortal Legacy": "Medal", "Grindstone of Faith": "GS 5→6", "Whisper of the Source": "Whisper", "Oath of Death": "Oath" };
const offsetMin = new Date().getTimezoneOffset();
const RESET_SLOT = ((Math.round(-offsetMin / 30) % 48) + 48) % 48;

/* Next run timestamp calculator */
function getNextRun(localDay, localHour, localMin, duration) {
  // Stored day/hour/min are local-time-relative (grid shows local times)
  // localDay: 0=Mon..6=Sun → JS getDay: 0=Sun,1=Mon..6=Sat
  const jsDay = (localDay + 1) % 7;
  const now = new Date();
  const nowJsDay = now.getDay();
  let daysUntil = (jsDay - nowJsDay + 7) % 7;
  // Build candidate in LOCAL time — Date constructor auto-converts to UTC internally
  const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntil, localHour, localMin, 0);
  // If it's in the past, add 7 days
  if (candidate.getTime() <= now.getTime()) candidate.setDate(candidate.getDate() + 7);
  const startUnix = Math.floor(candidate.getTime() / 1000);
  const endUnix = startUnix + (duration || 30) * 60;
  // Reset label: relative to daily 00:00 UTC
  // Positive = hours after reset, negative = hours before next reset (within 8hrs)
  // Decimals for 15min intervals: .25, .5, .75. No "h" suffix.
  const utcH = candidate.getUTCHours(), utcM = candidate.getUTCMinutes();
  const hoursAfter = utcH + utcM / 60;
  const hoursBefore = 24 - hoursAfter;
  let resetLabel;
  if (hoursBefore <= 8 && hoursAfter > 0) {
    const v = Math.round(hoursBefore * 4) / 4; // round to .25
    resetLabel = `Reset -${v % 1 === 0 ? v.toFixed(0) : v}`;
  } else {
    const v = Math.round(hoursAfter * 4) / 4;
    resetLabel = `Reset +${v % 1 === 0 ? v.toFixed(0) : v}`;
  }
  // Local day name for display
  const localDayName = candidate.toLocaleDateString("en-US", { weekday: "long" });
  return { startUnix, endUnix, resetLabel, localDay: localDayName };
}

/* Next run for monthly bosses — scheduledDate is "YYYY-MM-DD", hour/min in creator's local TZ */
function getNextRunMonthly(scheduledDate, localHour, localMin, duration) {
  if (!scheduledDate) return null;
  const [y, mo, d] = scheduledDate.split("-").map(Number);
  const h = localHour || 0, m = localMin || 0;
  const candidate = new Date(y, mo - 1, d, h, m, 0);
  const startUnix = Math.floor(candidate.getTime() / 1000);
  const endUnix = startUnix + (duration || 30) * 60;
  const utcH = candidate.getUTCHours(), utcM = candidate.getUTCMinutes();
  const hoursAfter = utcH + utcM / 60;
  const hoursBefore = 24 - hoursAfter;
  let resetLabel;
  if (hoursBefore <= 8 && hoursAfter > 0) {
    const v = Math.round(hoursBefore * 4) / 4;
    resetLabel = `Reset -${v % 1 === 0 ? v.toFixed(0) : v}`;
  } else {
    const v = Math.round(hoursAfter * 4) / 4;
    resetLabel = `Reset +${v % 1 === 0 ? v.toFixed(0) : v}`;
  }
  const localDayName = candidate.toLocaleDateString("en-US", { weekday: "long" });
  const localDateStr = candidate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const isPast = candidate.getTime() < Date.now();
  return { startUnix, endUnix, resetLabel, localDay: localDayName, localDateStr, isPast };
}

/* ═══ API ═══ */
const API = {
  async get(p) { const r = await fetch(p, { credentials: "include" }); if (r.status === 401) return null; return r.json(); },
  async patch(p, b) { return (await fetch(p, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })).json(); },
  async put(p, b) { return (await fetch(p, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })).json(); },
};
const genId = () => { const a = new Uint8Array(8); crypto.getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2, "0")).join(""); };

/* ═══ IMAGE CACHE ═══ */
const charInfoCache = {};
const charInfoListeners = {};
function useCharInfo(name) {
  const [info, setInfo] = useState(charInfoCache[name] || null);
  useEffect(() => {
    if (!name) return;
    if (!charInfoListeners[name]) charInfoListeners[name] = new Set();
    charInfoListeners[name].add(setInfo);
    if (charInfoCache[name]) { setInfo(charInfoCache[name]); return () => charInfoListeners[name]?.delete(setInfo); }
    if (charInfoCache[name] === undefined) {
      charInfoCache[name] = null;
      API.get(`/api/nexon/${encodeURIComponent(name)}`).then(d => {
        if (d) {
          const info = { imgUrl: d.imgUrl, jobName: d.jobName, level: d.level };
          charInfoCache[name] = info;
          charInfoListeners[name]?.forEach(fn => fn(info));
        }
      });
    }
    return () => charInfoListeners[name]?.delete(setInfo);
  }, [name]);
  return info; // { imgUrl, jobName, level } or null
}

/* ═══ STYLES ═══ */
const globalCSS = `@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Comfortaa:wght@300;400;500;600;700&display=swap');
@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}@keyframes slideFromLeft{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:translateX(0)}}@keyframes slideFromRight{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}
*{box-sizing:border-box;margin:0;padding:0}body{background:#0b0e1a}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:3px}
input::placeholder,textarea::placeholder{color:#475569}select option{background:#141829;color:#e2e8f0}`;

/* Smart tooltip position — flips above cursor when near bottom of viewport */
function smartTip(e, tipH = 150) {
  const tipW = 240;
  const flipX = e.clientX + tipW + 20 > window.innerWidth;
  const flipY = e.clientY + tipH + 20 > window.innerHeight;
  return {
    left: flipX ? e.clientX - tipW - 14 : e.clientX + 14,
    top: flipY ? e.clientY - tipH - 14 : e.clientY + 14,
  };
}

const S = {
  overlay: { position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.15s ease" },
  modal: { background: "linear-gradient(160deg,#141829 0%,#0b0e1a 100%)", border: "1px solid #1e2440", borderRadius: 16, width: "min(540px,92vw)", maxHeight: "85vh", overflow: "auto", boxShadow: "0 24px 80px rgba(0,0,0,.5)", animation: "slideUp .2s ease" },
  modalHead: { padding: "16px 22px", borderBottom: "1px solid #1e2440", display: "flex", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { fontSize: 17, fontWeight: 700, color: "#e2e8f0", fontFamily: "'Fredoka',sans-serif" },
  modalBody: { padding: "18px 22px" },
  closeBtn: { width: 30, height: 30, borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(255,255,255,.06)", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 },
  label: { fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: ".05em", fontFamily: "'Comfortaa',sans-serif" },
  input: { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #1e2440", background: "rgba(11,14,26,.6)", color: "#e2e8f0", fontSize: 14, outline: "none", fontFamily: "'Comfortaa',sans-serif" },
  select: { padding: "10px 14px", borderRadius: 8, border: "1px solid #1e2440", background: "rgba(11,14,26,.6)", color: "#e2e8f0", fontSize: 14, outline: "none", cursor: "pointer", fontFamily: "'Comfortaa',sans-serif", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2394a3b8' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 32 },
  btnPrimary: { padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", background: `linear-gradient(135deg,${ACCENT},#1d4ed8)`, color: "#fff", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6, fontFamily: "'Comfortaa',sans-serif", boxShadow: "0 2px 12px rgba(37,99,235,.3)" },
  btnGhost: { padding: "8px 14px", borderRadius: 8, border: "1px solid #1e2440", background: "rgba(255,255,255,.04)", color: "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Comfortaa',sans-serif" },
  btnActive: { background: ACCENT_LIGHT, color: ACCENT, borderColor: ACCENT_BORDER },
  btnGreen: { padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", fontWeight: 600, fontSize: 13, fontFamily: "'Comfortaa',sans-serif" },
  addTempBtn: { padding: "8px 16px", borderRadius: 8, border: "1px dashed rgba(251,191,36,.4)", background: "rgba(251,191,36,.06)", color: "#fbbf24", cursor: "pointer", fontWeight: 600, fontSize: 12, marginTop: 10, fontFamily: "'Comfortaa',sans-serif", display: "flex", alignItems: "center", gap: 6 },
  card: { ...BACKDROP, overflow: "hidden", transition: "transform .2s,box-shadow .2s" },
  tempBadge: { fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(251,191,36,.15)", color: "#fbbf24", marginLeft: 4 },
  tbdBadge: { fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(239,68,68,.12)", color: "#f87171", marginLeft: 4 },
  leadBadge: { fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: ACCENT_LIGHT, color: ACCENT },
  popOverlay: { position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.5)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn .12s ease" },
  popBox: { background: "linear-gradient(160deg,#141829 0%,#0b0e1a 100%)", border: "1px solid #1e2440", borderRadius: 14, width: "min(380px,88vw)", boxShadow: "0 16px 60px rgba(0,0,0,.5)", animation: "slideUp .18s ease" },
  popHead: { padding: "14px 18px", borderBottom: "1px solid #1e2440", display: "flex", justifyContent: "space-between", alignItems: "center" },
};

/* ═══ CHAR AVATAR — shows Nexon image or fallback ═══ */
function CharAvatar({ name, size = 36, style: extra }) {
  const info = useCharInfo(name);
  const img = info?.imgUrl;
  if (img) return <img src={img} alt={name} style={{ width: size, height: size, objectFit: "contain", ...extra }} />;
  return <div style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg,${ACCENT},#1d4ed8)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 700, color: "#fff", ...extra }}>{(name?.[0] || "?").toUpperCase()}</div>;
}

function CharJobLevel({ name, style: extra }) {
  const info = useCharInfo(name);
  if (!info?.jobName) return null;
  return <div style={{ fontSize: 9, color: "#64748b", fontFamily: "'Comfortaa',sans-serif", textAlign: "center", ...extra }}>
    {info.level ? `Lv.${info.level} ` : ""}{info.jobName}
  </div>;
}

function ScheduleBlockJob({ charName }) {
  const info = useCharInfo(charName);
  if (!info?.jobName) return null;
  return <span style={{ fontSize: 9, color: "rgba(255,255,255,.5)", fontWeight: 500 }}>{info.jobName}</span>;
}

function DiffBadge({ difficulty, small, medium, inline }) {
  const bg = DIFF_GRADIENTS[difficulty] || "#555";
  const abbr = DIFF_ABBR[difficulty] || "";
  const full = difficulty?.toUpperCase() || "";
  const dc = DIFF_COLORS[difficulty] || "#94a3b8";

  // Inline mode: minimal pill for schedule blocks
  if (inline) {
    return <span style={{ fontSize: 8, fontWeight: 900, padding: "1px 4px", borderRadius: 3, background: bg, color: (difficulty === "Chaos" || difficulty === "Extreme") ? dc : "#fff", border: "none", flexShrink: 0, lineHeight: 1.3, display: "inline-block" }}>{abbr}</span>;
  }

  const sz = small ? { fontSize: 8, padding: "1px 5px", borderRadius: 3 } : medium ? { fontSize: 14, padding: "4px 10px", borderRadius: 5 } : { fontSize: 13, padding: "4px 12px", borderRadius: 5 };
  const label = (small || medium) ? abbr : full;
  const base = { ...sz, fontWeight: 900, flexShrink: 0, letterSpacing: "0.5px", display: "inline-block", lineHeight: 1.4 };

  if (difficulty === "Chaos") {
    return <span style={{ ...base, background: bg, border: "2px solid #CAA78A", position: "relative", overflow: "hidden" }}>
      <span style={{ backgroundImage: "linear-gradient(135deg,#DCBA87,#CAA78A)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontWeight: 900 }}>{label}</span>
    </span>;
  }
  if (difficulty === "Extreme") {
    return <span style={{ ...base, background: bg, border: "2px solid #C03655", position: "relative", overflow: "hidden" }}>
      <span style={{ backgroundImage: "linear-gradient(135deg,#ED7421,#A63647)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontWeight: 900 }}>{label}</span>
    </span>;
  }
  return <span style={{ ...base, background: bg, color: "#fff", border: "none" }}>{label}</span>;
}

/* ═══ IGN POPUP ═══ */
/* ═══ PARTY HOVER CARD ═══ */
function PartyHoverCard({ party, currentUserId, style: pos }) {
  const b = party.bosses?.[0]; const dc = DIFF_COLORS[b?.difficulty] || "#94a3b8";
  const fmtTime = (h, m) => { const hr = h % 12 || 12; return `${hr}:${String(m).padStart(2, "0")}${h < 12 ? "a" : "p"}`; };
  const timeStr = party.utcDay != null ? (() => { const startMin = party.utcHour * 60 + party.utcMin; const endMin = startMin + (party.duration || 30); const eH = Math.floor(endMin / 60) % 24; const eM = endMin % 60; return `${DAYS_SHORT[party.utcDay]} ${fmtTime(party.utcHour, party.utcMin)} – ${fmtTime(eH, eM)}`; })() : "Unscheduled";
  const me = party.members?.find(m => m.userId === currentUserId);
  const others = party.members?.filter(m => m.userId !== currentUserId) || [];
  return (
    <div style={{ position: "fixed", zIndex: 200, pointerEvents: "none", ...pos }}>
      <div style={{ background: "rgba(11,14,26,.97)", border: "1px solid rgba(30,36,64,.8)", borderRadius: 10, padding: "10px 12px", boxShadow: "0 8px 32px rgba(0,0,0,.5)", minWidth: 160, maxWidth: 240 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <DiffBadge difficulty={b?.difficulty} small />
          <span style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", fontFamily: "'Fredoka',sans-serif" }}>{b?.bossName}</span>
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'Comfortaa',sans-serif", marginBottom: 6 }}>{timeStr}</div>
        {me && <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <CharAvatar name={me.charName} size={28} />
          <span style={{ fontSize: 11, fontWeight: 600, color: "#e2e8f0", fontFamily: "'Comfortaa',sans-serif" }}>{me.charName}</span>
        </div>}
        {others.length > 0 && <div style={{ fontSize: 10, color: "#64748b", fontFamily: "'Comfortaa',sans-serif" }}>
          w/ {others.map(m => m.charName).join(", ")}
        </div>}
      </div>
    </div>
  );
}

function IGNPopup({ title, hint, onConfirm, onClose }) {
  const [ign, setIgn] = useState(""); const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div style={S.popOverlay} onClick={() => onClose()}><div style={S.popBox} onClick={e => e.stopPropagation()}>
      <div style={S.popHead}><span style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0", fontFamily: "'Fredoka',sans-serif" }}>{title}</span><button style={S.closeBtn} onClick={() => onClose()}>✕</button></div>
      <div style={{ padding: "16px 20px" }}>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10, fontFamily: "'Comfortaa',sans-serif" }}>{hint}</div>
        <input ref={ref} style={S.input} placeholder="e.g. xXSlayerXx" value={ign} onChange={e => setIgn(e.target.value)} onKeyDown={e => { if (e.key === "Enter") onConfirm(ign.trim() || "Temp"); if (e.key === "Escape") onClose(); }} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}><button style={S.btnGhost} onClick={() => onClose()}>Skip</button><button style={S.btnGreen} onClick={() => onConfirm(ign.trim() || "Temp")}>Confirm</button></div>
      </div>
    </div></div>
  );
}

/* ═══ RESET LINE — reusable ═══ */
function ResetLine({ top }) {
  return <div style={{ position: "absolute", left: 50, right: 0, top, height: 0, borderTop: "2px dashed rgba(239,68,68,.6)", pointerEvents: "none", zIndex: 5 }}>
    <span style={{ position: "absolute", right: 4, top: -14, fontSize: 9, color: "#f87171", fontWeight: 600, background: "rgba(11,14,26,.8)", padding: "1px 4px", borderRadius: 3, fontFamily: "'Comfortaa',sans-serif" }}>0:00 UTC</span>
  </div>;
}

/* ═══ CREATE PARTY MODAL ═══ */
function CreatePartyModal({ onClose, onSave, currentUser, defaultBoss, defaultDiff, defaultChar }) {
  const [boss, setBoss] = useState(defaultBoss || "");
  const [diff, setDiff] = useState(defaultDiff || "");
  const [charName, setCharName] = useState(defaultChar || (currentUser.characters?.[0] || currentUser.username));
  const [members, setMembers] = useState([]);
  const [discordInput, setDiscordInput] = useState("");
  const [ignPopup, setIgnPopup] = useState(null);
  const inputRef = useRef(null);
  const bossObj = BOSSES.find(b => b.name === boss);
  const maxP = boss && diff ? getMaxParty(boss, diff) : 6;

  useEffect(() => {
    if (currentUser && members.length === 0) setMembers([{ userId: currentUser.id, charName, isTemp: false, isLead: true }]);
  }, [currentUser]);

  // Update lead's charName when dropdown changes
  useEffect(() => { setMembers(prev => prev.map((m, i) => i === 0 ? { ...m, charName } : m)); }, [charName]);

  const openIgnD = () => { const n = discordInput.trim(); if (!n || members.length >= maxP) return; setMembers(p => [...p, { userId: n, charName: n, isTemp: false }]); setDiscordInput(""); setTimeout(() => inputRef.current?.focus(), 50); };
  const openIgnT = () => { if (members.length >= maxP) return; setIgnPopup({ type: "temp" }); };
  const handleIgn = (ign) => {
    setMembers(p => [...p, { userId: `temp_${Date.now()}`, charName: ign || "Temp", isTemp: true }]);
    setIgnPopup(null); setTimeout(() => inputRef.current?.focus(), 50);
  };
  const rmMember = i => setMembers(p => p.filter((_, j) => j !== i));
  const drops = boss && diff ? getDropsForBoss(boss, diff) : [];

  const save = () => {
    if (!boss || (!diff && boss !== "Other")) return;
    const monthly = isMonthlyBoss(boss, diff);
    onSave({
      id: genId(), leaderId: currentUser.id, members, maxMembers: maxP,
      bosses: [{ id: "b0", bossName: boss, difficulty: diff }],
      utcDay: null, utcHour: null, utcMin: null, duration: 30, notes: "",
      ...(monthly ? { isMonthly: true, scheduledDate: null } : {}),
      drops: drops.map((d, i) => ({ id: `d${i}`, bossId: "b0", itemName: d.name, method: null, eligible: [], priority: [] })),
    });
  };

  return (
    <div style={S.overlay} onClick={onClose}><div style={S.modal} onClick={e => e.stopPropagation()}>
      <div style={S.modalHead}><span style={S.modalTitle}>Create Party</span><button style={S.closeBtn} onClick={onClose}>✕</button></div>
      <div style={S.modalBody}>
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}><label style={S.label}>Boss</label><select style={{ ...S.select, width: "100%" }} value={boss} onChange={e => { setBoss(e.target.value); setDiff(""); }}><option value="">Select</option>{BOSSES.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}</select></div>
          <div style={{ flex: 1 }}><label style={S.label}>Difficulty</label><select style={{ ...S.select, width: "100%" }} value={diff} onChange={e => setDiff(e.target.value)} disabled={!boss}><option value="">Select</option>{bossObj?.diffs.map(d => <option key={d} value={d}>{d || "Default"}</option>)}</select></div>
        </div>

        {/* Character selector */}
        {currentUser.characters?.length > 0 && (
          <div style={{ marginBottom: 16 }}><label style={S.label}>Your Character</label>
            <select style={{ ...S.select, width: "100%" }} value={charName} onChange={e => setCharName(e.target.value)}>
              {currentUser.characters.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {boss && diff && <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12, fontFamily: "'Comfortaa',sans-serif" }}>Max party: <span style={{ color: ACCENT, fontWeight: 700 }}>{maxP}</span></div>}

        <div style={{ marginBottom: 16 }}><label style={S.label}>Discord Username</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input ref={inputRef} style={S.input} placeholder="Enter Discord username..." value={discordInput} onChange={e => setDiscordInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); openIgnD(); } }} />
            <button style={{ ...S.btnPrimary, opacity: discordInput.trim() && members.length < maxP ? 1 : .4, pointerEvents: discordInput.trim() && members.length < maxP ? "auto" : "none", whiteSpace: "nowrap" }} onClick={openIgnD}>＋ Add</button>
          </div>
          <button style={{ ...S.addTempBtn, opacity: members.length < maxP ? 1 : .4, pointerEvents: members.length < maxP ? "auto" : "none" }} onClick={openIgnT}>Add Temp</button>
        </div>

        {members.length > 0 && <div style={{ marginBottom: 16 }}><label style={S.label}>Members ({members.length}/{maxP})</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {members.map((m, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, fontSize: 12, color: "#c7d2fe", background: m.isTemp ? "rgba(251,191,36,.08)" : ACCENT_LIGHT, border: `1px solid ${m.isTemp ? "rgba(251,191,36,.2)" : ACCENT_BORDER}` }}>
              <span style={{ fontWeight: 600 }}>{m.charName}</span>{m.isTemp && <span style={S.tempBadge}>TEMP</span>}{m.isLead && <span style={S.leadBadge}>LEAD</span>}
              {!m.isLead && <button onClick={() => rmMember(i)} style={{ width: 16, height: 16, borderRadius: 4, border: "none", cursor: "pointer", background: "rgba(239,68,68,.2)", color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>✕</button>}
            </div>)}
          </div></div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <button style={S.btnGhost} onClick={onClose}>Cancel</button>
          <button style={{ ...S.btnPrimary, opacity: boss && (diff || boss === "Other") ? 1 : .4, pointerEvents: boss && (diff || boss === "Other") ? "auto" : "none" }} onClick={save}>Create Party</button>
        </div>
      </div>
    </div>
    {ignPopup && <IGNPopup title="Temp Character Name" hint="Character name for temp member." onConfirm={handleIgn} onClose={() => setIgnPopup(null)} />}
    </div>
  );
}

/* ═══ PARTY PAGE — full page with schedule cross-ref, loot ═══ */
function PartyPage({ party, allParties, allUsers, currentUser, onUpdate, onBatchUpdate, onDelete, onBack }) {
  const boss = party.bosses?.[0];
  const diffColor = DIFF_COLORS[boss?.difficulty] || "#94a3b8";
  const drops = boss ? getDropsForBoss(boss.bossName, boss.difficulty) : [];
  const isLead = party.leaderId === currentUser?.id || party.leaderId === currentUser?.username;
  const isMember = party.members?.some(m => m.userId === currentUser?.id || m.userId === currentUser?.username);
  const monthly = party.isMonthly || isMonthlyBoss(boss?.bossName, boss?.difficulty);
  const [settingTime, setSettingTime] = useState(false);
  const [timeAnchor, setTimeAnchor] = useState(null);
  const [timeHover, setTimeHover] = useState(null);
  const [hoverTime, setHoverTime] = useState(null); // { day, slot } for tooltip
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editMembers, setEditMembers] = useState(false);
  const [copied, setCopied] = useState(false);
  const [addDiscord, setAddDiscord] = useState("");
  const [ignPopup, setIgnPopup] = useState(null);
  const [charConflict, setCharConflict] = useState(null); // { newName, oldName, otherParty, memberIdx }
  const [monthlyDatePick, setMonthlyDatePick] = useState(null); // { day, hour, min, duration } — awaiting date selection
  const addRef = useRef(null);
  const gridRef = useRef(null);
  const maxP = party.maxMembers || 6;

  const removeMember = (idx) => {
    const nm = party.members.filter((_, i) => i !== idx);
    const up = { ...party, members: nm };
    if (idx === 0 && nm.length > 0) { up.leaderId = nm[0].userId; up.members = nm.map((m, i) => i === 0 ? { ...m, isLead: true } : m); }
    onUpdate(up);
  };
  const passLead = (idx) => {
    const nm = party.members.map((m, i) => ({ ...m, isLead: i === idx }));
    onUpdate({ ...party, members: nm, leaderId: nm[idx].userId });
  };
  const leaveParty = () => {
    const idx = party.members.findIndex(m => m.userId === currentUser?.id || m.userId === currentUser?.username);
    if (idx >= 0) removeMember(idx);
    onBack();
  };
  const addMemberByDiscord = () => {
    const name = addDiscord.trim();
    if (!name || party.members.length >= maxP) return;
    // Look up if this user exists and has characters
    const matchedUser = allUsers.find(u => u.username?.toLowerCase() === name.toLowerCase());
    const charName = matchedUser?.characters?.[0] || name;
    const userId = matchedUser?.id || name;
    const nm = [...party.members, { userId, charName, isTemp: false }];
    onUpdate({ ...party, members: nm });
    setAddDiscord("");
    setTimeout(() => addRef.current?.focus(), 50);
  };
  const addTemp = (ign) => {
    if (party.members.length >= maxP) return;
    const nm = [...party.members, { userId: `temp_${Date.now()}`, charName: ign || "Temp", isTemp: true }];
    onUpdate({ ...party, members: nm });
    setIgnPopup(null);
  };

  // Convert availability from one timezone to another
  const convertAvail = useCallback((avail, fromTZ) => {
    if (!fromTZ || !avail || Object.keys(avail).length === 0) return avail;
    const viewerTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (fromTZ === viewerTZ) return avail;
    // Compute offset difference in 30-min slots
    const now = new Date();
    const fromTime = new Date(now.toLocaleString("en-US", { timeZone: fromTZ }));
    const viewerTime = new Date(now.toLocaleString("en-US", { timeZone: viewerTZ }));
    const diffSlots = Math.round((viewerTime - fromTime) / (30 * 60 * 1000));
    if (diffSlots === 0) return avail;
    const converted = {};
    for (const key of Object.keys(avail)) {
      if (avail[key] !== "available") continue;
      const [d, s] = key.split("-").map(Number);
      let ns = s + diffSlots, nd = d;
      while (ns >= 48) { ns -= 48; nd = (nd + 1) % 7; }
      while (ns < 0) { ns += 48; nd = (nd - 1 + 7) % 7; }
      converted[`${nd}-${ns}`] = "available";
    }
    return converted;
  }, []);

  // Resolve each member to their real Discord user — match by ID or username
  // Convert their availability from their timezone to the viewer's timezone
  const memberUsers = useMemo(() => (party.members?.map(m => {
    const u = allUsers.find(u => u.id === m.userId) || allUsers.find(u => u.username?.toLowerCase() === m.userId?.toLowerCase());
    const rawAvail = u?.availability || {};
    const memberTZ = u?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    return { ...m, resolvedId: u?.id || m.userId, availability: convertAvail(rawAvail, memberTZ) };
  }) || []), [party.members, allUsers, convertAvail]);

  // Find other parties for each member using resolved Discord ID
  const otherParties = useMemo(() => {
    const allP = Object.values(allParties || {}).filter(p => !p.skipped);
    const map = {};
    memberUsers.forEach(m => {
      const rid = m.resolvedId;
      map[m.userId] = allP.filter(p => p.id !== party.id && p.utcDay != null && p.members?.some(pm => pm.userId === rid || pm.userId === m.userId));
    });
    return map;
  }, [allParties, party, memberUsers]);

  const getSlot = (e) => {
    if (!gridRef.current) return null;
    const r = gridRef.current.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top + gridRef.current.scrollTop;
    const col = Math.floor((x - 36) / ((r.width - 36) / 7));
    const s = Math.floor((y - 28) / 20);
    if (col < 0 || col > 6 || s < 0 || s > 47) return null;
    return { day: DAY_ORDER[col], slot: s };
  };
  const slotToTime = (s) => { const h = Math.floor(s / 2); const m = (s % 2) * 30; return `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(m).padStart(2, "0")}${h < 12 ? "a" : "p"}`; };
  const onGridClick = (e) => { if (!settingTime) return; const pos = getSlot(e); if (!pos) return; if (!timeAnchor) setTimeAnchor(pos); else { if (pos.day === timeAnchor.day) { const ss = Math.min(timeAnchor.slot, pos.slot); const es = Math.max(timeAnchor.slot, pos.slot); const durSlots = Math.min(es - ss + 1, 4); const durMin = durSlots * 30; const newHour = Math.floor(ss / 2); const newMin = (ss % 2) * 30; if (monthly) { setMonthlyDatePick({ day: pos.day, hour: newHour, min: newMin, duration: durMin }); } else { onUpdate({ ...party, utcDay: pos.day, utcHour: newHour, utcMin: newMin, duration: durMin }); } } setSettingTime(false); setTimeAnchor(null); setTimeHover(null); } };
  const onGridMove = (e) => { const pos = getSlot(e); setHoverTime(pos); if (settingTime) setTimeHover(pos); if (pos) setHoverCell(pos); };
  const [hoverCell, setHoverCell] = useState(null);
  const [hoverCellPos, setHoverCellPos] = useState(null);
  const getCellInfo = (day, slot) => {
    let ac = 0; const unavail = []; const conflicts = [];
    memberUsers.forEach(m => {
      const hasAny = Object.keys(m.availability).length > 0;
      if (!hasAny || m.availability[`${day}-${slot}`] === "available") ac++;
      else unavail.push(m.charName);
    });
    memberUsers.forEach(m => {
      (otherParties[m.userId] || []).forEach(op => {
        if (op.utcDay === day) { const os = op.utcHour * 2 + (op.utcMin >= 30 ? 1 : 0); const od = Math.max(1, Math.ceil((op.duration || 30) / 30)); if (slot >= os && slot < os + od) conflicts.push({ name: m.charName, boss: op.bosses?.[0]?.bossName }); }
      });
    });
    return { ac, tot: memberUsers.length, bc: conflicts.length, unavail, conflicts };
  };
  const getTimePrev = () => { if (!timeAnchor || !timeHover || timeAnchor.day !== timeHover.day) return new Set(); const s = new Set(); const mn = Math.min(timeAnchor.slot, timeHover.slot); const mx = Math.max(timeAnchor.slot, timeHover.slot); const capped = Math.min(mx, mn + 3); for (let i = mn; i <= capped; i++) s.add(`${timeAnchor.day}-${i}`); return s; };
  const timePrev = settingTime ? getTimePrev() : new Set();
  const partySlots = useMemo(() => { if (party.utcDay == null) return new Set(); const s = new Set(); const ss = party.utcHour * 2 + (party.utcMin >= 30 ? 1 : 0); const dur = Math.max(1, Math.ceil((party.duration || 30) / 30)); for (let i = ss; i < ss + dur && i < 48; i++) s.add(`${party.utcDay}-${i}`); return s; }, [party.utcDay, party.utcHour, party.utcMin, party.duration]);

  const updateDrop = (dropId, field, value) => {
    let pdrops = [...(party.drops || [])];
    // If this drop doesn't exist yet, create it
    if (!pdrops.find(d => d.id === dropId)) {
      const dropDef = drops.find((_, i) => `d${i}` === dropId);
      if (dropDef) pdrops.push({ id: dropId, bossId: "b0", itemName: dropDef.name, method: null, eligible: [], priority: [] });
    }
    pdrops = pdrops.map(d => d.id === dropId ? { ...d, [field]: value } : d);
    onUpdate({ ...party, drops: pdrops });
  };
  const toggleEligible = (dropId, userId) => { const dr = party.drops?.find(d => d.id === dropId) || { eligible: [] }; const e = dr.eligible || []; updateDrop(dropId, "eligible", e.includes(userId) ? e.filter(x => x !== userId) : [...e, userId]); };
  const setPrioFn = (dropId, userId, pos) => { const dr = party.drops?.find(d => d.id === dropId) || { priority: [] }; let p = [...(dr.priority || [])].filter(x => x !== userId); if (pos > 0) p.splice(pos - 1, 0, userId); updateDrop(dropId, "priority", p); };

  const [expandSchedule, setExpandSchedule] = useState(false);
  const [schedMembers, setSchedMembers] = useState(() => (party.members || []).reduce((o, m) => { o[m.userId] = true; return o; }, {}));
  const toggleSchedMember = (uid) => setSchedMembers(prev => ({ ...prev, [uid]: !prev[uid] }));

  const getCellInfoFiltered = (day, slot) => {
    let ac = 0; const unavail = []; const conflicts = [];
    const memberUsers = (party.members || []).filter(m => schedMembers[m.userId]).map(m => {
      const u = allUsers.find(u => u.id === m.userId) || allUsers.find(u => u.username?.toLowerCase() === m.userId?.toLowerCase());
      if (!u) return { ...m, resolvedId: m.userId, availability: {} };
      const memberTZ = u.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      const rawAvail = u?.availability || {};
      return { ...m, resolvedId: u?.id || m.userId, availability: convertAvail(rawAvail, memberTZ) };
    });
    memberUsers.forEach(m => {
      const hasAny = Object.keys(m.availability).length > 0;
      if (!hasAny || m.availability[`${day}-${slot}`] === "available") ac++;
      else unavail.push(m.charName);
      const otherParties = Object.values(allParties).filter(op => op.id !== party.id && !op.skipped && op.utcDay != null && op.members?.some(om => om.userId === m.resolvedId || om.userId === m.userId));
      for (const op of otherParties) {
        if (op.utcDay === day) { const os = op.utcHour * 2 + (op.utcMin >= 30 ? 1 : 0); const od = Math.max(1, Math.ceil((op.duration || 30) / 30)); if (slot >= os && slot < os + od) conflicts.push({ name: m.charName, boss: op.bosses?.[0]?.bossName }); }
      }
    });
    return { ac, tot: memberUsers.length, bc: conflicts.length, unavail, conflicts };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* TOP BAR */}
      <div style={{ ...BACKDROP, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button style={{ ...S.btnGhost, padding: "4px 10px", fontSize: 11 }} onClick={onBack}>←</button>
          {settingTime && isLead ? (
            <select value={boss?.difficulty || ""} onChange={e => {
              const newDiff = e.target.value;
              const newDrops = getDropsForBoss(boss.bossName, newDiff);
              const newMaxP = getMaxParty(boss.bossName, newDiff);
              onUpdate({ ...party, bosses: [{ ...boss, difficulty: newDiff }], maxMembers: newMaxP,
                drops: newDrops.map((d, i) => party.drops?.find(x => x.itemName === d.name) || { id: `d${i}`, bossId: "b0", itemName: d.name, method: null, eligible: [], priority: [] })
              });
            }} style={{ ...S.select, fontSize: 10, padding: "3px 8px", paddingRight: 20, borderRadius: 8, backgroundPosition: "right 4px center", fontWeight: 700, color: diffColor, background: `${diffColor}15`, borderColor: `${diffColor}44` }}>
              {BOSSES.find(b => b.name === boss?.bossName)?.diffs.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          ) : (
            <DiffBadge difficulty={boss?.difficulty} small />
          )}
          <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Fredoka',sans-serif", color: "#e2e8f0" }}>{boss?.bossName}</span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {isLead && <>
            <button style={{ fontSize: 11, padding: "5px 12px", borderRadius: 8, border: `1px solid ${settingTime ? ACCENT_BORDER : "#1e2440"}`, cursor: "pointer", fontWeight: 700, fontFamily: "'Comfortaa',sans-serif", background: settingTime ? ACCENT_LIGHT : "rgba(255,255,255,.04)", color: settingTime ? ACCENT : "#94a3b8" }} onClick={() => {
              if (settingTime && timeAnchor) onUpdate({ ...party, utcDay: timeAnchor.day, utcHour: Math.floor(timeAnchor.slot / 2), utcMin: (timeAnchor.slot % 2) * 30, duration: party.duration || 30 });
              setSettingTime(!settingTime); setTimeAnchor(null); setTimeHover(null);
              if (!expandSchedule) setExpandSchedule(true);
            }}>{settingTime ? "✓ Done" : "✎ Edit"}</button>
            <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 6px", borderRadius: 6, border: "1px solid #1e2440", background: "rgba(255,255,255,.02)" }}>
              <button onClick={() => { const d = Math.max(15, (party.duration || 30) - 15); onUpdate({ ...party, duration: d }); }} style={{ width: 20, height: 20, borderRadius: 4, border: "1px solid rgba(30,36,64,.6)", background: "rgba(11,14,26,.4)", color: "#94a3b8", cursor: (party.duration || 30) <= 15 ? "default" : "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", opacity: (party.duration || 30) <= 15 ? 0.3 : 1 }}>{"\u2212"}</button>
              <span style={{ fontSize: 11, color: "#e2e8f0", fontFamily: "'Comfortaa',sans-serif", fontWeight: 600, minWidth: 32, textAlign: "center" }}>{party.duration || 30}m</span>
              <button onClick={() => { const d = Math.min(120, (party.duration || 30) + 15); onUpdate({ ...party, duration: d }); }} style={{ width: 20, height: 20, borderRadius: 4, border: "1px solid rgba(30,36,64,.6)", background: "rgba(11,14,26,.4)", color: "#94a3b8", cursor: (party.duration || 30) >= 120 ? "default" : "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", opacity: (party.duration || 30) >= 120 ? 0.3 : 1 }}>+</button>
            </div>
            {monthly && party.scheduledDate && !settingTime && <button onClick={() => onUpdate({ ...party, scheduledDate: null, utcDay: null, utcHour: null, utcMin: null })} style={{ ...S.btnGhost, fontSize: 11, padding: "5px 10px", color: "#f59e0b", borderColor: "rgba(245,158,11,.2)" }}>Unschedule</button>}
            {!monthly && party.utcDay != null && !settingTime && <button onClick={() => onUpdate({ ...party, utcDay: null, utcHour: null, utcMin: null })} style={{ ...S.btnGhost, fontSize: 11, padding: "5px 10px", color: "#f59e0b", borderColor: "rgba(245,158,11,.2)" }}>Unschedule</button>}
            {!confirmDelete && <button onClick={() => setConfirmDelete(true)} style={{ ...S.btnGhost, fontSize: 11, padding: "5px 10px", color: "#f87171", borderColor: "rgba(239,68,68,.2)" }}>Delete</button>}
            {confirmDelete && <>
              <button onClick={() => onDelete(party.id)} style={{ padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: "rgba(239,68,68,.25)", color: "#f87171", fontSize: 11, fontWeight: 700, fontFamily: "'Comfortaa',sans-serif" }}>Confirm</button>
              <button onClick={() => setConfirmDelete(false)} style={{ ...S.btnGhost, fontSize: 11, padding: "5px 10px" }}>Cancel</button>
            </>}
          </>}
          {!isLead && isMember && <button onClick={leaveParty} style={{ fontSize: 11, padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(239,68,68,.2)", cursor: "pointer", fontWeight: 600, fontFamily: "'Comfortaa',sans-serif", background: "rgba(239,68,68,.06)", color: "#f87171" }}>Leave</button>}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        {/* LEFT — Timestamp + Drops + Members */}
        <div style={{ flex: expandSchedule ? 1 : 2, minWidth: 0, display: "flex", flexDirection: "column", gap: 10, transition: "flex .25s ease" }}>
          {/* Timestamp / Scheduling box */}
          {monthly && party.scheduledDate && (() => {
            const run = getNextRunMonthly(party.scheduledDate, party.utcHour, party.utcMin, party.duration);
            if (!run) return null;
            const discordText = `${run.resetLabel}\n<t:${run.startUnix}:R>\n<t:${run.startUnix}:F> - <t:${run.endUnix}:t>`;
            const copyIt = () => { navigator.clipboard.writeText(discordText).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };
            return <div style={{ ...BACKDROP, padding: "8px 12px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "rgba(139,92,246,.15)", color: "#a78bfa", fontFamily: "'Comfortaa',sans-serif", flexShrink: 0 }}>MONTHLY</span>
              <div style={{ flex: 1, fontFamily: "'Comfortaa',sans-serif" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: run.isPast ? "#f87171" : ACCENT, marginBottom: 2 }}>
                  {run.localDateStr} ({run.localDay}) · {run.resetLabel}
                  {run.isPast && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 3, background: "rgba(239,68,68,.15)", color: "#f87171", marginLeft: 8 }}>Past</span>}
                </div>
                <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.6 }}>
                  <span>{`<t:${run.startUnix}:R>`}</span> · <span>{`<t:${run.startUnix}:F>`}</span> - <span>{`<t:${run.endUnix}:t>`}</span>
                </div>
              </div>
              <button onClick={copyIt} title="Copy for Discord" style={{ width: 28, height: 28, borderRadius: 6, border: "none", cursor: "pointer", background: copied ? "rgba(34,197,94,.2)" : "rgba(255,255,255,.06)", color: copied ? "#10b981" : "#64748b", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s", flexShrink: 0 }}>{copied ? "\u2713" : "\ud83d\udccb"}</button>
            </div>;
          })()}
          {monthly && !party.scheduledDate && party.utcDay != null && (
            <div style={{ ...BACKDROP, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "rgba(139,92,246,.15)", color: "#a78bfa", fontFamily: "'Comfortaa',sans-serif", flexShrink: 0 }}>MONTHLY</span>
              <span style={{ fontSize: 11, color: "#f59e0b", fontFamily: "'Comfortaa',sans-serif" }}>Time set — select a date via Edit to finalize</span>
            </div>
          )}
          {!monthly && party.utcDay != null && (() => {
            const run = getNextRun(party.utcDay, party.utcHour, party.utcMin, party.duration);
            const discordText = `${run.resetLabel}\n<t:${run.startUnix}:R>\n<t:${run.startUnix}:F> - <t:${run.endUnix}:t>`;
            const copyIt = () => { navigator.clipboard.writeText(discordText).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };
            return <div style={{ ...BACKDROP, padding: "8px 12px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, fontFamily: "'Comfortaa',sans-serif" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 2 }}>{run.localDay} · {run.resetLabel}</div>
                <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.6 }}>
                  <span>{`<t:${run.startUnix}:R>`}</span> · <span>{`<t:${run.startUnix}:F>`}</span> - <span>{`<t:${run.endUnix}:t>`}</span>
                </div>
              </div>
              <button onClick={copyIt} title="Copy for Discord" style={{ width: 28, height: 28, borderRadius: 6, border: "none", cursor: "pointer", background: copied ? "rgba(34,197,94,.2)" : "rgba(255,255,255,.06)", color: copied ? "#10b981" : "#64748b", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s", flexShrink: 0 }}>{copied ? "\u2713" : "\ud83d\udccb"}</button>
            </div>;
          })()}
          {/* Drop method toggles */}
          {drops.length > 0 && <div style={{ ...BACKDROP, padding: "8px 12px" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {drops.map((drop, di) => {
                const pd = party.drops?.find(d => d.itemName === drop.name) || { method: null };
                const did = pd.id || `d${di}`;
                return <div key={di} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 6, background: "rgba(255,255,255,.02)", border: "1px solid rgba(30,36,64,.3)" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, fontFamily: "'Fredoka',sans-serif" }}>{drop.name}</span>
                  {isLead && <div style={{ display: "flex", gap: 3 }}>
                    {["blink", "priority"].map(mt => (
                      <button key={mt} onClick={() => updateDrop(did, "method", pd.method === mt ? null : mt)}
                        style={{ ...S.btnGhost, fontSize: 9, padding: "2px 8px", ...(pd.method === mt ? S.btnActive : {}) }}>
                        {mt === "blink" ? "Blink" : "Prio"}
                      </button>
                    ))}
                  </div>}
                  {!isLead && pd.method && <span style={{ fontSize: 9, color: "#64748b", fontFamily: "'Comfortaa',sans-serif" }}>{pd.method === "blink" ? "Blink" : "Priority"}</span>}
                </div>;
              })}
            </div>
          </div>}
          {/* Party header */}
          <div style={{ ...BACKDROP, padding: "8px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", fontFamily: "'Comfortaa',sans-serif", textTransform: "uppercase", letterSpacing: ".05em" }}>Party ({party.members?.length}/{maxP})</span>
            {isLead && <button onClick={() => setEditMembers(!editMembers)} style={{ fontSize: 10, padding: "3px 10px", borderRadius: 5, border: `1px solid ${editMembers ? ACCENT_BORDER : "#1e2440"}`, cursor: "pointer", fontWeight: 600, fontFamily: "'Comfortaa',sans-serif", background: editMembers ? ACCENT_LIGHT : "rgba(255,255,255,.03)", color: editMembers ? ACCENT : "#64748b" }}>{editMembers ? "\u2713 Done" : "\u270e Edit Members"}</button>}
          </div>
          {/* Member cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: expandSchedule ? 6 : 10, transition: "gap .25s ease" }}>
            {party.members?.map((m, i) => {
              const isMe = m.userId === currentUser?.id;
              const myChars = currentUser?.characters || [];
              const memberUser = allUsers.find(u => u.id === m.userId) || allUsers.find(u => u.username?.toLowerCase() === m.userId?.toLowerCase());
              const memberChars = memberUser?.characters || [];
              const canEditSelf = isMe && myChars.length > 1;
              const canEditAsLead = isLead && editMembers && !isMe;
              const availChars = isMe ? myChars : memberChars;
              const charOptions = [...new Set([...availChars, m.charName])];
              const showDropdown = canEditSelf || (canEditAsLead && charOptions.length >= 1);
              const sz = expandSchedule; // compact mode
              const switchChar = (newName) => {
                const oldName = m.charName;
                if (newName === oldName) return;
                const bossKey = boss?.bossName + "|" + boss?.difficulty;
                const otherParty = Object.values(allParties).find(op =>
                  op.id !== party.id && !op.skipped &&
                  op.bosses?.some(b => b.bossName + "|" + b.difficulty === bossKey) &&
                  op.members?.some(om => om.charName?.toLowerCase() === newName.toLowerCase())
                );
                if (otherParty) {
                  setCharConflict({ newName, oldName, otherParty, memberIdx: i });
                } else {
                  onUpdate({ ...party, members: party.members.map((mm, j) => j === i ? { ...mm, charName: newName } : mm) });
                }
              };
              const avatarSz = expandSchedule ? 40 : 64;
              const nameSz = expandSchedule ? 10 : 13;
              return (
                <div key={i} style={{ padding: expandSchedule ? "8px 6px 6px" : "14px 12px 10px", borderRadius: expandSchedule ? 8 : 12, background: "rgba(11,14,26,.9)", border: "1px solid rgba(30,36,64,.4)", display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
                  {editMembers && isLead && i !== 0 && (
                    <div style={{ position: "absolute", top: 4, right: 4, display: "flex", gap: 2 }}>
                      <button onClick={() => passLead(i)} title="Make lead" style={{ width: 16, height: 16, borderRadius: 3, border: "none", cursor: "pointer", background: "rgba(37,99,235,.15)", color: ACCENT, fontSize: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>👑</button>
                      <button onClick={() => removeMember(i)} title="Remove" style={{ width: 16, height: 16, borderRadius: 3, border: "none", cursor: "pointer", background: "rgba(239,68,68,.15)", color: "#f87171", fontSize: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 4, marginBottom: 3, minHeight: 14 }}>
                    {i === 0 && <span style={{ ...S.leadBadge, fontSize: 7, padding: "1px 5px" }}>LEAD</span>}
                    {m.isTemp && <span style={{ ...S.tempBadge, fontSize: 7 }}>TEMP</span>}
                    {isMe && <span style={{ fontSize: 7, padding: "1px 5px", borderRadius: 3, background: "rgba(37,99,235,.1)", color: ACCENT }}>YOU</span>}
                  </div>
                  <CharAvatar name={m.charName} size={avatarSz} />
                  <div style={{ width: "100%", textAlign: "center", marginTop: 4 }}>
                    {showDropdown ? (
                      <select value={m.charName} onChange={e => switchChar(e.target.value)} style={{ ...S.select, fontSize: nameSz, padding: "2px 4px", paddingRight: 16, width: "100%", backgroundPosition: "right 3px center", borderRadius: 5, textAlign: "center", fontWeight: 700 }}>
                        {charOptions.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <div style={{ fontSize: nameSz, fontWeight: 700, color: "#e2e8f0", fontFamily: "'Comfortaa',sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.charName}</div>
                    )}
                  </div>
                  <CharJobLevel name={m.charName} />
                  <div style={{ width: "100%", marginTop: expandSchedule ? 4 : 6 }}>
                    {drops.map((drop, di) => {
                      const pd = party.drops?.find(d => d.itemName === drop.name) || { method: null, eligible: [], priority: [] };
                      const did = pd.id || `d${di}`;
                      const isE = pd.eligible?.includes(m.userId);
                      const pp = pd.priority?.indexOf(m.userId);
                      const hasPrio = pp != null && pp >= 0;
                      if (!pd.method) return null;
                      return (
                        <div key={di} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: expandSchedule ? "2px 4px" : "4px 6px", borderTop: "1px solid rgba(30,36,64,.3)", marginTop: 2 }}>
                          <span style={{ fontSize: expandSchedule ? 8 : 10, color: "#64748b", fontFamily: "'Comfortaa',sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{DROP_ABBR[drop.name] || drop.name}</span>
                          {pd.method === "blink" && <button onClick={() => isLead && toggleEligible(did, m.userId)} style={{ padding: expandSchedule ? "1px 5px" : "2px 8px", borderRadius: 4, border: "none", cursor: isLead ? "pointer" : "default", background: isE ? "rgba(34,197,94,.3)" : "rgba(239,68,68,.12)", color: isE ? "#10b981" : "#f87171", fontSize: expandSchedule ? 8 : 10, fontWeight: 700, fontFamily: "'Comfortaa',sans-serif" }}>{isE ? "✓" : "✕"}</button>}
                          {pd.method === "priority" && (isLead ? (
                            <select value={hasPrio ? pp + 1 : ""} onChange={e => setPrioFn(did, m.userId, parseInt(e.target.value) || 0)} style={{ ...S.select, fontSize: expandSchedule ? 9 : 11, padding: "2px 4px", paddingRight: 4, width: expandSchedule ? 28 : 36, backgroundImage: "none", textAlign: "center", fontWeight: 700, color: hasPrio ? "#fff" : "#475569", background: hasPrio ? ACCENT : "rgba(11,14,26,.6)", borderColor: hasPrio ? ACCENT : "#1e2440", borderRadius: 4, appearance: "none", WebkitAppearance: "none" }}>
                              <option value="">—</option>{party.members.map((_, pi) => <option key={pi} value={pi + 1}>{pi + 1}</option>)}
                            </select>
                          ) : (
                            <span style={{ fontSize: expandSchedule ? 8 : 10, fontWeight: 700, color: hasPrio ? "#fff" : "#374151", padding: "2px 6px", borderRadius: 4, background: hasPrio ? ACCENT : "transparent" }}>{hasPrio ? `#${pp + 1}` : "—"}</span>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {editMembers && isLead && party.members.length < maxP && (
            <div style={{ ...BACKDROP, padding: 12 }}>
              <div style={{ fontSize: 10, color: "#64748b", fontFamily: "'Comfortaa',sans-serif", marginBottom: 6 }}>Add by Discord username</div>
              <div style={{ display: "flex", gap: 4 }}>
                <input ref={addRef} style={{ ...S.input, fontSize: 11, padding: "5px 8px", flex: 1 }} placeholder="Discord username..." value={addDiscord} onChange={e => setAddDiscord(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && addDiscord.trim()) addMemberByDiscord(); }} />
                <button onClick={() => addDiscord.trim() && addMemberByDiscord()} style={{ padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", background: ACCENT_LIGHT, color: ACCENT, fontSize: 10, fontWeight: 700, fontFamily: "'Comfortaa',sans-serif", whiteSpace: "nowrap" }}>＋</button>
              </div>
              <button onClick={() => setIgnPopup({ type: "temp" })} style={{ marginTop: 6, width: "100%", padding: "5px 0", borderRadius: 5, border: "1px dashed rgba(251,191,36,.3)", background: "rgba(251,191,36,.04)", color: "#fbbf24", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "'Comfortaa',sans-serif" }}>+ Add Temp</button>
            </div>
          )}
        </div>

        {/* RIGHT — Schedule (always visible) */}
        <div style={{ flex: expandSchedule ? 2 : 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8, transition: "flex .25s ease" }}>
          <div style={{ ...BACKDROP, padding: "8px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b", fontFamily: "'Comfortaa',sans-serif", textTransform: "uppercase", letterSpacing: ".05em" }}>Schedules</span>
              <button onClick={() => setExpandSchedule(!expandSchedule)} style={{ fontSize: 9, padding: "3px 8px", borderRadius: 5, border: `1px solid ${expandSchedule ? ACCENT_BORDER : "#1e2440"}`, cursor: "pointer", fontWeight: 600, fontFamily: "'Comfortaa',sans-serif", background: expandSchedule ? ACCENT_LIGHT : "rgba(255,255,255,.03)", color: expandSchedule ? ACCENT : "#64748b" }}>{expandSchedule ? "\u25c0 Collapse" : "Expand \u25b6"}</button>
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {(party.members || []).map(m => {
                const on = schedMembers[m.userId];
                return <button key={m.userId} onClick={() => toggleSchedMember(m.userId)}
                  style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, border: `1px solid ${on ? "rgba(34,197,94,.3)" : "#1e2440"}`, cursor: "pointer", fontWeight: 600, fontFamily: "'Comfortaa',sans-serif", background: on ? "rgba(34,197,94,.1)" : "rgba(255,255,255,.02)", color: on ? "#10b981" : "#475569" }}>
                  {on ? "\u2713" : ""} {m.charName}
                </button>;
              })}
            </div>
          </div>
          <div style={{ ...BACKDROP, padding: 10, ...(settingTime ? { border: "1px solid rgba(239,68,68,.4)", background: "rgba(239,68,68,.06)", boxShadow: "inset 0 0 30px rgba(239,68,68,.08)" } : {}) }}>
            {settingTime && <div style={{ fontSize: 11, color: "#f87171", fontFamily: "'Comfortaa',sans-serif", fontWeight: 600, marginBottom: 6 }}>🔴 Editing — Click a time slot{timeAnchor ? ` \u2014 ${slotToTime(timeAnchor.slot)} ${DAYS_SHORT[timeAnchor.day]}` : ""}</div>}
            <div ref={gridRef} style={{ position: "relative", userSelect: "none", cursor: settingTime ? "pointer" : "default", overflow: "auto", maxHeight: "calc(100vh - 240px)" }}
              onClick={onGridClick} onMouseMove={e => { onGridMove(e); setHoverCellPos(smartTip(e, 120)); }} onMouseLeave={() => { setTimeHover(null); setHoverTime(null); setHoverCell(null); setHoverCellPos(null); }}>
              <div style={{ display: "flex", height: 28, position: "sticky", top: 0, zIndex: 12, background: "rgba(11,14,26,.98)" }}>
                <div style={{ width: 36, flexShrink: 0 }} />
                {DAY_ORDER.map(di => (
                  <div key={di} style={{ flex: 1, textAlign: "center", fontSize: 9, fontWeight: 700, color: "#94a3b8", fontFamily: "'Comfortaa',sans-serif", lineHeight: "28px", borderBottom: "1px solid rgba(30,36,64,.6)" }}>{DAYS_SHORT[di]}</div>
                ))}
              </div>
              <div style={{ display: "flex", height: 48 * 20, position: "relative" }}>
                <div style={{ width: 36, flexShrink: 0, position: "relative" }}>
                  {Array.from({ length: 48 }, (_, si) => {
                    if (si % 2 !== 0) return null;
                    const h = Math.floor(si / 2);
                    return <div key={si} style={{ position: "absolute", top: si * 20, right: 3, fontSize: 7, color: "#475569", lineHeight: 1, fontFamily: "'Comfortaa',sans-serif" }}>
                      {h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`}
                    </div>;
                  })}
                </div>
                {DAY_ORDER.map(di => (
                  <div key={di} style={{ flex: 1, position: "relative", borderLeft: "1px solid rgba(255,255,255,.06)" }}>
                    {Array.from({ length: 48 }, (_, si) => {
                      const info = getCellInfoFiltered(di, si);
                      const isSch = partySlots.has(`${di}-${si}`);
                      const isPr = timePrev.has(`${di}-${si}`);
                      const isHov = settingTime && hoverTime && hoverTime.day === di && hoverTime.slot === si;
                      let bg = "rgba(20,24,41,.8)";
                      if (isSch) bg = "rgba(37,99,235,.5)";
                      else if (isPr) bg = "rgba(37,99,235,.35)";
                      else if (isHov) bg = "rgba(37,99,235,.2)";
                      else if (info.bc > 0) bg = "rgba(251,146,36,.35)";
                      else if (info.ac === info.tot && info.tot > 0) bg = "rgba(34,197,94,.35)";
                      else if (info.ac > 0) bg = "rgba(251,191,36,.18)";
                      else bg = "rgba(239,68,68,.22)";
                      const isHour = si % 2 === 0 && si > 0;
                      return <div key={si} style={{ position: "absolute", top: si * 20, left: 0, right: 0, height: 20, background: bg, borderTop: isHour ? "1px dashed rgba(255,255,255,.12)" : "none" }} />;
                    })}
                  </div>
                ))}
                <div style={{ position: "absolute", left: 36, right: 0, top: RESET_SLOT * 20, height: 0, borderTop: "2px dashed rgba(239,68,68,.5)", pointerEvents: "none", zIndex: 5 }}>
                  <span style={{ position: "absolute", right: 4, top: -11, fontSize: 7, color: "#f87171", fontWeight: 600, background: "rgba(11,14,26,.8)", padding: "1px 3px", borderRadius: 2, whiteSpace: "nowrap" }}>0:00 UTC</span>
                </div>
              </div>
            </div>
            {/* Color legend */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6, padding: "4px 0" }}>
              {[
                { bg: "rgba(34,197,94,.35)", label: "All available" },
                { bg: "rgba(251,191,36,.18)", label: "Some available" },
                { bg: "rgba(239,68,68,.22)", label: "None available" },
                { bg: "rgba(251,146,36,.35)", label: "Conflict" },
                { bg: "rgba(37,99,235,.5)", label: "Scheduled" },
              ].map(({ bg, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: bg, border: "1px solid rgba(255,255,255,.1)" }} />
                  <span style={{ fontSize: 8, color: "#64748b", fontFamily: "'Comfortaa',sans-serif" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly date picker popup */}
      {monthlyDatePick && (() => {
        const targetJsDay = (monthlyDatePick.day + 1) % 7; // 0=Mon..6=Sun → JS 0=Sun..6=Sat
        const dates = [];
        const now = new Date();
        const curMonth = now.getMonth();
        const curYear = now.getFullYear();
        // Generate matching weekday dates for this month and next
        for (let mo = curMonth; mo <= curMonth + 1; mo++) {
          const realMo = mo % 12;
          const realYr = mo > 11 ? curYear + 1 : curYear;
          const daysInMonth = new Date(realYr, realMo + 1, 0).getDate();
          for (let d = 1; d <= daysInMonth; d++) {
            const dt = new Date(realYr, realMo, d);
            if (dt.getDay() === targetJsDay) {
              // Only show dates from today onward
              const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              if (dt >= todayStart) {
                dates.push(dt);
              }
            }
          }
        }
        const dayName = DAYS[monthlyDatePick.day];
        const fmtTime = (h, m) => { const hr = h % 12 || 12; return `${hr}:${String(m).padStart(2, "0")}${h < 12 ? "a" : "p"}`; };
        return <div style={S.popOverlay} onClick={() => setMonthlyDatePick(null)}>
          <div style={S.popBox} onClick={e => e.stopPropagation()}>
            <div style={S.popHead}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0", fontFamily: "'Fredoka',sans-serif" }}>Select Date</span>
              <button style={S.closeBtn} onClick={() => setMonthlyDatePick(null)}>✕</button>
            </div>
            <div style={{ padding: "12px 18px" }}>
              <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'Comfortaa',sans-serif", marginBottom: 10 }}>
                {dayName}s at {fmtTime(monthlyDatePick.hour, monthlyDatePick.min)} · {monthlyDatePick.duration}m
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {dates.map(dt => {
                  const dateStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
                  const label = dt.toLocaleDateString("en-US", { month: "long", day: "numeric" });
                  const isToday = dt.toDateString() === now.toDateString();
                  return <button key={dateStr} onClick={() => {
                    onUpdate({ ...party, utcDay: monthlyDatePick.day, utcHour: monthlyDatePick.hour, utcMin: monthlyDatePick.min, duration: monthlyDatePick.duration, scheduledDate: dateStr });
                    setMonthlyDatePick(null);
                  }} style={{
                    padding: "8px 14px", borderRadius: 6, border: `1px solid ${isToday ? "rgba(139,92,246,.4)" : "#1e2440"}`,
                    background: isToday ? "rgba(139,92,246,.12)" : "rgba(255,255,255,.03)", cursor: "pointer",
                    color: "#e2e8f0", fontSize: 13, fontWeight: 600, fontFamily: "'Comfortaa',sans-serif",
                    textAlign: "left", display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <span>{label}</span>
                    {isToday && <span style={{ fontSize: 9, color: "#a78bfa", fontWeight: 700 }}>Today</span>}
                  </button>;
                })}
              </div>
            </div>
          </div>
        </div>;
      })()}

      {ignPopup && <IGNPopup title="Temp Character Name" hint="Name for temp slot." onConfirm={ign => addTemp(ign)} onClose={() => setIgnPopup(null)} />}
      {/* Character conflict dialog */}
      {charConflict && <div style={S.overlay} onClick={() => setCharConflict(null)}><div style={{ ...S.modal, width: "min(420px,90vw)" }} onClick={e => e.stopPropagation()}>
        <div style={S.modalHead}><span style={S.modalTitle}>Character Conflict</span><button style={S.closeBtn} onClick={() => setCharConflict(null)}>✕</button></div>
        <div style={S.modalBody}>
          <div style={{ fontSize: 12, color: "#e2e8f0", fontFamily: "'Comfortaa',sans-serif", marginBottom: 16, lineHeight: 1.6 }}>
            <strong>{charConflict.newName}</strong> is already in another <strong>{boss?.bossName}</strong> party.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={() => {
              const { newName, oldName, otherParty, memberIdx } = charConflict;
              const updatedOther = { ...otherParty, members: otherParty.members.map(om =>
                om.charName?.toLowerCase() === newName.toLowerCase() ? { ...om, charName: oldName } : om
              )};
              const updatedThis = { ...party, members: party.members.map((mm, j) => j === memberIdx ? { ...mm, charName: newName } : mm) };
              onBatchUpdate([updatedThis, updatedOther]);
              setCharConflict(null);
            }} style={{ ...S.btnPrimary, width: "100%", padding: "10px 16px", fontSize: 12 }}>
              Swap — move {charConflict.oldName} to the other party
            </button>
            <button onClick={() => {
              const { newName, otherParty, memberIdx } = charConflict;
              const updatedThis = { ...party, members: party.members.map((mm, j) => j === memberIdx ? { ...mm, charName: newName } : mm) };
              // Remove newName from other party
              const updatedOther = { ...otherParty, members: otherParty.members.filter(om => om.charName?.toLowerCase() !== newName.toLowerCase()) };
              onBatchUpdate([updatedThis, updatedOther]);
              setCharConflict(null);
            }} style={{ ...S.btnGhost, width: "100%", padding: "10px 16px", fontSize: 12, color: "#f59e0b", borderColor: "rgba(245,158,11,.3)" }}>
              Remove {charConflict.newName} from the other party
            </button>
            <button onClick={() => setCharConflict(null)} style={{ ...S.btnGhost, width: "100%", padding: "10px 16px", fontSize: 12 }}>
              Cancel — don't make any changes
            </button>
          </div>
        </div>
      </div></div>}
      {hoverCell && hoverCellPos && (() => {
        const info = getCellInfoFiltered(hoverCell.day, hoverCell.slot);
        if (info.ac === info.tot && info.bc === 0) return null;
        return <div style={{ position: "fixed", zIndex: 200, pointerEvents: "none", ...hoverCellPos }}>
          <div style={{ background: "rgba(11,14,26,.97)", border: "1px solid rgba(30,36,64,.8)", borderRadius: 8, padding: "8px 10px", boxShadow: "0 8px 24px rgba(0,0,0,.5)", minWidth: 140, maxWidth: 220 }}>
            <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'Comfortaa',sans-serif", marginBottom: 4 }}>{DAYS_SHORT[hoverCell.day]} {slotToTime(hoverCell.slot)}</div>
            {info.unavail.length > 0 && <div style={{ marginBottom: 3 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#f87171", fontFamily: "'Comfortaa',sans-serif" }}>Unavailable: </span>
              <span style={{ fontSize: 9, color: "#e2e8f0", fontFamily: "'Comfortaa',sans-serif" }}>{info.unavail.join(", ")}</span>
            </div>}
            {info.conflicts.length > 0 && <div>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#fb923c", fontFamily: "'Comfortaa',sans-serif" }}>Conflict: </span>
              <span style={{ fontSize: 9, color: "#e2e8f0", fontFamily: "'Comfortaa',sans-serif" }}>{info.conflicts.map(c => `${c.name} (${c.boss})`).join(", ")}</span>
            </div>}
            {info.ac > 0 && info.ac < info.tot && <div style={{ fontSize: 9, color: "#64748b", fontFamily: "'Comfortaa',sans-serif", marginTop: 2 }}>{info.ac}/{info.tot} available</div>}
          </div>
        </div>;
      })()}
    </div>
  );
}

/* ═══ PROFILE MODAL ═══ */
function ProfileModal({ user, onClose, onSave }) {
  const [tz, setTz] = useState(user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [chars, setChars] = useState(user.characters || []);
  const [newChar, setNewChar] = useState("");
  const [avail, setAvail] = useState(user.availability || {});
  const [deletedChars, setDeletedChars] = useState([]);
  const [notifEnabled, setNotifEnabled] = useState(user.notifications?.enabled || false);
  const [notifTimings, setNotifTimings] = useState(user.notifications?.timings || [15, 0]);
  const [notifSolos, setNotifSolos] = useState(user.notifications?.solos || false);
  const [dailyEnabled, setDailyEnabled] = useState(user.notifications?.daily?.enabled || false);
  const [dailyTime, setDailyTime] = useState(user.notifications?.daily?.time || "08:00");
  const [anchor, setAnchor] = useState(null);
  const [hover, setHover] = useState(null);
  const [mode, setMode] = useState(null);
  const [saving, setSaving] = useState(false);
  const gridRef = useRef(null);
  const saveTimer = useRef(null);

  // Auto-save with debounce
  const doSave = useCallback((data) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(() => { onSave(data); setSaving(false); }, 400);
  }, [onSave]);
  useEffect(() => { doSave({ timezone: tz, characters: chars, availability: avail, notifications: { enabled: notifEnabled, timings: notifTimings, solos: notifSolos, daily: { enabled: dailyEnabled, time: dailyTime } } }); }, [tz, chars, avail, notifEnabled, notifTimings, notifSolos, dailyEnabled, dailyTime]);

  const addChar = () => { const n = newChar.trim(); if (n && !chars.includes(n)) { setChars(p => [...p, n]); setNewChar(""); } };
  const rmChar = i => {
    const removed = chars[i];
    setDeletedChars(prev => [...prev, { name: removed, deletedAt: Date.now() }]);
    setChars(p => p.filter((_, j) => j !== i));
  };
  const restoreChar = (name) => {
    setDeletedChars(prev => prev.filter(d => d.name !== name));
    setChars(p => p.includes(name) ? p : [...p, name]);
  };
  const permDeleteChar = (name) => setDeletedChars(prev => prev.filter(d => d.name !== name));
  const getSlot = (e) => {
    if (!gridRef.current) return null;
    const r = gridRef.current.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top + gridRef.current.scrollTop;
    const col = Math.floor((x - 40) / ((r.width - 40) / 7));
    const s = Math.floor((y - 28) / 18);
    if (col < 0 || col > 6 || s < 0 || s > 47) return null;
    return { day: DAY_ORDER[col], slot: s };
  };
  const getPreview = () => { if (!anchor || !hover || anchor.day !== hover.day) return new Set(); const s = new Set(); for (let i = Math.min(anchor.slot, hover.slot); i <= Math.max(anchor.slot, hover.slot); i++) s.add(`${anchor.day}-${i}`); return s; };
  const onClick = (e) => { e.preventDefault(); const pos = getSlot(e); if (!pos) return; if (!anchor) { const k = `${pos.day}-${pos.slot}`; setAnchor(pos); setMode(avail[k] === "available" ? "deselect" : "select"); } else { if (pos.day === anchor.day) { const mn = Math.min(anchor.slot, pos.slot), mx = Math.max(anchor.slot, pos.slot); setAvail(p => { const c = { ...p }; for (let s = mn; s <= mx; s++) { const k = `${pos.day}-${s}`; if (mode === "select") c[k] = "available"; else delete c[k]; } return c; }); } setAnchor(null); setHover(null); setMode(null); } };
  useEffect(() => { const h = e => { if (e.key === "Escape") { setAnchor(null); setHover(null); setMode(null); } }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, []);
  const preview = getPreview();

  return (
    <div style={S.overlay} onClick={onClose}><div style={{ ...S.modal, width: "min(820px,95vw)" }} onClick={e => e.stopPropagation()}>
      <div style={S.modalHead}>
        <span style={S.modalTitle}>Profile Settings</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {saving && <span style={{ fontSize: 10, color: "#64748b", fontFamily: "'Comfortaa',sans-serif" }}>Saving...</span>}
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>
      </div>
      <div style={S.modalBody}>
        <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
          <div style={{ flex: 1 }}><label style={S.label}>Discord</label><div style={{ ...S.input, background: "rgba(11,14,26,.3)", color: "#64748b" }}>{user.username}</div></div>
          <div style={{ flex: 1 }}><label style={S.label}>Timezone</label><select style={{ ...S.select, width: "100%" }} value={tz} onChange={e => setTz(e.target.value)}>{TIMEZONES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}</select></div>
        </div>
        <div style={{ marginBottom: 20 }}><label style={S.label}>Your Characters (IGNs)</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}><input style={S.input} placeholder="Add character IGN..." value={newChar} onChange={e => setNewChar(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addChar(); } }} /><button style={{ ...S.btnPrimary, whiteSpace: "nowrap", opacity: newChar.trim() ? 1 : .4 }} onClick={addChar}>＋ Add</button></div>
          {chars.length > 0 ? <div style={{ display: "flex", flexDirection: "column", gap: 0, border: "1px solid rgba(30,36,64,.5)", borderRadius: 8, overflow: "hidden" }}>
            {chars.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: i % 2 === 0 ? "rgba(11,14,26,.3)" : "rgba(11,14,26,.15)", borderBottom: i < chars.length - 1 ? "1px solid rgba(30,36,64,.3)" : "none" }}>
                <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'Comfortaa',sans-serif", width: 18, textAlign: "center", flexShrink: 0 }}>{i + 1}</span>
                <CharAvatar name={c} size={24} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#e2e8f0", fontFamily: "'Comfortaa',sans-serif" }}>{c}</span>
                <CharJobLevel name={c} />
                <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                  <button onClick={() => { if (i > 0) setChars(p => { const a = [...p]; [a[i-1], a[i]] = [a[i], a[i-1]]; return a; }); }} disabled={i === 0}
                    style={{ width: 20, height: 20, borderRadius: 4, border: "1px solid rgba(30,36,64,.6)", background: "rgba(11,14,26,.4)", color: i === 0 ? "#1e2440" : "#94a3b8", cursor: i === 0 ? "default" : "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>{"\u25b2"}</button>
                  <button onClick={() => { if (i < chars.length - 1) setChars(p => { const a = [...p]; [a[i], a[i+1]] = [a[i+1], a[i]]; return a; }); }} disabled={i === chars.length - 1}
                    style={{ width: 20, height: 20, borderRadius: 4, border: "1px solid rgba(30,36,64,.6)", background: "rgba(11,14,26,.4)", color: i === chars.length - 1 ? "#1e2440" : "#94a3b8", cursor: i === chars.length - 1 ? "default" : "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>{"\u25bc"}</button>
                </div>
                <button onClick={() => rmChar(i)} style={{ width: 20, height: 20, borderRadius: 4, border: "none", cursor: "pointer", background: "rgba(239,68,68,.15)", color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, flexShrink: 0 }}>{"\u2715"}</button>
              </div>
            ))}
          </div> : <div style={{ fontSize: 13, color: "#475569" }}>No characters added yet.</div>}
          {deletedChars.length > 0 && <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 8, border: "1px dashed rgba(239,68,68,.2)", background: "rgba(239,68,68,.03)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", fontFamily: "'Fredoka',sans-serif", marginBottom: 6 }}>Recently Deleted</div>
            {deletedChars.map(d => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                <CharAvatar name={d.name} size={20} />
                <span style={{ flex: 1, fontSize: 12, color: "#94a3b8", fontFamily: "'Comfortaa',sans-serif", textDecoration: "line-through" }}>{d.name}</span>
                <button onClick={() => restoreChar(d.name)} style={{ padding: "2px 10px", borderRadius: 5, border: "none", cursor: "pointer", background: "rgba(34,197,94,.15)", color: "#10b981", fontSize: 10, fontWeight: 700, fontFamily: "'Comfortaa',sans-serif" }}>Restore</button>
                <button onClick={() => permDeleteChar(d.name)} style={{ padding: "2px 6px", borderRadius: 5, border: "none", cursor: "pointer", background: "rgba(239,68,68,.1)", color: "#f87171", fontSize: 10 }}>{"\u2715"}</button>
              </div>
            ))}
          </div>}
        </div>
        <label style={S.label}>Availability</label>
        <div ref={gridRef} style={{ position: "relative", userSelect: "none", cursor: anchor ? "pointer" : "crosshair", background: "rgba(11,14,26,.4)", borderRadius: 8, border: "1px solid #1e2440", overflow: "auto", maxHeight: 500 }}
          onClick={onClick} onMouseMove={e => setHover(getSlot(e))} onMouseLeave={() => setHover(null)}>
          {/* Day headers */}
          <div style={{ display: "flex", height: 28, position: "sticky", top: 0, zIndex: 4, background: "rgba(11,14,26,.98)" }}>
            <div style={{ width: 40, flexShrink: 0 }} />
            {DAY_ORDER.map(di => (
              <div key={di} style={{ flex: 1, textAlign: "center", fontSize: 10, fontWeight: 700, color: "#64748b", fontFamily: "'Comfortaa',sans-serif", lineHeight: "28px", borderBottom: "1px solid rgba(30,36,64,.4)" }}>{DAYS_SHORT[di]}</div>
            ))}
          </div>
          <div style={{ display: "flex", height: 48 * 18, position: "relative" }}>
            {/* Time labels */}
            <div style={{ width: 40, flexShrink: 0, position: "relative" }}>
              {Array.from({ length: 48 }, (_, si) => {
                if (si % 2 !== 0) return null;
                const h = Math.floor(si / 2);
                return <div key={si} style={{ position: "absolute", top: si * 18, right: 4, fontSize: 8, color: "#475569", lineHeight: 1, fontFamily: "'Comfortaa',sans-serif" }}>
                  {h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`}
                </div>;
              })}
            </div>
            {/* Day columns */}
            {DAY_ORDER.map(di => (
              <div key={di} style={{ flex: 1, position: "relative", borderLeft: "1px solid rgba(255,255,255,.06)" }}>
                {Array.from({ length: 48 }, (_, si) => {
                  const k = `${di}-${si}`; const v = avail[k]; const ip = preview.has(k); const ia = anchor && anchor.day === di && anchor.slot === si;
                  const isHour = si % 2 === 0 && si > 0;
                  return <div key={si} style={{
                    position: "absolute", top: si * 18, left: 0, right: 0, height: 18,
                    background: v === "available" ? (ip && mode === "deselect" ? "rgba(239,68,68,.25)" : "rgba(34,197,94,.4)") : ip && mode === "select" ? "rgba(34,197,94,.2)" : ia ? (mode === "deselect" ? "rgba(239,68,68,.3)" : "rgba(34,197,94,.3)") : "transparent",
                    borderTop: isHour ? "1px dashed rgba(255,255,255,.08)" : "none",
                    transition: "background .08s",
                  }} />;
                })}
              </div>
            ))}
            {/* Reset line */}
            <div style={{ position: "absolute", left: 40, right: 0, top: RESET_SLOT * 18, height: 0, borderTop: "2px dashed rgba(239,68,68,.6)", pointerEvents: "none", zIndex: 3 }}>
              <span style={{ position: "absolute", right: 4, top: -12, fontSize: 8, color: "#f87171", fontWeight: 600, background: "rgba(11,14,26,.8)", padding: "1px 3px", borderRadius: 3, fontFamily: "'Comfortaa',sans-serif", whiteSpace: "nowrap" }}>0:00 UTC</span>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div style={{ marginTop: 20 }}>
          <label style={S.label}>DM Notifications</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <button onClick={() => setNotifEnabled(!notifEnabled)}
              style={{ padding: "6px 16px", borderRadius: 8, border: `1px solid ${notifEnabled ? "rgba(34,197,94,.4)" : "#1e2440"}`, cursor: "pointer", fontWeight: 700, fontFamily: "'Comfortaa',sans-serif", fontSize: 12, background: notifEnabled ? "rgba(34,197,94,.15)" : "rgba(255,255,255,.03)", color: notifEnabled ? "#10b981" : "#64748b" }}>
              {notifEnabled ? "✓ Enabled" : "Disabled"}
            </button>
          </div>

          {/* All sub-settings greyed out when disabled */}
          <div style={{ opacity: notifEnabled ? 1 : .35, pointerEvents: notifEnabled ? "auto" : "none", transition: "opacity .2s" }}>
            {/* Party Boss Reminders */}
            <div style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(30,36,64,.3)", background: "rgba(11,14,26,.3)", marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", fontFamily: "'Comfortaa',sans-serif", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Party Boss Reminders</div>
              <span style={{ fontSize: 9, color: "#475569", fontFamily: "'Comfortaa',sans-serif", display: "block", marginBottom: 8 }}>Discord notification before Party Bossing</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {[{ label: "1 hour", mins: 60 }, { label: "30 min", mins: 30 }, { label: "15 min", mins: 15 }, { label: "10 min", mins: 10 }, { label: "5 min", mins: 5 }, { label: "At start", mins: 0 }].map(opt => {
                  const active = notifTimings.includes(opt.mins);
                  return <button key={opt.mins} onClick={() => setNotifTimings(prev => active ? prev.filter(t => t !== opt.mins) : [...prev, opt.mins])}
                    style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${active ? "rgba(37,99,235,.4)" : "#1e2440"}`, cursor: "pointer", fontWeight: 600, fontFamily: "'Comfortaa',sans-serif", fontSize: 11, background: active ? "rgba(37,99,235,.15)" : "rgba(255,255,255,.03)", color: active ? ACCENT : "#64748b" }}>
                    {opt.label}
                  </button>;
                })}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input type="number" min="1" max="120" placeholder="min" style={{ ...S.input, width: 52, fontSize: 11, padding: "5px 6px", textAlign: "center" }}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        const v = parseInt(e.target.value);
                        if (v > 0 && v <= 120 && !notifTimings.includes(v)) { setNotifTimings(prev => [...prev, v]); e.target.value = ""; }
                      }
                    }} />
                  <span style={{ fontSize: 9, color: "#475569", fontFamily: "'Comfortaa',sans-serif" }}>+ custom</span>
                </div>
              </div>
              {notifTimings.filter(t => ![60, 30, 15, 10, 5, 0].includes(t)).length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                  {notifTimings.filter(t => ![60, 30, 15, 10, 5, 0].includes(t)).sort((a, b) => b - a).map(t => (
                    <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 5, background: "rgba(37,99,235,.15)", border: "1px solid rgba(37,99,235,.3)", fontSize: 10, color: ACCENT, fontWeight: 600, fontFamily: "'Comfortaa',sans-serif" }}>
                      {t}m
                      <button onClick={() => setNotifTimings(prev => prev.filter(x => x !== t))} style={{ background: "none", border: "none", cursor: "pointer", color: "#f87171", fontSize: 10, padding: 0, lineHeight: 1 }}>{"\u2715"}</button>
                    </span>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                <button onClick={() => setNotifSolos(!notifSolos)}
                  style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${notifSolos ? "rgba(34,197,94,.4)" : "#1e2440"}`, cursor: "pointer", fontWeight: 600, fontFamily: "'Comfortaa',sans-serif", fontSize: 11, background: notifSolos ? "rgba(34,197,94,.15)" : "rgba(255,255,255,.03)", color: notifSolos ? "#10b981" : "#64748b" }}>
                  {notifSolos ? "✓ Solo reminders" : "Solo reminders off"}
                </button>
                <span style={{ fontSize: 9, color: "#475569", fontFamily: "'Comfortaa',sans-serif" }}>Discord notification at start time for Solo Bossing</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                <button onClick={async () => {
                  try {
                    const r = await fetch("/api/me/test-notification", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" });
                    const d = await r.json();
                    if (d.success) alert("✅ Test DM sent! Check your Discord.");
                    else alert("❌ Failed: " + (d.step || "") + " " + (d.status || "") + " " + (d.body || d.error || ""));
                  } catch (e) { alert("❌ Error: " + e.message); }
                }}
                  style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(245,158,11,.3)", cursor: "pointer", fontWeight: 600, fontFamily: "'Comfortaa',sans-serif", fontSize: 11, background: "rgba(245,158,11,.1)", color: "#f59e0b" }}>
                  🧪 Test DM
                </button>
              </div>
            </div>

            {/* Daily Reminder */}
            <div style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(30,36,64,.3)", background: "rgba(11,14,26,.3)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", fontFamily: "'Comfortaa',sans-serif", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Daily Reminder</div>
              <span style={{ fontSize: 9, color: "#475569", fontFamily: "'Comfortaa',sans-serif", display: "block", marginBottom: 8 }}>Summary of upcoming bosses sent once a day</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <button onClick={() => setDailyEnabled(!dailyEnabled)}
                  style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${dailyEnabled ? "rgba(34,197,94,.4)" : "#1e2440"}`, cursor: "pointer", fontWeight: 600, fontFamily: "'Comfortaa',sans-serif", fontSize: 11, background: dailyEnabled ? "rgba(34,197,94,.15)" : "rgba(255,255,255,.03)", color: dailyEnabled ? "#10b981" : "#64748b" }}>
                  {dailyEnabled ? "✓ On" : "Off"}
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, color: "#64748b", fontFamily: "'Comfortaa',sans-serif" }}>Send at</span>
                  <input type="time" value={dailyTime} onChange={e => setDailyTime(e.target.value)}
                    style={{ ...S.input, width: 100, fontSize: 11, padding: "4px 8px", textAlign: "center", opacity: dailyEnabled ? 1 : .4 }} />
                  <span style={{ fontSize: 9, color: "#475569", fontFamily: "'Comfortaa',sans-serif" }}>your local time</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={async () => {
                  try {
                    const r = await fetch("/api/me/test-daily", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" });
                    const d = await r.json();
                    if (d.success) alert("✅ Daily summary sent! Check your Discord.");
                    else if (d.noBosses) alert("ℹ️ No bosses scheduled in the next 24 hours — no summary to send.");
                    else alert("❌ Failed: " + (d.step || "") + " " + (d.status || "") + " " + (d.body || d.error || ""));
                  } catch (e) { alert("❌ Error: " + e.message); }
                }}
                  style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(245,158,11,.3)", cursor: "pointer", fontWeight: 600, fontFamily: "'Comfortaa',sans-serif", fontSize: 11, background: "rgba(245,158,11,.1)", color: "#f59e0b" }}>
                  🧪 Test Daily
                </button>
              </div>
            </div>
          </div>
        </div>
        {/* Logout */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(30,36,64,.4)" }}>
          <a href="/auth/logout" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 16px", borderRadius: 8, border: "1px solid rgba(239,68,68,.2)", background: "rgba(239,68,68,.06)", color: "#f87171", fontSize: 12, fontWeight: 600, fontFamily: "'Comfortaa',sans-serif", textDecoration: "none", cursor: "pointer" }}>Logout</a>
        </div>
      </div>
    </div></div>
  );
}

/* ═══ SCHEDULE VIEW — drag & drop with magnetization, undo, duration ═══ */
function ScheduleView({ parties, user, onClickParty, onUpdateParty, trash, onRecover, onPermDelete, onShare, shareCopied }) {
  const partyList = Object.values(parties || {}).filter(p => !p.skipped && p.members?.some(m => m.userId === user.id || m.userId === user.username));
  const weeklyParties = partyList.filter(p => !p.isMonthly);
  const monthlyParties = partyList.filter(p => p.isMonthly);
  const avail = user.availability || {};
  const [editing, setEditing] = useState(false);
  const [showSolos, setShowSolos] = useState(user.showSolos !== false);
  const toggleSolos = () => { const next = !showSolos; setShowSolos(next); API.patch("/api/me", { showSolos: next }).catch(() => {}); };
  const [dragging, setDragging] = useState(null);
  const [dragPos, setDragPos] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [hoverParty, setHoverParty] = useState(null);
  const [hoverPos, setHoverPos] = useState(null);
  const [sidebarTab, setSidebarTab] = useState("unscheduled");
  const [monthlyDatePick, setMonthlyDatePick] = useState(null); // { party, day, hour, min, duration }
  const displayList = showSolos ? weeklyParties : weeklyParties.filter(p => (p.members?.length || 0) > 1);
  const gridRef = useRef(null);

  const SLOT_COUNT = 48;
  const LABEL_W = 50;
  const HEADER_H = 44;
  const maxGridH = typeof window !== "undefined" ? window.innerHeight - 200 : 600;
  const ROW_H = Math.max(20, Math.min(36, Math.floor(maxGridH / SLOT_COUNT)));
  const gridH = SLOT_COUNT * ROW_H;
  const [nowSlot, setNowSlot] = useState(() => { const n = new Date(); return n.getHours() * 2 + n.getMinutes() / 30; });
  const [todayDay, setTodayDay] = useState(() => (new Date().getDay() + 6) % 7); // 0=Mon..6=Sun

  useEffect(() => {
    const iv = setInterval(() => { const n = new Date(); setNowSlot(n.getHours() * 2 + n.getMinutes() / 30); setTodayDay((n.getDay() + 6) % 7); }, 15000);
    return () => clearInterval(iv);
  }, []);

  // Scroll to center current time on mount
  const scrolledRef = useRef(false);
  useEffect(() => {
    if (scrolledRef.current || !gridRef.current) return;
    const viewportH = gridRef.current.clientHeight;
    const scrollTo = nowSlot * ROW_H - viewportH / 2;
    gridRef.current.scrollTop = Math.max(0, scrollTo);
    scrolledRef.current = true;
  });

  const visRange = { start: 0, end: 48 };
  const visSlots = 48;

  const byDay = useMemo(() => {
    const m = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], unscheduled: [] };
    weeklyParties.forEach(p => { if (p.utcDay != null) (m[p.utcDay] || []).push(p); });
    displayList.forEach(p => { if (p.utcDay == null) m.unscheduled.push(p); });
    // Include monthly parties whose scheduledDate falls within the next 7 days
    monthlyParties.forEach(p => {
      if (!p.scheduledDate || p.utcDay == null) return;
      const [sY, sMo, sD] = p.scheduledDate.split("-").map(Number);
      const bossDate = new Date(sY, sMo - 1, sD);
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekEnd = new Date(todayStart); weekEnd.setDate(weekEnd.getDate() + 7);
      if (bossDate >= todayStart && bossDate < weekEnd) {
        (m[p.utcDay] || []).push(p);
      }
    });
    m.unscheduled.sort((a, b) => {
      const aSolo = (a.members?.length || 0) <= 1 ? 1 : 0;
      const bSolo = (b.members?.length || 0) <= 1 ? 1 : 0;
      return aSolo - bSolo;
    });
    for (let i = 0; i < 7; i++) m[i].sort((a, b) => (a.utcHour * 60 + a.utcMin) - (b.utcHour * 60 + b.utcMin));
    return m;
  }, [weeklyParties, displayList]);

  const getDurSlots = (p) => Math.max(0.5, (p.duration || 30) / 30);
  // getStartSlot returns fractional slots: 15min = x.5 within a slot
  const getStartSlot = (p) => p.utcHour * 2 + Math.floor(p.utcMin / 30) + ((p.utcMin % 30 >= 15) ? 0.5 : 0);
  const fmtSlot = (s) => { const h = Math.floor(s / 2); const m = (s % 2) * 30; return `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(m).padStart(2, "0")}${h < 12 ? "a" : "p"}`; };
  const fmtMin = (totalMin) => { const h = Math.floor(totalMin / 60) % 24; const m = totalMin % 60; return `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(m).padStart(2, "0")}${h < 12 ? "a" : "p"}`; };

  const getOccupied = useCallback((day, excludeId) => {
    // Returns occupied time ranges in minutes for collision detection
    const ranges = [];
    (byDay[day] || []).forEach(p => {
      if (p.id === excludeId) return;
      const startMin = p.utcHour * 60 + p.utcMin;
      const endMin = startMin + (p.duration || 30);
      ranges.push({ startMin, endMin });
    });
    return ranges;
  }, [byDay]);

  const magnetize = useCallback((day, targetMin, durMin, excludeId) => {
    const ranges = getOccupied(day, excludeId);
    const fits = (s) => {
      if (s < 0 || s + durMin > 24 * 60) return false;
      return !ranges.some(r => s < r.endMin && s + durMin > r.startMin);
    };
    // Snap to nearest 15-min boundary
    const snapped = Math.round(targetMin / 15) * 15;
    if (fits(snapped)) return snapped;
    for (let offset = 15; offset < 24 * 60; offset += 15) {
      if (fits(snapped - offset)) return snapped - offset;
      if (fits(snapped + offset)) return snapped + offset;
    }
    return null;
  }, [getOccupied]);

  const getGridSlot = (e) => {
    if (!gridRef.current) return null;
    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top + gridRef.current.scrollTop;
    const col = Math.floor((x - LABEL_W) / ((rect.width - LABEL_W) / 7));
    const slot = Math.floor((y - HEADER_H) / ROW_H);
    if (col < 0 || col > 6 || slot < 0 || slot >= SLOT_COUNT) return null;
    // Calculate minute-level position within the slot for 15-min snapping
    const yInSlot = (y - HEADER_H) - slot * ROW_H;
    const halfSlot = yInSlot > ROW_H / 2 ? 1 : 0;
    const totalMin = slot * 30 + halfSlot * 15;
    return { day: DAY_ORDER[col], slot, totalMin };
  };

  const onDragStart = (p) => (e) => { setDragging(p); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", p.id); };
  const onGridDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragPos(getGridSlot(e)); };
  const onGridDrop = (e) => {
    e.preventDefault();
    if (!dragging || !dragPos) { setDragging(null); setDragPos(null); return; }
    const durMin = dragging.duration || 30;
    const snappedMin = magnetize(dragPos.day, dragPos.totalMin, durMin, dragging.id);
    if (snappedMin != null) {
      const h = Math.floor(snappedMin / 60); const m = snappedMin % 60;
      if (dragging.isMonthly) {
        setMonthlyDatePick({ party: dragging, day: dragPos.day, hour: h, min: m, duration: durMin });
      } else {
        setUndoStack(prev => [...prev, { id: dragging.id, utcDay: dragging.utcDay, utcHour: dragging.utcHour, utcMin: dragging.utcMin }]);
        onUpdateParty({ ...dragging, utcDay: dragPos.day, utcHour: h, utcMin: m });
      }
    }
    setDragging(null); setDragPos(null);
  };
  const onGridDragLeave = () => setDragPos(null);

  const undo = () => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    const p = partyList.find(x => x.id === last.id);
    if (p) onUpdateParty({ ...p, utcDay: last.utcDay, utcHour: last.utcHour, utcMin: last.utcMin });
    setUndoStack(prev => prev.slice(0, -1));
  };

  const changeDuration = (p, delta) => {
    const cur = p.duration || 30;
    const next = Math.max(15, Math.min(120, cur + delta));
    onUpdateParty({ ...p, duration: next });
  };

  const dragPreview = useMemo(() => {
    if (!dragging || !dragPos) return null;
    const durMin = dragging.duration || 30;
    const snappedMin = magnetize(dragPos.day, dragPos.totalMin, durMin, dragging.id);
    if (snappedMin == null) return null;
    const h = Math.floor(snappedMin / 60); const m = snappedMin % 60;
    // Convert to slot-space for positioning (minutes / 30 = slots)
    const startSlot = snappedMin / 30;
    const durSlots = durMin / 30;
    return { day: dragPos.day, startSlot, durSlots, timeStr: fmtMin(snappedMin) };
  }, [dragging, dragPos, magnetize]);

  const isAvail = (d, s) => avail[`${d}-${s}`] === "available";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      {/* LEFT COLUMN */}
      <div style={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Edit controls + clock */}
        <div style={{ ...BACKDROP, padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <button onClick={() => { setEditing(!editing); if (editing) { setDragging(null); setDragPos(null); } }}
              style={{ fontSize: 12, padding: "5px 14px", borderRadius: 8, border: `1px solid ${editing ? ACCENT_BORDER : "#1e2440"}`, cursor: "pointer", fontWeight: 700, fontFamily: "'Comfortaa',sans-serif", background: editing ? ACCENT_LIGHT : "rgba(255,255,255,.04)", color: editing ? ACCENT : "#94a3b8" }}>
              {editing ? "\u2713 Done" : "\u270e Edit Schedule"}
            </button>
            {undoStack.length > 0 && <button onClick={undo} style={{ ...S.btnGhost, fontSize: 11, padding: "4px 10px", color: "#f87171", borderColor: "rgba(239,68,68,.2)" }}>{"\u21a9"} Undo</button>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={toggleSolos}
              style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: `1px solid ${showSolos ? "rgba(34,197,94,.3)" : "#1e2440"}`, cursor: "pointer", fontWeight: 600, fontFamily: "'Comfortaa',sans-serif", background: showSolos ? "rgba(34,197,94,.1)" : "rgba(255,255,255,.02)", color: showSolos ? "#10b981" : "#475569" }}>
              {showSolos ? "\ud83d\udc64 Solos" : "\ud83d\udc64 Hidden"}
            </button>
            <button onClick={onShare}
              style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: `1px solid ${shareCopied ? "rgba(34,197,94,.3)" : "#1e2440"}`, cursor: "pointer", fontWeight: 600, fontFamily: "'Comfortaa',sans-serif", background: shareCopied ? "rgba(34,197,94,.1)" : "rgba(255,255,255,.02)", color: shareCopied ? "#10b981" : "#475569" }}>
              {shareCopied ? "✓ Copied" : "🔗 Share"}
            </button>
          </div>
          {/* Live clock + reset */}
          <div style={{ marginTop: 8, fontSize: 11, fontFamily: "'Comfortaa',sans-serif" }}>
            {(() => {
              const now = new Date();
              const localTime = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
              const tzAbbr = now.toLocaleTimeString("en-US", { timeZoneName: "short" }).split(" ").pop();
              const utcH = now.getUTCHours(), utcM = now.getUTCMinutes();
              const minsFromReset = utcH * 60 + utcM;
              const minsToReset = 24 * 60 - minsFromReset;
              const useNeg = minsToReset <= 8 * 60 && minsFromReset > 0;
              const absMins = useNeg ? minsToReset : minsFromReset;
              const rH = Math.floor(absMins / 60), rM = absMins % 60;
              const resetStr = (useNeg ? "-" : "+") + rH + (rM > 0 ? ":" + String(rM).padStart(2, "0") : "");
              return <><span style={{ color: "#64748b", fontWeight: 500 }}>Current Time ({tzAbbr})</span><span style={{ color: "#e2e8f0", fontWeight: 600, marginLeft: 6 }}>{localTime}</span><span style={{ marginLeft: 8, color: ACCENT, fontWeight: 700 }}>Reset {resetStr}</span></>;
            })()}
          </div>
          {editing && <div style={{ fontSize: 10, color: "#64748b", fontFamily: "'Comfortaa',sans-serif", marginTop: 6 }}>Drag parties to reschedule</div>}
        </div>

        {/* Tabbed: Unscheduled / Monthly */}
        <div style={{ ...BACKDROP, padding: 0, overflow: "hidden", ...(editing && dragging && dragging.utcDay != null && sidebarTab === "unscheduled" ? { border: "2px dashed rgba(251,191,36,.4)", background: "rgba(251,191,36,.04)" } : {}) }}
          onDragOver={editing ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } : undefined}
          onDrop={editing && sidebarTab === "unscheduled" ? (e) => { e.preventDefault(); if (dragging && dragging.utcDay != null) { setUndoStack(prev => [...prev, { id: dragging.id, utcDay: dragging.utcDay, utcHour: dragging.utcHour, utcMin: dragging.utcMin }]); onUpdateParty({ ...dragging, utcDay: null, utcHour: null, utcMin: null, ...(dragging.isMonthly ? { scheduledDate: null } : {}) }); } setDragging(null); setDragPos(null); } : undefined}>
          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid rgba(30,36,64,.6)" }}>
            {["unscheduled", "monthly"].map(tab => (
              <button key={tab} onClick={() => setSidebarTab(tab)} style={{
                flex: 1, padding: "8px 0", fontSize: 11, fontWeight: 700, fontFamily: "'Fredoka',sans-serif",
                background: sidebarTab === tab ? "rgba(255,255,255,.04)" : "transparent",
                border: "none", borderBottom: sidebarTab === tab ? `2px solid ${tab === "monthly" ? "#a78bfa" : ACCENT}` : "2px solid transparent",
                color: sidebarTab === tab ? (tab === "monthly" ? "#a78bfa" : "#e2e8f0") : "#475569",
                cursor: "pointer", transition: "all .15s",
              }}>
                {tab === "unscheduled" ? `Unscheduled (${byDay.unscheduled.length})` : `Monthly (${monthlyParties.length})`}
              </button>
            ))}
          </div>
          <div style={{ padding: 12 }}>
          {sidebarTab === "unscheduled" ? (<>
            {byDay.unscheduled.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {byDay.unscheduled.map(p => {
                  const b = p.bosses?.[0]; const dc = DIFF_COLORS[b?.difficulty] || "#94a3b8"; const solo = p.members?.length === 1; const dur = p.duration || 30;
                  return (
                    <div key={p.id} draggable={editing} onDragStart={editing ? onDragStart(p) : undefined}
                      onClick={() => !editing && onClickParty(p)}
                      onMouseEnter={e => { if (!editing) { setHoverParty(p); setHoverPos(smartTip(e)); } }}
                      onMouseMove={e => hoverParty?.id === p.id && setHoverPos(smartTip(e))}
                      onMouseLeave={() => setHoverParty(null)}
                      style={{ padding: "8px 10px", borderRadius: 8, cursor: editing ? "grab" : "pointer", background: solo ? "rgba(34,197,94,.06)" : `${dc}10`, border: `1px solid ${solo ? "rgba(34,197,94,.2)" : dc + "25"}`, userSelect: "none" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", fontFamily: "'Fredoka',sans-serif" }}>{b?.bossName}</span>
                            <span style={{ marginLeft: 6 }}><DiffBadge difficulty={b?.difficulty} inline /></span>
                            {solo && <span style={{ fontSize: 9, fontWeight: 700, marginLeft: 4, color: "#10b981" }}>Solo</span>}
                          </div>
                          <div style={{ fontSize: 10, color: "#64748b", fontFamily: "'Comfortaa',sans-serif", marginTop: 2 }}>{p.members?.[0]?.charName || "\u2014"}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => changeDuration(p, -15)} style={{ width: 18, height: 18, borderRadius: 3, border: "1px solid rgba(30,36,64,.6)", background: "rgba(11,14,26,.4)", color: "#94a3b8", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>{"\u2212"}</button>
                          <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'Comfortaa',sans-serif", minWidth: 30, textAlign: "center" }}>{dur}m</span>
                          <button onClick={() => changeDuration(p, 15)} style={{ width: 18, height: 18, borderRadius: 3, border: "1px solid rgba(30,36,64,.6)", background: "rgba(11,14,26,.4)", color: "#94a3b8", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : editing ? (
              <div style={{ padding: "16px 0", textAlign: "center", fontSize: 11, color: "#475569", fontFamily: "'Comfortaa',sans-serif" }}>Drop here to unschedule</div>
            ) : (
              <div style={{ fontSize: 11, color: "#374151", fontFamily: "'Comfortaa',sans-serif" }}>None</div>
            )}
          </>) : (<>
            {/* Monthly tab */}
            {monthlyParties.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {monthlyParties
                  .sort((a, b) => {
                    const aS = a.scheduledDate ? 0 : 1; const bS = b.scheduledDate ? 0 : 1;
                    if (aS !== bS) return aS - bS;
                    const aRun = a.scheduledDate ? getNextRunMonthly(a.scheduledDate, a.utcHour, a.utcMin, a.duration) : null;
                    const bRun = b.scheduledDate ? getNextRunMonthly(b.scheduledDate, b.utcHour, b.utcMin, b.duration) : null;
                    if (aRun && bRun) return aRun.startUnix - bRun.startUnix;
                    return 0;
                  })
                  .map(p => {
                  const b = p.bosses?.[0]; const dc = DIFF_COLORS[b?.difficulty] || "#94a3b8";
                  const solo = (p.members?.length || 0) <= 1;
                  const run = p.scheduledDate ? getNextRunMonthly(p.scheduledDate, p.utcHour, p.utcMin, p.duration) : null;
                  const scheduled = !!p.scheduledDate;
                  const dur = p.duration || 30;
                  const fmtTime = (h, m) => { const hr = h % 12 || 12; return `${hr}:${String(m).padStart(2, "0")}${h < 12 ? "a" : "p"}`; };
                  return (
                    <div key={p.id} draggable={editing} onDragStart={editing ? onDragStart(p) : undefined}
                      onClick={() => !editing && onClickParty(p)}
                      onMouseEnter={e => { if (!editing) { setHoverParty(p); setHoverPos(smartTip(e)); } }}
                      onMouseMove={e => hoverParty?.id === p.id && setHoverPos(smartTip(e))}
                      onMouseLeave={() => setHoverParty(null)}
                      style={{ padding: "8px 10px", borderRadius: 8, cursor: editing ? "grab" : "pointer",
                        background: scheduled ? `${dc}15` : "rgba(20,24,41,.3)",
                        border: `1px solid ${scheduled ? dc + "40" : "rgba(30,36,64,.3)"}`,
                        opacity: scheduled ? 1 : 0.5,
                        userSelect: "none", transition: "opacity .15s",
                      }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <DiffBadge difficulty={b?.difficulty} inline />
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", fontFamily: "'Fredoka',sans-serif" }}>{b?.bossName}</span>
                            {solo && <span style={{ fontSize: 9, fontWeight: 700, color: "#10b981" }}>Solo</span>}
                          </div>
                          <div style={{ fontSize: 10, color: "#64748b", fontFamily: "'Comfortaa',sans-serif", marginTop: 2 }}>
                            {p.members?.[0]?.charName || "\u2014"}
                            {run && <span style={{ marginLeft: 6, color: run.isPast ? "#f87171" : ACCENT, fontWeight: 600 }}>{run.localDateStr} {p.utcHour != null ? fmtTime(p.utcHour, p.utcMin || 0) : ""}</span>}
                            {run?.isPast && <span style={{ marginLeft: 4, fontSize: 8, color: "#f87171" }}>Past</span>}
                            {!scheduled && <span style={{ marginLeft: 4, fontStyle: "italic", color: "#475569" }}>Unscheduled</span>}
                          </div>
                        </div>
                        {editing && scheduled && <button onClick={e => { e.stopPropagation(); onUpdateParty({ ...p, scheduledDate: null, utcDay: null, utcHour: null, utcMin: null }); }}
                          style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(245,158,11,.3)", background: "rgba(245,158,11,.08)", color: "#f59e0b", fontSize: 9, fontWeight: 700, cursor: "pointer", fontFamily: "'Comfortaa',sans-serif", flexShrink: 0 }}>Unsched</button>}
                        {!editing && <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => changeDuration(p, -15)} style={{ width: 18, height: 18, borderRadius: 3, border: "1px solid rgba(30,36,64,.6)", background: "rgba(11,14,26,.4)", color: "#94a3b8", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>{"\u2212"}</button>
                          <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'Comfortaa',sans-serif", minWidth: 30, textAlign: "center" }}>{dur}m</span>
                          <button onClick={() => changeDuration(p, 15)} style={{ width: 18, height: 18, borderRadius: 3, border: "1px solid rgba(30,36,64,.6)", background: "rgba(11,14,26,.4)", color: "#94a3b8", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                        </div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: "#374151", fontFamily: "'Comfortaa',sans-serif" }}>No monthly bosses</div>
            )}
          </>)}
          </div>
        </div>

        {/* Recently Deleted */}
        {Object.keys(trash || {}).length > 0 && (
          <div style={{ ...BACKDROP, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 8, fontFamily: "'Fredoka',sans-serif" }}>Recently Deleted</div>
            {Object.values(trash).map(p => {
              const b = p.bosses?.[0]; const dc = DIFF_COLORS[b?.difficulty] || "#94a3b8";
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", opacity: 0.7 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", fontFamily: "'Fredoka',sans-serif", textDecoration: "line-through" }}>{b?.bossName}</span>
                  <DiffBadge difficulty={b?.difficulty} small />
                  <button onClick={() => onRecover(p.id)} style={{ marginLeft: "auto", padding: "2px 8px", borderRadius: 4, border: "none", cursor: "pointer", background: "rgba(34,197,94,.15)", color: "#10b981", fontSize: 9, fontWeight: 700, fontFamily: "'Comfortaa',sans-serif" }}>Recover</button>
                  <button onClick={() => onPermDelete(p.id)} style={{ padding: "2px 6px", borderRadius: 4, border: "none", cursor: "pointer", background: "rgba(239,68,68,.1)", color: "#f87171", fontSize: 9 }}>{"\u2715"}</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT — Vertical Schedule Grid */}
      <div style={{ ...BACKDROP, padding: 16, position: "relative", flex: 1, minWidth: 0 }}>
        <div ref={gridRef} style={{ position: "relative", overflow: "auto", maxHeight: "calc(100vh - 140px)" }}
          onDragOver={editing ? onGridDragOver : undefined} onDrop={editing ? onGridDrop : undefined} onDragLeave={editing ? onGridDragLeave : undefined}>
          {/* Sticky day headers */}
          <div style={{ display: "flex", height: HEADER_H, position: "sticky", top: 0, zIndex: 12, background: "rgba(11,14,26,.98)" }}>
            <div style={{ width: LABEL_W, flexShrink: 0 }} />
            {DAY_ORDER.map(di => {
              const isToday = di === todayDay;
              return <div key={di} style={{ flex: 1, textAlign: "center", padding: "6px 0", fontSize: 13, fontWeight: 700, color: isToday ? "#fff" : "#e2e8f0", fontFamily: "'Fredoka',sans-serif", borderBottom: "1px solid rgba(30,36,64,.6)", ...(isToday ? { background: ACCENT, borderRadius: "6px 6px 0 0", margin: "0 1px" } : {}) }}>
                {DAYS_SHORT[di]}<div style={{ fontSize: 10, color: isToday ? "rgba(255,255,255,.7)" : "#64748b", fontWeight: 400, marginTop: 1 }}>{byDay[di]?.length || 0} boss{byDay[di]?.length !== 1 ? "es" : ""}</div>
              </div>;
            })}
          </div>
          <div style={{ display: "flex", height: gridH }}>
            {/* Time labels */}
            <div style={{ width: LABEL_W, flexShrink: 0, position: "relative" }}>
              {Array.from({ length: SLOT_COUNT }, (_, si) => {
                if (si % 2 !== 0) return null;
                const h = Math.floor(si / 2);
                return <div key={si} style={{ position: "absolute", top: si * ROW_H, right: 4, fontSize: 9, color: "#475569", lineHeight: 1, fontFamily: "'Comfortaa',sans-serif" }}>
                  {h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`}
                </div>;
              })}
            </div>
            {/* Day columns */}
            {DAY_ORDER.map(dayIdx => {
              const isToday = dayIdx === todayDay;
              return <div key={dayIdx} style={{ flex: 1, position: "relative", borderLeft: isToday ? "2px solid rgba(255,255,255,.35)" : "1px solid rgba(255,255,255,.06)", borderRight: isToday ? "2px solid rgba(255,255,255,.35)" : "none" }}>
                {/* Background cells */}
                {Array.from({ length: SLOT_COUNT }, (_, si) => {
                  const hasA = isAvail(dayIdx, si);
                  const isHour = si % 2 === 0 && si > 0;
                  const isReset = si === RESET_SLOT;
                  const todayTint = isToday && !hasA ? "rgba(255,255,255,.04)" : "";
                  return <div key={si} style={{
                    position: "absolute", top: si * ROW_H, left: 0, right: 0, height: ROW_H,
                    background: hasA ? "rgba(34,197,94,.15)" : todayTint || "rgba(20,24,41,.5)",
                    borderTop: isReset ? "none" : isHour ? "1px dashed rgba(255,255,255,.12)" : "none",
                  }} />;
                })}
                {/* Party blocks */}
                {(byDay[dayIdx] || []).map(p => {
                  const startS = getStartSlot(p); const durS = getDurSlots(p);
                  const visTop = startS * ROW_H;
                  const b = p.bosses?.[0]; const dc = DIFF_COLORS[b?.difficulty] || "#94a3b8"; const solo = p.members?.length === 1;
                  const mc = p.members?.length || 1;
                  const sizeLabel = mc === 1 ? "Solo" : mc === 2 ? "Duo" : mc === 3 ? "Trio" : mc === 4 ? "Quad" : `${mc}p`;
                  const blockH = durS * ROW_H;
                  const tiny = blockH < 20;
                  return (
                    <div key={p.id} draggable={editing} onDragStart={editing ? onDragStart(p) : undefined}
                      onClick={() => !editing && onClickParty(p)}
                      onMouseEnter={e => { if (!editing) { setHoverParty(p); setHoverPos(smartTip(e)); } }}
                      onMouseMove={e => hoverParty?.id === p.id && setHoverPos(smartTip(e))}
                      onMouseLeave={() => setHoverParty(null)}
                      style={{
                      position: "absolute", top: visTop + 1, left: 2, right: 2,
                      height: blockH - 2, borderRadius: tiny ? 3 : 5, cursor: editing ? "grab" : "pointer", zIndex: 3,
                      padding: tiny ? "0 4px" : "2px 5px", overflow: "hidden",
                      background: solo ? "rgba(160,70,70,.85)" : "rgba(20,24,41,.92)",
                      border: `${tiny ? 1 : 2}px solid ${solo ? "#c45c5c" : dc}`,
                      boxShadow: `0 0 6px ${dc}33`,
                      fontFamily: "'Comfortaa',sans-serif",
                      display: "flex", flexDirection: tiny ? "row" : "column", alignItems: tiny ? "center" : "stretch", justifyContent: tiny ? "flex-start" : "space-between", gap: tiny ? 3 : 0,
                      ...(editing ? { outline: `1px dashed rgba(255,255,255,.3)` } : {}),
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 3, overflow: "hidden" }}>
                        <DiffBadge difficulty={b?.difficulty} inline />
                        <span style={{ fontSize: tiny ? 8 : 10, fontWeight: 700, color: solo ? "#fca5a5" : "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b?.bossName}</span>
                      </div>
                      {!tiny && blockH > 28 && <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 8, color: "rgba(255,255,255,.5)", fontWeight: 600 }}>{fmtSlot(startS)}</span>
                        <span style={{ fontSize: 7, color: "#94a3b8" }}>{sizeLabel}</span>
                      </div>}
                      {!tiny && blockH > 40 && <ScheduleBlockJob charName={p.members?.[0]?.charName} />}
                    </div>
                  );
                })}
                {/* Drag preview */}
                {editing && dragPreview && dragPreview.day === dayIdx && (() => {
                  const visTop = dragPreview.startSlot * ROW_H;
                  return <div style={{ position: "absolute", top: visTop, left: 2, right: 2, height: dragPreview.durSlots * ROW_H, borderRadius: 5, zIndex: 10, background: "rgba(37,99,235,.3)", border: `2px dashed ${ACCENT}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 700, fontFamily: "'Comfortaa',sans-serif", pointerEvents: "none" }}>
                    {dragging?.bosses?.[0]?.bossName}
                  </div>;
                })()}
              </div>;
            })}
          </div>
          {/* Reset line */}
          {RESET_SLOT >= 0 && RESET_SLOT < 48 && (
            <div style={{ position: "absolute", left: LABEL_W, right: 0, top: HEADER_H + RESET_SLOT * ROW_H, height: 0, borderTop: "2px solid rgba(239,68,68,.6)", pointerEvents: "none", zIndex: 8 }}>
              <span style={{ position: "absolute", right: 4, top: -12, fontSize: 8, color: "#f87171", fontWeight: 700, background: "rgba(11,14,26,.8)", padding: "1px 4px", borderRadius: 2 }}>0:00 UTC</span>
            </div>
          )}
          {/* Current time line */}
          <div style={{ position: "absolute", left: LABEL_W, right: 0, top: HEADER_H + nowSlot * ROW_H, height: 0, borderTop: "2px solid rgba(255,255,255,.7)", pointerEvents: "none", zIndex: 9, transition: "top 15s linear" }}>
            <div style={{ position: "absolute", left: -5, top: -5, width: 8, height: 8, borderRadius: "50%", background: "#fff", boxShadow: "0 0 6px rgba(255,255,255,.5)" }} />
          </div>
        </div>
      </div>
      {hoverParty && hoverPos && <PartyHoverCard party={hoverParty} currentUserId={user.id} style={hoverPos} />}
      {/* Monthly date picker popup (from drag-and-drop) */}
      {monthlyDatePick && (() => {
        const targetJsDay = (monthlyDatePick.day + 1) % 7;
        const dates = [];
        const now = new Date();
        const curMonth = now.getMonth();
        const curYear = now.getFullYear();
        for (let mo = curMonth; mo <= curMonth + 1; mo++) {
          const realMo = mo % 12;
          const realYr = mo > 11 ? curYear + 1 : curYear;
          const daysInMonth = new Date(realYr, realMo + 1, 0).getDate();
          for (let d = 1; d <= daysInMonth; d++) {
            const dt = new Date(realYr, realMo, d);
            if (dt.getDay() === targetJsDay) {
              const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              if (dt >= todayStart) dates.push(dt);
            }
          }
        }
        const dayName = DAYS[monthlyDatePick.day];
        const fmtT = (h, m) => { const hr = h % 12 || 12; return `${hr}:${String(m).padStart(2, "0")}${h < 12 ? "a" : "p"}`; };
        return <div style={S.popOverlay} onClick={() => setMonthlyDatePick(null)}>
          <div style={S.popBox} onClick={e => e.stopPropagation()}>
            <div style={S.popHead}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0", fontFamily: "'Fredoka',sans-serif" }}>Select Date</span>
              <button style={S.closeBtn} onClick={() => setMonthlyDatePick(null)}>✕</button>
            </div>
            <div style={{ padding: "12px 18px" }}>
              <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'Comfortaa',sans-serif", marginBottom: 10 }}>
                {dayName}s at {fmtT(monthlyDatePick.hour, monthlyDatePick.min)} · {monthlyDatePick.duration}m
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 300, overflow: "auto" }}>
                {dates.map(dt => {
                  const dateStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
                  const label = dt.toLocaleDateString("en-US", { month: "long", day: "numeric" });
                  const isToday = dt.toDateString() === now.toDateString();
                  return <button key={dateStr} onClick={() => {
                    const p = monthlyDatePick.party;
                    setUndoStack(prev => [...prev, { id: p.id, utcDay: p.utcDay, utcHour: p.utcHour, utcMin: p.utcMin, scheduledDate: p.scheduledDate }]);
                    onUpdateParty({ ...p, utcDay: monthlyDatePick.day, utcHour: monthlyDatePick.hour, utcMin: monthlyDatePick.min, duration: monthlyDatePick.duration, scheduledDate: dateStr });
                    setMonthlyDatePick(null);
                  }} style={{
                    padding: "8px 14px", borderRadius: 6, border: `1px solid ${isToday ? "rgba(139,92,246,.4)" : "#1e2440"}`,
                    background: isToday ? "rgba(139,92,246,.12)" : "rgba(255,255,255,.03)", cursor: "pointer",
                    color: "#e2e8f0", fontSize: 13, fontWeight: 600, fontFamily: "'Comfortaa',sans-serif",
                    textAlign: "left", display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <span>{label}</span>
                    {isToday && <span style={{ fontSize: 9, color: "#a78bfa", fontWeight: 700 }}>Today</span>}
                  </button>;
                })}
              </div>
            </div>
          </div>
        </div>;
      })()}
    </div>
    </div>
  );
}


/* ═══ MANAGE CHARACTERS MODAL ═══ */
function CharRow({ name, index, total, onMove, onRemove }) {
  const info = useCharInfo(name);
  const arrowBtn = (label, disabled, onClick) => (
    <button onClick={disabled ? undefined : onClick} style={{
      width: 24, height: 24, borderRadius: 5, border: "1px solid rgba(30,36,64,.6)",
      background: disabled ? "rgba(11,14,26,.2)" : "rgba(255,255,255,.04)", color: disabled ? "#1e2440" : "#94a3b8",
      cursor: disabled ? "default" : "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center",
      opacity: disabled ? 0.3 : 1, fontFamily: "'Comfortaa',sans-serif",
    }}>{label}</button>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid rgba(30,36,64,.3)", background: index % 2 === 0 ? "rgba(255,255,255,.02)" : "transparent" }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT, fontFamily: "'Fredoka',sans-serif", width: 24, textAlign: "center" }}>{index + 1}</span>
      <CharAvatar name={name} size={32} />
      <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'Comfortaa',sans-serif", width: 32, textAlign: "right" }}>{info?.level || "—"}</span>
      <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'Comfortaa',sans-serif", width: 100 }}>{info?.jobName || "—"}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", fontFamily: "'Fredoka',sans-serif", flex: 1 }}>{name}</span>
      <div style={{ display: "flex", gap: 3 }}>
        {arrowBtn("⤒", index === 0, () => onMove(index, 0))}
        {arrowBtn("▲", index === 0, () => onMove(index, index - 1))}
        {arrowBtn("▼", index === total - 1, () => onMove(index, index + 1))}
        {arrowBtn("⤓", index === total - 1, () => onMove(index, total - 1))}
      </div>
      <button onClick={() => onRemove(index)} style={{ width: 24, height: 24, borderRadius: 5, border: "none", cursor: "pointer", background: "rgba(239,68,68,.15)", color: "#f87171", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
    </div>
  );
}

function AdminCharManager({ user, onUpdate }) {
  const [chars, setChars] = useState(user.characters || []);
  const [newChar, setNewChar] = useState("");
  useEffect(() => { setChars(user.characters || []); }, [user.characters]);
  const add = () => { const n = newChar.trim(); if (n && !chars.includes(n)) { const nc = [...chars, n]; setChars(nc); onUpdate(nc); setNewChar(""); } };
  const rm = (i) => { const nc = chars.filter((_, j) => j !== i); setChars(nc); onUpdate(nc); };
  const move = (i, dir) => { const nc = [...chars]; [nc[i], nc[i + dir]] = [nc[i + dir], nc[i]]; setChars(nc); onUpdate(nc); };
  return <div>
    <label style={S.label}>Characters ({chars.length})</label>
    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
      <input style={S.input} placeholder="Add character IGN..." value={newChar} onChange={e => setNewChar(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
      <button style={{ ...S.btnPrimary, whiteSpace: "nowrap", opacity: newChar.trim() ? 1 : .4 }} onClick={add}>＋ Add</button>
    </div>
    {chars.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 0, border: "1px solid rgba(30,36,64,.5)", borderRadius: 8, overflow: "hidden" }}>
      {chars.map((c, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: i % 2 === 0 ? "rgba(11,14,26,.3)" : "rgba(11,14,26,.15)", borderBottom: i < chars.length - 1 ? "1px solid rgba(30,36,64,.3)" : "none" }}>
          <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'Comfortaa',sans-serif", width: 18, textAlign: "center", flexShrink: 0 }}>{i + 1}</span>
          <CharAvatar name={c} size={24} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#e2e8f0", fontFamily: "'Comfortaa',sans-serif" }}>{c}</span>
          <CharJobLevel name={c} />
          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            <button onClick={() => i > 0 && move(i, -1)} disabled={i === 0}
              style={{ width: 20, height: 20, borderRadius: 4, border: "1px solid rgba(30,36,64,.6)", background: "rgba(11,14,26,.4)", color: i === 0 ? "#1e2440" : "#94a3b8", cursor: i === 0 ? "default" : "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>{"\u25b2"}</button>
            <button onClick={() => i < chars.length - 1 && move(i, 1)} disabled={i === chars.length - 1}
              style={{ width: 20, height: 20, borderRadius: 4, border: "1px solid rgba(30,36,64,.6)", background: "rgba(11,14,26,.4)", color: i === chars.length - 1 ? "#1e2440" : "#94a3b8", cursor: i === chars.length - 1 ? "default" : "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>{"\u25bc"}</button>
          </div>
          <button onClick={() => rm(i)} style={{ width: 20, height: 20, borderRadius: 4, border: "none", cursor: "pointer", background: "rgba(239,68,68,.15)", color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, flexShrink: 0 }}>{"\u2715"}</button>
        </div>
      ))}
    </div>}
    {chars.length === 0 && <div style={{ fontSize: 11, color: "#475569", fontFamily: "'Comfortaa',sans-serif", padding: 12, textAlign: "center" }}>No characters registered</div>}
  </div>;
}

function ManageCharactersModal({ chars, onSave, onClose }) {
  const [list, setList] = useState([...chars]);
  const [newChar, setNewChar] = useState("");

  const move = (from, to) => {
    const a = [...list];
    const [item] = a.splice(from, 1);
    a.splice(to, 0, item);
    setList(a);
  };
  const remove = (i) => setList(p => p.filter((_, j) => j !== i));
  const add = () => { const n = newChar.trim(); if (n && !list.some(c => c.toLowerCase() === n.toLowerCase())) { setList(p => [...p, n]); setNewChar(""); } };
  const save = () => { onSave(list); onClose(); };

  return (
    <div style={S.overlay} onClick={onClose}><div style={{ ...S.modal, width: "min(560px,95vw)" }} onClick={e => e.stopPropagation()}>
      <div style={S.modalHead}>
        <span style={S.modalTitle}>Manage Characters</span>
        <button style={S.closeBtn} onClick={onClose}>✕</button>
      </div>
      <div style={S.modalBody}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 12px", borderBottom: "2px solid rgba(30,36,64,.6)", fontSize: 10, fontWeight: 600, color: "#64748b", fontFamily: "'Comfortaa',sans-serif" }}>
          <span style={{ width: 24, textAlign: "center" }}>#</span>
          <span style={{ width: 32 }} />
          <span style={{ width: 32, textAlign: "right" }}>Lv</span>
          <span style={{ width: 100 }}>Job</span>
          <span style={{ flex: 1 }}>Name</span>
          <span style={{ width: 114, textAlign: "center" }}>Position</span>
          <span style={{ width: 24 }} />
        </div>
        {/* Character rows */}
        <div style={{ maxHeight: 400, overflow: "auto" }}>
          {list.map((c, i) => <CharRow key={c} name={c} index={i} total={list.length} onMove={move} onRemove={remove} />)}
          {list.length === 0 && <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: "#475569" }}>No characters</div>}
        </div>
        {/* Add character */}
        <div style={{ display: "flex", gap: 8, padding: "12px 12px 0" }}>
          <input style={S.input} placeholder="Add character IGN..." value={newChar} onChange={e => setNewChar(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
          <button style={{ ...S.btnPrimary, whiteSpace: "nowrap", opacity: newChar.trim() ? 1 : .4 }} onClick={add}>＋ Add</button>
        </div>
        {/* Save */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 12px 0" }}>
          <button onClick={onClose} style={S.btnGhost}>Cancel</button>
          <button onClick={save} style={S.btnPrimary}>Save Order</button>
        </div>
      </div>
    </div></div>
  );
}

/* ═══ CHARACTERS VIEW ═══ */
function CharactersView({ parties, user, onCreateParty, onClickParty, onCreateSolo, onSkipBoss, onSaveProfile }) {
  const allChars = (user.characters || []).slice(0, 12);
  const pl = Object.values(parties || {}).filter(p => {
    if (p.skipped && (p.leaderId === user.id || p.leaderId === user.username)) return true;
    return p.members?.some(m => m.userId === user.id || m.userId === user.username || allChars.some(c => m.charName?.toLowerCase() === c.toLowerCase()));
  });
  const [page, setPage] = useState(0);
  const [charSlideDir, setCharSlideDir] = useState(null);
  const [charSlideKey, setCharSlideKey] = useState(0);
  const goPage = (p) => { setCharSlideDir(p > page ? "right" : "left"); setCharSlideKey(k => k + 1); setPage(p); };
  const [hoverParty, setHoverParty] = useState(null);
  const [hoverPos, setHoverPos] = useState(null);
  const [showManage, setShowManage] = useState(false);
  const [unlocked, setUnlocked] = useState({});
  const PER_PAGE = 6;
  const totalPages = Math.ceil(allChars.length / PER_PAGE);
  const chars = allChars.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  if (allChars.length === 0) return <div style={{ ...BACKDROP, textAlign: "center", padding: "60px 20px" }}><div style={{ fontSize: 15, fontWeight: 500, fontFamily: "'Comfortaa',sans-serif", color: "#94a3b8" }}>No characters registered</div><div style={{ fontSize: 13, marginTop: 6, color: "#64748b" }}>Go to Profile Settings to add your IGNs</div></div>;
  // Find party for THIS user's character — matches by userId AND charName
  const uid = user.id;
  const uname = user.username;
  const find = (cn, bn) => pl.find(p => !p.skipped && p.members?.some(m => m.charName?.toLowerCase() === cn.toLowerCase()) && p.bosses?.some(b => b.bossName === bn));
  const findSkip = (cn, bn) => pl.find(p => p.skipped && p._skipChar?.toLowerCase() === cn.toLowerCase() && (p.leaderId === uid || p.leaderId === uname) && p.bosses?.some(b => b.bossName === bn));

  const eBtn = { width: 28, height: 28, borderRadius: 6, border: "none", cursor: "pointer", fontSize: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "transform .1s" };
  const sBtnBase = { width: 22, height: 14, borderRadius: 4, border: "none", cursor: "pointer", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", transition: "transform .1s", lineHeight: 1 };

  return (
    <div>
      {/* Top bar with pagination and manage */}
      <div style={{ ...BACKDROP, padding: "8px 16px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {totalPages > 1 && <>
            <button onClick={() => page > 0 && goPage(page - 1)}
              style={{ ...S.btnGhost, fontSize: 11, padding: "4px 12px", opacity: page === 0 ? .3 : 1, cursor: page === 0 ? "default" : "pointer", pointerEvents: page === 0 ? "none" : "auto" }}>← Prev</button>
            <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'Comfortaa',sans-serif" }}>
              Page {page + 1} of {totalPages} ({allChars.length} chars)
            </span>
            <button onClick={() => page < totalPages - 1 && goPage(page + 1)}
              style={{ ...S.btnGhost, fontSize: 11, padding: "4px 12px", opacity: page >= totalPages - 1 ? .3 : 1, cursor: page >= totalPages - 1 ? "default" : "pointer", pointerEvents: page >= totalPages - 1 ? "none" : "auto" }}>Next →</button>
          </>}
          {totalPages <= 1 && <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'Comfortaa',sans-serif" }}>{allChars.length} character{allChars.length !== 1 ? "s" : ""}</span>}
        </div>
        <button onClick={() => setShowManage(true)} style={{ ...S.btnGhost, fontSize: 11, padding: "5px 12px" }}>Manage Characters</button>
      </div>
      <div style={{ ...BACKDROP, padding: "4px 0", overflow: "hidden" }}>
        <div style={{ display: "flex" }}>
          {/* Fixed boss column */}
          <div style={{ width: 120, flexShrink: 0, zIndex: 2 }}>
            <div style={{ height: 80, padding: "12px 16px", display: "flex", alignItems: "flex-end", borderBottom: "2px solid rgba(30,36,64,.6)", background: "rgba(11,14,26,.95)" }}>
              <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600, fontFamily: "'Comfortaa',sans-serif" }}>Boss</span>
            </div>
            {BOSS_ORDER.filter(bn => bn !== "Other").map(bn => (
              <div key={bn} style={{ height: 48, padding: "0 16px", display: "flex", alignItems: "center", borderBottom: "1px solid rgba(30,36,64,.4)", background: "rgba(11,14,26,.95)" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", fontFamily: "'Fredoka',sans-serif" }}>{bn}</span>
              </div>
            ))}
          </div>
          {/* Sliding character columns */}
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div key={charSlideKey} style={{ animation: charSlideDir ? `${charSlideDir === "right" ? "slideFromRight" : "slideFromLeft"} .25s ease` : "none" }}>
              {/* Character headers */}
              <div style={{ display: "flex", height: 80, borderBottom: "2px solid rgba(30,36,64,.6)" }}>
                {chars.map(c => {
                  const ci = charInfoCache[c];
                  const jobStr = ci?.jobName && ci.jobName.toLowerCase() !== c.toLowerCase() ? ci.jobName : "";
                  return <div key={c} style={{ flex: 1, minWidth: 100, padding: "8px 4px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 2 }}>
                    <CharAvatar name={c} size={40} />
                    <span style={{ fontSize: 12, color: ACCENT, fontWeight: 700, fontFamily: "'Fredoka',sans-serif" }}>{c}</span>
                    <span style={{ fontSize: 9, color: "#64748b", fontFamily: "'Comfortaa',sans-serif" }}>
                      {ci?.level ? `Lv.${ci.level}` : ""}{jobStr ? ` ${jobStr}` : ""}
                    </span>
                  </div>;
                })}
              </div>
              {/* Boss rows */}
              {BOSS_ORDER.filter(bn => bn !== "Other").map(bn => (
                <div key={bn} style={{ display: "flex", height: 48, borderBottom: "1px solid rgba(30,36,64,.4)" }}>
                  {chars.map(cn => {
                    const p = find(cn, bn);
                    const skip = findSkip(cn, bn);
                    const isSkipped = skip && !p;
                    const lvlReq = BOSS_LEVEL_REQ[bn];
                    const charLevel = charInfoCache[cn]?.level || 0;
                    const underLevel = lvlReq && charLevel > 0 && charLevel < lvlReq;
                    const isLocked = underLevel && !unlocked[`${cn}|${bn}`] && !p;
                    return (
                      <div key={cn} style={{ flex: 1, minWidth: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 4px", background: isSkipped ? "rgba(100,116,139,.12)" : isLocked ? "rgba(0,0,0,.15)" : "transparent" }}>
                  {isLocked ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                      <span style={{ fontSize: 9, color: "#475569", fontFamily: "'Comfortaa',sans-serif" }}>Lv.{lvlReq}</span>
                      <button onClick={() => setUnlocked(prev => ({ ...prev, [`${cn}|${bn}`]: true }))}
                        title={`Requires Lv.${lvlReq} (currently ${charLevel})`}
                        style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(100,116,139,.2)", background: "rgba(100,116,139,.08)", color: "#64748b", cursor: "pointer", fontFamily: "'Comfortaa',sans-serif" }}>
                        🔓 Unlock
                      </button>
                    </div>
                  ) : (
                  <div style={{ display: "flex", gap: 3, justifyContent: "center", alignItems: "center" }}>
                    {/* Re-lock button when under level but unlocked */}
                    {underLevel && !p && <button onClick={() => setUnlocked(prev => { const c = { ...prev }; delete c[`${cn}|${bn}`]; return c; })}
                      title={`Lock (requires Lv.${lvlReq})`}
                      style={{ ...sBtnBase, background: "rgba(100,116,139,.08)", width: 18, height: 18, fontSize: 10 }}>
                      🔒
                    </button>}
                    {/* Status */}
                    {p && (() => {
                      const b = p.bosses?.[0]; const dc = DIFF_COLORS[b?.difficulty] || "#94a3b8";
                      return <button onClick={() => onClickParty(p)}
                        onMouseEnter={e => { setHoverParty(p); setHoverPos(smartTip(e)); }}
                        onMouseMove={e => hoverParty?.id === p.id && setHoverPos(smartTip(e))}
                        onMouseLeave={() => setHoverParty(null)}
                        style={{ padding: 0, borderRadius: 6, cursor: "pointer", background: "transparent", border: "none" }}>
                        <DiffBadge difficulty={b?.difficulty} medium />
                      </button>;
                    })()}
                    {isSkipped && <span title="Skipped" style={{ fontSize: 10, color: "#64748b", fontWeight: 600, fontFamily: "'Comfortaa',sans-serif" }}>Skipped</span>}

                    {/* ➕ full size — only when no party exists */}
                    {!p && <button onClick={() => onCreateParty(bn, "", cn)} title="Create Party"
                      style={{ ...eBtn, background: "rgba(37,99,235,.08)" }}
                      onMouseEnter={e => e.currentTarget.style.transform = "scale(1.15)"} onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
                      ➕
                    </button>}

                    {/* Small stacked buttons next to ➕ */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {!p && <button onClick={() => onCreateSolo(bn, cn)} title="Solo"
                        style={{ ...sBtnBase, background: "rgba(34,197,94,.12)" }}
                        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.2)"} onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
                        1️⃣
                      </button>}
                      {!p && !skip && <button onClick={() => onSkipBoss(bn, cn)} title="Skip boss"
                        style={{ ...sBtnBase, background: "rgba(100,116,139,.08)" }}
                        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.2)"} onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
                        ⏭️
                      </button>}
                      {isSkipped && <button onClick={() => onSkipBoss(bn, cn, true)} title="Undo skip"
                        style={{ ...sBtnBase, background: "rgba(100,116,139,.06)" }}
                        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.2)"} onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
                        ↩️
                      </button>}
                    </div>
                  </div>
                  )}
                </div>
              );
            })}</div>))}
            </div>
          </div>
        </div>
      </div>
      {hoverParty && hoverPos && <PartyHoverCard party={hoverParty} currentUserId={user.id} style={hoverPos} />}
      {showManage && <ManageCharactersModal chars={allChars} onSave={(newChars) => onSaveProfile({ characters: newChars })} onClose={() => setShowManage(false)} />}
    </div>
  );
}

/* ═══ LOGIN PAGE ═══ */
function LoginPage() {
  return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b0e1a url('/Background.png?v=2') center center / cover fixed", fontFamily: "'Comfortaa',sans-serif" }}>
    <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at center,transparent 20%,rgba(0,0,0,.7) 100%)", pointerEvents: "none" }} />
    <div style={{ textAlign: "center", padding: 40, background: "rgba(20,24,41,.85)", border: "1px solid #1e2440", borderRadius: 20, backdropFilter: "blur(12px)", boxShadow: "0 24px 80px rgba(0,0,0,.4)", animation: "slideUp .3s ease", position: "relative", zIndex: 1 }}>
      <img src="/logo.png?v=4" alt="" style={{ width: 80, height: 80, borderRadius: 16, margin: "0 auto 16px", display: "block", objectFit: "contain" }} />
      <h1 style={{ fontSize: 26, fontWeight: 700, color: "#e2e8f0", marginBottom: 8, fontFamily: "'Fredoka',sans-serif" }}>Maple Scheduler</h1>
      <p style={{ fontSize: 14, color: "#64748b", marginBottom: 28, maxWidth: 300 }}>Organize your GMS bossing parties!</p>
      <a href="/auth/discord" style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "12px 28px", borderRadius: 10, textDecoration: "none", background: "#5865F2", color: "#fff", fontWeight: 600, fontSize: 15, boxShadow: "0 4px 20px rgba(88,101,242,.4)" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
        Sign in with Discord
      </a>
    </div>
  </div>;
}

/* ═══ SHARE VIEW — public schedule viewer ═══ */
function ShareView({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [tz, setTz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [me, setMe] = useState(null);
  const [compare, setCompare] = useState(false);
  const [sharedOnly, setSharedOnly] = useState(false);
  const [myParties, setMyParties] = useState(null);
  const [hoverParty, setHoverParty] = useState(null);
  const [hoverPos, setHoverPos] = useState(null);
  const shareGridRef = useRef(null);

  useEffect(() => {
    fetch(`/api/share/${token}`).then(r => r.ok ? r.json() : Promise.reject()).then(setData).catch(() => setError(true));
    API.get("/api/me").then(d => { if (d) { setMe(d); API.get("/api/parties").then(p => setMyParties(p || {})).catch(() => {}); } }).catch(() => {});
  }, [token]);

  // Shared bosses: boss names that appear in both owner's and viewer's parties
  const sharedBossKeys = useMemo(() => {
    if (!me || !myParties || !data) return new Set();
    const partyList = Object.values(data.parties || {}).filter(p => !p.skipped);
    const myBosses = new Set();
    Object.values(myParties).forEach(p => {
      if (p.skipped || !p.members?.some(m => m.userId === me.id)) return;
      p.bosses?.forEach(b => myBosses.add(`${b.bossName}|${b.difficulty}`));
    });
    const shared = new Set();
    partyList.forEach(p => {
      p.bosses?.forEach(b => { if (myBosses.has(`${b.bossName}|${b.difficulty}`)) shared.add(p.id); });
    });
    return shared;
  }, [me, myParties, data]);

  // Scroll to current time on mount
  useEffect(() => {
    if (!data || !shareGridRef.current) return;
    const now = new Date();
    const viewerNow = new Date(now.toLocaleString("en-US", { timeZone: tz }));
    const nowSlot = viewerNow.getHours() * 2 + viewerNow.getMinutes() / 30;
    const ROW_H = 28;
    const HEADER_H = 44;
    const targetY = shareGridRef.current.offsetTop + HEADER_H + nowSlot * ROW_H - window.innerHeight / 2;
    window.scrollTo({ top: Math.max(0, targetY), behavior: "smooth" });
  }, [data]);

  if (error) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b0e1a url('/Background.png?v=2') center center / cover fixed", fontFamily: "'Comfortaa',sans-serif" }}>
    <style>{globalCSS}</style>
    <div style={{ ...BACKDROP, padding: 40, textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#f87171", fontFamily: "'Fredoka',sans-serif", marginBottom: 8 }}>Link not found</div>
      <div style={{ fontSize: 13, color: "#64748b" }}>This share link is invalid or has been regenerated.</div>
      <a href="/" style={{ ...S.btnPrimary, display: "inline-block", marginTop: 16, textDecoration: "none" }}>Go Home</a>
    </div>
  </div>;
  if (!data) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b0e1a url('/Background.png?v=2') center center / cover fixed", fontFamily: "'Comfortaa',sans-serif" }}><style>{globalCSS}</style><div style={{ color: "#64748b", animation: "pulse 1.5s infinite" }}>Loading...</div></div>;

  const { owner, parties, users } = data;
  const partyList = Object.values(parties).filter(p => !p.skipped);

  // Convert slot from owner's TZ to viewer's selected TZ
  const ownerTZ = owner.timezone || "America/New_York";
  const now = new Date();
  const ownerTime = new Date(now.toLocaleString("en-US", { timeZone: ownerTZ }));
  const viewerTime = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  const tzOffsetSlots = Math.round((viewerTime - ownerTime) / (30 * 60 * 1000));

  const convertSlot = (day, hour, min) => {
    let slot = hour * 2 + (min >= 30 ? 1 : 0) + tzOffsetSlots;
    let d = day;
    while (slot >= 48) { slot -= 48; d = (d + 1) % 7; }
    while (slot < 0) { slot += 48; d = (d - 1 + 7) % 7; }
    return { day: d, slot };
  };

  // Build byDay for viewer's timezone  
  const viewerDayOrder = (() => {
    const off = -new Date(now.toLocaleString("en-US", { timeZone: tz })).getTimezoneOffset() / 60;
    const resetDay = ((3 + Math.floor(off / 24)) % 7 + 7) % 7;
    return Array.from({ length: 7 }, (_, i) => (resetDay + i) % 7);
  })();

  const byDay = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  partyList.forEach(p => {
    if (p.utcDay == null) return;
    const conv = convertSlot(p.utcDay, p.utcHour, p.utcMin);
    byDay[conv.day]?.push({ ...p, _viewSlot: conv.slot });
  });
  for (let i = 0; i < 7; i++) byDay[i].sort((a, b) => a._viewSlot - b._viewSlot);

  // My availability (if comparing)
  const myAvail = me?.availability || {};
  const myTZ = me?.timezone || tz;
  const convertMyAvail = () => {
    if (!me || Object.keys(myAvail).length === 0) return {};
    const myTime = new Date(now.toLocaleString("en-US", { timeZone: myTZ }));
    const viewTime = new Date(now.toLocaleString("en-US", { timeZone: tz }));
    const diff = Math.round((viewTime - myTime) / (30 * 60 * 1000));
    if (diff === 0) return myAvail;
    const c = {};
    for (const k of Object.keys(myAvail)) {
      if (myAvail[k] !== "available") continue;
      const [d, s] = k.split("-").map(Number);
      let ns = s + diff, nd = d;
      while (ns >= 48) { ns -= 48; nd = (nd + 1) % 7; }
      while (ns < 0) { ns += 48; nd = (nd - 1 + 7) % 7; }
      c[`${nd}-${ns}`] = "available";
    }
    return c;
  };
  const myConverted = compare ? convertMyAvail() : {};

  const isShared = (p) => sharedBossKeys.has(p.id);

  const fmtSlot = (s) => { const h = Math.floor(s / 2); const m = (s % 2) * 30; return `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(m).padStart(2, "0")}${h < 12 ? "a" : "p"}`; };
  const LABEL_W = 50;
  const HEADER_H = 44;
  const ROW_H = 28;
  const resetSlot = (() => { const off = -new Date(now.toLocaleString("en-US", { timeZone: tz })).getTimezoneOffset(); return ((Math.round(-off / 30) % 48) + 48) % 48; })();

  return (
    <div style={{ minHeight: "100vh", background: "#0b0e1a url('/Background.png?v=2') center center / cover fixed", color: "#e2e8f0", fontFamily: "'Comfortaa',sans-serif" }}>
      <style>{globalCSS}</style>
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", background: "radial-gradient(ellipse at center,rgba(0,0,0,.2) 0%,rgba(0,0,0,.65) 100%)" }} />
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", borderBottom: "1px solid rgba(30,36,64,.6)", background: "rgba(11,14,26,.88)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50, height: 54 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <img src="/logo.png?v=4" alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "contain" }} />
            <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Fredoka',sans-serif", color: "#e2e8f0" }}>Maple Scheduler</span>
          </a>
          <span style={{ fontSize: 12, color: "#64748b", marginLeft: 8 }}>Viewing {owner.username}'s schedule</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={tz} onChange={e => setTz(e.target.value)} style={{ ...S.select, fontSize: 11, padding: "4px 8px", paddingRight: 24, borderRadius: 6 }}>
            {TIMEZONES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
          </select>
          {me && <button onClick={() => setCompare(!compare)} style={{ ...S.btnGhost, fontSize: 11, ...(compare ? S.btnActive : {}) }}>
            {compare ? "\u2713 Comparing" : "Compare My Schedule"}
          </button>}
          {me && myParties && <button onClick={() => setSharedOnly(!sharedOnly)} style={{ ...S.btnGhost, fontSize: 11, ...(sharedOnly ? { color: "#f59e0b", borderColor: "rgba(245,158,11,.3)", background: "rgba(245,158,11,.1)" } : {}) }}>
            {sharedOnly ? "\u2713 Shared Bosses" : "Shared Bosses"}
          </button>}
          {!me && <a href="/auth/discord" style={{ ...S.btnGhost, textDecoration: "none", fontSize: 11 }}>Login to Compare</a>}
        </div>
      </div>
      {/* Vertical schedule grid */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 20px", position: "relative", zIndex: 1 }}>
        <div ref={shareGridRef} style={{ ...BACKDROP, padding: 16 }}>
          <div style={{ display: "flex", height: HEADER_H }}>
            <div style={{ width: LABEL_W, flexShrink: 0 }} />
            {viewerDayOrder.map(di => (
              <div key={di} style={{ flex: 1, textAlign: "center", padding: "6px 0", fontSize: 13, fontWeight: 700, color: "#e2e8f0", fontFamily: "'Fredoka',sans-serif", borderBottom: "1px solid rgba(30,36,64,.6)" }}>
                {DAYS_SHORT[di]}<div style={{ fontSize: 10, color: "#64748b", fontWeight: 400, marginTop: 1 }}>{byDay[di]?.length || 0} boss{byDay[di]?.length !== 1 ? "es" : ""}</div>
              </div>
            ))}
          </div>
          {/* Grid body */}
          <div style={{ display: "flex", height: 48 * ROW_H, position: "relative" }}>
            {/* Time labels */}
            <div style={{ width: LABEL_W, flexShrink: 0, position: "relative" }}>
              {Array.from({ length: 48 }, (_, si) => {
                if (si % 2 !== 0) return null;
                const h = Math.floor(si / 2);
                return <div key={si} style={{ position: "absolute", top: si * ROW_H, right: 4, fontSize: 9, color: "#475569", lineHeight: 1, fontFamily: "'Comfortaa',sans-serif" }}>
                  {h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`}
                </div>;
              })}
            </div>
            {/* Day columns */}
            {viewerDayOrder.map(dayIdx => (
              <div key={dayIdx} style={{ flex: 1, position: "relative", borderLeft: "1px solid rgba(255,255,255,.06)" }}>
                {Array.from({ length: 48 }, (_, si) => {
                  const myFree = compare && myConverted[`${dayIdx}-${si}`] === "available";
                  const isHour = si % 2 === 0 && si > 0;
                  const isReset = si === resetSlot;
                  return <div key={si} style={{
                    position: "absolute", top: si * ROW_H, left: 0, right: 0, height: ROW_H,
                    background: myFree ? "rgba(34,197,94,.15)" : "rgba(20,24,41,.5)",
                    borderTop: isReset ? "none" : isHour ? "1px dashed rgba(255,255,255,.12)" : "none",
                  }} />;
                })}
                {(byDay[dayIdx] || []).map(p => {
                  const startS = p._viewSlot;
                  const durS = Math.max(1, Math.ceil((p.duration || 30) / 30));
                  const visTop = startS * ROW_H;
                  const blockH = durS * ROW_H;
                  const b = p.bosses?.[0]; const dc = DIFF_COLORS[b?.difficulty] || "#94a3b8"; const solo = p.members?.length === 1;
                  const mc = p.members?.length || 1;
                  const sizeLabel = mc === 1 ? "Solo" : mc === 2 ? "Duo" : mc === 3 ? "Trio" : mc === 4 ? "Quad" : `${mc}p`;
                  const shared = isShared(p);
                  const dimmed = sharedOnly && !shared;
                  return (
                    <div key={p.id}
                      onMouseEnter={e => { setHoverParty(p); setHoverPos(smartTip(e)); }}
                      onMouseMove={e => hoverParty?.id === p.id && setHoverPos(smartTip(e))}
                      onMouseLeave={() => setHoverParty(null)}
                      style={{
                      position: "absolute", top: visTop + 1, left: 2, right: 2,
                      height: blockH - 2, borderRadius: 5, cursor: "default", zIndex: 3,
                      padding: "2px 4px", overflow: "hidden",
                      background: solo ? "rgba(160,70,70,.85)" : "rgba(20,24,41,.92)",
                      border: `2px solid ${solo ? "#c45c5c" : dc}`,
                      boxShadow: `0 0 6px ${dc}33`,
                      fontFamily: "'Comfortaa',sans-serif",
                      display: "flex", flexDirection: "column", justifyContent: "space-between",
                      opacity: dimmed ? 0.15 : 1,
                      transition: "opacity .3s",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 3, overflow: "hidden" }}>
                        <DiffBadge difficulty={b?.difficulty} inline />
                        <span style={{ fontSize: 10, fontWeight: 700, color: solo ? "#fca5a5" : "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b?.bossName}</span>
                      </div>
                      {blockH > 28 && <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 8, color: "rgba(255,255,255,.5)", fontWeight: 600 }}>{fmtSlot(startS)}</span>
                        <span style={{ fontSize: 7, color: "#94a3b8" }}>{sizeLabel}</span>
                      </div>}
                      {blockH > 40 && <span style={{ fontSize: 9, color: "rgba(255,255,255,.5)" }}>{p.members?.[0]?.charName || ""}</span>}
                    </div>
                  );
                })}
              </div>
            ))}
            {/* Reset line */}
            {resetSlot >= 0 && resetSlot < 48 && (
              <div style={{ position: "absolute", left: LABEL_W, right: 0, top: resetSlot * ROW_H, height: 0, borderTop: "2px solid rgba(239,68,68,.6)", pointerEvents: "none", zIndex: 5 }}>
                <span style={{ position: "absolute", right: 4, top: -12, fontSize: 8, color: "#f87171", fontWeight: 700, background: "rgba(11,14,26,.8)", padding: "1px 4px", borderRadius: 2 }}>0:00 UTC</span>
              </div>
            )}
          </div>
          {(compare || sharedOnly) && <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 9, color: "#94a3b8", fontFamily: "'Comfortaa',sans-serif" }}>
            {compare && <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "rgba(34,197,94,.15)", marginRight: 3, verticalAlign: "middle" }} />My Available</span>}
            {sharedOnly && <span style={{ color: "#f59e0b" }}>{sharedBossKeys.size} shared boss{sharedBossKeys.size !== 1 ? "es" : ""} highlighted</span>}
          </div>}
        </div>
      </div>
      {hoverParty && hoverPos && <PartyHoverCard party={hoverParty} currentUserId={owner.username} style={hoverPos} />}
    </div>
  );
}



/* ═══ MAIN APP ═══ */
export default function App() {
  const [user, setUser] = useState(undefined);
  const [allUsers, setAllUsers] = useState([]);
  const [parties, setParties] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [createDefaults, setCreateDefaults] = useState({});
  const [showProfile, setShowProfile] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminUser, setAdminUser] = useState(null);
  const [adminSearch, setAdminSearch] = useState("");
  const [selectedParty, setSelectedParty] = useState(null);
  const [trash, setTrash] = useState({});
  const [view, setView] = useState("schedule");
  const [slideDir, setSlideDir] = useState(null);
  const [slideKey, setSlideKey] = useState(0);
  const navTo = (newView) => {
    if (newView === view) return;
    const viewOrder = { schedule: 0, characters: 1, party: 2 };
    setSlideDir(viewOrder[newView] > viewOrder[view] ? "right" : "left");
    setSlideKey(k => k + 1);
    setView(newView);
    setSelectedParty(null);
  };
  const [loading, setLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);

  // Pre-load share token if user has one
  useEffect(() => { if (user?.shareToken) setShareUrl(`${window.location.origin}/share/${user.shareToken}`); }, [user]);

  useEffect(() => { (async () => {
    try { const d = await API.get("/api/me"); setUser(d); if (d) { const p = await API.get("/api/parties"); setParties(p || {}); const u = await API.get("/api/users"); setAllUsers(u || []); } } catch { setUser(null); }
    setLoading(false);
  })(); }, []);

  useEffect(() => { if (!user) return; const iv = setInterval(async () => { try { const p = await API.get("/api/parties"); if (p) setParties(p); const u = await API.get("/api/users"); if (u) setAllUsers(u); } catch {} }, 8000); return () => clearInterval(iv); }, [user]);

  // Deep-link to a specific party via /party/:id
  const partyLinkHandled = useRef(false);
  useEffect(() => {
    if (partyLinkHandled.current || !user || Object.keys(parties).length === 0) return;
    const m = window.location.pathname.match(/^\/party\/([a-z0-9]+)$/);
    if (m && parties[m[1]]) {
      setSelectedParty(parties[m[1]]);
      setView("party");
      partyLinkHandled.current = true;
      window.history.replaceState({}, "", "/");
    } else if (m) {
      partyLinkHandled.current = true;
      window.history.replaceState({}, "", "/");
    }
  }, [user, parties]);

  // Check if we're on a /share/ route — AFTER all hooks
  const shareMatch = window.location.pathname.match(/^\/share\/([a-f0-9]+)$/);
  if (shareMatch) return <ShareView token={shareMatch[1]} />;

  const save = async np => { setParties(np); try { await API.put("/api/parties", np); } catch {} };
  const handleCreate = async p => { await save({ ...parties, [p.id]: p }); setShowCreate(false); setCreateDefaults({}); setSelectedParty(p); setView("party"); };
  const handleDelete = async id => {
    const p = parties[id];
    if (p) {
      // Save pre-deletion time info, move to trash
      setTrash(prev => ({ ...prev, [id]: { ...p, _preDeleteDay: p.utcDay, _preDeleteHour: p.utcHour, _preDeleteMin: p.utcMin, _deletedAt: Date.now() } }));
    }
    const np = { ...parties }; delete np[id]; await save(np);
    if (selectedParty?.id === id) { setSelectedParty(null); setView("schedule"); }
  };
  const handleRecover = async id => {
    const p = trash[id];
    if (!p) return;
    // Recover with no scheduled time
    const recovered = { ...p, utcDay: null, utcHour: null, utcMin: null };
    delete recovered._deletedAt;
    await save({ ...parties, [id]: recovered });
    setTrash(prev => { const c = { ...prev }; delete c[id]; return c; });
  };
  const handlePermDelete = id => { setTrash(prev => { const c = { ...prev }; delete c[id]; return c; }); };
  const handleUpdateParty = async p => { await save({ ...parties, [p.id]: p }); setSelectedParty(p); };
  const handleBatchUpdate = async (partyArr) => {
    const np = { ...parties };
    partyArr.forEach(p => { np[p.id] = p; });
    await save(np);
    // Keep selected party in sync
    const sel = partyArr.find(p => p.id === selectedParty?.id);
    if (sel) setSelectedParty(sel);
  };
  const handleSaveProfile = async s => { try { const u = await API.patch("/api/me", s); setUser(p => ({ ...p, ...u })); } catch { setUser(p => ({ ...p, ...s })); } };
  const openParty = p => { setSelectedParty(p); setSlideDir("right"); setSlideKey(k => k + 1); setView("party"); };
  const openCreate = (bn, d, cn) => { setCreateDefaults({ boss: bn, diff: d, char: cn }); setShowCreate(true); };
  const handleCreateSolo = async (bossName, charName) => {
    const bossObj = BOSSES.find(b => b.name === bossName);
    if (!bossObj || bossObj.diffs.length === 0) return;
    // Default to first difficulty
    const diff = bossObj.diffs[0];
    const drops = getDropsForBoss(bossName, diff);
    const monthly = isMonthlyBoss(bossName, diff);
    const party = {
      id: genId(), leaderId: user.id,
      members: [{ userId: user.id, charName, isTemp: false, isLead: true }],
      maxMembers: getMaxParty(bossName, diff),
      bosses: [{ id: "b0", bossName, difficulty: diff }],
      utcDay: null, utcHour: null, utcMin: null, duration: 30, notes: "",
      ...(monthly ? { isMonthly: true, scheduledDate: null } : {}),
      drops: drops.map((d, i) => ({ id: `d${i}`, bossId: "b0", itemName: d.name, method: null, eligible: [], priority: [] })),
    };
    await save({ ...parties, [party.id]: party });
  };
  const handleSkipBoss = async (bossName, charName, undoSkip) => {
    if (undoSkip) {
      const skipId = Object.keys(parties).find(id => parties[id].skipped && parties[id]._skipChar?.toLowerCase() === charName.toLowerCase() && (parties[id].leaderId === user.id || parties[id].leaderId === user.username) && parties[id].bosses?.some(b => b.bossName === bossName));
      if (skipId) { const np = { ...parties }; delete np[skipId]; await save(np); }
    } else {
      const skipEntry = {
        id: `skip_${genId()}`, skipped: true, _skipChar: charName, _skipUser: user.id,
        bosses: [{ id: "b0", bossName, difficulty: "" }],
        members: [], leaderId: user.id,
      };
      await save({ ...parties, [skipEntry.id]: skipEntry });
    }
  };

  const generateShare = async () => {
    if (shareUrl) { doCopy(shareUrl); return; }
    try {
      const r = await fetch("/api/me/share", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!r.ok) { const txt = await r.text(); throw new Error(`HTTP ${r.status}: ${txt}`); }
      const d = await r.json();
      if (!d.token) throw new Error("No token returned");
      const url = `${window.location.origin}/share/${d.token}`;
      setShareUrl(url);
      doCopy(url);
    } catch (e) { console.error("Share error:", e); alert("Failed to generate share link: " + e.message); }
  };
  const regenerateShare = async () => {
    try {
      const r = await fetch("/api/me/share/regenerate", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      const url = `${window.location.origin}/share/${d.token}`;
      setShareUrl(url);
      doCopy(url);
    } catch (e) { console.error("Regenerate error:", e); }
  };
  const doCopy = (text) => {
    try {
      // Fallback: textarea method works everywhere
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy");
      document.body.removeChild(ta);
      setShareCopied(true); setTimeout(() => setShareCopied(false), 2000);
    } catch { try { navigator.clipboard.writeText(text); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); } catch {} }
  };

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b0e1a url('/Background.png?v=2') center center / cover fixed", color: "#64748b", fontFamily: "'Comfortaa',sans-serif" }}><style>{globalCSS}</style><div style={{ animation: "pulse 1.5s infinite" }}>Loading...</div></div>;
  if (!user) return <><style>{globalCSS}</style><LoginPage /></>;

  return (
    <div style={{ minHeight: "100vh", background: "#0b0e1a url('/Background.png?v=2') center center / cover fixed", color: "#e2e8f0", fontFamily: "'Comfortaa',sans-serif", position: "relative" }}>
      <style>{globalCSS}</style>
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", background: "radial-gradient(ellipse at center,rgba(0,0,0,.2) 0%,rgba(0,0,0,.65) 100%)" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", borderBottom: "1px solid rgba(30,36,64,.6)", background: "rgba(11,14,26,.88)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50, height: 54 }}>
        <div onClick={() => navTo("schedule")} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}><img src="/logo.png?v=4" alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "contain" }} /><span style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Fredoka',sans-serif", color: "#e2e8f0" }}>Maple Scheduler</span></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button style={S.btnPrimary} onClick={() => { setCreateDefaults({}); setShowCreate(true); }}>＋ Create Party</button>
          <button onClick={() => navTo("schedule")} style={{ ...S.btnGhost, ...(view === "schedule" ? S.btnActive : {}) }}>Schedule</button>
          <button onClick={() => navTo("characters")} style={{ ...S.btnGhost, ...(view === "characters" ? S.btnActive : {}) }}>Characters</button>
          <button style={{ ...S.btnGhost, display: "flex", alignItems: "center", gap: 6 }} onClick={() => setShowProfile(true)}>{user.avatar && <img src={user.avatar} style={{ width: 20, height: 20, borderRadius: "50%" }} alt="" />}{user.username}</button>
          {user.isAdmin && <button onClick={() => setShowAdmin(true)} style={{ ...S.btnGhost, fontSize: 11, padding: "5px 10px", color: "#f59e0b", borderColor: "rgba(245,158,11,.3)" }}>⚙ Admin</button>}
        </div>
      </div>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 20px", position: "relative", zIndex: 1, overflow: "hidden" }}>
        <div key={slideKey} style={{ animation: slideDir ? `${slideDir === "right" ? "slideFromRight" : "slideFromLeft"} .25s ease` : "none" }}>
        {view === "party" && selectedParty ? (
          <PartyPage party={selectedParty} allParties={parties} allUsers={allUsers} currentUser={user} onUpdate={handleUpdateParty} onBatchUpdate={handleBatchUpdate} onDelete={handleDelete} onBack={() => navTo("schedule")} />
        ) : view === "characters" ? (
          <CharactersView parties={parties} user={user} onCreateParty={openCreate} onClickParty={openParty} onCreateSolo={handleCreateSolo} onSkipBoss={handleSkipBoss} onSaveProfile={handleSaveProfile} />
        ) : (
          <ScheduleView parties={parties} user={user} onClickParty={openParty} onUpdateParty={handleUpdateParty} trash={trash} onRecover={handleRecover} onPermDelete={handlePermDelete} onShare={generateShare} shareCopied={shareCopied} />
        )}
        </div>
      </div>
      {showCreate && <CreatePartyModal onClose={() => { setShowCreate(false); setCreateDefaults({}); }} onSave={handleCreate} currentUser={user} defaultBoss={createDefaults.boss} defaultDiff={createDefaults.diff} defaultChar={createDefaults.char} />}
      {showProfile && <ProfileModal user={user} onClose={() => setShowProfile(false)} onSave={handleSaveProfile} />}
      {showAdmin && <div style={S.overlay} onClick={() => { setShowAdmin(false); setAdminUser(null); setAdminSearch(""); }}><div style={{ ...S.modal, width: "min(540px,92vw)" }} onClick={e => e.stopPropagation()}>
        <div style={S.modalHead}><span style={S.modalTitle}>Admin — Manage User Characters</span><button style={S.closeBtn} onClick={() => { setShowAdmin(false); setAdminUser(null); setAdminSearch(""); }}>✕</button></div>
        <div style={S.modalBody}>
          {!adminUser ? <>
            <label style={S.label}>Discord Username</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input style={S.input} placeholder="Enter Discord username..." value={adminSearch} onChange={e => setAdminSearch(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && adminSearch.trim()) {
                API.get(`/api/admin/user/${encodeURIComponent(adminSearch.trim())}`).then(d => { if (!d || d.error) alert(d?.error || "User not found"); else setAdminUser(d); });
              }}} />
              <button style={{ ...S.btnPrimary, whiteSpace: "nowrap" }} onClick={() => {
                if (!adminSearch.trim()) return;
                API.get(`/api/admin/user/${encodeURIComponent(adminSearch.trim())}`).then(d => { if (!d || d.error) alert(d?.error || "User not found"); else setAdminUser(d); });
              }}>Search</button>
            </div>
          </> : <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              {adminUser.avatar && <img src={adminUser.avatar} style={{ width: 32, height: 32, borderRadius: "50%" }} alt="" />}
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", fontFamily: "'Fredoka',sans-serif" }}>{adminUser.username}</div>
                <div style={{ fontSize: 10, color: "#64748b", fontFamily: "'Comfortaa',sans-serif" }}>ID: {adminUser.id}</div>
              </div>
              <button onClick={() => setAdminUser(null)} style={{ ...S.btnGhost, fontSize: 10, padding: "3px 10px", marginLeft: "auto" }}>← Back</button>
            </div>
            <AdminCharManager user={adminUser} onUpdate={(newChars) => {
              API.patch(`/api/admin/user/${encodeURIComponent(adminUser.username)}`, { characters: newChars })
                .then(() => setAdminUser(prev => ({ ...prev, characters: newChars })))
                .catch(e => alert("Save failed: " + e.message));
            }} />
          </>}
        </div>
      </div></div>}
    </div>
  );
}
