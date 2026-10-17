#!/usr/bin/env node
/**
 * Captures the screenshots used by the user guide (docs/user-guide/figures/).
 *
 *   node docs/user-guide/tools/capture-screenshots.mjs [baseUrl] [path/to/demo-video.mp4]
 *
 * Needs a running app with *freshly seeded* demo data (`npm run demo:reset`; the script
 * decides an appeal, completes a review and writes a note). Pass the demo recording to get
 * real footage in the evidence / export shots; otherwise a synthetic clip is uploaded. Drives headless Chrome/Edge over the DevTools protocol using Node's
 * built-in WebSocket — no extra packages.
 *
 * Env: BROWSER (path to chrome/msedge), DEBUG_PORT (default 9333).
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = (process.argv[2] ?? "http://localhost:5173").replace(/\/$/, "");
// Optional: path to the registered demo recording, so screenshots show real footage.
const DEMO_VIDEO = process.argv[3] ?? process.env.DEMO_VIDEO ?? null;
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "figures");
const PORT = Number(process.env.DEBUG_PORT ?? 9333);
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

// --- minimal CDP client ---------------------------------------------------------

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
    const res = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text);
    }
    return res.result.value;
  }
}

async function launch() {
  const exe = BROWSER_CANDIDATES.find((p) => existsSync(p));
  if (!exe) throw new Error("No Chrome/Edge found; set BROWSER=/path/to/chrome");
  const profile = mkdtempSync(join(tmpdir(), "suture-guide-"));
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
      "--autoplay-policy=no-user-gesture-required",
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
  await cdp.send("Emulation.setLocaleOverride", { locale: "en-US" }); // dates in English
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 2,
    mobile: false,
  });
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

// --- page helpers ---------------------------------------------------------------

async function goto(cdp, path, waitForExpr) {
  const loaded = cdp.once("Page.loadEventFired");
  await cdp.send("Page.navigate", { url: `${BASE}${path}` });
  await loaded;
  if (waitForExpr) await waitFor(cdp, waitForExpr);
  // The dev-only account switcher is not part of the product UI.
  await cdp.eval(`(() => {
    const s = document.createElement("style");
    s.textContent = "div:has(> #dev-user-switch){display:none!important}";
    document.head.append(s);
    return true;
  })()`);
  await sleep(600); // let entrance animations settle
}

async function waitFor(cdp, expr, timeoutMs = 20000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await cdp.eval(`Boolean(${expr})`)) return;
    await sleep(200);
  }
  throw new Error(`Timed out waiting for: ${expr}`);
}

// textContent, not innerText: innerText applies CSS text-transform (e.g. uppercase headings).
const hasText = (t) => `document.body && document.body.textContent.includes(${JSON.stringify(t)})`;

async function api(cdp, path, method = "GET", body) {
  return cdp.eval(`fetch(${JSON.stringify(`/api${path}`)}, {
    method: ${JSON.stringify(method)},
    headers: {"Content-Type": "application/json"},
    body: ${body === undefined ? "undefined" : JSON.stringify(JSON.stringify(body))}
  }).then(async r => { if (!r.ok) throw new Error(${JSON.stringify(path)} + " -> " + r.status); return r.status === 204 ? null : r.json(); })`);
}

async function login(cdp, email) {
  await goto(cdp, "/login");
  await api(cdp, "/auth/login", "POST", { email, password: PASSWORD });
}

/** In-page JS returning the element whose heading contains `text` (closest container). */
const sectionJs = (text, container = "section, article, header") => `(() => {
  const h = [...document.querySelectorAll("h1,h2,h3")].find(e => e.textContent.includes(${JSON.stringify(text)}));
  return h ? h.closest(${JSON.stringify(container)}) : null;
})()`;

/**
 * Screenshot the union of elements (in-page JS expressions), or the viewport when none.
 * Coordinates are page coordinates so off-screen content is captured too.
 */
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
    const y = await cdp.eval("scrollY");
    clip = { x: 0, y, width: WIDTH, height: HEIGHT, scale: 1 };
  }
  const { data } = await cdp.send("Page.captureScreenshot", {
    format: "png",
    clip,
    captureBeyondViewport: true,
  });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, "base64"));
  console.log(`  ${name}.png`);
}

