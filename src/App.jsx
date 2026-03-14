import { useState, useEffect, useRef, useCallback, useMemo } from "react";

/* ════════════════════════════════════════════════════════════
   BOSSES, DROPS, CONSTANTS
   ════════════════════════════════════════════════════════════ */
const BOSSES = [
  { name: "Lotus",      diffs: ["Normal", "Hard", "Extreme"] },
  { name: "Ctene",      diffs: ["Chaos"] },
  { name: "Black Mage", diffs: ["Hard", "Extreme"] },
  { name: "Seren",      diffs: ["Normal", "Hard", "Extreme"] },
  { name: "Kalos",      diffs: ["Easy", "Normal", "Chaos", "Extreme"] },
  { name: "Adversary",  diffs: ["Easy", "Normal", "Hard", "Extreme"] },
  { name: "Kaling",     diffs: ["Easy", "Normal", "Hard", "Extreme"] },
  { name: "Limbo",      diffs: ["Normal", "Hard"] },
  { name: "Baldrix",    diffs: ["Normal", "Hard"] },
  { name: "Other",      diffs: [""] },
];

const BOSS_DROPS = {
  "Lotus": [
    { name: "Total Control", diffs: ["Extreme"] },
    { name: "Berserked", diffs: ["Hard", "Extreme"] },
  ],
  "Ctene": [{ name: "Pitched Boss", diffs: null }],
  "Black Mage": [
    { name: "Genesis Badge", diffs: null },
    { name: "Enhancement Hammer", diffs: ["Extreme"] },
  ],
  "Seren": [
    { name: "Mitra's Rage", diffs: null },
    { name: "Enhancement Hammer", diffs: ["Extreme"] },
  ],
  "Kalos": [
    { name: "Grindstone of Life", diffs: ["Normal", "Chaos", "Extreme"] },
    { name: "Enhancement Hammer", diffs: ["Extreme"] },
  ],
  "Adversary": [
    { name: "Grindstone of Life", diffs: ["Normal", "Hard", "Extreme"] },
    { name: "Immortal Legacy", diffs: ["Hard", "Extreme"] },
    { name: "Enhancement Hammer", diffs: ["Extreme"] },
  ],
  "Kaling": [
    { name: "Grindstone of Life", diffs: ["Normal"] },
    { name: "Grindstone of Faith", diffs: ["Hard", "Extreme"] },
    { name: "Enhancement Hammer", diffs: ["Extreme"] },
  ],
  "Limbo": [
    { name: "Grindstone of Faith", diffs: null },
    { name: "Whisper of the Source", diffs: ["Hard"] },
  ],
  "Baldrix": [
    { name: "Grindstone of Faith", diffs: null },
    { name: "Oath of Death", diffs: ["Hard"] },
    { name: "Enhancement Hammer", diffs: ["Extreme"] },
  ],
  "Other": [],
};

// Characters view order (weakest → strongest)
const BOSS_ORDER = ["Baldrix", "Limbo", "Kaling", "Adversary", "Kalos", "Seren", "Black Mage", "Lotus", "Ctene", "Other"];

const DIFF_ABBR = { Easy: "E", Normal: "N", Hard: "H", Chaos: "C", Extreme: "X" };
const DIFF_COLORS = { Easy: "#3a9e6a", Normal: "#5b8dd9", Hard: "#e07b39", Chaos: "#c9393a", Extreme: "#9b59b6" };

function getMaxParty(bossName, diff) {
  if (bossName === "Lotus" && diff === "Extreme") return 2;
  if (["Adversary", "Limbo", "Baldrix"].includes(bossName)) return 3;
  return 6;
}

function getDropsForBoss(bossName, diff) {
  const drops = BOSS_DROPS[bossName] || [];
  return drops.filter(d => d.diffs === null || d.diffs.includes(diff));
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Anchorage", "Pacific/Honolulu", "America/Toronto", "America/Vancouver",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo",
  "Asia/Seoul", "Asia/Shanghai", "Asia/Singapore", "Australia/Sydney",
  "America/Sao_Paulo", "America/Mexico_City", "UTC",
];

/* ════════════════════════════════════════════════════════════
   API HELPER
   ════════════════════════════════════════════════════════════ */
