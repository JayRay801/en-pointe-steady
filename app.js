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

export const QUICK_LOG_PRESETS = [
  { id: "p_lmnt", label: "LMNT (1000mg)", name: "LMNT Electrolyte Packet", portion: "16oz water + 1 packet", sodium: 1000, water: 16, fat: 0, kcal: 5 },
  { id: "p_liquidiv", label: "Liquid I.V. (500mg)", name: "Liquid I.V. Hydration", portion: "16oz water + 1 stick", sodium: 500, water: 16, fat: 0, kcal: 45 },
  { id: "p_trioral", label: "TriOral (1000mg)", name: "TriOral ORS Packet", portion: "32oz water + 1 packet", sodium: 1000, water: 32, fat: 0, kcal: 40 },
  { id: "p_pretzels", label: "Pretzels (850mg)", name: "Salted Mini Pretzels", portion: "15-20 twists (~1.5 oz)", sodium: 850, water: 0, fat: 0.5, kcal: 130 },
  { id: "p_broth", label: "Bone Broth (580mg)", name: "Warm Chicken Bone Broth", portion: "12oz warm mug", sodium: 580, water: 12, fat: 0.5, kcal: 45 },
  { id: "p_applesauce", label: "Applesauce", name: "Unsweetened Applesauce Pouch", portion: "1 squeeze pouch", sodium: 0, water: 4, fat: 0, kcal: 60 },
  { id: "p_saltstick", label: "SaltStick (215mg)", name: "SaltStick Caps / Vitassium", portion: "1 capsule + water", sodium: 215, water: 4, fat: 0, kcal: 0 }
];

export const SYMPTOM_QUICK_TAGS = [
  "Lightheaded at barre",
  "High HR",
  "Brain fog",
  "Heavy legs",
  "Nausea / GI",
  "Hot studio"
];

export const CLINICAL_INFO_TOPICS = {
  sodium: {
    title: "Why High Sodium for POTS?",
    body: "Dancers with POTS need extra sodium (typically 3,000–4,500+ mg/day plus rehearsal sweat losses) to expand blood volume, stabilize blood pressure during jumps and pointe work, and prevent dizziness. Use +500mg Na / -500 to quickly adjust."
  },
  water: {
    title: "Hydration & Electrolyte Pairing",
    body: "Your daily hydration goal scales with body weight and dance hours (+8 oz per hour of class). Pair water with sodium or electrolytes so fluids stay in your bloodstream instead of flushing straight through."
  },
  gb: {
    title: "Gallbladder Fat Cap (≤ 5.5g / Meal)",
    body: "Higher-fat meals trigger strong gallbladder contractions that can cause upper-abdominal pain or nausea. Keeping each meal or snack at or below your meal cap (Moderate: 5.5g, Strict: 4.0g, Flare: 2.5g) lets you fuel safely without biliary flares."
  },
  dayMode: {
    title: "Choosing Your Day Mode",
    body: "Each Day Mode (School + Studio, Competition, Recovery) holds its own routine fuel timeline. Switch modes anytime without losing your saved routines. One-off items added with '+ Quick Log' automatically clear at midnight while keeping your base routine."
  },
  doctorOverride: {
    title: "Doctor Override Targets",
    body: "Turn this on if your cardiologist, POTS specialist, or gastroenterologist gave you specific daily Sodium (mg), Hydration (oz), Max Meal Fat (g), or Calorie targets that differ from the automatic calculator."
  },
  sync: {
    title: "Zero-PII Encrypted Cloud Sync",
    body: "All personal details, notes, carpool schedules, and health history are encrypted inside your browser (AES-256-GCM) with your Family PIN BEFORE being sent to Google Sheets. Use 'Pair Another Device' to share a 1-tap link so family members never have to type the script URL."
  }
};

export const MANUAL_SECTIONS = [
  {
    id: "quickstart",
    label: "Quick Start",
    title: "Daily Routine in 60 Seconds",
    items: [
      "<strong>Check off meals &amp; drinks:</strong> Tap the checkbox beside each scheduled slot (or switch meal options in the dropdown) as you eat or drink. Your Sodium and Hydration rings fill automatically.",
      "<strong>Log anything extra fast:</strong> Tap <strong>+ Quick Log</strong> to pick 1-tap electrolyte presets (LMNT, Liquid I.V., TriOral, Pretzels, Broth) or search 36+ safe foods.",
      "<strong>Fix mistakes anytime:</strong> Tap <strong>✏️</strong> on any timeline card to adjust amounts, <strong>🗑️</strong> to delete it, or use <strong>-500 / -8oz</strong> under the rings to undo taps.",
      "<strong>Switch Day Modes &amp; templates:</strong> Choose <em>School + Studio</em>, <em>Competition</em>, or <em>Recovery</em>—each saves its own routine. If a mode is cleared, tap <strong>Load Dance Routine Template</strong> to restore it.",
      "<strong>Pack the night before:</strong> Expand the <strong>🎒 Dance Bag Checklist</strong> right on Today's screen before bed."
    ]
  },
  {
    id: "fueling",
    label: "POTS & Gallbladder",
    title: "Fueling Rules for Dancers",
    items: [
      "<strong>Sodium + Water together:</strong> Plain water alone flushes out fast. Pair every 16oz bottle with an electrolyte packet or salty snack.",
      "<strong>Gallbladder safety cap:</strong> Keep each meal/snack under your fat cap (default <strong>≤ 5.5g fat/meal</strong>, or Strict 4.0g / Flare 2.5g / Doctor Override). Watch the live badge in Quick Log and Food Analyzer.",
      "<strong>Custom foods &amp; Analyzer:</strong> Use the <strong>Food</strong> tab to analyze snacks or restaurant items, save your own with <strong>+ Custom Food</strong>, and remove custom items anytime with <strong>🗑️</strong>.",
      "<strong>Tap ℹ for instant context:</strong> Small <strong>ℹ</strong> buttons next to rings, Day Modes, Doctor Override, and Cloud Sync open quick plain-language explainers.",
      "<strong>Clean midnight reset:</strong> One-off '+ Quick Log' items automatically archive to History and clear at midnight so tomorrow's routine starts fresh."
    ]
  },
  {
    id: "rescue",
    label: "Rescue & Symptoms",
    title: "When You Don't Feel Steady",
    items: [
      "<strong>Tap 'I feel:' at the top:</strong> Selecting <em>Dizzy</em>, <em>Tired</em>, or <em>Stomach</em> opens an immediate sideline rescue protocol with step-by-step actions.",
      "<strong>1-Tap Symptom Tags:</strong> Above Daily Notes, tap tags like <em>Lightheaded at barre</em>, <em>High HR</em>, or <em>Hot studio</em> to log patterns for your doctor.",
      "<strong>Doctor Report &amp; CSV:</strong> Tap <strong>View Full History →</strong> (or Settings ⚙ → <strong>Open Full History &amp; Doctor Report</strong>) to view symptom correlation, download CSV, or <strong>Print / Save Doctor PDF</strong>."
    ]
  },
  {
    id: "family",
    label: "Sync, PIN & Carpool",
    title: "Family Sync, Security & Rides",
    items: [
      "<strong>No typing long URLs:</strong> On a configured phone, go to Settings (⚙) → <strong>Pair Another Device</strong> and text the 1-tap pairing link to Dancer or Mom.",
      "<strong>Change Family PIN:</strong> Go to Settings (⚙) → <strong>Change Family PIN</strong>. Your data is re-encrypted (AES-256-GCM) and pushed to Cloud Sync automatically.",
      "<strong>1-Tap Carpool Share &amp; Calendar:</strong> On the <strong>Carpool</strong> tab, tap <strong>Share / Copy Ride</strong> to paste pickup and drop-off details straight into family texts, or <strong>Calendar (.ics)</strong> to add rides and fuel slots to your calendar."
    ]
  }
];

