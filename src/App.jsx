import { useState, useEffect, useRef } from "react";

const ANTHROPIC_SYSTEM_PROMPT = `You are SIGNAL, a specialized market intelligence agent for Clear Path Education Group — a Texas K–12 EdTech company founded by Kim Culley (sitting DAEP Principal, former Head of School, IB Programme Coordinator) and Melissa (IB Programme Coordinator).

Clear Path's products:
- WAYPOINT: DAEP + discipline management SaaS (incident lifecycle, SPED/504 MDR, DAEP dashboard, PEIMS export)
- APEX TEXAS: AI-powered instructional leadership platform (T-TESS, Danielson, Marzano, voice→AI coaching loop)
- APEX IB LEADERSHIP HUB: IB coordinator/admin platform (PSP 2020, MYP, observation, Learner Profile)
- BEACON: Campus counselor SaaS (offline PWA, SCUTA export)
- INVESTIGATOR TOOLKIT: Investigation workflow tool
- TpT STORE: Excel trackers, discipline templates, counselor resources, IB resources
- Lead magnets: Discipline Decision Matrix, counselor risk tools, TEC §37 checklists

Target buyers: DAEP principals, campus admins, school counselors, IB coordinators, campus principals (Texas-focused, expanding nationally)

Your job when given a SCAN task:
Simulate what a real social media and web intelligence scan would find — realistic educator posts, pain points, forum threads, and search trends across:
- Facebook Groups: Texas Educators, DAEP Administrators, School Counselors, Campus Admin
- Twitter/X: #txeducator #txadmin #schoolcounselor #ttess #ibteacher #ibcoordinator #daep
- Reddit: r/Teachers r/SchoolCounseling r/K12sysadmin r/IBO
- TpT forums and reviews
- Google Trends educator search terms
- LinkedIn educator posts

Return a JSON object ONLY (no markdown, no preamble) with this exact structure:
{
  "signals": [
    {
      "id": "unique-id",
      "platform": "Facebook Group / Twitter / Reddit / TpT / LinkedIn / Google Trends",
      "channel": "specific group or hashtag name",
      "painPoint": "short label",
      "quote": "realistic educator post or search query",
      "persona": "DAEP Principal / Campus Admin / School Counselor / IB Coordinator / Teacher",
      "urgency": "high / medium / low",
      "product": "WAYPOINT / APEX TEXAS / APEX IB / BEACON / INVESTIGATOR / TPT / LEAD MAGNET",
      "tags": ["tag1", "tag2"],
      "responseAngle": "one sentence on how Clear Path solves this"
    }
  ],
  "trendSummary": "2-3 sentence market intelligence summary",
  "topOpportunity": "single most actionable opportunity right now"
}

Generate 8-10 highly realistic signals. Mix platforms, personas, and products. Include IB-specific signals. Make quotes sound like real educators — messy, urgent, frustrated, or searching.

When given a DRAFT task:
You are writing as Kim Culley — DAEP Principal, Head of School, IB Programme Coordinator. Authentic educator voice. NOT salesy. Lead with empathy and expertise. You are a peer, not a vendor.

Return JSON ONLY:
{
  "subject": "post/comment subject line if needed",
  "draft": "full response text",
  "platform": "platform name",
  "toneNotes": "brief note on tone strategy",
  "followUp": "suggested follow-up action"
}`;

const COLORS = {
  purple: "#4B2D7F",
  purpleMid: "#6B4BA1",
  purpleLight: "#EDE7F6",
  orange: "#E8650A",
  orangeLight: "#FFF3EC",
  dark: "#1A1025",
  darkCard: "#231535",
  darkBorder: "#3D2560",
  text: "#F0EAF8",
  textMuted: "#9B87C0",
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
};

const URGENCY_COLOR = { high: COLORS.danger, medium: COLORS.warning, low: COLORS.success };
const PRODUCT_COLOR = {
  WAYPOINT: "#3B82F6",
  "APEX TEXAS": "#8B5CF6",
  "APEX IB": "#06B6D4",
  BEACON: "#22C55E",
  INVESTIGATOR: "#F59E0B",
  TPT: COLORS.orange,
  "LEAD MAGNET": "#EC4899",
};

