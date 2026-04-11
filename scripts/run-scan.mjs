#!/usr/bin/env node
// SIGNAL CLI — runs a market intelligence scan from the terminal.
// Same free pipeline as the browser app: Worker for source fetches, Ollama for analysis.
// HARD RULE: never fabricate. If a source fails, report the real error.

import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const WORKER_URL = process.env.WORKER_URL || "https://clearpath-signal-worker.jkculley.workers.dev";
const OLLAMA_URL = process.env.OLLAMA_URL || "https://scout.clearpathedgroup.com";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma3:1b";

// Ops Command Center — write scan results so they show up in clearpath-ops.pages.dev
const OPS_URL = "https://xbpuqaqpcbixxodblaes.supabase.co";
const OPS_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhicHVxYXFwY2JpeHhvZGJsYWVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNjk4MDQsImV4cCI6MjA4Nzk0NTgwNH0.9Rhmz-FLUXnEQXpRCkg3G2ppzPxs2DinaYDmdD_wvPA";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const RUNS_DIR = join(REPO_ROOT, "signal-runs");

// Queries — small focused set, mirrors App.jsx intent
const REDDIT_QUERIES = [
  { sub: "Teachers", q: "discipline referral tracking system" },
  { sub: "schoolcounseling", q: "caseload overwhelmed tracking" },
  { sub: "specialed", q: "manifestation determination IEP discipline" },
  { sub: "Teachers", q: "ISS OSS suspension alternative" },
];
const HN_QUERIES = ["K-12 compliance software", "school discipline tracking"];
const TWITTER_QUERIES = ["#txeducator DAEP discipline", "#schoolcounselor caseload"];
const QUORA_QUERIES = ['"school counselor" caseload tracking'];
const TPT_QUERIES = ["discipline tracker"];
const TRENDS_QUERIES = ["DAEP discipline tracking", "school counselor caseload tracker"];

async function safeFetch(label, url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, label, error: `HTTP ${res.status}`, results: [] };
    const data = await res.json();
    if (data.error) return { ok: false, label, error: data.error, results: data.results || [] };
    return { ok: true, label, results: data.results || [] };
  } catch (e) {
    return { ok: false, label, error: String(e?.message || e), results: [] };
  }
}

async function fetchAll() {
  const tasks = [];
  for (const r of REDDIT_QUERIES) {
    tasks.push(safeFetch(`reddit: ${r.sub}/${r.q}`, `${WORKER_URL}/reddit?q=${encodeURIComponent(`subreddit:${r.sub} ${r.q}`)}&limit=10`));
  }
  for (const q of HN_QUERIES)      tasks.push(safeFetch(`hn: ${q}`,      `${WORKER_URL}/hn?q=${encodeURIComponent(q)}`));
  for (const q of TWITTER_QUERIES) tasks.push(safeFetch(`twitter: ${q}`, `${WORKER_URL}/twitter?q=${encodeURIComponent(q)}`));
  for (const q of QUORA_QUERIES)   tasks.push(safeFetch(`quora: ${q}`,   `${WORKER_URL}/quora?q=${encodeURIComponent(q)}`));
  for (const q of TPT_QUERIES)     tasks.push(safeFetch(`tpt: ${q}`,     `${WORKER_URL}/tpt?q=${encodeURIComponent(q)}`));
  for (const q of TRENDS_QUERIES)  tasks.push(safeFetch(`trends: ${q}`,  `${WORKER_URL}/trends?q=${encodeURIComponent(q)}`));
  return Promise.allSettled(tasks).then(rs => rs.map(r => r.status === "fulfilled" ? r.value : { ok: false, label: "?", error: String(r.reason), results: [] }));
}

function flattenForLLM(results) {
  const lines = [];
  let n = 0;
  for (const r of results) {
    for (const item of r.results) {
      n++;
      const title = item.title || item.text?.slice(0, 100) || "(no title)";
      const author = item.author || "unknown";
      const url = item.url || "(no url)";
      lines.push(`${n}. [${r.label.split(":")[0]}] ${title} | ${author} | ${url}`);
    }
  }
  return lines.join("\n");
}

