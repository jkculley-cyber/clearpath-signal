import { useState, useRef } from "react";

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

const COLORS = {
  purple: "#4B2D7F", purpleMid: "#6B4BA1", purpleLight: "#EDE7F6",
  orange: "#E8650A", dark: "#1A1025", darkCard: "#231535",
  darkBorder: "#3D2560", text: "#F0EAF8", textMuted: "#9B87C0",
  success: "#22C55E", warning: "#F59E0B", danger: "#EF4444",
};

const PRODUCT_COLOR = {
  WAYPOINT: "#3B82F6", "APEX TEXAS": "#8B5CF6", "APEX IB": "#06B6D4",
  BEACON: "#22C55E", INVESTIGATOR: "#F59E0B", ENGAGEMENT: "#14B8A6",
  BRAND: "#EC4899",
};

const URGENCY_STYLE = {
  "respond now": { color: COLORS.danger, bg: COLORS.danger + "18" },
  "this week": { color: COLORS.warning, bg: COLORS.warning + "18" },
  "content idea": { color: COLORS.success, bg: COLORS.success + "18" },
};

// Reddit searches — real subreddits, real keywords
const SEARCH_SETS = [
  [
    { sub: "Teachers", q: "discipline referral tracking system", sort: "new" },
    { sub: "Teachers", q: "student engagement boring lessons help", sort: "relevance" },
    { sub: "schoolcounseling", q: "caseload overwhelmed tracking", sort: "new" },
    { sub: "specialed", q: "manifestation determination discipline IEP", sort: "new" },
    { sub: "Teachers", q: "ISS OSS suspension alternative", sort: "relevance" },
  ],
  [
    { sub: "Teachers", q: "group activities participation strategies", sort: "new" },
    { sub: "education", q: "discipline policy compliance documentation", sort: "new" },
    { sub: "schoolcounseling", q: "end of year transition students risk", sort: "new" },
    { sub: "IBO", q: "coordinator evaluation self study", sort: "relevance" },
    { sub: "specialed", q: "behavior plan tracking data collection", sort: "relevance" },
  ],
  [
    { sub: "Teachers", q: "SPED manifestation IEP discipline removal", sort: "relevance" },
    { sub: "Teachers", q: "exit tickets formative assessment ideas", sort: "new" },
    { sub: "schoolcounseling", q: "group counseling tracking data sessions", sort: "relevance" },
    { sub: "education", q: "alternative education DAEP program placement", sort: "new" },
    { sub: "Teachers", q: "observation walkthrough feedback evaluation", sort: "new" },
  ],
  [
    { sub: "Teachers", q: "students won't work refuse participate", sort: "new" },
    { sub: "K12sysadmin", q: "discipline management software platform", sort: "relevance" },
    { sub: "schoolcounseling", q: "compliance time tracking counselor duties", sort: "new" },
    { sub: "specialed", q: "SPED coordinator overwhelmed compliance paperwork", sort: "new" },
    { sub: "Teachers", q: "behavior tracking data collection frustrated", sort: "relevance" },
  ],
  [
    { sub: "education", q: "school discipline reform Texas policy", sort: "new" },
    { sub: "Teachers", q: "classroom management system help advice", sort: "new" },
    { sub: "schoolcounseling", q: "elementary counselor groups scheduling caseload", sort: "relevance" },
    { sub: "specialed", q: "IEP meeting ARD compliance deadline", sort: "new" },
    { sub: "Teachers", q: "engagement strategies reluctant learners unmotivated", sort: "relevance" },
  ],
  [
    { sub: "Teachers", q: "admin documentation discipline write up process", sort: "new" },
    { sub: "schoolpsychology", q: "behavior intervention plan FBA manifestation", sort: "relevance" },
    { sub: "education", q: "student behavior crisis school support", sort: "new" },
    { sub: "IBO", q: "IB programme coordinator workload authorization", sort: "new" },
    { sub: "Teachers", q: "partner activities group work cooperative learning", sort: "relevance" },
  ],
];

