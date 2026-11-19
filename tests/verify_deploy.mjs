import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

export const DEFAULT_LIVE_URL = "https://jayray801.github.io/en-pointe-steady/";
export const DEFAULT_REPO_SLUG = "JayRay801/en-pointe-steady";

export function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function stripJsComments(source) {
  let out = "";
  let i = 0;
  const n = source.length;
  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      out += ch;
      i++;
      while (i < n) {
        const c = source[i];
        out += c;
        if (c === "\\" && i + 1 < n) {
          out += source[i + 1];
          i += 2;
          continue;
        }
        i++;
        if (c === quote) break;
      }
      continue;
    }
    if (ch === "/" && next === "/") {
      i += 2;
      while (i < n && source[i] !== "\n") {
        i++;
      }
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) {
        i++;
      }
      i += 2;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

export function parseSwConfig(swSource) {
  if (typeof swSource !== "string") {
    throw new Error("sw.js source must be a string");
  }
  const stripped = stripJsComments(swSource);
  const cacheMatch = stripped.match(/const\s+CACHE_NAME\s*=\s*["']([^"']+)["']\s*;?/);
  if (!cacheMatch) {
    throw new Error("Could not parse CACHE_NAME from sw.js");
  }
  const shellMatch = stripped.match(/const\s+APP_SHELL\s*=\s*\[([\s\S]*?)\]\s*;?/);
  if (!shellMatch) {
    throw new Error("Could not parse APP_SHELL from sw.js");
  }
  const appShell = [];
  const itemRegex = /["']([^"']+)["']/g;
  let m;
  while ((m = itemRegex.exec(shellMatch[1])) !== null) {
    appShell.push(m[1]);
  }
  if (appShell.length === 0) {
    throw new Error("APP_SHELL in sw.js is empty");
  }
  return {
    cacheName: cacheMatch[1],
    appShell
  };
}