async function analyzeWithOllama(postsText) {
  if (!postsText.trim()) return "(no posts to analyze)";
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [
          { role: "system", content: "You are SIGNAL, market intelligence analyst for Clear Path Education Group (Texas K-12 compliance SaaS). Analyze the provided posts. Extract: (1) top 3 pain points mentioned, (2) any product opportunities for Waypoint/Apex/Beacon, (3) overall sentiment. Be concise and factual. NEVER invent details not present in the source posts." },
          { role: "user", content: postsText },
        ],
        options: { temperature: 0.3, num_predict: 1024 },
      }),
    });
    if (!res.ok) return `(Ollama error: HTTP ${res.status})`;
    const data = await res.json();
    return data.message?.content || "(empty response)";
  } catch (e) {
    return `(Ollama unreachable: ${e?.message || e})`;
  }
}

function formatReport(results, analysis) {
  const ts = new Date().toISOString();
  const lines = [`# SIGNAL Scan — ${ts}`, ""];
  let total = 0;
  for (const r of results) {
    const count = r.results.length;
    total += count;
    const status = r.ok ? `${count} results` : `❌ ${r.error}`;
    lines.push(`## ${r.label} — ${status}`);
    for (const item of r.results.slice(0, 5)) {
      const title = (item.title || item.text || "(no title)").toString().slice(0, 120);
      const url = item.url || "(no url)";
      lines.push(`- ${title}`);
      lines.push(`  ${url}`);
    }
    lines.push("");
  }
  lines.push(`---`, ``, `## Analysis (Ollama / ${OLLAMA_MODEL})`, ``, analysis, ``, `---`, `**Total items fetched:** ${total}`);
  return { report: lines.join("\n"), total };
}

async function main() {
  console.log(`SIGNAL scan starting (Worker: ${WORKER_URL})`);
  if (WORKER_URL.includes("REPLACE-ME")) {
    console.error("\n⚠️  WORKER_URL is unset. Deploy clearpath-signal-worker first, then either:");
    console.error("    set WORKER_URL=https://your-worker.workers.dev   (Windows cmd)");
    console.error("    $env:WORKER_URL = 'https://your-worker.workers.dev'  (PowerShell)");
    console.error("    or edit scripts/run-scan.mjs and replace WORKER_URL constant\n");
    console.error("All source fetches will fail until this is set. Continuing anyway for diagnostic output.\n");
  }

  const results = await fetchAll();
  const flat = flattenForLLM(results);
  console.log(`\nFetched ${flat.split("\n").filter(Boolean).length} items across ${results.length} sources.\n`);

  const analysis = await analyzeWithOllama(flat);
  const { report, total } = formatReport(results, analysis);

  // Write to file
  if (!existsSync(RUNS_DIR)) await mkdir(RUNS_DIR, { recursive: true });
  const fname = `scan-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16)}.md`;
  const fpath = join(RUNS_DIR, fname);
  await writeFile(fpath, report, "utf8");

  // Push to ops command center
  try {
    const sourceCounts = {};
    const allItems = [];
    for (const r of results) {
      const src = r.label.split(":")[0].trim();
      sourceCounts[src] = (sourceCounts[src] || 0) + r.results.length;
      for (const item of r.results) {
        allItems.push({ source: src, title: item.title || item.text?.slice(0, 120), url: item.url, author: item.author });
      }
    }
    const opsRes = await fetch(`${OPS_URL}/rest/v1/signal_scans`, {
      method: "POST",
      headers: { apikey: OPS_KEY, Authorization: `Bearer ${OPS_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ source_counts: sourceCounts, total_items: total, analysis, report, items: allItems }),
    });
    if (opsRes.ok) console.log("Pushed to ops command center.");
    else console.log(`Ops push failed: HTTP ${opsRes.status}`);
  } catch (e) {
    console.log(`Ops push skipped: ${e?.message || e}`);
  }

  // Print to terminal
  console.log(report);
  console.log(`\nSaved: ${fpath}`);

  process.exit(total > 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
