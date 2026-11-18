/**
 * history.js — Daily Snapshot Archiving, Trend & Symptom Correlation, CSV & Doctor Report
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
 * Upsert today's snapshot into state.history and return the sorted history array.
 */
export function snapshotToday(state, targets, dateStr = getLocalDateString()) {
  const totals = computeDailyTotals(state, targets);
  const entry = {
    date: dateStr,
    dayMode: state?.dayMode || "school_dance",
    sodiumMg: totals.sodiumMg,
    sodiumTarget: targets?.sodium || 3600,
    waterOz: totals.waterOz,
    waterTarget: targets?.water || 85,
    maxMealFat: parseFloat((totals.maxMealFatSeen || 0).toFixed(1)),
    totalFatG: totals.totalFatG,
    gbCompliant: totals.gbCompliant,
    symptomStatus: state?.symptomStatus || "steady",
    notes: state?.dailyNotes || ""
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
 * Compute averages, GB compliance %, symptom counts, and hydration/sodium correlation.
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
    "Notes"
  ];
  const rows = [headers.map(escapeCsvCell).join(",")];

  for (const e of entries || []) {
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
      e.notes || ""
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

  const rowsHtml = entries.length
    ? entries
        .map(
          (e) => `
      <tr>
        <td>${escapeHtml(e.date)}</td>
        <td>${escapeHtml(e.dayMode)}</td>
        <td>${e.sodiumMg} / ${e.sodiumTarget} mg</td>
        <td>${e.waterOz} / ${e.waterTarget} oz</td>
        <td>${e.maxMealFat}g (${e.gbCompliant !== false ? "Safe" : "Exceeded"})</td>
        <td>${escapeHtml(e.symptomStatus || "steady")}</td>
        <td>${escapeHtml(e.notes || "—")}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="7" style="text-align:center;color:#64748b;">No daily history snapshots recorded in this range yet.</td></tr>`;

  return `
    <div class="doctor-report-doc">
      <div class="dr-header">
        <div>
          <h1>En Pointe &amp; Steady — Clinical POTS &amp; Gallbladder Summary</h1>
          <p class="dr-sub">Report Period: ${escapeHtml(rangeLabel)} • Generated: ${escapeHtml(generatedDate)}</p>
        </div>
        <div class="dr-badge">
          <strong>Patient:</strong> ${escapeHtml(p.name || "Dancer")} (Age ${escapeHtml(p.age ?? "—")})<br>
          <strong>Metrics:</strong> ${escapeHtml(p.weightLbs ?? "—")} lbs • ${escapeHtml(p.heightFt ?? "—")}'${escapeHtml(p.heightIn ?? "0")}" • ${escapeHtml(p.danceHours ?? "—")} hrs/day dance
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

      <h3>Daily Nutrition &amp; Symptom Log</h3>
      <table class="dr-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Mode</th>
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
    </div>
  `;
}