const API = {
  async get(p) { const r = await fetch(p, { credentials: "include" }); if (r.status === 401) return null; return r.json(); },
  async post(p, b) { return (await fetch(p, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })).json(); },
  async patch(p, b) { return (await fetch(p, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })).json(); },
  async put(p, b) { return (await fetch(p, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })).json(); },
};

/* ════════════════════════════════════════════════════════════
   STYLES
   ════════════════════════════════════════════════════════════ */
const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Nunito:wght@400;600;700&display=swap');
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.5 } }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0b0e1a; }
  ::-webkit-scrollbar { width: 6px }
  ::-webkit-scrollbar-track { background: transparent }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px }
  input::placeholder, textarea::placeholder { color: #475569 }
  select option { background: #141829; color: #e2e8f0; }
`;

const S = {
  overlay: { position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.15s ease" },
  modal: { background: "linear-gradient(160deg, #141829 0%, #0b0e1a 100%)", border: "1px solid #1e2440", borderRadius: 16, width: "min(540px, 92vw)", maxHeight: "85vh", overflow: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.5)", animation: "slideUp 0.2s ease" },
  modalHead: { padding: "16px 22px", borderBottom: "1px solid #1e2440", display: "flex", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { fontSize: 17, fontWeight: 700, color: "#e2e8f0", fontFamily: "'Cinzel', serif" },
  modalBody: { padding: "18px 22px" },
  closeBtn: { width: 30, height: 30, borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(255,255,255,0.06)", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 },
  label: { fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'Nunito', sans-serif" },
  input: { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #1e2440", background: "rgba(11,14,26,0.6)", color: "#e2e8f0", fontSize: 14, outline: "none", fontFamily: "'Nunito', sans-serif" },
  select: { padding: "10px 14px", borderRadius: 8, border: "1px solid #1e2440", background: "rgba(11,14,26,0.6)", color: "#e2e8f0", fontSize: 14, outline: "none", cursor: "pointer", fontFamily: "'Nunito', sans-serif", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2394a3b8' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 32 },
  btnPrimary: { padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #c9a227, #a3841e)", color: "#fff", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6, fontFamily: "'Nunito', sans-serif", boxShadow: "0 2px 12px rgba(201,162,39,0.3)" },
  btnGhost: { padding: "8px 14px", borderRadius: 8, border: "1px solid #1e2440", background: "rgba(255,255,255,0.04)", color: "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Nunito', sans-serif" },
  btnActive: { background: "rgba(201,162,39,0.12)", color: "#c9a227", borderColor: "rgba(201,162,39,0.3)" },
  btnGreen: { padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", fontWeight: 600, fontSize: 13, fontFamily: "'Nunito', sans-serif" },
  addTempBtn: { padding: "8px 16px", borderRadius: 8, border: "1px dashed rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.06)", color: "#fbbf24", cursor: "pointer", fontWeight: 600, fontSize: 12, marginTop: 10, fontFamily: "'Nunito', sans-serif", display: "flex", alignItems: "center", gap: 6 },
  card: { background: "#141829", border: "1px solid #1e2440", borderRadius: 14, overflow: "hidden", transition: "transform 0.2s, box-shadow 0.2s" },
  tempBadge: { fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(251,191,36,0.15)", color: "#fbbf24", marginLeft: 4 },
  tbdBadge: { fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(239,68,68,0.12)", color: "#f87171", marginLeft: 4 },
  leadBadge: { fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "rgba(201,162,39,0.15)", color: "#c9a227" },
  popOverlay: { position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.12s ease" },
  popBox: { background: "linear-gradient(160deg, #141829 0%, #0b0e1a 100%)", border: "1px solid #1e2440", borderRadius: 14, width: "min(380px, 88vw)", boxShadow: "0 16px 60px rgba(0,0,0,0.5)", animation: "slideUp 0.18s ease" },
  popHead: { padding: "14px 18px", borderBottom: "1px solid #1e2440", display: "flex", justifyContent: "space-between", alignItems: "center" },
};

/* ════════════════════════════════════════════════════════════
   IGN POPUP
   ════════════════════════════════════════════════════════════ */
function IGNPopup({ title, hint, onConfirm, onClose }) {
  const [ign, setIgn] = useState("");
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div style={S.popOverlay} onClick={() => onClose("TBD")}>
      <div style={S.popBox} onClick={e => e.stopPropagation()}>
        <div style={S.popHead}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0", fontFamily: "'Cinzel', serif" }}>{title}</span>
          <button style={S.closeBtn} onClick={() => onClose("TBD")}>✕</button>
        </div>
        <div style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10, fontFamily: "'Nunito', sans-serif" }}>{hint}</div>
          <input ref={ref} style={S.input} placeholder="e.g. xXSlayerXx" value={ign} onChange={e => setIgn(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") onConfirm(ign.trim() || "TBD"); if (e.key === "Escape") onClose("TBD"); }} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button style={S.btnGhost} onClick={() => onClose("TBD")}>Skip</button>
            <button style={S.btnGreen} onClick={() => onConfirm(ign.trim() || "TBD")}>Confirm</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   CREATE PARTY MODAL
   ════════════════════════════════════════════════════════════ */
function CreatePartyModal({ onClose, onSave, currentUser }) {
  const [boss, setBoss] = useState("");
  const [diff, setDiff] = useState("");
  const [day, setDay] = useState("Monday");
  const [time, setTime] = useState("20:00");
  const [members, setMembers] = useState([]);
  const [discordInput, setDiscordInput] = useState("");
  const [ignPopup, setIgnPopup] = useState(null);
  const inputRef = useRef(null);
  const bossObj = BOSSES.find(b => b.name === boss);
  const maxParty = boss && diff ? getMaxParty(boss, diff) : 6;

  useEffect(() => {
    if (currentUser && members.length === 0 && currentUser.characters?.length > 0) {
      setMembers([{ userId: currentUser.id, charName: currentUser.characters[0], isTemp: false, isLead: true }]);
    } else if (currentUser && members.length === 0) {
      setMembers([{ userId: currentUser.id, charName: currentUser.username, isTemp: false, isLead: true }]);
    }
  }, [currentUser]);

  const openIgnForDiscord = () => {
    const name = discordInput.trim();
    if (!name || members.length >= maxParty) return;
    setIgnPopup({ type: "discord", discordName: name });
  };

  const openIgnForTemp = () => {
    if (members.length >= maxParty) return;
    setIgnPopup({ type: "temp" });
  };

  const handleIgnResult = (ign) => {
    if (ignPopup.type === "discord") {
      setMembers(prev => [...prev, { userId: ignPopup.discordName, charName: ign, isTemp: false }]);
      setDiscordInput("");
    } else {
      setMembers(prev => [...prev, { userId: `temp_${Date.now()}`, charName: ign || "TBD", isTemp: true }]);
    }
    setIgnPopup(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const removeMember = i => setMembers(prev => prev.filter((_, j) => j !== i));

  const drops = boss && diff ? getDropsForBoss(boss, diff) : [];

  const save = () => {
    if (!boss || !diff) return;
    onSave({
      id: Date.now().toString(36),
      leaderId: currentUser.id,
      members,
      maxMembers: maxParty,
      bosses: [{ id: "b0", bossName: boss, difficulty: diff }],
      utcDay: DAYS.indexOf(day), utcHour: parseInt(time.split(":")[0]), utcMin: parseInt(time.split(":")[1]),
      notes: "",
      drops: drops.map((d, i) => ({ id: `d${i}`, bossId: "b0", itemName: d.name, method: "blink", eligible: members.map(m => m.userId) })),
    });
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalHead}>
          <span style={S.modalTitle}>Create Party</span>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={S.modalBody}>
          {/* Boss + Difficulty */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>Boss</label>
              <select style={{ ...S.select, width: "100%" }} value={boss} onChange={e => { setBoss(e.target.value); setDiff(""); }}>
                <option value="">Select Boss</option>
                {BOSSES.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={S.label}>Difficulty</label>
              <select style={{ ...S.select, width: "100%" }} value={diff} onChange={e => setDiff(e.target.value)} disabled={!boss}>
                <option value="">Select</option>
                {bossObj?.diffs.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Max party display */}
          {boss && diff && (
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12, fontFamily: "'Nunito', sans-serif" }}>
              Max party size: <span style={{ color: "#c9a227", fontWeight: 700 }}>{maxParty}</span>
            </div>
          )}

          {/* Schedule */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>Day</label>
              <select style={{ ...S.select, width: "100%" }} value={day} onChange={e => setDay(e.target.value)}>
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={S.label}>Time</label>
              <input type="time" style={{ ...S.input, width: "100%" }} value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>

          {/* Discord Username Field */}
          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Discord Username</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input ref={inputRef} style={S.input} placeholder="Enter Discord username..."
                value={discordInput} onChange={e => setDiscordInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); openIgnForDiscord(); } }} />
              <button style={{ ...S.btnPrimary, opacity: discordInput.trim() && members.length < maxParty ? 1 : 0.4, pointerEvents: discordInput.trim() && members.length < maxParty ? "auto" : "none", whiteSpace: "nowrap" }}
                onClick={openIgnForDiscord}>＋ Add</button>
            </div>
            <button style={{ ...S.addTempBtn, opacity: members.length < maxParty ? 1 : 0.4, pointerEvents: members.length < maxParty ? "auto" : "none" }}
              onClick={openIgnForTemp}>👤 Add Temp</button>
          </div>

          {/* Member chips */}
          {members.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Party Members ({members.length}/{maxParty})</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                {members.map((m, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 8, fontSize: 12, color: "#c7d2fe",
                    background: m.isTemp ? "rgba(251,191,36,0.08)" : "rgba(201,162,39,0.08)",
                    border: `1px solid ${m.isTemp ? "rgba(251,191,36,0.2)" : "rgba(201,162,39,0.2)"}`,
                  }}>
                    <span style={{ fontWeight: 600 }}>{m.isTemp ? `🕐 ${m.charName}` : m.userId === m.charName ? m.userId : `${m.userId}`}</span>
                    {!m.isTemp && <span style={{ color: "#64748b", fontSize: 11 }}>({m.charName === "TBD" ? <span style={{ color: "#f87171" }}>TBD</span> : m.charName})</span>}
                    {m.isTemp && <span style={S.tempBadge}>TEMP</span>}
                    {m.isLead && <span style={S.leadBadge}>LEAD</span>}
                    {!m.isLead && <button onClick={() => removeMember(i)} style={{ width: 16, height: 16, borderRadius: 4, border: "none", cursor: "pointer", background: "rgba(239,68,68,0.2)", color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>✕</button>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Drops preview */}
          {drops.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Drops for {boss} ({diff})</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {drops.map((d, i) => (
                  <span key={i} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, fontFamily: "'Nunito', sans-serif", background: "rgba(201,162,39,0.1)", border: "1px solid rgba(201,162,39,0.2)", color: "#c9a227" }}>
                    {d.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
            <button style={S.btnGhost} onClick={onClose}>Cancel</button>
            <button style={{ ...S.btnPrimary, opacity: boss && diff ? 1 : 0.4, pointerEvents: boss && diff ? "auto" : "none" }} onClick={save}>Create Party</button>
          </div>
        </div>
      </div>

      {ignPopup && (
        <IGNPopup
          title={ignPopup.type === "discord" ? `Enter IGN for ${ignPopup.discordName}` : "Enter Temp Character Name"}
          hint={ignPopup.type === "discord" ? "What is this player's in-game character name? Press Skip or close to set as TBD." : "Type the character name for this temporary party member."}
          onConfirm={handleIgnResult} onClose={handleIgnResult} />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   PROFILE MODAL — with character management + availability
   ════════════════════════════════════════════════════════════ */
function ProfileModal({ user, onClose, onSave }) {
  const [tz, setTz] = useState(user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [chars, setChars] = useState(user.characters || []);
  const [newChar, setNewChar] = useState("");
  const [avail, setAvail] = useState(user.availability || {});
  const [painting, setPainting] = useState(null);
  const gridRef = useRef(null);

  const addChar = () => {
    const name = newChar.trim();
    if (name && !chars.includes(name)) { setChars(prev => [...prev, name]); setNewChar(""); }
  };
  const removeChar = (i) => setChars(prev => prev.filter((_, j) => j !== i));

  // Availability: 7 days × 48 half-hour slots, stored as { "day-slot": "available"|"unavailable" }
  const getSlot = (e) => {
    if (!gridRef.current) return null;
    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const headerH = 24;
    const labelW = 40;
    const cellW = (rect.width - labelW) / 7;
    const cellH = (rect.height - headerH) / 48;
    const day = Math.floor((x - labelW) / cellW);
    const slot = Math.floor((y - headerH) / cellH);
    if (day < 0 || day > 6 || slot < 0 || slot > 47) return null;
    return { day, slot };
  };

  const onDown = (e) => {
    e.preventDefault();
    const pos = getSlot(e);
    if (!pos) return;
    const key = `${pos.day}-${pos.slot}`;
    const cur = avail[key];
    const next = !cur ? "available" : cur === "available" ? "unavailable" : undefined;
    setPainting(next);
    setAvail(prev => {
      const copy = { ...prev };
      if (next === undefined) delete copy[key]; else copy[key] = next;
      return copy;
    });
  };

  const onMove = (e) => {
    if (painting === null) return;
    const pos = getSlot(e);
    if (!pos) return;
    const key = `${pos.day}-${pos.slot}`;
    setAvail(prev => {
      const copy = { ...prev };
      if (painting === undefined) delete copy[key]; else copy[key] = painting;
      return copy;
    });
  };

  const onUp = () => setPainting(null);

  // UTC reset line (0:00 UTC in local time)
  const offsetMin = new Date().getTimezoneOffset();
  const resetSlot = Math.round(-offsetMin / 30);
  const resetSlotNorm = ((resetSlot % 48) + 48) % 48;

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, width: "min(720px, 95vw)" }} onClick={e => e.stopPropagation()}>
        <div style={S.modalHead}>
          <span style={S.modalTitle}>Profile Settings</span>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={S.modalBody}>
          {/* Discord + Timezone */}
          <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>Discord</label>
              <div style={{ ...S.input, background: "rgba(11,14,26,0.3)", color: "#64748b" }}>{user.username}</div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={S.label}>Timezone</label>
              <select style={{ ...S.select, width: "100%" }} value={tz} onChange={e => setTz(e.target.value)}>
                {TIMEZONES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </div>
          </div>

          {/* Characters */}
          <div style={{ marginBottom: 20 }}>
            <label style={S.label}>Your Characters (IGNs)</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input style={S.input} placeholder="Add character IGN..." value={newChar} onChange={e => setNewChar(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addChar(); } }} />
              <button style={{ ...S.btnPrimary, whiteSpace: "nowrap", opacity: newChar.trim() ? 1 : 0.4 }} onClick={addChar}>＋ Add</button>
            </div>
            {chars.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {chars.map((c, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 8, fontSize: 13, color: "#c9a227", background: "rgba(201,162,39,0.08)", border: "1px solid rgba(201,162,39,0.2)", fontFamily: "'Nunito', sans-serif" }}>
                    {c}
                    <button onClick={() => removeChar(i)} style={{ width: 16, height: 16, borderRadius: 4, border: "none", cursor: "pointer", background: "rgba(239,68,68,0.2)", color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>✕</button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "#475569", fontFamily: "'Nunito', sans-serif" }}>No characters added yet. Add your MapleStory IGNs above.</div>
            )}
          </div>

          {/* Availability Grid */}
          <label style={S.label}>Availability (click & drag — green = available, red = unavailable, click again to clear)</label>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6, fontFamily: "'Nunito', sans-serif" }}>Red dashed line = 0:00 UTC (GMS Daily Reset)</div>
          <div ref={gridRef} style={{ position: "relative", userSelect: "none", cursor: "crosshair", background: "rgba(11,14,26,0.4)", borderRadius: 8, border: "1px solid #1e2440", overflow: "hidden", height: 420 }}
            onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}>
            {/* Day headers */}
            <div style={{ display: "flex", height: 24 }}>
              <div style={{ width: 40, flexShrink: 0 }} />
              {DAYS_SHORT.map(d => (
                <div key={d} style={{ flex: 1, textAlign: "center", fontSize: 10, fontWeight: 600, color: "#64748b", lineHeight: "24px", fontFamily: "'Nunito', sans-serif" }}>{d}</div>
              ))}
            </div>
            {/* Grid body */}
            <div style={{ display: "flex", height: 396 }}>
              <div style={{ width: 40, flexShrink: 0, position: "relative" }}>
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} style={{ position: "absolute", top: `${(h * 2 / 48) * 100}%`, right: 4, fontSize: 9, color: "#475569", lineHeight: 1, transform: "translateY(-50%)" }}>
                    {h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`}
                  </div>
                ))}
              </div>
              {Array.from({ length: 7 }, (_, dayIdx) => (
                <div key={dayIdx} style={{ flex: 1, display: "flex", flexDirection: "column", borderLeft: "1px solid rgba(255,255,255,0.03)" }}>
                  {Array.from({ length: 48 }, (_, slotIdx) => {
                    const key = `${dayIdx}-${slotIdx}`;
                    const val = avail[key];
                    return (
                      <div key={slotIdx} style={{
                        flex: 1, minHeight: 0,
                        background: val === "available" ? "rgba(34,197,94,0.35)" : val === "unavailable" ? "rgba(239,68,68,0.3)" : "transparent",
                        borderBottom: slotIdx % 2 === 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
                      }} />
                    );
                  })}
                </div>
              ))}
            </div>
            {/* UTC reset line */}
            <div style={{
              position: "absolute", left: 40, right: 0, top: 24 + (resetSlotNorm / 48) * 396,
              height: 0, borderTop: "2px dashed rgba(239,68,68,0.6)", pointerEvents: "none",
            }}>
              <span style={{ position: "absolute", right: 4, top: -14, fontSize: 9, color: "#f87171", fontWeight: 600, background: "rgba(11,14,26,0.8)", padding: "1px 4px", borderRadius: 3, fontFamily: "'Nunito', sans-serif" }}>
                0:00 UTC — GMS Reset
              </span>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
            <button style={S.btnGhost} onClick={onClose}>Cancel</button>
            <button style={S.btnPrimary} onClick={() => onSave({ timezone: tz, characters: chars, availability: avail })}>Save Settings</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   PARTY CARD
   ════════════════════════════════════════════════════════════ */