export function resolveAppShellLocalPath(repoRoot, entry) {
  if (typeof entry !== "string") {
    return null;
  }
  const cleanEntry = entry.split(/[?#]/)[0];
  const rootAbs = path.resolve(repoRoot);
  if (cleanEntry === "./" || cleanEntry === "." || cleanEntry === "/") {
    return path.join(rootAbs, "index.html");
  }
  const normalized = cleanEntry.replace(/^\.\//, "");
  const resolved = path.resolve(rootAbs, normalized);
  const rel = path.relative(rootAbs, resolved);
  if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    return null;
  }
  return resolved;
}

export function verifyAppShellFilesExist(repoRoot, appShell) {
  const missing = [];
  const checked = [];
  for (const entry of appShell) {
    const localPath = resolveAppShellLocalPath(repoRoot, entry);
    checked.push({ entry, localPath });
    if (!localPath || !fs.existsSync(localPath) || !fs.statSync(localPath).isFile()) {
      missing.push(entry);
    }
  }
  return {
    ok: missing.length === 0,
    missing,
    checked
  };
}

/**
 * Pure go-live readiness evaluator.
 * Fails closed: returns GO_LIVE_BLOCKED unless every required gate passes.
 */
export function evaluateGoLiveReadiness(context = {}) {
  const reasons = [];
  const checks = {
    git: false,
    pagesBuild: false,
    swCache: false,
    assets: false,
    browser: true
  };

  // 1. Git state & remote parity
  const git = context.git || {};
  if (git.clean !== true) {
    reasons.push("Working tree is not clean (uncommitted changes present).");
  } else if (!git.headSha || !git.remoteSha || git.headSha !== git.remoteSha) {
    reasons.push(
      `Local HEAD (${git.headSha || "unknown"}) does not match origin/main (${git.remoteSha || "unknown"}).`
    );
  } else {
    checks.git = true;
  }

  // 2. GitHub Pages build & deployment status
  const pages = context.pages || {};
  const deploymentOk =
    pages.deploymentState === undefined ||
    pages.deploymentState === null ||
    pages.deploymentState === "success";
  const shaMatchOk = Boolean(git.headSha && pages.commitSha && pages.commitSha === git.headSha);
  const noBuildError = !pages.errorMessage;

  if (pages.siteStatus !== "built") {
    reasons.push(`GitHub Pages site status is not built (got: ${pages.siteStatus || "unknown"}).`);
  } else if (pages.buildStatus !== "built") {
    reasons.push(`GitHub Pages latest build is not built (got: ${pages.buildStatus || "unknown"}).`);
  } else if (!deploymentOk) {
    reasons.push(`GitHub Pages deployment state is not success (got: ${pages.deploymentState}).`);
  } else if (!shaMatchOk) {
    reasons.push(
      `GitHub Pages deployed commit (${pages.commitSha || "unknown"}) does not match HEAD (${git.headSha || "unknown"}).`
    );
  } else if (!noBuildError) {
    reasons.push(`GitHub Pages build reported an error: ${pages.errorMessage}`);
  } else {
    checks.pagesBuild = true;
  }

  // 3. Service Worker CACHE_NAME parity
  const localCache = context.localSw?.cacheName;
  const liveCache = context.liveSw?.cacheName;
  if (!localCache || !liveCache) {
    reasons.push(`Missing Service Worker CACHE_NAME (local=${localCache || "none"}, live=${liveCache || "none"}).`);
  } else if (localCache !== liveCache) {
    reasons.push(`Stale live Service Worker CACHE_NAME: live="${liveCache}" vs local="${localCache}".`);
  } else {
    checks.swCache = true;
  }

  // 4. Live HTTP 200 & SHA-256 asset parity
  const assets = Array.isArray(context.assets) ? context.assets : [];
  if (assets.length === 0) {
    reasons.push("No APP_SHELL assets were verified.");
  } else {
    const assetFailures = [];
    for (const asset of assets) {
      if (asset.status !== 200) {
        assetFailures.push(`${asset.entry} returned HTTP ${asset.status}`);
      } else if (!asset.localSha256 || !asset.liveSha256 || asset.localSha256 !== asset.liveSha256) {
        assetFailures.push(
          `${asset.entry} SHA-256 mismatch (local=${(asset.localSha256 || "").slice(0, 10)}, live=${(asset.liveSha256 || "").slice(0, 10)})`
        );
      }
    }
    if (assetFailures.length > 0) {
      reasons.push(`Asset parity failures: ${assetFailures.join("; ")}`);
    } else {
      checks.assets = true;
    }
  }

  // 5. Optional headless browser smoke check
  if (context.browser && context.browser.skipped !== true) {
    if (context.browser.ok !== true) {
      checks.browser = false;
      reasons.push(`Browser smoke check failed: ${context.browser.error || "unknown error"}`);
    }
  }

  const ok = reasons.length === 0;
  return {
    status: ok ? "GO_LIVE_CONFIRMED" : "GO_LIVE_BLOCKED",
    ok,
    reasons,
    checks
  };
}

export function formatGoLiveReadinessSummary(pre) {
  const lines = [
    "=== Go-Live Readiness Summary ===",
    `Target Branch : ${pre.branch || "main"}`,
    `Target URL    : ${pre.liveUrl || DEFAULT_LIVE_URL}`,
    `Local Cache   : ${pre.localCacheName || "unknown"}`,
    `Live Cache    : ${pre.liveCacheName || "unavailable"}`,
    `APP_SHELL     : ${pre.appShellOk ? `PASS (${pre.appShellCount} files on disk)` : `FAIL (missing: ${(pre.missingAssets || []).join(", ")})`}`,
    `App Tests     : ${pre.testsStatus || "NOT_RUN"}`,
    `Git Status    : ${pre.gitClean ? "clean" : `${pre.changedFiles.length} uncommitted change(s)`}`,
    `Git Sync      : ${pre.headSha === pre.remoteSha ? `in sync (${(pre.headSha || "").slice(0, 7)})` : `local ${(pre.headSha || "").slice(0, 7)} vs origin/main ${(pre.remoteSha || "").slice(0, 7)}`}`
  ];
  if (pre.changedFiles && pre.changedFiles.length > 0) {
    lines.push("Changed Files :");
    for (const f of pre.changedFiles) {
      lines.push(`  - ${f}`);
    }
  }
  lines.push(`Gate Status   : ${pre.readyForConfirmation ? "CONFIRM_TO_GO_LIVE_REQUIRED" : "PRE_FLIGHT_FAILED"}`);
  return lines.join("\n");
}

function parseCliArgs(argv) {
  const opts = {
    mode: "pre",
    url: DEFAULT_LIVE_URL,
    pollSeconds: 90,
    skipTests: false,
    skipBrowser: false
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") opts.mode = "dry-run";
    else if (arg === "--pre") opts.mode = "pre";
    else if (arg === "--live") opts.mode = "live";
    else if (arg === "--skip-tests") opts.skipTests = true;
    else if (arg === "--skip-browser") opts.skipBrowser = true;
    else if (arg === "--url" && argv[i + 1]) opts.url = argv[++i];
    else if (arg === "--poll-seconds" && argv[i + 1]) opts.pollSeconds = Number(argv[++i]) || 0;
  }
  if (!opts.url.endsWith("/")) {
    opts.url += "/";
  }
  return opts;
}

function runGit(args) {
  return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }).trim();
}

