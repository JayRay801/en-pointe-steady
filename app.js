/**
 * app.js — En Pointe & Steady (Calm Studio Wellness PWA)
 * Zero PII: Generic defaults only; family data is decrypted in-browser from Cloud_Sync_Store.
 * Exports pure helpers for Node testing; DOM initialization is guarded behind typeof document !== "undefined".
 */

import {
  DEFAULT_FOOD_LIBRARY,
  evaluateFoodSafety,
  estimateNutritionForQuery,
  lookupFoodOpenFoodFacts
} from "./foods.js";
import {
  encryptBundle,
  decryptBundle,
  pullFromCloud,
  pushToCloud,
  createDebouncedPush
} from "./crypto.js";
import {
  getLocalDateString,
  computeDailyTotals,
  snapshotToday,
  filterHistory,
  computeHistoryStats,
  generateHistoryCsv,
  renderDoctorReportHtml
} from "./history.js";

export const STORAGE_STATE_KEY = "epsteady_state_v2";
export const STORAGE_AUTH_KEY = "epsteady_device_auth_v2";

export const DEFAULT_BAG_ITEMS = [
  { id: "bag_1", text: "2x 24oz Insulated Bottles (pre-mixed with electrolyte packets)", tag: "POTS Essential" },
  { id: "bag_2", text: "2 Extra Electrolyte Stick Packs in side pocket", tag: "Emergency Salt" },
  { id: "bag_3", text: "Individual Salted Pretzel Pouches or Rice Rollers", tag: "Between Classes" },
  { id: "bag_4", text: "Insulated Food Thermos with Warm Low-Fat Soup", tag: "Evening Break" },
  { id: "bag_5", text: "2x Unsweetened Applesauce or Fruit Puree Squeeze Pouches", tag: "Quick Carbs" },
  { id: "bag_6", text: "Ice Pack + Lean Deli Turkey & Pickle Spears in cooler pouch", tag: "Lean Protein" },
  { id: "bag_7", text: "Late-Night Car-Ride Recovery Container (skip fast food)", tag: "Gallbladder Safe" },
  { id: "bag_8", text: "Compression Socks for car ride home after late rehearsal", tag: "POTS Recovery" }
];

export const RESCUE_PROTOCOLS = {
  steady: null,
  dizzy: {
    title: "2-Minute Studio Side-Line POTS Rescue Protocol",
    body: "1) Sit on the studio floor with knees pulled up or legs crossed. 2) Drink 8–12 oz cold electrolyte water or take a salt packet / 6 salted pretzels immediately. 3) Flex calf & thigh muscles before standing slowly."
  },
  tired: {
    title: "Quick Low-Fat Dance Energy Rescue",
    body: "Pair fast-absorbing carbs + sodium (applesauce pouch + salted pretzels or half banana + electrolyte drink). Avoid high-fat nuts or heavy protein bars during rehearsal."
  },
  stomach: {
    title: "Gentle Gallbladder Soothing Mode",
    body: "Keep fat near 0g–2g for the next two slots. Warm liquids (warm chicken broth, miso soup, or chamomile tea) + plain salted crackers or rice cakes relax the biliary tract while maintaining POTS sodium."
  }
};

export function createEmptyCarpool() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const obj = {};
  for (const d of days) {
    obj[d] = { toDriver: "", toTime: "", toNote: "", homeDriver: "", homeTime: "", homeNote: "" };
  }
  return obj;
}

export function createDefaultState() {
  return {
    viewerRole: "Dancer",
    dayOfWeek: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()] || "Mon",
    dayMode: "school_dance",
    activeTab: "today",
    historyRange: "7d",
    foodFilter: "all",
    profile: {
      name: "Dancer",
      age: 14,
      weightLbs: 110,
      heightFt: 5,
      heightIn: 2,
      danceHours: 2.0,
      potsLevel: "standard",
      gbLevel: "moderate",
      useDoctorOverride: false,
      customSodium: 4000,
      customWater: 85,
      customMealFat: 5.5,
      customCalories: 2000
    },
    schedules: {
      school_dance: [],
      competition: [],
      recovery: []
    },
    carpool: createEmptyCarpool(),
    foodLibrary: DEFAULT_FOOD_LIBRARY.map((item) => ({ ...item })),
    bagItems: DEFAULT_BAG_ITEMS.map((item) => ({ ...item })),
    bagChecked: {},
    checkedSlots: {},
    selectedOptionIdx: {},
    bonusSodium: 0,
    bonusWater: 0,
    symptomStatus: "steady",
    dailyNotes: "",
    lastActiveDate: getLocalDateString(),
    history: [],
    googleSheetWebAppUrl: ""
  };
}

/**
 * Pure POTS & Gallbladder daily target calculation.
 */
export function getCalculatedTargets(profile) {
  const p = profile || {};
  if (p.useDoctorOverride) {
    const calories = Number(p.customCalories) || 2150;
    const sodium = Number(p.customSodium) || 4000;
    const water = Number(p.customWater) || 96;
    const maxMealFat = Number(p.customMealFat) || 5.5;
    return {
      calories,
      sodium,
      water,
      maxMealFat,
      dailyFatCap: Math.round(maxMealFat * 6),
      portionMultiplier: calories / 2150
    };
  }

  const weightLbs = Number(p.weightLbs) || 110;
  const heightFt = Number(p.heightFt) || 5;
  const heightIn = Number(p.heightIn) || 2;
  const age = Number(p.age) || 14;
  const danceHours = Number(p.danceHours) || 0;

  const weightKg = weightLbs * 0.453592;
  const heightCm = (heightFt * 12 + heightIn) * 2.54;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  const danceBurn = weightKg * 4.2 * danceHours;
  const calories = Math.round(Math.max(1500, bmr * 1.35 + danceBurn));
  const water = Math.round(weightLbs * 0.62 + danceHours * 8);

  const baseSodium = p.potsLevel === "high" ? 4500 : p.potsLevel === "mild" ? 3000 : 3600;
  const sodium = Math.round(baseSodium + danceHours * 180);

  const maxMealFat = p.gbLevel === "flare" ? 2.5 : p.gbLevel === "strict" ? 4.0 : 5.5;
  const dailyFatCap = Math.round(maxMealFat * 6);
  const portionMultiplier = Math.max(0.65, Math.min(1.65, calories / 2150));

  return {
    calories,
    sodium,
    water,
    maxMealFat,
    dailyFatCap,
    portionMultiplier
  };
}

