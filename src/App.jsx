import { useState, useEffect, useRef, useCallback, useMemo } from "react";

/* ════════════════════════════════════════════════════════════
   CONSTANTS
   ════════════════════════════════════════════════════════════ */
const BOSSES = [
  { name: "Zakum", diffs: ["Easy", "Normal", "Chaos"] },
  { name: "Horntail", diffs: ["Easy", "Normal", "Chaos"] },
  { name: "Pink Bean", diffs: ["Normal", "Chaos"] },
  { name: "Von Leon", diffs: ["Easy", "Normal", "Hard"] },
  { name: "Arkarium", diffs: ["Easy", "Normal"] },
  { name: "Gollux", diffs: ["Easy", "Normal", "Hard", "Chaos"] },
  { name: "Magnus", diffs: ["Easy", "Normal", "Hard"] },
  { name: "Hilla", diffs: ["Normal", "Hard"] },
  { name: "Papulatus", diffs: ["Easy", "Normal", "Chaos"] },
  { name: "Lotus", diffs: ["Normal", "Hard", "Extreme"] },
  { name: "Damien", diffs: ["Normal", "Hard"] },
  { name: "Lucid", diffs: ["Easy", "Normal", "Hard"] },
  { name: "Will", diffs: ["Easy", "Normal", "Hard"] },
  { name: "Gloom", diffs: ["Normal", "Chaos"] },
  { name: "Darknell", diffs: ["Normal", "Hard"] },
  { name: "Verus Hilla", diffs: ["Normal", "Hard"] },
  { name: "Seren", diffs: ["Normal", "Hard", "Extreme"] },
  { name: "Kalos", diffs: ["Chaos", "Extreme"] },
  { name: "Kaling", diffs: ["Normal", "Hard", "Extreme"] },
  { name: "Limbo", diffs: ["Normal", "Hard"] },
  { name: "Black Mage", diffs: ["Hard", "Extreme"] },
  { name: "Other", diffs: ["Custom"] },
];

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
  async get(path) {
    const r = await fetch(path, { credentials: "include" });
    if (r.status === 401) return null;
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(path, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return r.json();
  },
  async put(path, body) {
    const r = await fetch(path, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return r.json();
  },
  async del(path) {
    const r = await fetch(path, { method: "DELETE", credentials: "include" });
    return r.json();
  },
};

/* ════════════════════════════════════════════════════════════
   GLOBAL STYLES
   ════════════════════════════════════════════════════════════ */
const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@500&display=swap');
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.5 } }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0e1a; }
  ::-webkit-scrollbar { width: 6px }
  ::-webkit-scrollbar-track { background: transparent }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px }
  input::placeholder, textarea::placeholder { color: #475569 }
  select option { background: #1e293b; color: #e2e8f0; }
`;

/* ════════════════════════════════════════════════════════════
   IGN POPUP — reused for Discord member & Temp member
   ════════════════════════════════════════════════════════════ */
function IGNPopup({ title, hint, onConfirm, onClose }) {
  const [ign, setIgn] = useState("");
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const confirm = () => onConfirm(ign.trim() || "TBD");
  const close = () => onClose("TBD");

  return (
    <div style={styles.popOverlay} onClick={close}>
      <div style={styles.popBox} onClick={e => e.stopPropagation()}>
        <div style={styles.popHead}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>{title}</span>
          <button style={styles.closeBtn} onClick={close}>✕</button>
        </div>
        <div style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>{hint}</div>
          <input
            ref={ref} style={styles.input}
            placeholder="e.g. xXSlayerXx"
            value={ign} onChange={e => setIgn(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") confirm(); if (e.key === "Escape") close(); }}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button style={styles.btnGhost} onClick={close}>Skip</button>
            <button style={styles.btnGreen} onClick={confirm}>Confirm</button>
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

  // Auto-add yourself as first member
  useEffect(() => {
    if (currentUser && members.length === 0) {
      setMembers([{ discord: currentUser.username, ign: currentUser.ign || "TBD", isTemp: false, isLead: true }]);
    }
  }, [currentUser]);

  const openIgnForDiscord = () => {
    const name = discordInput.trim();
    if (!name) return;
    if (members.length >= 6) return;
    setIgnPopup({ type: "discord", discordName: name });
  };

  const openIgnForTemp = () => {
    if (members.length >= 6) return;
    setIgnPopup({ type: "temp" });
  };

  const handleIgnResult = (ign) => {
    if (ignPopup.type === "discord") {
      setMembers(prev => [...prev, { discord: ignPopup.discordName, ign, isTemp: false }]);
      setDiscordInput("");
    } else {
      setMembers(prev => [...prev, { discord: null, ign: ign || "TBD", isTemp: true }]);
    }
    setIgnPopup(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const removeMember = i => setMembers(prev => prev.filter((_, j) => j !== i));

  const save = () => {
    if (!boss || !diff) return;
    onSave({ id: Date.now().toString(36), boss, diff, day, time, members });
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHead}>
          <span style={styles.modalTitle}>Create Party</span>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={styles.modalBody}>
          {/* Boss + Difficulty */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>Boss</label>
              <select style={{ ...styles.select, width: "100%" }} value={boss}
                onChange={e => { setBoss(e.target.value); setDiff(""); }}>
                <option value="">Select Boss</option>
                {BOSSES.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>Difficulty</label>
              <select style={{ ...styles.select, width: "100%" }} value={diff}
                onChange={e => setDiff(e.target.value)} disabled={!boss}>
                <option value="">Select</option>
                {bossObj?.diffs.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Schedule */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>Day</label>
              <select style={{ ...styles.select, width: "100%" }} value={day}
                onChange={e => setDay(e.target.value)}>
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>Time</label>
              <input type="time" style={{ ...styles.input, width: "100%" }}
                value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>

          {/* ═══ DISCORD USERNAME FIELD ═══ */}
          <div style={{ marginBottom: 16 }}>
            <label style={styles.label}>Discord Username</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                ref={inputRef} style={styles.input}
                placeholder="Enter Discord username..."
                value={discordInput}
                onChange={e => setDiscordInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); openIgnForDiscord(); } }}
              />
              <button
                style={{ ...styles.btnPrimary, opacity: discordInput.trim() ? 1 : 0.4, pointerEvents: discordInput.trim() ? "auto" : "none", whiteSpace: "nowrap" }}
                onClick={openIgnForDiscord}
              >
                ＋ Add
              </button>
            </div>

            {/* ADD TEMP BUTTON */}
            <button style={styles.addTempBtn} onClick={openIgnForTemp}>
              👤 Add Temp
            </button>
          </div>

          {/* Member chips */}
          {members.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <label style={styles.label}>Party Members ({members.length}/6)</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                {members.map((m, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "5px 10px",
                    borderRadius: 8, fontSize: 12, color: "#c7d2fe",
                    background: m.isTemp ? "rgba(251,191,36,0.08)" : "rgba(99,102,241,0.1)",
                    border: `1px solid ${m.isTemp ? "rgba(251,191,36,0.2)" : "rgba(99,102,241,0.2)"}`,
                  }}>
                    <span style={{ fontWeight: 600 }}>
                      {m.isTemp ? `🕐 ${m.ign}` : m.discord}
                    </span>
                    {!m.isTemp && (
                      <span style={{ color: "#64748b", fontSize: 11 }}>
                        ({m.ign === "TBD" ? <span style={{ color: "#f87171" }}>TBD</span> : m.ign})
                      </span>
                    )}
                    {m.isTemp && <span style={styles.tempBadge}>TEMP</span>}
                    {m.isLead && <span style={styles.leadBadge}>LEAD</span>}
                    {!m.isLead && (
                      <button onClick={() => removeMember(i)} style={{
                        width: 16, height: 16, borderRadius: 4, border: "none", cursor: "pointer",
                        background: "rgba(239,68,68,0.2)", color: "#f87171",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10,
                      }}>✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
            <button style={styles.btnGhost} onClick={onClose}>Cancel</button>
            <button style={{ ...styles.btnPrimary, opacity: boss && diff ? 1 : 0.4, pointerEvents: boss && diff ? "auto" : "none" }}
              onClick={save}>
              Create Party
            </button>
          </div>
        </div>
      </div>

      {/* IGN Popup */}
      {ignPopup && (
        <IGNPopup
          title={ignPopup.type === "discord" ? `Enter IGN for ${ignPopup.discordName}` : "Enter Temp Character Name"}
          hint={ignPopup.type === "discord"
            ? "What is this player's in-game character name? Press Skip or close to set as TBD."
            : "Type the character name for this temporary party member."}
          onConfirm={handleIgnResult}
          onClose={ign => { handleIgnResult(ign); }}
        />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   PROFILE / SETTINGS MODAL
   ════════════════════════════════════════════════════════════ */
function ProfileModal({ user, onClose, onSave }) {
  const [tz, setTz] = useState(user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [ign, setIgn] = useState(user.ign || "");
  // Availability grid: 7 days x 96 slots (15-min intervals)
  const [avail, setAvail] = useState(user.availability || Array(7).fill(null).map(() => Array(96).fill(0)));
  const [painting, setPainting] = useState(null); // 1 = green, -1 = red, null = not painting
  const gridRef = useRef(null);

  const getSlotFromEvent = (e) => {
    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dayW = (rect.width - 40) / 7;
    const slotH = (rect.height - 24) / 96;
    const day = Math.floor((x - 40) / dayW);
    const slot = Math.floor((y - 24) / slotH);
    if (day < 0 || day > 6 || slot < 0 || slot > 95) return null;
    return { day, slot };
  };

  const handleMouseDown = (e) => {
    const pos = getSlotFromEvent(e);
    if (!pos) return;
    const current = avail[pos.day][pos.slot];
    const next = current === 0 ? 1 : current === 1 ? -1 : 0;
    setPainting(next);
    setAvail(prev => {
      const copy = prev.map(d => [...d]);
      copy[pos.day][pos.slot] = next;
      return copy;
    });
  };

  const handleMouseMove = (e) => {
    if (painting === null) return;
    const pos = getSlotFromEvent(e);
    if (!pos) return;
    setAvail(prev => {
      const copy = prev.map(d => [...d]);
      copy[pos.day][pos.slot] = painting;
      return copy;
    });
  };

  const handleMouseUp = () => setPainting(null);

  // Find GMT 0:00 line position (daily reset)
  const userOffset = new Date().getTimezoneOffset(); // minutes behind UTC
  const resetSlot = Math.round((userOffset + 0) / 15) % 96; // slot index for 0:00 UTC
  const resetSlotNorm = resetSlot < 0 ? resetSlot + 96 : resetSlot;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={{ ...styles.modal, width: "min(700px, 95vw)" }} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHead}>
          <span style={styles.modalTitle}>Profile Settings</span>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={styles.modalBody}>
          <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
            {/* Discord name (read-only) */}
            <div style={{ flex: 1 }}>
              <label style={styles.label}>Discord</label>
              <div style={{ ...styles.input, background: "rgba(15,23,42,0.3)", color: "#64748b" }}>
                {user.username}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>Default IGN</label>
              <input style={styles.input} value={ign} onChange={e => setIgn(e.target.value)}
                placeholder="Your main character name" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>Timezone</label>
              <select style={{ ...styles.select, width: "100%" }} value={tz} onChange={e => setTz(e.target.value)}>
                {TIMEZONES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </div>
          </div>

          {/* Availability grid */}
          <label style={styles.label}>Availability (drag to paint — green = available, red = unavailable)</label>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>
            The red dashed line marks 0:00 UTC (GMS Daily Reset)
          </div>
          <div
            ref={gridRef}
            style={{
              position: "relative", userSelect: "none", cursor: "crosshair",
              background: "rgba(15,23,42,0.4)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)",
              overflow: "hidden",
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Header row */}
            <div style={{ display: "flex", height: 24 }}>
              <div style={{ width: 40, flexShrink: 0 }} />
              {DAYS_SHORT.map(d => (
                <div key={d} style={{ flex: 1, textAlign: "center", fontSize: 10, fontWeight: 600, color: "#64748b", lineHeight: "24px" }}>
                  {d}
                </div>
              ))}
            </div>
            {/* Time rows */}
            <div style={{ display: "flex", height: 384 }}>
              {/* Time labels */}
              <div style={{ width: 40, flexShrink: 0, position: "relative" }}>
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} style={{
                    position: "absolute", top: `${(h * 4 / 96) * 100}%`, right: 4,
                    fontSize: 9, color: "#475569", lineHeight: 1,
                    transform: "translateY(-50%)",
                  }}>
                    {h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`}
                  </div>
                ))}
              </div>
              {/* Grid cells */}
              {Array.from({ length: 7 }, (_, dayIdx) => (
                <div key={dayIdx} style={{ flex: 1, display: "flex", flexDirection: "column", borderLeft: "1px solid rgba(255,255,255,0.03)" }}>
                  {Array.from({ length: 96 }, (_, slotIdx) => {
                    const val = avail[dayIdx]?.[slotIdx] || 0;
                    return (
                      <div key={slotIdx} style={{
                        flex: 1, minHeight: 4,
                        background: val === 1 ? "rgba(34,197,94,0.35)" : val === -1 ? "rgba(239,68,68,0.3)" : "transparent",
                        borderBottom: slotIdx % 4 === 3 ? "1px solid rgba(255,255,255,0.03)" : "none",
                      }} />
                    );
                  })}
                </div>
              ))}
            </div>
            {/* UTC reset line */}
            <div style={{
              position: "absolute", left: 40, right: 0,
              top: 24 + (resetSlotNorm / 96) * 384,
              height: 0, borderTop: "2px dashed rgba(239,68,68,0.6)",
              pointerEvents: "none",
            }}>
              <span style={{
                position: "absolute", right: 4, top: -14,
                fontSize: 9, color: "#f87171", fontWeight: 600,
                background: "rgba(15,23,42,0.8)", padding: "1px 4px", borderRadius: 3,
              }}>
                0:00 UTC — GMS Reset
              </span>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
            <button style={styles.btnGhost} onClick={onClose}>Cancel</button>
            <button style={styles.btnPrimary} onClick={() => onSave({ timezone: tz, ign, availability: avail })}>
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   PARTY CARD
   ════════════════════════════════════════════════════════════ */
