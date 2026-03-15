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
  "Lotus": [{ name: "Total Control", diffs: ["Extreme"] }, { name: "Berserked", diffs: ["Hard", "Extreme"] }],
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
const DIFF_ABBR = { Easy: "E", Normal: "N", Hard: "H", Chaos: "C", Extreme: "X" };
const DIFF_COLORS = { Easy: "#858585", Normal: "#32AAB0", Hard: "#B93062", Chaos: "#EA6C2B", Extreme: "#EA6C2B" };
const ACCENT = "#2563eb", ACCENT_LIGHT = "rgba(37,99,235,0.15)", ACCENT_BORDER = "rgba(37,99,235,0.3)";
const SOLO_COLOR = "#c45c5c", SOLO_BG = "rgba(196,92,92,0.18)", SOLO_BORDER = "rgba(196,92,92,0.35)";
const BACKDROP = { background: "rgba(11,14,26,0.82)", backdropFilter: "blur(8px)", borderRadius: 14, border: "1px solid rgba(30,36,64,0.6)" };
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIMEZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu", "America/Toronto", "America/Vancouver", "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Asia/Seoul", "Asia/Shanghai", "Asia/Singapore", "Australia/Sydney", "America/Sao_Paulo", "America/Mexico_City", "UTC"];
function getMaxParty(b, d) { if (b === "Lotus" && d === "Extreme") return 2; if (["Adversary", "Limbo", "Baldrix"].includes(b)) return 3; return 6; }
function getDropsForBoss(b, d) { return (BOSS_DROPS[b] || []).filter(x => x.diffs === null || x.diffs.includes(d)); }
const offsetMin = new Date().getTimezoneOffset();
const RESET_SLOT = ((Math.round(-offsetMin / 30) % 48) + 48) % 48;

/* ═══ API ═══ */
const API = {
  async get(p) { const r = await fetch(p, { credentials: "include" }); if (r.status === 401) return null; return r.json(); },
  async patch(p, b) { return (await fetch(p, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })).json(); },
  async put(p, b) { return (await fetch(p, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })).json(); },
};

/* ═══ IMAGE CACHE ═══ */
const imgCache = {};
function useCharImage(name) {
  const [img, setImg] = useState(imgCache[name] || null);
  useEffect(() => {
    if (!name || imgCache[name] !== undefined) { setImg(imgCache[name] || null); return; }
    imgCache[name] = null;
    API.get(`/api/nexon/${encodeURIComponent(name)}`).then(d => { if (d?.imgUrl) { imgCache[name] = d.imgUrl; setImg(d.imgUrl); } });
  }, [name]);
  return img;
}

/* ═══ STYLES ═══ */
const globalCSS = `@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Comfortaa:wght@300;400;500;600;700&display=swap');
@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
*{box-sizing:border-box;margin:0;padding:0}body{background:#0b0e1a}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:3px}
input::placeholder,textarea::placeholder{color:#475569}select option{background:#141829;color:#e2e8f0}`;

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
  const img = useCharImage(name);
  if (img) return <img src={img} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: "2px solid #1e2440", ...extra }} />;
  return <div style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg,${ACCENT},#1d4ed8)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 700, color: "#fff", ...extra }}>{(name?.[0] || "?").toUpperCase()}</div>;
}

