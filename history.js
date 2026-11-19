/**
 * history.js — Daily Snapshot Archiving, Daily Target Scoring, Past Day Logging,
 * Trend & Symptom Correlation, CSV & Doctor Report
 * Zero PII: Operates purely on encrypted/in-memory state passed in by app.js or tests.
 */

export function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Compute today's nutrition & safety totals from active schedule slots + bonuses.
 */
export function computeDailyTotals(state, targets) {
  const slots = state?.schedules?.[state.dayMode] || [];
  const checked = state?.checkedSlots || {};
  const selected = state?.selectedOptionIdx || {};
  const portionMult = targets?.portionMultiplier || 1;
  const maxMealFatCap = targets?.maxMealFat || 5.5;

  let sodiumMg = Number(state?.bonusSodium) || 0;
  let waterOz = Number(state?.bonusWater) || 0;
  let totalFatG = 0;
  let totalKcal = 0;
  let maxMealFatSeen = 0;
  let checkedCount = 0;

  slots.forEach((slot) => {
    if (!checked[slot.id]) return;
    checkedCount += 1;
    const opts = slot.options || [];
    const idx = selected[slot.id] || 0;
    const opt = opts[idx] || opts[0];
    if (!opt) return;

    sodiumMg += Number(opt.sodium) || 0;
    waterOz += Number(opt.water) || 0;
    const fat = Number(opt.fat) || 0;
    totalFatG += fat;
    if (fat > maxMealFatSeen) maxMealFatSeen = fat;
    totalKcal += Math.round((Number(opt.kcal) || 220) * portionMult);
  });

  totalFatG = parseFloat(totalFatG.toFixed(1));
  const gbCompliant = maxMealFatSeen <= maxMealFatCap;

  return {
    sodiumMg: Math.round(sodiumMg),
    waterOz: Math.round(waterOz),
    totalFatG,
    totalKcal,
    maxMealFatSeen,
    gbCompliant,
    checkedCount,
    totalSlots: slots.length
  };
}

/**
 * Compute a deterministic 0–100% Daily Target Score, goals hit count (out of 3 core goals),
 * and color tier ("high" Green >= 80%, "medium" Amber 50–79%, "low" Red < 50%)
 * indicating most goals hit vs not.
 */
export function computeDailyScore(entryOrTotals = {}, targetsFallback = {}) {
  const e = entryOrTotals || {};
  const t = targetsFallback || {};

  const sodiumMg = Math.max(0, Number(e.sodiumMg) || 0);
  const sodiumTarget = Math.max(1, Number(e.sodiumTarget ?? t.sodium) || 3600);
  const waterOz = Math.max(0, Number(e.waterOz) || 0);
  const waterTarget = Math.max(1, Number(e.waterTarget ?? t.water) || 85);
  const maxMealFatCap = Number(e.maxMealFatCap ?? t.maxMealFat) || 5.5;
  const maxMealFatSeen = Number(e.maxMealFat ?? e.maxMealFatSeen) || 0;
  const gbCompliant =
    typeof e.gbCompliant === "boolean"
      ? e.gbCompliant
      : maxMealFatSeen <= maxMealFatCap;

  const hasLoggedIntake = sodiumMg > 0 || waterOz > 0 || (Number(e.checkedCount) || 0) > 0;
  if (!hasLoggedIntake) {
    return {
      score: 0,
      tier: "low",
      label: "No Intake Logged Yet",
      badgeClass: "badge-avoid",
      goalsHit: 0,
      totalGoals: 3,
      breakdown: {
        sodiumPct: 0,
        waterPct: 0,
        sodiumHit: false,
        waterHit: false,
        gbHit: false
      }
    };
  }

  const naRatio = Math.min(1, sodiumMg / sodiumTarget);
  const waterRatio = Math.min(1, waterOz / waterTarget);

  const sodiumPoints = naRatio * 40;
  const waterPoints = waterRatio * 40;
  let gbPoints = 0;
  if (gbCompliant) {
    gbPoints = 20;
  } else if (maxMealFatSeen <= maxMealFatCap + 2.5) {
    gbPoints = 10;
  }

  const score = Math.max(0, Math.min(100, Math.round(sodiumPoints + waterPoints + gbPoints)));

  const sodiumHit = sodiumMg >= Math.round(sodiumTarget * 0.85);
  const waterHit = waterOz >= Math.round(waterTarget * 0.85);
  const gbHit = gbCompliant;
  const goalsHit = (sodiumHit ? 1 : 0) + (waterHit ? 1 : 0) + (gbHit ? 1 : 0);
  const totalGoals = 3;

  let tier = "low";
  let label = "Needs Fuel • Few Goals Hit";
  let badgeClass = "badge-avoid";

  if (score >= 80 || goalsHit === 3) {
    tier = "high";
    label = "Most Goals Hit";
    badgeClass = "badge-safe";
  } else if (score >= 50 || goalsHit === 2) {
    tier = "medium";
    label = "Partial Goals Hit";
    badgeClass = "badge-caution";
  }

  return {
    score,
    tier,
    label,
    badgeClass,
    goalsHit,
    totalGoals,
    breakdown: {
      sodiumPct: Math.round(naRatio * 100),
      waterPct: Math.round(waterRatio * 100),
      sodiumHit,
      waterHit,
      gbHit
    }
  };
}