/** Set a React-controlled textarea/input value from outside React. */
const setValueJs = (selector, value) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
})()`;

const clickByTextJs = (selector, text) => `(() => {
  const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find(e => e.textContent.trim() === ${JSON.stringify(text)});
  el.click();
  return true;
})()`;

// --- scenes ---------------------------------------------------------------------

/** Put a local file into the page's <input type=file> (fires change like a real pick). */
async function setFileInput(cdp, selector, path) {
  const { root } = await cdp.send("DOM.getDocument", { depth: 1 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
  await cdp.send("DOM.setFileInputFiles", { nodeId, files: [path] });
}

/** Synthetic stand-in recording, used when no demo video path is given. */
const SYNTHETIC_UPLOAD_JS = `(async () => {
  const c = document.createElement("canvas"); c.width = 640; c.height = 360;
  const ctx = c.getContext("2d");
  const rec = new MediaRecorder(c.captureStream(15), { mimeType: "video/webm" });
  const chunks = []; rec.ondataavailable = e => chunks.push(e.data);
  let f = 0;
  const iv = setInterval(() => {
    ctx.fillStyle = "#e8edf3"; ctx.fillRect(0, 0, 640, 360);
    ctx.fillStyle = "#c97b63"; ctx.fillRect(170, 110, 300, 140);
    ctx.fillStyle = "#475569"; ctx.fillRect(100 + (f * 7) % 420, 60, 60, 10); f++;
  }, 66);
  rec.start(); await new Promise(r => setTimeout(r, 6000)); rec.stop();
  await new Promise(r => rec.onstop = r); clearInterval(iv);
  const file = new File(chunks, "suturing-practice.webm", { type: "video/webm" });
  const input = document.querySelector("input[type=file]");
  const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
})()`;

const timelineItemJs = (title) => `(() => {
  const h = [...document.querySelectorAll("h4")].find(e => e.textContent === ${JSON.stringify(title)});
  return h ? h.closest(".rounded-xl") : null;
})()`;

async function main() {
  mkdirSync(OUT, { recursive: true });
  const { cdp, close } = await launch();
  await cdp.send("DOM.enable");
  try {
    console.log(`Capturing from ${BASE}${DEMO_VIDEO ? ` with ${DEMO_VIDEO}` : " (synthetic upload)"}`);

    // Data set-up: Dr. Chen accepts Alex's seeded appeal (01:05, view blocked) and completes
    // the review, so the student-side screenshots show the whole loop. Safe to re-run.
    await login(cdp, "chen@demo.local");
    const alexId = (await api(cdp, "/instructor/cohorts/group-a")).students.find((s) => s.name === "Alex Rivera").id;
    let appealed = null;
    for (const r of await api(cdp, `/reports?studentId=${alexId}`)) {
      const full = await api(cdp, `/reports/${r.sessionId}`);
      if (full.appeals?.some((a) => a.eventId)) {
        appealed = full;
        break;
      }
    }
    if (!appealed) throw new Error("Expected a seeded appeal for Alex (run `npm run demo:reset`).");
    const sid = appealed.meta.sessionId;
    const seededAppeal = appealed.appeals.find((a) => a.eventId);
    if (seededAppeal.status === "open") {
      appealed = await api(cdp, `/reports/${sid}/appeals/${seededAppeal.id}/decision`, "POST", {
        decision: "accept",
        note: "You're right: your hand hides the needle tip at 01:05, so the second attempt can't be confirmed. Overturned.",
        scoreAdjustment: 2,
      });
    }
    await api(cdp, `/reports/${sid}/review`, "PUT", {
      finalScore: appealed.scores.current,
      comment: "Solid procedural flow. Keep the camera clear of your hands so insertion attempts can be judged reliably.",
      teachingFocus: ["insertion control", "camera framing"],
      complete: true,
    });

    // ---- Login
    await api(cdp, "/auth/logout", "POST");
    await goto(cdp, "/login", hasText("Sign in"));
    // The guide is for end users: hide the dev notes (password-manager warning, demo accounts).
    await cdp.eval(`(() => {
      const card = document.querySelector("main .surface-card");
      [...card.querySelectorAll("p")].filter(p => /Chrome still warns/.test(p.textContent)).forEach(p => p.remove());
      [...card.querySelectorAll("div")].filter(d => /^Demo accounts/.test(d.textContent.trim())).forEach(d => d.remove());
      return true;
    })()`);
    await shot(cdp, "01-login", [`document.querySelector("main")`], 0);

    // ---- Student: dashboard, upload, progress
    await login(cdp, "alex@demo.local");
    await api(cdp, `/reports/${sid}/note`, "PUT", {
      note: "Re-film with the camera higher so my hand doesn't block the needle.",
    });
    await goto(cdp, "/", hasText("Hello, Alex"));
    await shot(cdp, "02-student-dashboard");

    await goto(cdp, "/train?task=simple-suturing", hasText("Simple Suturing Practice"));
    if (DEMO_VIDEO) await setFileInput(cdp, "input[type=file]", DEMO_VIDEO);
    else await cdp.eval(SYNTHETIC_UPLOAD_JS);
    await waitFor(cdp, `document.querySelector("video") && document.querySelector("video").readyState >= 2`, 60000);
    await cdp.eval(`new Promise(r => { const v = document.querySelector("video");
      v.addEventListener("seeked", () => r(true), { once: true }); v.currentTime = Math.min(30, v.duration / 2); })`);
    await sleep(800);
    await shot(cdp, "03-train-upload", [`document.querySelector("main")`], 0);

    await cdp.eval(clickByTextJs("button", "Upload & analyse"));
    await waitFor(cdp, hasText("Analysing video"), 120000);
    const uploadedId = await cdp.eval(`location.pathname.split("/").pop()`);
    await sleep(9000); // a few stages in, with the activity feed filled
    await shot(cdp, "04-train-processing", [`document.querySelector("main")`], 0);

    // ---- Report (student view of the reviewed report with an accepted appeal)
    await goto(cdp, `/report?session=${sid}`, hasText("Overall Performance"));
    await shot(cdp, "05-report-overview", [
      `document.querySelector("main header")`,
      `document.querySelector("main header").nextElementSibling`,
      sectionJs("Dimension Scores", "section"),
    ]);
    await shot(cdp, "06-report-timeline", [sectionJs("Training Timeline", "section")]);
    await shot(cdp, "07-report-student-feedback", [sectionJs("Report Feedback & Reflection", "section")]);

    // ---- Instructor
    await login(cdp, "chen@demo.local");
    await goto(cdp, "/instructor?cohort=group-a", hasText("Needs attention"));
    await shot(cdp, "08-instructor-overview", [
      `document.querySelector("main > div")`,
      sectionJs("Needs attention", "section"),
      sectionJs("Skill map", "section"),
    ]);
    await shot(cdp, "09-instructor-roster", [sectionJs("Students", "section")]);

    const overview = await api(cdp, "/instructor/cohorts/group-a");
    const priya = overview.students.find((s) => s.name === "Priya Shah");
    await goto(cdp, `/instructor/students/${priya.id}`, `document.querySelector("svg[role=img]")`);
    await shot(cdp, "10-instructor-student", [
      `document.querySelector("main header")`,
      `document.querySelector("main > div.grid")`,
      sectionJs("Overall score by session", "section"),
      sectionJs("Dimensions over time", "section"),
    ]);

    await goto(cdp, "/instructor/reviews?filter=appeals", hasText("Oldest first"));
    await shot(cdp, "11-review-queue", [`document.querySelector("main")`], 0);

    let target = null;
    for (const r of await api(cdp, `/reports?studentId=${priya.id}`)) {
      const full = await api(cdp, `/reports/${r.sessionId}`);
      if (full.appeals?.some((a) => a.status === "open")) {
        target = full;
        break;
      }
    }
    if (!target) throw new Error("Expected a seeded open appeal for Priya (run `npm run demo:reset`).");
    await goto(cdp, `/report?session=${target.meta.sessionId}`, hasText("Instructor review"));
    await cdp.eval(
      setValueJs(
        "textarea[placeholder^='Explain your decision']",
        "Checked the clip: the needle stays in the holder, it's a deliberate re-grip. Overturned.",
      ),
    );
    await cdp.eval(
      setValueJs("textarea[placeholder^='What went well']", "Good recovery. Pacing between steps is the next thing to work on."),
    );
    await sleep(400);
    await shot(cdp, "12-review-form", [sectionJs("Report Feedback & Review", "section")]);

    // ---- Student: report generated from the upload above (evidence, appeal, export)
    await login(cdp, "alex@demo.local");
    console.log("  (waiting for the uploaded session to finish processing…)");
    const deadline = Date.now() + 5 * 60 * 1000;
    while ((await api(cdp, `/sessions/${uploadedId}`)).status !== "ready") {
      if (Date.now() > deadline) throw new Error("Uploaded session did not finish processing");
      await sleep(2000);
    }
    await goto(cdp, `/report?session=${uploadedId}`, `document.querySelector("video")`);
    await cdp.eval(`new Promise(r => { const v = document.querySelector("video"); v.muted = true;
      v.addEventListener("seeked", () => r(true), { once: true }); v.currentTime = 3; })`);
    await sleep(600);
    await shot(cdp, "13-report-evidence", [sectionJs("Evidence Replay", "section")]);

    const report = await api(cdp, `/reports/${uploadedId}`);
    const flagged = report.timeline.find((e) => e.type === "error") ?? report.timeline.find((e) => e.type === "warning");
    await cdp.eval(`(() => {
      const item = ${timelineItemJs(flagged.title)};
      item.scrollIntoView({ block: "center" });
      [...item.querySelectorAll("button")].find(b => b.textContent === "Appeal").click();
      return true;
    })()`);
    await sleep(300);
    await cdp.eval(`(() => {
      const item = ${timelineItemJs(flagged.title)};
      const ta = item.querySelector("textarea");
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(ta,
        "I picked up the forceps; the scissors were only moved aside and never used.");
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    })()`);
    await sleep(300);
    await shot(cdp, "14-appeal-form", [timelineItemJs(flagged.title)]);

    await goto(
      cdp,
      `/report/print?session=${uploadedId}`,
      `[...document.querySelectorAll("button")].some(b => b.textContent === "Save as PDF" && !b.disabled)`,
    );
    await sleep(500);
    await shot(cdp, "15-export-pdf", [
      `document.querySelector("article header")`,
      `document.querySelectorAll("article table")[1].querySelectorAll("tr")[3]`,
    ]);

    console.log(`Done → ${OUT}`);
  } finally {
    close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
