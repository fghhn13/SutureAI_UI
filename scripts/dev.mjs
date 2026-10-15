#!/usr/bin/env node
/**
 * Local dev launcher: starts the FastAPI backend and the Vite frontend together.
 *
 *   npm start                         # install whatever is missing, then run both
 *   npm run setup                     # only install (Python venv + npm packages)
 *   npm run demo:reset                # reseed the demo database (deletes local data)
 *   npm run demo:register -- <video>  # mark a video file as the demo recording
 *
 * Env: API_PORT (default 8000), WEB_PORT (default 5173), PYTHON (interpreter used to
 * create server/.venv; default "python" on Windows, "python3" elsewhere).
 * Ctrl+C stops both; if either process exits, the other is stopped too.
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IS_WIN = process.platform === "win32";
const SERVER_DIR = join(ROOT, "server");
const VENV_PY = IS_WIN
  ? join(SERVER_DIR, ".venv", "Scripts", "python.exe")
  : join(SERVER_DIR, ".venv", "bin", "python");
const VITE_BIN = join(ROOT, "node_modules", "vite", "bin", "vite.js");

const API_PORT = process.env.API_PORT ?? "8000";
const WEB_PORT = process.env.WEB_PORT ?? "5173";
const SETUP_ONLY = process.argv.includes("--setup-only");
const RESET_DEMO = process.argv.includes("--reset-demo");
const REGISTER_IDX = process.argv.indexOf("--register-demo");

const color = (code) => (s) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const cyan = color(36);
const magenta = color(35);
const yellow = color(33);
const red = color(31);

function log(msg) {
  console.log(`${yellow("[dev]")} ${msg}`);
}

function runOrExit(cmd, args, what) {
  log(`${what}…`);
  const res = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", shell: false });
  if (res.error || res.status !== 0) {
    console.error(red(`[dev] ${what} failed${res.error ? `: ${res.error.message}` : ""}`));
    process.exit(res.status || 1);
  }
}

function setup() {
  if (!existsSync(VENV_PY)) {
    const python = process.env.PYTHON ?? (IS_WIN ? "python" : "python3");
    runOrExit(python, ["-m", "venv", join(SERVER_DIR, ".venv")], "Creating server/.venv");
    runOrExit(
      VENV_PY,
      // Generous timeout: the PyPI index pages can be slow to download.
      ["-m", "pip", "install", "--timeout", "120", "--retries", "5", "-r", join(SERVER_DIR, "requirements-dev.txt")],
      "Installing backend dependencies",
    );
  }
  if (!existsSync(VITE_BIN)) {
    runOrExit(IS_WIN ? "npm.cmd" : "npm", ["install"], "Installing frontend dependencies");
  }
}

/** Pipe a child's output line by line with a coloured prefix. */
function pipe(stream, prefix, out) {
  let buf = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buf += chunk;
    const lines = buf.split(/\r?\n/);
    buf = lines.pop();
    for (const line of lines) out.write(`${prefix} ${line}\n`);
  });
  stream.on("end", () => buf && out.write(`${prefix} ${buf}\n`));
}

const children = [];
let shuttingDown = false;

function start(name, prefix, cmd, args, extraEnv = {}) {
  const child = spawn(cmd, args, {
    cwd: ROOT,
    env: { ...process.env, ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"],
  });
  pipe(child.stdout, prefix, process.stdout);
  pipe(child.stderr, prefix, process.stderr);
  child.on("error", (err) => {
    console.error(red(`[dev] could not start ${name}: ${err.message}`));
    shutdown(1);
  });
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    log(`${name} exited (${signal ?? `code ${code}`}); stopping everything.`);
    shutdown(code ?? 1);
  });
  children.push(child);
  return child;
}

function killTree(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (IS_WIN) {
    // uvicorn --reload runs the app in a subprocess; kill the whole tree.
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  children.forEach(killTree);
  setTimeout(() => process.exit(code), 300);
}

async function waitForApi(timeoutMs = 30000) {
  const url = `http://127.0.0.1:${API_PORT}/api/health`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && !shuttingDown) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

setup();
if (RESET_DEMO || REGISTER_IDX !== -1) {
  // Run app.seed / app.demo from server/ so the app package resolves.
  const args =
    REGISTER_IDX !== -1
      ? // npm runs scripts from the package root; INIT_CWD is where the user typed the command.
        ["-m", "app.demo", "register", resolve(process.env.INIT_CWD ?? process.cwd(), process.argv[REGISTER_IDX + 1] ?? "")]
      : ["-m", "app.seed", "--reset"];
  if (REGISTER_IDX !== -1 && !process.argv[REGISTER_IDX + 1]) {
    console.error(red("[dev] usage: npm run demo:register -- path/to/video.mp4"));
    process.exit(1);
  }
  const res = spawnSync(VENV_PY, args, { cwd: SERVER_DIR, stdio: "inherit" });
  process.exit(res.status ?? 1);
}
if (SETUP_ONLY) {
  log("Setup complete. Run `npm start` to launch.");
  process.exit(0);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

log(`Starting API on :${API_PORT} and web on :${WEB_PORT} (Ctrl+C to stop)`);
start(
  "api",
  cyan("[api]"),
  VENV_PY,
  ["-m", "uvicorn", "app.main:app", "--app-dir", "server", "--reload", "--reload-dir", "server", "--port", API_PORT],
  { PYTHONUNBUFFERED: "1", PYTHONIOENCODING: "utf-8" },
);

// Start Vite once the API answers, so the first page load doesn't hit proxy errors.
const apiUp = await waitForApi();
if (!shuttingDown) {
  if (!apiUp) log(red("API did not answer /api/health within 30s; starting the web server anyway."));
  start("web", magenta("[web]"), process.execPath, [VITE_BIN, "--port", WEB_PORT, "--strictPort"], {
    SUTURE_API_URL: `http://127.0.0.1:${API_PORT}`,
  });
  log(`Open http://localhost:${WEB_PORT}  (API docs: http://127.0.0.1:${API_PORT}/docs)`);
}