/**
 * Upsert today's snapshot into state.history and return the sorted history array.
 */
export function snapshotToday(state, targets, dateStr = getLocalDateString()) {
  const totals = computeDailyTotals(state, targets);
  const scoreInfo = computeDailyScore(totals, targets);
  const entry = {
    date: dateStr,
    dayMode: state?.dayMode || "school_dance",
    danceHours: Number(targets?.danceHours ?? state?.profile?.danceHours) || 0,
    sodiumMg: totals.sodiumMg,
    sodiumTarget: targets?.sodium || 3600,
    waterOz: totals.waterOz,
    waterTarget: targets?.water || 85,
    maxMealFat: parseFloat((totals.maxMealFatSeen || 0).toFixed(1)),
    totalFatG: totals.totalFatG,
    totalKcal: totals.totalKcal,
    caloriesTarget: targets?.calories || 2000,
    gbCompliant: totals.gbCompliant,
    symptomStatus: state?.symptomStatus || "steady",
    notes: state?.dailyNotes || "",
    score: scoreInfo.score,
    scoreTier: scoreInfo.tier,
    goalsHit: scoreInfo.goalsHit,
    totalGoals: scoreInfo.totalGoals
  };

  const existing = Array.isArray(state?.history) ? [...state.history] : [];
  const idx = existing.findIndex((h) => h.date === dateStr);
  if (idx >= 0) {
    existing[idx] = entry;
  } else {
    existing.push(entry);
  }

  existing.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { history: existing, entry };
}

/**
 * Upsert or edit a past/missed day record in history (Requirement 5).
 */
export function upsertPastHistoryEntry(historyList, pastInput = {}, targets = {}) {
  const dateStr = String(pastInput.date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error("A valid YYYY-MM-DD date is required to log a past day.");
  }

  const sodiumTarget = Math.max(500, Math.round(Number(pastInput.sodiumTarget ?? targets.sodium) || 3600));
  const waterTarget = Math.max(16, Math.round(Number(pastInput.waterTarget ?? targets.water) || 85));
  const maxMealFatCap = Number(pastInput.maxMealFatCap ?? targets.maxMealFat) || 5.5;

  const sodiumMg = Math.max(0, Math.round(Number(pastInput.sodiumMg) || 0));
  const waterOz = Math.max(0, Math.round(Number(pastInput.waterOz) || 0));
  const maxMealFat = parseFloat(Math.max(0, Number(pastInput.maxMealFat) || 0).toFixed(1));
  const totalFatG = parseFloat(
    Math.max(maxMealFat, Number(pastInput.totalFatG ?? maxMealFat * 3) || 0).toFixed(1)
  );
  const gbCompliant =
    typeof pastInput.gbCompliant === "boolean"
      ? pastInput.gbCompliant
      : maxMealFat <= maxMealFatCap;

  const rawSymptom = String(pastInput.symptomStatus || "steady").toLowerCase();
  const symptomStatus = ["steady", "dizzy", "tired", "stomach"].includes(rawSymptom)
    ? rawSymptom
    : "steady";

  const scoreInfo = computeDailyScore(
    {
      sodiumMg,
      sodiumTarget,
      waterOz,
      waterTarget,
      maxMealFat,
      maxMealFatCap,
      gbCompliant
    },
    targets
  );

  const entry = {
    date: dateStr,
    dayMode: pastInput.dayMode || "school_dance",
    danceHours: Number(pastInput.danceHours ?? targets.danceHours ?? 0) || 0,
    sodiumMg,
    sodiumTarget,
    waterOz,
    waterTarget,
    maxMealFat,
    totalFatG,
    totalKcal: Math.round(Number(pastInput.totalKcal ?? targets.calories) || 0),
    caloriesTarget: Math.round(Number(pastInput.caloriesTarget ?? targets.calories) || 2000),
    gbCompliant,
    symptomStatus,
    notes: String(pastInput.notes || "").trim(),
    score: scoreInfo.score,
    scoreTier: scoreInfo.tier,
    goalsHit: scoreInfo.goalsHit,
    totalGoals: scoreInfo.totalGoals,
    isBackdated: true
  };

  const list = Array.isArray(historyList) ? [...historyList] : [];
  const idx = list.findIndex((h) => h.date === dateStr);
  if (idx >= 0) {
    list[idx] = entry;
  } else {
    list.push(entry);
  }
  list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { history: list, entry, scoreInfo };
}