/* ═══ IGN POPUP ═══ */
function IGNPopup({ title, hint, onConfirm, onClose }) {
  const [ign, setIgn] = useState(""); const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div style={S.popOverlay} onClick={() => onClose("TBD")}><div style={S.popBox} onClick={e => e.stopPropagation()}>
      <div style={S.popHead}><span style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0", fontFamily: "'Fredoka',sans-serif" }}>{title}</span><button style={S.closeBtn} onClick={() => onClose("TBD")}>✕</button></div>
      <div style={{ padding: "16px 20px" }}>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10, fontFamily: "'Comfortaa',sans-serif" }}>{hint}</div>
        <input ref={ref} style={S.input} placeholder="e.g. xXSlayerXx" value={ign} onChange={e => setIgn(e.target.value)} onKeyDown={e => { if (e.key === "Enter") onConfirm(ign.trim() || "TBD"); if (e.key === "Escape") onClose("TBD"); }} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}><button style={S.btnGhost} onClick={() => onClose("TBD")}>Skip</button><button style={S.btnGreen} onClick={() => onConfirm(ign.trim() || "TBD")}>Confirm</button></div>
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

  const openIgnD = () => { const n = discordInput.trim(); if (!n || members.length >= maxP) return; setIgnPopup({ type: "discord", discordName: n }); };
  const openIgnT = () => { if (members.length >= maxP) return; setIgnPopup({ type: "temp" }); };
  const handleIgn = (ign) => {
    if (ignPopup.type === "discord") { setMembers(p => [...p, { userId: ignPopup.discordName, charName: ign, isTemp: false }]); setDiscordInput(""); }
    else setMembers(p => [...p, { userId: `temp_${Date.now()}`, charName: ign || "TBD", isTemp: true }]);
    setIgnPopup(null); setTimeout(() => inputRef.current?.focus(), 50);
  };
  const rmMember = i => setMembers(p => p.filter((_, j) => j !== i));
  const drops = boss && diff ? getDropsForBoss(boss, diff) : [];

  const save = () => {
    if (!boss || (!diff && boss !== "Other")) return;
    onSave({
      id: Date.now().toString(36), leaderId: currentUser.id, members, maxMembers: maxP,
      bosses: [{ id: "b0", bossName: boss, difficulty: diff }],
      utcDay: null, utcHour: null, utcMin: null, duration: 30, notes: "",
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
    {ignPopup && <IGNPopup title={ignPopup.type === "discord" ? `IGN for ${ignPopup.discordName}` : "Temp Character Name"} hint={ignPopup.type === "discord" ? "In-game character name? Skip for TBD." : "Character name for temp member."} onConfirm={handleIgn} onClose={handleIgn} />}
    </div>
  );
}

/* ═══ PARTY PAGE — full page with schedule cross-ref, loot ═══ */
function PartyPage({ party, allParties, allUsers, currentUser, onUpdate, onDelete, onBack }) {
  const boss = party.bosses?.[0];
  const diffColor = DIFF_COLORS[boss?.difficulty] || "#94a3b8";
  const drops = boss ? getDropsForBoss(boss.bossName, boss.difficulty) : [];
  const isLead = party.leaderId === currentUser?.id;
  const [settingTime, setSettingTime] = useState(false);
  const [timeAnchor, setTimeAnchor] = useState(null);
  const [timeHover, setTimeHover] = useState(null);
  const [hoverTime, setHoverTime] = useState(null); // { day, slot } for tooltip
  const [confirmDelete, setConfirmDelete] = useState(false);
  const gridRef = useRef(null);

  const memberUsers = useMemo(() => (party.members?.map(m => ({ ...m, availability: allUsers.find(u => u.id === m.userId)?.availability || {} })) || []), [party.members, allUsers]);
  const otherParties = useMemo(() => { const allP = Object.values(allParties || {}); const map = {}; party.members?.forEach(m => { map[m.userId] = allP.filter(p => p.id !== party.id && p.utcDay != null && p.members?.some(pm => pm.userId === m.userId)); }); return map; }, [allParties, party]);

  const getSlot = (e) => { if (!gridRef.current) return null; const r = gridRef.current.getBoundingClientRect(); const d = Math.floor((e.clientX - r.left - 36) / ((r.width - 36) / 7)); const s = Math.floor((e.clientY - r.top - 22) / ((r.height - 22) / 48)); return d < 0 || d > 6 || s < 0 || s > 47 ? null : { day: d, slot: s }; };
  const slotToTime = (s) => { const h = Math.floor(s / 2); const m = (s % 2) * 30; return `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(m).padStart(2, "0")}${h < 12 ? "a" : "p"}`; };
  const onGridClick = (e) => { if (!settingTime) return; const pos = getSlot(e); if (!pos) return; if (!timeAnchor) setTimeAnchor(pos); else { if (pos.day === timeAnchor.day) { const ss = Math.min(timeAnchor.slot, pos.slot); const es = Math.max(timeAnchor.slot, pos.slot); const durSlots = Math.min(es - ss + 1, 4); /* max 4 slots = 2hrs */ const durMin = durSlots * 30; onUpdate({ ...party, utcDay: pos.day, utcHour: Math.floor(ss / 2), utcMin: (ss % 2) * 30, duration: durMin }); } setSettingTime(false); setTimeAnchor(null); setTimeHover(null); } };
  const onGridMove = (e) => { const pos = getSlot(e); setHoverTime(pos); if (settingTime) setTimeHover(pos); };
  const getCellInfo = (day, slot) => { let ac = 0; memberUsers.forEach(m => { if (m.availability[`${day}-${slot}`] === "available") ac++; }); let bc = 0; party.members?.forEach(m => { (otherParties[m.userId] || []).forEach(op => { if (op.utcDay === day) { const os = op.utcHour * 2 + (op.utcMin >= 30 ? 1 : 0); const od = Math.max(1, Math.ceil((op.duration || 30) / 30)); if (slot >= os && slot < os + od) bc++; } }); }); return { ac, tot: memberUsers.length, bc }; };
  const getTimePrev = () => { if (!timeAnchor || !timeHover || timeAnchor.day !== timeHover.day) return new Set(); const s = new Set(); const mn = Math.min(timeAnchor.slot, timeHover.slot); const mx = Math.max(timeAnchor.slot, timeHover.slot); const capped = Math.min(mx, mn + 3); for (let i = mn; i <= capped; i++) s.add(`${timeAnchor.day}-${i}`); return s; };
  const timePrev = settingTime ? getTimePrev() : new Set();
  const partySlots = useMemo(() => { if (party.utcDay == null) return new Set(); const s = new Set(); const ss = party.utcHour * 2 + (party.utcMin >= 30 ? 1 : 0); const dur = Math.max(1, Math.ceil((party.duration || 30) / 30)); for (let i = ss; i < ss + dur && i < 48; i++) s.add(`${party.utcDay}-${i}`); return s; }, [party.utcDay, party.utcHour, party.utcMin, party.duration]);

  const updateDrop = (dropId, field, value) => { onUpdate({ ...party, drops: (party.drops || []).map(d => d.id === dropId ? { ...d, [field]: value } : d) }); };
  const toggleEligible = (dropId, userId) => { const dr = party.drops?.find(d => d.id === dropId); if (!dr) return; const e = dr.eligible || []; updateDrop(dropId, "eligible", e.includes(userId) ? e.filter(x => x !== userId) : [...e, userId]); };
  const setPrioFn = (dropId, userId, pos) => { const dr = party.drops?.find(d => d.id === dropId); if (!dr) return; let p = [...(dr.priority || [])].filter(x => x !== userId); if (pos > 0) p.splice(pos - 1, 0, userId); updateDrop(dropId, "priority", p); };

  return (
    <div style={{ display: "flex", gap: 16, minHeight: "calc(100vh - 94px)", alignItems: "flex-start" }}>
      {/* ── LEFT PANEL ── */}
      <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Boss info + controls */}
        <div style={{ ...BACKDROP, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <button style={{ ...S.btnGhost, padding: "4px 10px", fontSize: 11 }} onClick={onBack}>←</button>
            <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Fredoka',sans-serif", color: "#e2e8f0" }}>{boss?.bossName}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: `${diffColor}22`, color: diffColor }}>{boss?.difficulty}</span>
          </div>
          {party.utcDay != null && (() => { const ss = party.utcHour * 2 + (party.utcMin >= 30 ? 1 : 0); const dur = Math.max(1, Math.ceil((party.duration || 30) / 30)); const es = Math.min(ss + dur, 48); return <div style={{ fontSize: 11, color: ACCENT, fontWeight: 600, fontFamily: "'Comfortaa',sans-serif", marginBottom: 6 }}>Perm: {DAYS_SHORT[party.utcDay]} {slotToTime(ss)} – {slotToTime(es)}</div>; })()}
          {party.utcDay == null && <div style={{ fontSize: 11, color: "#475569", fontFamily: "'Comfortaa',sans-serif", marginBottom: 6 }}>Unscheduled</div>}
          {isLead && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button style={{ fontSize: 11, padding: "5px 12px", borderRadius: 8, border: `1px solid ${settingTime ? ACCENT_BORDER : "#1e2440"}`, cursor: "pointer", fontWeight: 700, fontFamily: "'Comfortaa',sans-serif", background: settingTime ? ACCENT_LIGHT : "rgba(255,255,255,.04)", color: settingTime ? ACCENT : "#94a3b8" }} onClick={() => { setSettingTime(!settingTime); setTimeAnchor(null); setTimeHover(null); }}>{settingTime ? "✓ Done" : "✎ Edit"}</button>
            {party.utcDay != null && !settingTime && <button onClick={() => onUpdate({ ...party, utcDay: null, utcHour: null, utcMin: null })} style={{ ...S.btnGhost, fontSize: 11, padding: "5px 10px", color: "#f59e0b", borderColor: "rgba(245,158,11,.2)" }}>Unschedule</button>}
            {!confirmDelete && <button onClick={() => setConfirmDelete(true)} style={{ ...S.btnGhost, fontSize: 11, padding: "5px 10px", color: "#f87171", borderColor: "rgba(239,68,68,.2)" }}>Delete</button>}
            {confirmDelete && <>
              <button onClick={() => onDelete(party.id)} style={{ padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: "rgba(239,68,68,.25)", color: "#f87171", fontSize: 11, fontWeight: 700, fontFamily: "'Comfortaa',sans-serif" }}>Confirm</button>
              <button onClick={() => setConfirmDelete(false)} style={{ ...S.btnGhost, fontSize: 11, padding: "5px 8px" }}>No</button>
            </>}
          </div>}
        </div>

        {/* Members — names only */}
        <div style={{ ...BACKDROP, padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", fontFamily: "'Comfortaa',sans-serif", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Members ({party.members?.length}/{party.maxMembers || 6})</div>
          {party.members?.map((m, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", borderBottom: i < party.members.length - 1 ? "1px solid rgba(30,36,64,.3)" : "none" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", fontFamily: "'Comfortaa',sans-serif" }}>{m.charName}</span>
              {m.isTemp && <span style={{ ...S.tempBadge, fontSize: 8 }}>TEMP</span>}
              {i === 0 && <span style={{ ...S.leadBadge, fontSize: 7, padding: "1px 5px" }}>LEAD</span>}
            </div>
          ))}
        </div>

        {/* Loot — compact with small PNGs */}
        {drops.length > 0 && (
          <div style={{ ...BACKDROP, padding: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", fontFamily: "'Comfortaa',sans-serif", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Loot</div>
            {drops.map((drop, di) => {
              const pd = party.drops?.find(d => d.itemName === drop.name) || { method: null, eligible: [], priority: [] };
              const did = pd.id || `d${di}`;
              return (
                <div key={di} style={{ marginBottom: di < drops.length - 1 ? 12 : 0, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,.02)", border: "1px solid rgba(30,36,64,.3)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT, fontFamily: "'Fredoka',sans-serif" }}>{drop.name}</span>
                    {isLead && <div style={{ display: "flex", gap: 3 }}>
                      {["blink", "priority"].map(mt => (
                        <button key={mt} onClick={() => updateDrop(did, "method", pd.method === mt ? null : mt)}
                          style={{ ...S.btnGhost, fontSize: 9, padding: "2px 8px", ...(pd.method === mt ? S.btnActive : {}) }}>
                          {mt === "blink" ? "Blink" : "Prio"}
                        </button>
                      ))}
                    </div>}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {party.members?.map((m, mi) => {
                      const isE = pd.eligible?.includes(m.userId);
                      const pp = pd.priority?.indexOf(m.userId);
                      const hasPrio = pp != null && pp >= 0;
                      return (
                        <div key={mi} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 6px", borderRadius: 6, background: "rgba(11,14,26,.3)", minWidth: 0 }}>
                          <CharAvatar name={m.charName} size={20} style={pd.method === "blink" && isE ? { border: "1.5px solid #10b981" } : pd.method === "blink" && !isE ? { opacity: 0.3 } : pd.method === "priority" && hasPrio ? { border: "1.5px solid " + ACCENT } : pd.method === "priority" && !hasPrio ? { opacity: 0.3 } : {}} />
                          <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'Comfortaa',sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 60 }}>{m.charName}</span>
                          {pd.method === "blink" && <button onClick={() => isLead && toggleEligible(did, m.userId)} style={{ width: 14, height: 14, borderRadius: 3, border: "none", cursor: isLead ? "pointer" : "default", background: isE ? "rgba(34,197,94,.25)" : "rgba(255,255,255,.05)", color: isE ? "#10b981" : "#374151", fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{isE ? "✓" : "—"}</button>}
                          {pd.method === "priority" && (isLead ? (
                            <select value={hasPrio ? pp + 1 : ""} onChange={e => setPrioFn(did, m.userId, parseInt(e.target.value) || 0)} style={{ ...S.select, fontSize: 9, padding: "1px 4px", width: 36, backgroundImage: "none", textAlign: "center", color: hasPrio ? ACCENT : "#475569" }}>
                              <option value="">—</option>{party.members.map((_, pi) => <option key={pi} value={pi + 1}>#{pi + 1}</option>)}
                            </select>
                          ) : (
                            <span style={{ fontSize: 9, fontWeight: 700, color: hasPrio ? ACCENT : "#374151", fontFamily: "'Comfortaa',sans-serif", minWidth: 16, textAlign: "center" }}>{hasPrio ? `#${pp + 1}` : "—"}</span>
                          ))}
                          {!pd.method && <span style={{ fontSize: 8, color: "#374151" }}>—</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL — Schedule Grid ── */}
      <div style={{ flex: 1, ...BACKDROP, padding: 12, minWidth: 0 }}>
        {settingTime && <div style={{ fontSize: 11, color: "#10b981", fontFamily: "'Comfortaa',sans-serif", fontWeight: 600, marginBottom: 8 }}>Click start time, then end time{timeAnchor ? ` — started at ${slotToTime(timeAnchor.slot)} on ${DAYS_SHORT[timeAnchor.day]}` : ""}</div>}
        {/* Hover time tooltip */}
        {settingTime && hoverTime && <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'Comfortaa',sans-serif", marginBottom: 4 }}>{DAYS_SHORT[hoverTime.day]} {slotToTime(hoverTime.slot)}</div>}
        <div ref={gridRef} style={{ position: "relative", userSelect: "none", cursor: settingTime ? "pointer" : "default", height: "calc(100vh - 140px)", minHeight: 500 }}
          onClick={onGridClick} onMouseMove={onGridMove} onMouseLeave={() => { setTimeHover(null); setHoverTime(null); }}>
          <div style={{ display: "grid", gridTemplateColumns: "36px repeat(7,1fr)", height: "100%" }}>
            {/* Header */}
            <div style={{ height: 22 }} />
            {DAYS_SHORT.map(d => <div key={d} style={{ height: 22, textAlign: "center", fontSize: 10, fontWeight: 700, color: "#94a3b8", fontFamily: "'Comfortaa',sans-serif", lineHeight: "22px", borderBottom: "1px solid rgba(30,36,64,.4)" }}>{d}</div>)}
            {/* Time rows */}
            {Array.from({ length: 24 }, (_, h) => {
              const slot = h * 2;
              return [
                <div key={`l${h}`} style={{ fontSize: 8, color: "#475569", textAlign: "right", paddingRight: 4, fontFamily: "'Comfortaa',sans-serif", display: "flex", alignItems: "center", justifyContent: "flex-end", borderTop: "1px solid rgba(30,36,64,.15)" }}>{h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`}</div>,
                ...Array.from({ length: 7 }, (_, di) => {
                  const info = getCellInfo(di, slot);
                  const isSch = partySlots.has(`${di}-${slot}`) || partySlots.has(`${di}-${slot + 1}`);
                  const isPr = timePrev.has(`${di}-${slot}`) || timePrev.has(`${di}-${slot + 1}`);
                  const isHov = settingTime && hoverTime && hoverTime.day === di && (hoverTime.slot === slot || hoverTime.slot === slot + 1);
                  let bg = "transparent";
                  if (isSch) bg = "rgba(37,99,235,.45)";
                  else if (isPr) bg = "rgba(37,99,235,.3)";
                  else if (isHov) bg = "rgba(37,99,235,.18)";
                  else if (info.bc > 0) bg = "rgba(251,191,36,.2)";
                  else if (info.ac === 0) bg = "rgba(239,68,68,.18)";
                  else if (info.ac === info.tot) bg = "rgba(34,197,94,.25)";
                  else if (info.ac > 0) bg = "rgba(34,197,94,.12)";
                  const is4hr = h > 0 && h % 4 === 0;
                  return <div key={`${h}-${di}`} style={{ borderTop: is4hr ? "1px solid rgba(255,255,255,.15)" : "1px solid rgba(30,36,64,.15)", borderLeft: "1px solid rgba(30,36,64,.08)", background: bg }} />;
                }),
              ];
            }).flat()}
          </div>
          {/* Reset line */}
          <div style={{ position: "absolute", left: 36, right: 0, top: 22 + (RESET_SLOT / 48) * (gridRef.current?.clientHeight - 22 || 500), height: 0, borderTop: "2px dashed rgba(239,68,68,.5)", pointerEvents: "none", zIndex: 5 }}>
            <span style={{ position: "absolute", right: 4, top: -12, fontSize: 8, color: "#f87171", fontWeight: 600, background: "rgba(11,14,26,.8)", padding: "1px 3px", borderRadius: 2 }}>0:00 UTC</span>
          </div>
        </div>
        {/* Legend */}
        <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 9, color: "#64748b", fontFamily: "'Comfortaa',sans-serif", flexWrap: "wrap" }}>
          <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "rgba(37,99,235,.45)", marginRight: 3, verticalAlign: "middle" }} />Sched</span>
          <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "rgba(34,197,94,.25)", marginRight: 3, verticalAlign: "middle" }} />Avail</span>
          <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "rgba(239,68,68,.18)", marginRight: 3, verticalAlign: "middle" }} />Busy</span>
          <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "rgba(251,191,36,.2)", marginRight: 3, verticalAlign: "middle" }} />Conflict</span>
        </div>
      </div>
    </div>
  );
}

/* ═══ PROFILE MODAL ═══ */
function ProfileModal({ user, onClose, onSave }) {
  const [tz, setTz] = useState(user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [chars, setChars] = useState(user.characters || []);
  const [newChar, setNewChar] = useState("");
  const [avail, setAvail] = useState(user.availability || {});
  const [anchor, setAnchor] = useState(null);
  const [hover, setHover] = useState(null);
  const [mode, setMode] = useState(null);
  const gridRef = useRef(null);

  const addChar = () => { const n = newChar.trim(); if (n && !chars.includes(n)) { setChars(p => [...p, n]); setNewChar(""); } };
  const rmChar = i => setChars(p => p.filter((_, j) => j !== i));
  const getSlot = (e) => { if (!gridRef.current) return null; const r = gridRef.current.getBoundingClientRect(); const d = Math.floor((e.clientX - r.left - 40) / ((r.width - 40) / 7)); const s = Math.floor((e.clientY - r.top - 24) / ((r.height - 24) / 48)); return d < 0 || d > 6 || s < 0 || s > 47 ? null : { day: d, slot: s }; };
  const getPreview = () => { if (!anchor || !hover || anchor.day !== hover.day) return new Set(); const s = new Set(); for (let i = Math.min(anchor.slot, hover.slot); i <= Math.max(anchor.slot, hover.slot); i++) s.add(`${anchor.day}-${i}`); return s; };
  const onClick = (e) => { e.preventDefault(); const pos = getSlot(e); if (!pos) return; if (!anchor) { const k = `${pos.day}-${pos.slot}`; setAnchor(pos); setMode(avail[k] === "available" ? "deselect" : "select"); } else { if (pos.day === anchor.day) { const mn = Math.min(anchor.slot, pos.slot), mx = Math.max(anchor.slot, pos.slot); setAvail(p => { const c = { ...p }; for (let s = mn; s <= mx; s++) { const k = `${pos.day}-${s}`; if (mode === "select") c[k] = "available"; else delete c[k]; } return c; }); } setAnchor(null); setHover(null); setMode(null); } };
  useEffect(() => { const h = e => { if (e.key === "Escape") { setAnchor(null); setHover(null); setMode(null); } }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, []);
  const preview = getPreview();

  return (
    <div style={S.overlay} onClick={onClose}><div style={{ ...S.modal, width: "min(720px,95vw)" }} onClick={e => e.stopPropagation()}>
      <div style={S.modalHead}><span style={S.modalTitle}>Profile Settings</span><button style={S.closeBtn} onClick={onClose}>✕</button></div>
      <div style={S.modalBody}>
        <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
          <div style={{ flex: 1 }}><label style={S.label}>Discord</label><div style={{ ...S.input, background: "rgba(11,14,26,.3)", color: "#64748b" }}>{user.username}</div></div>
          <div style={{ flex: 1 }}><label style={S.label}>Timezone</label><select style={{ ...S.select, width: "100%" }} value={tz} onChange={e => setTz(e.target.value)}>{TIMEZONES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}</select></div>
        </div>
        <div style={{ marginBottom: 20 }}><label style={S.label}>Your Characters (IGNs)</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}><input style={S.input} placeholder="Add character IGN..." value={newChar} onChange={e => setNewChar(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addChar(); } }} /><button style={{ ...S.btnPrimary, whiteSpace: "nowrap", opacity: newChar.trim() ? 1 : .4 }} onClick={addChar}>＋ Add</button></div>
          {chars.length > 0 ? <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{chars.map((c, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 8, fontSize: 13, color: ACCENT, background: ACCENT_LIGHT, border: `1px solid ${ACCENT_BORDER}`, fontFamily: "'Comfortaa',sans-serif" }}>{c}<button onClick={() => rmChar(i)} style={{ width: 16, height: 16, borderRadius: 4, border: "none", cursor: "pointer", background: "rgba(239,68,68,.2)", color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>✕</button></div>)}</div> : <div style={{ fontSize: 13, color: "#475569" }}>No characters added yet.</div>}
        </div>
        <label style={S.label}>Availability</label>
        <div ref={gridRef} style={{ position: "relative", userSelect: "none", cursor: anchor ? "pointer" : "crosshair", background: "rgba(11,14,26,.4)", borderRadius: 8, border: "1px solid #1e2440", overflow: "hidden", height: 420 }}
          onClick={onClick} onMouseMove={e => setHover(getSlot(e))} onMouseLeave={() => setHover(null)}>
          <div style={{ display: "flex", height: 24 }}><div style={{ width: 40, flexShrink: 0 }} />{DAYS_SHORT.map(d => <div key={d} style={{ flex: 1, textAlign: "center", fontSize: 10, fontWeight: 600, color: "#64748b", lineHeight: "24px", fontFamily: "'Comfortaa',sans-serif" }}>{d}</div>)}</div>
          <div style={{ display: "flex", height: 396 }}>
            <div style={{ width: 40, flexShrink: 0, position: "relative" }}>{Array.from({ length: 24 }, (_, h) => <div key={h} style={{ position: "absolute", top: `${(h * 2 / 48) * 100}%`, right: 4, fontSize: 9, color: "#475569", lineHeight: 1, transform: "translateY(-50%)" }}>{h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`}</div>)}</div>
            {Array.from({ length: 7 }, (_, di) => <div key={di} style={{ flex: 1, display: "flex", flexDirection: "column", borderLeft: "1px solid rgba(255,255,255,.03)" }}>{Array.from({ length: 48 }, (_, si) => { const k = `${di}-${si}`; const v = avail[k]; const ip = preview.has(k); const ia = anchor && anchor.day === di && anchor.slot === si; return <div key={si} style={{ flex: 1, minHeight: 0, background: v === "available" ? (ip && mode === "deselect" ? "rgba(239,68,68,.25)" : "rgba(34,197,94,.4)") : ip && mode === "select" ? "rgba(34,197,94,.2)" : ia ? (mode === "deselect" ? "rgba(239,68,68,.3)" : "rgba(34,197,94,.3)") : "transparent", borderBottom: si % 2 === 1 ? "1px solid rgba(255,255,255,.03)" : "none", transition: "background .08s" }} />; })}</div>)}
          </div>
          <div style={{ position: "absolute", left: 40, right: 0, top: 24 + (RESET_SLOT / 48) * 396, height: 0, borderTop: "2px dashed rgba(239,68,68,.6)", pointerEvents: "none" }}>
            <span style={{ position: "absolute", right: 4, top: -14, fontSize: 9, color: "#f87171", fontWeight: 600, background: "rgba(11,14,26,.8)", padding: "1px 4px", borderRadius: 3, fontFamily: "'Comfortaa',sans-serif" }}>0:00 UTC</span>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
          <button style={{ ...S.btnGhost, color: "#f87171", borderColor: "rgba(239,68,68,.2)" }} onClick={() => setAvail({})}>Clear All</button>
          <div style={{ display: "flex", gap: 10 }}><button style={S.btnGhost} onClick={onClose}>Cancel</button><button style={S.btnPrimary} onClick={() => onSave({ timezone: tz, characters: chars, availability: avail })}>Save Settings</button></div>
        </div>
      </div>
    </div></div>
  );
}

/* ═══ SCHEDULE VIEW — drag & drop with magnetization, undo, duration ═══ */
function ScheduleView({ parties, user, onClickParty, onUpdateParty, trash, onRecover, onPermDelete }) {
  const partyList = Object.values(parties || {});
  const avail = user.availability || {};
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState(null);
  const [dragPos, setDragPos] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const gridRef = useRef(null);

  const HEADER_H = 44;
  const ROW_H = 18;
  const SLOT_COUNT = 48;
  const LABEL_W = 50;

  const byDay = useMemo(() => {
    const m = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], unscheduled: [] };
    partyList.forEach(p => { if (p.utcDay != null) (m[p.utcDay] || []).push(p); else m.unscheduled.push(p); });
    for (let i = 0; i < 7; i++) m[i].sort((a, b) => (a.utcHour * 60 + a.utcMin) - (b.utcHour * 60 + b.utcMin));
    return m;
  }, [partyList]);

  // Smart visible range — condensed to relevant hours, full in edit mode
  const visRange = useMemo(() => {
    if (editing) return { start: 0, end: 48 };
    let rawMin = RESET_SLOT - 12, rawMax = RESET_SLOT + 12;
    for (let d = 0; d < 7; d++) for (let s = 0; s < 48; s++) { if (avail[`${d}-${s}`] === "available") { rawMin = Math.min(rawMin, s); rawMax = Math.max(rawMax, s + 1); } }
    partyList.forEach(p => { if (p.utcDay != null) { const ss = p.utcHour * 2 + (p.utcMin >= 30 ? 1 : 0); const dur = Math.max(1, Math.ceil((p.duration || 30) / 30)); rawMin = Math.min(rawMin, ss); rawMax = Math.max(rawMax, ss + dur); } });
    return { start: Math.max(0, rawMin - 1), end: Math.min(48, rawMax + 1) };
  }, [editing, avail, partyList]);

  const visSlots = visRange.end - visRange.start;
  const gridH = visSlots * ROW_H;

  // Duration in 30-min slots
  const getDurSlots = (p) => Math.max(0.5, (p.duration || 30) / 30);
  const getStartSlot = (p) => p.utcHour * 2 + (p.utcMin >= 30 ? 1 : 0);
  const fmtSlot = (s) => { const h = Math.floor(s / 2); const m = (s % 2) * 30; return `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(m).padStart(2, "0")}${h < 12 ? "a" : "p"}`; };
  const fmtRange = (p) => { const ss = getStartSlot(p); const es = ss + Math.ceil(getDurSlots(p)); return `${fmtSlot(ss)}–${fmtSlot(Math.min(es, 48))}`; };

  // Get occupied slots per day (excluding a specific party id)
  const getOccupied = useCallback((day, excludeId) => {
    const occ = new Set();
    (byDay[day] || []).forEach(p => {
      if (p.id === excludeId) return;
      const start = getStartSlot(p);
      const dur = Math.ceil(getDurSlots(p));
      for (let s = start; s < start + dur && s < SLOT_COUNT; s++) occ.add(s);
    });
    return occ;
  }, [byDay]);

  // Magnetize: find nearest valid position that doesn't overlap
  const magnetize = useCallback((day, targetSlot, durSlots, excludeId) => {
    const occ = getOccupied(day, excludeId);
    const ceilDur = Math.ceil(durSlots);
    const fits = (s) => { for (let i = s; i < s + ceilDur && i < SLOT_COUNT; i++) { if (occ.has(i)) return false; } return s >= 0 && s + ceilDur <= SLOT_COUNT; };
    if (fits(targetSlot)) return targetSlot;
    // Search outward
    for (let offset = 1; offset < SLOT_COUNT; offset++) {
      if (fits(targetSlot - offset)) return targetSlot - offset;
      if (fits(targetSlot + offset)) return targetSlot + offset;
    }
    return null; // no space
  }, [getOccupied]);

  // Grid slot from mouse event
  const getGridSlot = (e) => {
    if (!gridRef.current) return null;
    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const day = Math.floor((x - LABEL_W) / ((rect.width - LABEL_W) / 7));
    const slot = visRange.start + Math.floor((y - HEADER_H) / ((rect.height - HEADER_H) / visSlots));
    if (day < 0 || day > 6 || slot < visRange.start || slot >= visRange.end) return null;
    return { day, slot };
  };

  // Drag handlers
  const onDragStart = (p) => (e) => {
    setDragging(p);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", p.id);
  };

  const onGridDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const pos = getGridSlot(e);
    setDragPos(pos);
  };

  const onGridDrop = (e) => {
    e.preventDefault();
    if (!dragging || !dragPos) { setDragging(null); setDragPos(null); return; }
    const durSlots = getDurSlots(dragging);
    const snapped = magnetize(dragPos.day, dragPos.slot, durSlots, dragging.id);
    if (snapped != null) {
      const h = Math.floor(snapped / 2);
      const m = (snapped % 2) * 30;
      // Save undo
      setUndoStack(prev => [...prev, { id: dragging.id, utcDay: dragging.utcDay, utcHour: dragging.utcHour, utcMin: dragging.utcMin }]);
      onUpdateParty({ ...dragging, utcDay: dragPos.day, utcHour: h, utcMin: m });
    }
    setDragging(null);
    setDragPos(null);
  };

  const onGridDragLeave = () => setDragPos(null);

  const undo = () => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    const p = partyList.find(x => x.id === last.id);
    if (p) onUpdateParty({ ...p, utcDay: last.utcDay, utcHour: last.utcHour, utcMin: last.utcMin });
    setUndoStack(prev => prev.slice(0, -1));
  };

  // Duration change for unscheduled
  const changeDuration = (p, delta) => {
    const cur = p.duration || 30;
    const next = Math.max(15, Math.min(120, cur + delta));
    onUpdateParty({ ...p, duration: next });
  };

  // Compute preview for drag
  const dragPreview = useMemo(() => {
    if (!dragging || !dragPos) return null;
    const durSlots = getDurSlots(dragging);
    const snapped = magnetize(dragPos.day, dragPos.slot, durSlots, dragging.id);
    if (snapped == null) return null;
    const h = Math.floor(snapped / 2);
    const m = (snapped % 2) * 30;
    return { day: dragPos.day, startSlot: snapped, durSlots, timeStr: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` };
  }, [dragging, dragPos, magnetize]);

  const isAvail = (d, s) => avail[`${d}-${s}`] === "available";

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      {/* ── LEFT COLUMN — Edit + Unscheduled + Deleted ── */}
      <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Edit controls */}
        <div style={{ ...BACKDROP, padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: editing ? 8 : 0 }}>
            <button onClick={() => { setEditing(!editing); if (editing) { setDragging(null); setDragPos(null); } }}
              style={{ fontSize: 12, padding: "5px 14px", borderRadius: 8, border: `1px solid ${editing ? ACCENT_BORDER : "#1e2440"}`, cursor: "pointer", fontWeight: 700, fontFamily: "'Comfortaa',sans-serif", background: editing ? ACCENT_LIGHT : "rgba(255,255,255,.04)", color: editing ? ACCENT : "#94a3b8" }}>
              {editing ? "✓ Done" : "✎ Edit Schedule"}
            </button>
            {undoStack.length > 0 && <button onClick={undo} style={{ ...S.btnGhost, fontSize: 11, padding: "4px 10px", color: "#f87171", borderColor: "rgba(239,68,68,.2)" }}>↩ Undo</button>}
          </div>
          {editing && <div style={{ fontSize: 10, color: "#64748b", fontFamily: "'Comfortaa',sans-serif" }}>Drag parties to reschedule</div>}
        </div>

        {/* Unscheduled — drop zone in edit mode */}
        <div style={{ ...BACKDROP, padding: 12, ...(editing && dragging && dragging.utcDay != null ? { border: "2px dashed rgba(251,191,36,.4)", background: "rgba(251,191,36,.04)" } : {}) }}
          onDragOver={editing ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } : undefined}
          onDrop={editing ? (e) => { e.preventDefault(); if (dragging && dragging.utcDay != null) { setUndoStack(prev => [...prev, { id: dragging.id, utcDay: dragging.utcDay, utcHour: dragging.utcHour, utcMin: dragging.utcMin }]); onUpdateParty({ ...dragging, utcDay: null, utcHour: null, utcMin: null }); } setDragging(null); setDragPos(null); } : undefined}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 8, fontFamily: "'Fredoka',sans-serif" }}>Unscheduled</div>
          {byDay.unscheduled.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {byDay.unscheduled.map(p => {
                const b = p.bosses?.[0]; const dc = DIFF_COLORS[b?.difficulty] || "#94a3b8"; const solo = p.members?.length === 1; const dur = p.duration || 30;
                return (
                  <div key={p.id} draggable={editing} onDragStart={editing ? onDragStart(p) : undefined} style={{ padding: "8px 10px", borderRadius: 8, cursor: editing ? "grab" : "pointer", background: solo ? SOLO_BG : `${dc}10`, border: `1px solid ${solo ? SOLO_BORDER : dc + "25"}`, userSelect: "none" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                      <div onClick={() => !editing && onClickParty(p)} style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", fontFamily: "'Fredoka',sans-serif" }}>{b?.bossName}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, marginLeft: 6, padding: "1px 5px", borderRadius: 4, background: `${dc}22`, color: dc }}>{b?.difficulty}</span>
                        {solo && <span style={{ fontSize: 9, fontWeight: 700, marginLeft: 4, color: SOLO_COLOR }}>Solo</span>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => changeDuration(p, -15)} style={{ width: 18, height: 18, borderRadius: 3, border: "1px solid rgba(30,36,64,.6)", background: "rgba(11,14,26,.4)", color: "#94a3b8", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
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
        </div>

        {/* Recently Deleted */}
        {Object.keys(trash || {}).length > 0 && (
          <div style={{ ...BACKDROP, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 8, fontFamily: "'Fredoka',sans-serif" }}>Recently Deleted</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {Object.values(trash).map(p => {
                const b = p.bosses?.[0]; const dc = DIFF_COLORS[b?.difficulty] || "#94a3b8";
                const preTime = p._preDeleteDay != null ? `${DAYS_SHORT[p._preDeleteDay]} ${String(p._preDeleteHour).padStart(2, "0")}:${String(p._preDeleteMin).padStart(2, "0")}` : "—";
                return (
                  <div key={p.id} style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,.02)", border: "1px dashed rgba(239,68,68,.15)", opacity: 0.7 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", fontFamily: "'Fredoka',sans-serif", textDecoration: "line-through" }}>{b?.bossName}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: `${dc}22`, color: dc }}>{b?.difficulty}</span>
                    </div>
                    <div style={{ fontSize: 9, color: "#475569", fontFamily: "'Comfortaa',sans-serif", marginBottom: 6 }}>Was: {preTime}</div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => onRecover(p.id)} style={{ padding: "3px 10px", borderRadius: 5, border: "none", cursor: "pointer", background: "rgba(34,197,94,.15)", color: "#10b981", fontSize: 10, fontWeight: 700, fontFamily: "'Comfortaa',sans-serif" }}>Recover</button>
                      <button onClick={() => onPermDelete(p.id)} style={{ padding: "3px 8px", borderRadius: 5, border: "none", cursor: "pointer", background: "rgba(239,68,68,.1)", color: "#f87171", fontSize: 10, fontFamily: "'Comfortaa',sans-serif" }}>✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT — Schedule Grid ── */}
      <div style={{ ...BACKDROP, padding: 16, position: "relative", flex: 1, minWidth: 0 }}>
        <div ref={gridRef} style={{ position: "relative", overflow: "hidden" }}
          onDragOver={editing ? onGridDragOver : undefined} onDrop={editing ? onGridDrop : undefined} onDragLeave={editing ? onGridDragLeave : undefined}>
          <div style={{ display: "flex", height: HEADER_H }}>
            <div style={{ width: LABEL_W, flexShrink: 0 }} />
            {DAYS_SHORT.map((d, i) => (
              <div key={d} style={{ flex: 1, textAlign: "center", padding: "6px 0", fontSize: 13, fontWeight: 700, color: "#e2e8f0", fontFamily: "'Fredoka',sans-serif", borderBottom: "1px solid rgba(30,36,64,.6)" }}>
                {d}<div style={{ fontSize: 10, color: "#64748b", fontWeight: 400, marginTop: 1 }}>{byDay[i]?.length || 0} boss{byDay[i]?.length !== 1 ? "es" : ""}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", height: gridH }}>
            <div style={{ width: LABEL_W, flexShrink: 0, position: "relative" }}>
              {Array.from({ length: visSlots }, (_, vi) => {
                const si = visRange.start + vi;
                const h = Math.floor(si / 2);
                if (si % 2 !== 0) return null;
                return <div key={vi} style={{ position: "absolute", top: vi * ROW_H, right: 4, fontSize: 9, color: "#475569", lineHeight: 1, fontFamily: "'Comfortaa',sans-serif" }}>
                  {h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`}
                </div>;
              })}
            </div>
            {Array.from({ length: 7 }, (_, dayIdx) => (
              <div key={dayIdx} style={{ flex: 1, position: "relative", borderLeft: "1px solid rgba(30,36,64,.15)" }}>
                {Array.from({ length: visSlots }, (_, vi) => {
                  const si = visRange.start + vi;
                  const hasA = isAvail(dayIdx, si);
                  const is4hr = si % 8 === 0 && si > 0;
                  return <div key={vi} style={{
                    position: "absolute", top: vi * ROW_H, left: 0, right: 0, height: ROW_H,
                    background: hasA ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.08)",
                    borderBottom: is4hr ? "1px solid rgba(255,255,255,.15)" : si % 2 === 1 ? "1px solid rgba(30,36,64,.15)" : "1px solid rgba(30,36,64,.06)",
                  }} />;
                })}
                {(byDay[dayIdx] || []).map(p => {
                  const startS = getStartSlot(p); const durS = getDurSlots(p);
                  if (startS + durS <= visRange.start || startS >= visRange.end) return null;
                  const visTop = (startS - visRange.start) * ROW_H;
                  const b = p.bosses?.[0]; const dc = DIFF_COLORS[b?.difficulty] || "#94a3b8"; const solo = p.members?.length === 1;
                  const timeRange = fmtRange(p);
                  return (
                    <div key={p.id} draggable={editing} onDragStart={editing ? onDragStart(p) : undefined}
                      onClick={() => !editing && onClickParty(p)} style={{
                      position: "absolute", top: visTop + 1, left: 2, right: 2,
                      height: durS * ROW_H - 2, borderRadius: 5, cursor: editing ? "grab" : "pointer", zIndex: 3,
                      padding: "2px 5px", overflow: "hidden",
                      background: solo ? SOLO_BG : `${dc}30`,
                      border: "1.5px solid rgba(255,255,255,.5)",
                      boxShadow: "0 0 6px rgba(255,255,255,.15)",
                      fontSize: 9, fontWeight: 700, color: solo ? SOLO_COLOR : dc, fontFamily: "'Comfortaa',sans-serif",
                      display: "flex", flexDirection: "column", justifyContent: "center",
                      ...(editing ? { outline: `1px dashed ${dc}88` } : {}),
                    }}>
                      <div>{solo ? "Solo" : b?.bossName}{!solo && <span style={{ fontWeight: 400, opacity: .7 }}> · {p.members?.length}p</span>}</div>
                      <div style={{ fontSize: 8, opacity: .8, fontWeight: 500 }}>{timeRange}</div>
                    </div>
                  );
                })}
                {editing && dragPreview && dragPreview.day === dayIdx && (() => {
                  const visTop = (dragPreview.startSlot - visRange.start) * ROW_H;
                  return <div style={{ position: "absolute", top: visTop, left: 2, right: 2, height: dragPreview.durSlots * ROW_H, borderRadius: 5, zIndex: 10, background: "rgba(37,99,235,.2)", border: `2px dashed ${ACCENT}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: ACCENT, fontWeight: 700, fontFamily: "'Comfortaa',sans-serif", pointerEvents: "none" }}>
                    {dragging?.bosses?.[0]?.bossName} — {dragPreview.timeStr}
                  </div>;
                })()}
                  </div>
                )}
              </div>
            ))}
          </div>
          {RESET_SLOT >= visRange.start && RESET_SLOT < visRange.end && (
            <div style={{ position: "absolute", left: LABEL_W, right: 0, top: HEADER_H + (RESET_SLOT - visRange.start) * ROW_H, height: 0, borderTop: "2px dashed rgba(239,68,68,.5)", pointerEvents: "none", zIndex: 8 }}>
              <span style={{ position: "absolute", right: 4, top: -13, fontSize: 8, color: "#f87171", fontWeight: 600, background: "rgba(11,14,26,.8)", padding: "1px 3px", borderRadius: 2 }}>0:00 UTC</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
/* ═══ CHARACTERS VIEW ═══ */
function CharactersView({ parties, user, onCreateParty, onClickParty }) {
  const pl = Object.values(parties || {}); const chars = user.characters || [];
  if (chars.length === 0) return <div style={{ ...BACKDROP, textAlign: "center", padding: "60px 20px" }}><div style={{ fontSize: 15, fontWeight: 500, fontFamily: "'Comfortaa',sans-serif", color: "#94a3b8" }}>No characters registered</div><div style={{ fontSize: 13, marginTop: 6, color: "#64748b" }}>Go to Profile Settings to add your IGNs</div></div>;
  const find = (cn, bn) => pl.find(p => p.members?.some(m => m.charName?.toLowerCase() === cn.toLowerCase()) && p.bosses?.some(b => b.bossName === bn));
  return (
    <div style={{ ...BACKDROP, padding: "4px 0", overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'Comfortaa',sans-serif" }}>
        <thead><tr>
          <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "#64748b", fontWeight: 600, borderBottom: "2px solid rgba(30,36,64,.6)", position: "sticky", left: 0, background: "rgba(11,14,26,.95)", zIndex: 2, minWidth: 140 }}>Boss</th>
          {chars.map(c => <th key={c} style={{ padding: "12px 16px", textAlign: "center", fontSize: 13, color: ACCENT, fontWeight: 700, borderBottom: "2px solid rgba(30,36,64,.6)", fontFamily: "'Fredoka',sans-serif", minWidth: 130 }}>{c}</th>)}
        </tr></thead>
        <tbody>{BOSS_ORDER.map(bn => <tr key={bn} style={{ borderBottom: "1px solid rgba(30,36,64,.4)" }}>
          <td style={{ padding: "12px 16px", position: "sticky", left: 0, background: "rgba(11,14,26,.95)", zIndex: 1 }}><span style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", fontFamily: "'Fredoka',sans-serif" }}>{bn}</span></td>
          {chars.map(cn => { const p = find(cn, bn);
            if (p) { const b = p.bosses?.[0]; const dc = DIFF_COLORS[b?.difficulty] || "#94a3b8"; const solo = p.members?.length === 1;
              if (solo) return <td key={cn} style={{ padding: "8px 12px", textAlign: "center" }}><button onClick={() => onClickParty(p)} style={{ padding: "5px 14px", borderRadius: 6, border: `1px solid ${SOLO_BORDER}`, cursor: "pointer", background: SOLO_BG, color: SOLO_COLOR, fontSize: 11, fontWeight: 700, fontFamily: "'Comfortaa',sans-serif" }}>Solo</button></td>;
              return <td key={cn} style={{ padding: "8px 12px", textAlign: "center" }}><button onClick={() => onClickParty(p)} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${dc}33`, cursor: "pointer", background: `${dc}18`, color: dc, fontSize: 11, fontWeight: 700, fontFamily: "'Comfortaa',sans-serif" }}>{b?.difficulty} · {p.members?.length}p</button></td>;
            }
            return <td key={cn} style={{ padding: "8px 12px", textAlign: "center" }}><button onClick={() => onCreateParty(bn, "", cn)} style={{ padding: "5px 14px", borderRadius: 6, border: "1px dashed rgba(30,36,64,.6)", cursor: "pointer", background: "rgba(11,14,26,.4)", color: "#475569", fontSize: 11, fontFamily: "'Comfortaa',sans-serif", transition: "all .15s" }}
              onMouseEnter={e => { e.target.style.borderColor = ACCENT; e.target.style.color = ACCENT; }} onMouseLeave={e => { e.target.style.borderColor = "rgba(30,36,64,.6)"; e.target.style.color = "#475569"; }}>+ Create</button></td>;
          })}</tr>)}</tbody>
      </table>
    </div>
  );
}

/* ═══ LOGIN PAGE ═══ */
function LoginPage() {
  return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b0e1a url('/Background.png') center center / cover fixed", fontFamily: "'Comfortaa',sans-serif" }}>
    <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at center,transparent 20%,rgba(0,0,0,.7) 100%)", pointerEvents: "none" }} />
    <div style={{ textAlign: "center", padding: 40, background: "rgba(20,24,41,.85)", border: "1px solid #1e2440", borderRadius: 20, backdropFilter: "blur(12px)", boxShadow: "0 24px 80px rgba(0,0,0,.4)", animation: "slideUp .3s ease", position: "relative", zIndex: 1 }}>
      <img src="/logo.png" alt="" style={{ width: 80, height: 80, borderRadius: 16, margin: "0 auto 16px", display: "block", objectFit: "contain" }} />
      <h1 style={{ fontSize: 26, fontWeight: 700, color: "#e2e8f0", marginBottom: 8, fontFamily: "'Fredoka',sans-serif" }}>Maple Scheduler</h1>
      <p style={{ fontSize: 14, color: "#64748b", marginBottom: 28, maxWidth: 300 }}>Organize your GMS bossing parties!</p>
      <a href="/auth/discord" style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "12px 28px", borderRadius: 10, textDecoration: "none", background: "#5865F2", color: "#fff", fontWeight: 600, fontSize: 15, boxShadow: "0 4px 20px rgba(88,101,242,.4)" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
        Sign in with Discord
      </a>
    </div>
  </div>;
}

/* ═══ MAIN APP ═══ */
export default function App() {
  const [user, setUser] = useState(undefined);
  const [allUsers, setAllUsers] = useState([]);
  const [parties, setParties] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [createDefaults, setCreateDefaults] = useState({});
  const [showProfile, setShowProfile] = useState(false);
  const [selectedParty, setSelectedParty] = useState(null);
  const [trash, setTrash] = useState({});
  const [view, setView] = useState("schedule");
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    try { const d = await API.get("/api/me"); setUser(d); if (d) { const p = await API.get("/api/parties"); setParties(p || {}); const u = await API.get("/api/users"); setAllUsers(u || []); } } catch { setUser(null); }
    setLoading(false);
  })(); }, []);

  useEffect(() => { if (!user) return; const iv = setInterval(async () => { try { const p = await API.get("/api/parties"); if (p) setParties(p); const u = await API.get("/api/users"); if (u) setAllUsers(u); } catch {} }, 8000); return () => clearInterval(iv); }, [user]);

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
  const handleSaveProfile = async s => { try { const u = await API.patch("/api/me", s); setUser(p => ({ ...p, ...u })); } catch { setUser(p => ({ ...p, ...s })); } setShowProfile(false); };
  const openParty = p => { setSelectedParty(p); setView("party"); };
  const openCreate = (bn, d, cn) => { setCreateDefaults({ boss: bn, diff: d, char: cn }); setShowCreate(true); };

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b0e1a url('/Background.png') center center / cover fixed", color: "#64748b", fontFamily: "'Comfortaa',sans-serif" }}><style>{globalCSS}</style><div style={{ animation: "pulse 1.5s infinite" }}>Loading...</div></div>;
  if (!user) return <><style>{globalCSS}</style><LoginPage /></>;

  return (
    <div style={{ minHeight: "100vh", background: "#0b0e1a url('/Background.png') center center / cover fixed", color: "#e2e8f0", fontFamily: "'Comfortaa',sans-serif", position: "relative" }}>
      <style>{globalCSS}</style>
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", background: "radial-gradient(ellipse at center,rgba(0,0,0,.2) 0%,rgba(0,0,0,.65) 100%)" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", borderBottom: "1px solid rgba(30,36,64,.6)", background: "rgba(11,14,26,.88)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50, height: 54 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}><img src="/logo.png" alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "contain" }} /><span style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Fredoka',sans-serif", color: "#e2e8f0" }}>Maple Scheduler</span></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => { setView("schedule"); setSelectedParty(null); }} style={{ ...S.btnGhost, ...(view === "schedule" ? S.btnActive : {}) }}>Schedule</button>
          <button onClick={() => { setView("characters"); setSelectedParty(null); }} style={{ ...S.btnGhost, ...(view === "characters" ? S.btnActive : {}) }}>Characters</button>
          <button style={S.btnPrimary} onClick={() => { setCreateDefaults({}); setShowCreate(true); }}>＋ Create Party</button>
          <button style={{ ...S.btnGhost, display: "flex", alignItems: "center", gap: 6 }} onClick={() => setShowProfile(true)}>{user.avatar && <img src={user.avatar} style={{ width: 20, height: 20, borderRadius: "50%" }} alt="" />}{user.username}</button>
          <a href="/auth/logout" style={{ ...S.btnGhost, textDecoration: "none", fontSize: 12 }}>Logout</a>
        </div>
      </div>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 20px", position: "relative", zIndex: 1 }}>
        {view === "party" && selectedParty ? (
          <PartyPage party={selectedParty} allParties={parties} allUsers={allUsers} currentUser={user} onUpdate={handleUpdateParty} onDelete={handleDelete} onBack={() => { setView("schedule"); setSelectedParty(null); }} />
        ) : view === "characters" ? (
          <CharactersView parties={parties} user={user} onCreateParty={openCreate} onClickParty={openParty} />
        ) : (
          <ScheduleView parties={parties} user={user} onClickParty={openParty} onUpdateParty={handleUpdateParty} trash={trash} onRecover={handleRecover} onPermDelete={handlePermDelete} />
        )}
      </div>
      {showCreate && <CreatePartyModal onClose={() => { setShowCreate(false); setCreateDefaults({}); }} onSave={handleCreate} currentUser={user} defaultBoss={createDefaults.boss} defaultDiff={createDefaults.diff} defaultChar={createDefaults.char} />}
      {showProfile && <ProfileModal user={user} onClose={() => setShowProfile(false)} onSave={handleSaveProfile} />}
    </div>
  );
}
