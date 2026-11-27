#!/usr/bin/env node
/**
 * Captures the screenshots used by the design spec (docs/design/build/figures/).
 *
 *   node docs/design/tools/capture-figures.mjs [baseUrl]
 *
 * Read-only: it signs in as demo users and photographs pages, but changes no data, so it
 * can run against any seeded instance (`npm start`). Drives headless Chrome/Edge over the
 * DevTools protocol with Node's built-in WebSocket, as the user-guide capture script does.
 *
 * Env: BROWSER (path to chrome/msedge), DEBUG_PORT (default 9334).
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = (process.argv[2] ?? "http://localhost:5173").replace(/\/$/, "");
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "build", "figures");
const PORT = Number(process.env.DEBUG_PORT ?? 9334);
const PASSWORD = "suture-local-demo";
const WIDTH = 1280;
const HEIGHT = 860;

const BROWSER_CANDIDATES = [
  process.env.BROWSER,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- minimal CDP client (same shape as docs/user-guide/tools/capture-screenshots.mjs) ---

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener("message", (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(`${msg.error.message}`)) : resolve(msg.result);
      } else if (msg.method) {
        (this.listeners.get(msg.method) ?? []).forEach((fn) => fn(msg.params));
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  once(method) {
    return new Promise((resolve) => {
      const fn = (p) => {
        this.listeners.set(method, (this.listeners.get(method) ?? []).filter((f) => f !== fn));
        resolve(p);
      };
      this.listeners.set(method, [...(this.listeners.get(method) ?? []), fn]);
    });
  }

  async eval(expression) {
    const res = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text);
    }
    return res.result.value;
  }
}

async function launch() {
  const exe = BROWSER_CANDIDATES.find((p) => existsSync(p));
  if (!exe) throw new Error("No Chrome/Edge found; set BROWSER=/path/to/chrome");
  const profile = mkdtempSync(join(tmpdir(), "suture-design-"));
  const proc = spawn(
    exe,
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      `--window-size=${WIDTH},${HEIGHT}`,
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--lang=en-US",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find((t) => t.type === "page");
    } catch {
      /* not up yet */
    }
  }
  if (!target) throw new Error("Browser did not expose a page target");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.addEventListener("open", r, { once: true });
    ws.addEventListener("error", j, { once: true });
  });
  const cdp = new Cdp(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setLocaleOverride", { locale: "en-US" });
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: HEIGHT, deviceScaleFactor: 2, mobile: false });
  const close = () => {
    try {
      ws.close();
    } catch {
      /* ignore */
    }
    proc.kill();
    setTimeout(() => rmSync(profile, { recursive: true, force: true }), 500);
  };
  return { cdp, close };
}

// --- page helpers -----------------------------------------------------------------

async function waitFor(cdp, expr, timeoutMs = 20000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await cdp.eval(`Boolean(${expr})`)) return;
    await sleep(200);
  }
  throw new Error(`Timed out waiting for: ${expr}`);
}

const hasText = (t) => `document.body && document.body.textContent.includes(${JSON.stringify(t)})`;

async function goto(cdp, path, waitForExpr) {
  const loaded = cdp.once("Page.loadEventFired");
  await cdp.send("Page.navigate", { url: `${BASE}${path}` });
  await loaded;
  if (waitForExpr) await waitFor(cdp, waitForExpr);
  await cdp.eval(`(() => {
    const s = document.createElement("style");
    s.textContent = "div:has(> #dev-user-switch){display:none!important}";
    document.head.append(s);
    return true;
  })()`);
  await sleep(2600); // entrance, count-up and pen-stroke animations run to the end
}

async function api(cdp, path, method = "GET", body) {
  return cdp.eval(`fetch(${JSON.stringify(`/api${path}`)}, {
    method: ${JSON.stringify(method)},
    headers: {"Content-Type": "application/json"},
    body: ${body === undefined ? "undefined" : JSON.stringify(JSON.stringify(body))}
  }).then(async r => { if (!r.ok) throw new Error(${JSON.stringify(path)} + " -> " + r.status); return r.status === 204 ? null : r.json(); })`);
}

async function login(cdp, email) {
  await goto(cdp, "/login", hasText("Sign in"));
  await api(cdp, "/auth/login", "POST", { email, password: PASSWORD });
}

const sectionJs = (text, container = "section, article, header") => `(() => {
  const h = [...document.querySelectorAll("h1,h2,h3,p")].find(e => e.textContent.trim().endsWith(${JSON.stringify(text)}));
  return h ? h.closest(${JSON.stringify(container)}) : null;
})()`;

/** Screenshot the union of elements (page coordinates), or the viewport when none. */
async function shot(cdp, name, elementExprs = [], pad = 16) {
  let clip;
  if (elementExprs.length) {
    const rect = await cdp.eval(`(() => {
      const els = [${elementExprs.join(",")}].filter(Boolean);
      if (!els.length) return null;
      const rs = els.map(e => e.getBoundingClientRect());
      const x0 = Math.min(...rs.map(r => r.left)), y0 = Math.min(...rs.map(r => r.top));
      const x1 = Math.max(...rs.map(r => r.right)), y1 = Math.max(...rs.map(r => r.bottom));
      return { x: x0 + scrollX, y: y0 + scrollY, w: x1 - x0, h: y1 - y0 };
    })()`);
    if (!rect) throw new Error(`No elements found for ${name}`);
    clip = {
      x: Math.max(0, rect.x - pad),
      y: Math.max(0, rect.y - pad),
      width: Math.min(WIDTH, rect.w + 2 * pad),
      height: rect.h + 2 * pad,
      scale: 1,
    };
  } else {
    clip = { x: 0, y: await cdp.eval("scrollY"), width: WIDTH, height: HEIGHT, scale: 1 };
  }
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png", clip, captureBeyondViewport: true });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, "base64"));
  console.log(`  ${name}.png`);
}

/** Scroll a section into view first so its reveal animation has played. */
async function shotSection(cdp, name, headings) {
  const exprs = headings.map((h) => sectionJs(h));
  await cdp.eval(`(${exprs[0]})?.scrollIntoView({ block: "start" }), true`);
  await sleep(1800);
  await shot(cdp, name, exprs);
}

// --- figures ----------------------------------------------------------------------

async function main() {
  mkdirSync(OUT, { recursive: true });
  const { cdp, close } = await launch();
  try {
    console.log("Login");
    await goto(cdp, "/login", hasText("Sign in"));
    await shot(cdp, "login");

    console.log("Student");
    await login(cdp, "alex@demo.local");
    await goto(cdp, "/", hasText("Current training task"));
    await shot(cdp, "dashboard");

    const reports = await api(cdp, "/reports");
    const sessionId = reports[0].sessionId;
    await goto(cdp, `/report?session=${encodeURIComponent(sessionId)}`, hasText("Overall Performance"));
    await shot(cdp, "report-top");
    await shotSection(cdp, "report-dimensions", ["Dimension Scores"]);
    await shotSection(cdp, "report-timeline", ["Training Timeline", "Assessment Highlights"]);
    await shotSection(cdp, "report-feedback", ["Report Feedback & Reflection"]);

    await goto(cdp, `/train/${encodeURIComponent(sessionId)}`, hasText("Activity"));
    await shot(cdp, "processing");

    console.log("Instructor");
    await login(cdp, "chen@demo.local");
    await goto(cdp, "/instructor", hasText("Skill"));
    await shot(cdp, "instructor");
  } finally {
    close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
