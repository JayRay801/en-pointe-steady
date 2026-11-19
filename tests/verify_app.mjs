import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_FOOD_LIBRARY,
  NUTRITION_KEYWORD_RULES,
  NUTRITION_SOURCES,
  evaluateFoodSafety
} from "../foods.js";
import {
  BUNDLE_PREFIX,
  encryptBundle,
  decryptBundle,
  resolveFamilySupportPhone,
  buildSmsHelpUri,
  GOOGLE_AUTH_PREP_SPEC,
  prepareGoogleSignInConfig
} from "../crypto.js";
import {
  computeDailyScore,
  snapshotToday,
  upsertPastHistoryEntry,
  filterHistory,
  computeHistoryStats,
  generateHistoryCsv,
  renderDoctorReportHtml
} from "../history.js";
import {
  createDefaultState,
  getCalculatedTargets,
  getDanceHoursForDate,
  parseBandIcsSchedule,
  parseBandTextSchedule,
  getRoleCopy,
  getRolePersonalization,
  resolveEffectiveLighting,
  getSmartMotto,
  computeConcentricRingData,
  getTodayNextClassAndCarpool,
  verifyAdminPin,
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
import {
  parseSwConfig,
  verifyAppShellFilesExist,
  evaluateGoLiveReadiness
} from "./verify_deploy.mjs";

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
    if (
      entry.name === ".git" ||
      entry.name === "node_modules" ||
      entry.name === ".agents" ||
      entry.name === "PROJECT.md"
    ) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

// Test 1: Zero PII in repo (including encoded phone number ODAxNDczNTczMQ==)
function testZeroPii() {
  // Decode patterns at runtime so this test file itself contains zero PII literals
  const b64Patterns = [
    "TWlh",             // family name
    "U2FyYWg=",         // carpool contact
    "SmVubmE=",         // carpool contact
    "Q2hsb2U=",         // carpool contact
    "QW1hbmRh",         // carpool contact
    "NTU1LTA=",         // phone prefix
    "MWszRkhXWk8=",     // sheet ID prefix
    "MVlTdVVCbU0=",     // drive ID prefix
    "MVJVbGhq",         // script ID prefix
    "ZGFuY2VmYW1pbHk=", // legacy passphrase
    "cmV4eHRlcg==",     // email handle
    "MTIzNA==",         // default pin
    "ODAxNDczNTczMQ=="  // support phone number (must remain cipher-encoded, never plaintext)
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
  console.log("PASS [1/10] Zero PII in repo (including non-plaintext support phone)");
}

// Test 2: POTS & Gallbladder Math + Dynamic Daily Dance Activity + Male/Female Gender Math
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

  // Requirement 1c & 1c.i: Dynamic day-to-day dance hours driving recommended food intake
  const restDayTargets = getCalculatedTargets(profile, { danceHours: 0 });
  const heavyDanceTargets = getCalculatedTargets(profile, { danceHours: 4.0 });
  assert.equal(restDayTargets.danceHours, 0);
  assert.equal(heavyDanceTargets.danceHours, 4.0);
  assert.ok(
    heavyDanceTargets.calories > restDayTargets.calories,
    "Recommended calorie intake must increase on days with more dance activity"
  );
  assert.ok(
    heavyDanceTargets.portionMultiplier >= restDayTargets.portionMultiplier,
    "Recommended portion multiplier must scale with daily dance activity"
  );
  assert.ok(
    heavyDanceTargets.water > restDayTargets.water,
    "Recommended water intake must increase with daily dance hours"
  );
  assert.ok(
    heavyDanceTargets.sodium > restDayTargets.sodium,
    "Recommended sodium intake must increase with daily dance hours"
  );

  // Requirement 1d: Male vs Female profile gender target recommendations
  const femaleTargets = getCalculatedTargets({ ...profile, gender: "female" }, { danceHours: 2.0 });
  const maleTargets = getCalculatedTargets({ ...profile, gender: "male" }, { danceHours: 2.0 });
  assert.equal(femaleTargets.gender, "female");
  assert.equal(maleTargets.gender, "male");
  assert.ok(
    maleTargets.calories > femaleTargets.calories,
    `Male BMR (+5) and calorie target (${maleTargets.calories}) must exceed Female (-161) target (${femaleTargets.calories})`
  );
  assert.ok(
    maleTargets.water > femaleTargets.water,
    "Male hydration target should reflect higher baseline fluid factor"
  );
  assert.ok(
    maleTargets.sodium > femaleTargets.sodium,
    "Male sweat sodium scaling per dance hour should exceed female baseline"
  );

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

  console.log("PASS [2/10] POTS, Gallbladder, Dynamic Daily Dance Activity & Male/Female Math");
}

// Test 3: History, Daily Target Scoring, Past Day Logging & Doctor Report Logic
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
  assert.equal(typeof entry.score, "number", "Snapshot entry must include daily target score");
  assert.ok(["high", "medium", "low"].includes(entry.scoreTier), "Snapshot entry must include scoreTier");
  assert.equal(history.length, 1);

  // Requirement 4: Daily Target Scoring Tiers (Green high >=80%, Yellow medium 50-79%, Red low <50%, 0% when unlogged)
  const unloggedScore = computeDailyScore({ sodiumMg: 0, waterOz: 0, checkedCount: 0 }, targets);
  assert.equal(unloggedScore.score, 0, "Unlogged day should have score 0%");
  assert.equal(unloggedScore.goalsHit, 0);
  assert.equal(unloggedScore.tier, "low");

  const highScore = computeDailyScore(
    { sodiumMg: 3900, sodiumTarget: 3960, waterOz: 82, waterTarget: 84, maxMealFat: 3.5, gbCompliant: true },
    targets
  );
  assert.ok(highScore.score >= 80, `Expected high score >= 80, got ${highScore.score}`);
  assert.equal(highScore.tier, "high");
  assert.equal(highScore.goalsHit, 3);
  assert.equal(highScore.badgeClass, "badge-safe");

  const medScore = computeDailyScore(
    { sodiumMg: 2400, sodiumTarget: 3960, waterOz: 55, waterTarget: 84, maxMealFat: 4.0, gbCompliant: true },
    targets
  );
  assert.ok(medScore.score >= 50 && medScore.score < 80, `Expected medium score 50-79, got ${medScore.score}`);
  assert.equal(medScore.tier, "medium");
  assert.equal(medScore.badgeClass, "badge-caution");

  const lowScore = computeDailyScore(
    { sodiumMg: 800, sodiumTarget: 3960, waterOz: 20, waterTarget: 84, maxMealFat: 12.0, gbCompliant: false },
    targets
  );
  assert.ok(lowScore.score < 50, `Expected low score < 50, got ${lowScore.score}`);
  assert.equal(lowScore.tier, "low");
  assert.equal(lowScore.badgeClass, "badge-avoid");

  // Requirement 5: Upserting & editing past/missed day records
  const pastRes = upsertPastHistoryEntry(
    history,
    {
      date: "2026-11-15",
      dayMode: "school_dance",
      danceHours: 2.5,
      sodiumMg: 4000,
      sodiumTarget: 4050,
      waterOz: 88,
      waterTarget: 88,
      maxMealFat: 3.0,
      totalFatG: 12.0,
      symptomStatus: "steady",
      notes: "Backdated missed day"
    },
    targets
  );
  assert.equal(pastRes.history.length, 2);
  assert.equal(pastRes.entry.date, "2026-11-15");
  assert.equal(pastRes.entry.isBackdated, true);
  assert.equal(pastRes.entry.scoreTier, "high");
  assert.equal(pastRes.entry.goalsHit, 3);

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
  assert.ok(typeof stats.avgScore === "number" && stats.avgScore > 0, "Stats must include avgScore");

  const csv = generateHistoryCsv(filtered7d);
  assert.ok(csv.startsWith("Date,Day Mode,Sodium (mg)"), "CSV header mismatch");
  assert.ok(csv.includes("Target Score (%),Goals Hit"), "CSV must include appended Target Score and Goals Hit columns");
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
  assert.ok(reportHtml.includes("Target Score"), "Doctor report must include Target Score");
  assert.ok(reportHtml.includes("Dysautonomia International"), "Doctor report must cite clinical sources");

  console.log("PASS [3/10] History, Daily Target Scoring, Past Day Logging & Doctor Report");
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

  console.log("PASS [4/10] WebCrypto AES-256-GCM & PIN Change Round-Trip");
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

  // Carpool text sharing format (supporting both School & Dance carpool)
  const shareTxt = formatCarpoolShareText("Wed", {
    schoolToDriver: "Mom",
    schoolToTime: "7:35 AM",
    schoolHomeDriver: "Bus",
    schoolHomeTime: "2:55 PM",
    toDriver: "Driver A",
    toTime: "3:30 PM",
    toNote: "Side door",
    homeDriver: "Driver B",
    homeTime: "9:15 PM",
    homeNote: ""
  });
  assert.ok(shareTxt.includes("Wed Dance Carpool"));
  assert.ok(shareTxt.includes("To School: Mom @ 7:35 AM"));
  assert.ok(shareTxt.includes("Driver A @ 3:30 PM (Side door)"));
  assert.ok(shareTxt.includes("Driver B @ 9:15 PM"));

  console.log("PASS [5/10] Daily Usability Helpers & Rollover");
}