/**
 * Pure portion scaling label helper.
 */
export function formatScaledPortion(baseServing, targets, intensity = "moderate") {
  let mult = targets?.portionMultiplier || 1;
  if (intensity === "high") mult *= 1.1;

  let label = "1.0x Standard Portion";
  if (mult < 0.85) label = "0.75x Lighter Portion";
  else if (mult > 1.35) label = "1.5x High-Output Portion";
  else if (mult > 1.12) label = "1.25x Athlete Portion";

  return baseServing ? `${label} — ${baseServing}` : label;
}

// ============================================================================
// BROWSER RUNTIME CONTROLLER
// ============================================================================

if (typeof document !== "undefined") {
  let state = loadLocalState();
  let auth = loadDeviceAuth();
  let syncStatus = "offline"; // "synced" | "syncing" | "offline"
  const scheduleCloudPush = createDebouncedPush(1500);

  function loadLocalState() {
    const def = createDefaultState();
    try {
      const raw = localStorage.getItem(STORAGE_STATE_KEY);
      if (!raw) return def;
      const parsed = JSON.parse(raw);
      return mergeState(def, parsed);
    } catch (_e) {
      return def;
    }
  }

  function mergeState(base, incoming) {
    const merged = {
      ...base,
      ...incoming,
      profile: { ...base.profile, ...(incoming.profile || {}) },
      schedules: {
        school_dance: incoming.schedules?.school_dance || base.schedules.school_dance,
        competition: incoming.schedules?.competition || base.schedules.competition,
        recovery: incoming.schedules?.recovery || base.schedules.recovery
      },
      carpool: { ...base.carpool, ...(incoming.carpool || {}) },
      foodLibrary: Array.isArray(incoming.foodLibrary) && incoming.foodLibrary.length
        ? incoming.foodLibrary
        : base.foodLibrary,
      bagItems: Array.isArray(incoming.bagItems) && incoming.bagItems.length
        ? incoming.bagItems
        : base.bagItems,
      history: Array.isArray(incoming.history) ? incoming.history : []
    };
    return merged;
  }

  function loadDeviceAuth() {
    try {
      const raw = localStorage.getItem(STORAGE_AUTH_KEY);
      if (!raw) return { unlocked: false, passphrase: "", syncUrl: "", rememberDevice: true };
      return JSON.parse(raw);
    } catch (_e) {
      return { unlocked: false, passphrase: "", syncUrl: "", rememberDevice: true };
    }
  }

  function saveDeviceAuth(nextAuth) {
    auth = nextAuth;
    if (auth.rememberDevice && auth.unlocked) {
      localStorage.setItem(STORAGE_AUTH_KEY, JSON.stringify(auth));
    } else if (!auth.unlocked) {
      localStorage.removeItem(STORAGE_AUTH_KEY);
    }
  }

  function rolloverDayIfNeeded() {
    const today = getLocalDateString();
    if (state.lastActiveDate && state.lastActiveDate !== today) {
      // Snapshot previous day before resetting daily checkboxes
      const targets = getCalculatedTargets(state.profile);
      const { history } = snapshotToday(state, targets, state.lastActiveDate);
      state.history = history;
      state.checkedSlots = {};
      state.bonusSodium = 0;
      state.bonusWater = 0;
      state.symptomStatus = "steady";
      state.dailyNotes = "";
      state.lastActiveDate = today;
      state.dayOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()] || "Mon";
    }
  }

  function saveAndSync({ skipPush = false } = {}) {
    rolloverDayIfNeeded();
    const targets = getCalculatedTargets(state.profile);
    const { history } = snapshotToday(state, targets);
    state.history = history;
    try {
      localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(state));
    } catch (_e) {
      // Ignore storage quota issues
    }
    if (!skipPush && auth.unlocked && auth.passphrase && (state.googleSheetWebAppUrl || auth.syncUrl)) {
      const url = state.googleSheetWebAppUrl || auth.syncUrl;
      setSyncIndicator("syncing");
      scheduleCloudPush(async () => {
        try {
          const encrypted = await encryptBundle(buildSyncPayload(), auth.passphrase);
          const res = await pushToCloud(url, encrypted, state.viewerRole || "Dancer");
          setSyncIndicator(res.ok ? "synced" : "offline");
        } catch (_err) {
          setSyncIndicator("offline");
        }
      });
    }
  }

  function buildSyncPayload() {
    return {
      viewerRole: state.viewerRole,
      dayMode: state.dayMode,
      profile: state.profile,
      schedules: state.schedules,
      carpool: state.carpool,
      foodLibrary: state.foodLibrary,
      bagItems: state.bagItems,
      bagChecked: state.bagChecked,
      checkedSlots: state.checkedSlots,
      selectedOptionIdx: state.selectedOptionIdx,
      bonusSodium: state.bonusSodium,
      bonusWater: state.bonusWater,
      symptomStatus: state.symptomStatus,
      dailyNotes: state.dailyNotes,
      lastActiveDate: state.lastActiveDate,
      history: state.history
    };
  }

  function setSyncIndicator(status) {
    syncStatus = status;
    const dot = document.getElementById("syncStatusDot");
    const label = document.getElementById("syncStatusLabel");
    if (!dot || !label) return;
    dot.className = `sync-dot sync-${status}`;
    label.textContent = status === "synced" ? "Synced" : status === "syncing" ? "Syncing..." : "Offline";
  }

  async function silentPullFromCloud() {
    const url = state.googleSheetWebAppUrl || auth.syncUrl;
    if (!url || !auth.passphrase) {
      setSyncIndicator("offline");
      return false;
    }
    setSyncIndicator("syncing");
    const res = await pullFromCloud(url);
    if (!res.ok) {
      setSyncIndicator("offline");
      return false;
    }
    if (!res.payload) {
      setSyncIndicator("synced");
      return true;
    }
    try {
      const decrypted = await decryptBundle(res.payload, auth.passphrase);
      state = mergeState(createDefaultState(), { ...decrypted, googleSheetWebAppUrl: url });
      localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(state));
      setSyncIndicator("synced");
      renderAll();
      return true;
    } catch (_err) {
      setSyncIndicator("offline");
      return false;
    }
  }

  // ==========================================================================
  // RENDERING
  // ==========================================================================

  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderAll() {
    renderTopBar();
    renderViewVisibility();
    renderTodayView();
    renderFoodView();
    renderCarpoolView();
    renderHistoryView();
    renderGearModal();
  }

  function renderTopBar() {
    const greeting = document.getElementById("topBarSubtitle");
    if (greeting) {
      greeting.textContent = `${state.profile.name || "Dancer"} • ${state.viewerRole || "Dancer"}`;
    }
    document.querySelectorAll("[data-symptom-btn]").forEach((btn) => {
      const s = btn.getAttribute("data-symptom-btn");
      btn.classList.toggle("active", s === state.symptomStatus);
    });

    const banner = document.getElementById("rescueBanner");
    const proto = RESCUE_PROTOCOLS[state.symptomStatus];
    if (banner) {
      if (proto) {
        banner.classList.remove("hidden");
        banner.innerHTML = `
          <div class="rescue-banner-head">
            <strong>${esc(proto.title)}</strong>
            <button type="button" class="btn-text" id="dismissRescueBtn">I feel steady now ✓</button>
          </div>
          <p>${esc(proto.body)}</p>
        `;
        document.getElementById("dismissRescueBtn")?.addEventListener("click", () => {
          state.symptomStatus = "steady";
          saveAndSync();
          renderTopBar();
          renderTodayView();
        });
      } else {
        banner.classList.add("hidden");
        banner.innerHTML = "";
      }
    }
  }

  function renderViewVisibility() {
    const views = {
      today: document.getElementById("view-today"),
      food: document.getElementById("view-food"),
      carpool: document.getElementById("view-carpool"),
      history: document.getElementById("view-history")
    };
    Object.entries(views).forEach(([key, el]) => {
      if (el) el.classList.toggle("hidden", state.activeTab !== key);
    });

    document.querySelectorAll("[data-nav-tab]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-nav-tab") === state.activeTab);
    });
  }

  function setProgressRing(circleId, pct) {
    const circle = document.getElementById(circleId);
    if (!circle) return;
    const radius = 34;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.max(0, Math.min(100, pct));
    circle.style.strokeDasharray = `${circumference}`;
    circle.style.strokeDashoffset = `${circumference * (1 - clamped / 100)}`;
  }

  function renderTodayView() {
    const targets = getCalculatedTargets(state.profile);
    const totals = computeDailyTotals(state, targets);

    const naPct = Math.round((totals.sodiumMg / targets.sodium) * 100);
    const waterPct = Math.round((totals.waterOz / targets.water) * 100);
    setProgressRing("sodiumRingProgress", naPct);
    setProgressRing("waterRingProgress", waterPct);

    const naVal = document.getElementById("sodiumRingValue");
    const naSub = document.getElementById("sodiumRingTarget");
    if (naVal) naVal.textContent = `${totals.sodiumMg}`;
    if (naSub) naSub.textContent = `/ ${targets.sodium} mg`;

    const waVal = document.getElementById("waterRingValue");
    const waSub = document.getElementById("waterRingTarget");
    if (waVal) waVal.textContent = `${totals.waterOz}`;
    if (waSub) waSub.textContent = `/ ${targets.water} oz`;

    const gbStatus = document.getElementById("todayGbStatus");
    if (gbStatus) {
      gbStatus.className = `pill-badge ${totals.gbCompliant ? "badge-safe" : "badge-avoid"}`;
      gbStatus.textContent = totals.gbCompliant
        ? `✓ GB-Safe (≤ ${targets.maxMealFat}g/meal)`
        : `⚠️ Meal > ${targets.maxMealFat}g fat`;
    }

    document.querySelectorAll("[data-day-mode]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-day-mode") === state.dayMode);
    });

    // 7-Day History Overview Card
    const last7 = filterHistory(state.history, "7d");
    const stats7 = computeHistoryStats(last7);
    const dotsEl = document.getElementById("history7Dots");
    if (dotsEl) {
      const dots = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = getLocalDateString(d);
        const entry = last7.find((h) => h.date === ds);
        let cls = "dot-empty";
        let title = `${ds}: No log`;
        if (entry) {
          cls = entry.symptomStatus === "steady" && entry.gbCompliant !== false ? "dot-good" : "dot-warn";
          title = `${ds}: ${entry.sodiumMg}mg Na, ${entry.waterOz}oz, ${entry.symptomStatus}`;
        }
        dots.push(`<span class="history-dot ${cls}" title="${esc(title)}"></span>`);
      }
      dotsEl.innerHTML = dots.join("");
    }
    const avg7Na = document.getElementById("history7AvgNa");
    const avg7Water = document.getElementById("history7AvgWater");
    const steady7 = document.getElementById("history7Steady");
    if (avg7Na) avg7Na.textContent = `${stats7.avgSodium} mg`;
    if (avg7Water) avg7Water.textContent = `${stats7.avgWater} oz`;
    if (steady7) steady7.textContent = `${stats7.symptomFreeCount}/${stats7.count || 0} steady`;

    // Notes
    const notesEl = document.getElementById("dailyNotesInput");
    if (notesEl && notesEl.value !== (state.dailyNotes || "")) {
      notesEl.value = state.dailyNotes || "";
    }

    // Schedule slots
    const slotsContainer = document.getElementById("todaySlotsList");
    if (!slotsContainer) return;
    const slots = state.schedules[state.dayMode] || [];
    if (slots.length === 0) {
      slotsContainer.innerHTML = `
        <div class="empty-card">
          <p>No schedule slots yet for this Day Mode.</p>
          <p class="muted-text">Add a quick slot below, import a BAND schedule in Carpool, or unlock with your Family PIN to pull synced schedules.</p>
        </div>
      `;
      return;
    }

    slotsContainer.innerHTML = slots
      .map((slot) => {
        const isChecked = !!state.checkedSlots[slot.id];
        const opts = slot.options || [];
        const optIdx = state.selectedOptionIdx[slot.id] || 0;
        const opt = opts[optIdx] || opts[0] || { name: "Fuel Slot", basePortion: "", kcal: 200, sodium: 400, water: 8, fat: 2 };
        const safety = evaluateFoodSafety(opt.sodium, opt.fat, opt.kcal, targets.maxMealFat);
        const scaledPortion = formatScaledPortion(opt.basePortion, targets, slot.intensity);

        const optionsSelect = opts.length > 1
          ? `<select class="slot-option-select" data-slot-select="${esc(slot.id)}">
              ${opts.map((o, idx) => `<option value="${idx}" ${idx === optIdx ? "selected" : ""}>${esc(o.name)}</option>`).join("")}
            </select>`
          : `<div class="slot-food-name">${esc(opt.name)}</div>`;

        return `
          <div class="slot-card ${isChecked ? "slot-checked" : ""}">
            <div class="slot-check-col">
              <input type="checkbox" class="slot-checkbox" data-slot-check="${esc(slot.id)}" ${isChecked ? "checked" : ""} aria-label="Mark ${esc(slot.phase)} complete">
            </div>
            <div class="slot-body">
              <div class="slot-meta">
                <span class="slot-time">${esc(slot.time || "")}</span>
                <span class="slot-phase">${esc(slot.phase || "Fuel")}</span>
                ${slot.location ? `<span class="slot-loc">${esc(slot.location)}</span>` : ""}
              </div>
              ${optionsSelect}
              <div class="slot-portion">${esc(scaledPortion)}</div>
              <div class="slot-chips">
                <span class="chip">${opt.sodium}mg Na</span>
                <span class="chip">${opt.water}oz</span>
                <span class="chip ${safety.gbRating.tone}">${opt.fat}g Fat</span>
                <span class="chip">${Math.round((opt.kcal || 200) * targets.portionMultiplier)} kcal</span>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderFoodView() {
    const targets = getCalculatedTargets(state.profile);
    const searchVal = (document.getElementById("foodSearchInput")?.value || "").trim().toLowerCase();
    const listEl = document.getElementById("foodLibraryList");
    if (!listEl) return;

    document.querySelectorAll("[data-food-filter]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-food-filter") === state.foodFilter);
    });

    const filtered = state.foodLibrary.filter((item) => {
      if (searchVal && !item.name.toLowerCase().includes(searchVal) && !item.category.toLowerCase().includes(searchVal)) {
        return false;
      }
      const safety = evaluateFoodSafety(item.sodium, item.fat, item.kcal, targets.maxMealFat);
      if (state.foodFilter === "safe") return safety.overall === "safe";
      if (state.foodFilter === "high_na") return item.sodium >= 600 && safety.gbRating.status === "safe";
      if (state.foodFilter === "restaurant") return item.category.toLowerCase().includes("restaurant");
      if (state.foodFilter === "avoid") return safety.overall === "avoid";
      return true;
    });

    listEl.innerHTML = filtered
      .map((item) => {
        const safety = evaluateFoodSafety(item.sodium, item.fat, item.kcal, targets.maxMealFat);
        const badgeClass = safety.overall === "safe" ? "badge-safe" : safety.overall === "caution" ? "badge-caution" : "badge-avoid";
        return `
          <div class="food-card">
            <div class="food-card-top">
              <div>
                <span class="food-cat">${esc(item.category)}</span>
                <h4 class="food-name">${esc(item.name)}</h4>
                <p class="food-serving">${esc(item.baseServing)}</p>
              </div>
              <span class="pill-badge ${badgeClass}">${esc(safety.overallLabel)}</span>
            </div>
            <div class="food-macros">
              <span>🧂 ${item.sodium}mg</span>
              <span>🛡️ ${item.fat}g fat</span>
              <span>💧 ${item.water}oz</span>
              <span>⚡ ${item.kcal} kcal</span>
            </div>
            <div class="food-actions">
              <button type="button" class="btn-secondary btn-sm" data-log-food="${esc(item.id)}">+ Log to Today</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function showInstantAnalysis(est) {
    const card = document.getElementById("instantAnalysisCard");
    if (!card || !est) return;
    const targets = getCalculatedTargets(state.profile);
    const safety = evaluateFoodSafety(est.sodium, est.fat, est.kcal, targets.maxMealFat);
    const badgeClass = safety.overall === "safe" ? "badge-safe" : safety.overall === "caution" ? "badge-caution" : "badge-avoid";

    card.classList.remove("hidden");
    card.innerHTML = `
      <div class="analysis-head">
        <div>
          <span class="pill-badge ${badgeClass}">${esc(safety.overallLabel)}</span>
          <strong>${esc(est.name)}</strong>
        </div>
        <span class="muted-text">${esc(est.source)}</span>
      </div>
      <p class="food-serving">${esc(est.serving)}</p>
      <div class="food-macros">
        <span>🧂 ${est.sodium}mg Na</span>
        <span>🛡️ ${est.fat}g Fat</span>
        <span>💧 ${est.water}oz</span>
        <span>⚡ ${est.kcal} kcal</span>
      </div>
      <div class="analysis-actions">
        <button type="button" class="btn-primary btn-sm" id="analysisLogTodayBtn">+ Log to Today</button>
        <button type="button" class="btn-secondary btn-sm" id="analysisSaveLibBtn">+ Save to Library</button>
      </div>
    `;

    document.getElementById("analysisLogTodayBtn")?.addEventListener("click", () => {
      addFoodSlotToToday(est.name, est.serving, est.kcal, est.sodium, est.fat, est.water);
    });
    document.getElementById("analysisSaveLibBtn")?.addEventListener("click", () => {
      state.foodLibrary.unshift({
        id: "custom_" + Date.now(),
        name: est.name,
        baseServing: est.serving,
        category: est.category || "Looked Up Food",
        kcal: est.kcal,
        sodium: est.sodium,
        fat: est.fat,
        water: est.water || 8
      });
      saveAndSync();
      renderFoodView();
    });
  }

  function renderCarpoolView() {
    document.querySelectorAll("[data-carpool-day]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-carpool-day") === state.dayOfWeek);
    });

    const cp = state.carpool[state.dayOfWeek] || { toDriver: "", toTime: "", toNote: "", homeDriver: "", homeTime: "", homeNote: "" };
    const card = document.getElementById("carpoolDayCard");
    if (card) {
      card.innerHTML = `
        <div class="carpool-grid">
          <div class="carpool-leg">
            <span class="leg-tag">TO STUDIO</span>
            <h4>${esc(cp.toDriver || "Not assigned")}</h4>
            <p class="leg-time">${esc(cp.toTime || "No time set")}</p>
            <p class="muted-text">${esc(cp.toNote || "Tap Edit to add pickup notes")}</p>
          </div>
          <div class="carpool-leg">
            <span class="leg-tag">HOME</span>
            <h4>${esc(cp.homeDriver || "Not assigned")}</h4>
            <p class="leg-time">${esc(cp.homeTime || "No time set")}</p>
            <p class="muted-text">${esc(cp.homeNote || "Tap Edit to add drop-off notes")}</p>
          </div>
        </div>
      `;
    }

    const toD = document.getElementById("editToDriver");
    const toT = document.getElementById("editToTime");
    const toN = document.getElementById("editToNote");
    const hoD = document.getElementById("editHomeDriver");
    const hoT = document.getElementById("editHomeTime");
    const hoN = document.getElementById("editHomeNote");
    if (toD) toD.value = cp.toDriver || "";
    if (toT) toT.value = cp.toTime || "";
    if (toN) toN.value = cp.toNote || "";
    if (hoD) hoD.value = cp.homeDriver || "";
    if (hoT) hoT.value = cp.homeTime || "";
    if (hoN) hoN.value = cp.homeNote || "";
  }

  function renderHistoryView() {
    const targets = getCalculatedTargets(state.profile);
    const range = state.historyRange || "7d";
    const entries = filterHistory(state.history, range);
    const stats = computeHistoryStats(entries);

    document.querySelectorAll("[data-history-range]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-history-range") === range);
    });

    const summaryEl = document.getElementById("historySummaryGrid");
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="stat-tile"><span class="stat-label">Avg Sodium</span><strong>${stats.avgSodium} mg</strong></div>
        <div class="stat-tile"><span class="stat-label">Avg Water</span><strong>${stats.avgWater} oz</strong></div>
        <div class="stat-tile"><span class="stat-label">GB Safe Days</span><strong>${stats.gbCompliancePct}%</strong></div>
        <div class="stat-tile"><span class="stat-label">Steady Days</span><strong>${stats.symptomFreeCount}/${stats.count}</strong></div>
      `;
    }

    const corrEl = document.getElementById("historyCorrelationCard");
    if (corrEl) {
      const c = stats.symptomCorrelation;
      corrEl.innerHTML = `
        <h4>Hydration &amp; Symptom Correlation</h4>
        <p><strong>Steady Days (${c.steadyDays}):</strong> Avg ${c.steadyAvgSodium} mg Na • ${c.steadyAvgWater} oz water</p>
        <p><strong>Symptomatic Days (${c.symptomaticDays}):</strong> Avg ${c.symptomaticAvgSodium} mg Na • ${c.symptomaticAvgWater} oz water</p>
      `;
    }

    const listEl = document.getElementById("historyEntriesList");
    if (listEl) {
      if (!entries.length) {
        listEl.innerHTML = `<div class="empty-card"><p>No daily logs recorded in this range yet.</p></div>`;
      } else {
        listEl.innerHTML = entries
          .map(
            (e) => `
          <details class="history-entry-card">
            <summary>
              <span><strong>${esc(e.date)}</strong> • ${esc(e.dayMode)}</span>
              <span class="pill-badge ${e.symptomStatus === "steady" && e.gbCompliant !== false ? "badge-safe" : "badge-caution"}">${esc(e.symptomStatus || "steady")}</span>
            </summary>
            <div class="history-entry-body">
              <p>Sodium: <strong>${e.sodiumMg}</strong> / ${e.sodiumTarget} mg • Water: <strong>${e.waterOz}</strong> / ${e.waterTarget} oz</p>
              <p>Max Meal Fat: <strong>${e.maxMealFat}g</strong> (${e.gbCompliant !== false ? "GB Safe" : "Exceeded"}) • Total Fat: ${e.totalFatG}g</p>
              ${e.notes ? `<p class="muted-text">Notes: ${esc(e.notes)}</p>` : ""}
            </div>
          </details>
        `
          )
          .join("");
      }
    }

    const printContainer = document.getElementById("printable-doctor-report");
    if (printContainer) {
      printContainer.innerHTML = renderDoctorReportHtml(state, targets, range);
    }
  }

  function renderGearModal() {
    document.querySelectorAll("[data-role-btn]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-role-btn") === state.viewerRole);
    });

    const p = state.profile;
    const setVal = (id, v) => {
      const el = document.getElementById(id);
      if (el && document.activeElement !== el) el.value = v ?? "";
    };
    setVal("profName", p.name);
    setVal("profAge", p.age);
    setVal("profWeight", p.weightLbs);
    setVal("profHeightFt", p.heightFt);
    setVal("profHeightIn", p.heightIn);
    setVal("profDanceHours", p.danceHours);
    setVal("profPotsLevel", p.potsLevel);
    setVal("profGbLevel", p.gbLevel);
    setVal("profCustomSodium", p.customSodium);
    setVal("profCustomWater", p.customWater);
    setVal("profCustomMealFat", p.customMealFat);
    setVal("profCustomCalories", p.customCalories);
    setVal("gearSyncUrlInput", state.googleSheetWebAppUrl || auth.syncUrl || "");

    const overrideToggle = document.getElementById("profDoctorOverride");
    const overrideFields = document.getElementById("doctorOverrideFields");
    if (overrideToggle) overrideToggle.checked = !!p.useDoctorOverride;
    if (overrideFields) overrideFields.classList.toggle("hidden", !p.useDoctorOverride);

    const bagEl = document.getElementById("gearBagChecklist");
    if (bagEl) {
      bagEl.innerHTML = state.bagItems
        .map((item) => {
          const checked = !!state.bagChecked[item.id];
          return `
            <label class="bag-item ${checked ? "checked" : ""}">
              <input type="checkbox" data-bag-check="${esc(item.id)}" ${checked ? "checked" : ""}>
              <span>${esc(item.text)}</span>
              <span class="chip">${esc(item.tag)}</span>
            </label>
          `;
        })
        .join("");
    }
  }

  // ==========================================================================
  // ACTIONS
  // ==========================================================================

  function addFoodSlotToToday(name, baseServing, kcal, sodium, fat, water = 12) {
    const slots = state.schedules[state.dayMode] || [];
    const id = `quick_${Date.now()}`;
    slots.push({
      id,
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      phase: "Quick Fuel",
      location: "Logged",
      intensity: "moderate",
      options: [{ name, basePortion: baseServing, kcal, sodium, water, fat }]
    });
    state.schedules[state.dayMode] = slots;
    state.checkedSlots[id] = true;
    state.activeTab = "today";
    saveAndSync();
    renderAll();
  }

  function exportIcsCalendar() {
    const cp = state.carpool[state.dayOfWeek] || {};
    const slots = state.schedules[state.dayMode] || [];
    const targets = getCalculatedTargets(state.profile);

    function timeToIcs(timeStr) {
      const d = new Date();
      const m = String(timeStr || "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (m) {
        let h = parseInt(m[1], 10);
        const min = parseInt(m[2], 10);
        const ampm = (m[3] || "").toUpperCase();
        if (ampm === "PM" && h < 12) h += 12;
        if (ampm === "AM" && h === 12) h = 0;
        d.setHours(h, min, 0, 0);
      }
      const pad = (n) => String(n).padStart(2, "0");
      const fmt = (dt) =>
        `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
      const end = new Date(d.getTime() + 30 * 60000);
      return { start: fmt(d), end: fmt(end) };
    }

    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//En Pointe & Steady//Wellness PWA//EN"];
    slots.forEach((slot, i) => {
      const opt = (slot.options || [])[state.selectedOptionIdx[slot.id] || 0] || (slot.options || [])[0];
      if (!opt) return;
      const dt = timeToIcs(slot.time);
      lines.push(
        "BEGIN:VEVENT",
        `UID:epsteady-${Date.now()}-${i}@pwa`,
        `DTSTART:${dt.start}`,
        `DTEND:${dt.end}`,
        `SUMMARY:${slot.phase}: ${opt.name}`,
        `DESCRIPTION:Portion: ${formatScaledPortion(opt.basePortion, targets, slot.intensity)} | ${opt.sodium}mg Na | ${opt.fat}g Fat`,
        "END:VEVENT"
      );
    });

    if (cp.toDriver) {
      const dt = timeToIcs(cp.toTime || "3:30 PM");
      lines.push(
        "BEGIN:VEVENT",
        `UID:epsteady-to-${Date.now()}@pwa`,
        `DTSTART:${dt.start}`,
        `DTEND:${dt.end}`,
        `SUMMARY:Carpool TO Studio (${cp.toDriver})`,
        `DESCRIPTION:${cp.toNote || ""}`,
        "END:VEVENT"
      );
    }
    if (cp.homeDriver) {
      const dt = timeToIcs(cp.homeTime || "9:00 PM");
      lines.push(
        "BEGIN:VEVENT",
        `UID:epsteady-home-${Date.now()}@pwa`,
        `DTSTART:${dt.start}`,
        `DTEND:${dt.end}`,
        `SUMMARY:Carpool HOME (${cp.homeDriver})`,
        `DESCRIPTION:${cp.homeNote || ""}`,
        "END:VEVENT"
      );
    }
    lines.push("END:VCALENDAR");

    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `en-pointe-${state.dayOfWeek.toLowerCase()}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadCsv() {
    const entries = filterHistory(state.history, state.historyRange || "7d");
    const csv = generateHistoryCsv(entries);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `en-pointe-history-${state.historyRange || "7d"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ==========================================================================
  // EVENT WIRING & BOOTSTRAP
  // ==========================================================================

  function wireEvents() {
    // Bottom nav & View History
    document.querySelectorAll("[data-nav-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeTab = btn.getAttribute("data-nav-tab");
        renderAll();
      });
    });

    document.getElementById("openFullHistoryBtn")?.addEventListener("click", () => {
      state.activeTab = "history";
      renderAll();
    });
    document.getElementById("gearOpenHistoryBtn")?.addEventListener("click", () => {
      document.getElementById("gearModal")?.classList.add("hidden");
      state.activeTab = "history";
      renderAll();
    });
    document.getElementById("historyBackBtn")?.addEventListener("click", () => {
      state.activeTab = "today";
      renderAll();
    });

    // Symptom rescue pills
    document.querySelectorAll("[data-symptom-btn]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.symptomStatus = btn.getAttribute("data-symptom-btn");
        saveAndSync();
        renderTopBar();
        renderTodayView();
      });
    });

    // Day mode pills
    document.querySelectorAll("[data-day-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.dayMode = btn.getAttribute("data-day-mode");
        saveAndSync();
        renderTodayView();
      });
    });

    // Quick bonus buttons
    document.getElementById("addBonusSodiumBtn")?.addEventListener("click", () => {
      state.bonusSodium = (state.bonusSodium || 0) + 500;
      saveAndSync();
      renderTodayView();
    });
    document.getElementById("addBonusWaterBtn")?.addEventListener("click", () => {
      state.bonusWater = (state.bonusWater || 0) + 8;
      saveAndSync();
      renderTodayView();
    });

    // Daily notes
    document.getElementById("dailyNotesInput")?.addEventListener("input", (e) => {
      state.dailyNotes = e.target.value;
      saveAndSync();
    });

    // Slot check / option change delegation
    document.getElementById("todaySlotsList")?.addEventListener("change", (e) => {
      const checkId = e.target.getAttribute("data-slot-check");
      if (checkId) {
        state.checkedSlots[checkId] = e.target.checked;
        saveAndSync();
        renderTodayView();
        return;
      }
      const selectId = e.target.getAttribute("data-slot-select");
      if (selectId) {
        state.selectedOptionIdx[selectId] = parseInt(e.target.value, 10) || 0;
        saveAndSync();
        renderTodayView();
      }
    });

    // Quick add slot
    document.getElementById("quickAddSlotBtn")?.addEventListener("click", () => {
      addFoodSlotToToday("Electrolyte Water + Salted Pretzels", "16oz + 15 twists", 130, 850, 0.5, 16);
    });

    // Food search & filters
    document.getElementById("foodSearchInput")?.addEventListener("input", (e) => {
      const q = e.target.value.trim();
      if (q.length >= 2) {
        const est = estimateNutritionForQuery(q, state.foodLibrary);
        showInstantAnalysis(est);
      } else {
        document.getElementById("instantAnalysisCard")?.classList.add("hidden");
      }
      renderFoodView();
    });

    document.getElementById("foodLookupOnlineBtn")?.addEventListener("click", async () => {
      const q = document.getElementById("foodSearchInput")?.value.trim() || "Chicken Noodle Soup";
      const est = estimateNutritionForQuery(q, state.foodLibrary);
      showInstantAnalysis(est);
      const online = await lookupFoodOpenFoodFacts(q, est);
      if (online) showInstantAnalysis(online);
    });

    document.querySelectorAll("[data-food-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.foodFilter = btn.getAttribute("data-food-filter");
        renderFoodView();
      });
    });

    document.getElementById("foodLibraryList")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-log-food]");
      if (!btn) return;
      const id = btn.getAttribute("data-log-food");
      const item = state.foodLibrary.find((f) => f.id === id);
      if (item) {
        addFoodSlotToToday(item.name, item.baseServing, item.kcal, item.sodium, item.fat, item.water || 12);
      }
    });

    // Carpool day switcher & editor
    document.querySelectorAll("[data-carpool-day]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.dayOfWeek = btn.getAttribute("data-carpool-day");
        renderCarpoolView();
      });
    });

    document.getElementById("toggleCarpoolEditBtn")?.addEventListener("click", () => {
      document.getElementById("carpoolEditForm")?.classList.toggle("hidden");
    });

    document.getElementById("saveCarpoolBtn")?.addEventListener("click", () => {
      state.carpool[state.dayOfWeek] = {
        toDriver: document.getElementById("editToDriver")?.value.trim() || "",
        toTime: document.getElementById("editToTime")?.value.trim() || "",
        toNote: document.getElementById("editToNote")?.value.trim() || "",
        homeDriver: document.getElementById("editHomeDriver")?.value.trim() || "",
        homeTime: document.getElementById("editHomeTime")?.value.trim() || "",
        homeNote: document.getElementById("editHomeNote")?.value.trim() || ""
      };
      document.getElementById("carpoolEditForm")?.classList.add("hidden");
      saveAndSync();
      renderCarpoolView();
    });

    document.getElementById("exportIcsBtn")?.addEventListener("click", exportIcsCalendar);

    // History filters & exports
    document.querySelectorAll("[data-history-range]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.historyRange = btn.getAttribute("data-history-range");
        renderHistoryView();
      });
    });
    document.getElementById("downloadCsvBtn")?.addEventListener("click", downloadCsv);
    document.getElementById("printDoctorReportBtn")?.addEventListener("click", () => window.print());

    // Gear Modal
    document.getElementById("openGearBtn")?.addEventListener("click", () => {
      renderGearModal();
      document.getElementById("gearModal")?.classList.remove("hidden");
    });
    document.getElementById("closeGearBtn")?.addEventListener("click", () => {
      document.getElementById("gearModal")?.classList.add("hidden");
    });

    document.querySelectorAll("[data-role-btn]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.viewerRole = btn.getAttribute("data-role-btn");
        saveAndSync();
        renderAll();
      });
    });

    document.getElementById("profDoctorOverride")?.addEventListener("change", (e) => {
      state.profile.useDoctorOverride = e.target.checked;
      saveAndSync();
      renderAll();
    });

    document.getElementById("saveProfileBtn")?.addEventListener("click", () => {
      const p = state.profile;
      p.name = document.getElementById("profName")?.value.trim() || "Dancer";
      p.age = parseInt(document.getElementById("profAge")?.value, 10) || 14;
      p.weightLbs = parseFloat(document.getElementById("profWeight")?.value) || 110;
      p.heightFt = parseInt(document.getElementById("profHeightFt")?.value, 10) || 5;
      p.heightIn = parseInt(document.getElementById("profHeightIn")?.value, 10) || 0;
      p.danceHours = parseFloat(document.getElementById("profDanceHours")?.value) || 0;
      p.potsLevel = document.getElementById("profPotsLevel")?.value || "standard";
      p.gbLevel = document.getElementById("profGbLevel")?.value || "moderate";
      p.customSodium = parseInt(document.getElementById("profCustomSodium")?.value, 10) || 4000;
      p.customWater = parseInt(document.getElementById("profCustomWater")?.value, 10) || 85;
      p.customMealFat = parseFloat(document.getElementById("profCustomMealFat")?.value) || 5.5;
      p.customCalories = parseInt(document.getElementById("profCustomCalories")?.value, 10) || 2000;

      const syncUrl = document.getElementById("gearSyncUrlInput")?.value.trim() || "";
      state.googleSheetWebAppUrl = syncUrl;
      if (auth.unlocked) {
        saveDeviceAuth({ ...auth, syncUrl });
      }
      saveAndSync();
      renderAll();
    });

    document.getElementById("gearBagChecklist")?.addEventListener("change", (e) => {
      const id = e.target.getAttribute("data-bag-check");
      if (!id) return;
      state.bagChecked[id] = e.target.checked;
      saveAndSync();
      renderGearModal();
    });

    document.getElementById("gearSyncNowBtn")?.addEventListener("click", async () => {
      const syncUrl = document.getElementById("gearSyncUrlInput")?.value.trim() || "";
      state.googleSheetWebAppUrl = syncUrl;
      await silentPullFromCloud();
    });

    document.getElementById("lockAppBtn")?.addEventListener("click", () => {
      saveDeviceAuth({ unlocked: false, passphrase: "", syncUrl: state.googleSheetWebAppUrl || "", rememberDevice: true });
      document.getElementById("gearModal")?.classList.add("hidden");
      document.getElementById("pinOverlay")?.classList.remove("hidden");
    });

    // PIN Unlock Overlay
    document.getElementById("pinUnlockForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const pin = document.getElementById("pinInput")?.value.trim() || "";
      const syncUrl = document.getElementById("pinSyncUrlInput")?.value.trim() || state.googleSheetWebAppUrl || "";
      const remember = document.getElementById("pinRememberCheck")?.checked !== false;
      const errEl = document.getElementById("pinErrorMsg");

      if (!pin) {
        if (errEl) errEl.textContent = "Please enter your Family PIN.";
        return;
      }

      if (errEl) errEl.textContent = "";
      state.googleSheetWebAppUrl = syncUrl;
      saveDeviceAuth({ unlocked: true, passphrase: pin, syncUrl, rememberDevice: remember });

      if (syncUrl) {
        const pulled = await silentPullFromCloud();
        if (!pulled && errEl) {
          errEl.textContent = "Unlocked locally (cloud sync unavailable or PIN mismatch).";
        }
      }

      document.getElementById("pinOverlay")?.classList.add("hidden");
      renderAll();
    });

    window.addEventListener("focus", () => {
      if (auth.unlocked) silentPullFromCloud();
    });
  }

  function initApp() {
    // Support ?sync=<url> pairing query parameter
    const params = new URLSearchParams(window.location.search);
    const paramSync = params.get("sync");
    if (paramSync) {
      state.googleSheetWebAppUrl = paramSync;
      const pinUrlInput = document.getElementById("pinSyncUrlInput");
      if (pinUrlInput) pinUrlInput.value = paramSync;
    }

    rolloverDayIfNeeded();
    wireEvents();
    renderAll();

    if (auth.unlocked && auth.passphrase) {
      document.getElementById("pinOverlay")?.classList.add("hidden");
      silentPullFromCloud();
    } else {
      const pinUrlInput = document.getElementById("pinSyncUrlInput");
      if (pinUrlInput && (state.googleSheetWebAppUrl || auth.syncUrl)) {
        pinUrlInput.value = state.googleSheetWebAppUrl || auth.syncUrl;
      }
      document.getElementById("pinOverlay")?.classList.remove("hidden");
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
  }

  document.addEventListener("DOMContentLoaded", initApp);
}
