import { useState, useRef } from "react";

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `You are SIGNAL, a market intelligence agent for Clear Path Education Group. Your job is to find REAL conversations, posts, and content from REAL people on the internet — then tell Kim and Melissa exactly where to show up and what to say.

Kim Culley: sitting DAEP Principal, former Head of School, IB Programme Coordinator.
Melissa: IB Programme Coordinator, teacher engagement resource creator.

Products:
- WAYPOINT: DAEP + discipline management SaaS for Texas districts. Demo: waypoint.clearpathedgroup.com/demo
- APEX TEXAS: AI instructional leadership (T-TESS, voice→coaching). Trial: clearpath-apex.pages.dev/try
- APEX IB: IB coordinator platform (PSP 2020, self-study, observation)
- BEACON: Counselor command center ($8/mo). SB 179 80/20 compliance, groups, referrals
- INVESTIGATOR TOOLKIT: Campus investigation workflow ($5/mo)
- ENGAGEMENT BUNDLES by Melissa ($7-$12.50): Partner Activities, Small Group, Whole Class, CFU bundles for grades 4-12
- TpT Store + Lead magnets: compliance checklists, discipline trackers, counselor tools

Website: clearpathedgroup.com | Store: clearpathedgroup.com/store.html

CRITICAL RULES:
1. You have web search. USE IT. Search for real posts, real threads, real people.
2. Every signal you return MUST have a real URL that Kim can click and find the actual conversation.
3. DO NOT make up quotes, people, or posts. Only report what you actually find via search.
4. If a search returns nothing useful, say so — do not fabricate results.
5. For each real finding, write a specific talking point Kim or Melissa can use to respond.
6. ONLY return results from discussion threads, forum posts, social media posts, and Q&A threads where REAL PEOPLE are asking questions or expressing frustration.
7. SKIP any result that is a product listing, store page, blog post selling something, or company marketing page. We want PEOPLE WITH PROBLEMS, not sellers with solutions.
8. Prioritize: Reddit threads, Facebook Group posts, Twitter/X posts, LinkedIn personal posts, Quora questions, forum discussions.
9. The best signals are posts where someone says "I need help with...", "does anyone have...", "I'm struggling with...", "looking for recommendations..."

When you find real conversations, return JSON ONLY (no markdown):
{
  "signals": [
    {
      "id": "unique-id",
      "url": "REAL URL to the actual post/thread/article",
      "platform": "Reddit / Facebook / LinkedIn / TpT / Twitter / Blog / Forum",
      "title": "actual title or first line of the post",
      "author": "username or name if visible",
      "painPoint": "what problem this person has",
      "product": "WAYPOINT / APEX TEXAS / APEX IB / BEACON / INVESTIGATOR / ENGAGEMENT / BRAND",
      "urgency": "respond today / this week / content idea",
      "talkingPoint": "2-3 sentences Kim or Melissa should say in response — authentic educator voice, peer-to-peer, NOT salesy",
      "whyThisMatters": "1 sentence on why this is a real opportunity"
    }
  ],
  "summary": "2-3 sentence overview of what you found",
  "topAction": "the single most important thing to do right now"
}`;

const COLORS = {
  purple: "#4B2D7F", purpleMid: "#6B4BA1", purpleLight: "#EDE7F6",
  orange: "#E8650A", dark: "#1A1025", darkCard: "#231535",
  darkBorder: "#3D2560", text: "#F0EAF8", textMuted: "#9B87C0",
  success: "#22C55E", warning: "#F59E0B", danger: "#EF4444",
};

const PRODUCT_COLOR = {
  WAYPOINT: "#3B82F6", "APEX TEXAS": "#8B5CF6", "APEX IB": "#06B6D4",
  BEACON: "#22C55E", INVESTIGATOR: "#F59E0B", ENGAGEMENT: "#14B8A6",
  TPT: COLORS.orange, BRAND: "#EC4899",
};

const URGENCY_STYLE = {
  "respond today": { color: COLORS.danger, bg: COLORS.danger + "18" },
  "this week": { color: COLORS.warning, bg: COLORS.warning + "18" },
  "content idea": { color: COLORS.success, bg: COLORS.success + "18" },
};

const SCAN_QUERIES = [
  [
    "reddit.com r/Teachers DAEP ISS discipline tracking frustrated",
    "reddit.com r/SchoolCounseling caseload overwhelmed tracking groups",
    "facebook.com groups Texas school administrators discipline help",
    "twitter.com #txeducator DAEP OR discipline OR compliance",
  ],
  [
    "reddit.com r/Teachers student engagement boring lessons ideas help",
    "reddit.com r/IBO coordinator self study evaluation overwhelmed",
    "facebook.com groups school counselors SB 179 OR 80/20 OR caseload",
    "twitter.com #ttess observation walkthrough frustrating OR overwhelming",
  ],
  [
    "reddit.com r/Teachers ISS OSS referral tracking need help spreadsheet",
    "reddit.com r/SchoolCounseling end of year transition handoff students",
    "facebook.com groups elementary counselors group tracking activities",
    "linkedin.com school principal discipline documentation compliance",
  ],
  [
    "reddit.com r/Teachers group activities participation struggling advice",
    "reddit.com r/K12sysadmin discipline management software district",
    "facebook.com groups IB coordinators evaluation visit preparation",
    "twitter.com school counselor overwhelmed end of year caseload",
  ],
];

