import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_FOOD_LIBRARY, NUTRITION_KEYWORD_RULES, evaluateFoodSafety } from "../foods.js";
import { BUNDLE_PREFIX, encryptBundle, decryptBundle } from "../crypto.js";
import {
  snapshotToday,
  filterHistory,
  computeHistoryStats,
  generateHistoryCsv,
  renderDoctorReportHtml
} from "../history.js";
import { createDefaultState, getCalculatedTargets, formatScaledPortion } from "../app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--gs-path" && argv[i + 1]) {
      args.gsPath = argv[++i];
    }
  }
  return args;
}

function walkFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

// Test 1: Zero PII in repo
function testZeroPii() {
  // Decode patterns at runtime so this test file itself contains zero PII literals
  const b64Patterns = [
    "TWlh",         // family name
    "U2FyYWg=",     // carpool contact
    "SmVubmE=",     // carpool contact
    "Q2hsb2U=",     // carpool contact
    "QW1hbmRh",     // carpool contact
    "NTU1LTA=",     // phone prefix
    "MWszRkhXWk8=", // sheet ID prefix
    "MVlTdVVCbU0=", // drive ID prefix
    "MVJVbGhq",     // script ID prefix
    "ZGFuY2VmYW1pbHk=", // legacy passphrase
    "cmV4eHRlcg==", // email handle
    "MTIzNA=="      // default pin
  ];
  const decoded = b64Patterns.map((p) => Buffer.from(p, "base64").toString("utf8"));
  const piiRegex = new RegExp(`\\b(?:${decoded.slice(0, 5).join("|")})\\b|${decoded.slice(5).join("|")}`, "i");

  const selfPath = path.resolve(fileURLToPath(import.meta.url));
  const files = walkFiles(REPO_ROOT).filter((f) => path.resolve(f) !== selfPath);

  const hits = [];
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const match = content.match(piiRegex);
    if (match) {
      hits.push(`${path.relative(REPO_ROOT, file)}: matched "${match[0]}"`);
    }
  }
  assert.equal(hits.length, 0, `PII detected in public repo:\n${hits.join("\n")}`);
  console.log("PASS [1/5] Zero PII in repo");
}

// Test 2: POTS & Gallbladder Math
function testPotsAndGallbladderMath() {
  assert.equal(DEFAULT_FOOD_LIBRARY.length, 36, "Expected 36 food items in DEFAULT_FOOD_LIBRARY");
  assert.equal(NUTRITION_KEYWORD_RULES.length, 28, "Expected 28 keyword rules");

  const profile = {
    name: "Dancer",
    age: 14,
    weightLbs: 115,
    heightFt: 5,
    heightIn: 3,
    danceHours: 3.5,
    potsLevel: "standard",
    gbLevel: "moderate",
    useDoctorOverride: false
  };
  const targets = getCalculatedTargets(profile);
  assert.equal(targets.maxMealFat, 5.5);
  assert.equal(targets.dailyFatCap, 33);
  assert.ok(targets.sodium >= 4000, `Expected sodium >= 4000, got ${targets.sodium}`);
  assert.ok(targets.water >= 90, `Expected water >= 90, got ${targets.water}`);
  assert.ok(targets.calories >= 1800, `Expected calories >= 1800, got ${targets.calories}`);

  const overrideTargets = getCalculatedTargets({
    ...profile,
    useDoctorOverride: true,
    customCalories: 2400,
    customSodium: 4500,
    customWater: 100,
    customMealFat: 4.0
  });
  assert.equal(overrideTargets.calories, 2400);
  assert.equal(overrideTargets.sodium, 4500);
  assert.equal(overrideTargets.water, 100);
  assert.equal(overrideTargets.maxMealFat, 4.0);
  assert.equal(overrideTargets.dailyFatCap, 24);

  const scaledHigh = formatScaledPortion("1 cup rice", { portionMultiplier: 1.25 }, "high");
  assert.ok(scaledHigh.includes("1.5x High-Output Portion"), `Unexpected portion label: ${scaledHigh}`);

  const safeFood = evaluateFoodSafety(580, 5.5, 250, 5.5);
  assert.equal(safeFood.gbRating.status, "safe");
  assert.equal(safeFood.overall, "safe");

  const cautionFood = evaluateFoodSafety(450, 5.6, 250, 5.5);
  assert.equal(cautionFood.gbRating.status, "caution");
  assert.equal(cautionFood.overall, "caution");

  const cautionUpper = evaluateFoodSafety(450, 7.9, 250, 5.5);
  assert.equal(cautionUpper.gbRating.status, "caution");

  const avoidFood = evaluateFoodSafety(500, 8.0, 400, 5.5);
  assert.equal(avoidFood.gbRating.status, "avoid");
  assert.equal(avoidFood.overall, "avoid");

  const potsCaution = evaluateFoodSafety(100, 2.0, 450, 5.5);
  assert.equal(potsCaution.potsRating.status, "caution");
  assert.equal(potsCaution.overall, "caution");

  console.log("PASS [2/5] POTS & Gallbladder Math");
}