function runGhJson(endpoint) {
  const raw = execFileSync("gh", ["api", endpoint], { cwd: REPO_ROOT, encoding: "utf8" });
  return JSON.parse(raw);
}

async function fetchCacheBusted(url) {
  const sep = url.includes("?") ? "&" : "?";
  const bustedUrl = `${url}${sep}cb=${Date.now()}`;
  const resp = await fetch(bustedUrl, {
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache"
    }
  });
  const buf = Buffer.from(await resp.arrayBuffer());
  return {
    status: resp.status,
    buffer: buf,
    text: buf.toString("utf8")
  };
}

function findChromiumBinary() {
  for (const candidate of ["/usr/bin/chromium", "/usr/bin/google-chrome", "/usr/bin/chromium-browser"]) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function runHeadlessBrowserSmoke(liveUrl) {
  const bin = findChromiumBinary();
  if (!bin) {
    return { skipped: true, ok: true, reason: "No Chromium/Chrome binary found" };
  }
  const res = spawnSync(
    bin,
    [
      "--headless",
      "--disable-gpu",
      "--no-sandbox",
      "--dump-dom",
      "--virtual-time-budget=4000",
      liveUrl
    ],
    { encoding: "utf8", timeout: 20000 }
  );
  if (res.status !== 0) {
    return {
      skipped: false,
      ok: false,
      error: (res.stderr || `exit ${res.status}`).trim().slice(0, 300)
    };
  }
  const dom = res.stdout || "";
  const hasAppShell = dom.includes("En Pointe") || dom.includes("app.js");
  if (!hasAppShell) {
    return {
      skipped: false,
      ok: false,
      error: "Headless DOM output did not contain expected app markers"
    };
  }
  return { skipped: false, ok: true, binary: bin };
}

function runDryRunSuite() {
  // (a) AGENTS.md & .agents/skills/deploy-go-live/SKILL.md exist with required protocol & confirm-to-go-live gate
  const agentsPath = path.join(REPO_ROOT, "AGENTS.md");
  const skillPath = path.join(REPO_ROOT, ".agents", "skills", "deploy-go-live", "SKILL.md");
  assert.ok(fs.existsSync(agentsPath), "AGENTS.md must exist");
  assert.ok(fs.existsSync(skillPath), ".agents/skills/deploy-go-live/SKILL.md must exist");

  const agentsDoc = fs.readFileSync(agentsPath, "utf8");
  const skillDoc = fs.readFileSync(skillPath, "utf8");
  assert.ok(agentsDoc.includes("deploy-verifier"), "AGENTS.md must define deploy-verifier");
  assert.ok(/confirm to go live/i.test(agentsDoc), "AGENTS.md must include Confirm to Go Live gate");
  assert.ok(agentsDoc.includes("GO_LIVE_CONFIRMED") && agentsDoc.includes("GO_LIVE_BLOCKED"));
  assert.ok(skillDoc.includes("name: deploy-go-live"), "SKILL.md must declare name: deploy-go-live");
  assert.ok(/confirm[- ]to[- ]go[- ]live/i.test(skillDoc), "SKILL.md must include confirm-to-go-live gate");
  console.log("PASS [dry-run 1/4] AGENTS.md & deploy-go-live SKILL.md contract present");

  // (b) sw.js APP_SHELL files all exist on disk
  const swSource = fs.readFileSync(path.join(REPO_ROOT, "sw.js"), "utf8");
  const swConfig = parseSwConfig(swSource);
  const shellCheck = verifyAppShellFilesExist(REPO_ROOT, swConfig.appShell);
  assert.equal(shellCheck.ok, true, `Missing APP_SHELL files: ${shellCheck.missing.join(", ")}`);
  console.log(`PASS [dry-run 2/4] sw.js (${swConfig.cacheName}) APP_SHELL ${swConfig.appShell.length} files exist on disk`);

  // (c) Mocked pass path emits GO_LIVE_CONFIRMED
  const sha = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
  const passResult = evaluateGoLiveReadiness({
    git: { clean: true, headSha: sha, remoteSha: sha },
    pages: { siteStatus: "built", buildStatus: "built", deploymentState: "success", commitSha: sha, errorMessage: null },
    localSw: { cacheName: swConfig.cacheName },
    liveSw: { cacheName: swConfig.cacheName },
    assets: [
      { entry: "./", status: 200, localSha256: "abc", liveSha256: "abc" },
      { entry: "./app.js", status: 200, localSha256: "def", liveSha256: "def" }
    ],
    browser: { skipped: false, ok: true }
  });
  assert.equal(passResult.status, "GO_LIVE_CONFIRMED");
  assert.equal(passResult.ok, true);
  console.log("PASS [dry-run 3/4] Mocked healthy deploy emits GO_LIVE_CONFIRMED");

  // (d) Fail-closed paths emit GO_LIVE_BLOCKED
  const baseValid = {
    git: { clean: true, headSha: sha, remoteSha: sha },
    pages: { siteStatus: "built", buildStatus: "built", deploymentState: "success", commitSha: sha, errorMessage: null },
    localSw: { cacheName: "en-pointe-steady-v5" },
    liveSw: { cacheName: "en-pointe-steady-v5" },
    assets: [{ entry: "./app.js", status: 200, localSha256: "aaa", liveSha256: "aaa" }],
    browser: { skipped: true, ok: true }
  };

  const dirtyRes = evaluateGoLiveReadiness({ ...baseValid, git: { clean: false, headSha: sha, remoteSha: sha } });
  assert.equal(dirtyRes.status, "GO_LIVE_BLOCKED");

  const unpushedRes = evaluateGoLiveReadiness({ ...baseValid, git: { clean: true, headSha: sha, remoteSha: "000000" } });
  assert.equal(unpushedRes.status, "GO_LIVE_BLOCKED");

  const staleCacheRes = evaluateGoLiveReadiness({ ...baseValid, liveSw: { cacheName: "en-pointe-steady-v3" } });
  assert.equal(staleCacheRes.status, "GO_LIVE_BLOCKED");

  const http404Res = evaluateGoLiveReadiness({
    ...baseValid,
    assets: [{ entry: "./app.js", status: 404, localSha256: "aaa", liveSha256: "aaa" }]
  });
  assert.equal(http404Res.status, "GO_LIVE_BLOCKED");

  const failedBuildRes = evaluateGoLiveReadiness({
    ...baseValid,
    pages: { siteStatus: "built", buildStatus: "errored", commitSha: sha, errorMessage: "Build failed" }
  });
  assert.equal(failedBuildRes.status, "GO_LIVE_BLOCKED");

  const hashMismatchRes = evaluateGoLiveReadiness({
    ...baseValid,
    assets: [{ entry: "./app.js", status: 200, localSha256: "aaa", liveSha256: "bbb" }]
  });
  assert.equal(hashMismatchRes.status, "GO_LIVE_BLOCKED");

  // Regression: fail-closed on siteStatus "building"/"errored", buildStatus "errored" even with deploymentState "success", and non-success deploymentState
  const siteBuildingRes = evaluateGoLiveReadiness({
    ...baseValid,
    pages: { ...baseValid.pages, siteStatus: "building" }
  });
  assert.equal(siteBuildingRes.status, "GO_LIVE_BLOCKED");

  const siteErroredRes = evaluateGoLiveReadiness({
    ...baseValid,
    pages: { ...baseValid.pages, siteStatus: "errored" }
  });
  assert.equal(siteErroredRes.status, "GO_LIVE_BLOCKED");

  const buildErroredWithSuccessDepRes = evaluateGoLiveReadiness({
    ...baseValid,
    pages: { siteStatus: "built", buildStatus: "errored", deploymentState: "success", commitSha: sha, errorMessage: null }
  });
  assert.equal(buildErroredWithSuccessDepRes.status, "GO_LIVE_BLOCKED");

  const depFailedRes = evaluateGoLiveReadiness({
    ...baseValid,
    pages: { ...baseValid.pages, deploymentState: "failure" }
  });
  assert.equal(depFailedRes.status, "GO_LIVE_BLOCKED");

  // Regression: path traversal rejection and query/hash stripping in verifyAppShellFilesExist
  const traversalCheck = verifyAppShellFilesExist(REPO_ROOT, ["../outside.txt"]);
  assert.equal(traversalCheck.ok, false, "Path traversal outside repoRoot must be rejected");
  assert.deepEqual(traversalCheck.missing, ["../outside.txt"]);

  const queryHashCheck = verifyAppShellFilesExist(REPO_ROOT, ["./app.js?v=1", "./styles.css#top"]);
  assert.equal(queryHashCheck.ok, true, "Query/hash suffixes on valid APP_SHELL files must resolve to disk files");

  // Regression: parseSwConfig without semicolons and with commented-out APP_SHELL entries
  const parsedNoSemiWithComments = parseSwConfig(`
    // const CACHE_NAME = "wrong-cache"
    const CACHE_NAME = "en-pointe-steady-v99"
    const APP_SHELL = [
      "./",
      // "commented-out.js",
      /* "block-commented.js", */
      "./app.js"
    ]
  `);
  assert.equal(parsedNoSemiWithComments.cacheName, "en-pointe-steady-v99");
  assert.deepEqual(parsedNoSemiWithComments.appShell, ["./", "./app.js"]);

  console.log("PASS [dry-run 4/4] Fail-closed gates, path confinement, query/hash stripping, and parseSwConfig edge cases");
  console.log("VERIFY_DEPLOY_DRY_RUN_PASSED");
}

async function runPreFlight(opts) {
  const swSource = fs.readFileSync(path.join(REPO_ROOT, "sw.js"), "utf8");
  const swConfig = parseSwConfig(swSource);
  const shellCheck = verifyAppShellFilesExist(REPO_ROOT, swConfig.appShell);

  const statusLines = runGit(["status", "--porcelain"])
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const headSha = runGit(["rev-parse", "HEAD"]);
  let remoteSha = "";
  try {
    remoteSha = runGit(["rev-parse", "origin/main"]);
  } catch {
    remoteSha = "";
  }

  let liveCacheName = "unavailable (offline)";
  try {
    const liveSwResp = await fetchCacheBusted(new URL("sw.js", opts.url).toString());
    if (liveSwResp.status === 200) {
      liveCacheName = parseSwConfig(liveSwResp.text).cacheName;
    } else {
      liveCacheName = `HTTP ${liveSwResp.status}`;
    }
  } catch {
    liveCacheName = "unavailable (offline)";
  }

  let testsOk = true;
  let testsStatus = "SKIPPED (--skip-tests)";
  if (!opts.skipTests) {
    const res = spawnSync(process.execPath, [path.join(REPO_ROOT, "tests", "verify_app.mjs")], {
      cwd: REPO_ROOT,
      stdio: "inherit"
    });
    testsOk = res.status === 0;
    testsStatus = testsOk ? "PASS" : `FAIL (exit ${res.status})`;
  }

  const readyForConfirmation = shellCheck.ok && testsOk;
  const summary = formatGoLiveReadinessSummary({
    branch: "main",
    liveUrl: opts.url,
    localCacheName: swConfig.cacheName,
    liveCacheName,
    appShellOk: shellCheck.ok,
    appShellCount: swConfig.appShell.length,
    missingAssets: shellCheck.missing,
    testsStatus,
    gitClean: statusLines.length === 0,
    changedFiles: statusLines,
    headSha,
    remoteSha,
    readyForConfirmation
  });

  console.log(summary);
  if (!readyForConfirmation) {
    process.exitCode = 1;
  }
}

async function runLiveVerification(opts) {
  const swSource = fs.readFileSync(path.join(REPO_ROOT, "sw.js"), "utf8");
  const swConfig = parseSwConfig(swSource);

  const statusLines = runGit(["status", "--porcelain"]).trim();
  const clean = statusLines.length === 0;
  const headSha = runGit(["rev-parse", "HEAD"]);
  let remoteSha = "";
  try {
    runGit(["fetch", "origin", "main", "--quiet"]);
    remoteSha = runGit(["rev-parse", "origin/main"]);
  } catch {
    try {
      remoteSha = runGit(["rev-parse", "origin/main"]);
    } catch {
      remoteSha = "";
    }
  }

  // Poll GitHub Pages build/deployment for HEAD SHA
  const deadline = Date.now() + opts.pollSeconds * 1000;
  let pagesInfo = { siteStatus: "unknown", buildStatus: "unknown", deploymentState: "unknown", commitSha: "", errorMessage: null };
  while (true) {
    try {
      const site = runGhJson(`repos/${DEFAULT_REPO_SLUG}/pages`);
      const latestBuild = runGhJson(`repos/${DEFAULT_REPO_SLUG}/pages/builds/latest`);
      let deploymentState = "unknown";
      try {
        const deps = runGhJson(`repos/${DEFAULT_REPO_SLUG}/deployments?per_page=1`);
        if (Array.isArray(deps) && deps[0]?.sha === headSha) {
          const statuses = runGhJson(`repos/${DEFAULT_REPO_SLUG}/deployments/${deps[0].id}/statuses?per_page=1`);
          deploymentState = statuses?.[0]?.state || "unknown";
        }
      } catch {
        // deployments check is supplementary to pages/builds/latest
      }

      pagesInfo = {
        siteStatus: site?.status || "unknown",
        buildStatus: latestBuild?.status || "unknown",
        deploymentState,
        commitSha: latestBuild?.commit || "",
        errorMessage: latestBuild?.error?.message || null
      };

      const done =
        pagesInfo.commitSha === headSha &&
        (pagesInfo.buildStatus === "built" || pagesInfo.buildStatus === "errored");
      if (done || Date.now() >= deadline) {
        break;
      }
    } catch (err) {
      pagesInfo.errorMessage = err.message;
      if (Date.now() >= deadline) break;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }

  // Fetch live sw.js & APP_SHELL assets with cache-busting
  let liveSw = { cacheName: "" };
  try {
    const swResp = await fetchCacheBusted(new URL("sw.js", opts.url).toString());
    if (swResp.status === 200) {
      liveSw = parseSwConfig(swResp.text);
    }
  } catch {
    liveSw = { cacheName: "" };
  }

  const assets = [];
  for (const entry of swConfig.appShell) {
    const localPath = resolveAppShellLocalPath(REPO_ROOT, entry);
    const localSha256 = localPath && fs.existsSync(localPath) ? sha256Hex(fs.readFileSync(localPath)) : "";
    const assetRel = entry === "./" ? "" : entry.replace(/^\.\//, "");
    const assetUrl = new URL(assetRel, opts.url).toString();
    try {
      const resp = await fetchCacheBusted(assetUrl);
      assets.push({
        entry,
        url: assetUrl,
        status: resp.status,
        localSha256,
        liveSha256: resp.status === 200 ? sha256Hex(resp.buffer) : ""
      });
    } catch {
      assets.push({
        entry,
        url: assetUrl,
        status: 0,
        localSha256,
        liveSha256: ""
      });
    }
  }

  const browser = opts.skipBrowser ? { skipped: true, ok: true } : runHeadlessBrowserSmoke(opts.url);

  const verdict = evaluateGoLiveReadiness({
    git: { clean, headSha, remoteSha },
    pages: pagesInfo,
    localSw: { cacheName: swConfig.cacheName },
    liveSw,
    assets,
    browser
  });

  console.log("=== Live Deployment Verification ===");
  console.log(`Live URL       : ${opts.url}`);
  console.log(`HEAD SHA       : ${headSha}`);
  console.log(`origin/main    : ${remoteSha}`);
  console.log(`Pages Status   : ${pagesInfo.siteStatus} / ${pagesInfo.buildStatus} (commit: ${pagesInfo.commitSha})`);
  console.log(`Local SW Cache : ${swConfig.cacheName}`);
  console.log(`Live SW Cache  : ${liveSw.cacheName || "unavailable"}`);
  console.log(`Assets Checked : ${assets.length}`);
  if (!verdict.ok) {
    for (const reason of verdict.reasons) {
      console.error(`BLOCKED REASON : ${reason}`);
    }
    console.error("GO_LIVE_BLOCKED");
    process.exitCode = 1;
    return;
  }
  console.log(`Verified At    : ${new Date().toISOString()}`);
  console.log("GO_LIVE_CONFIRMED");
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  const opts = parseCliArgs(process.argv);
  if (opts.mode === "dry-run") {
    runDryRunSuite();
  } else if (opts.mode === "live") {
    await runLiveVerification(opts);
  } else {
    await runPreFlight(opts);
  }
}