/**
 * Filter history entries by range: "7d", "30d", or "all".
 */
export function filterHistory(history, range = "7d", referenceDate = new Date()) {
  const list = Array.isArray(history) ? [...history] : [];
  list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  if (range === "all") return list;

  const days = range === "30d" ? 30 : 7;
  const cutoff = new Date(referenceDate);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const cutoffStr = getLocalDateString(cutoff);

  return list.filter((item) => item.date >= cutoffStr);
}

/**
 * Compute averages, GB compliance %, target scores, symptom counts, and hydration/sodium correlation.
 */
export function computeHistoryStats(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const count = list.length;

  const symptomCounts = { steady: 0, dizzy: 0, tired: 0, stomach: 0 };

  if (count === 0) {
    return {
      count: 0,
      avgSodium: 0,
      avgWater: 0,
      avgFat: 0,
      avgScore: 0,
      highScoreDays: 0,
      mediumScoreDays: 0,
      lowScoreDays: 0,
      gbCompliancePct: 100,
      symptomCounts,
      symptomFreeCount: 0,
      symptomCorrelation: {
        steadyAvgSodium: 0,
        steadyAvgWater: 0,
        symptomaticAvgSodium: 0,
        symptomaticAvgWater: 0,
        steadyDays: 0,
        symptomaticDays: 0
      }
    };
  }

  let sumSodium = 0;
  let sumWater = 0;
  let sumFat = 0;
  let sumScore = 0;
  let highScoreDays = 0;
  let mediumScoreDays = 0;
  let lowScoreDays = 0;
  let gbCompliantDays = 0;

  let steadySodium = 0;
  let steadyWater = 0;
  let steadyDays = 0;

  let sympSodium = 0;
  let sympWater = 0;
  let symptomaticDays = 0;

  for (const item of list) {
    const na = Number(item.sodiumMg) || 0;
    const oz = Number(item.waterOz) || 0;
    const fat = Number(item.totalFatG) || 0;
    sumSodium += na;
    sumWater += oz;
    sumFat += fat;
    if (item.gbCompliant !== false) gbCompliantDays += 1;

    const scoreInfo = computeDailyScore(item);
    const entryScore = typeof item.score === "number" ? item.score : scoreInfo.score;
    const entryTier = item.scoreTier || scoreInfo.tier;
    sumScore += entryScore;
    if (entryTier === "high") highScoreDays += 1;
    else if (entryTier === "medium") mediumScoreDays += 1;
    else lowScoreDays += 1;

    const rawStatus = item.symptomStatus || "steady";
    const status = Object.prototype.hasOwnProperty.call(symptomCounts, rawStatus) ? rawStatus : "steady";
    symptomCounts[status] += 1;

    if (status === "steady") {
      steadyDays += 1;
      steadySodium += na;
      steadyWater += oz;
    } else {
      symptomaticDays += 1;
      sympSodium += na;
      sympWater += oz;
    }
  }

  return {
    count,
    avgSodium: Math.round(sumSodium / count),
    avgWater: Math.round(sumWater / count),
    avgFat: parseFloat((sumFat / count).toFixed(1)),
    avgScore: Math.round(sumScore / count),
    highScoreDays,
    mediumScoreDays,
    lowScoreDays,
    gbCompliancePct: Math.round((gbCompliantDays / count) * 100),
    symptomCounts,
    symptomFreeCount: symptomCounts.steady,
    symptomCorrelation: {
      steadyAvgSodium: steadyDays ? Math.round(steadySodium / steadyDays) : 0,
      steadyAvgWater: steadyDays ? Math.round(steadyWater / steadyDays) : 0,
      symptomaticAvgSodium: symptomaticDays ? Math.round(sympSodium / symptomaticDays) : 0,
      symptomaticAvgWater: symptomaticDays ? Math.round(sympWater / symptomaticDays) : 0,
      steadyDays,
      symptomaticDays
    }
  };
}