export const DEFAULT_SCHEDULE_TEMPLATES = {
  school_dance: [
    {
      id: "sd_1",
      time: "7:15 AM",
      phase: "Morning Wake-Up",
      location: "Home",
      intensity: "moderate",
      options: [
        { name: "16oz Electrolyte Water (LMNT / Liquid I.V.) + Salted Pretzels", basePortion: "16oz drink + 15 pretzel twists", kcal: 130, sodium: 850, water: 16, fat: 0.5 },
        { name: "Warm Oatmeal with Sea Salt, Maple & Banana", basePortion: "1 cup oats + 1 banana + 1/4 tsp salt", kcal: 290, sodium: 480, water: 8, fat: 2.0 }
      ]
    },
    {
      id: "sd_2",
      time: "12:15 PM",
      phase: "School Lunch",
      location: "School",
      intensity: "moderate",
      options: [
        { name: "Deli Oven-Roasted Turkey Roll-Ups + Pickle Spear + Pretzels", basePortion: "4 slices turkey + 1 pickle + 12 pretzels", kcal: 240, sodium: 820, water: 12, fat: 2.0 },
        { name: "Grilled Chicken & Honey Mustard Wrap + Baked Lay's", basePortion: "1 wrap + 1oz baked chips", kcal: 370, sodium: 910, water: 16, fat: 4.5 }
      ]
    },
    {
      id: "sd_3",
      time: "3:30 PM",
      phase: "Pre-Studio Fuel",
      location: "Car / Studio",
      intensity: "high",
      options: [
        { name: "Gatorade Zero / Pedialyte Sport (16oz) + Salted Rice Cake", basePortion: "16oz bottle + 1 salted rice cake", kcal: 55, sodium: 590, water: 16, fat: 0.0 },
        { name: "Salted Rice Cakes + PB2 + Banana Slices", basePortion: "2 rice cakes + 2 tbsp PB2 + 1/2 banana", kcal: 220, sodium: 450, water: 12, fat: 2.0 }
      ]
    },
    {
      id: "sd_4",
      time: "6:15 PM",
      phase: "Between Classes",
      location: "Studio",
      intensity: "high",
      options: [
        { name: "Thermos Warm Low-Fat Chicken & Rice Soup + Saltines", basePortion: "1.5 cups warm soup + 6 crackers", kcal: 260, sodium: 890, water: 12, fat: 2.5 },
        { name: "Watermelon Cubes with Sea Salt + 12oz Water", basePortion: "1.5 cups watermelon + 1/4 tsp salt", kcal: 75, sodium: 560, water: 16, fat: 0.2 }
      ]
    },
    {
      id: "sd_5",
      time: "9:00 PM",
      phase: "Post-Rehearsal Recovery",
      location: "Car / Home",
      intensity: "moderate",
      options: [
        { name: "Warm Jasmine Rice Bowl with Grilled Teriyaki Chicken", basePortion: "1 cup white rice + 3.5oz chicken breast", kcal: 340, sodium: 640, water: 10, fat: 3.0 },
        { name: "Baked Potato with Sea Salt, 0% Yogurt & Lean Turkey", basePortion: "1 medium potato + 2 tbsp yogurt + 2oz turkey", kcal: 310, sodium: 580, water: 10, fat: 2.0 }
      ]
    }
  ],
  competition: [
    {
      id: "comp_1",
      time: "7:30 AM",
      phase: "Comp Morning Load",
      location: "Hotel / Home",
      intensity: "high",
      options: [
        { name: "16oz Electrolyte Water (LMNT / Liquid I.V.) + Salted Pretzels", basePortion: "16oz drink + 15 pretzel twists", kcal: 130, sodium: 850, water: 16, fat: 0.5 },
        { name: "Plain Bagel Thin with Jam + 3 Slices Deli Turkey", basePortion: "1 bagel thin + 1 tbsp jam + 3oz turkey", kcal: 260, sodium: 690, water: 8, fat: 2.0 }
      ]
    },
    {
      id: "comp_2",
      time: "11:00 AM",
      phase: "Backstage Grazing",
      location: "Venue",
      intensity: "high",
      options: [
        { name: "Pickle Juice Shot (2oz) + Applesauce Pouch + Pretzels", basePortion: "2oz brine + 1 pouch + 10 pretzels", kcal: 150, sodium: 680, water: 12, fat: 0.5 },
        { name: "Miso Soup Packet in Hot Thermos + Pretzel Thins", basePortion: "12oz warm miso + 10 pretzel thins", kcal: 165, sodium: 840, water: 12, fat: 1.5 }
      ]
    },
    {
      id: "comp_3",
      time: "3:00 PM",
      phase: "Mid-Day Refuel",
      location: "Venue",
      intensity: "high",
      options: [
        { name: "Subway 6-Inch Turkey Sub (Mustard/Pickles, No Cheese/Mayo)", basePortion: "1 6-inch sub + Baked Lay's", kcal: 380, sodium: 960, water: 16, fat: 4.0 },
        { name: "Chick-fil-A Grilled Nuggets (8 ct) + Fruit Cup", basePortion: "8 nuggets + fruit cup + 16oz water", kcal: 210, sodium: 530, water: 16, fat: 3.0 }
      ]
    },
    {
      id: "comp_4",
      time: "8:00 PM",
      phase: "Post-Stage Recovery",
      location: "Dinner",
      intensity: "moderate",
      options: [
        { name: "Warm Egg-Drop Broth Soup with White Rice", basePortion: "1.5 cups soup + 1/2 cup white rice", kcal: 250, sodium: 790, water: 12, fat: 3.0 },
        { name: "Whole-Wheat Pasta with Marinara & 99% Lean Turkey", basePortion: "1 cup pasta + marinara + 3oz turkey", kcal: 350, sodium: 670, water: 10, fat: 3.0 }
      ]
    }
  ],
  recovery: [
    {
      id: "rec_1",
      time: "8:30 AM",
      phase: "Gentle Hydration",
      location: "Home",
      intensity: "light",
      options: [
        { name: "Warm Mug of Chicken Bone Broth + Saltines", basePortion: "12oz warm mug + 4 crackers", kcal: 95, sodium: 780, water: 12, fat: 1.0 },
        { name: "0% Greek Yogurt Parfait + Honey + Pretzel Crumble", basePortion: "3/4 cup yogurt + 1/3 cup pretzels", kcal: 230, sodium: 390, water: 8, fat: 0.5 }
      ]
    },
    {
      id: "rec_2",
      time: "1:00 PM",
      phase: "Easy Midday Meal",
      location: "Home",
      intensity: "light",
      options: [
        { name: "Low-Fat Cottage Cheese (1%) with Fruit + Salted Crackers", basePortion: "1/2 cup cottage cheese + fruit + 5 crackers", kcal: 190, sodium: 540, water: 8, fat: 1.5 },
        { name: "Thermos Warm Low-Fat Chicken & Rice Soup + Saltines", basePortion: "1.5 cups warm soup + 6 crackers", kcal: 260, sodium: 890, water: 12, fat: 2.5 }
      ]
    },
    {
      id: "rec_3",
      time: "6:30 PM",
      phase: "Light Dinner",
      location: "Home",
      intensity: "light",
      options: [
        { name: "Grilled White Fish / Shrimp Soft Tacos on Corn Tortillas", basePortion: "2 corn tortillas + 3.5oz fish + salsa", kcal: 295, sodium: 610, water: 10, fat: 3.0 },
        { name: "Baked Potato with Sea Salt, 0% Yogurt & Lean Turkey", basePortion: "1 medium potato + 2 tbsp yogurt + 2oz turkey", kcal: 310, sodium: 580, water: 10, fat: 2.0 }
      ]
    }
  ]
};