async function searchReddit(sub, query, sort, limit = 5) {
  const url = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(query)}&sort=${sort}&limit=${limit}&restrict_sr=on&t=year`;
  const res = await fetch(url, { headers: { "User-Agent": "SIGNAL/1.0 (clearpathedgroup.com)" } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.data?.children || []).map(p => ({
    title: p.data.title,
    author: p.data.author,
    url: "https://reddit.com" + p.data.permalink,
    subreddit: p.data.subreddit_name_prefixed,
    score: p.data.score,
    comments: p.data.num_comments,
    text: (p.data.selftext || "").slice(0, 300),
    created: new Date(p.data.created_utc * 1000).toLocaleDateString(),
  }));
}

const TWITTER_SEARCHES = [
  "#txeducator discipline DAEP frustrated",
  "#schoolcounselor caseload overwhelmed help",
  "#ttess observation walkthrough principal time",
  "teacher \"student engagement\" struggling activities",
  "#IBcoordinator evaluation self-study preparation",
  "school counselor \"end of year\" students transition",
  "campus admin discipline documentation tracking",
  "teacher \"group activities\" participation ideas",
];

async function searchTwitterViaClaude(batchNum) {
  const queries = [
    TWITTER_SEARCHES[(batchNum * 2 - 2) % TWITTER_SEARCHES.length],
    TWITTER_SEARCHES[(batchNum * 2 - 1) % TWITTER_SEARCHES.length],
  ];

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
      max_tokens: 2048,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
      messages: [{
        role: "user",
        content: `Search Twitter/X for real tweets from real educators about these topics:\n1. ${queries[0]}\n2. ${queries[1]}\n\nFind actual tweets from individual educators (not organizations or companies). I need the tweet URL (x.com/username/status/...), the username, and what they said.\n\nReturn JSON ONLY:\n{"tweets": [{"url": "https://x.com/...", "username": "@handle", "text": "what they said", "platform": "Twitter/X"}]}\n\nIf you cannot find real tweets with real URLs, return {"tweets": []}. Do NOT fabricate tweets or URLs.`
      }],
    }),
  });

  const data = await res.json();
  if (data.error) return [];
  const textBlocks = (data.content || []).filter(b => b.type === "text");
  const lastText = textBlocks[textBlocks.length - 1]?.text || "";
  try {
    const clean = lastText.replace(/```json|```/g, "").trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];
    const result = JSON.parse(jsonMatch[0]);
    return (result.tweets || []).map(t => ({
      title: t.text?.slice(0, 100) || "",
      author: t.username || "unknown",
      url: t.url || "",
      subreddit: "Twitter/X",
      score: 0,
      comments: 0,
      text: t.text || "",
      created: "recent",
    }));
  } catch {
    return [];
  }
}

async function analyzeWithClaude(posts) {
  const postSummaries = posts.map((p, i) =>
    `POST ${i + 1}:\nTitle: ${p.title}\nAuthor: ${p.subreddit === "Twitter/X" ? "" : "u/"}${p.author}\nPlatform: ${p.subreddit}\nScore: ${p.score} | ${p.comments} comments\nDate: ${p.created}\nURL: ${p.url}\nText: ${p.text}\n`
  ).join("\n---\n");

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
      system: `You are SIGNAL, a market intelligence analyst for Clear Path Education Group.

Kim Culley: sitting DAEP Principal, former Head of School, IB Programme Coordinator.
Melissa: IB Programme Coordinator, creates classroom engagement resources.

Products:
- WAYPOINT: DAEP + discipline management SaaS for Texas districts
- APEX TEXAS: AI instructional leadership (T-TESS, voice coaching) $10/mo
- APEX IB: IB coordinator platform (self-study, observation, Learner Profile)
- BEACON: Counselor command center $8/mo (SB 179 80/20, groups, referrals)
- INVESTIGATOR TOOLKIT: Campus investigation workflow $5/mo
- ENGAGEMENT BUNDLES by Melissa ($7-12.50): Partner Activities, Small Group, Whole Class, CFU bundles for grades 4-12

You are analyzing REAL posts from Reddit and Twitter/X from real educators. Your job:
1. Identify which posts represent someone who has a problem Clear Path can solve
2. Score urgency — can Kim/Melissa respond directly to this person right now?
3. Write a ready-to-paste reply (Reddit comment or Twitter reply) in Kim's or Melissa's authentic educator voice
4. Be ruthlessly honest — if a post is not relevant, skip it. Quality over quantity.

Return JSON ONLY:
{
  "signals": [
    {
      "id": "post-number",
      "title": "exact post title",
      "author": "u/username",
      "subreddit": "r/subreddit",
      "url": "exact reddit URL",
      "score": number,
      "comments": number,
      "date": "date string",
      "painPoint": "1 sentence — what problem does this person have",
      "product": "WAYPOINT / APEX TEXAS / APEX IB / BEACON / INVESTIGATOR / ENGAGEMENT / BRAND",
      "urgency": "respond now / this week / content idea",
      "readyToPost": "Full Reddit comment Kim or Melissa can paste as a reply. Authentic educator voice. Lead with empathy and experience. Mention Clear Path ONLY if it genuinely fits — many responses should be pure value with no pitch. 3-5 sentences max.",
      "whyThisMatters": "1 sentence on why this is worth responding to"
    }
  ],
  "summary": "2 sentence overview",
  "topAction": "the #1 thing to do right now"
}