function escapeCsvCell(val) {
  let s = val == null ? "" : String(val);
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Generate RFC-4180 compliant CSV string for history entries.
 * Appends Target Score (%) and Goals Hit at the end of headers so `Date,Day Mode,Sodium (mg)` prefix stays identical.
 */
export function generateHistoryCsv(entries) {
  const headers = [
    "Date",
    "Day Mode",
    "Sodium (mg)",
    "Sodium Target (mg)",
    "Water (oz)",
    "Water Target (oz)",
    "Max Meal Fat (g)",
    "Total Daily Fat (g)",
    "GB Compliant",
    "Symptom Status",
    "Notes",
    "Target Score (%)",
    "Goals Hit"
  ];
  const rows = [headers.map(escapeCsvCell).join(",")];

  for (const e of entries || []) {
    const scoreInfo = computeDailyScore(e);
    const scoreVal = typeof e.score === "number" ? e.score : scoreInfo.score;
    const goalsHitVal = `${e.goalsHit ?? scoreInfo.goalsHit}/${e.totalGoals ?? scoreInfo.totalGoals}`;
    const row = [
      e.date || "",
      e.dayMode || "",
      e.sodiumMg ?? 0,
      e.sodiumTarget ?? 0,
      e.waterOz ?? 0,
      e.waterTarget ?? 0,
      e.maxMealFat ?? 0,
      e.totalFatG ?? 0,
      e.gbCompliant !== false ? "Yes" : "No",
      e.symptomStatus || "steady",
      e.notes || "",
      scoreVal,
      goalsHitVal
    ];
    rows.push(row.map(escapeCsvCell).join(","));
  }

  return rows.join("\r\n");
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Render clinical 1-2 page Doctor Report HTML for #printable-doctor-report.
 */
export function renderDoctorReportHtml(state, targets, range = "30d") {
  const p = state?.profile || {};
  const entries = filterHistory(state?.history || [], range);
  const stats = computeHistoryStats(entries);
  const rangeLabel = range === "7d" ? "Last 7 Days" : range === "30d" ? "Last 30 Days" : "All Recorded Days";
  const generatedDate = getLocalDateString();
  const genderLabel = (p.gender || "female") === "male" ? "Male" : "Female";

  const rowsHtml = entries.length
    ? entries
        .map((e) => {
          const sc = computeDailyScore(e, targets);
          const scoreVal = typeof e.score === "number" ? e.score : sc.score;
          const goalsHit = e.goalsHit ?? sc.goalsHit;
          const totalGoals = e.totalGoals ?? sc.totalGoals;
          return `
      <tr>
        <td>${escapeHtml(e.date)}</td>
        <td>${escapeHtml(e.dayMode)}</td>
        <td><strong>${scoreVal}%</strong> (${goalsHit}/${totalGoals})</td>
        <td>${e.sodiumMg} / ${e.sodiumTarget} mg</td>
        <td>${e.waterOz} / ${e.waterTarget} oz</td>
        <td>${e.maxMealFat}g (${e.gbCompliant !== false ? "Safe" : "Exceeded"})</td>
        <td>${escapeHtml(e.symptomStatus || "steady")}</td>
        <td>${escapeHtml(e.notes || "—")}</td>
      </tr>`;
        })
        .join("")
    : `<tr><td colspan="8" style="text-align:center;color:#64748b;">No daily history snapshots recorded in this range yet.</td></tr>`;

  return `
    <div class="doctor-report-doc">
      <div class="dr-header">
        <div>
          <h1>En Pointe &amp; Steady — Clinical POTS &amp; Gallbladder Summary</h1>
          <p class="dr-sub">Report Period: ${escapeHtml(rangeLabel)} • Generated: ${escapeHtml(generatedDate)}</p>
        </div>
        <div class="dr-badge">
          <strong>Patient:</strong> ${escapeHtml(p.name || "Dancer")} (${genderLabel}, Age ${escapeHtml(p.age ?? "—")})<br>
          <strong>Metrics:</strong> ${escapeHtml(p.weightLbs ?? "—")} lbs • ${escapeHtml(p.heightFt ?? "—")}'${escapeHtml(p.heightIn ?? "0")}" • Dynamic Schedule Activity
        </div>
      </div>

      <div class="dr-grid">
        <div class="dr-box">
          <h3>Active Daily Targets</h3>
          <p><strong>Sodium:</strong> ${targets?.sodium || 3600} mg/day</p>
          <p><strong>Hydration:</strong> ${targets?.water || 85} oz/day</p>
          <p><strong>Gallbladder Cap:</strong> &le; ${targets?.maxMealFat || 5.5}g fat/meal (${targets?.dailyFatCap || 33}g/day)</p>
          <p><strong>Energy Target:</strong> ~${targets?.calories || 2000} kcal/day</p>
        </div>
        <div class="dr-box">
          <h3>Period Averages (${stats.count} Days)</h3>
          <p><strong>Avg Target Score:</strong> ${stats.avgScore}% (${stats.highScoreDays} green / ${stats.count} days)</p>
          <p><strong>Avg Sodium:</strong> ${stats.avgSodium} mg/day</p>
          <p><strong>Avg Hydration:</strong> ${stats.avgWater} oz/day</p>
          <p><strong>GB Fat-Cap Compliance:</strong> ${stats.gbCompliancePct}% of days</p>
          <p><strong>Symptom-Free ("Steady"):</strong> ${stats.symptomFreeCount} / ${stats.count} days</p>
        </div>
        <div class="dr-box">
          <h3>Symptom &amp; Hydration Correlation</h3>
          <p><strong>Steady Days (${stats.symptomCorrelation.steadyDays}):</strong> Avg ${stats.symptomCorrelation.steadyAvgSodium} mg Na • ${stats.symptomCorrelation.steadyAvgWater} oz</p>
          <p><strong>Symptomatic Days (${stats.symptomCorrelation.symptomaticDays}):</strong> Avg ${stats.symptomCorrelation.symptomaticAvgSodium} mg Na • ${stats.symptomCorrelation.symptomaticAvgWater} oz</p>
          <p><strong>Breakdown:</strong> Dizzy: ${stats.symptomCounts.dizzy} • Tired: ${stats.symptomCounts.tired} • Stomach: ${stats.symptomCounts.stomach}</p>
        </div>
      </div>

      <h3>Daily Nutrition, Target Score &amp; Symptom Log</h3>
      <table class="dr-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Mode</th>
            <th>Target Score</th>
            <th>Sodium</th>
            <th>Hydration</th>
            <th>Max Meal Fat</th>
            <th>Symptom</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="dr-box" style="margin-top:12px;">
        <h3>Clinical &amp; Nutritional Calculation Sources</h3>
        <p><strong>POTS Sodium &amp; Hydration:</strong> Dysautonomia International &amp; Heart Rhythm Society POTS Consensus (3,000–4,500+ mg/day base + studio sweat scaling).</p>
        <p><strong>Gallbladder Meal Fat Threshold:</strong> ACG / NIDDK low-fat biliary dietary guidelines (&le; 5.5g fat/meal Moderate, &le; 4.0g Strict, &le; 2.5g Flare).</p>
        <p><strong>Energy &amp; Activity Math:</strong> Mifflin-St Jeor BMR (${genderLabel}) + IADMS Dancer Nutrition &amp; Compendium of Physical Activities Dance METs.</p>
        <p><strong>Food Nutrient Databases:</strong> USDA FoodData Central, OpenFoodFacts, and verified brand nutrition facts panels.</p>
      </div>
    </div>
  `;
}