export function cloneScheduleTemplate(mode) {
  const list = DEFAULT_SCHEDULE_TEMPLATES[mode] || [];
  return list.map((slot) => ({
    ...slot,
    options: (slot.options || []).map((o) => ({ ...o }))
  }));
}

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
      school_dance: cloneScheduleTemplate("school_dance"),
      competition: cloneScheduleTemplate("competition"),
      recovery: cloneScheduleTemplate("recovery")
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
      portionMultiplier: Math.max(0.65, Math.min(1.65, calories / 2150))
    };
  }

  const weightLbs = Number(p.weightLbs) || 110;
  const heightFt = Number(p.heightFt) || 5;
  const heightIn = p.heightIn != null && p.heightIn !== "" && Number.isFinite(Number(p.heightIn)) ? Number(p.heightIn) : 2;
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

/**
 * Pure bonus value adjuster clamped at >= 0.
 */
export function adjustBonusValue(currentVal, delta) {
  return Math.max(0, (Number(currentVal) || 0) + (Number(delta) || 0));
}

/**
 * Pure midnight rollover helper: snapshots previous day, clears ad-hoc slots, preserves routines.
 */
export function applyRolloverState(currentState, todayStr = getLocalDateString()) {
  if (!currentState || !currentState.lastActiveDate || currentState.lastActiveDate === todayStr) {
    return { rolledOver: false, nextState: currentState };
  }
  const targets = getCalculatedTargets(currentState.profile);
  const { history } = snapshotToday(currentState, targets, currentState.lastActiveDate);

  const nextSchedules = {};
  for (const mode of ["school_dance", "competition", "recovery"]) {
    const list = currentState.schedules?.[mode] || [];
    nextSchedules[mode] = list.filter((slot) => !slot.isAdHoc);
  }

  const nextState = {
    ...currentState,
    schedules: nextSchedules,
    history,
    checkedSlots: {},
    bonusSodium: 0,
    bonusWater: 0,
    symptomStatus: "steady",
    dailyNotes: "",
    lastActiveDate: todayStr,
    dayOfWeek: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()] || currentState.dayOfWeek || "Mon"
  };
  return { rolledOver: true, nextState };
}

/**
 * Extract pairing sync URL from ?sync=... or #sync=... without leaking to server logs.
 */