function PartyCard({ party, userTz, onDelete, currentUser }) {
  const [hover, setHover] = useState(false);

  // Convert time to user's timezone display
  const displayTime = useMemo(() => {
    try {
      const fakeDate = new Date(`2024-01-01T${party.time}:00Z`);
      return fakeDate.toLocaleTimeString("en-US", {
        hour: "numeric", minute: "2-digit", hour12: true,
        timeZone: userTz || undefined,
      });
    } catch { return party.time; }
  }, [party.time, userTz]);

  const isLead = party.members?.[0]?.discord === currentUser?.username;

  return (
    <div
      style={{
        ...styles.card,
        ...(hover ? { transform: "translateY(-2px)", boxShadow: "0 8px 32px rgba(99,102,241,0.12)" } : {}),
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={styles.cardHead}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#c7d2fe" }}>{party.boss}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={styles.diffBadge}>{party.diff}</span>
          {isLead && (
            <button onClick={() => onDelete(party.id)} style={{
              width: 24, height: 24, borderRadius: 6, border: "none", cursor: "pointer",
              background: "rgba(239,68,68,0.12)", color: "#f87171",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
            }}>🗑</button>
          )}
        </div>
      </div>
      <div style={{ padding: "12px 18px" }}>
        {party.members?.map((m, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "6px 0",
            borderBottom: i < party.members.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              background: m.isTemp
                ? "linear-gradient(135deg, #d97706, #f59e0b)"
                : "linear-gradient(135deg, #4f46e5, #7c3aed)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: "#fff",
            }}>
              {m.isTemp ? "T" : (m.discord?.[0] || "?").toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", display: "flex", alignItems: "center", gap: 4 }}>
                {m.isTemp ? m.ign : m.discord}
                {m.isTemp && <span style={styles.tempBadge}>TEMP</span>}
                {!m.isTemp && m.ign === "TBD" && <span style={styles.tbdBadge}>IGN TBD</span>}
              </div>
              {!m.isTemp && m.ign && m.ign !== "TBD" && (
                <div style={{ fontSize: 11, color: "#64748b" }}>IGN: {m.ign}</div>
              )}
            </div>
            {i === 0 && <span style={styles.leadBadge}>LEAD</span>}
          </div>
        ))}
        {(!party.members || party.members.length === 0) && (
          <div style={{ fontSize: 13, color: "#475569", padding: "8px 0" }}>No members yet</div>
        )}
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginTop: 10,
          padding: "8px 12px", borderRadius: 8,
          background: "rgba(99,102,241,0.06)", fontSize: 12, color: "#94a3b8",
        }}>
          <span>🕐</span>
          <span>{party.day} @ {displayTime}</span>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   CHARACTER VIEW — shows parties grouped by member IGN
   ════════════════════════════════════════════════════════════ */
function CharacterView({ parties, userTz }) {
  const charMap = useMemo(() => {
    const map = {};
    parties.forEach(p => {
      p.members?.forEach(m => {
        const key = m.isTemp ? `temp:${m.ign}` : m.discord;
        if (!map[key]) map[key] = { discord: m.discord, ign: m.ign, isTemp: m.isTemp, parties: [] };
        map[key].parties.push(p);
      });
    });
    return Object.values(map);
  }, [parties]);

  if (charMap.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: "#475569" }}>
        <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>👤</div>
        <div style={{ fontSize: 15, fontWeight: 500 }}>No characters yet</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {charMap.map((c, i) => (
        <div key={i} style={{
          background: "rgba(30,41,59,0.6)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14, overflow: "hidden",
        }}>
          <div style={{
            padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)",
            background: c.isTemp ? "rgba(251,191,36,0.06)" : "rgba(99,102,241,0.06)",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: c.isTemp ? "linear-gradient(135deg,#d97706,#f59e0b)" : "linear-gradient(135deg,#4f46e5,#7c3aed)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, color: "#fff",
            }}>
              {c.isTemp ? "T" : (c.discord?.[0] || "?").toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>
                {c.isTemp ? c.ign : c.discord}
                {c.isTemp && <span style={styles.tempBadge}>TEMP</span>}
              </div>
              {!c.isTemp && c.ign && c.ign !== "TBD" && (
                <div style={{ fontSize: 12, color: "#64748b" }}>IGN: {c.ign}</div>
              )}
            </div>
            <div style={{ marginLeft: "auto", fontSize: 12, color: "#64748b" }}>
              {c.parties.length} boss{c.parties.length !== 1 ? "es" : ""}
            </div>
          </div>
          <div style={{ padding: "10px 18px" }}>
            {c.parties.map((p, j) => (
              <div key={j} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "8px 0",
                borderBottom: j < c.parties.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#c7d2fe", minWidth: 100 }}>{p.boss}</span>
                <span style={styles.diffBadge}>{p.diff}</span>
                <span style={{ fontSize: 12, color: "#64748b", marginLeft: "auto" }}>
                  {p.day} @ {p.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   LOGIN PAGE
   ════════════════════════════════════════════════════════════ */
function LoginPage() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(145deg, #0a0e1a 0%, #111827 40%, #0f172a 100%)",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{
        textAlign: "center", padding: 40,
        background: "rgba(30,41,59,0.5)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20, backdropFilter: "blur(12px)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
        animation: "slideUp 0.3s ease",
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16, margin: "0 auto 20px",
          background: "linear-gradient(135deg, #6366f1, #a855f7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28, fontWeight: 800, color: "#fff",
        }}>B</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#e2e8f0", marginBottom: 8 }}>Boss Organizer</h1>
        <p style={{ fontSize: 14, color: "#64748b", marginBottom: 28, maxWidth: 300 }}>
          Organize your GMS bossing parties with your guild. Sign in with Discord to get started.
        </p>
        <a href="/auth/discord" style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          padding: "12px 28px", borderRadius: 10, textDecoration: "none",
          background: "#5865F2", color: "#fff", fontWeight: 600, fontSize: 15,
          boxShadow: "0 4px 20px rgba(88,101,242,0.4)",
          transition: "transform 0.15s",
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
          </svg>
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
  const [user, setUser] = useState(undefined); // undefined = loading, null = not logged in
  const [parties, setParties] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [view, setView] = useState("schedule");
  const [loading, setLoading] = useState(true);

  // Check auth on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await API.get("/api/me");
        setUser(data);
        if (data) {
          const p = await API.get("/api/parties");
          setParties(p || []);
        }
      } catch {
        setUser(null);
      }
      setLoading(false);
    })();
  }, []);

  const handleCreateParty = async (party) => {
    try {
      const saved = await API.post("/api/parties", party);
      setParties(prev => [...prev, saved]);
    } catch {
      // Fallback: save locally
      setParties(prev => [...prev, party]);
    }
    setShowCreate(false);
  };

  const handleDeleteParty = async (id) => {
    try { await API.del(`/api/parties/${id}`); } catch {}
    setParties(prev => prev.filter(p => p.id !== id));
  };

  const handleSaveProfile = async (settings) => {
    try {
      const updated = await API.put("/api/me", settings);
      setUser(prev => ({ ...prev, ...settings, ...updated }));
    } catch {
      setUser(prev => ({ ...prev, ...settings }));
    }
    setShowProfile(false);
  };

  // Loading state
  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#0a0e1a", color: "#64748b", fontFamily: "'DM Sans', sans-serif",
      }}>
        <style>{globalCSS}</style>
        <div style={{ animation: "pulse 1.5s infinite" }}>Loading...</div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <>
        <style>{globalCSS}</style>
        <LoginPage />
      </>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(145deg, #0a0e1a 0%, #111827 40%, #0f172a 100%)",
      color: "#e2e8f0", fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      position: "relative",
    }}>
      <style>{globalCSS}</style>
      {/* Noise overlay */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.03,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(15,23,42,0.8)", backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, #6366f1, #a855f7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 800, color: "#fff",
          }}>B</div>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>Boss Organizer</span>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setView("schedule")}
            style={{ ...styles.btnGhost, ...(view === "schedule" ? styles.btnActive : {}) }}>
            📅 Schedule
          </button>
          <button onClick={() => setView("characters")}
            style={{ ...styles.btnGhost, ...(view === "characters" ? styles.btnActive : {}) }}>
            👤 Characters
          </button>
          <button style={styles.btnPrimary} onClick={() => setShowCreate(true)}>
            ＋ Create Party
          </button>
          <button style={styles.btnGhost} onClick={() => setShowProfile(true)}>
            ⚙️ {user.username}
          </button>
          <a href="/auth/logout" style={{ ...styles.btnGhost, textDecoration: "none", fontSize: 12 }}>
            Logout
          </a>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px", position: "relative", zIndex: 1 }}>
        {view === "schedule" ? (
          parties.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#475569" }}>
              <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>⚔️</div>
              <div style={{ fontSize: 15, fontWeight: 500 }}>No parties yet</div>
              <div style={{ fontSize: 13, marginTop: 6, color: "#374151" }}>Click "Create Party" to get started</div>
            </div>
          ) : (
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16,
            }}>
              {parties.map(p => (
                <PartyCard key={p.id} party={p} userTz={user.timezone}
                  currentUser={user} onDelete={handleDeleteParty} />
              ))}
            </div>
          )
        ) : (
          <CharacterView parties={parties} userTz={user.timezone} />
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreatePartyModal onClose={() => setShowCreate(false)} onSave={handleCreateParty} currentUser={user} />
      )}
      {showProfile && (
        <ProfileModal user={user} onClose={() => setShowProfile(false)} onSave={handleSaveProfile} />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   SHARED STYLES
   ════════════════════════════════════════════════════════════ */
const styles = {
  overlay: {
    position: "fixed", inset: 0, zIndex: 100,
    background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    animation: "fadeIn 0.15s ease",
  },
  modal: {
    background: "linear-gradient(160deg, #1e293b 0%, #0f172a 100%)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16,
    width: "min(540px, 92vw)", maxHeight: "85vh", overflow: "auto",
    boxShadow: "0 24px 80px rgba(0,0,0,0.5)", animation: "slideUp 0.2s ease",
  },
  modalHead: {
    padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)",
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  modalTitle: { fontSize: 17, fontWeight: 700, color: "#e2e8f0" },
  modalBody: { padding: "18px 22px" },
  closeBtn: {
    width: 30, height: 30, borderRadius: 8, border: "none", cursor: "pointer",
    background: "rgba(255,255,255,0.06)", color: "#94a3b8",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
  },
  label: {
    fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 6,
    display: "block", textTransform: "uppercase", letterSpacing: "0.05em",
  },
  input: {
    width: "100%", padding: "10px 14px", borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(15,23,42,0.6)", color: "#e2e8f0",
    fontSize: 14, outline: "none", transition: "border 0.2s",
    fontFamily: "inherit",
  },
  select: {
    padding: "10px 14px", borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(15,23,42,0.6)", color: "#e2e8f0",
    fontSize: 14, outline: "none", cursor: "pointer",
    appearance: "none", fontFamily: "inherit",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2394a3b8' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 32,
  },
  btnPrimary: {
    padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer",
    background: "linear-gradient(135deg, #6366f1, #7c3aed)", color: "#fff",
    fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6,
    transition: "all 0.2s", boxShadow: "0 2px 12px rgba(99,102,241,0.3)",
    fontFamily: "inherit",
  },
  btnGhost: {
    padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.04)", color: "#94a3b8", cursor: "pointer",
    fontSize: 13, fontWeight: 500, transition: "all 0.2s", fontFamily: "inherit",
  },
  btnActive: {
    background: "rgba(99,102,241,0.12)", color: "#a5b4fc",
    borderColor: "rgba(99,102,241,0.3)",
  },
  btnGreen: {
    padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer",
    background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff",
    fontWeight: 600, fontSize: 13, fontFamily: "inherit",
  },
  addTempBtn: {
    padding: "8px 16px", borderRadius: 8, border: "1px dashed rgba(251,191,36,0.4)",
    background: "rgba(251,191,36,0.06)", color: "#fbbf24", cursor: "pointer",
    fontWeight: 600, fontSize: 12, marginTop: 10, fontFamily: "inherit",
    display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s",
  },
  card: {
    background: "rgba(30,41,59,0.6)", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14, overflow: "hidden", backdropFilter: "blur(8px)",
    transition: "transform 0.2s, box-shadow 0.2s",
  },
  cardHead: {
    padding: "14px 18px", display: "flex", justifyContent: "space-between",
    alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)",
    background: "rgba(99,102,241,0.06)",
  },
  diffBadge: {
    fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
    background: "rgba(167,139,250,0.15)", color: "#a78bfa",
  },
  tempBadge: {
    fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
    background: "rgba(251,191,36,0.15)", color: "#fbbf24", marginLeft: 4,
  },
  tbdBadge: {
    fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
    background: "rgba(239,68,68,0.12)", color: "#f87171", marginLeft: 4,
  },
  leadBadge: {
    fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
    background: "rgba(99,102,241,0.15)", color: "#818cf8",
  },
  // IGN popup
  popOverlay: {
    position: "fixed", inset: 0, zIndex: 200,
    background: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    animation: "fadeIn 0.12s ease",
  },
  popBox: {
    background: "linear-gradient(160deg, #1e293b 0%, #0f172a 100%)",
    border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14,
    width: "min(380px, 88vw)", boxShadow: "0 16px 60px rgba(0,0,0,0.5)",
    animation: "slideUp 0.18s ease",
  },
  popHead: {
    padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)",
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
};
