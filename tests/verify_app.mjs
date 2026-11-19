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
import {
  createDefaultState,
  getCalculatedTargets,
  formatScaledPortion,
  cloneScheduleTemplate,
  adjustBonusValue,
  applyRolloverState,
  parseSyncHashOrQuery,
  formatCarpoolShareText,
  QUICK_LOG_PRESETS,
  CLINICAL_INFO_TOPICS,
  MANUAL_SECTIONS
} from "../app.js";

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

  const extremeOverride = getCalculatedTargets({
    ...profile,
    useDoctorOverride: true,
    customCalories: 5000
  });
  assert.equal(extremeOverride.portionMultiplier, 1.65, "Doctor Override portionMultiplier must clamp to 1.65");

  const lowOverride = getCalculatedTargets({
    ...profile,
    useDoctorOverride: true,
    customCalories: 800
  });
  assert.equal(lowOverride.portionMultiplier, 0.65, "Doctor Override portionMultiplier must clamp to 0.65");

  const zeroInchTargets = getCalculatedTargets({ ...profile, heightIn: 0 });
  const twoInchTargets = getCalculatedTargets({ ...profile, heightIn: 2 });
  assert.notEqual(zeroInchTargets.calories, twoInchTargets.calories, "heightIn=0 must not be coerced to 2");

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

  const zeroCapFood = evaluateFoodSafety(500, 1.0, 200, 0);
  assert.equal(zeroCapFood.gbRating.status, "caution", "maxMealFat=0 must not be coerced to 5.5");

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

  const formulaCsv = generateHistoryCsv([
    { date: "2026-11-18", notes: "=CMD|'/C calc'!A0" },
    { date: "2026-11-17", notes: "+1+1" },
    { date: "2026-11-16", notes: "-1+1" },
    { date: "2026-11-15", notes: "@SUM(1,2)" },
    { date: "2026-11-14", notes: "\t=1+1" },
    { date: "2026-11-13", notes: "\r=1+1" }
  ]);
  assert.ok(formulaCsv.includes(",'=CMD|'/C calc'!A0"), "CSV formula '=' must be prefixed with '");
  assert.ok(formulaCsv.includes(",'+1+1"), "CSV formula '+' must be prefixed with '");
  assert.ok(formulaCsv.includes(",'-1+1"), "CSV formula '-' must be prefixed with '");
  assert.ok(formulaCsv.includes(",\"'@SUM(1,2)\""), "CSV formula '@' with comma must be prefixed with ' and quoted");
  assert.ok(formulaCsv.includes(",'\t=1+1"), "CSV formula tab must be prefixed with '");
  assert.ok(formulaCsv.includes(",\"'\r=1+1\""), "CSV formula CR must be prefixed with ' and quoted");

  const unknownSymptomStats = computeHistoryStats([
    { sodiumMg: 3000, waterOz: 70, totalFatG: 15, gbCompliant: true, symptomStatus: "nausea" }
  ]);
  assert.equal(unknownSymptomStats.symptomCounts.steady, 1, "Unknown symptomStatus should normalize to steady in symptomCounts");
  assert.equal(unknownSymptomStats.symptomCorrelation.steadyDays, 1, "Unknown symptomStatus should normalize to steadyDays");
  assert.equal(unknownSymptomStats.symptomCorrelation.symptomaticDays, 0, "Unknown symptomStatus should not increment symptomaticDays");

  state.history = filtered7d;
  const reportHtml = renderDoctorReportHtml(state, targets, "30d");
  assert.ok(reportHtml.includes("Clinical POTS"), "Doctor report missing title");
  assert.ok(reportHtml.includes("50%"), "Doctor report missing GB compliance %");

  console.log("PASS [3/5] History & Doctor Report Logic");
}

// Test 4: WebCrypto AES-256-GCM Round-Trip & PIN Change Re-Encryption
async function testWebCryptoRoundTrip() {
  const passphrase = "test-passphrase-123";
  const newPassphrase = "updated-family-pin-999";
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

  // Simulate Family PIN change: re-encrypt with new passphrase
  const reEncryptedToken = await encryptBundle(decrypted, newPassphrase);
  const reDecrypted = await decryptBundle(reEncryptedToken, newPassphrase);
  assert.equal(reDecrypted.history[0].sodiumMg, 4100);
  await assert.rejects(
    () => decryptBundle(reEncryptedToken, passphrase),
    /./,
    "Old PIN must fail to decrypt after PIN change re-encryption"
  );

  console.log("PASS [4/6] WebCrypto AES-256-GCM & PIN Change Round-Trip");
}