async function runScanWithSearch(batchNum) {
  const queries = SCAN_QUERIES[(batchNum - 1) % SCAN_QUERIES.length];
  const searchPrompt = queries.map((q, i) => `Search ${i + 1}: "${q}"`).join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 10 }],
      messages: [{
        role: "user",
        content: `Run these searches and find REAL discussion threads, forum posts, and social media posts from REAL educators asking for help, venting frustrations, or seeking recommendations.\n\n${searchPrompt}\n\nIMPORTANT: SKIP all product pages, store listings, blog posts selling things, and company marketing. I ONLY want posts from real people in discussion threads — Reddit, Facebook Groups, Twitter, LinkedIn personal posts, Quora, teacher forums.\n\nThe best results are people saying "I need...", "does anyone know...", "I'm struggling with...", "any recommendations for..."\n\nFor each real result, match it to a Clear Path product and write a talking point. Return 6-10 real signals with real URLs. If you can't find discussion posts for a search, skip it — do NOT fabricate or substitute a product page.`
      }],
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message);

  // Extract the final text block (after all tool uses)
  const textBlocks = (data.content || []).filter(b => b.type === "text");
  const lastText = textBlocks[textBlocks.length - 1]?.text || "";
  const clean = lastText.replace(/```json|```/g, "").trim();

  // Find JSON in the response
  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No structured response returned");
  return JSON.parse(jsonMatch[0]);
}