export function parseSyncHashOrQuery(searchStr = "", hashStr = "") {
  const cleanHash = String(hashStr || "").replace(/^#/, "");
  const hashParams = new URLSearchParams(cleanHash);
  const searchParams = new URLSearchParams(String(searchStr || ""));
  const candidate = (hashParams.get("sync") || searchParams.get("sync") || "").trim();
  if (/^https?:\/\//i.test(candidate)) {
    return candidate;
  }
  return "";
}

/**
 * Format a carpool day into a parent/dancer-friendly text snippet.
 */
export function formatCarpoolShareText(dayOfWeek, cp = {}) {
  const toDriver = cp.toDriver || "TBD";
  const toTime = cp.toTime || "TBD";
  const toNote = cp.toNote ? ` (${cp.toNote})` : "";
  const homeDriver = cp.homeDriver || "TBD";
  const homeTime = cp.homeTime || "TBD";
  const homeNote = cp.homeNote ? ` (${cp.homeNote})` : "";
  return `🩰 ${dayOfWeek} Dance Carpool\n• To Studio: ${toDriver} @ ${toTime}${toNote}\n• Home: ${homeDriver} @ ${homeTime}${homeNote}`;
}

// ============================================================================
// BROWSER RUNTIME CONTROLLER
// ============================================================================

if (typeof document !== "undefined") {
  let state = loadLocalState();
  let auth = loadDeviceAuth();
  let syncStatus = "offline"; // "synced" | "syncing" | "offline"
  let hasPendingCloudPush = false;
  let activeEditSlotId = null;
  let activeManualSection = "quickstart";
  let toastTimer = null;
  const scheduleCloudPush = createDebouncedPush(1500);

  function hapticTap() {
    try {
      if (navigator.vibrate) navigator.vibrate(10);
    } catch (_e) {}
  }

  function showToast(msg) {
    const el = document.getElementById("toastNotification");
    if (!el || !msg) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.add("hidden");
    }, 2600);
  }

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
        school_dance: Array.isArray(incoming.schedules?.school_dance) ? incoming.schedules.school_dance : base.schedules.school_dance,
        competition: Array.isArray(incoming.schedules?.competition) ? incoming.schedules.competition : base.schedules.competition,
        recovery: Array.isArray(incoming.schedules?.recovery) ? incoming.schedules.recovery : base.schedules.recovery
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
    const { rolledOver, nextState } = applyRolloverState(state, getLocalDateString());
    if (rolledOver) {
      state = nextState;
    }
  }

  async function silentPushToCloud() {
    if (!auth?.unlocked || !auth?.passphrase) return false;
    const url = state.googleSheetWebAppUrl || auth.syncUrl;
    if (!url) return false;
    setSyncIndicator("syncing");
    try {
      const encrypted = await encryptBundle(buildSyncPayload(), auth.passphrase);
      const res = await pushToCloud(url, encrypted, state.viewerRole || "Dancer");
      setSyncIndicator(res.ok ? "synced" : "offline");
      return res.ok;
    } catch (_err) {
      setSyncIndicator("offline");
      return false;
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
    if (!skipPush && auth?.unlocked && auth?.passphrase && (state.googleSheetWebAppUrl || auth.syncUrl)) {
      hasPendingCloudPush = true;
      setSyncIndicator("syncing");
      scheduleCloudPush(async () => {
        hasPendingCloudPush = false;
        await silentPushToCloud();
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

  async function silentPullFromCloud({ passphraseOverride = "", urlOverride = "", allowWhenLocked = false } = {}) {
    if (!allowWhenLocked && hasPendingCloudPush) {
      return { ok: true, skipped: true };
    }
    const url = urlOverride || state.googleSheetWebAppUrl || auth?.syncUrl;
    const passphrase = passphraseOverride || auth?.passphrase;
    if (!url || !passphrase) {
      setSyncIndicator("offline");
      return { ok: false, reason: "missing_config" };
    }
    setSyncIndicator("syncing");
    const res = await pullFromCloud(url);
    if (!res.ok) {
      setSyncIndicator("offline");
      return { ok: false, reason: "network" };
    }
    if (!res.payload) {
      setSyncIndicator("synced");
      return { ok: true, empty: true };
    }
    try {
      const decrypted = await decryptBundle(res.payload, passphrase);
      const prevUiState = {
        activeTab: state.activeTab,
        historyRange: state.historyRange,
        foodFilter: state.foodFilter,
        foodSearchQuery: document.getElementById("foodSearchInput")?.value ?? ""
      };
      const gearModalEl = document.getElementById("gearModal");
      const wasGearModalOpen = gearModalEl ? !gearModalEl.classList.contains("hidden") : false;

      state = mergeState(createDefaultState(), {
        ...decrypted,
        activeTab: prevUiState.activeTab,
        historyRange: prevUiState.historyRange,
        foodFilter: prevUiState.foodFilter,
        googleSheetWebAppUrl: url
      });
      localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(state));
      setSyncIndicator("synced");
      renderAll();

      const searchEl = document.getElementById("foodSearchInput");
      if (searchEl && searchEl.value !== prevUiState.foodSearchQuery) {
        searchEl.value = prevUiState.foodSearchQuery;
        renderFoodView();
      }
      if (gearModalEl) {
        gearModalEl.classList.toggle("hidden", !wasGearModalOpen);
      }
      return { ok: true };
    } catch (_err) {
      setSyncIndicator("offline");
      return { ok: false, reason: "decrypt" };
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

  function renderBagChecklistInto(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = state.bagItems
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

  function renderTodayBagCard() {
    const total = state.bagItems.length;
    const packed = state.bagItems.filter((item) => !!state.bagChecked[item.id]).length;
    const progEl = document.getElementById("todayBagProgress");
    if (progEl) {
      progEl.textContent = `${packed}/${total} packed`;
      progEl.className = `pill-badge ${packed === total && total > 0 ? "badge-safe" : "badge-caution"}`;
    }
    renderBagChecklistInto("todayBagChecklist");
  }

  function renderSymptomQuickTags() {
    const container = document.getElementById("symptomQuickTags");
    if (!container) return;
    const notesLower = (state.dailyNotes || "").toLowerCase();
    container.innerHTML = SYMPTOM_QUICK_TAGS.map((tag) => {
      const isActive = notesLower.includes(tag.toLowerCase());
      return `<button type="button" class="symptom-tag-btn ${isActive ? "active" : ""}" data-symptom-tag="${esc(tag)}">${isActive ? "✓ " : "+ "}${esc(tag)}</button>`;
    }).join("");
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

    // Bag checklist & symptom tags & notes
    renderTodayBagCard();
    renderSymptomQuickTags();
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
          <p class="muted-text">Load a balanced dance routine template or tap + Quick Log above.</p>
          <button type="button" id="loadRoutineTemplateBtn" class="btn-primary btn-sm">Load Dance Routine Template</button>
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
                ${slot.isAdHoc ? `<span class="slot-adhoc-tag">Quick Log</span>` : ""}
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
            <div class="slot-actions">
              <button type="button" class="slot-action-btn" data-edit-slot="${esc(slot.id)}" aria-label="Edit ${esc(opt.name)}" title="Edit entry">✏️</button>
              <button type="button" class="slot-action-btn delete-btn" data-delete-slot="${esc(slot.id)}" aria-label="Delete ${esc(opt.name)}" title="Delete entry">🗑️</button>
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
        const isCustom = !!(item.isCustom || String(item.id || "").startsWith("custom_"));
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
            <div class="food-card-actions">
              <button type="button" class="btn-secondary btn-sm" data-log-food="${esc(item.id)}">+ Log to Today</button>
              ${isCustom ? `<button type="button" class="slot-action-btn delete-btn" data-delete-food="${esc(item.id)}" aria-label="Delete ${esc(item.name)}" title="Delete custom food">🗑️</button>` : ""}
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
        isCustom: true,
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
      showToast("Saved to Food Library");
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

    renderBagChecklistInto("gearBagChecklist");
  }

  function renderManualModal() {
    const tabsEl = document.getElementById("manualTabs");
    const bodyEl = document.getElementById("manualContent");
    if (!tabsEl || !bodyEl) return;

    tabsEl.innerHTML = MANUAL_SECTIONS.map(
      (sec) => `<button type="button" class="pill-btn ${sec.id === activeManualSection ? "active" : ""}" data-manual-tab="${esc(sec.id)}">${esc(sec.label)}</button>`
    ).join("");

    const active = MANUAL_SECTIONS.find((s) => s.id === activeManualSection) || MANUAL_SECTIONS[0];
    bodyEl.innerHTML = `
      <h4>${esc(active.title)}</h4>
      <ul>
        ${active.items.map((item) => `<li>${item}</li>`).join("")}
      </ul>
    `;
  }

  // ==========================================================================
  // MODAL HELPERS & ACTIONS
  // ==========================================================================

  function updateQuickLogSafetyBadge() {
    const badge = document.getElementById("logGbSafetyBadge");
    if (!badge) return;
    const targets = getCalculatedTargets(state.profile);
    const na = parseFloat(document.getElementById("logItemSodium")?.value) || 0;
    const fat = parseFloat(document.getElementById("logItemFat")?.value) || 0;
    const kcal = parseFloat(document.getElementById("logItemKcal")?.value) || 0;
    const safety = evaluateFoodSafety(na, fat, kcal, targets.maxMealFat);
    const cls = safety.gbRating.status === "safe" ? "badge-safe" : safety.gbRating.status === "caution" ? "badge-caution" : "badge-avoid";
    badge.className = `pill-badge ${cls}`;
    badge.textContent = safety.gbRating.status === "safe"
      ? `✓ GB-Safe (${fat}g ≤ ${targets.maxMealFat}g cap)`
      : `⚠️ ${safety.gbRating.label} (${fat}g > ${targets.maxMealFat}g cap)`;
  }

  function openQuickLogModal(slotId = null) {
    activeEditSlotId = slotId;
    const modal = document.getElementById("quickLogModal");
    const titleEl = document.getElementById("quickLogModalTitle");
    const presetsEl = document.getElementById("quickLogPresets");
    const searchEl = document.getElementById("logCatalogSearch");
    const suggEl = document.getElementById("logCatalogSuggestions");

    if (presetsEl) {
      presetsEl.innerHTML = QUICK_LOG_PRESETS.map(
        (p) => `<button type="button" class="preset-chip" data-preset-id="${esc(p.id)}">${esc(p.label)}</button>`
      ).join("");
    }
    if (searchEl) searchEl.value = "";
    if (suggEl) {
      suggEl.innerHTML = "";
      suggEl.classList.add("hidden");
    }

    const nowStr = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (slotId) {
      const slots = state.schedules[state.dayMode] || [];
      const slot = slots.find((s) => s.id === slotId);
      const optIdx = state.selectedOptionIdx[slotId] || 0;
      const opt = slot?.options?.[optIdx] || slot?.options?.[0];
      if (titleEl) titleEl.textContent = "Edit Fuel / Hydration Entry";
      document.getElementById("logItemName").value = opt?.name || "";
      document.getElementById("logItemTime").value = slot?.time || nowStr;
      document.getElementById("logItemPortion").value = opt?.basePortion || "";
      document.getElementById("logItemSodium").value = opt?.sodium ?? 0;
      document.getElementById("logItemWater").value = opt?.water ?? 0;
      document.getElementById("logItemFat").value = opt?.fat ?? 0;
      document.getElementById("logItemKcal").value = opt?.kcal ?? 0;
    } else {
      if (titleEl) titleEl.textContent = "Quick Log Fuel & Hydration";
      document.getElementById("logItemName").value = "";
      document.getElementById("logItemTime").value = nowStr;
      document.getElementById("logItemPortion").value = "";
      document.getElementById("logItemSodium").value = 500;
      document.getElementById("logItemWater").value = 16;
      document.getElementById("logItemFat").value = 0;
      document.getElementById("logItemKcal").value = 45;
    }

    updateQuickLogSafetyBadge();
    modal?.classList.remove("hidden");
  }

  function closeQuickLogModal() {
    activeEditSlotId = null;
    document.getElementById("quickLogModal")?.classList.add("hidden");
  }

  function addFoodSlotToToday(name, baseServing, kcal, sodium, fat, water = 12, customTime = "") {
    const slots = state.schedules[state.dayMode] || [];
    const id = `adhoc_${Date.now()}`;
    slots.push({
      id,
      isAdHoc: true,
      time: customTime || new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      phase: "Quick Log",
      location: "Logged",
      intensity: "moderate",
      options: [{ name, basePortion: baseServing, kcal, sodium, water, fat }]
    });
    state.schedules[state.dayMode] = slots;
    state.checkedSlots[id] = true;
    state.activeTab = "today";
    saveAndSync();
    renderAll();
    showToast(`Logged: ${name}`);
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

  async function shareOrCopyText(text, title, successToast) {
    try {
      if (navigator.share) {
        await navigator.share({ title, text });
        return;
      }
    } catch (_err) {
      // Fall back to clipboard if user cancels or share fails
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        showToast(successToast);
        return;
      }
    } catch (_err) {}
    showToast("Copy ready — select and copy text manually");
  }

  // ==========================================================================
  // EVENT WIRING & BOOTSTRAP
  // ==========================================================================

  function wireEvents() {
    // Tactile haptic tap on buttons
    document.addEventListener("click", (e) => {
      if (e.target.closest("button")) hapticTap();
    });

    // Contextual ℹ️ info buttons
    document.addEventListener("click", (e) => {
      const infoBtn = e.target.closest("[data-info-topic]");
      if (!infoBtn) return;
      const topic = CLINICAL_INFO_TOPICS[infoBtn.getAttribute("data-info-topic")];
      if (!topic) return;
      document.getElementById("infoModalTitle").textContent = topic.title;
      document.getElementById("infoModalBody").textContent = topic.body;
      document.getElementById("infoModal")?.classList.remove("hidden");
    });
    document.getElementById("closeInfoModalBtn")?.addEventListener("click", () => {
      document.getElementById("infoModal")?.classList.add("hidden");
    });
    document.getElementById("infoGotItBtn")?.addEventListener("click", () => {
      document.getElementById("infoModal")?.classList.add("hidden");
    });

    // Quick Start Guide & Manual modal
    document.getElementById("openManualBtn")?.addEventListener("click", () => {
      renderManualModal();
      document.getElementById("manualModal")?.classList.remove("hidden");
    });
    document.getElementById("closeManualBtn")?.addEventListener("click", () => {
      document.getElementById("manualModal")?.classList.add("hidden");
    });
    document.getElementById("manualTabs")?.addEventListener("click", (e) => {
      const tab = e.target.closest("[data-manual-tab]");
      if (!tab) return;
      activeManualSection = tab.getAttribute("data-manual-tab");
      renderManualModal();
    });

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

    // Quick bonus +/- buttons
    document.getElementById("addBonusSodiumBtn")?.addEventListener("click", () => {
      state.bonusSodium = adjustBonusValue(state.bonusSodium, 500);
      saveAndSync();
      renderTodayView();
    });
    document.getElementById("subBonusSodiumBtn")?.addEventListener("click", () => {
      state.bonusSodium = adjustBonusValue(state.bonusSodium, -500);
      saveAndSync();
      renderTodayView();
    });
    document.getElementById("addBonusWaterBtn")?.addEventListener("click", () => {
      state.bonusWater = adjustBonusValue(state.bonusWater, 8);
      saveAndSync();
      renderTodayView();
    });
    document.getElementById("subBonusWaterBtn")?.addEventListener("click", () => {
      state.bonusWater = adjustBonusValue(state.bonusWater, -8);
      saveAndSync();
      renderTodayView();
    });

    // Collapsible Today Dance Bag Checklist
    document.getElementById("toggleTodayBagBtn")?.addEventListener("click", () => {
      const btn = document.getElementById("toggleTodayBagBtn");
      const body = document.getElementById("todayBagBody");
      const expanded = btn?.getAttribute("aria-expanded") === "true";
      btn?.setAttribute("aria-expanded", String(!expanded));
      body?.classList.toggle("hidden", expanded);
    });
    document.getElementById("todayBagChecklist")?.addEventListener("change", (e) => {
      const id = e.target.getAttribute("data-bag-check");
      if (!id) return;
      state.bagChecked[id] = e.target.checked;
      saveAndSync();
      renderTodayBagCard();
      renderGearModal();
    });

    // Symptom Quick Tags
    document.getElementById("symptomQuickTags")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-symptom-tag]");
      if (!btn) return;
      const tag = btn.getAttribute("data-symptom-tag");
      const current = (state.dailyNotes || "").trim();
      const parts = current ? current.split(",").map((s) => s.trim()).filter(Boolean) : [];
      const existingIdx = parts.findIndex((p) => p.toLowerCase() === tag.toLowerCase());
      if (existingIdx >= 0) {
        parts.splice(existingIdx, 1);
      } else {
        parts.push(tag);
      }
      state.dailyNotes = parts.join(", ");
      const notesEl = document.getElementById("dailyNotesInput");
      if (notesEl) notesEl.value = state.dailyNotes;
      saveAndSync();
      renderSymptomQuickTags();
    });

    // Daily notes
    document.getElementById("dailyNotesInput")?.addEventListener("input", (e) => {
      state.dailyNotes = e.target.value;
      saveAndSync();
      renderSymptomQuickTags();
    });

    // Slot check / option change / edit / delete / template loader delegation
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

    document.getElementById("todaySlotsList")?.addEventListener("click", (e) => {
      const editBtn = e.target.closest("[data-edit-slot]");
      if (editBtn) {
        openQuickLogModal(editBtn.getAttribute("data-edit-slot"));
        return;
      }
      const delBtn = e.target.closest("[data-delete-slot]");
      if (delBtn) {
        const id = delBtn.getAttribute("data-delete-slot");
        const slots = state.schedules[state.dayMode] || [];
        state.schedules[state.dayMode] = slots.filter((s) => s.id !== id);
        delete state.checkedSlots[id];
        delete state.selectedOptionIdx[id];
        saveAndSync();
        renderTodayView();
        showToast("Entry removed");
        return;
      }
      if (e.target.closest("#loadRoutineTemplateBtn")) {
        state.schedules[state.dayMode] = cloneScheduleTemplate(state.dayMode);
        saveAndSync();
        renderTodayView();
        showToast("Routine template loaded");
      }
    });

    // Quick Log modal wiring
    document.getElementById("quickAddSlotBtn")?.addEventListener("click", () => openQuickLogModal(null));
    document.getElementById("closeQuickLogBtn")?.addEventListener("click", closeQuickLogModal);
    document.getElementById("cancelQuickLogBtn")?.addEventListener("click", closeQuickLogModal);

    document.getElementById("quickLogPresets")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-preset-id]");
      if (!btn) return;
      const preset = QUICK_LOG_PRESETS.find((p) => p.id === btn.getAttribute("data-preset-id"));
      if (!preset) return;
      document.getElementById("logItemName").value = preset.name;
      document.getElementById("logItemPortion").value = preset.portion;
      document.getElementById("logItemSodium").value = preset.sodium;
      document.getElementById("logItemWater").value = preset.water;
      document.getElementById("logItemFat").value = preset.fat;
      document.getElementById("logItemKcal").value = preset.kcal;
      updateQuickLogSafetyBadge();
    });

    document.getElementById("logCatalogSearch")?.addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      const suggEl = document.getElementById("logCatalogSuggestions");
      if (!suggEl) return;
      if (q.length < 2) {
        suggEl.innerHTML = "";
        suggEl.classList.add("hidden");
        return;
      }
      const matches = state.foodLibrary.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 6);
      if (!matches.length) {
        suggEl.classList.add("hidden");
        return;
      }
      suggEl.classList.remove("hidden");
      suggEl.innerHTML = matches
        .map(
          (m) => `<button type="button" class="catalog-suggestion-item" data-suggest-food="${esc(m.id)}">
            <span>${esc(m.name)}</span>
            <span class="muted-text">${m.sodium}mg Na • ${m.fat}g fat</span>
          </button>`
        )
        .join("");
    });

    document.getElementById("logCatalogSuggestions")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-suggest-food]");
      if (!btn) return;
      const item = state.foodLibrary.find((f) => f.id === btn.getAttribute("data-suggest-food"));
      if (!item) return;
      document.getElementById("logItemName").value = item.name;
      document.getElementById("logItemPortion").value = item.baseServing;
      document.getElementById("logItemSodium").value = item.sodium;
      document.getElementById("logItemWater").value = item.water || 8;
      document.getElementById("logItemFat").value = item.fat;
      document.getElementById("logItemKcal").value = item.kcal;
      document.getElementById("logCatalogSuggestions")?.classList.add("hidden");
      updateQuickLogSafetyBadge();
    });

    ["logItemSodium", "logItemFat", "logItemKcal"].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", updateQuickLogSafetyBadge);
    });

    document.getElementById("quickLogForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("logItemName")?.value.trim();
      if (!name) return;
      const time = document.getElementById("logItemTime")?.value.trim() || new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const portion = document.getElementById("logItemPortion")?.value.trim() || "1 serving";
      const sodium = parseFloat(document.getElementById("logItemSodium")?.value) || 0;
      const water = parseFloat(document.getElementById("logItemWater")?.value) || 0;
      const fat = parseFloat(document.getElementById("logItemFat")?.value) || 0;
      const kcal = parseFloat(document.getElementById("logItemKcal")?.value) || 0;

      if (activeEditSlotId) {
        const slots = state.schedules[state.dayMode] || [];
        const slot = slots.find((s) => s.id === activeEditSlotId);
        if (slot) {
          slot.time = time;
          const optIdx = state.selectedOptionIdx[activeEditSlotId] || 0;
          if (!slot.options) slot.options = [];
          slot.options[optIdx] = { name, basePortion: portion, kcal, sodium, water, fat };
          saveAndSync();
          renderAll();
          showToast("Entry updated");
        }
        closeQuickLogModal();
      } else {
        closeQuickLogModal();
        addFoodSlotToToday(name, portion, kcal, sodium, fat, water, time);
      }
    });

    // Food search, filters & custom food management
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
      const logBtn = e.target.closest("[data-log-food]");
      if (logBtn) {
        const id = logBtn.getAttribute("data-log-food");
        const item = state.foodLibrary.find((f) => f.id === id);
        if (item) {
          addFoodSlotToToday(item.name, item.baseServing, item.kcal, item.sodium, item.fat, item.water || 12);
        }
        return;
      }
      const delBtn = e.target.closest("[data-delete-food]");
      if (delBtn) {
        const id = delBtn.getAttribute("data-delete-food");
        state.foodLibrary = state.foodLibrary.filter((f) => f.id !== id);
        saveAndSync();
        renderFoodView();
        showToast("Custom food removed");
      }
    });

    document.getElementById("openAddCustomFoodBtn")?.addEventListener("click", () => {
      document.getElementById("customFoodForm")?.reset();
      document.getElementById("customFoodModal")?.classList.remove("hidden");
    });
    document.getElementById("closeCustomFoodBtn")?.addEventListener("click", () => {
      document.getElementById("customFoodModal")?.classList.add("hidden");
    });
    document.getElementById("cancelCustomFoodBtn")?.addEventListener("click", () => {
      document.getElementById("customFoodModal")?.classList.add("hidden");
    });
    document.getElementById("customFoodForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("customFoodName")?.value.trim();
      if (!name) return;
      state.foodLibrary.unshift({
        id: "custom_" + Date.now(),
        isCustom: true,
        name,
        baseServing: document.getElementById("customFoodServing")?.value.trim() || "1 serving",
        category: document.getElementById("customFoodCategory")?.value || "Custom",
        sodium: parseFloat(document.getElementById("customFoodSodium")?.value) || 0,
        water: parseFloat(document.getElementById("customFoodWater")?.value) || 0,
        fat: parseFloat(document.getElementById("customFoodFat")?.value) || 0,
        kcal: parseFloat(document.getElementById("customFoodKcal")?.value) || 0
      });
      saveAndSync();
      renderFoodView();
      document.getElementById("customFoodModal")?.classList.add("hidden");
      showToast(`Added "${name}" to Library`);
    });

    // Carpool day switcher, editor & 1-tap share
    document.querySelectorAll("[data-carpool-day]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.dayOfWeek = btn.getAttribute("data-carpool-day");
        renderCarpoolView();
      });
    });

    document.getElementById("toggleCarpoolEditBtn")?.addEventListener("click", () => {
      document.getElementById("carpoolEditForm")?.classList.toggle("hidden");
    });

    document.getElementById("shareCarpoolBtn")?.addEventListener("click", async () => {
      const cp = state.carpool[state.dayOfWeek] || {};
      const text = formatCarpoolShareText(state.dayOfWeek, cp);
      await shareOrCopyText(text, `${state.dayOfWeek} Dance Carpool`, "Carpool details copied!");
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
      showToast("Carpool updated");
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
      showToast("Settings saved");
    });

    document.getElementById("gearBagChecklist")?.addEventListener("change", (e) => {
      const id = e.target.getAttribute("data-bag-check");
      if (!id) return;
      state.bagChecked[id] = e.target.checked;
      saveAndSync();
      renderGearModal();
      renderTodayBagCard();
    });

    document.getElementById("gearSyncNowBtn")?.addEventListener("click", async () => {
      const syncUrl = document.getElementById("gearSyncUrlInput")?.value.trim() || "";
      state.googleSheetWebAppUrl = syncUrl;
      const res = await silentPullFromCloud();
      showToast(res.ok ? "Synced with Cloud" : "Cloud sync offline");
    });

    // Pair Another Device Modal
    document.getElementById("openPairDeviceBtn")?.addEventListener("click", () => {
      const syncUrl = document.getElementById("gearSyncUrlInput")?.value.trim() || state.googleSheetWebAppUrl || auth.syncUrl || "";
      const linkInput = document.getElementById("pairLinkInput");
      const warnEl = document.getElementById("pairNoUrlWarn");
      if (syncUrl) {
        const base = `${window.location.origin}${window.location.pathname}`;
        if (linkInput) linkInput.value = `${base}#sync=${encodeURIComponent(syncUrl)}`;
        warnEl?.classList.add("hidden");
      } else {
        if (linkInput) linkInput.value = "";
        warnEl?.classList.remove("hidden");
      }
      document.getElementById("pairDeviceModal")?.classList.remove("hidden");
    });
    document.getElementById("closePairDeviceBtn")?.addEventListener("click", () => {
      document.getElementById("pairDeviceModal")?.classList.add("hidden");
    });
    document.getElementById("copyPairLinkBtn")?.addEventListener("click", async () => {
      const link = document.getElementById("pairLinkInput")?.value;
      if (!link) return;
      try {
        await navigator.clipboard.writeText(link);
        showToast("Pairing link copied!");
      } catch (_e) {
        showToast("Select and copy the pairing link above");
      }
    });
    document.getElementById("sharePairLinkBtn")?.addEventListener("click", async () => {
      const link = document.getElementById("pairLinkInput")?.value;
      if (!link) return;
      await shareOrCopyText(
        `Tap to pair En Pointe & Steady (only Family PIN needed): ${link}`,
        "En Pointe & Steady Device Pairing",
        "Pairing link copied!"
      );
    });

    // Change Family PIN Modal
    document.getElementById("openChangePinBtn")?.addEventListener("click", () => {
      document.getElementById("changePinForm")?.reset();
      const errEl = document.getElementById("changePinError");
      if (errEl) errEl.textContent = "";
      document.getElementById("changePinModal")?.classList.remove("hidden");
    });
    document.getElementById("closeChangePinBtn")?.addEventListener("click", () => {
      document.getElementById("changePinModal")?.classList.add("hidden");
    });
    document.getElementById("cancelChangePinBtn")?.addEventListener("click", () => {
      document.getElementById("changePinModal")?.classList.add("hidden");
    });
    document.getElementById("changePinForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const cur = document.getElementById("changePinCurrent")?.value.trim() || "";
      const next = document.getElementById("changePinNew")?.value.trim() || "";
      const conf = document.getElementById("changePinConfirm")?.value.trim() || "";
      const errEl = document.getElementById("changePinError");

      if (auth.passphrase && cur !== auth.passphrase) {
        if (errEl) errEl.textContent = "Current PIN is incorrect.";
        return;
      }
      if (next.length < 4) {
        if (errEl) errEl.textContent = "New PIN must be at least 4 characters.";
        return;
      }
      if (next !== conf) {
        if (errEl) errEl.textContent = "New PIN and confirmation do not match.";
        return;
      }

      if (errEl) errEl.textContent = "";
      saveDeviceAuth({ ...auth, unlocked: true, passphrase: next });
      hasPendingCloudPush = false;
      saveAndSync({ skipPush: true });
      const pushed = await silentPushToCloud();
      document.getElementById("changePinModal")?.classList.add("hidden");
      document.getElementById("changePinForm")?.reset();
      showToast(pushed ? "Family PIN updated & cloud re-encrypted!" : "Family PIN updated locally");
    });

    document.getElementById("lockAppBtn")?.addEventListener("click", () => {
      hasPendingCloudPush = false;
      saveDeviceAuth({ unlocked: false, passphrase: "", syncUrl: state.googleSheetWebAppUrl || "", rememberDevice: true });
      const pinInput = document.getElementById("pinInput");
      if (pinInput) pinInput.value = "";
      const errEl = document.getElementById("pinErrorMsg");
      if (errEl) errEl.textContent = "";
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

      if (syncUrl) {
        const pullResult = await silentPullFromCloud({
          passphraseOverride: pin,
          urlOverride: syncUrl,
          allowWhenLocked: true
        });
        if (!pullResult.ok && pullResult.reason === "decrypt") {
          if (errEl) errEl.textContent = "Incorrect PIN — could not decrypt cloud sync bundle.";
          return;
        }
        if (!pullResult.ok && errEl) {
          errEl.textContent = "Unlocked locally (cloud sync unavailable).";
        }
      }

      state.googleSheetWebAppUrl = syncUrl;
      saveDeviceAuth({ unlocked: true, passphrase: pin, syncUrl, rememberDevice: remember });
      document.getElementById("pinOverlay")?.classList.add("hidden");
      renderAll();
    });

    window.addEventListener("focus", () => {
      if (auth.unlocked) silentPullFromCloud();
    });
  }

  function initApp() {
    // Support #sync=<url> or ?sync=<url> pairing parameter without manual URL typing
    const paramSync = parseSyncHashOrQuery(window.location.search, window.location.hash);
    if (paramSync) {
      state.googleSheetWebAppUrl = paramSync;
      try {
        localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(state));
      } catch (_e) {}
      const pinUrlInput = document.getElementById("pinSyncUrlInput");
      if (pinUrlInput) pinUrlInput.value = paramSync;
      if (window.location.hash.includes("sync=")) {
        try {
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        } catch (_e) {}
      }
      showToast("Sync link detected! Enter Family PIN to unlock.");
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