function PartyCard({ party, onDelete, currentUser }) {
  const [hover, setHover] = useState(false);
  const boss = party.bosses?.[0];
  const diffColor = DIFF_COLORS[boss?.difficulty] || "#94a3b8";
  const drops = boss ? getDropsForBoss(boss.bossName, boss.difficulty) : [];
  const isLead = party.leaderId === currentUser?.id;

  return (
    <div style={{ ...S.card, borderLeft: `3px solid ${diffColor}`, ...(hover ? { transform: "translateY(-2px)", boxShadow: `0 8px 32px ${diffColor}22` } : {}) }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e2440" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0", fontFamily: "'Cinzel', serif" }}>{boss?.bossName || "Unknown"}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: `${diffColor}22`, color: diffColor }}>
            {boss?.difficulty || "?"}
          </span>
          {isLead && (
            <button onClick={() => onDelete(party.id)} style={{ width: 24, height: 24, borderRadius: 6, border: "none", cursor: "pointer", background: "rgba(239,68,68,0.12)", color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>🗑</button>
          )}
        </div>
      </div>
      <div style={{ padding: "12px 18px" }}>
        {party.members?.map((m, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderBottom: i < party.members.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              background: m.isTemp ? "linear-gradient(135deg, #d97706, #f59e0b)" : `linear-gradient(135deg, ${diffColor}, ${diffColor}99)`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff",
            }}>{m.isTemp ? "T" : (m.charName?.[0] || "?").toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", fontFamily: "'Nunito', sans-serif", display: "flex", alignItems: "center", gap: 4 }}>
                {m.charName || m.userId}
                {m.isTemp && <span style={S.tempBadge}>TEMP</span>}
                {!m.isTemp && m.charName === "TBD" && <span style={S.tbdBadge}>IGN TBD</span>}
              </div>
              {!m.isTemp && m.charName !== m.userId && <div style={{ fontSize: 11, color: "#64748b" }}>{m.userId}</div>}
            </div>
            {i === 0 && <span style={S.leadBadge}>LEAD</span>}
          </div>
        ))}
        {(!party.members || party.members.length === 0) && (
          <div style={{ fontSize: 13, color: "#475569", padding: "8px 0", fontFamily: "'Nunito', sans-serif" }}>No members yet</div>
        )}

        {/* Drops */}
        {drops.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 10 }}>
            {drops.map((d, i) => (
              <span key={i} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "rgba(201,162,39,0.08)", color: "#c9a227", border: "1px solid rgba(201,162,39,0.15)", fontFamily: "'Nunito', sans-serif" }}>
                {d.name}
              </span>
            ))}
          </div>
        )}

        {/* Schedule */}
        {party.utcDay != null && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(201,162,39,0.06)", fontSize: 12, color: "#94a3b8", fontFamily: "'Nunito', sans-serif" }}>
            <span>🕐</span>
            <span>{DAYS[party.utcDay]} @ {String(party.utcHour).padStart(2, "0")}:{String(party.utcMin).padStart(2, "0")}</span>
          </div>
        )}

        {/* Party size */}
        <div style={{ fontSize: 11, color: "#475569", marginTop: 6, fontFamily: "'Nunito', sans-serif" }}>
          {party.members?.length || 0}/{party.maxMembers || 6} members
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   CHARACTERS VIEW
   ════════════════════════════════════════════════════════════ */