// Test 6: Customizable Daily Dance Schedule, BAND Sync Parsers & Dynamic Dance Hours
function testScheduleAndBandSync() {
  const state = createDefaultState();

  // Default schedule has different dance hours on different days (e.g. Mon 2.0h, Tue 3.0h, Fri 0h rest, Sun 0h)
  const monHours = getDanceHoursForDate(state, "Mon");
  const tueHours = getDanceHoursForDate(state, "Tue");
  const friHours = getDanceHoursForDate(state, "Fri");
  const sunHours = getDanceHoursForDate(state, "Sun");
  assert.equal(monHours, 2.0, "Monday default schedule should have 2.0 dance hours");
  assert.equal(tueHours, 3.0, "Tuesday default schedule should have 3.0 dance/rehearsal hours");
  assert.equal(friHours, 0, "Friday default schedule has school only (0 dance hours)");
  assert.equal(sunHours, 0, "Sunday default schedule has 0 dance hours");

  // Date-specific override
  state.dateScheduleOverrides["2026-11-20"] = [
    { id: "ov_1", title: "Extra Nutcracker Rehearsal", category: "rehearsal", startTime: "16:00", endTime: "19:30", durationHours: 3.5 }
  ];
  assert.equal(getDanceHoursForDate(state, "2026-11-20"), 3.5, "Date override must take precedence for getDanceHoursForDate");

  // BAND .ics parser
  const sampleIcs = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "DTSTART:20261123T160000",
    "DTEND:20261123T183000",
    "SUMMARY:Pointe & Variations Rehearsal",
    "LOCATION:Studio A",
    "DESCRIPTION:Bring extra electrolytes",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
  const parsedIcs = parseBandIcsSchedule(sampleIcs);
  assert.equal(parsedIcs.length, 1);
  assert.equal(parsedIcs[0].title, "Pointe & Variations Rehearsal");
  assert.equal(parsedIcs[0].date, "2026-11-23");
  assert.equal(parsedIcs[0].durationHours, 2.5);
  assert.equal(parsedIcs[0].source, "band");

  // BAND text schedule parser
  const sampleText = [
    "Mon 4:00 PM - 6:00 PM Ballet & Pointe",
    "Wed 4:30 PM - 7:00 PM Contemporary Rehearsal"
  ].join("\n");
  const parsedTxt = parseBandTextSchedule(sampleText);
  assert.equal(parsedTxt.length, 2);
  assert.equal(parsedTxt[0].dayOfWeek, "Mon");
  assert.equal(parsedTxt[0].durationHours, 2.0);
  assert.equal(parsedTxt[1].dayOfWeek, "Wed");
  assert.equal(parsedTxt[1].durationHours, 2.5);

  console.log("PASS [6/10] Customizable Daily Dance Schedule & BAND Sync Parsers");
}