Skip posts that are not relevant. Only return posts where a real person has a real problem. Prefer posts with high engagement (upvotes + comments) — those have more eyeballs.`,
      messages: [{
        role: "user",
        content: `Analyze these real Reddit posts and identify which ones are opportunities for Clear Path Education Group. Only include posts where someone has a genuine pain point we can address.\n\n${postSummaries}`
      }],
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  const clean = text.replace(/```json|```/g, "").trim();
  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No analysis returned");
  return JSON.parse(jsonMatch[0]);
}

function SignalCard({ signal }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const urg = URGENCY_STYLE[signal.urgency] || URGENCY_STYLE["content idea"];

  const copyResponse = () => {
    navigator.clipboard.writeText(signal.readyToPost || "");
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
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
          background: COLORS.purpleMid + "22", color: COLORS.purpleMid,
          border: `1px solid ${COLORS.purpleMid}44`,
        }}>{signal.subreddit}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
          background: (PRODUCT_COLOR[signal.product] || COLORS.orange) + "22",
          color: PRODUCT_COLOR[signal.product] || COLORS.orange,
          border: `1px solid ${(PRODUCT_COLOR[signal.product] || COLORS.orange)}44`,
        }}>{signal.product}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
          background: urg.bg, color: urg.color,
        }}>{signal.urgency}</span>
        <span style={{ fontSize: 10, color: COLORS.textMuted }}>
          {signal.score > 0 ? `${signal.score} pts | ` : ""}{signal.comments > 0 ? `${signal.comments} comments | ` : ""}{signal.date}
        </span>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 4, lineHeight: 1.4 }}>
        {signal.title}
      </div>
      <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>
        {signal.author}
      </div>
      <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 8 }}>
        {signal.painPoint}
      </div>
      {signal.whyThisMatters && (
        <div style={{
          fontSize: 11, color: COLORS.purpleLight, fontStyle: "italic", marginBottom: 8,
          paddingLeft: 10, borderLeft: `2px solid ${COLORS.darkBorder}`,
        }}>{signal.whyThisMatters}</div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setExpanded(!expanded)} style={{
          background: "none", border: `1px solid ${COLORS.darkBorder}`,
          color: COLORS.textMuted, borderRadius: 4,
          padding: "5px 12px", fontSize: 11, cursor: "pointer",
        }}>{expanded ? "Hide Response" : "Show Ready-to-Post Response"}</button>
        <a href={signal.url} target="_blank" rel="noopener noreferrer" style={{
          background: COLORS.orange, color: "#fff", border: "none", borderRadius: 4,
          padding: "5px 12px", fontSize: 11, fontWeight: 700,
          textDecoration: "none", cursor: "pointer",
        }}>Go to Thread</a>
      </div>

      {expanded && (
        <div style={{ marginTop: 10, animation: "fadeIn 0.3s ease" }}>
          <div style={{
            background: COLORS.dark, borderRadius: 8, padding: 14,
            fontSize: 13, color: COLORS.text, lineHeight: 1.6,
            border: `1px solid ${COLORS.darkBorder}`, marginBottom: 8,
            whiteSpace: "pre-wrap",
          }}>{signal.readyToPost}</div>
          <button onClick={copyResponse} style={{
            background: copied ? COLORS.success : COLORS.purple,
            color: "#fff", border: "none", borderRadius: 6,
            padding: "8px 16px", fontSize: 12, fontWeight: 700,
            cursor: "pointer", width: "100%",
          }}>{copied ? "Copied! Go paste it." : "Copy Response"}</button>
        </div>
      )}
    </div>
  );
}

export default function SignalDashboard() {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
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
    const searches = SEARCH_SETS[(batchCount.current - 1) % SEARCH_SETS.length];

    // Step 1: Search Reddit + Twitter in parallel
    setStatus("Searching Reddit + Twitter...");
    const [redditResults, twitterResults] = await Promise.all([
      Promise.all(searches.map(s => searchReddit(s.sub, s.q, s.sort, 5))),
      searchTwitterViaClaude(batchCount.current),
    ]);
    const allPosts = [...redditResults.flat(), ...twitterResults];

    if (allPosts.length === 0) {
      setError("No posts found. Try again.");
      setLoading(false);
      setStatus("");
      return;
    }

    // Dedupe by URL
    const seen = new Set();
    const unique = allPosts.filter(p => {
      if (seen.has(p.url)) return false;
      seen.add(p.url);
      return true;
    });

    // Step 2: Send to Claude for analysis
    setStatus(`Found ${unique.length} posts. Analyzing with Claude...`);
    try {
      const result = await analyzeWithClaude(unique);
      const incoming = result.signals || [];
      setSignals(prev => [...incoming, ...prev].slice(0, 50));
      setSummary(result.summary || "");
      setTopAction(result.topAction || "");
    } catch (e) {
      setError(e.message || "Analysis failed.");
      console.error(e);
    }

    setLoading(false);
    setStatus("");
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

      <div style={{
        background: `linear-gradient(135deg, ${COLORS.dark} 0%, ${COLORS.darkCard} 100%)`,
        borderBottom: `1px solid ${COLORS.darkBorder}`,
        padding: "20px 24px 16px", position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: COLORS.orange, fontWeight: 700, letterSpacing: "0.2em", marginBottom: 2 }}>
              CLEAR PATH EDUCATION GROUP
            </div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: COLORS.text }}>
              SIGNAL
            </div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 1 }}>
              {status || "Real educators. Real problems. Real URLs."}
            </div>
          </div>
          <button onClick={runScan} disabled={loading} style={{
            background: loading ? COLORS.darkBorder : COLORS.orange,
            color: "#fff", border: "none", borderRadius: 6,
            padding: "10px 22px", fontSize: 13, fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
          }}>
            {loading ? "Scanning..." : "SCAN NOW"}
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

        {signals.length > 0 && (
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            {[
              { label: "Signals", value: signals.length, color: COLORS.purpleMid },
              { label: "Respond Now", value: signals.filter(s => s.urgency === "respond now").length, color: COLORS.danger },
              { label: "This Week", value: signals.filter(s => s.urgency === "this week").length, color: COLORS.warning },
              { label: "Scans", value: batchCount.current, color: COLORS.orange },
            ].map(s => (
              <div key={s.label} style={{
                background: COLORS.darkCard, border: `1px solid ${COLORS.darkBorder}`,
                borderRadius: 8, padding: "10px 16px", flex: 1, minWidth: 90,
              }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: "'Syne', sans-serif" }}>{s.value}</div>
                <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase" }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {topAction && (
          <div style={{
            background: `linear-gradient(135deg, ${COLORS.orange}18, ${COLORS.purple}18)`,
            border: `1px solid ${COLORS.orange}44`,
            borderRadius: 8, padding: "12px 16px", marginBottom: 16,
          }}>
            <div style={{ fontSize: 10, color: COLORS.orange, fontWeight: 700, marginBottom: 4 }}>DO THIS FIRST</div>
            <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.5 }}>{topAction}</div>
          </div>
        )}

        {summary && (
          <div style={{
            background: COLORS.darkCard, border: `1px solid ${COLORS.darkBorder}`,
            borderRadius: 8, padding: "12px 16px", marginBottom: 16,
          }}>
            <div style={{ fontSize: 10, color: COLORS.purpleMid, fontWeight: 700, marginBottom: 4 }}>INTELLIGENCE SUMMARY</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.6 }}>{summary}</div>
          </div>
        )}

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

        {signals.length === 0 && !loading && (
          <div style={{
            textAlign: "center", padding: "60px 20px",
            border: `1px dashed ${COLORS.darkBorder}`, borderRadius: 12,
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.purpleMid, marginBottom: 6, fontFamily: "'Syne', sans-serif" }}>
              Ready to scan
            </div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
              SIGNAL searches Reddit + Twitter/X in real-time — 7 subreddits<br />
              and educator hashtags — finds real people with real problems.<br />
              Every result is a clickable thread. Every response is ready to paste.
            </div>
            <button onClick={runScan} style={{
              background: COLORS.orange, color: "#fff", border: "none",
              borderRadius: 6, padding: "10px 24px", fontSize: 13,
              fontWeight: 700, cursor: "pointer",
            }}>RUN FIRST SCAN</button>
          </div>
        )}

        {filtered.map(signal => (
          <div key={signal.id + signal.url} style={{ animation: "fadeIn 0.4s ease" }}>
            <SignalCard signal={signal} />
          </div>
        ))}
      </div>
    </div>
  );
}