// Test 5: Daily Usability Helpers (Templates, Rollover, Bonus Clamp, Pairing Hash, Carpool Share)
function testDailyUsabilityHelpers() {
  const defState = createDefaultState();
  assert.ok(defState.schedules.school_dance.length >= 4, "Default school_dance template should be pre-populated");
  assert.ok(defState.schedules.competition.length >= 3, "Default competition template should be pre-populated");
  assert.ok(defState.schedules.recovery.length >= 3, "Default recovery template should be pre-populated");
  assert.ok(QUICK_LOG_PRESETS.length >= 5, "Quick log presets should be populated");
  assert.ok(Object.keys(CLINICAL_INFO_TOPICS).length >= 5, "Clinical info topics should be populated");
  assert.ok(MANUAL_SECTIONS.length >= 3, "Manual sections should be populated");

  // Bonus value clamping >= 0
  assert.equal(adjustBonusValue(500, -500), 0);
  assert.equal(adjustBonusValue(0, -500), 0);
  assert.equal(adjustBonusValue(200, -500), 0);
  assert.equal(adjustBonusValue(0, 500), 500);

  // Midnight rollover filters out isAdHoc slots while keeping template slots
  const rolloverInput = createDefaultState();
  rolloverInput.lastActiveDate = "2026-11-17";
  rolloverInput.bonusSodium = 500;
  rolloverInput.bonusWater = 16;
  rolloverInput.symptomStatus = "dizzy";
  rolloverInput.dailyNotes = "High HR";
  rolloverInput.schedules.school_dance = [
    ...cloneScheduleTemplate("school_dance"),
    {
      id: "adhoc_12345",
      isAdHoc: true,
      time: "4:00 PM",
      phase: "Quick Log",
      options: [{ name: "LMNT", basePortion: "16oz", kcal: 5, sodium: 1000, water: 16, fat: 0 }]
    }
  ];
  rolloverInput.checkedSlots = { sd_1: true, adhoc_12345: true };

  const { rolledOver, nextState } = applyRolloverState(rolloverInput, "2026-11-18");
  assert.equal(rolledOver, true);
  assert.equal(nextState.lastActiveDate, "2026-11-18");
  assert.equal(nextState.bonusSodium, 0);
  assert.equal(nextState.bonusWater, 0);
  assert.equal(nextState.symptomStatus, "steady");
  assert.equal(nextState.dailyNotes, "");
  assert.equal(Object.keys(nextState.checkedSlots).length, 0);
  assert.ok(!nextState.schedules.school_dance.some((s) => s.isAdHoc), "Ad-hoc slots must be cleared at rollover");
  assert.equal(nextState.schedules.school_dance.length, cloneScheduleTemplate("school_dance").length);
  assert.equal(nextState.history.length, 1);

  // Pairing URL hash and query extraction
  const hashSync = parseSyncHashOrQuery("", "#sync=https%3A%2F%2Fscript.google.com%2Fmacros%2Fs%2Fabc%2Fexec");
  assert.equal(hashSync, "https://script.google.com/macros/s/abc/exec");
  const querySync = parseSyncHashOrQuery("?sync=https%3A%2F%2Fscript.google.com%2Fmacros%2Fs%2Fxyz%2Fexec", "");
  assert.equal(querySync, "https://script.google.com/macros/s/xyz/exec");
  assert.equal(parseSyncHashOrQuery("", "#sync=javascript:alert(1)"), "");

  // Carpool text sharing format
  const shareTxt = formatCarpoolShareText("Wed", {
    toDriver: "Driver A",
    toTime: "3:30 PM",
    toNote: "Side door",
    homeDriver: "Driver B",
    homeTime: "9:15 PM",
    homeNote: ""
  });
  assert.ok(shareTxt.includes("Wed Dance Carpool"));
  assert.ok(shareTxt.includes("Driver A @ 3:30 PM (Side door)"));
  assert.ok(shareTxt.includes("Driver B @ 9:15 PM"));

  console.log("PASS [5/6] Daily Usability Helpers & Rollover");
}

// Test 6: Apps Script Target Check
function testAppsScriptTarget(gsPath) {
  if (!gsPath) {
    console.log("SKIP [6/6] Apps Script Target Check (no --gs-path provided)");
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
  console.log("PASS [6/6] Apps Script Target Check");
}

const args = parseArgs(process.argv);
testZeroPii();
testPotsAndGallbladderMath();
testHistoryAndDoctorReport();
await testWebCryptoRoundTrip();
testDailyUsabilityHelpers();
testAppsScriptTarget(args.gsPath);
console.log("ALL_VERIFY_APP_CHECKS_PASSED");