const PLATFORM_ICONS = {
  "Facebook Group": "\u{1F4D8}",
  Twitter: "\u{1F426}",
  Reddit: "\u{1F916}",
  TpT: "\u{1F34E}",
  LinkedIn: "\u{1F4BC}",
  "Google Trends": "\u{1F4C8}",
};

const PERSONA_ICONS = {
  "DAEP Principal": "\u{1F3EB}",
  "Campus Admin": "\u{1F5C2}\uFE0F",
  "School Counselor": "\u{1F499}",
  "IB Coordinator": "\u{1F30D}",
  Teacher: "\u270F\uFE0F",
};

async function callClaude(messages, systemOverride) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemOverride || ANTHROPIC_SYSTEM_PROMPT,
      messages,
    }),
  });
  const data = await res.json();
  const text = data.content?.map(b => b.text || "").join("") || "";
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

function Badge({ label, color, small }) {
  return (
    <span style={{
      background: color + "22",
      color: color,
      border: `1px solid ${color}44`,
      borderRadius: 4,
      padding: small ? "1px 6px" : "2px 8px",
      fontSize: small ? 10 : 11,
      fontWeight: 700,
      letterSpacing: "0.05em",
      textTransform: "uppercase",
      whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

function PulseOrb({ active }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{
        width: 8, height: 8, borderRadius: "50%",
        background: active ? COLORS.success : COLORS.textMuted,
        boxShadow: active ? `0 0 0 3px ${COLORS.success}33` : "none",
        display: "inline-block",
        animation: active ? "pulse 2s infinite" : "none",
      }} />
    </span>
  );
}

function buildSearchUrl(platform, channel, painPoint, tags) {
  const keywords = encodeURIComponent(painPoint + " " + (tags || []).slice(0, 2).join(" "));
  const channelEnc = encodeURIComponent(channel || "");
  switch (platform) {
    case "Facebook Group":
      return `https://www.facebook.com/search/posts/?q=${keywords}`;
    case "Twitter":
      return `https://x.com/search?q=${keywords}&f=live`;
    case "Reddit": {
      const sub = (channel || "").match(/r\/(\w+)/)?.[1] || "Teachers";
      return `https://www.reddit.com/r/${sub}/search/?q=${encodeURIComponent(painPoint)}&restrict_sr=1&sort=new`;
    }
    case "TpT":
      return `https://www.teacherspayteachers.com/Browse/Search:${encodeURIComponent(painPoint)}`;
    case "LinkedIn":
      return `https://www.linkedin.com/search/results/content/?keywords=${keywords}`;
    case "Google Trends":
      return `https://trends.google.com/trends/explore?q=${encodeURIComponent(painPoint)}&geo=US`;
    default:
      return `https://www.google.com/search?q=${keywords}+site:${(platform || "").toLowerCase().replace(/\s/g, "")}`;
  }
}

function SignalCard({ signal, onDraft, isNew }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div onClick={() => setExpanded(!expanded)} style={{
      background: COLORS.darkCard,
      border: `1px solid ${isNew ? COLORS.orange : COLORS.darkBorder}`,
      borderLeft: `3px solid ${URGENCY_COLOR[signal.urgency]}`,
      borderRadius: 8,
      padding: "14px 16px",
      cursor: "pointer",
      transition: "all 0.2s",
      marginBottom: 10,
      boxShadow: isNew ? `0 0 12px ${COLORS.orange}22` : "none",
    }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
        <span style={{ fontSize: 16 }}>{PLATFORM_ICONS[signal.platform] || "\u{1F310}"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            <Badge label={signal.platform} color={COLORS.purpleMid} small />
            <Badge label={signal.urgency} color={URGENCY_COLOR[signal.urgency]} small />
            <Badge label={signal.product} color={PRODUCT_COLOR[signal.product] || COLORS.orange} small />
            <span style={{ fontSize: 10, color: COLORS.textMuted }}>{PERSONA_ICONS[signal.persona]} {signal.persona}</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>
            {signal.painPoint}
          </div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, fontStyle: "italic", lineHeight: 1.4 }}>
            &ldquo;{signal.quote}&rdquo;
          </div>
          {expanded && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${COLORS.darkBorder}` }}>
              <div style={{ fontSize: 11, color: COLORS.purpleLight, marginBottom: 6 }}>
                <strong>Channel:</strong> {signal.channel}
              </div>
              <div style={{ fontSize: 11, color: COLORS.purpleLight, marginBottom: 8 }}>
                <strong>Angle:</strong> {signal.responseAngle}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {signal.tags?.map(t => (
                  <Badge key={t} label={t} color={COLORS.textMuted} small />
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a href={buildSearchUrl(signal.platform, signal.channel, signal.painPoint, signal.tags)}
                  target="_blank" rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{
                    background: COLORS.purple,
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    padding: "7px 14px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    letterSpacing: "0.03em",
                    textDecoration: "none",
                    display: "inline-block",
                  }}>Find Conversation</a>
                <button onClick={e => { e.stopPropagation(); onDraft(signal); }} style={{
                  background: COLORS.orange,
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "7px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: "0.03em",
                }}>Draft Response as Kim</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DraftPanel({ signal, onClose }) {
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const result = await callClaude([{
          role: "user",
          content: `DRAFT task. Write a response as Kim Culley for this signal:\n\nPlatform: ${signal.platform}\nChannel: ${signal.channel}\nPersona: ${signal.persona}\nPain point: ${signal.painPoint}\nEducator quote: "${signal.quote}"\nProduct angle: ${signal.responseAngle}\n\nWrite an authentic peer-to-peer response. NOT salesy. Kim is a fellow principal/IB coordinator, not a vendor. Lead with empathy and expertise. Then naturally mention Clear Path only if it genuinely fits.`
        }]);
        setDraft(result);
      } catch (e) {
        setDraft({ draft: "Error generating draft. Please try again.", subject: "", toneNotes: "", followUp: "" });
      }
      setLoading(false);
    })();
  }, [signal]);

  const copy = () => {
    navigator.clipboard.writeText(draft?.draft || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#00000088", zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: COLORS.darkCard,
        border: `1px solid ${COLORS.orange}`,
        borderRadius: 12,
        padding: 24,
        maxWidth: 560,
        width: "100%",
        maxHeight: "80vh",
        overflow: "auto",
        boxShadow: `0 0 40px ${COLORS.orange}33`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.orange }}>DRAFT RESPONSE — {signal.platform}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.textMuted, fontSize: 18, cursor: "pointer" }}>X</button>
        </div>
        {loading ? (
          <div style={{ color: COLORS.textMuted, fontSize: 13, textAlign: "center", padding: 30 }}>
            Drafting Kim's response...
          </div>
        ) : (
          <>
            {draft?.subject && (
              <div style={{ background: COLORS.dark, borderRadius: 6, padding: "8px 12px", marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 2 }}>SUBJECT / HEADLINE</div>
                <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 600 }}>{draft.subject}</div>
              </div>
            )}
            <div style={{
              background: COLORS.dark,
              borderRadius: 8,
              padding: 16,
              fontSize: 13,
              color: COLORS.text,
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              marginBottom: 12,
              border: `1px solid ${COLORS.darkBorder}`,
            }}>{draft?.draft}</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1, background: COLORS.dark, borderRadius: 6, padding: "8px 10px" }}>
                <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 2 }}>TONE NOTES</div>
                <div style={{ fontSize: 11, color: COLORS.purpleLight }}>{draft?.toneNotes}</div>
              </div>
            </div>
            {draft?.followUp && (
              <div style={{ background: COLORS.orange + "11", border: `1px solid ${COLORS.orange}44`, borderRadius: 6, padding: "8px 12px", marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: COLORS.orange, marginBottom: 2, fontWeight: 700 }}>FOLLOW-UP ACTION</div>
                <div style={{ fontSize: 12, color: COLORS.text }}>{draft.followUp}</div>
              </div>
            )}
            <button onClick={copy} style={{
              background: copied ? COLORS.success : COLORS.purple,
              color: "#fff", border: "none", borderRadius: 6,
              padding: "9px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer", width: "100%",
            }}>{copied ? "Copied!" : "Copy to Clipboard"}</button>
          </>
        )}
      </div>
    </div>
  );
}

export default function SignalDashboard() {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [trendSummary, setTrendSummary] = useState("");
  const [topOpportunity, setTopOpportunity] = useState("");
  const [draftSignal, setDraftSignal] = useState(null);
  const [newIds, setNewIds] = useState(new Set());
  const [filter, setFilter] = useState("ALL");
  const [lastScan, setLastScan] = useState(null);
  const scanCount = useRef(0);

  const FILTERS = ["ALL", "WAYPOINT", "APEX TEXAS", "APEX IB", "BEACON", "INVESTIGATOR", "TPT", "LEAD MAGNET"];

  const runScan = async () => {
    setScanning(true);
    setLoading(true);
    scanCount.current += 1;
    const scanNum = scanCount.current;

    const focusAreas = scanNum % 3 === 0
      ? "Focus heavily on IB coordinator and international school pain points this scan."
      : scanNum % 2 === 0
      ? "Focus on counselor and mental health/crisis workflow pain points this scan."
      : "Focus on DAEP, discipline compliance, and T-TESS observation pain points this scan.";

    try {
      const result = await callClaude([{
        role: "user",
        content: `SCAN task. Simulate a real-time social media and web intelligence scan for Clear Path Education Group. ${focusAreas} Today's scan #${scanNum}. Return 8-10 fresh signals, different from any previous scan. Make educator quotes feel urgent and real.`
      }]);

      const incoming = result.signals || [];
      const ids = new Set(incoming.map(s => s.id));
      setNewIds(ids);
      setTimeout(() => setNewIds(new Set()), 8000);

      setSignals(prev => {
        const merged = [...incoming, ...prev].slice(0, 30);
        return merged;
      });
      setTrendSummary(result.trendSummary || "");
      setTopOpportunity(result.topOpportunity || "");
      setLastScan(new Date());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
    setScanning(false);
  };

  const filtered = filter === "ALL" ? signals : signals.filter(s => s.product === filter);
  const highUrgency = signals.filter(s => s.urgency === "high").length;

  return (
    <div style={{
      minHeight: "100vh",
      background: COLORS.dark,
      fontFamily: "'DM Mono', 'Fira Code', 'Courier New', monospace",
      color: COLORS.text,
      padding: "0 0 40px 0",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:${COLORS.dark}} ::-webkit-scrollbar-thumb{background:${COLORS.darkBorder}}
        *{margin:0;padding:0;box-sizing:border-box}
      `}</style>

      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${COLORS.dark} 0%, ${COLORS.darkCard} 100%)`,
        borderBottom: `1px solid ${COLORS.darkBorder}`,
        padding: "20px 24px 16px",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: COLORS.orange, fontWeight: 700, letterSpacing: "0.2em", marginBottom: 2 }}>
              CLEAR PATH EDUCATION GROUP
            </div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: COLORS.text, letterSpacing: "-0.02em" }}>
              SIGNAL
            </div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 1 }}>Market Intelligence + Response Engine</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <PulseOrb active={scanning} />
            <span style={{ fontSize: 10, color: COLORS.textMuted }}>
              {scanning ? "Scanning..." : lastScan ? `Last scan ${lastScan.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Ready"}
            </span>
            <button onClick={runScan} disabled={loading} style={{
              background: loading ? COLORS.darkBorder : COLORS.orange,
              color: "#fff", border: "none", borderRadius: 6,
              padding: "9px 18px", fontSize: 12, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              letterSpacing: "0.05em",
              transition: "all 0.2s",
            }}>
              {loading ? "Scanning..." : "RUN SCAN"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 24px" }}>
        {/* Stats Row */}
        {signals.length > 0 && (
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            {[
              { label: "Total Signals", value: signals.length, color: COLORS.purpleMid },
              { label: "High Urgency", value: highUrgency, color: COLORS.danger },
              { label: "Scans Run", value: scanCount.current, color: COLORS.orange },
              { label: "New This Scan", value: newIds.size || 0, color: COLORS.success },
            ].map(stat => (
              <div key={stat.label} style={{
                background: COLORS.darkCard, border: `1px solid ${COLORS.darkBorder}`,
                borderRadius: 8, padding: "10px 16px", flex: 1, minWidth: 100,
              }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: stat.color, fontFamily: "'Syne', sans-serif" }}>{stat.value}</div>
                <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.1em" }}>{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Top Opportunity Banner */}
        {topOpportunity && (
          <div style={{
            background: `linear-gradient(135deg, ${COLORS.orange}18, ${COLORS.purple}18)`,
            border: `1px solid ${COLORS.orange}44`,
            borderRadius: 8, padding: "12px 16px", marginBottom: 16,
            animation: "fadeIn 0.4s ease",
          }}>
            <div style={{ fontSize: 10, color: COLORS.orange, fontWeight: 700, marginBottom: 4, letterSpacing: "0.15em" }}>TOP OPPORTUNITY RIGHT NOW</div>
            <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.5 }}>{topOpportunity}</div>
          </div>
        )}

        {/* Trend Summary */}
        {trendSummary && (
          <div style={{
            background: COLORS.darkCard, border: `1px solid ${COLORS.darkBorder}`,
            borderRadius: 8, padding: "12px 16px", marginBottom: 16,
          }}>
            <div style={{ fontSize: 10, color: COLORS.purpleMid, fontWeight: 700, marginBottom: 4, letterSpacing: "0.15em" }}>MARKET INTELLIGENCE SUMMARY</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.6 }}>{trendSummary}</div>
          </div>
        )}

        {/* Filter Tabs */}
        {signals.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                background: filter === f ? COLORS.purple : COLORS.darkCard,
                color: filter === f ? "#fff" : COLORS.textMuted,
                border: `1px solid ${filter === f ? COLORS.purple : COLORS.darkBorder}`,
                borderRadius: 4, padding: "4px 10px", fontSize: 10,
                fontWeight: 700, cursor: "pointer", letterSpacing: "0.08em",
                fontFamily: "inherit",
              }}>{f}</button>
            ))}
          </div>
        )}

        {/* Empty State */}
        {filtered.length === 0 && !loading && (
          <div style={{
            textAlign: "center", padding: "60px 20px",
            border: `1px dashed ${COLORS.darkBorder}`, borderRadius: 12,
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>...</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.purpleMid, marginBottom: 6, fontFamily: "'Syne', sans-serif" }}>
              No signals yet
            </div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 20 }}>
              Run a scan to find educators who need what Clear Path builds.<br />
              Covers Facebook, Twitter, Reddit, TpT, LinkedIn, Google Trends.
            </div>
            <button onClick={runScan} style={{
              background: COLORS.orange, color: "#fff", border: "none",
              borderRadius: 6, padding: "10px 24px", fontSize: 13,
              fontWeight: 700, cursor: "pointer", letterSpacing: "0.05em",
            }}>RUN FIRST SCAN</button>
          </div>
        )}

        {/* Signal Cards */}
        {filtered.map(signal => (
          <div key={signal.id} style={{ animation: newIds.has(signal.id) ? "fadeIn 0.4s ease" : "none" }}>
            <SignalCard signal={signal} onDraft={setDraftSignal} isNew={newIds.has(signal.id)} />
          </div>
        ))}

        {/* Legend */}
        {signals.length > 0 && (
          <div style={{
            marginTop: 20, padding: "12px 16px",
            background: COLORS.darkCard, borderRadius: 8,
            border: `1px solid ${COLORS.darkBorder}`,
          }}>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 8, letterSpacing: "0.1em" }}>URGENCY GUIDE</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {[["high", "Respond within 24hr"], ["medium", "Content opportunity"], ["low", "Long-term SEO play"]].map(([u, desc]) => (
                <div key={u} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: URGENCY_COLOR[u] }} />
                  <span style={{ fontSize: 10, color: COLORS.textMuted }}><strong style={{ color: URGENCY_COLOR[u] }}>{u.toUpperCase()}</strong> — {desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {draftSignal && <DraftPanel signal={draftSignal} onClose={() => setDraftSignal(null)} />}
    </div>
  );
}