// Test 7: Non-Technical Manual/Info, SMS Help Cipher, Admin PIN & Google Sign-In Prep
function testNonTechManualHelpAdminAndGooglePrep() {
  // Requirement 2: Zero technical lingo in user-facing CLINICAL_INFO_TOPICS and MANUAL_SECTIONS
  const forbiddenJargon = /\b(AES-256-GCM|PBKDF2|Zero-PII|RFC-4180|Apps Script|biliary flares)\b/i;
  for (const [k, topic] of Object.entries(CLINICAL_INFO_TOPICS)) {
    assert.ok(!forbiddenJargon.test(topic.title), `Tech jargon found in CLINICAL_INFO_TOPICS.${k}.title`);
    assert.ok(!forbiddenJargon.test(topic.body), `Tech jargon found in CLINICAL_INFO_TOPICS.${k}.body`);
  }
  for (const sec of MANUAL_SECTIONS) {
    assert.ok(!forbiddenJargon.test(sec.title), `Tech jargon found in MANUAL_SECTIONS.${sec.id}.title`);
    for (const item of sec.items) {
      assert.ok(!forbiddenJargon.test(item), `Tech jargon found in MANUAL_SECTIONS.${sec.id} item`);
    }
  }

  // Requirement 2a: Family support phone cipher & SMS URI builder
  const expectedPhone = Buffer.from("ODAxNDczNTczMQ==", "base64").toString("utf8");
  const resolvedPhone = resolveFamilySupportPhone({}, { unlocked: true });
  assert.equal(resolvedPhone, expectedPhone, "Family cipher must decode support phone in memory");
  assert.equal(resolveFamilySupportPhone({}, { unlocked: false }), "", "Locked session should not expose support phone");

  const androidUri = buildSmsHelpUri(resolvedPhone, "Need help with schedule", "Mozilla/5.0 (Linux; Android 14)");
  assert.ok(androidUri.startsWith(`sms:${expectedPhone}?body=`), `Unexpected Android SMS URI: ${androidUri}`);
  assert.ok(androidUri.includes("Need%20help%20with%20schedule"));

  const iosUri = buildSmsHelpUri(resolvedPhone, "Need help with schedule", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
  assert.ok(iosUri.startsWith(`sms:${expectedPhone}&body=`), `Unexpected iOS SMS URI: ${iosUri}`);

  // Requirement 2b: Admin PIN verification
  const state = createDefaultState();
  state.adminConfig.adminPin = "9876";
  assert.equal(verifyAdminPin("9876", state, {}), true);
  assert.equal(verifyAdminPin("0000", state, {}), false);

  // Requirement 2c: Dormant Google Sign-In prep hooks & documentation
  assert.equal(GOOGLE_AUTH_PREP_SPEC.status, "dormant");
  assert.equal(GOOGLE_AUTH_PREP_SPEC.defaultConfig.enabled, false);
  const normDormant = prepareGoogleSignInConfig({ enabled: true, clientId: "" });
  assert.equal(normDormant.enabled, false, "Google Sign-In must stay disabled when clientId is empty");
  const normPrepped = prepareGoogleSignInConfig({
    enabled: false,
    clientId: "12345.apps.googleusercontent.com",
    allowedEmails: "dancer@example.com, mom@example.com"
  });
  assert.equal(normPrepped.enabled, false);
  assert.equal(normPrepped.allowedEmails.length, 2);
  assert.ok(
    fs.existsSync(path.join(REPO_ROOT, "GOOGLE_SIGNIN_PREP.md")),
    "GOOGLE_SIGNIN_PREP.md must exist to document future Google Sign-In activation"
  );

  console.log("PASS [7/10] Non-Tech Manual/Info, SMS Help Cipher, Admin PIN & Google Sign-In Prep");
}

// Test 8: Nutritional & Recommendation Sources (Requirement 3)
function testNutritionalSources() {
  assert.ok(Array.isArray(NUTRITION_SOURCES) && NUTRITION_SOURCES.length >= 4, "NUTRITION_SOURCES must have >= 4 categories");
  const combinedText = JSON.stringify(NUTRITION_SOURCES);
  assert.ok(combinedText.includes("Dysautonomia International"), "Sources must cite Dysautonomia International");
  assert.ok(combinedText.includes("Mifflin-St Jeor"), "Sources must cite Mifflin-St Jeor equation");
  assert.ok(combinedText.includes("USDA FoodData Central"), "Sources must cite USDA FoodData Central");
  assert.ok(combinedText.includes("OpenFoodFacts"), "Sources must cite OpenFoodFacts");
  console.log("PASS [8/10] Nutritional & Recommendation Sources Catalog");
}

// Test 9: Daughter App-Open Check-In Popup & Mom's View Full-App Third-Person Rephrasing (Req 6 & 6a)
function testDaughterPopupAndMomThirdPersonCopy() {
  const state = createDefaultState();

  // Daughter's view ("Dancer")
  state.viewerRole = "Dancer";
  const dancerCopy = getRoleCopy(state);
  assert.equal(dancerCopy.isMom, false);
  assert.equal(dancerCopy.showAppOpenCheckinPopup, true, "Dancer view must trigger app-open check-in popup");
  assert.equal(dancerCopy.symptomBarLabel, "I feel:");
  assert.equal(dancerCopy.dismissRescueLabel, "I feel steady now ✓");

  // Mom's view ("Mom") — never uses first-person "I", uses "The Dancer" / "they" / "their"
  state.viewerRole = "Mom";
  const momCopy = getRoleCopy(state);
  assert.equal(momCopy.isMom, true);
  assert.equal(momCopy.showAppOpenCheckinPopup, false);
  assert.equal(momCopy.symptomBarLabel, "The Dancer feels:");
  assert.equal(momCopy.dismissRescueLabel, "The Dancer feels steady now ✓");
  assert.ok(momCopy.todayPlanHeading.includes("The Dancer's"));
  assert.ok(momCopy.bagHeading.includes("The Dancer's"));
  assert.ok(momCopy.notesLabel.includes("The Dancer's"));

  // Verify zero occurrences of standalone first-person pronoun "I" (excluding brand name "Liquid I.V.") across all Mom view strings
  const firstPersonRegex = /\bI(?!\.V\.)\b/;
  const checkNoFirstPerson = (val, label) => {
    if (typeof val === "string") {
      assert.ok(!firstPersonRegex.test(val), `Mom view string (${label}) must not contain first-person "I": "${val}"`);
    } else if (Array.isArray(val)) {
      val.forEach((item, idx) => checkNoFirstPerson(item, `${label}[${idx}]`));
    } else if (val && typeof val === "object") {
      for (const [k, v] of Object.entries(val)) {
        checkNoFirstPerson(v, `${label}.${k}`);
      }
    }
  };
  checkNoFirstPerson(momCopy, "momCopy");

  console.log("PASS [9/10] Daughter App-Open Popup & Mom's Full-App Third-Person Rephrasing");
}

// Test 10: HTML DOM Structure & CSS Theme Wiring Check
function testDomAndHtmlWiring() {
  const html = fs.readFileSync(path.join(REPO_ROOT, "index.html"), "utf8");
  const css = fs.readFileSync(path.join(REPO_ROOT, "styles.css"), "utf8");

  const requiredIds = [
    "openHelpBtn",
    "helpModal",
    "helpSmsForm",
    "adminModal",
    "adminPinForm",
    "adminScriptUrlInput",
    "adminGoogleAuthSection",
    "dancerCheckinModal",
    "sourcesModal",
    "nutritionSourcesList",
    "pastLogModal",
    "pastLogForm",
    "scheduleEventModal",
    "scheduleEventForm",
    "bandSyncModal",
    "calMonthContainer",
    "calMonthGrid",
    "calWeekContainer",
    "calWeekGrid",
    "calDayContainer",
    "calDayTimeline",
    "selectedDayScheduleCard",
    "scheduleCarpoolSubsection",
    "editSchoolToDriver",
    "editSchoolHomeDriver",
    "profGender",
    "openSettingsBtn",
    "settingsModal",
    "settingAvatar",
    "settingStudioName",
    "shuffleMottoBtn",
    "quickAddWaterBtn",
    "quickAddSaltBtn",
    "quickAddSnackBtn",
    "todayNextClassCard",
    "fuelRingProgress",
    "todayDailyScoreBadge",
    "googleSignInMount"
  ];

  for (const id of requiredIds) {
    assert.ok(html.includes(`id="${id}"`), `index.html missing required element id="${id}"`);
  }

  for (const navTab of ["today", "food", "carpool", "history"]) {
    assert.ok(html.includes(`data-nav-tab="${navTab}"`), `index.html missing 4-tab bottom-nav data-nav-tab="${navTab}"`);
  }

  for (const calView of ["month", "week", "day"]) {
    assert.ok(html.includes(`data-cal-view="${calView}"`), `index.html missing data-cal-view="${calView}"`);
  }

  // Negative assertion: Feels card (#symptomBarGroup) must NOT contain Day/Night/Auto pills
  const symptomStart = html.indexOf('id="symptomBarGroup"');
  const symptomEnd = html.indexOf('id="rescueBanner"', symptomStart);
  assert.ok(symptomStart > 0 && symptomEnd > symptomStart, "symptomBarGroup block must exist");
  const symptomBlock = html.slice(symptomStart, symptomEnd);
  assert.ok(
    !/data-setting-lighting|>Day<|>Night<|>Auto</i.test(symptomBlock),
    "Feels card (#symptomBarGroup) must NOT contain any Day/Night/Auto lighting pill"
  );

  // Legacy data-theme fallbacks + Feature #7 4-palette Day/Night rules
  for (const theme of ["studio_teal", "ballet_slipper", "lavender_adagio", "competition_gold", "late_rehearsal"]) {
    assert.ok(css.includes(`data-theme="${theme}"`), `styles.css missing legacy theme fallback for ${theme}`);
  }
  for (const pal of ["blush", "sage", "lavender", "teal"]) {
    assert.ok(css.includes(`data-palette="${pal}"][data-lighting="day"]`), `styles.css missing day palette ${pal}`);
    assert.ok(css.includes(`data-palette="${pal}"][data-lighting="night"]`), `styles.css missing night palette ${pal}`);
  }
  assert.ok(
    /\[data-lighting="night"\][\s\S]*--warning-soft:[\s\S]*--danger-soft:/.test(css),
    'styles.css [data-lighting="night"] must define dark-friendly --warning-soft and --danger-soft'
  );

  const appJs = fs.readFileSync(path.join(REPO_ROOT, "app.js"), "utf8");
  const todayViewStart = appJs.indexOf("function renderTodayView()");
  const todayViewBlock = appJs.slice(todayViewStart, todayViewStart + 1200);
  assert.ok(
    todayViewBlock.includes("renderSmartMotto()"),
    "renderTodayView() must call renderSmartMotto() so #studioBannerMotto updates live on symptom/history/schedule changes"
  );

  console.log("PASS [10/12] HTML DOM Structure, 4-Tab Nav, Separated Settings & Soft Wellness Palettes");
}

// Test 11: Feature #7 Independent Per-Role Settings, Auto Lighting, Smart Motto & Today Helpers
function testFeature7PerRoleSettingsSmartMottoAndToday() {
  const state = createDefaultState();

  // 1. Independent per-role defaults & isolation
  const dancerDef = getRolePersonalization(state, "Dancer");
  const momDef = getRolePersonalization(state, "Mom");
  assert.equal(dancerDef.lighting, "day");
  assert.equal(dancerDef.palette, "blush");
  assert.equal(dancerDef.avatar, "🩰");
  assert.equal(momDef.lighting, "auto");
  assert.equal(momDef.autoRule, "time");
  assert.equal(momDef.palette, "teal");
  assert.equal(momDef.avatar, "👩");

  // Mutating Dancer must not affect Mom
  state.personalization.byRole.Dancer.lighting = "night";
  state.personalization.byRole.Dancer.palette = "lavender";
  assert.equal(getRolePersonalization(state, "Mom").lighting, "auto");
  assert.equal(getRolePersonalization(state, "Mom").palette, "teal");

  // 2. resolveEffectiveLighting
  assert.equal(resolveEffectiveLighting({ lighting: "day" }, { systemDark: true, hour: 22 }), "day");
  assert.equal(resolveEffectiveLighting({ lighting: "night" }, { systemDark: false, hour: 12 }), "night");
  assert.equal(resolveEffectiveLighting({ lighting: "auto", autoRule: "system" }, { systemDark: true, hour: 12 }), "night");
  assert.equal(resolveEffectiveLighting({ lighting: "auto", autoRule: "system" }, { systemDark: false, hour: 22 }), "day");
  assert.equal(resolveEffectiveLighting({ lighting: "auto", autoRule: "time" }, { systemDark: false, hour: 19 }), "night");
  assert.equal(resolveEffectiveLighting({ lighting: "auto", autoRule: "time" }, { systemDark: false, hour: 6 }), "night");
  assert.equal(resolveEffectiveLighting({ lighting: "auto", autoRule: "time" }, { systemDark: true, hour: 7 }), "day");
  assert.equal(resolveEffectiveLighting({ lighting: "auto", autoRule: "time" }, { systemDark: true, hour: 18 }), "day");

  // 3. Smart Motivational Motto (Feels + History + Schedule + Shuffle + Mom 3rd-person zero-"I")
  state.history = [{ date: "2020-01-01", score: 92, sodiumMg: 3600, waterOz: 85 }];
  state.viewerRole = "Dancer";
  state.symptomStatus = "steady";
  const dMotto0 = getSmartMotto(state, { index: 0, dateStr: "2026-05-11" }); // Mon
  const dMotto1 = getSmartMotto(state, { index: 1, dateStr: "2026-05-11" });
  assert.notEqual(dMotto0, dMotto1, "Motto shuffle index must cycle mottos");
  assert.ok(/\byou/i.test(dMotto0), "Dancer motto should use 2nd-person phrasing");

  const firstPersonRegex = /\bI(?!\.V\.)\b/;
  state.viewerRole = "Mom";
  for (const feel of ["steady", "dizzy", "tired", "stomach"]) {
    state.symptomStatus = feel;
    for (let idx = 0; idx < 3; idx++) {
      const m = getSmartMotto(state, { index: idx, dateStr: "2026-05-11" });
      assert.ok(m.includes("The Dancer"), `Mom motto (${feel}#${idx}) must reference The Dancer: "${m}"`);
      assert.ok(!firstPersonRegex.test(m), `Mom motto (${feel}#${idx}) must NOT contain standalone "I": "${m}"`);
    }
  }

  // 4. Concentric rings & Next Class + Carpool helper
  const rings = computeConcentricRingData({ sodiumMg: 1800, waterOz: 42.5, totalKcal: 1000 }, { sodium: 3600, water: 85, calories: 2000 });
  assert.equal(rings.sodiumPct, 50);
  assert.equal(rings.waterPct, 50);
  assert.equal(rings.fuelPct, 50);

  state.carpool.Mon.homeDriver = "Dad";
  state.carpool.Mon.homeTime = "8:30 PM";
  const nextMon = getTodayNextClassAndCarpool(state, "2026-05-11"); // Monday
  assert.equal(nextMon.hasDance, true);
  assert.ok(nextMon.carpoolSummary.includes("Dad"));
  const nextSun = getTodayNextClassAndCarpool(state, "2026-05-10"); // Sunday (rest)
  assert.equal(nextSun.danceHours, 0);

  console.log("PASS [11/12] Feature #7 Per-Role Settings, Auto Lighting, Smart Motto & Today Helpers");
}

// Test 12: Deployment & Go-Live Verification Agent Contract
function testDeployVerifierContract() {
  const agentsPath = path.join(REPO_ROOT, "AGENTS.md");
  const skillPath = path.join(REPO_ROOT, ".agents", "skills", "deploy-go-live", "SKILL.md");
  assert.ok(fs.existsSync(agentsPath), "AGENTS.md must exist");
  assert.ok(fs.existsSync(skillPath), ".agents/skills/deploy-go-live/SKILL.md must exist");

  const agentsDoc = fs.readFileSync(agentsPath, "utf8");
  const skillDoc = fs.readFileSync(skillPath, "utf8");
  assert.ok(agentsDoc.includes("deploy-verifier"), "AGENTS.md must define deploy-verifier");
  assert.ok(/confirm to go live/i.test(agentsDoc), "AGENTS.md must define Confirm to Go Live gate");
  assert.ok(skillDoc.includes("deploy-go-live"), "SKILL.md must define deploy-go-live");
  assert.ok(/confirm[- ]to[- ]go[- ]live/i.test(skillDoc), "SKILL.md must define confirm-to-go-live gate");

  const appJs = fs.readFileSync(path.join(REPO_ROOT, "app.js"), "utf8");
  assert.ok(
    appJs.includes('register("./sw.js", { updateViaCache: "none" })'),
    'app.js must register "./sw.js" with { updateViaCache: "none" }'
  );

  const swSource = fs.readFileSync(path.join(REPO_ROOT, "sw.js"), "utf8");
  const swConfig = parseSwConfig(swSource);
  const shellCheck = verifyAppShellFilesExist(REPO_ROOT, swConfig.appShell);
  assert.equal(shellCheck.ok, true, `Missing APP_SHELL files on disk: ${shellCheck.missing.join(", ")}`);

  const sha = "1111222233334444555566667777888899990000";
  const okVerdict = evaluateGoLiveReadiness({
    git: { clean: true, headSha: sha, remoteSha: sha },
    pages: { siteStatus: "built", buildStatus: "built", deploymentState: "success", commitSha: sha, errorMessage: null },
    localSw: { cacheName: swConfig.cacheName },
    liveSw: { cacheName: swConfig.cacheName },
    assets: [{ entry: "./app.js", status: 200, localSha256: "abc", liveSha256: "abc" }],
    browser: { skipped: true, ok: true }
  });
  assert.equal(okVerdict.status, "GO_LIVE_CONFIRMED");

  const staleVerdict = evaluateGoLiveReadiness({
    git: { clean: true, headSha: sha, remoteSha: sha },
    pages: { siteStatus: "built", buildStatus: "built", deploymentState: "success", commitSha: sha, errorMessage: null },
    localSw: { cacheName: swConfig.cacheName },
    liveSw: { cacheName: "en-pointe-steady-v1" },
    assets: [{ entry: "./app.js", status: 200, localSha256: "abc", liveSha256: "abc" }],
    browser: { skipped: true, ok: true }
  });
  assert.equal(staleVerdict.status, "GO_LIVE_BLOCKED");

  const httpErrVerdict = evaluateGoLiveReadiness({
    git: { clean: true, headSha: sha, remoteSha: sha },
    pages: { siteStatus: "built", buildStatus: "built", deploymentState: "success", commitSha: sha, errorMessage: null },
    localSw: { cacheName: swConfig.cacheName },
    liveSw: { cacheName: swConfig.cacheName },
    assets: [{ entry: "./app.js", status: 404, localSha256: "abc", liveSha256: "" }],
    browser: { skipped: true, ok: true }
  });
  assert.equal(httpErrVerdict.status, "GO_LIVE_BLOCKED");

  const unpushedVerdict = evaluateGoLiveReadiness({
    git: { clean: true, headSha: sha, remoteSha: "other" },
    pages: { siteStatus: "built", buildStatus: "errored", commitSha: "other", errorMessage: "failed" },
    localSw: { cacheName: swConfig.cacheName },
    liveSw: { cacheName: swConfig.cacheName },
    assets: [{ entry: "./app.js", status: 200, localSha256: "abc", liveSha256: "abc" }],
    browser: { skipped: true, ok: true }
  });
  assert.equal(unpushedVerdict.status, "GO_LIVE_BLOCKED");

  // Regression checks for fail-closed Pages status gates
  const basePagesOk = {
    git: { clean: true, headSha: sha, remoteSha: sha },
    pages: { siteStatus: "built", buildStatus: "built", deploymentState: "success", commitSha: sha, errorMessage: null },
    localSw: { cacheName: swConfig.cacheName },
    liveSw: { cacheName: swConfig.cacheName },
    assets: [{ entry: "./app.js", status: 200, localSha256: "abc", liveSha256: "abc" }],
    browser: { skipped: true, ok: true }
  };
  assert.equal(
    evaluateGoLiveReadiness({ ...basePagesOk, pages: { ...basePagesOk.pages, siteStatus: "building" } }).status,
    "GO_LIVE_BLOCKED"
  );
  assert.equal(
    evaluateGoLiveReadiness({ ...basePagesOk, pages: { ...basePagesOk.pages, siteStatus: "errored" } }).status,
    "GO_LIVE_BLOCKED"
  );
  assert.equal(
    evaluateGoLiveReadiness({
      ...basePagesOk,
      pages: { siteStatus: "built", buildStatus: "errored", deploymentState: "success", commitSha: sha, errorMessage: null }
    }).status,
    "GO_LIVE_BLOCKED"
  );

  // Regression checks for APP_SHELL path confinement and query/hash stripping
  assert.equal(verifyAppShellFilesExist(REPO_ROOT, ["../outside.txt"]).ok, false);
  assert.equal(verifyAppShellFilesExist(REPO_ROOT, ["./app.js?v=1"]).ok, true);

  // Regression checks for parseSwConfig without semicolons and with comments
  const parsedEdge = parseSwConfig(
    'const CACHE_NAME = "v99"\nconst APP_SHELL = [\n  "./",\n  // "ignored.js",\n  /* "also-ignored.js", */\n  "./app.js"\n]\n'
  );
  assert.equal(parsedEdge.cacheName, "v99");
  assert.deepEqual(parsedEdge.appShell, ["./", "./app.js"]);

  console.log("PASS [12/13] Deployment & Go-Live Verification Agent Contract");
}

// Test 13: Apps Script Target Check
function testAppsScriptTarget(gsPath) {
  if (!gsPath) {
    console.log("SKIP [13/13] Apps Script Target Check (no --gs-path provided)");
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
  console.log("PASS [13/13] Apps Script Target Check");
}

const args = parseArgs(process.argv);
testZeroPii();
testPotsAndGallbladderMath();
testHistoryAndDoctorReport();
await testWebCryptoRoundTrip();
testDailyUsabilityHelpers();
testScheduleAndBandSync();
testNonTechManualHelpAdminAndGooglePrep();
testNutritionalSources();
testDaughterPopupAndMomThirdPersonCopy();
testDomAndHtmlWiring();
testFeature7PerRoleSettingsSmartMottoAndToday();
testDeployVerifierContract();
testAppsScriptTarget(args.gsPath);
console.log("ALL_VERIFY_APP_CHECKS_PASSED");