function CharactersView({ parties, user }) {
  const partyList = Object.values(parties || {});
  const chars = user.characters || [];

  if (chars.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: "#475569" }}>
        <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>👤</div>
        <div style={{ fontSize: 15, fontWeight: 500, fontFamily: "'Nunito', sans-serif" }}>No characters registered</div>
        <div style={{ fontSize: 13, marginTop: 6, color: "#374151", fontFamily: "'Nunito', sans-serif" }}>Go to ⚙️ Profile Settings and add your character IGNs first</div>
      </div>
    );
  }

  // Build grid: boss rows × character columns
  const findParty = (charName, bossName) => {
    return partyList.find(p =>
      p.members?.some(m => m.charName?.toLowerCase() === charName.toLowerCase()) &&
      p.bosses?.some(b => b.bossName === bossName)
    );
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'Nunito', sans-serif" }}>
        <thead>
          <tr>
            <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, color: "#64748b", fontWeight: 600, borderBottom: "1px solid #1e2440", position: "sticky", left: 0, background: "#0b0e1a", zIndex: 2 }}>Boss</th>
            {chars.map(c => (
              <th key={c} style={{ padding: "10px 16px", textAlign: "center", fontSize: 13, color: "#c9a227", fontWeight: 700, borderBottom: "1px solid #1e2440", fontFamily: "'Cinzel', serif", minWidth: 120 }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {BOSS_ORDER.map(bossName => {
            const bossObj = BOSSES.find(b => b.name === bossName);
            if (!bossObj) return null;
            return bossObj.diffs.map(diff => {
              const diffColor = DIFF_COLORS[diff] || "#94a3b8";
              return (
                <tr key={`${bossName}-${diff}`}>
                  <td style={{ padding: "8px 16px", borderBottom: "1px solid #1e2440", position: "sticky", left: 0, background: "#0b0e1a", zIndex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{bossName}</span>
                    {diff && <span style={{ fontSize: 10, fontWeight: 700, marginLeft: 6, padding: "2px 6px", borderRadius: 4, background: `${diffColor}22`, color: diffColor }}>{DIFF_ABBR[diff] || diff}</span>}
                  </td>
                  {chars.map(charName => {
                    const party = findParty(charName, bossName);
                    return (
                      <td key={charName} style={{ padding: "6px 16px", borderBottom: "1px solid #1e2440", textAlign: "center" }}>
                        {party ? (
                          <div style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>
                            ✓ {party.members?.length || 0}p
                          </div>
                        ) : (
                          <div style={{ fontSize: 11, color: "#374151" }}>—</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            });
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   LOGIN PAGE
   ════════════════════════════════════════════════════════════ */
function LoginPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(145deg, #0b0e1a 0%, #111827 40%, #0b0e1a 100%)", fontFamily: "'Nunito', sans-serif" }}>
      <div style={{ textAlign: "center", padding: 40, background: "rgba(20,24,41,0.8)", border: "1px solid #1e2440", borderRadius: 20, backdropFilter: "blur(12px)", boxShadow: "0 24px 80px rgba(0,0,0,0.4)", animation: "slideUp 0.3s ease" }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, margin: "0 auto 20px", background: "linear-gradient(135deg, #c9a227, #a3841e)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: "'Cinzel', serif" }}>B</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#e2e8f0", marginBottom: 8, fontFamily: "'Cinzel', serif" }}>Boss Organizer</h1>
        <p style={{ fontSize: 14, color: "#64748b", marginBottom: 28, maxWidth: 300 }}>Organize your GMS bossing parties. Sign in with Discord to get started.</p>
        <a href="/auth/discord" style={{
          display: "inline-flex", alignItems: "center", gap: 10, padding: "12px 28px", borderRadius: 10, textDecoration: "none",
          background: "#5865F2", color: "#fff", fontWeight: 600, fontSize: 15, boxShadow: "0 4px 20px rgba(88,101,242,0.4)",
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" /></svg>
          Sign in with Discord
        </a>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN APP
   ════════════════════════════════════════════════════════════ */
export default function App() {
  const [user, setUser] = useState(undefined);
  const [parties, setParties] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [view, setView] = useState("schedule");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await API.get("/api/me");
        setUser(data);
        if (data) {
          const p = await API.get("/api/parties");
          setParties(p || {});
        }
      } catch { setUser(null); }
      setLoading(false);
    })();
  }, []);

  // Auto-refresh every 8 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      try {
        const p = await API.get("/api/parties");
        if (p) setParties(p);
      } catch {}
    }, 8000);
    return () => clearInterval(interval);
  }, [user]);

  const saveParties = async (newParties) => {
    setParties(newParties);
    try { await API.put("/api/parties", newParties); } catch {}
  };

  const handleCreateParty = async (party) => {
    const newParties = { ...parties, [party.id]: party };
    await saveParties(newParties);
    setShowCreate(false);
  };

  const handleDeleteParty = async (id) => {
    const newParties = { ...parties };
    delete newParties[id];
    await saveParties(newParties);
  };

  const handleSaveProfile = async (settings) => {
    try {
      const updated = await API.patch("/api/me", settings);
      setUser(prev => ({ ...prev, ...updated }));
    } catch {
      setUser(prev => ({ ...prev, ...settings }));
    }
    setShowProfile(false);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b0e1a", color: "#64748b", fontFamily: "'Nunito', sans-serif" }}>
        <style>{globalCSS}</style>
        <div style={{ animation: "pulse 1.5s infinite" }}>Loading...</div>
      </div>
    );
  }

  if (!user) return <><style>{globalCSS}</style><LoginPage /></>;

  const partyList = Object.values(parties);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(145deg, #0b0e1a 0%, #111827 40%, #0b0e1a 100%)", color: "#e2e8f0", fontFamily: "'Nunito', sans-serif", position: "relative" }}>
      <style>{globalCSS}</style>
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.03, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px", borderBottom: "1px solid #1e2440", background: "rgba(11,14,26,0.85)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50, height: 54 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #c9a227, #a3841e)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: "'Cinzel', serif" }}>B</div>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", fontFamily: "'Cinzel', serif" }}>Boss Organizer</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setView("schedule")} style={{ ...S.btnGhost, ...(view === "schedule" ? S.btnActive : {}) }}>📅 Schedule</button>
          <button onClick={() => setView("characters")} style={{ ...S.btnGhost, ...(view === "characters" ? S.btnActive : {}) }}>👤 Characters</button>
          <button style={S.btnPrimary} onClick={() => setShowCreate(true)}>＋ Create Party</button>
          <button style={{ ...S.btnGhost, display: "flex", alignItems: "center", gap: 6 }} onClick={() => setShowProfile(true)}>
            {user.avatar && <img src={user.avatar} style={{ width: 20, height: 20, borderRadius: "50%" }} />}
            ⚙️ {user.username}
          </button>
          <a href="/auth/logout" style={{ ...S.btnGhost, textDecoration: "none", fontSize: 12 }}>Logout</a>
        </div>
      </div>

      {/* Main */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px", position: "relative", zIndex: 1 }}>
        {view === "schedule" ? (
          partyList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#475569" }}>
              <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>⚔️</div>
              <div style={{ fontSize: 15, fontWeight: 500, fontFamily: "'Nunito', sans-serif" }}>No parties yet</div>
              <div style={{ fontSize: 13, marginTop: 6, color: "#374151" }}>Click "Create Party" to get started</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
              {partyList.map(p => <PartyCard key={p.id} party={p} currentUser={user} onDelete={handleDeleteParty} />)}
            </div>
          )
        ) : (
          <CharactersView parties={parties} user={user} />
        )}
      </div>

      {showCreate && <CreatePartyModal onClose={() => setShowCreate(false)} onSave={handleCreateParty} currentUser={user} />}
      {showProfile && <ProfileModal user={user} onClose={() => setShowProfile(false)} onSave={handleSaveProfile} />}
    </div>
  );
}