function Badge({ label, color, small }) {
  return (
    <span style={{
      background: color + "22", color,
      border: `1px solid ${color}44`, borderRadius: 4,
      padding: small ? "1px 6px" : "2px 8px",
      fontSize: small ? 10 : 11, fontWeight: 700,
      letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

function SignalCard({ signal }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const urg = URGENCY_STYLE[signal.urgency] || URGENCY_STYLE["content idea"];

  const copyTalkingPoint = () => {
    navigator.clipboard.writeText(signal.talkingPoint || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      background: COLORS.darkCard,
      border: `1px solid ${COLORS.darkBorder}`,
      borderLeft: `3px solid ${PRODUCT_COLOR[signal.product] || COLORS.orange}`,
      borderRadius: 8, padding: "14px 16px", marginBottom: 10,
    }}>
      {/* Header badges */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        <Badge label={signal.platform} color={COLORS.purpleMid} small />
        <Badge label={signal.product} color={PRODUCT_COLOR[signal.product] || COLORS.orange} small />
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "1px 6px",
          borderRadius: 4, background: urg.bg, color: urg.color,
          textTransform: "uppercase",
        }}>{signal.urgency}</span>
      </div>

      {/* Title + author */}
      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 4, lineHeight: 1.4 }}>
        {signal.title}
      </div>
      {signal.author && (
        <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 6 }}>
          by {signal.author}
        </div>
      )}

      {/* Pain point */}
      <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 8 }}>
        {signal.painPoint}
      </div>

      {/* Why this matters */}
      {signal.whyThisMatters && (
        <div style={{
          fontSize: 11, color: COLORS.purpleLight, fontStyle: "italic",
          marginBottom: 8, paddingLeft: 10,
          borderLeft: `2px solid ${COLORS.darkBorder}`,
        }}>
          {signal.whyThisMatters}
        </div>
      )}

      {/* Expand for talking point */}
      <button onClick={() => setExpanded(!expanded)} style={{
        background: "none", border: `1px solid ${COLORS.darkBorder}`,
        color: COLORS.textMuted, borderRadius: 4,
        padding: "4px 10px", fontSize: 11, cursor: "pointer",
      }}>
        {expanded ? "Hide Talking Point" : "Show Talking Point"}
      </button>

      {expanded && (
        <div style={{ marginTop: 10, animation: "fadeIn 0.3s ease" }}>
          <div style={{
            background: COLORS.dark, borderRadius: 8, padding: 14,
            fontSize: 13, color: COLORS.text, lineHeight: 1.6,
            border: `1px solid ${COLORS.darkBorder}`, marginBottom: 10,
            whiteSpace: "pre-wrap",
          }}>
            {signal.talkingPoint}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={copyTalkingPoint} style={{
              background: copied ? COLORS.success : COLORS.purple,
              color: "#fff", border: "none", borderRadius: 6,
              padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", flex: 1,
            }}>{copied ? "Copied!" : "Copy Talking Point"}</button>
            <a href={signal.url} target="_blank" rel="noopener noreferrer" style={{
              background: COLORS.orange, color: "#fff",
              border: "none", borderRadius: 6,
              padding: "7px 14px", fontSize: 12, fontWeight: 700,
              cursor: "pointer", textDecoration: "none", textAlign: "center", flex: 1,
            }}>Go to Post</a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SignalDashboard() {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState("");
  const [topAction, setTopAction] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [error, setError] = useState(null);
  const batchCount = useRef(0);

  const FILTERS = ["ALL", "WAYPOINT", "APEX TEXAS", "APEX IB", "BEACON", "INVESTIGATOR", "ENGAGEMENT"];

  const runScan = async () => {
    setLoading(true);
    setError(null);
    batchCount.current += 1;

    try {
      const result = await runScanWithSearch(batchCount.current);
      const incoming = result.signals || [];
      setSignals(prev => [...incoming, ...prev].slice(0, 40));
      setSummary(result.summary || "");
      setTopAction(result.topAction || "");
    } catch (e) {
      setError(e.message || "Scan failed. Try again.");
      console.error(e);
    }
    setLoading(false);
  };

  const filtered = filter === "ALL" ? signals : signals.filter(s => s.product === filter);

  return (
    <div style={{
      minHeight: "100vh", background: COLORS.dark,
      fontFamily: "'DM Mono', 'Fira Code', 'Courier New', monospace",
      color: COLORS.text, padding: "0 0 40px 0",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');
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
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: COLORS.text }}>
              SIGNAL
            </div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 1 }}>Real-Time Market Intelligence</div>
          </div>
          <button onClick={runScan} disabled={loading} style={{
            background: loading ? COLORS.darkBorder : COLORS.orange,
            color: "#fff", border: "none", borderRadius: 6,
            padding: "10px 22px", fontSize: 13, fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
          }}>
            {loading ? "Scanning the web..." : "SCAN NOW"}
          </button>
        </div>
      </div>

      <div style={{ padding: "16px 24px" }}>
        {error && (
          <div style={{
            background: COLORS.danger + "18", border: `1px solid ${COLORS.danger}44`,
            borderRadius: 8, padding: "10px 14px", marginBottom: 12,
            fontSize: 12, color: COLORS.danger,
          }}>{error}</div>
        )}

        {/* Stats */}
        {signals.length > 0 && (
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            {[
              { label: "Signals Found", value: signals.length, color: COLORS.purpleMid },
              { label: "Respond Today", value: signals.filter(s => s.urgency === "respond today").length, color: COLORS.danger },
              { label: "This Week", value: signals.filter(s => s.urgency === "this week").length, color: COLORS.warning },
              { label: "Scans", value: batchCount.current, color: COLORS.orange },
            ].map(s => (
              <div key={s.label} style={{
                background: COLORS.darkCard, border: `1px solid ${COLORS.darkBorder}`,
                borderRadius: 8, padding: "10px 16px", flex: 1, minWidth: 100,
              }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: "'Syne', sans-serif" }}>{s.value}</div>
                <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.1em" }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Top Action */}
        {topAction && (
          <div style={{
            background: `linear-gradient(135deg, ${COLORS.orange}18, ${COLORS.purple}18)`,
            border: `1px solid ${COLORS.orange}44`,
            borderRadius: 8, padding: "12px 16px", marginBottom: 16,
          }}>
            <div style={{ fontSize: 10, color: COLORS.orange, fontWeight: 700, marginBottom: 4, letterSpacing: "0.15em" }}>DO THIS FIRST</div>
            <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.5 }}>{topAction}</div>
          </div>
        )}

        {/* Summary */}
        {summary && (
          <div style={{
            background: COLORS.darkCard, border: `1px solid ${COLORS.darkBorder}`,
            borderRadius: 8, padding: "12px 16px", marginBottom: 16,
          }}>
            <div style={{ fontSize: 10, color: COLORS.purpleMid, fontWeight: 700, marginBottom: 4, letterSpacing: "0.15em" }}>INTELLIGENCE SUMMARY</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.6 }}>{summary}</div>
          </div>
        )}

        {/* Filters */}
        {signals.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                background: filter === f ? COLORS.purple : COLORS.darkCard,
                color: filter === f ? "#fff" : COLORS.textMuted,
                border: `1px solid ${filter === f ? COLORS.purple : COLORS.darkBorder}`,
                borderRadius: 4, padding: "4px 10px", fontSize: 10,
                fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}>{f}</button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {signals.length === 0 && !loading && (
          <div style={{
            textAlign: "center", padding: "60px 20px",
            border: `1px dashed ${COLORS.darkBorder}`, borderRadius: 12,
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.purpleMid, marginBottom: 6, fontFamily: "'Syne', sans-serif" }}>
              Ready to scan
            </div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
              SIGNAL searches the real web — Reddit, Facebook, LinkedIn, TpT, blogs —<br />
              and finds real educators talking about problems your products solve.<br />
              Every result has a real URL. Every talking point is ready to use.
            </div>
            <button onClick={runScan} style={{
              background: COLORS.orange, color: "#fff", border: "none",
              borderRadius: 6, padding: "10px 24px", fontSize: 13,
              fontWeight: 700, cursor: "pointer",
            }}>RUN FIRST SCAN</button>
          </div>
        )}

        {/* Signal cards */}
        {filtered.map(signal => (
          <div key={signal.id} style={{ animation: "fadeIn 0.4s ease" }}>
            <SignalCard signal={signal} />
          </div>
        ))}
      </div>
    </div>
  );
}