// Test 3: History & Doctor Report Logic
function testHistoryAndDoctorReport() {
  const state = createDefaultState();
  state.dayMode = "school_dance";
  state.bonusSodium = 750;
  state.bonusWater = 16;
  state.symptomStatus = "steady";
  state.dailyNotes = "Good energy";
  state.schedules.school_dance = [
    {
      id: "slot_1",
      time: "7:00 AM",
      phase: "Breakfast",
      options: [{ name: "Oats", kcal: 290, sodium: 480, water: 8, fat: 2.0 }]
    },
    {
      id: "slot_2",
      time: "12:30 PM",
      phase: "Lunch",
      options: [{ name: "Turkey Sub", kcal: 380, sodium: 960, water: 16, fat: 4.0 }]
    }
  ];
  state.checkedSlots = { slot_1: true, slot_2: true };

  const targets = getCalculatedTargets(state.profile);
  const { entry, history } = snapshotToday(state, targets, "2026-11-18");
  assert.equal(entry.date, "2026-11-18");
  assert.equal(entry.sodiumMg, 750 + 480 + 960);
  assert.equal(entry.waterOz, 16 + 8 + 16);
  assert.equal(entry.totalFatG, 6.0);
  assert.equal(entry.gbCompliant, true);
  assert.equal(history.length, 1);

  const sampleHistory = [
    entry,
    {
      date: "2026-11-17",
      dayMode: "competition",
      sodiumMg: 3200,
      sodiumTarget: 4230,
      waterOz: 80,
      waterTarget: 96,
      totalFatG: 14,
      maxMealFatSeen: 8.5,
      maxMealFat: 5.5,
      gbCompliant: false,
      symptomStatus: "dizzy",
      notes: "Low morning salt"
    }
  ];
  const filtered7d = filterHistory(sampleHistory, "7d", new Date("2026-11-18T12:00:00Z"));
  assert.equal(filtered7d.length, 2);

  const stats = computeHistoryStats(filtered7d);
  assert.equal(stats.count, 2);
  assert.equal(stats.gbCompliancePct, 50);
  assert.equal(stats.avgSodium, Math.round((entry.sodiumMg + 3200) / 2));

  const csv = generateHistoryCsv(filtered7d);
  assert.ok(csv.startsWith("Date,Day Mode,Sodium (mg)"), "CSV header mismatch");
  assert.ok(csv.includes("2026-11-18"), "CSV missing today's entry");
  assert.ok(csv.includes("2026-11-17"), "CSV missing previous entry");

  state.history = filtered7d;
  const reportHtml = renderDoctorReportHtml(state, targets, "30d");
  assert.ok(reportHtml.includes("Clinical POTS"), "Doctor report missing title");
  assert.ok(reportHtml.includes("50%"), "Doctor report missing GB compliance %");

  console.log("PASS [3/5] History & Doctor Report Logic");
}

// Test 4: WebCrypto AES-256-GCM Round-Trip
async function testWebCryptoRoundTrip() {
  const passphrase = "test-passphrase-123";
  const payload = {
    viewerRole: "Dancer",
    dayMode: "school_dance",
    profile: { name: "Dancer", age: 14, weightLbs: 110 },
    history: [
      { date: "2026-11-18", sodiumMg: 4100, waterOz: 96, gbCompliant: true, symptomStatus: "steady" }
    ]
  };

  const token = await encryptBundle(payload, passphrase);
  assert.ok(token.startsWith(BUNDLE_PREFIX), `Expected ${BUNDLE_PREFIX} prefix`);

  const decrypted = await decryptBundle(token, passphrase);
  assert.equal(decrypted.profile.name, "Dancer");
  assert.equal(decrypted.history.length, 1);
  assert.equal(decrypted.history[0].sodiumMg, 4100);

  await assert.rejects(
    () => decryptBundle(token, "wrong-passphrase-999"),
    /./,
    "Expected wrong passphrase to fail AES-GCM authentication"
  );

  console.log("PASS [4/5] WebCrypto AES-256-GCM Round-Trip");
}

// Test 5: Apps Script Target Check
function testAppsScriptTarget(gsPath) {
  if (!gsPath) {
    console.log("SKIP [5/5] Apps Script Target Check (no --gs-path provided)");
    return;
  }
  const gsCode = fs.readFileSync(gsPath, "utf8");
  assert.ok(
    gsCode.includes('getSheetByName("Cloud_Sync_Store")') ||
      gsCode.includes("getSheetByName(SYNC_SHEET_NAME)"),
    'Apps Script must target getSheetByName("Cloud_Sync_Store") or getSheetByName(SYNC_SHEET_NAME)'
  );
  assert.ok(
    !gsCode.includes("getSheets()[0]"),
    "Apps Script must NOT use getSheets()[0]"
  );
  console.log("PASS [5/5] Apps Script Target Check");
}

const args = parseArgs(process.argv);
testZeroPii();
testPotsAndGallbladderMath();
testHistoryAndDoctorReport();
await testWebCryptoRoundTrip();
testAppsScriptTarget(args.gsPath);
console.log("ALL_VERIFY_APP_CHECKS_PASSED");
