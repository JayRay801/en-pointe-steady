/**
 * app.js — En Pointe & Steady (Calm Studio Wellness PWA)
 * Zero PII: Generic defaults only; family data is decrypted in-browser from Cloud_Sync_Store.
 * Exports pure helpers for Node testing; DOM initialization is guarded behind typeof document !== "undefined".
 */

import {
  DEFAULT_FOOD_LIBRARY,
  NUTRITION_SOURCES,
  evaluateFoodSafety,
  estimateNutritionForQuery,
  lookupFoodOpenFoodFacts
} from "./foods.js";
import {
  encryptBundle,
  decryptBundle,
  pullFromCloud,
  pushToCloud,
  createDebouncedPush,
  resolveFamilySupportPhone,
  buildSmsHelpUri,
  GOOGLE_AUTH_PREP_SPEC,
  prepareGoogleSignInConfig
} from "./crypto.js";
import {
  getLocalDateString,
  computeDailyTotals,
  computeDailyScore,
  snapshotToday,
  upsertPastHistoryEntry,
  filterHistory,
  computeHistoryStats,
  generateHistoryCsv,
  renderDoctorReportHtml
} from "./history.js";

export const STORAGE_STATE_KEY = "epsteady_state_v2";
export const STORAGE_AUTH_KEY = "epsteady_device_auth_v2";

export const DEFAULT_BAG_ITEMS = [
  { id: "bag_1", text: "2× 24oz Electrolyte Water Bottles", tag: "POTS Essential" },
  { id: "bag_2", text: "2 Extra Electrolyte Stick Packs", tag: "Emergency Salt" },
  { id: "bag_3", text: "Salted Pretzel Pouches or Rice Rollers", tag: "Between Classes" },
  { id: "bag_4", text: "Food Thermos with Warm Low-Fat Soup", tag: "Evening Break" },
  { id: "bag_5", text: "2× Unsweetened Applesauce Pouches", tag: "Quick Carbs" },
  { id: "bag_6", text: "Ice Pack + Lean Turkey & Pickle Spears", tag: "Lean Protein" },
  { id: "bag_7", text: "Car-Ride Recovery Meal Container", tag: "Stomach Safe" },
  { id: "bag_8", text: "Compression Socks for ride home", tag: "POTS Recovery" }
];

export const RESCUE_PROTOCOLS = {
  steady: null,
  dizzy: {
    title: "2-Minute Studio Sideline Salt & Water Rescue",
    body: "1) Sit on the studio floor with knees pulled up or legs crossed. 2) Drink 8–12 oz cold electrolyte water or take a salt packet / 6 salted pretzels right away. 3) Flex calf & thigh muscles before standing up slowly."
  },
  tired: {
    title: "Quick Low-Fat Dance Energy Boost",
    body: "Pair quick energy carbs with salt — like an applesauce pouch + salted pretzels, or half a banana + electrolyte drink. Skip high-fat nuts or heavy protein bars during dance."
  },
  stomach: {
    title: "Gentle Stomach Soothing Mode",
    body: "Keep fat super low — 0g to 2g — for the next two meals or snacks. Sip warm chicken broth, miso soup, or tea with plain salted crackers or rice cakes so your stomach can relax while keeping salt steady."
  }
};

export const QUICK_LOG_PRESETS = [
  { id: "p_lmnt", label: "LMNT • 1000mg", name: "LMNT Electrolyte Packet", portion: "16oz water + 1 packet", sodium: 1000, water: 16, fat: 0, kcal: 5 },
  { id: "p_liquidiv", label: "Liquid I.V. • 500mg", name: "Liquid I.V. Hydration", portion: "16oz water + 1 stick", sodium: 500, water: 16, fat: 0, kcal: 45 },
  { id: "p_trioral", label: "TriOral • 1000mg", name: "TriOral ORS Packet", portion: "32oz water + 1 packet", sodium: 1000, water: 32, fat: 0, kcal: 40 },
  { id: "p_pretzels", label: "Pretzels • 850mg", name: "Salted Mini Pretzels", portion: "15–20 twists, ~1.5 oz", sodium: 850, water: 0, fat: 0.5, kcal: 130 },
  { id: "p_broth", label: "Bone Broth • 580mg", name: "Warm Chicken Bone Broth", portion: "12oz warm mug", sodium: 580, water: 12, fat: 0.5, kcal: 45 },
  { id: "p_applesauce", label: "Applesauce", name: "Unsweetened Applesauce Pouch", portion: "1 squeeze pouch", sodium: 0, water: 4, fat: 0, kcal: 60 },
  { id: "p_saltstick", label: "SaltStick • 215mg", name: "SaltStick Caps / Vitassium", portion: "1 capsule + water", sodium: 215, water: 4, fat: 0, kcal: 0 }
];

export const SYMPTOM_QUICK_TAGS = [
  "Lightheaded at barre",
  "Fast heartbeat",
  "Brain fog",
  "Heavy legs",
  "Sensitive stomach",
  "Hot studio"
];

/**
 * Simple, warm, non-technical explanations for `ℹ` Info buttons (Requirement 2).
 * Zero technical jargon (no encryption acronyms, no backend URLs, no complex medical lingo).
 */
export const CLINICAL_INFO_TOPICS = {
  sodium: {
    title: "Why Extra Salt Helps Dancers With POTS",
    body: "Salt helps the body hold onto water so blood flows smoothly during turns, jumps, and long rehearsals. That keeps dizziness away and energy steady! Tap +500 or -500 anytime to adjust."
  },
  water: {
    title: "Smart Hydration & Salt Pairing",
    body: "The daily water goal automatically adjusts based on that day's dance classes, adding 8 oz for every hour of dance. Always pair plain water with an electrolyte drink or salty snack so the body absorbs it instead of flushing it right out."
  },
  gb: {
    title: "Gentle on the Stomach",
    body: "Meals with too much grease or heavy fat — like fried food, extra cheese, or creamy sauces — can cause stomach cramps or nausea during dance. Keeping each meal or snack under the fat limit keeps digestion calm and comfortable."
  },
  dayMode: {
    title: "Choosing Today's Routine",
    body: "Pick the routine that fits today—School + Studio, Competition, or Recovery. Each routine saves its own meal plan, and any extra snacks added with '+ Quick Log' reset cleanly at midnight for a fresh start tomorrow."
  },
  doctorOverride: {
    title: "Custom Doctor Goals",
    body: "Turn this on if the doctor gave specific daily numbers for salt, water, meal fat limit, or calories instead of using the automatic calculator."
  },
  sync: {
    title: "Sharing Between Family Phones",
    body: "Your Family PIN keeps the schedule, carpool rides, and daily logs private and shared between Dancer's and Mom's phones. Tap 'Share With Family' to text a 1-tap setup link to another family phone."
  },
  score: {
    title: "Daily Target Score",
    body: "The Daily Score shows how closely the daily salt, water, and stomach-safe meal goals were hit. Green 80%+ means most goals were hit, Yellow 50–79% means partway there, and Red under 50% is a gentle reminder to fuel and hydrate."
  }
};

/**
 * Simple, user-friendly Quick Start Guide & Manual sections (Requirement 2).
 */
export const MANUAL_SECTIONS = [
  {
    id: "quickstart",
    label: "Quick Start",
    title: "Easy Daily Routine in 60 Seconds",
    items: [
      "<strong>Check off meals &amp; drinks:</strong> Tap the checkbox beside each meal or snack as it is finished. The Salt and Hydration rings and Daily Score update right away.",
      "<strong>Log extra drinks or snacks fast:</strong> Tap <strong>+ Quick Log</strong> to pick 1-tap favorites like LMNT, Liquid I.V., Pretzels, or Warm Broth, or search 36+ dancer foods.",
      "<strong>Watch the Daily Score:</strong> A <strong>Green</strong> score badge at 80%+ means most daily goals are hit! Missed a day? Tap <strong>+ Missed Day</strong> to fill in any past date.",
      "<strong>Switch between Dancer &amp; Mom view:</strong> Tap the <strong>🩰 Dancer ⇄</strong> pill at the top anytime."
    ]
  },
  {
    id: "schedule",
    label: "Schedule & Carpool",
    title: "Custom Daily Dance Schedule, BAND & Carpool",
    items: [
      "<strong>Month, Week &amp; Day Calendar:</strong> Open the <strong>📅 Schedule</strong> tab to view the Month calendar or switch to <strong>Week</strong> and <strong>Day</strong> timelines just like Google Calendar.",
      "<strong>Different Dance Classes Every Day:</strong> Tap <strong>+ Add Class</strong> to set each day's exact dance classes and school hours. Days with more dance automatically recommend more food, salt, and water—and rest days with 0 dance hours adjust down automatically!",
      "<strong>Sync with BAND:</strong> Tap <strong>🔄 BAND Sync</strong> in the Schedule tab to import classes from a BAND calendar file, link, or pasted schedule post.",
      "<strong>School &amp; Dance Carpool:</strong> Scroll to the <strong>🚗 Carpool</strong> section inside Schedule to see or edit both School and Dance Studio rides, or tap <strong>Share Rides</strong> to text the plan."
    ]
  },
  {
    id: "fueling",
    label: "Salt, Water & Food",
    title: "Simple Fueling Rules for Dancers",
    items: [
      "<strong>Salt + Water work together:</strong> Plain water alone passes right through. Pair every water bottle with an electrolyte mix or a salty snack so energy stays steady.",
      "<strong>Keep meals gentle on the stomach:</strong> Staying at or below the per-meal fat limit like <strong>5.5g fat per meal</strong> helps prevent stomach aches during dance.",
      "<strong>Check any food or restaurant item:</strong> Open the <strong>🥗 Food</strong> tab to search safe meals, check restaurant picks, add custom foods, or tap <strong>📚 Sources</strong> to see the trusted nutrition guides behind these numbers."
    ]
  },
  {
    id: "rescue",
    label: "Feeling & Help",
    title: "Feeling Check-Ins, Doctor Summary & Help",
    items: [
      "<strong>Quick feeling check-in:</strong> In Dancer view, a quick popup asks <em>'I feel:'</em> when opening the app so helpful tips appear right away.",
      "<strong>Print a Doctor Summary:</strong> Open <strong>History</strong> to see color-coded daily scores, log missed days from the past, or tap <strong>Doctor PDF</strong> for doctor visits.",
      "<strong>Need help? Send a quick text:</strong> Tap <strong>💬</strong> at the top of the screen, type what you need help with, and tap Send to open your text messaging app pre-filled and ready to go."
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

/**
 * Default customizable per-day weekly schedule (Mon–Sun) with varied daily dance classes and rest days (Requirement 1).
 */
export function createDefaultWeeklySchedule() {
  return {
    Mon: [
      { id: "wk_mon_1", title: "School Hours", category: "school", startTime: "08:00", endTime: "15:00", durationHours: 7.0, intensity: "light", location: "School", notes: "Pack electrolyte bottle" },
      { id: "wk_mon_2", title: "Ballet Technique & Pointe", category: "dance", startTime: "16:00", endTime: "18:00", durationHours: 2.0, intensity: "high", location: "Studio A", notes: "Pointe shoes + pretzels" }
    ],
    Tue: [
      { id: "wk_tue_1", title: "School Hours", category: "school", startTime: "08:00", endTime: "15:00", durationHours: 7.0, intensity: "light", location: "School", notes: "" },
      { id: "wk_tue_2", title: "Contemporary & Jazz Combo", category: "dance", startTime: "16:30", endTime: "18:30", durationHours: 2.0, intensity: "moderate", location: "Studio B", notes: "" },
      { id: "wk_tue_3", title: "Team Rehearsal", category: "rehearsal", startTime: "18:30", endTime: "19:30", durationHours: 1.0, intensity: "high", location: "Main Stage Room", notes: "Warm soup thermos break" }
    ],
    Wed: [
      { id: "wk_wed_1", title: "School Hours", category: "school", startTime: "08:00", endTime: "15:00", durationHours: 7.0, intensity: "light", location: "School", notes: "" },
      { id: "wk_wed_2", title: "Ballet Barre & Variations", category: "dance", startTime: "16:00", endTime: "17:30", durationHours: 1.5, intensity: "moderate", location: "Studio A", notes: "" }
    ],
    Thu: [
      { id: "wk_thu_1", title: "School Hours", category: "school", startTime: "08:00", endTime: "15:00", durationHours: 7.0, intensity: "light", location: "School", notes: "" },
      { id: "wk_thu_2", title: "Pointe, Turns & Conditioning", category: "dance", startTime: "16:00", endTime: "18:30", durationHours: 2.5, intensity: "high", location: "Studio A", notes: "High salt day" }
    ],
    Fri: [
      { id: "wk_fri_1", title: "School Hours", category: "school", startTime: "08:00", endTime: "15:00", durationHours: 7.0, intensity: "light", location: "School", notes: "Rest afternoon — no dance classes" }
    ],
    Sat: [
      { id: "wk_sat_1", title: "Saturday Company Rehearsal & Masterclass", category: "dance", startTime: "09:30", endTime: "13:00", durationHours: 3.5, intensity: "high", location: "Studio A & B", notes: "Pack 2 electrolyte bottles + lunch" }
    ],
    Sun: []
  };
}

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
    obj[d] = {
      schoolToDriver: "",
      schoolToTime: "",
      schoolToNote: "",
      schoolHomeDriver: "",
      schoolHomeTime: "",
      schoolHomeNote: "",
      toDriver: "",
      toTime: "",
      toNote: "",
      homeDriver: "",
      homeTime: "",
      homeNote: ""
    };
  }
  return obj;
}

export function createDefaultState() {
  const todayStr = getLocalDateString();
  return {
    viewerRole: "Dancer",
    dayOfWeek: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()] || "Mon",
    dayMode: "school_dance",
    activeTab: "today",
    historyRange: "7d",
    foodFilter: "all",
    calendarViewMode: "month",
    selectedCalendarDate: todayStr,
    profile: {
      name: "Dancer",
      gender: "female",
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
    personalization: {
      byRole: {
        Dancer: {
          lighting: "day",
          autoRule: "system",
          palette: "blush",
          avatar: "🩰",
          studioName: "Calm Studio Plan",
          mottoIndex: 0
        },
        Mom: {
          lighting: "auto",
          autoRule: "time",
          palette: "teal",
          avatar: "👩",
          studioName: "Calm Studio Plan",
          mottoIndex: 0
        }
      },
      theme: "studio_teal",
      avatar: "🩰",
      studioName: "Calm Studio Plan",
      motto: "Steady salt, gentle fuel, strong turns."
    },
    adminConfig: {
      adminPin: "",
      supportPhoneOverride: "",
      bandIcsUrl: "",
      lastBandSyncAt: null,
      googleAuth: prepareGoogleSignInConfig(GOOGLE_AUTH_PREP_SPEC.defaultConfig)
    },
    weeklySchedule: createDefaultWeeklySchedule(),
    dateScheduleOverrides: {},
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
    lastActiveDate: todayStr,
    history: [],
    googleSheetWebAppUrl: ""
  };
}

/**
 * Helper to compute duration in hours between two time strings ("16:00" and "18:30" or "4:00 PM" and "6:30 PM").
 */
export function computeTimeRangeDurationHours(startTimeStr, endTimeStr, fallbackHours = 1.0) {
  const parseMin = (t) => {
    const s = String(t || "").trim();
    const ampmMatch = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (ampmMatch) {
      let h = parseInt(ampmMatch[1], 10);
      const m = parseInt(ampmMatch[2], 10);
      const ap = ampmMatch[3].toUpperCase();
      if (ap === "PM" && h < 12) h += 12;
      if (ap === "AM" && h === 12) h = 0;
      return h * 60 + m;
    }
    const h24 = s.match(/^(\d{1,2}):(\d{2})$/);
    if (h24) {
      return parseInt(h24[1], 10) * 60 + parseInt(h24[2], 10);
    }
    return null;
  };
  const startM = parseMin(startTimeStr);
  const endM = parseMin(endTimeStr);
  if (startM != null && endM != null && endM > startM) {
    return parseFloat(((endM - startM) / 60).toFixed(2));
  }
  return Number(fallbackHours) || 1.0;
}

/**
 * Return the 3-letter weekday ("Mon".."Sun") for a YYYY-MM-DD date string.
 */
export function getWeekdayForDateStr(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) {
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()] || "Mon";
  }
  const [y, m, d] = String(dateStr).split("-").map((n) => parseInt(n, 10));
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getDay()] || "Mon";
}

/**
 * Return the effective scheduled events for a specific date YYYY-MM-DD (or weekday name "Mon".."Sun").
 * Checks `state.dateScheduleOverrides[dateStr]` first, then `state.weeklySchedule[dayOfWeek]`.
 */
export function getScheduleEventsForDate(state, dateOrDay = getLocalDateString()) {
  const s = state || {};
  const str = String(dateOrDay || "").trim();
  const isDate = /^\d{4}-\d{2}-\d{2}$/.test(str);
  if (isDate && s.dateScheduleOverrides && Array.isArray(s.dateScheduleOverrides[str])) {
    return s.dateScheduleOverrides[str];
  }
  const dayName = isDate ? getWeekdayForDateStr(str) : str || s.dayOfWeek || "Mon";
  const weekly = s.weeklySchedule || {};
  if (Array.isArray(weekly[dayName])) {
    return weekly[dayName];
  }
  return [];
}

/**
 * Dynamically calculate the total scheduled dance hours for a specific date or weekday (Requirement 1c & 1c.i).
 * Counts events with category in ["dance", "rehearsal", "competition"].
 * If a day has no dance classes scheduled (e.g. Friday rest day or Sunday), returns 0!
 */
export function getDanceHoursForDate(state, dateOrDay = getLocalDateString()) {
  const s = state || {};
  const hasScheduleModel =
    (s.weeklySchedule && typeof s.weeklySchedule === "object") ||
    (s.dateScheduleOverrides && typeof s.dateScheduleOverrides === "object");
  if (!hasScheduleModel) {
    return Number(s?.profile?.danceHours) || 0;
  }

  const events = getScheduleEventsForDate(s, dateOrDay);
  const danceCategories = new Set(["dance", "rehearsal", "competition"]);
  let totalHours = 0;
  for (const evt of events) {
    const cat = String(evt?.category || "dance").toLowerCase();
    if (!danceCategories.has(cat)) continue;
    const dur =
      evt.durationHours != null && Number.isFinite(Number(evt.durationHours))
        ? Number(evt.durationHours)
        : computeTimeRangeDurationHours(evt.startTime, evt.endTime, 1.0);
    totalHours += Math.max(0, dur);
  }
  return parseFloat(totalHours.toFixed(2));
}

/**
 * Parse a BAND iCal (.ics) text payload into structured dance/school schedule events (Requirement 1).
 */
export function parseBandIcsSchedule(icsText = "") {
  const raw = String(icsText || "").replace(/\r\n[ \t]/g, "");
  const blocks = raw.split(/BEGIN:VEVENT/i).slice(1);
  const events = [];

  const parseIcsDate = (val) => {
    const clean = String(val || "").trim();
    const m = clean.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
    if (!m) return null;
    const dateStr = `${m[1]}-${m[2]}-${m[3]}`;
    const timeStr = m[4] && m[5] ? `${m[4]}:${m[5]}` : "16:00";
    return { dateStr, timeStr };
  };

  blocks.forEach((blk, idx) => {
    const endIdx = blk.search(/END:VEVENT/i);
    const body = endIdx >= 0 ? blk.slice(0, endIdx) : blk;
    const getField = (name) => {
      const re = new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, "im");
      const match = body.match(re);
      return match ? match[1].trim().replace(/\\,/g, ",").replace(/\\n/g, " ") : "";
    };

    const summary = getField("SUMMARY") || `BAND Dance Class ${idx + 1}`;
    const dtStartRaw = getField("DTSTART");
    const dtEndRaw = getField("DTEND");
    const location = getField("LOCATION") || "Studio";
    const description = getField("DESCRIPTION") || "";

    const startObj = parseIcsDate(dtStartRaw);
    if (!startObj) return;
    const endObj = parseIcsDate(dtEndRaw) || {
      dateStr: startObj.dateStr,
      timeStr: "18:00"
    };

    const lowerTitle = summary.toLowerCase();
    let category = "dance";
    if (lowerTitle.includes("school")) category = "school";
    else if (lowerTitle.includes("comp")) category = "competition";
    else if (lowerTitle.includes("rehears")) category = "rehearsal";
    else if (lowerTitle.includes("carpool") || lowerTitle.includes("pickup")) category = "carpool";

    const durationHours = computeTimeRangeDurationHours(startObj.timeStr, endObj.timeStr, 1.5);
    const dayOfWeek = getWeekdayForDateStr(startObj.dateStr);

    events.push({
      id: `band_ics_${Date.now()}_${idx}`,
      title: summary,
      category,
      date: startObj.dateStr,
      dayOfWeek,
      startTime: startObj.timeStr,
      endTime: endObj.timeStr,
      durationHours,
      intensity: category === "competition" || lowerTitle.includes("pointe") ? "high" : "moderate",
      location,
      notes: description,
      source: "band"
    });
  });

  return events;
}

/**
 * Parse pasted BAND schedule text (e.g. "Mon 4:00 PM - 6:00 PM Ballet & Pointe") into schedule events (Requirement 1).
 */
export function parseBandTextSchedule(rawText = "") {
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const dayMap = {
    mon: "Mon",
    monday: "Mon",
    tue: "Tue",
    tues: "Tue",
    tuesday: "Tue",
    wed: "Wed",
    wednesday: "Wed",
    thu: "Thu",
    thur: "Thu",
    thurs: "Thu",
    thursday: "Thu",
    fri: "Fri",
    friday: "Fri",
    sat: "Sat",
    saturday: "Sat",
    sun: "Sun",
    sunday: "Sun"
  };

  const to24h = (timeToken) => {
    const m = String(timeToken || "").trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (!m) return "16:00";
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const ap = (m[3] || "").toUpperCase();
    if (ap === "PM" && h < 12) h += 12;
    else if (ap === "AM" && h === 12) h = 0;
    else if (!ap && h >= 1 && h <= 7) h += 12; // afternoon studio default for "4:00 - 6:00"
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  };

  const events = [];
  lines.forEach((line, idx) => {
    const dayMatch = line.match(/\b(monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat|sunday|sun)\b/i);
    const dayOfWeek = dayMatch ? dayMap[dayMatch[1].toLowerCase()] || "Mon" : "Mon";

    const timeMatch = line.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*(?:-|–|to)\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i);
    const startTime = timeMatch ? to24h(timeMatch[1]) : "16:00";
    const endTime = timeMatch ? to24h(timeMatch[2]) : "17:30";
    const durationHours = computeTimeRangeDurationHours(startTime, endTime, 1.5);

    let title = line;
    if (dayMatch) title = title.replace(dayMatch[0], "");
    if (timeMatch) title = title.replace(timeMatch[0], "");
    title = title.replace(/^[\s:,\-–•]+|[\s:,\-–•]+$/g, "").trim() || `Dance Class ${idx + 1}`;

    const lower = title.toLowerCase();
    const category = lower.includes("school")
      ? "school"
      : lower.includes("rehears")
      ? "rehearsal"
      : lower.includes("comp")
      ? "competition"
      : "dance";

    events.push({
      id: `band_txt_${Date.now()}_${idx}`,
      title,
      category,
      dayOfWeek,
      startTime,
      endTime,
      durationHours,
      intensity: lower.includes("pointe") || lower.includes("comp") ? "high" : "moderate",
      location: "Studio",
      notes: "Imported from BAND",
      source: "band"
    });
  });

  return events;
}

/**
 * Pure POTS & Gallbladder daily target calculation.
 * Supports:
 * - Biological sex / gender ("female" | "male") via Mifflin-St Jeor (+5 Male vs -161 Female), calorie floor, hydration & sweat scaling (Req 1d).
 * - Dynamic daily dance activity (`dailyContext?.danceHours` or `getDanceHoursForDate(dailyContext.state, dailyContext.date)`)
 *   so recommended food intake, water, and sodium dynamically adapt day-to-day (including 0 hrs on rest days)
 *   while remaining 100% backward-compatible when called as `getCalculatedTargets(profile)` (Req 1c & 1c.i).
 */
export function getCalculatedTargets(profile, dailyContext = null) {
  const p = profile || {};
  const gender = String(p.gender || "female").toLowerCase() === "male" ? "male" : "female";

  let effectiveDanceHours;
  if (dailyContext && typeof dailyContext === "object") {
    if (dailyContext.danceHours != null && Number.isFinite(Number(dailyContext.danceHours))) {
      effectiveDanceHours = Math.max(0, Number(dailyContext.danceHours));
    } else if (dailyContext.state) {
      effectiveDanceHours = getDanceHoursForDate(
        dailyContext.state,
        dailyContext.date || dailyContext.dayOfWeek || dailyContext.state.selectedCalendarDate
      );
    }
  }
  if (effectiveDanceHours == null) {
    effectiveDanceHours = Number(p.danceHours) || 0;
  }

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
      portionMultiplier: Math.max(0.65, Math.min(1.65, calories / 2150)),
      danceHours: effectiveDanceHours,
      gender
    };
  }

  const weightLbs = Number(p.weightLbs) || 110;
  const heightFt = Number(p.heightFt) || 5;
  const heightIn =
    p.heightIn != null && p.heightIn !== "" && Number.isFinite(Number(p.heightIn))
      ? Number(p.heightIn)
      : 2;
  const age = Number(p.age) || 14;
  const danceHours = effectiveDanceHours;

  const weightKg = weightLbs * 0.453592;
  const heightCm = (heightFt * 12 + heightIn) * 2.54;

  // Mifflin-St Jeor BMR: Female uses -161, Male uses +5
  const genderBmrOffset = gender === "male" ? 5 : -161;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + genderBmrOffset;

  // Dance energy burn & minimum calorie floor by gender
  const danceBurnCoeff = gender === "male" ? 4.6 : 4.2;
  const minCalorieFloor = gender === "male" ? 1800 : 1500;
  const danceBurn = weightKg * danceBurnCoeff * danceHours;
  const calories = Math.round(Math.max(minCalorieFloor, bmr * 1.35 + danceBurn));

  // Hydration target (oz/day) scales with body weight, gender, and that day's dance hours
  const waterWeightFactor = gender === "male" ? 0.67 : 0.62;
  const waterPerDanceHr = gender === "male" ? 9 : 8;
  const water = Math.round(weightLbs * waterWeightFactor + danceHours * waterPerDanceHr);

  // POTS sodium target scales with baseline level + that day's dance sweat hours
  const baseSodium = p.potsLevel === "high" ? 4500 : p.potsLevel === "mild" ? 3000 : 3600;
  const sweatSodiumPerHr = gender === "male" ? 210 : 180;
  const sodium = Math.round(baseSodium + danceHours * sweatSodiumPerHr);

  const maxMealFat = p.gbLevel === "flare" ? 2.5 : p.gbLevel === "strict" ? 4.0 : 5.5;
  const dailyFatCap = Math.round(maxMealFat * 6);
  const portionMultiplier = Math.max(0.65, Math.min(1.65, calories / 2150));

  return {
    calories,
    sodium,
    water,
    maxMealFat,
    dailyFatCap,
    portionMultiplier,
    danceHours,
    gender
  };
}

/**
 * Role-aware copy generator (Requirement 6 & 6a).
 * In Daughter's view (`viewerRole === "Dancer"`), uses warm personal check-in phrasing ("I feel:").
 * In Mom's view (`viewerRole === "Mom"`), rephrases the entire app into third-person ("The Dancer", dancer's name, "they", "their")
 * with ZERO instances of first-person "I".
 */
export function getRoleCopy(state = {}) {
  const isMom = String(state?.viewerRole || "Dancer") === "Mom";
  const rawName = String(state?.profile?.name || "").trim();
  const hasCustomName = Boolean(rawName && rawName.toLowerCase() !== "dancer");

  const subjectCap = hasCustomName ? rawName : "The Dancer";
  const subjectLower = hasCustomName ? rawName : "the Dancer";
  const possessiveCap = hasCustomName ? `${rawName}'s` : "The Dancer's";
  const possessiveLower = hasCustomName ? `${rawName}'s` : "the Dancer's";

  if (!isMom) {
    return {
      viewerRole: "Dancer",
      isMom: false,
      showAppOpenCheckinPopup: true,
      roleSwitchLabel: "🩰 Dancer ⇄",
      symptomBarLabel: "I feel:",
      symptomBarAria: "How do you feel right now?",
      dismissRescueLabel: "I feel steady now ✓",
      todayPlanHeading: "Today's Fuel & Studio Plan",
      bagHeading: "🎒 Dance Bag Checklist",
      notesLabel: "Daily Symptom & Rehearsal Notes",
      notesPlaceholder: "Notes for today — studio temp, energy, symptoms...",
      foodSearchPlaceholder: "Search 36+ foods or analyze any snack...",
      scheduleMainHeading: "📅 Schedule",
      historyMainHeading: "History & Report",
      rescueProtocols: RESCUE_PROTOCOLS,
      infoTopics: CLINICAL_INFO_TOPICS,
      manualSections: MANUAL_SECTIONS
    };
  }

  // Mom's third-person phrasing across the entire app (zero first-person "I")
  const momRescueProtocols = {
    steady: null,
    dizzy: {
      title: `2-Minute Sideline Salt & Water Rescue for ${subjectCap}`,
      body: `1) Have ${subjectLower} sit on the studio floor with knees pulled up or legs crossed. 2) Give them 8–12 oz cold electrolyte water or a salt packet / 6 salted pretzels right away. 3) Have them flex calf & thigh muscles before standing up slowly.`
    },
    tired: {
      title: `Quick Low-Fat Dance Energy Boost for ${subjectCap}`,
      body: `Give ${subjectLower} fast-absorbing carbs with salt — an applesauce pouch + salted pretzels, or half a banana + electrolyte drink. Skip high-fat nuts or heavy protein bars during rehearsal.`
    },
    stomach: {
      title: `Gentle Stomach Soothing Mode for ${subjectCap}`,
      body: `Keep ${possessiveLower} fat super low — 0g to 2g — for the next two meals or snacks. Offer warm chicken broth, miso soup, or tea with plain salted crackers or rice cakes so their stomach can relax while keeping salt steady.`
    }
  };

  const momInfoTopics = {
    sodium: {
      title: `Why Extra Salt Helps ${subjectCap} With POTS`,
      body: `Salt helps ${possessiveLower} body hold onto water so blood flows smoothly during turns, jumps, and rehearsals. That keeps dizziness away and their energy steady! Tap +500 or -500 anytime to adjust for them.`
    },
    water: {
      title: `Smart Hydration & Salt Pairing for ${subjectCap}`,
      body: `${possessiveCap} daily water goal automatically adjusts based on that day's dance classes, adding 8 oz for every hour of dance. Always pair plain water with an electrolyte drink or salty snack so their body absorbs it.`
    },
    gb: {
      title: `Gentle on ${possessiveCap} Stomach`,
      body: `Meals with too much grease or heavy fat can cause stomach cramps or nausea for ${subjectLower} during dance. Keeping each meal or snack under their fat limit keeps their digestion calm and comfortable.`
    },
    dayMode: {
      title: `Choosing ${possessiveCap} Daily Routine`,
      body: `Pick the routine that fits ${possessiveLower} day—School + Studio, Competition, or Recovery. Each routine saves its own meal plan, and extra snacks added with '+ Quick Log' reset cleanly at midnight.`
    },
    doctorOverride: {
      title: `Custom Doctor Goals for ${subjectCap}`,
      body: `Turn this on if ${possessiveLower} doctor gave specific daily numbers for salt, water, meal fat limit, or calories instead of using the automatic calculator.`
    },
    sync: {
      title: "Sharing Between Mom's & Dancer's Phones",
      body: `The Family PIN keeps ${possessiveLower} schedule, carpool rides, and daily logs private and synced between Mom's and the Dancer's phones.`
    },
    score: {
      title: `${possessiveCap} Daily Target Score`,
      body: `The Daily Score shows how closely ${possessiveLower} daily salt, water, and stomach-safe meal goals were hit. Green 80%+ means most goals were hit, Yellow 50–79% means partway there, and Red under 50% means they need more fuel or hydration.`
    }
  };

  const momManualSections = [
    {
      id: "quickstart",
      label: "Quick Start",
      title: `Logging for ${subjectCap} in 60 Seconds`,
      items: [
        `<strong>Check off meals &amp; drinks:</strong> Tap the checkbox beside each meal or snack as ${subjectLower} finishes eating or drinking. Their Salt and Hydration rings and Daily Score update right away.`,
        `<strong>Log extra drinks or snacks fast:</strong> Tap <strong>+ Quick Log</strong> to record 1-tap favorites like LMNT, Liquid I.V., Pretzels, or Warm Broth, or search 36+ dancer foods for ${subjectLower}.`,
        `<strong>Watch ${possessiveLower} Daily Score:</strong> A <strong>Green</strong> score badge at 80%+ means ${subjectLower} hit most daily goals! Missed a day? Tap <strong>+ Missed Day</strong> to fill in any past date for them.`,
        `<strong>Switch between Mom &amp; Dancer view:</strong> Tap the role pill at the top anytime to switch between Mom's caregiver view and the Dancer's view.`
      ]
    },
    {
      id: "schedule",
      label: "Schedule & Carpool",
      title: `${possessiveCap} Dance Schedule, BAND & Carpool`,
      items: [
        `<strong>Month, Week &amp; Day Calendar:</strong> Open the <strong>📅 Schedule</strong> tab to view ${possessiveLower} Month calendar or switch to <strong>Week</strong> and <strong>Day</strong> timelines.`,
        `<strong>Customize Daily Dance Classes:</strong> Tap <strong>+ Add Class</strong> to set ${possessiveLower} exact dance classes and school hours for each day. Days with more dance automatically recommend more food, salt, and water for them!`,
        `<strong>Sync with BAND:</strong> Tap <strong>🔄 BAND Sync</strong> to import ${possessiveLower} studio classes from a BAND calendar file, link, or pasted schedule post.`,
        `<strong>School &amp; Dance Carpool:</strong> Scroll to the <strong>🚗 Carpool</strong> section inside Schedule to coordinate both School and Dance Studio rides for ${subjectLower}.`
      ]
    },
    {
      id: "fueling",
      label: "Salt, Water & Food",
      title: `Fueling Guidelines for ${subjectCap}`,
      items: [
        `<strong>Salt + Water work together:</strong> Plain water alone passes right through. Pair every water bottle ${subjectLower} drinks with an electrolyte mix or salty snack so their energy stays steady.`,
        `<strong>Keep meals gentle on their stomach:</strong> Staying at or below ${possessiveLower} per-meal fat limit like <strong>5.5g fat per meal</strong> helps prevent stomach aches during dance.`,
        `<strong>Check any food or restaurant item:</strong> Open the <strong>🥗 Food</strong> tab to search safe meals for ${subjectLower} or tap <strong>📚 Sources</strong> to see the trusted nutrition guides behind these numbers.`
      ]
    },
    {
      id: "rescue",
      label: "Feeling & Help",
      title: `Supporting ${subjectCap}, Doctor Summary & Help`,
      items: [
        `<strong>Update how ${subjectLower} feels:</strong> Tap <em>${subjectCap} feels:</em> at the top to record Steady, Dizzy, Tired, or Stomach and view step-by-step caregiver rescue steps.`,
        `<strong>Print a Doctor Summary:</strong> Open <strong>History</strong> to review color-coded daily scores, log missed days from the past, or tap <strong>Doctor PDF</strong> for ${possessiveLower} doctor visits.`,
        `<strong>Need help? Send a quick text:</strong> Tap <strong>💬</strong> at the top of the screen, write what your family needs help with, and tap Send to open your text messaging app ready to send.`
      ]
    }
  ];

  return {
    viewerRole: "Mom",
    isMom: true,
    showAppOpenCheckinPopup: false,
    roleSwitchLabel: hasCustomName ? `👩 Mom • ${rawName} ⇄` : "👩 Mom ⇄",
    symptomBarLabel: `${subjectCap} feels:`,
    symptomBarAria: `How is ${subjectLower} feeling right now?`,
    dismissRescueLabel: `${subjectCap} feels steady now ✓`,
    todayPlanHeading: `${possessiveCap} Fuel & Studio Plan`,
    bagHeading: `🎒 ${possessiveCap} Dance Bag Checklist`,
    notesLabel: `${possessiveCap} Symptom & Rehearsal Notes`,
    notesPlaceholder: `Notes for ${subjectLower} today — studio temp, energy, symptoms...`,
    foodSearchPlaceholder: `Search 36+ foods or analyze any snack for ${subjectLower}...`,
    scheduleMainHeading: `📅 ${possessiveCap} Schedule`,
    historyMainHeading: `${possessiveCap} History & Report`,
    rescueProtocols: momRescueProtocols,
    infoTopics: momInfoTopics,
    manualSections: momManualSections
  };
}

export const DEFAULT_ROLE_PERSONALIZATION = {
  Dancer: {
    lighting: "day",
    autoRule: "system",
    palette: "blush",
    avatar: "🩰",
    studioName: "Calm Studio Plan",
    mottoIndex: 0
  },
  Mom: {
    lighting: "auto",
    autoRule: "time",
    palette: "teal",
    avatar: "👩",
    studioName: "Calm Studio Plan",
    mottoIndex: 0
  }
};

export const PALETTE_META = {
  blush: { label: "Blush Rose", themeColorDay: "#E11D74", themeColorNight: "#F472B6" },
  sage: { label: "Sage Mint", themeColorDay: "#059669", themeColorNight: "#34D399" },
  lavender: { label: "Lavender Mist", themeColorDay: "#7C3AED", themeColorNight: "#A78BFA" },
  teal: { label: "Ocean Teal", themeColorDay: "#0D9488", themeColorNight: "#2DD4BF" }
};

const LEGACY_THEME_MAP = {
  studio_teal: { palette: "teal", lighting: "day" },
  ballet_slipper: { palette: "blush", lighting: "day" },
  lavender_adagio: { palette: "lavender", lighting: "day" },
  competition_gold: { palette: "sage", lighting: "day" },
  late_rehearsal: { palette: "teal", lighting: "night" }
};

export function getRolePersonalization(state = {}, roleOverride = null) {
  const role = (roleOverride || state?.viewerRole) === "Mom" ? "Mom" : "Dancer";
  const defaults = DEFAULT_ROLE_PERSONALIZATION[role];
  const pers = state?.personalization || {};
  const roleObj = pers.byRole?.[role];

  if (roleObj && typeof roleObj === "object") {
    return {
      lighting: ["day", "night", "auto"].includes(roleObj.lighting) ? roleObj.lighting : defaults.lighting,
      autoRule: ["system", "time"].includes(roleObj.autoRule) ? roleObj.autoRule : defaults.autoRule,
      palette: PALETTE_META[roleObj.palette] ? roleObj.palette : defaults.palette,
      avatar: roleObj.avatar || defaults.avatar,
      studioName: roleObj.studioName ?? defaults.studioName,
      mottoIndex: Number.isFinite(Number(roleObj.mottoIndex)) ? Number(roleObj.mottoIndex) : 0
    };
  }

  // Backward-compatible migration from legacy flat personalization
  const mapped = LEGACY_THEME_MAP[pers.theme] || {};
  return {
    lighting: mapped.lighting || defaults.lighting,
    autoRule: defaults.autoRule,
    palette: mapped.palette || defaults.palette,
    avatar: (role === "Dancer" && pers.avatar) ? pers.avatar : defaults.avatar,
    studioName: pers.studioName || defaults.studioName,
    mottoIndex: 0
  };
}

export function resolveEffectiveLighting(rolePref = {}, { systemDark = false, hour = new Date().getHours() } = {}) {
  const lighting = rolePref?.lighting || "day";
  if (lighting === "night") return "night";
  if (lighting === "day") return "day";
  const autoRule = rolePref?.autoRule || "system";
  if (autoRule === "time") {
    const hr = Number(hour);
    return (hr >= 19 || hr < 7) ? "night" : "day";
  }
  return systemDark ? "night" : "day";
}

export function getTodayNextClassAndCarpool(state = {}, dateStr = getLocalDateString()) {
  const events = getScheduleEventsForDate(state, dateStr) || [];
  const danceEvents = events.filter((ev) => ev.category !== "school");
  const danceHours = getDanceHoursForDate(state, dateStr);
  const dObj = new Date(`${dateStr}T12:00:00`);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayKey = dayNames[dObj.getDay()] || state?.dayOfWeek || "Mon";
  const carpoolDay = state?.carpool?.[dayKey] || {};
  const isMom = state?.viewerRole === "Mom";

  const fmt12 = (t) => {
    const m = String(t || "").trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return String(t || "");
    let h = parseInt(m[1], 10);
    const ap = h >= 12 ? "PM" : "AM";
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${h}:${m[2]} ${ap}`;
  };

  const firstDance = danceEvents[0] || null;
  const classTitle = firstDance
    ? `${firstDance.title} • ${fmt12(firstDance.startTime)}`
    : (events[0] ? `${events[0].title} • ${fmt12(events[0].startTime)}` : "Rest Day • No dance classes scheduled");

  let carpoolSummary = isMom
    ? "Carpool: Add school or studio pickup in Schedule."
    : "Carpool: Ask Mom or check Schedule for pickup details.";
  if (carpoolDay.homeDriver || carpoolDay.homeTime) {
    const drv = carpoolDay.homeDriver || (isMom ? "You" : "Mom");
    const tm = carpoolDay.homeTime ? ` at ${carpoolDay.homeTime}` : "";
    carpoolSummary = `Carpool: ${drv} picks up${tm}`;
  } else if (carpoolDay.toDriver || carpoolDay.toTime) {
    const drv = carpoolDay.toDriver || (isMom ? "You" : "Mom");
    const tm = carpoolDay.toTime ? ` at ${carpoolDay.toTime}` : "";
    carpoolSummary = `Carpool: ${drv} drives to studio${tm}`;
  }

  return {
    danceHours,
    hasDance: danceHours > 0 || danceEvents.length > 0,
    classTitle,
    carpoolSummary
  };
}

export function getSmartMotto(state = {}, { index, dateStr = getLocalDateString() } = {}) {
  const isMom = state?.viewerRole === "Mom";
  const feel = state?.symptomStatus || "steady";
  const rolePref = getRolePersonalization(state);
  const idx = Math.abs(Number.isFinite(Number(index)) ? Number(index) : (rolePref.mottoIndex || 0));

  // Recent history context (prefer most recent past entry, else latest entry)
  const hist = Array.isArray(state?.history) ? state.history : [];
  const pastEntry = hist.find((h) => h && h.date && h.date < dateStr) || hist[0] || null;
  const recentScore = pastEntry ? (Number.isFinite(Number(pastEntry.score)) ? Number(pastEntry.score) : computeDailyScore(pastEntry).score) : null;

  // Upcoming schedule context
  const { danceHours, hasDance, classTitle, carpoolSummary } = getTodayNextClassAndCarpool(state, dateStr);
  const shortClass = classTitle.split("•")[0].trim();

  const scoreSnippetDancer = recentScore !== null
    ? (recentScore >= 80 ? `You hit ${recentScore}% recently` : `Yesterday was ${recentScore}% — fresh start today`)
    : "Every sip and bite builds your stamina";
  const scoreSnippetMom = recentScore !== null
    ? (recentScore >= 80 ? `The Dancer hit ${recentScore}% recently` : `The Dancer's recent score was ${recentScore}% — steady support today`)
    : "Every steady log supports The Dancer's stamina";

  const schedSnippetDancer = hasDance
    ? `${danceHours} hrs of ${shortClass}`
    : "a gentle recovery day";
  const schedSnippetMom = hasDance
    ? `${danceHours} hrs of ${shortClass}`
    : "a gentle rest day";

  const pool = isMom
    ? {
        steady: [
          `The Dancer is steady! ${scoreSnippetMom} ahead of ${schedSnippetMom}.`,
          `Steady energy for The Dancer today. ${carpoolSummary}.`,
          `Great rhythm — keep The Dancer's water and salt topped up for ${schedSnippetMom}.`
        ],
        dizzy: [
          `The Dancer feels dizzy — prioritize 500mg salt + 12oz water right now before ${schedSnippetMom}.`,
          `Gentle pause for The Dancer: feet up, slow sips, and steady electrolytes.`,
          `Supporting The Dancer through dizziness — check the rescue steps and ${carpoolSummary.toLowerCase()}.`
        ],
        tired: [
          `The Dancer feels tired — offer quick, low-fat carbs and hydration for ${schedSnippetMom}.`,
          `${scoreSnippetMom}. A light snack and water will help The Dancer recharge.`,
          `Low energy today for The Dancer; keep meals small, gentle, and steady.`
        ],
        stomach: [
          `The Dancer's stomach feels sensitive — stick to warm broth, crackers, and tiny sips.`,
          `Gentle tummy day for The Dancer: keep meals extra low-fat before ${schedSnippetMom}.`,
          `Slow and soothing fuel for The Dancer today — small portions every 2–3 hours.`
        ]
      }
    : {
        steady: [
          `You're feeling steady! ${scoreSnippetDancer} as you head into ${schedSnippetDancer}.`,
          `Strong, balanced energy for ${schedSnippetDancer}. ${carpoolSummary}.`,
          `Steady salt, gentle fuel, strong turns — you've got ${schedSnippetDancer} covered!`
        ],
        dizzy: [
          `Feeling dizzy? Pause, sit down, and take 500mg salt + 12oz water before ${schedSnippetDancer}.`,
          `Listen to your body right now — slow sips and salt first, then ease back in.`,
          `You're not behind: steady electrolytes now will help you feel grounded for ${schedSnippetDancer}.`
        ],
        tired: [
          `Feeling tired? Grab a light, low-fat carb snack and water to power ${schedSnippetDancer}.`,
          `${scoreSnippetDancer} — a quick snack and 8oz water will lift your energy.`,
          `Gentle pace today: small fuel + steady sips keep your legs strong through ${schedSnippetDancer}.`
        ],
        stomach: [
          `Tummy sensitive today? Sip warm broth or water slowly and keep snacks extra low-fat.`,
          `Gentle tummy care first — small, bland bites will keep you comfortable for ${schedSnippetDancer}.`,
          `Be kind to your stomach today: tiny sips and soothing fuel every couple of hours.`
        ]
      };

  const list = pool[feel] || pool.steady;
  return list[idx % list.length];
}

export function computeConcentricRingData(totals = {}, targets = {}) {
  const naTarget = Math.max(1, Number(targets.sodium) || 3600);
  const waterTarget = Math.max(1, Number(targets.water) || 85);
  const calTarget = Math.max(1, Number(targets.calories) || 2000);
  return {
    sodiumPct: Math.max(0, Math.round(((Number(totals.sodiumMg) || 0) / naTarget) * 100)),
    waterPct: Math.max(0, Math.round(((Number(totals.waterOz) || 0) / waterTarget) * 100)),
    fuelPct: Math.max(0, Math.round(((Number(totals.totalKcal) || 0) / calTarget) * 100))
  };
}

/**
 * Verify Admin PIN for the hidden PIN-secured Admin Dashboard (Requirement 2b).
 * Checks against `state.adminConfig.adminPin` if customized, or active Family PIN (`auth.passphrase`),
 * or initial setup fallback `"8014"` / non-empty 4+ char admin PIN when no PIN has been set yet.
 */
export function verifyAdminPin(inputPin, state = {}, auth = {}) {
  const clean = String(inputPin || "").trim();
  if (!clean || clean.length < 4) return false;
  const customAdminPin = String(state?.adminConfig?.adminPin || "").trim();
  if (customAdminPin) {
    return clean === customAdminPin;
  }
  const familyPin = String(auth?.passphrase || "").trim();
  if (familyPin && clean === familyPin) {
    return true;
  }
  const supportPhone = resolveFamilySupportPhone(state, { unlocked: true });
  if (supportPhone && clean === supportPhone.slice(-4)) {
    return true;
  }
  if (!customAdminPin && !familyPin) {
    return clean.length >= 4;
  }
  return false;
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
  const prevDanceHours = getDanceHoursForDate(currentState, currentState.lastActiveDate);
  const targets = getCalculatedTargets(currentState.profile, {
    danceHours: prevDanceHours,
    state: currentState,
    date: currentState.lastActiveDate
  });
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
    selectedCalendarDate: todayStr,
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
 * Format a carpool day (including both School and Dance Studio rides) into a parent/dancer-friendly text snippet.
 */
export function formatCarpoolShareText(dayOfWeek, cp = {}) {
  const toDriver = cp.toDriver || "TBD";
  const toTime = cp.toTime || "TBD";
  const toNote = cp.toNote ? ` (${cp.toNote})` : "";
  const homeDriver = cp.homeDriver || "TBD";
  const homeTime = cp.homeTime || "TBD";
  const homeNote = cp.homeNote ? ` (${cp.homeNote})` : "";

  const lines = [`🩰 ${dayOfWeek} Dance Carpool`];
  if (cp.schoolToDriver || cp.schoolHomeDriver) {
    const sTo = cp.schoolToDriver || "TBD";
    const sToT = cp.schoolToTime || "TBD";
    const sToN = cp.schoolToNote ? ` (${cp.schoolToNote})` : "";
    const sHo = cp.schoolHomeDriver || "TBD";
    const sHoT = cp.schoolHomeTime || "TBD";
    const sHoN = cp.schoolHomeNote ? ` (${cp.schoolHomeNote})` : "";
    lines.push(`• To School: ${sTo} @ ${sToT}${sToN}`);
    lines.push(`• From School: ${sHo} @ ${sHoT}${sHoN}`);
  }
  lines.push(`• To Studio: ${toDriver} @ ${toTime}${toNote}`);
  lines.push(`• Home: ${homeDriver} @ ${homeTime}${homeNote}`);
  return lines.join("\n");
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
  let adminUnlockedInSession = false;
  let dancerCheckinShownThisOpen = false;
  let brandTapCount = 0;
  let brandTapTimer = null;
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
    const inc = incoming || {};
    const mergedCarpool = createEmptyCarpool();
    for (const d of Object.keys(mergedCarpool)) {
      mergedCarpool[d] = { ...mergedCarpool[d], ...(base.carpool?.[d] || {}), ...(inc.carpool?.[d] || {}) };
    }
    const mergedWeekly = createDefaultWeeklySchedule();
    for (const d of Object.keys(mergedWeekly)) {
      if (Array.isArray(inc.weeklySchedule?.[d])) {
        mergedWeekly[d] = inc.weeklySchedule[d];
      } else if (Array.isArray(base.weeklySchedule?.[d])) {
        mergedWeekly[d] = base.weeklySchedule[d];
      }
    }

    const merged = {
      ...base,
      ...inc,
      profile: { ...base.profile, ...(inc.profile || {}) },
      personalization: {
        ...base.personalization,
        ...(inc.personalization || {}),
        byRole: {
          Dancer: {
            ...DEFAULT_ROLE_PERSONALIZATION.Dancer,
            ...getRolePersonalization(base, "Dancer"),
            ...(inc.personalization?.byRole?.Dancer || (!inc.personalization?.byRole && inc.personalization ? getRolePersonalization({ personalization: inc.personalization }, "Dancer") : {}))
          },
          Mom: {
            ...DEFAULT_ROLE_PERSONALIZATION.Mom,
            ...getRolePersonalization(base, "Mom"),
            ...(inc.personalization?.byRole?.Mom || {})
          }
        }
      },
      adminConfig: {
        ...base.adminConfig,
        ...(inc.adminConfig || {}),
        googleAuth: prepareGoogleSignInConfig(inc.adminConfig?.googleAuth || base.adminConfig?.googleAuth)
      },
      weeklySchedule: mergedWeekly,
      dateScheduleOverrides: { ...(base.dateScheduleOverrides || {}), ...(inc.dateScheduleOverrides || {}) },
      schedules: {
        school_dance: Array.isArray(inc.schedules?.school_dance) ? inc.schedules.school_dance : base.schedules.school_dance,
        competition: Array.isArray(inc.schedules?.competition) ? inc.schedules.competition : base.schedules.competition,
        recovery: Array.isArray(inc.schedules?.recovery) ? inc.schedules.recovery : base.schedules.recovery
      },
      carpool: mergedCarpool,
      foodLibrary: Array.isArray(inc.foodLibrary) && inc.foodLibrary.length
        ? inc.foodLibrary
        : base.foodLibrary,
      bagItems: Array.isArray(inc.bagItems) && inc.bagItems.length
        ? inc.bagItems
        : base.bagItems,
      history: Array.isArray(inc.history) ? inc.history : []
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

  function getActiveTodayTargets(dateStr = getLocalDateString()) {
    const danceHours = getDanceHoursForDate(state, dateStr);
    return getCalculatedTargets(state.profile, {
      danceHours,
      state,
      date: dateStr
    });
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
      const gAuth = state.adminConfig?.googleAuth;
      const syncOptions = gAuth?.enabled && gAuth?.idToken
        ? { googleIdToken: gAuth.idToken, email: gAuth.lastSignedInEmail }
        : {};
      const res = await pushToCloud(url, encrypted, state.viewerRole || "Dancer", syncOptions);
      setSyncIndicator(res.ok ? "synced" : "offline");
      return res.ok;
    } catch (_err) {
      setSyncIndicator("offline");
      return false;
    }
  }

  function saveAndSync({ skipPush = false } = {}) {
    rolloverDayIfNeeded();
    const todayStr = getLocalDateString();
    const targets = getActiveTodayTargets(todayStr);
    state.profile.danceHours = targets.danceHours;
    const { history } = snapshotToday(state, targets, todayStr);
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
      personalization: state.personalization,
      adminConfig: state.adminConfig,
      weeklySchedule: state.weeklySchedule,
      dateScheduleOverrides: state.dateScheduleOverrides,
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
    const gAuth = state.adminConfig?.googleAuth;
    const pullOpts = gAuth?.enabled && gAuth?.idToken ? { googleIdToken: gAuth.idToken } : {};
    const res = await pullFromCloud(url, pullOpts);
    if (!res.ok) {
      setSyncIndicator("offline");
      return { ok: false, reason: "network", error: res.error };
    }
    if (!res.payload) {
      setSyncIndicator("synced");
      return { ok: true, empty: true, updatedAt: res.updatedAt, updatedBy: res.updatedBy };
    }
    try {
      const decrypted = await decryptBundle(res.payload, passphrase);
      const prevUiState = {
        activeTab: state.activeTab,
        historyRange: state.historyRange,
        foodFilter: state.foodFilter,
        calendarViewMode: state.calendarViewMode,
        selectedCalendarDate: state.selectedCalendarDate,
        foodSearchQuery: document.getElementById("foodSearchInput")?.value ?? ""
      };
      const gearModalEl = document.getElementById("gearModal");
      const wasGearModalOpen = gearModalEl ? !gearModalEl.classList.contains("hidden") : false;

      state = mergeState(createDefaultState(), {
        ...decrypted,
        activeTab: prevUiState.activeTab,
        historyRange: prevUiState.historyRange,
        foodFilter: prevUiState.foodFilter,
        calendarViewMode: prevUiState.calendarViewMode,
        selectedCalendarDate: prevUiState.selectedCalendarDate,
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
      return { ok: true, updatedAt: res.updatedAt, updatedBy: res.updatedBy, bytes: res.payload.length };
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

  function formatTime12h(timeStr) {
    const s = String(timeStr || "").trim();
    if (/AM|PM/i.test(s)) return s;
    const m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return s;
    let h = parseInt(m[1], 10);
    const min = m[2];
    const ap = h >= 12 ? "PM" : "AM";
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${h}:${min} ${ap}`;
  }

  function renderSmartMotto() {
    const smartMotto = getSmartMotto(state);
    const mottoEl = document.getElementById("studioBannerMotto");
    if (mottoEl) {
      mottoEl.textContent = smartMotto;
    }
    const previewEl = document.getElementById("settingMottoPreview");
    if (previewEl) {
      previewEl.textContent = smartMotto;
    }
  }

  function applyPersonalizationTheme() {
    const rolePref = getRolePersonalization(state);
    const systemDark = typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false;
    const effectiveLighting = resolveEffectiveLighting(rolePref, { systemDark });
    const palette = rolePref.palette || "blush";

    document.documentElement.setAttribute("data-palette", palette);
    document.documentElement.setAttribute("data-lighting", effectiveLighting);
    document.documentElement.setAttribute("data-theme", state.personalization?.theme || "studio_teal");

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme && PALETTE_META[palette]) {
      metaTheme.setAttribute(
        "content",
        effectiveLighting === "night" ? PALETTE_META[palette].themeColorNight : PALETTE_META[palette].themeColorDay
      );
    }

    const avatar = rolePref.avatar || "🩰";
    const topAvatar = document.getElementById("topBarAvatar");
    if (topAvatar) topAvatar.textContent = avatar;
    const checkinAvatar = document.getElementById("checkinPopupAvatar");
    if (checkinAvatar) checkinAvatar.textContent = avatar;

    const studioNameEl = document.getElementById("studioBannerName");
    if (studioNameEl) {
      studioNameEl.textContent = `${avatar} ${rolePref.studioName || "Calm Studio Plan"}`;
    }
    renderSmartMotto();
  }

  function renderRoleCopy() {
    const copy = getRoleCopy(state);

    const roleSwitchLabel = document.getElementById("topRoleSwitchLabel");
    if (roleSwitchLabel) roleSwitchLabel.textContent = copy.roleSwitchLabel;

    const symptomBarGroup = document.getElementById("symptomBarGroup");
    if (symptomBarGroup) symptomBarGroup.setAttribute("aria-label", copy.symptomBarAria);

    const symptomBarLabel = document.getElementById("symptomBarLabel");
    if (symptomBarLabel) symptomBarLabel.textContent = copy.symptomBarLabel;

    const todayRingsTitle = document.getElementById("todayRingsTitle");
    if (todayRingsTitle) {
      todayRingsTitle.textContent = copy.isMom ? "The Dancer's Daily Score" : "My Daily Score";
    }

    const todayPlanHeading = document.getElementById("todayPlanHeading");
    if (todayPlanHeading) todayPlanHeading.textContent = copy.todayPlanHeading;

    const todayBagHeading = document.getElementById("todayBagHeadingText");
    if (todayBagHeading) todayBagHeading.textContent = copy.bagHeading;

    const notesLabel = document.getElementById("dailyNotesLabel");
    if (notesLabel) notesLabel.textContent = copy.notesLabel;

    const notesInput = document.getElementById("dailyNotesInput");
    if (notesInput) notesInput.setAttribute("placeholder", copy.notesPlaceholder);

    const foodSearch = document.getElementById("foodSearchInput");
    if (foodSearch) foodSearch.setAttribute("placeholder", copy.foodSearchPlaceholder);

    const schedHead = document.getElementById("scheduleMainHeading");
    if (schedHead) schedHead.textContent = copy.scheduleMainHeading;

    const histHead = document.getElementById("historyMainHeading");
    if (histHead) histHead.textContent = copy.historyMainHeading;
  }

  function maybeShowDancerCheckinPopup({ force = false } = {}) {
    const modal = document.getElementById("dancerCheckinModal");
    if (!modal) return;
    if (state.viewerRole !== "Dancer") {
      modal.classList.add("hidden");
      return;
    }
    if (!force && dancerCheckinShownThisOpen) return;
    const pinOverlay = document.getElementById("pinOverlay");
    if (pinOverlay && !pinOverlay.classList.contains("hidden")) return;

    dancerCheckinShownThisOpen = true;
    const greeting = document.getElementById("checkinPopupGreeting");
    if (greeting) {
      const name = state.profile?.name || "Dancer";
      greeting.textContent = `Hi ${name}! How do you feel right now?`;
    }
    modal.classList.remove("hidden");
  }

  function renderAll() {
    applyPersonalizationTheme();
    renderRoleCopy();
    renderTopBar();
    renderViewVisibility();
    renderTodayView();
    renderFoodView();
    renderCarpoolView();
    renderHistoryView();
    renderGearModal();
    renderSettingsModal();
    renderNutritionSourcesModal();
  }

  function renderTopBar() {
    const copy = getRoleCopy(state);
    const greeting = document.getElementById("topBarSubtitle");
    if (greeting) {
      greeting.textContent = `${state.profile.name || "Dancer"} • ${state.viewerRole || "Dancer"}`;
    }
    document.querySelectorAll("[data-symptom-btn]").forEach((btn) => {
      const s = btn.getAttribute("data-symptom-btn");
      btn.classList.toggle("active", s === state.symptomStatus);
    });

    const banner = document.getElementById("rescueBanner");
    const proto = copy.rescueProtocols[state.symptomStatus];
    if (banner) {
      if (proto) {
        banner.classList.remove("hidden");
        banner.innerHTML = `
          <div class="rescue-banner-head">
            <strong>${esc(proto.title)}</strong>
            <button type="button" class="btn-text" id="dismissRescueBtn">${esc(copy.dismissRescueLabel)}</button>
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
    const active = state.activeTab === "schedule" ? "carpool" : state.activeTab;
    const views = {
      today: document.getElementById("view-today"),
      food: document.getElementById("view-food"),
      carpool: document.getElementById("view-carpool"),
      history: document.getElementById("view-history")
    };
    Object.entries(views).forEach(([key, el]) => {
      if (el) el.classList.toggle("hidden", active !== key);
    });

    document.querySelectorAll("[data-nav-tab]").forEach((btn) => {
      const tabKey = btn.getAttribute("data-nav-tab");
      btn.classList.toggle("active", tabKey === active);
    });
  }

  function setProgressRing(circleId, pct, radius = 34) {
    const circle = document.getElementById(circleId);
    if (!circle) return;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.max(0, Math.min(100, pct));
    circle.style.strokeDasharray = `${circumference}`;
    circle.style.strokeDashoffset = `${circumference * (1 - clamped / 100)}`;
  }

  function celebrateGoalMet() {
    const card = document.getElementById("todayRingsCard");
    if (!card) return;
    card.classList.remove("goal-celebrate");
    void card.offsetWidth;
    card.classList.add("goal-celebrate");
    const icons = ["✨", "🎉", "🩰", "💧", "🌟"];
    for (let i = 0; i < 6; i++) {
      const span = document.createElement("span");
      span.className = "confetti-burst";
      span.textContent = icons[i % icons.length];
      span.style.left = `${22 + Math.random() * 58}%`;
      span.style.top = `${15 + Math.random() * 40}%`;
      span.style.animationDelay = `${i * 0.05}s`;
      card.appendChild(span);
      setTimeout(() => span.remove(), 950);
    }
  }

  let prevRingMet = null;

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
    const todayStr = getLocalDateString();
    const targets = getActiveTodayTargets(todayStr);
    const totals = computeDailyTotals(state, targets);
    const scoreInfo = computeDailyScore(totals, targets);
    const ringData = computeConcentricRingData(totals, targets);

    renderSmartMotto();

    const activityBadge = document.getElementById("todayDanceActivityBadge");
    if (activityBadge) {
      activityBadge.textContent =
        targets.danceHours > 0
          ? `📅 ${targets.danceHours} hrs dance`
          : "📅 Rest day";
    }

    setProgressRing("sodiumRingProgress", ringData.sodiumPct, 34);
    setProgressRing("waterRingProgress", ringData.waterPct, 25);
    setProgressRing("fuelRingProgress", ringData.fuelPct, 16);

    const nowMet = {
      sodium: ringData.sodiumPct >= 100,
      water: ringData.waterPct >= 100,
      fuel: ringData.fuelPct >= 100
    };
    if (prevRingMet && (
      (!prevRingMet.sodium && nowMet.sodium) ||
      (!prevRingMet.water && nowMet.water) ||
      (!prevRingMet.fuel && nowMet.fuel)
    )) {
      celebrateGoalMet();
    }
    prevRingMet = nowMet;

    const naVal = document.getElementById("sodiumRingValue");
    const naSub = document.getElementById("sodiumRingTarget");
    if (naVal) naVal.textContent = `${totals.sodiumMg}`;
    if (naSub) naSub.textContent = `/ ${targets.sodium} mg`;

    const waVal = document.getElementById("waterRingValue");
    const waSub = document.getElementById("waterRingTarget");
    if (waVal) waVal.textContent = `${totals.waterOz}`;
    if (waSub) waSub.textContent = `/ ${targets.water} oz`;

    const fuelVal = document.getElementById("fuelRingValue");
    const fuelSub = document.getElementById("fuelRingTarget");
    if (fuelVal) fuelVal.textContent = `${totals.totalKcal}`;
    if (fuelSub) fuelSub.textContent = `/ ${targets.calories} kcal`;

    const scorePctEl = document.getElementById("todayScorePct");
    if (scorePctEl) scorePctEl.textContent = `${scoreInfo.score}%`;

    const scoreBadge = document.getElementById("todayDailyScoreBadge");
    if (scoreBadge) {
      scoreBadge.className = `pill-badge ${scoreInfo.badgeClass}`;
      scoreBadge.textContent = `${scoreInfo.goalsHit}/${scoreInfo.totalGoals} Goals • ${scoreInfo.label}`;
    }

    const gbStatus = document.getElementById("todayGbStatus");
    if (gbStatus) {
      gbStatus.className = `pill-badge ${totals.gbCompliant ? "badge-safe" : "badge-avoid"}`;
      gbStatus.textContent = totals.gbCompliant
        ? `✓ Safe ≤${targets.maxMealFat}g`
        : `⚠️ >${targets.maxMealFat}g fat`;
    }

    // Next Dance Class + Carpool summary card
    const nextClass = getTodayNextClassAndCarpool(state, todayStr);
    const nextKicker = document.getElementById("todayNextClassKicker");
    const nextTitle = document.getElementById("todayNextClassTitle");
    const nextCarpool = document.getElementById("todayNextClassCarpool");
    if (nextKicker) {
      nextKicker.textContent = nextClass.danceHours > 0
        ? `Today's Dance • ${nextClass.danceHours} hrs`
        : "Today's Schedule • Rest Day";
    }
    if (nextTitle) nextTitle.textContent = nextClass.classTitle;
    if (nextCarpool) nextCarpool.textContent = nextClass.carpoolSummary;

    document.querySelectorAll("[data-day-mode]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-day-mode") === state.dayMode);
    });

    // 7-Day History Overview Card with Score Color Coding
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
        let title = `${ds}: No log yet — tap to log`;
        if (entry) {
          const sc = computeDailyScore(entry, targets);
          cls = sc.tier === "high" ? "dot-good" : sc.tier === "medium" ? "dot-warn" : "dot-low";
          title = `${ds}: ${sc.score}% • ${sc.goalsHit}/${sc.totalGoals} goals • ${entry.sodiumMg}mg Na, ${entry.waterOz}oz`;
        }
        dots.push(`<span class="history-dot ${cls}" data-dot-date="${esc(ds)}" title="${esc(title)}"></span>`);
      }
      dotsEl.innerHTML = dots.join("");
    }
    const avg7Score = document.getElementById("history7AvgScore");
    const avg7Na = document.getElementById("history7AvgNa");
    const avg7Water = document.getElementById("history7AvgWater");
    const steady7 = document.getElementById("history7Steady");
    if (avg7Score) avg7Score.textContent = `${stats7.avgScore}%`;
    if (avg7Na) avg7Na.textContent = `${stats7.avgSodium} mg`;
    if (avg7Water) avg7Water.textContent = `${stats7.avgWater} oz`;
    if (steady7) steady7.textContent = `${stats7.symptomFreeCount}/${stats7.count || 0}`;

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
    const targets = getActiveTodayTargets();
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
    const targets = getActiveTodayTargets();
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

  function renderNutritionSourcesModal() {
    const listEl = document.getElementById("nutritionSourcesList");
    if (!listEl) return;
    listEl.innerHTML = NUTRITION_SOURCES.map(
      (src) => `
        <div class="source-card">
          <span class="food-cat">${esc(src.category)}</span>
          <h4>${esc(src.title)}</h4>
          <div class="source-org">${esc(src.organization)}</div>
          <p>${esc(src.summary)}</p>
          <p class="muted-text"><strong>How used in app:</strong> ${esc(src.howUsedInApp)}</p>
        </div>
      `
    ).join("");
  }

  // ==========================================================================
  // SCHEDULE TAB: CALENDAR VIEWS (MONTH, WEEK, DAY) + CUSTOM SCHEDULE + CARPOOL
  // ==========================================================================

  function parseDateParts(dateStr) {
    const clean = /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr)) ? String(dateStr) : getLocalDateString();
    const [y, m, d] = clean.split("-").map((n) => parseInt(n, 10));
    return new Date(y, m - 1, d, 12, 0, 0);
  }

  function timeStrToHourFloat(timeStr, defaultHr = 16) {
    const s = String(timeStr || "").trim();
    const ampm = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (ampm) {
      let h = parseInt(ampm[1], 10);
      const min = parseInt(ampm[2], 10);
      const ap = ampm[3].toUpperCase();
      if (ap === "PM" && h < 12) h += 12;
      if (ap === "AM" && h === 12) h = 0;
      return h + min / 60;
    }
    const h24 = s.match(/^(\d{1,2}):(\d{2})$/);
    if (h24) {
      return parseInt(h24[1], 10) + parseInt(h24[2], 10) / 60;
    }
    return defaultHr;
  }

  function renderCalendarViews() {
    const viewMode = state.calendarViewMode || "month";
    const selDateStr = state.selectedCalendarDate || getLocalDateString();
    const selDate = parseDateParts(selDateStr);
    const todayStr = getLocalDateString();

    document.querySelectorAll("[data-cal-view]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-cal-view") === viewMode);
    });

    document.getElementById("calMonthContainer")?.classList.toggle("hidden", viewMode !== "month");
    document.getElementById("calWeekContainer")?.classList.toggle("hidden", viewMode !== "week");
    document.getElementById("calDayContainer")?.classList.toggle("hidden", viewMode !== "day");

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const periodLabel = document.getElementById("calCurrentPeriodLabel");
    if (periodLabel) {
      if (viewMode === "month") {
        periodLabel.textContent = `${monthNames[selDate.getMonth()]} ${selDate.getFullYear()}`;
      } else if (viewMode === "week") {
        const startOfWeek = new Date(selDate);
        startOfWeek.setDate(selDate.getDate() - selDate.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        periodLabel.textContent = `Week of ${monthNames[startOfWeek.getMonth()].slice(0, 3)} ${startOfWeek.getDate()} – ${monthNames[endOfWeek.getMonth()].slice(0, 3)} ${endOfWeek.getDate()}`;
      } else {
        const wkDay = getWeekdayForDateStr(selDateStr);
        periodLabel.textContent = `${wkDay}, ${monthNames[selDate.getMonth()]} ${selDate.getDate()}, ${selDate.getFullYear()}`;
      }
    }

    // 1. Render Month Grid
    const monthGridEl = document.getElementById("calMonthGrid");
    if (monthGridEl && viewMode === "month") {
      const year = selDate.getFullYear();
      const month = selDate.getMonth();
      const firstDay = new Date(year, month, 1, 12, 0, 0);
      const startOffset = firstDay.getDay();
      const startCellDate = new Date(year, month, 1 - startOffset, 12, 0, 0);

      const cellsHtml = [];
      for (let i = 0; i < 42; i++) {
        const cellDate = new Date(startCellDate);
        cellDate.setDate(startCellDate.getDate() + i);
        const ds = getLocalDateString(cellDate);
        const isCurrentMonth = cellDate.getMonth() === month;
        const isToday = ds === todayStr;
        const isSelected = ds === selDateStr;
        const wkName = getWeekdayForDateStr(ds);
        const events = getScheduleEventsForDate(state, ds);
        const danceHrs = getDanceHoursForDate(state, ds);
        const cp = state.carpool?.[wkName] || {};
        const hasCarpool = Boolean(cp.toDriver || cp.homeDriver || cp.schoolToDriver || cp.schoolHomeDriver);
        const hasSchool = events.some((e) => e.category === "school");

        const badges = [];
        if (danceHrs > 0) {
          badges.push(`<span class="cal-mini-pill cal-pill-dance"><span class="cal-pill-short">${danceHrs}h</span><span class="cal-pill-full">🩰 ${danceHrs}h Dance</span></span>`);
        } else {
          badges.push(`<span class="cal-mini-pill cal-pill-rest"><span class="cal-pill-short">–</span><span class="cal-pill-full">Rest</span></span>`);
        }
        const dots = [];
        if (hasSchool) {
          badges.push(`<span class="cal-mini-pill cal-pill-school cal-desktop-only">🎒 School</span>`);
          dots.push(`<span class="cal-dot cal-dot-school" title="School"></span>`);
        }
        if (hasCarpool) {
          badges.push(`<span class="cal-mini-pill cal-pill-carpool cal-desktop-only">🚗 Carpool</span>`);
          dots.push(`<span class="cal-dot cal-dot-carpool" title="Carpool"></span>`);
        }

        cellsHtml.push(`
          <button type="button" class="cal-day-cell ${isCurrentMonth ? "" : "cal-outside"} ${isToday ? "cal-today" : ""} ${isSelected ? "cal-selected" : ""}" data-cal-date="${esc(ds)}">
            <span class="cal-day-num">${cellDate.getDate()}</span>
            <div class="cal-day-badges">${badges.join("")}</div>
            ${dots.length ? `<div class="cal-mobile-dots">${dots.join("")}</div>` : ""}
          </button>
        `);
      }
      monthGridEl.innerHTML = cellsHtml.join("");
    }

    // 2. Render Google Calendar-Style Week View (6 AM to 10 PM hourly timeline)
    const weekGridEl = document.getElementById("calWeekGrid");
    if (weekGridEl && viewMode === "week") {
      const startOfWeek = new Date(selDate);
      startOfWeek.setDate(selDate.getDate() - selDate.getDay());
      const hours = [];
      for (let h = 6; h <= 21; h++) {
        const label = h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`;
        hours.push(`<div class="gcal-hour-label">${label}</div>`);
      }

      const colHeaders = [`<div class="gcal-col-head">Time</div>`];
      const dayColumns = [];

      for (let dIdx = 0; dIdx < 7; dIdx++) {
        const colDate = new Date(startOfWeek);
        colDate.setDate(startOfWeek.getDate() + dIdx);
        const ds = getLocalDateString(colDate);
        const wkName = getWeekdayForDateStr(ds);
        const danceHrs = getDanceHoursForDate(state, ds);
        const isSel = ds === selDateStr;

        colHeaders.push(`
          <div class="gcal-col-head ${isSel ? "active" : ""}" data-cal-date="${esc(ds)}">
            <div>${wkName} ${colDate.getDate()}</div>
            <div class="cal-mini-pill ${danceHrs > 0 ? "cal-pill-dance" : "cal-pill-rest"}">${danceHrs}h</div>
          </div>
        `);

        const events = getScheduleEventsForDate(state, ds);
        const cp = state.carpool?.[wkName] || {};
        const blocksHtml = [];

        events.forEach((evt) => {
          const startH = Math.max(6, Math.min(21.5, timeStrToHourFloat(evt.startTime, 16)));
          const dur = Math.max(0.5, Number(evt.durationHours) || computeTimeRangeDurationHours(evt.startTime, evt.endTime, 1));
          const topPx = Math.round((startH - 6) * 44);
          const heightPx = Math.max(22, Math.round(dur * 44) - 2);
          const cls = evt.category === "school" ? "gcal-block-school" : "gcal-block-dance";
          blocksHtml.push(`
            <div class="gcal-event-block ${cls}" style="top:${topPx}px;height:${heightPx}px;" data-cal-date="${esc(ds)}" title="${esc(evt.title)} • ${formatTime12h(evt.startTime)}–${formatTime12h(evt.endTime)}">
              <strong>${esc(evt.title)}</strong>
              <div>${esc(formatTime12h(evt.startTime))}</div>
            </div>
          `);
        });

        if (cp.toDriver) {
          const startH = Math.max(6, Math.min(21.5, timeStrToHourFloat(cp.toTime || "3:30 PM", 15.5)));
          const topPx = Math.round((startH - 6) * 44);
          blocksHtml.push(`
            <div class="gcal-event-block gcal-block-carpool" style="top:${topPx}px;height:24px;" data-cal-date="${esc(ds)}">
              🚗 To Studio: ${esc(cp.toDriver)}
            </div>
          `);
        }
        if (cp.homeDriver) {
          const startH = Math.max(6, Math.min(21.5, timeStrToHourFloat(cp.homeTime || "9:00 PM", 21)));
          const topPx = Math.round((startH - 6) * 44);
          blocksHtml.push(`
            <div class="gcal-event-block gcal-block-carpool" style="top:${topPx}px;height:24px;" data-cal-date="${esc(ds)}">
              🚗 Home: ${esc(cp.homeDriver)}
            </div>
          `);
        }

        dayColumns.push(`<div class="gcal-day-column" data-cal-date="${esc(ds)}">${blocksHtml.join("")}</div>`);
      }

      weekGridEl.innerHTML = `
        <div class="gcal-week-header">${colHeaders.join("")}</div>
        <div class="gcal-week-body">
          <div class="gcal-time-gutter">${hours.join("")}</div>
          ${dayColumns.join("")}
        </div>
      `;
    }

    // 3. Render Google Calendar-Style Day View (Single-day hourly timeline with School, Dance, Fuel & Carpool)
    const dayTimelineEl = document.getElementById("calDayTimeline");
    if (dayTimelineEl && viewMode === "day") {
      const hours = [];
      for (let h = 6; h <= 21; h++) {
        const label = h === 12 ? "12:00 PM" : h > 12 ? `${h - 12}:00 PM` : `${h}:00 AM`;
        hours.push(`<div class="gcal-hour-label">${label}</div>`);
      }

      const wkName = getWeekdayForDateStr(selDateStr);
      const events = getScheduleEventsForDate(state, selDateStr);
      const cp = state.carpool?.[wkName] || {};
      const blocksHtml = [];

      events.forEach((evt) => {
        const startH = Math.max(6, Math.min(21.5, timeStrToHourFloat(evt.startTime, 16)));
        const dur = Math.max(0.5, Number(evt.durationHours) || computeTimeRangeDurationHours(evt.startTime, evt.endTime, 1));
        const topPx = Math.round((startH - 6) * 44);
        const heightPx = Math.max(26, Math.round(dur * 44) - 2);
        const cls = evt.category === "school" ? "gcal-block-school" : "gcal-block-dance";
        blocksHtml.push(`
          <div class="gcal-event-block ${cls}" style="top:${topPx}px;height:${heightPx}px;" data-edit-sched-event="${esc(evt.id)}">
            <strong>${esc(evt.title)}</strong> • ${esc(formatTime12h(evt.startTime))}–${esc(formatTime12h(evt.endTime))}
            ${evt.location ? `<span> @ ${esc(evt.location)}</span>` : ""}
          </div>
        `);
      });

      if (cp.schoolToDriver) {
        const startH = Math.max(6, Math.min(21.5, timeStrToHourFloat(cp.schoolToTime || "7:35 AM", 7.5)));
        blocksHtml.push(`
          <div class="gcal-event-block gcal-block-carpool" style="top:${Math.round((startH - 6) * 44)}px;height:24px;">
            🚗 School Drop-Off: ${esc(cp.schoolToDriver)} • ${esc(cp.schoolToTime || "7:35 AM")}
          </div>
        `);
      }
      if (cp.toDriver) {
        const startH = Math.max(6, Math.min(21.5, timeStrToHourFloat(cp.toTime || "3:30 PM", 15.5)));
        blocksHtml.push(`
          <div class="gcal-event-block gcal-block-carpool" style="top:${Math.round((startH - 6) * 44)}px;height:24px;">
            🚗 To Studio: ${esc(cp.toDriver)} • ${esc(cp.toTime || "3:30 PM")}
          </div>
        `);
      }
      if (cp.homeDriver) {
        const startH = Math.max(6, Math.min(21.5, timeStrToHourFloat(cp.homeTime || "9:00 PM", 21)));
        blocksHtml.push(`
          <div class="gcal-event-block gcal-block-carpool" style="top:${Math.round((startH - 6) * 44)}px;height:24px;">
            🚗 Home: ${esc(cp.homeDriver)} • ${esc(cp.homeTime || "9:00 PM")}
          </div>
        `);
      }

      dayTimelineEl.innerHTML = `
        <div class="gcal-single-grid">
          <div class="gcal-time-gutter">${hours.join("")}</div>
          <div class="gcal-day-column">${blocksHtml.join("")}</div>
        </div>
      `;
    }

    // Selected Day's Detailed Schedule directly underneath the Calendar (Requirement 1b & 1c)
    renderSelectedDayScheduleDetails(selDateStr);
  }

  function renderSelectedDayScheduleDetails(dateStr) {
    const wkName = getWeekdayForDateStr(dateStr);
    const parsedDate = parseDateParts(dateStr);
    const shortMonth = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][parsedDate.getMonth()];
    const events = getScheduleEventsForDate(state, dateStr);
    const danceHours = getDanceHoursForDate(state, dateStr);
    const dayTargets = getCalculatedTargets(state.profile, { danceHours, state, date: dateStr });

    const titleEl = document.getElementById("selectedDayScheduleTitle");
    if (titleEl) {
      titleEl.textContent = `${wkName}, ${shortMonth} ${parsedDate.getDate()}`;
    }
    const summaryEl = document.getElementById("selectedDayActivitySummary");
    if (summaryEl) {
      summaryEl.textContent =
        danceHours > 0
          ? `🩰 ${danceHours} hrs dance • Goals: ${dayTargets.calories} kcal • ${dayTargets.sodium}mg Na • ${dayTargets.water}oz`
          : `🛋️ Rest day • Goals: ${dayTargets.calories} kcal • ${dayTargets.sodium}mg Na • ${dayTargets.water}oz`;
    }

    const listEl = document.getElementById("selectedDayEventsList");
    if (!listEl) return;

    if (!events.length) {
      listEl.innerHTML = `
        <div class="empty-card">
          <p>No classes scheduled for ${wkName}, ${shortMonth} ${parsedDate.getDate()}.</p>
          <p class="muted-text">Goals are automatically adjusted for a rest day.</p>
        </div>
      `;
      return;
    }

    const sorted = [...events].sort(
      (a, b) => timeStrToHourFloat(a.startTime, 8) - timeStrToHourFloat(b.startTime, 8)
    );

    listEl.innerHTML = sorted
      .map((evt) => {
        const isSchool = evt.category === "school";
        const badgeCls = isSchool ? "badge-caution" : "badge-safe";
        const catIcon = isSchool ? "🎒 School" : evt.category === "competition" ? "🏆 Competition" : evt.category === "rehearsal" ? "🎭 Rehearsal" : "🩰 Dance";
        return `
          <div class="day-event-item ${isSchool ? "evt-school" : "evt-dance"}">
            <div class="day-event-copy">
              <span class="pill-badge ${badgeCls}">${catIcon} • ${evt.durationHours}h</span>
              <h4 style="margin:4px 0 2px;">${esc(evt.title)}</h4>
              <div class="muted-text">${esc(formatTime12h(evt.startTime))} – ${esc(formatTime12h(evt.endTime))}${evt.location ? ` • ${esc(evt.location)}` : ""}${evt.notes ? ` • ${esc(evt.notes)}` : ""}</div>
            </div>
            <div class="slot-actions">
              <button type="button" class="slot-action-btn" data-edit-sched-event="${esc(evt.id)}" aria-label="Edit ${esc(evt.title)}" title="Edit class">✏️</button>
              <button type="button" class="slot-action-btn delete-btn" data-delete-sched-event="${esc(evt.id)}" aria-label="Delete ${esc(evt.title)}" title="Remove class">🗑️</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderCarpoolView() {
    renderCalendarViews();

    document.querySelectorAll("[data-carpool-day]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-carpool-day") === state.dayOfWeek);
    });

    const dayBadge = document.getElementById("carpoolSelectedDayBadge");
    if (dayBadge) dayBadge.textContent = state.dayOfWeek;

    const cp = state.carpool[state.dayOfWeek] || {};
    const card = document.getElementById("carpoolDayCard");
    if (card) {
      card.innerHTML = `
        <div class="carpool-section-label">🎒 School</div>
        <div class="carpool-grid" style="margin-bottom: 10px;">
          <div class="carpool-leg">
            <span class="leg-tag">TO SCHOOL</span>
            <h4>${esc(cp.schoolToDriver || "Mom / Bus / TBD")}</h4>
            <p class="leg-time">${esc(cp.schoolToTime || "7:35 AM")}</p>
            <p class="muted-text">${esc(cp.schoolToNote || "No drop-off note")}</p>
          </div>
          <div class="carpool-leg">
            <span class="leg-tag">FROM SCHOOL</span>
            <h4>${esc(cp.schoolHomeDriver || "Mom / Carpool / TBD")}</h4>
            <p class="leg-time">${esc(cp.schoolHomeTime || "2:55 PM")}</p>
            <p class="muted-text">${esc(cp.schoolHomeNote || "No pick-up note")}</p>
          </div>
        </div>
        <div class="carpool-section-label">🩰 Dance Studio</div>
        <div class="carpool-grid">
          <div class="carpool-leg">
            <span class="leg-tag">TO STUDIO</span>
            <h4>${esc(cp.toDriver || "Not assigned")}</h4>
            <p class="leg-time">${esc(cp.toTime || "No time set")}</p>
            <p class="muted-text">${esc(cp.toNote || "No pickup note")}</p>
          </div>
          <div class="carpool-leg">
            <span class="leg-tag">HOME FROM STUDIO</span>
            <h4>${esc(cp.homeDriver || "Not assigned")}</h4>
            <p class="leg-time">${esc(cp.homeTime || "No time set")}</p>
            <p class="muted-text">${esc(cp.homeNote || "No drop-off note")}</p>
          </div>
        </div>
      `;
    }

    const setInput = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || "";
    };
    setInput("editSchoolToDriver", cp.schoolToDriver);
    setInput("editSchoolToTime", cp.schoolToTime);
    setInput("editSchoolToNote", cp.schoolToNote);
    setInput("editSchoolHomeDriver", cp.schoolHomeDriver);
    setInput("editSchoolHomeTime", cp.schoolHomeTime);
    setInput("editSchoolHomeNote", cp.schoolHomeNote);
    setInput("editToDriver", cp.toDriver);
    setInput("editToTime", cp.toTime);
    setInput("editToNote", cp.toNote);
    setInput("editHomeDriver", cp.homeDriver);
    setInput("editHomeTime", cp.homeTime);
    setInput("editHomeNote", cp.homeNote);
  }

  function formatDayModeLabel(mode) {
    if (mode === "competition") return "Competition";
    if (mode === "recovery") return "Recovery";
    return "School + Studio";
  }

  function renderHistoryView() {
    const targets = getActiveTodayTargets();
    const range = state.historyRange || "7d";
    const entries = filterHistory(state.history, range);
    const stats = computeHistoryStats(entries);

    document.querySelectorAll("[data-history-range]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-history-range") === range);
    });

    const summaryEl = document.getElementById("historySummaryGrid");
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="stat-tile"><span class="stat-label">Avg Score</span><strong>${stats.avgScore}% • ${stats.highScoreDays}/${stats.count} green</strong></div>
        <div class="stat-tile"><span class="stat-label">Avg Salt</span><strong>${stats.avgSodium} mg</strong></div>
        <div class="stat-tile"><span class="stat-label">Avg Water</span><strong>${stats.avgWater} oz</strong></div>
        <div class="stat-tile"><span class="stat-label">Safe &amp; Steady</span><strong>${stats.gbCompliancePct}% • ${stats.symptomFreeCount}/${stats.count}</strong></div>
      `;
    }

    const corrEl = document.getElementById("historyCorrelationCard");
    if (corrEl) {
      const c = stats.symptomCorrelation;
      corrEl.innerHTML = `
        <h4>Salt, Water &amp; Feeling Trends</h4>
        <p><strong>Steady • ${c.steadyDays}d:</strong> ${c.steadyAvgSodium} mg Na • ${c.steadyAvgWater} oz Water</p>
        <p><strong>Symptomatic • ${c.symptomaticDays}d:</strong> ${c.symptomaticAvgSodium} mg Na • ${c.symptomaticAvgWater} oz Water</p>
      `;
    }

    const listEl = document.getElementById("historyEntriesList");
    if (listEl) {
      if (!entries.length) {
        listEl.innerHTML = `<div class="empty-card"><p>No logs in this range yet. Tap <strong>+ Log Past Day</strong> above to add any missed dates.</p></div>`;
      } else {
        listEl.innerHTML = entries
          .map((e) => {
            const sc = computeDailyScore(e, targets);
            const scoreVal = typeof e.score === "number" ? e.score : sc.score;
            const tier = e.scoreTier || sc.tier;
            const goalsHit = e.goalsHit ?? sc.goalsHit;
            const totalGoals = e.totalGoals ?? sc.totalGoals;
            const scoreBadgeCls = tier === "high" ? "badge-safe" : tier === "medium" ? "badge-caution" : "badge-avoid";
            const tierIcon = tier === "high" ? "🟢" : tier === "medium" ? "🟡" : "🔴";

            return `
          <details class="history-entry-card score-tier-${esc(tier)}">
            <summary>
              <span><strong>${esc(e.date)}</strong> • ${esc(formatDayModeLabel(e.dayMode))}${e.danceHours != null ? ` • ${e.danceHours}h` : ""}</span>
              <div class="history-summary-badges">
                <span class="pill-badge ${scoreBadgeCls}">${tierIcon} ${scoreVal}% • ${goalsHit}/${totalGoals}</span>
                <span class="pill-badge ${e.symptomStatus === "steady" && e.gbCompliant !== false ? "badge-safe" : "badge-caution"}">${esc(e.symptomStatus || "steady")}</span>
              </div>
            </summary>
            <div class="history-entry-body">
              <div class="goal-hit-pills">
                <span class="chip ${sc.breakdown.sodiumHit ? "badge-safe" : "badge-caution"}">${sc.breakdown.sodiumHit ? "✓" : "○"} Salt: ${e.sodiumMg}/${e.sodiumTarget} mg</span>
                <span class="chip ${sc.breakdown.waterHit ? "badge-safe" : "badge-caution"}">${sc.breakdown.waterHit ? "✓" : "○"} Water: ${e.waterOz}/${e.waterTarget} oz</span>
                <span class="chip ${sc.breakdown.gbHit ? "badge-safe" : "badge-avoid"}">${sc.breakdown.gbHit ? "✓" : "⚠️"} Fat: ${e.maxMealFat}g ${e.gbCompliant !== false ? "Safe" : "High"}</span>
              </div>
              ${e.notes ? `<p class="muted-text">Notes: ${esc(e.notes)}</p>` : ""}
              <div style="margin-top:8px;">
                <button type="button" class="btn-secondary btn-xs" data-edit-past-date="${esc(e.date)}">✏️ Edit Day</button>
              </div>
            </div>
          </details>
        `;
          })
          .join("");
      }
    }

    const printContainer = document.getElementById("printable-doctor-report");
    if (printContainer) {
      printContainer.innerHTML = renderDoctorReportHtml(state, targets, range);
    }
  }

  function renderSettingsModal() {
    const role = state.viewerRole === "Mom" ? "Mom" : "Dancer";
    const rolePref = getRolePersonalization(state, role);

    const titleEl = document.getElementById("settingsModalTitle");
    if (titleEl) {
      titleEl.textContent = role === "Mom" ? "⚙️ Mom's Settings" : "⚙️ Daughter's Settings";
    }

    document.querySelectorAll("[data-setting-lighting]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-setting-lighting") === rolePref.lighting);
    });

    const autoBox = document.getElementById("settingAutoRuleBox");
    if (autoBox) {
      autoBox.classList.toggle("hidden", rolePref.lighting !== "auto");
    }

    document.querySelectorAll("[data-setting-autorule]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-setting-autorule") === rolePref.autoRule);
    });

    document.querySelectorAll("[data-setting-palette]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-setting-palette") === rolePref.palette);
    });

    const avatarSel = document.getElementById("settingAvatar");
    if (avatarSel && document.activeElement !== avatarSel) {
      avatarSel.value = rolePref.avatar || "🩰";
    }
    const studioInput = document.getElementById("settingStudioName");
    if (studioInput && document.activeElement !== studioInput) {
      studioInput.value = rolePref.studioName || "Calm Studio Plan";
    }
    renderSmartMotto();
  }

  function renderGearModal() {
    document.querySelectorAll("[data-role-btn]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-role-btn") === state.viewerRole);
    });

    const p = state.profile;
    const todayDanceHrs = getDanceHoursForDate(state, getLocalDateString());

    const setVal = (id, v) => {
      const el = document.getElementById(id);
      if (el && document.activeElement !== el) el.value = v ?? "";
    };
    setVal("profName", p.name);
    setVal("profGender", p.gender || "female");
    setVal("profAge", p.age);
    setVal("profWeight", p.weightLbs);
    setVal("profHeightFt", p.heightFt);
    setVal("profHeightIn", p.heightIn);
    setVal("profDanceHours", todayDanceHrs);
    setVal("profPotsLevel", p.potsLevel);
    setVal("profGbLevel", p.gbLevel);
    setVal("profCustomSodium", p.customSodium);
    setVal("profCustomWater", p.customWater);
    setVal("profCustomMealFat", p.customMealFat);
    setVal("profCustomCalories", p.customCalories);

    const dynSummary = document.getElementById("profDynamicDanceSummary");
    if (dynSummary) {
      dynSummary.textContent = `Today's Dance: ${todayDanceHrs} hrs`;
    }

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

    const copy = getRoleCopy(state);
    const sections = copy.manualSections || MANUAL_SECTIONS;

    tabsEl.innerHTML = sections.map(
      (sec) => `<button type="button" class="pill-btn ${sec.id === activeManualSection ? "active" : ""}" data-manual-tab="${esc(sec.id)}">${esc(sec.label)}</button>`
    ).join("");

    const active = sections.find((s) => s.id === activeManualSection) || sections[0];
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
    const targets = getActiveTodayTargets();
    const na = parseFloat(document.getElementById("logItemSodium")?.value) || 0;
    const fat = parseFloat(document.getElementById("logItemFat")?.value) || 0;
    const kcal = parseFloat(document.getElementById("logItemKcal")?.value) || 0;
    const safety = evaluateFoodSafety(na, fat, kcal, targets.maxMealFat);
    const cls = safety.gbRating.status === "safe" ? "badge-safe" : safety.gbRating.status === "caution" ? "badge-caution" : "badge-avoid";
    badge.className = `pill-badge ${cls}`;
    badge.textContent = safety.gbRating.status === "safe"
      ? `✓ Safe • ${fat}g / ${targets.maxMealFat}g limit`
      : `⚠️ ${safety.gbRating.label} • limit ${targets.maxMealFat}g`;
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
      if (titleEl) titleEl.textContent = "Edit Entry";
      document.getElementById("logItemName").value = opt?.name || "";
      document.getElementById("logItemTime").value = slot?.time || nowStr;
      document.getElementById("logItemPortion").value = opt?.basePortion || "";
      document.getElementById("logItemSodium").value = opt?.sodium ?? 0;
      document.getElementById("logItemWater").value = opt?.water ?? 0;
      document.getElementById("logItemFat").value = opt?.fat ?? 0;
      document.getElementById("logItemKcal").value = opt?.kcal ?? 0;
    } else {
      if (titleEl) titleEl.textContent = "Quick Log";
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

  // Past / Missed Day Modal Helpers (Requirement 5)
  function updatePastLogScorePreview() {
    const badge = document.getElementById("pastLogScorePreview");
    if (!badge) return;
    const sodiumMg = parseFloat(document.getElementById("pastLogSodium")?.value) || 0;
    const sodiumTarget = parseFloat(document.getElementById("pastLogSodiumTarget")?.value) || 3600;
    const waterOz = parseFloat(document.getElementById("pastLogWater")?.value) || 0;
    const waterTarget = parseFloat(document.getElementById("pastLogWaterTarget")?.value) || 85;
    const maxMealFat = parseFloat(document.getElementById("pastLogMaxMealFat")?.value) || 0;
    const cap = getActiveTodayTargets().maxMealFat || 5.5;

    const sc = computeDailyScore({
      sodiumMg,
      sodiumTarget,
      waterOz,
      waterTarget,
      maxMealFat,
      maxMealFatCap: cap,
      gbCompliant: maxMealFat <= cap
    });
    badge.className = `pill-badge ${sc.badgeClass}`;
    badge.textContent = `${sc.score}% • ${sc.goalsHit}/${sc.totalGoals} Goals • ${sc.label}`;
  }

  function populatePastLogModalForDate(dateStr) {
    const ds = dateStr || getLocalDateString(new Date(Date.now() - 86400000));
    const dateInput = document.getElementById("pastLogDate");
    if (dateInput) dateInput.value = ds;

    const existing = (state.history || []).find((h) => h.date === ds);
    const scheduledHrs = getDanceHoursForDate(state, ds);
    const calcTargets = getCalculatedTargets(state.profile, { danceHours: scheduledHrs, state, date: ds });

    if (existing) {
      document.getElementById("pastLogDayMode").value = existing.dayMode || "school_dance";
      document.getElementById("pastLogDanceHours").value = existing.danceHours ?? scheduledHrs;
      document.getElementById("pastLogSymptom").value = existing.symptomStatus || "steady";
      document.getElementById("pastLogSodium").value = existing.sodiumMg ?? calcTargets.sodium;
      document.getElementById("pastLogSodiumTarget").value = existing.sodiumTarget ?? calcTargets.sodium;
      document.getElementById("pastLogWater").value = existing.waterOz ?? calcTargets.water;
      document.getElementById("pastLogWaterTarget").value = existing.waterTarget ?? calcTargets.water;
      document.getElementById("pastLogMaxMealFat").value = existing.maxMealFat ?? 3.5;
      document.getElementById("pastLogTotalFat").value = existing.totalFatG ?? 14.0;
      document.getElementById("pastLogNotes").value = existing.notes || "";
    } else {
      document.getElementById("pastLogDayMode").value = scheduledHrs > 0 ? "school_dance" : "recovery";
      document.getElementById("pastLogDanceHours").value = scheduledHrs;
      document.getElementById("pastLogSymptom").value = "steady";
      document.getElementById("pastLogSodium").value = calcTargets.sodium;
      document.getElementById("pastLogSodiumTarget").value = calcTargets.sodium;
      document.getElementById("pastLogWater").value = calcTargets.water;
      document.getElementById("pastLogWaterTarget").value = calcTargets.water;
      document.getElementById("pastLogMaxMealFat").value = 3.5;
      document.getElementById("pastLogTotalFat").value = 14.0;
      document.getElementById("pastLogNotes").value = "";
    }
    updatePastLogScorePreview();
  }

  function openPastLogModal(dateStr = "") {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const targetDate = dateStr || getLocalDateString(yesterday);
    populatePastLogModalForDate(targetDate);
    document.getElementById("pastLogModal")?.classList.remove("hidden");
  }

  // Schedule Class/Event Modal Helpers (Requirement 1)
  function openScheduleEventModal(editEventId = "") {
    const modal = document.getElementById("scheduleEventModal");
    const titleEl = document.getElementById("scheduleEventModalTitle");
    const selDateStr = state.selectedCalendarDate || getLocalDateString();
    const wkName = getWeekdayForDateStr(selDateStr);

    document.getElementById("schedEventDate").value = selDateStr;
    document.getElementById("schedEventDayOfWeek").value = wkName;

    if (editEventId) {
      const events = getScheduleEventsForDate(state, selDateStr);
      const evt = events.find((e) => e.id === editEventId);
      if (evt) {
        if (titleEl) titleEl.textContent = "Edit Class / Schedule Event";
        document.getElementById("schedEventId").value = evt.id;
        document.getElementById("schedEventTitle").value = evt.title || "";
        document.getElementById("schedEventCategory").value = evt.category || "dance";
        document.getElementById("schedEventScope").value = evt.date ? "date" : "weekly";
        document.getElementById("schedEventStart").value = evt.startTime || "16:00";
        document.getElementById("schedEventEnd").value = evt.endTime || "18:00";
        document.getElementById("schedEventIntensity").value = evt.intensity || "high";
        document.getElementById("schedEventLocation").value = evt.location || "Studio A";
        document.getElementById("schedEventNotes").value = evt.notes || "";
        modal?.classList.remove("hidden");
        return;
      }
    }

    if (titleEl) titleEl.textContent = "Add Dance Class / Schedule Event";
    document.getElementById("schedEventId").value = "";
    document.getElementById("schedEventTitle").value = "";
    document.getElementById("schedEventCategory").value = "dance";
    document.getElementById("schedEventScope").value = "weekly";
    document.getElementById("schedEventStart").value = "16:00";
    document.getElementById("schedEventEnd").value = "18:00";
    document.getElementById("schedEventIntensity").value = "high";
    document.getElementById("schedEventLocation").value = "Studio A";
    document.getElementById("schedEventNotes").value = "";
    modal?.classList.remove("hidden");
  }

  // Hidden PIN-Secured Admin Dashboard Helpers (Requirement 2b & 2c)
  function openAdminDashboardModal() {
    const modal = document.getElementById("adminModal");
    if (!modal) return;
    const gate = document.getElementById("adminPinGateSection");
    const content = document.getElementById("adminDashboardContent");
    const errEl = document.getElementById("adminPinError");
    if (errEl) errEl.textContent = "";
    const pinIn = document.getElementById("adminPinInput");
    if (pinIn) pinIn.value = "";

    if (adminUnlockedInSession) {
      gate?.classList.add("hidden");
      content?.classList.remove("hidden");
      populateAdminDashboardFields();
    } else {
      gate?.classList.remove("hidden");
      content?.classList.add("hidden");
    }
    modal.classList.remove("hidden");
  }

  function populateAdminDashboardFields() {
    const url = state.googleSheetWebAppUrl || auth.syncUrl || "";
    const scriptInput = document.getElementById("adminScriptUrlInput");
    if (scriptInput) scriptInput.value = url;

    const bandUrlInput = document.getElementById("adminBandIcsUrlInput");
    if (bandUrlInput) bandUrlInput.value = state.adminConfig?.bandIcsUrl || "";

    const phoneInput = document.getElementById("adminSupportPhoneInput");
    if (phoneInput) {
      phoneInput.value = resolveFamilySupportPhone(state, { unlocked: true });
    }

    const gAuth = state.adminConfig?.googleAuth || {};
    const gClient = document.getElementById("adminGoogleClientIdInput");
    if (gClient) gClient.value = gAuth.clientId || "";
    const gEmails = document.getElementById("adminGoogleEmailsInput");
    if (gEmails) gEmails.value = Array.isArray(gAuth.allowedEmails) ? gAuth.allowedEmails.join(", ") : "";

    const diag = document.getElementById("adminSyncDiagnostics");
    if (diag) {
      diag.textContent = url
        ? `Linked Script URL: ${url.slice(0, 48)}... • Status: ${syncStatus.toUpperCase()}`
        : "No Apps Script URL linked yet. Paste your Web App URL above and click Save & Test URL.";
    }
  }

  function exportIcsCalendar() {
    const cp = state.carpool[state.dayOfWeek] || {};
    const slots = state.schedules[state.dayMode] || [];
    const dayEvents = getScheduleEventsForDate(state, state.selectedCalendarDate || state.dayOfWeek);
    const targets = getActiveTodayTargets();

    function timeToIcs(timeStr, durationMin = 30) {
      const d = parseDateParts(state.selectedCalendarDate || getLocalDateString());
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
      const end = new Date(d.getTime() + durationMin * 60000);
      return { start: fmt(d), end: fmt(end) };
    }

    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//En Pointe & Steady//Wellness PWA//EN"];

    dayEvents.forEach((evt, i) => {
      const durMin = Math.round((Number(evt.durationHours) || 1) * 60);
      const dt = timeToIcs(evt.startTime, durMin);
      lines.push(
        "BEGIN:VEVENT",
        `UID:epsteady-sched-${Date.now()}-${i}@pwa`,
        `DTSTART:${dt.start}`,
        `DTEND:${dt.end}`,
        `SUMMARY:${evt.title}`,
        `LOCATION:${evt.location || "Studio"}`,
        `DESCRIPTION:${evt.notes || evt.category}`,
        "END:VEVENT"
      );
    });

    slots.forEach((slot, i) => {
      const opt = (slot.options || [])[state.selectedOptionIdx[slot.id] || 0] || (slot.options || [])[0];
      if (!opt) return;
      const dt = timeToIcs(slot.time, 30);
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

    if (cp.schoolToDriver) {
      const dt = timeToIcs(cp.schoolToTime || "7:35 AM", 25);
      lines.push(
        "BEGIN:VEVENT",
        `UID:epsteady-school-to-${Date.now()}@pwa`,
        `DTSTART:${dt.start}`,
        `DTEND:${dt.end}`,
        `SUMMARY:Carpool TO School (${cp.schoolToDriver})`,
        `DESCRIPTION:${cp.schoolToNote || ""}`,
        "END:VEVENT"
      );
    }
    if (cp.schoolHomeDriver) {
      const dt = timeToIcs(cp.schoolHomeTime || "2:55 PM", 25);
      lines.push(
        "BEGIN:VEVENT",
        `UID:epsteady-school-home-${Date.now()}@pwa`,
        `DTSTART:${dt.start}`,
        `DTEND:${dt.end}`,
        `SUMMARY:Carpool FROM School (${cp.schoolHomeDriver})`,
        `DESCRIPTION:${cp.schoolHomeNote || ""}`,
        "END:VEVENT"
      );
    }
    if (cp.toDriver) {
      const dt = timeToIcs(cp.toTime || "3:30 PM", 30);
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
      const dt = timeToIcs(cp.homeTime || "9:00 PM", 30);
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

    // 1-Tap Top Bar Role Switcher Pill (Dancer ⇄ Mom)
    document.getElementById("topRoleSwitchBtn")?.addEventListener("click", () => {
      state.viewerRole = state.viewerRole === "Mom" ? "Dancer" : "Mom";
      saveAndSync();
      renderAll();
      if (state.viewerRole === "Dancer") {
        maybeShowDancerCheckinPopup({ force: true });
      }
      showToast(state.viewerRole === "Mom" ? "Switched to Mom View (for the Dancer)" : "Switched to Dancer View");
    });

    // Daughter's App-Open "I feel:" Tap Check-In Popup Buttons (Requirement 6)
    document.getElementById("dancerCheckinModal")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-checkin-symptom]");
      if (!btn) return;
      const chosen = btn.getAttribute("data-checkin-symptom") || "steady";
      state.symptomStatus = chosen;
      document.getElementById("dancerCheckinModal")?.classList.add("hidden");
      saveAndSync();
      renderTopBar();
      renderTodayView();
      showToast(`Checked in: Feeling ${chosen}`);
    });

    // Contextual ℹ️ info buttons (Role-aware, Non-technical)
    document.addEventListener("click", (e) => {
      const infoBtn = e.target.closest("[data-info-topic]");
      if (!infoBtn) return;
      const key = infoBtn.getAttribute("data-info-topic");
      const copy = getRoleCopy(state);
      const topic = copy.infoTopics[key] || CLINICAL_INFO_TOPICS[key];
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
    document.getElementById("manualOpenSourcesBtn")?.addEventListener("click", () => {
      document.getElementById("manualModal")?.classList.add("hidden");
      renderNutritionSourcesModal();
      document.getElementById("sourcesModal")?.classList.remove("hidden");
    });
    document.getElementById("manualOpenHelpBtn")?.addEventListener("click", () => {
      document.getElementById("manualModal")?.classList.add("hidden");
      document.getElementById("helpModal")?.classList.remove("hidden");
    });

    // Dedicated Nutritional & Recommendation Sources Modal (Requirement 3)
    const openSources = () => {
      renderNutritionSourcesModal();
      document.getElementById("sourcesModal")?.classList.remove("hidden");
    };
    document.getElementById("openSourcesBtn")?.addEventListener("click", openSources);
    document.getElementById("openSourcesCardBtn")?.addEventListener("click", openSources);
    document.getElementById("todayOpenSourcesBtn")?.addEventListener("click", openSources);
    document.getElementById("closeSourcesModalBtn")?.addEventListener("click", () => {
      document.getElementById("sourcesModal")?.classList.add("hidden");
    });

    // SMS Help Form Modal (Requirement 2a)
    document.getElementById("openHelpBtn")?.addEventListener("click", () => {
      document.getElementById("helpModal")?.classList.remove("hidden");
    });
    document.getElementById("closeHelpModalBtn")?.addEventListener("click", () => {
      document.getElementById("helpModal")?.classList.add("hidden");
    });
    document.getElementById("cancelHelpModalBtn")?.addEventListener("click", () => {
      document.getElementById("helpModal")?.classList.add("hidden");
    });
    document.getElementById("helpSmsForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const topic = document.getElementById("helpTopicSelect")?.value || "App Help";
      const userMsg = document.getElementById("helpMessageInput")?.value.trim() || "";
      if (!userMsg) return;
      const phone = resolveFamilySupportPhone(state, { unlocked: true });
      const dancerName = state.profile?.name || "Dancer";
      const role = state.viewerRole || "Dancer";
      const fullBody = `[En Pointe & Steady Help]\nFrom: ${dancerName} (${role})\nTopic: ${topic}\n\n${userMsg}`;
      const smsUri = buildSmsHelpUri(phone, fullBody, navigator.userAgent || "");
      document.getElementById("helpModal")?.classList.add("hidden");
      document.getElementById("helpSmsForm")?.reset();
      showToast("Opening text message app...");
      window.location.href = smsUri;
    });

    // Hidden PIN-Secured Admin Dashboard Triggers & Controls (Requirement 2b & 2c)
    document.getElementById("appBrandTitle")?.addEventListener("click", () => {
      brandTapCount += 1;
      clearTimeout(brandTapTimer);
      brandTapTimer = setTimeout(() => {
        brandTapCount = 0;
      }, 2500);
      if (brandTapCount >= 5) {
        brandTapCount = 0;
        openAdminDashboardModal();
      }
    });
    document.getElementById("openAdminPinGateBtn")?.addEventListener("click", () => {
      document.getElementById("gearModal")?.classList.add("hidden");
      openAdminDashboardModal();
    });
    document.getElementById("closeAdminModalBtn")?.addEventListener("click", () => {
      document.getElementById("adminModal")?.classList.add("hidden");
    });
    document.getElementById("adminPinForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const inputPin = document.getElementById("adminPinInput")?.value.trim() || "";
      const errEl = document.getElementById("adminPinError");
      if (!verifyAdminPin(inputPin, state, auth)) {
        if (errEl) errEl.textContent = "Incorrect Admin PIN.";
        return;
      }
      if (errEl) errEl.textContent = "";
      adminUnlockedInSession = true;
      document.getElementById("adminPinGateSection")?.classList.add("hidden");
      document.getElementById("adminDashboardContent")?.classList.remove("hidden");
      populateAdminDashboardFields();
    });

    document.getElementById("adminSaveScriptUrlBtn")?.addEventListener("click", async () => {
      const url = document.getElementById("adminScriptUrlInput")?.value.trim() || "";
      state.googleSheetWebAppUrl = url;
      if (auth.unlocked) {
        saveDeviceAuth({ ...auth, syncUrl: url });
      }
      saveAndSync({ skipPush: true });
      const diag = document.getElementById("adminSyncDiagnostics");
      if (!url) {
        if (diag) diag.textContent = "Cleared Script URL (local-only mode).";
        return;
      }
      if (diag) diag.textContent = "Testing connection to Google Apps Script Cloud_Sync_Store...";
      const res = await pullFromCloud(url);
      if (res.ok) {
        if (diag) {
          diag.textContent = `Connected ✓ • Payload: ${res.payload ? res.payload.length + " bytes" : "Empty store"} • Last updatedBy: ${res.updatedBy || "—"}`;
        }
        showToast("Apps Script URL verified!");
      } else {
        if (diag) diag.textContent = `Connection warning: ${res.error || "Unable to reach URL"}`;
        showToast("Saved URL (check connection status)");
      }
    });

    document.getElementById("adminForcePushBtn")?.addEventListener("click", async () => {
      const url = document.getElementById("adminScriptUrlInput")?.value.trim() || state.googleSheetWebAppUrl || "";
      state.googleSheetWebAppUrl = url;
      const ok = await silentPushToCloud();
      const diag = document.getElementById("adminSyncDiagnostics");
      if (diag) diag.textContent = ok ? `Force Push succeeded at ${new Date().toLocaleTimeString()}` : "Force Push failed (check URL or PIN session)";
      showToast(ok ? "Force-pushed state to Script URL" : "Force Push failed");
    });

    document.getElementById("adminForcePullBtn")?.addEventListener("click", async () => {
      const url = document.getElementById("adminScriptUrlInput")?.value.trim() || state.googleSheetWebAppUrl || "";
      state.googleSheetWebAppUrl = url;
      const res = await silentPullFromCloud({ urlOverride: url });
      const diag = document.getElementById("adminSyncDiagnostics");
      if (diag) diag.textContent = res.ok ? `Force Pull succeeded at ${new Date().toLocaleTimeString()}` : `Force Pull failed (${res.reason || "error"})`;
      showToast(res.ok ? "Pulled latest bundle from Script URL" : "Force Pull failed");
    });

    document.getElementById("adminOpenPairModalBtn")?.addEventListener("click", () => {
      const url = document.getElementById("adminScriptUrlInput")?.value.trim() || state.googleSheetWebAppUrl || auth.syncUrl || "";
      state.googleSheetWebAppUrl = url;
      document.getElementById("adminModal")?.classList.add("hidden");
      document.getElementById("openPairDeviceBtn")?.click();
    });

    document.getElementById("adminSaveAllBtn")?.addEventListener("click", () => {
      const url = document.getElementById("adminScriptUrlInput")?.value.trim() || "";
      state.googleSheetWebAppUrl = url;
      if (auth.unlocked) {
        saveDeviceAuth({ ...auth, syncUrl: url });
      }
      if (!state.adminConfig) state.adminConfig = {};
      state.adminConfig.bandIcsUrl = document.getElementById("adminBandIcsUrlInput")?.value.trim() || "";

      const phoneOverride = document.getElementById("adminSupportPhoneInput")?.value.replace(/[^\d+]/g, "") || "";
      if (phoneOverride && phoneOverride !== resolveFamilySupportPhone({}, { unlocked: true })) {
        state.adminConfig.supportPhoneOverride = phoneOverride;
      } else {
        state.adminConfig.supportPhoneOverride = "";
      }

      const newAdminPin = document.getElementById("adminNewPinInput")?.value.trim() || "";
      const confAdminPin = document.getElementById("adminConfirmPinInput")?.value.trim() || "";
      if (newAdminPin) {
        if (newAdminPin.length < 4 || newAdminPin !== confAdminPin) {
          showToast("New Admin PIN must be 4+ chars and match confirmation");
          return;
        }
        state.adminConfig.adminPin = newAdminPin;
      }

      const gClientId = document.getElementById("adminGoogleClientIdInput")?.value.trim() || "";
      const gEmails = document.getElementById("adminGoogleEmailsInput")?.value.trim() || "";
      state.adminConfig.googleAuth = prepareGoogleSignInConfig({
        enabled: false, // Dormant per Requirement 2c
        clientId: gClientId,
        allowedEmails: gEmails
      });

      saveAndSync();
      document.getElementById("adminModal")?.classList.add("hidden");
      showToast("Admin configuration saved");
    });

    // Bottom nav & View History
    document.querySelectorAll("[data-nav-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeTab = btn.getAttribute("data-nav-tab");
        renderAll();
      });
    });

    document.getElementById("todayOpenScheduleChip")?.addEventListener("click", () => {
      state.activeTab = "carpool";
      state.selectedCalendarDate = getLocalDateString();
      renderAll();
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

    // Past / Missed Day Logging Events (Requirement 5)
    document.getElementById("openPastLogBtn")?.addEventListener("click", () => openPastLogModal(""));
    document.getElementById("todayLogMissedDayBtn")?.addEventListener("click", () => openPastLogModal(""));
    document.getElementById("closePastLogBtn")?.addEventListener("click", () => {
      document.getElementById("pastLogModal")?.classList.add("hidden");
    });
    document.getElementById("cancelPastLogBtn")?.addEventListener("click", () => {
      document.getElementById("pastLogModal")?.classList.add("hidden");
    });
    document.getElementById("history7Dots")?.addEventListener("click", (e) => {
      const dot = e.target.closest("[data-dot-date]");
      if (!dot) return;
      openPastLogModal(dot.getAttribute("data-dot-date"));
    });
    document.getElementById("historyEntriesList")?.addEventListener("click", (e) => {
      const editBtn = e.target.closest("[data-edit-past-date]");
      if (!editBtn) return;
      openPastLogModal(editBtn.getAttribute("data-edit-past-date"));
    });
    document.getElementById("pastLogDate")?.addEventListener("change", (e) => {
      if (e.target.value) populatePastLogModalForDate(e.target.value);
    });
    document.getElementById("pastLogDanceHours")?.addEventListener("input", (e) => {
      const hrs = Math.max(0, parseFloat(e.target.value) || 0);
      const ds = document.getElementById("pastLogDate")?.value || getLocalDateString();
      const t = getCalculatedTargets(state.profile, { danceHours: hrs, state, date: ds });
      document.getElementById("pastLogSodiumTarget").value = t.sodium;
      document.getElementById("pastLogWaterTarget").value = t.water;
      updatePastLogScorePreview();
    });
    ["pastLogSodium", "pastLogSodiumTarget", "pastLogWater", "pastLogWaterTarget", "pastLogMaxMealFat"].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", updatePastLogScorePreview);
    });
    document.querySelectorAll("[data-past-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const presetType = btn.getAttribute("data-past-preset");
        const ds = document.getElementById("pastLogDate")?.value || getLocalDateString();
        let hrs = getDanceHoursForDate(state, ds);
        if (presetType === "rest_day") hrs = 0;
        else if (presetType === "typical_dance" && hrs === 0) hrs = 2.0;

        const t = getCalculatedTargets(state.profile, { danceHours: hrs, state, date: ds });
        document.getElementById("pastLogDanceHours").value = hrs;
        document.getElementById("pastLogDayMode").value = hrs > 0 ? "school_dance" : "recovery";
        document.getElementById("pastLogSodiumTarget").value = t.sodium;
        document.getElementById("pastLogWaterTarget").value = t.water;
        document.getElementById("pastLogSodium").value = presetType === "typical_dance" ? Math.round(t.sodium * 0.92) : t.sodium;
        document.getElementById("pastLogWater").value = presetType === "typical_dance" ? Math.round(t.water * 0.92) : t.water;
        document.getElementById("pastLogMaxMealFat").value = 3.5;
        document.getElementById("pastLogTotalFat").value = 14.0;
        document.getElementById("pastLogSymptom").value = "steady";
        updatePastLogScorePreview();
      });
    });
    document.getElementById("pastLogForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const dateStr = document.getElementById("pastLogDate")?.value;
      if (!dateStr) return;
      const danceHours = parseFloat(document.getElementById("pastLogDanceHours")?.value) || 0;
      const dayTargets = getCalculatedTargets(state.profile, { danceHours, state, date: dateStr });

      const { history, entry } = upsertPastHistoryEntry(
        state.history,
        {
          date: dateStr,
          dayMode: document.getElementById("pastLogDayMode")?.value || "school_dance",
          danceHours,
          symptomStatus: document.getElementById("pastLogSymptom")?.value || "steady",
          sodiumMg: parseFloat(document.getElementById("pastLogSodium")?.value) || 0,
          sodiumTarget: parseFloat(document.getElementById("pastLogSodiumTarget")?.value) || dayTargets.sodium,
          waterOz: parseFloat(document.getElementById("pastLogWater")?.value) || 0,
          waterTarget: parseFloat(document.getElementById("pastLogWaterTarget")?.value) || dayTargets.water,
          maxMealFat: parseFloat(document.getElementById("pastLogMaxMealFat")?.value) || 0,
          totalFatG: parseFloat(document.getElementById("pastLogTotalFat")?.value) || 0,
          notes: document.getElementById("pastLogNotes")?.value.trim() || ""
        },
        dayTargets
      );
      state.history = history;
      try {
        localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(state));
      } catch (_err) {}
      if (auth?.unlocked && auth?.passphrase && (state.googleSheetWebAppUrl || auth.syncUrl)) {
        scheduleCloudPush(() => silentPushToCloud());
      }
      document.getElementById("pastLogModal")?.classList.add("hidden");
      renderAll();
      showToast(`Saved record for ${entry.date} (Score: ${entry.score}%)`);
    });

    // Calendar View Switcher (Month | Week | Day), Date Navigation & Schedule Customizer (Requirement 1 & 1b)
    document.querySelectorAll("[data-cal-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.calendarViewMode = btn.getAttribute("data-cal-view") || "month";
        renderCarpoolView();
      });
    });

    const shiftSelectedDate = (deltaDays) => {
      const cur = parseDateParts(state.selectedCalendarDate || getLocalDateString());
      cur.setDate(cur.getDate() + deltaDays);
      const nextStr = getLocalDateString(cur);
      state.selectedCalendarDate = nextStr;
      state.dayOfWeek = getWeekdayForDateStr(nextStr);
      renderCarpoolView();
    };
    document.getElementById("calPrevBtn")?.addEventListener("click", () => {
      const mode = state.calendarViewMode || "month";
      shiftSelectedDate(mode === "month" ? -30 : mode === "week" ? -7 : -1);
    });
    document.getElementById("calNextBtn")?.addEventListener("click", () => {
      const mode = state.calendarViewMode || "month";
      shiftSelectedDate(mode === "month" ? 30 : mode === "week" ? 7 : 1);
    });
    document.getElementById("calTodayBtn")?.addEventListener("click", () => {
      const todayStr = getLocalDateString();
      state.selectedCalendarDate = todayStr;
      state.dayOfWeek = getWeekdayForDateStr(todayStr);
      renderCarpoolView();
    });

    document.getElementById("view-carpool")?.addEventListener("click", (e) => {
      const dateCell = e.target.closest("[data-cal-date]");
      if (dateCell) {
        const ds = dateCell.getAttribute("data-cal-date");
        if (ds) {
          state.selectedCalendarDate = ds;
          state.dayOfWeek = getWeekdayForDateStr(ds);
          renderCarpoolView();
        }
        return;
      }
      const editEvtBtn = e.target.closest("[data-edit-sched-event]");
      if (editEvtBtn) {
        openScheduleEventModal(editEvtBtn.getAttribute("data-edit-sched-event"));
        return;
      }
      const delEvtBtn = e.target.closest("[data-delete-sched-event]");
      if (delEvtBtn) {
        const id = delEvtBtn.getAttribute("data-delete-sched-event");
        const ds = state.selectedCalendarDate || getLocalDateString();
        const wk = getWeekdayForDateStr(ds);
        if (state.dateScheduleOverrides?.[ds]) {
          state.dateScheduleOverrides[ds] = state.dateScheduleOverrides[ds].filter((ev) => ev.id !== id);
        }
        if (state.weeklySchedule?.[wk]) {
          state.weeklySchedule[wk] = state.weeklySchedule[wk].filter((ev) => ev.id !== id);
        }
        saveAndSync();
        renderAll();
        showToast("Class/event removed from schedule");
      }
    });

    document.getElementById("openAddClassModalBtn")?.addEventListener("click", () => openScheduleEventModal(""));
    document.getElementById("selectedDayAddEventBtn")?.addEventListener("click", () => openScheduleEventModal(""));
    document.getElementById("closeScheduleEventBtn")?.addEventListener("click", () => {
      document.getElementById("scheduleEventModal")?.classList.add("hidden");
    });
    document.getElementById("cancelScheduleEventBtn")?.addEventListener("click", () => {
      document.getElementById("scheduleEventModal")?.classList.add("hidden");
    });
    document.getElementById("scheduleEventForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const id = document.getElementById("schedEventId")?.value || `evt_${Date.now()}`;
      const title = document.getElementById("schedEventTitle")?.value.trim();
      if (!title) return;
      const category = document.getElementById("schedEventCategory")?.value || "dance";
      const scope = document.getElementById("schedEventScope")?.value || "weekly";
      const dayOfWeek = document.getElementById("schedEventDayOfWeek")?.value || state.dayOfWeek || "Mon";
      const dateStr = document.getElementById("schedEventDate")?.value || state.selectedCalendarDate || getLocalDateString();
      const startTime = document.getElementById("schedEventStart")?.value || "16:00";
      const endTime = document.getElementById("schedEventEnd")?.value || "18:00";
      const durationHours = computeTimeRangeDurationHours(startTime, endTime, 1.5);
      const intensity = document.getElementById("schedEventIntensity")?.value || "high";
      const location = document.getElementById("schedEventLocation")?.value.trim() || "Studio";
      const notes = document.getElementById("schedEventNotes")?.value.trim() || "";

      const newEvt = {
        id,
        title,
        category,
        dayOfWeek: scope === "date" ? getWeekdayForDateStr(dateStr) : dayOfWeek,
        date: scope === "date" ? dateStr : undefined,
        startTime,
        endTime,
        durationHours,
        intensity,
        location,
        notes
      };

      if (scope === "date") {
        if (!state.dateScheduleOverrides) state.dateScheduleOverrides = {};
        const baseList = Array.isArray(state.dateScheduleOverrides[dateStr])
          ? [...state.dateScheduleOverrides[dateStr]]
          : [...getScheduleEventsForDate(state, dateStr)];
        const existingIdx = baseList.findIndex((x) => x.id === id);
        if (existingIdx >= 0) baseList[existingIdx] = newEvt;
        else baseList.push(newEvt);
        state.dateScheduleOverrides[dateStr] = baseList;
        state.selectedCalendarDate = dateStr;
        state.dayOfWeek = getWeekdayForDateStr(dateStr);
      } else {
        if (!state.weeklySchedule) state.weeklySchedule = createDefaultWeeklySchedule();
        const list = Array.isArray(state.weeklySchedule[dayOfWeek]) ? [...state.weeklySchedule[dayOfWeek]] : [];
        const existingIdx = list.findIndex((x) => x.id === id);
        if (existingIdx >= 0) list[existingIdx] = newEvt;
        else list.push(newEvt);
        state.weeklySchedule[dayOfWeek] = list;
        state.dayOfWeek = dayOfWeek;
      }

      document.getElementById("scheduleEventModal")?.classList.add("hidden");
      saveAndSync();
      renderAll();
      showToast(`Saved "${title}" (${durationHours} hrs)`);
    });

    // BAND Schedule Sync & Import Wiring (Requirement 1)
    document.getElementById("openBandSyncModalBtn")?.addEventListener("click", () => {
      const urlIn = document.getElementById("bandIcsUrlInput");
      if (urlIn) urlIn.value = state.adminConfig?.bandIcsUrl || "";
      document.getElementById("bandSyncModal")?.classList.remove("hidden");
    });
    document.getElementById("closeBandSyncBtn")?.addEventListener("click", () => {
      document.getElementById("bandSyncModal")?.classList.add("hidden");
    });

    const applyImportedBandEvents = (events, sourceLabel) => {
      if (!Array.isArray(events) || !events.length) {
        showToast("No schedule events found to import");
        return;
      }
      if (!state.weeklySchedule) state.weeklySchedule = createDefaultWeeklySchedule();
      if (!state.dateScheduleOverrides) state.dateScheduleOverrides = {};

      events.forEach((evt) => {
        if (evt.date && /^\d{4}-\d{2}-\d{2}$/.test(evt.date)) {
          const cur = Array.isArray(state.dateScheduleOverrides[evt.date])
            ? [...state.dateScheduleOverrides[evt.date]]
            : [...getScheduleEventsForDate(state, evt.date)];
          if (!cur.some((x) => x.title === evt.title && x.startTime === evt.startTime)) {
            cur.push(evt);
          }
          state.dateScheduleOverrides[evt.date] = cur;
        }
        const wk = evt.dayOfWeek || "Mon";
        const wkList = Array.isArray(state.weeklySchedule[wk]) ? [...state.weeklySchedule[wk]] : [];
        if (!wkList.some((x) => x.title === evt.title && x.startTime === evt.startTime)) {
          wkList.push(evt);
        }
        state.weeklySchedule[wk] = wkList;
      });

      if (!state.adminConfig) state.adminConfig = {};
      state.adminConfig.lastBandSyncAt = new Date().toISOString();
      saveAndSync();
      renderAll();
      document.getElementById("bandSyncModal")?.classList.add("hidden");
      showToast(`Synced ${events.length} classes from ${sourceLabel}!`);
    };

    document.getElementById("bandIcsFileInput")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const events = parseBandIcsSchedule(text);
      applyImportedBandEvents(events, "BAND .ics file");
    });

    document.getElementById("syncBandUrlNowBtn")?.addEventListener("click", async () => {
      const rawUrl = document.getElementById("bandIcsUrlInput")?.value.trim() || "";
      const statusEl = document.getElementById("bandSyncStatusMsg");
      if (!rawUrl) {
        if (statusEl) statusEl.textContent = "Please paste a BAND calendar link first.";
        return;
      }
      const fetchUrl = rawUrl.replace(/^webcal:\/\//i, "https://");
      if (!state.adminConfig) state.adminConfig = {};
      state.adminConfig.bandIcsUrl = fetchUrl;
      if (statusEl) statusEl.textContent = "Syncing with BAND calendar...";

      try {
        let icsText = "";
        const scriptUrl = state.googleSheetWebAppUrl || auth.syncUrl;
        if (scriptUrl) {
          try {
            const sep = scriptUrl.includes("?") ? "&" : "?";
            const proxyResp = await fetch(`${scriptUrl}${sep}action=fetchBandIcs&icsUrl=${encodeURIComponent(fetchUrl)}`);
            if (proxyResp.ok) {
              icsText = await proxyResp.text();
            }
          } catch (_e) {}
        }
        if (!icsText || !icsText.includes("BEGIN:VCALENDAR")) {
          const directResp = await fetch(fetchUrl);
          if (directResp.ok) {
            icsText = await directResp.text();
          }
        }
        const events = parseBandIcsSchedule(icsText);
        if (events.length) {
          if (statusEl) statusEl.textContent = `Synced ${events.length} events from BAND!`;
          applyImportedBandEvents(events, "BAND Calendar Link");
          return;
        }
        if (statusEl) {
          statusEl.textContent = "Saved BAND link! If your browser blocks direct cross-site calendar reads, download the .ics file from BAND or paste the schedule text below.";
        }
        saveAndSync();
      } catch (_err) {
        if (statusEl) {
          statusEl.textContent = "Saved BAND link! To import right away offline, upload the .ics file or paste the class times below.";
        }
        saveAndSync();
      }
    });

    document.getElementById("parseBandTextBtn")?.addEventListener("click", () => {
      const rawText = document.getElementById("bandPasteTextInput")?.value.trim() || "";
      if (!rawText) return;
      const events = parseBandTextSchedule(rawText);
      applyImportedBandEvents(events, "BAND Schedule Text");
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

    // Feature #7: 1-Tap Quick Add Pills (+8 oz Water, +Salt Packet, +Light Snack)
    document.getElementById("quickAddWaterBtn")?.addEventListener("click", () => {
      state.bonusWater = adjustBonusValue(state.bonusWater, 8);
      saveAndSync();
      renderTodayView();
      showToast("Added +8 oz Water 💧");
    });
    document.getElementById("quickAddSaltBtn")?.addEventListener("click", () => {
      state.bonusSodium = adjustBonusValue(state.bonusSodium, 500);
      saveAndSync();
      renderTodayView();
      showToast("Added +500mg Salt Packet 🧂");
    });
    document.getElementById("quickAddSnackBtn")?.addEventListener("click", () => {
      const slotId = `quick_snack_${Date.now()}`;
      if (!Array.isArray(state.schedules[state.dayMode])) {
        state.schedules[state.dayMode] = [];
      }
      state.schedules[state.dayMode].push({
        id: slotId,
        time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        phase: "Light Snack",
        intensity: "low",
        isAdHoc: true,
        options: [
          {
            name: "Pretzels & Apple Slices",
            basePortion: "1 light snack",
            kcal: 200,
            sodium: 280,
            water: 0,
            fat: 1.5
          }
        ]
      });
      state.checkedSlots[slotId] = true;
      saveAndSync();
      renderTodayView();
      showToast("Logged Light Snack (+200 kcal) 🥨");
    });

    // Feature #7: Smart Motto Shuffle & Next Class BAND Pill
    const cycleMotto = () => {
      const role = state.viewerRole === "Mom" ? "Mom" : "Dancer";
      if (!state.personalization) state.personalization = {};
      if (!state.personalization.byRole) {
        state.personalization.byRole = {
          Dancer: { ...DEFAULT_ROLE_PERSONALIZATION.Dancer },
          Mom: { ...DEFAULT_ROLE_PERSONALIZATION.Mom }
        };
      }
      const cur = state.personalization.byRole[role] || { ...DEFAULT_ROLE_PERSONALIZATION[role] };
      cur.mottoIndex = (Number(cur.mottoIndex) || 0) + 1;
      state.personalization.byRole[role] = cur;
      saveAndSync();
      applyPersonalizationTheme();
    };
    document.getElementById("shuffleMottoBtn")?.addEventListener("click", cycleMotto);
    document.getElementById("settingShuffleMottoBtn")?.addEventListener("click", cycleMotto);

    document.getElementById("todayBandPill")?.addEventListener("click", () => {
      state.activeTab = "carpool";
      renderViewVisibility();
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

    // Carpool day switcher, editor & 1-tap share (School & Dance Subsection)
    document.querySelectorAll("[data-carpool-day]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetDay = btn.getAttribute("data-carpool-day");
        state.dayOfWeek = targetDay;
        // Align selectedCalendarDate to the matching day in the currently viewed week
        const cur = parseDateParts(state.selectedCalendarDate || getLocalDateString());
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const targetIdx = days.indexOf(targetDay);
        if (targetIdx >= 0) {
          cur.setDate(cur.getDate() + (targetIdx - cur.getDay()));
          state.selectedCalendarDate = getLocalDateString(cur);
        }
        renderCarpoolView();
      });
    });

    document.getElementById("toggleCarpoolEditBtn")?.addEventListener("click", () => {
      document.getElementById("carpoolEditForm")?.classList.toggle("hidden");
    });

    document.getElementById("shareCarpoolBtn")?.addEventListener("click", async () => {
      const cp = state.carpool[state.dayOfWeek] || {};
      const text = formatCarpoolShareText(state.dayOfWeek, cp);
      await shareOrCopyText(text, `${state.dayOfWeek} School & Dance Carpool`, "Carpool details copied!");
    });

    document.getElementById("saveCarpoolBtn")?.addEventListener("click", () => {
      state.carpool[state.dayOfWeek] = {
        schoolToDriver: document.getElementById("editSchoolToDriver")?.value.trim() || "",
        schoolToTime: document.getElementById("editSchoolToTime")?.value.trim() || "",
        schoolToNote: document.getElementById("editSchoolToNote")?.value.trim() || "",
        schoolHomeDriver: document.getElementById("editSchoolHomeDriver")?.value.trim() || "",
        schoolHomeTime: document.getElementById("editSchoolHomeTime")?.value.trim() || "",
        schoolHomeNote: document.getElementById("editSchoolHomeNote")?.value.trim() || "",
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
      showToast("School & Dance Carpool updated");
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

    // Feature #7: Dedicated Settings Modal (⚙️) — Independent Per-Role Preferences
    const updateActiveRolePref = (patch) => {
      const role = state.viewerRole === "Mom" ? "Mom" : "Dancer";
      if (!state.personalization) state.personalization = {};
      if (!state.personalization.byRole) {
        state.personalization.byRole = {
          Dancer: { ...DEFAULT_ROLE_PERSONALIZATION.Dancer },
          Mom: { ...DEFAULT_ROLE_PERSONALIZATION.Mom }
        };
      }
      state.personalization.byRole[role] = {
        ...getRolePersonalization(state, role),
        ...patch
      };
      saveAndSync();
      applyPersonalizationTheme();
      renderSettingsModal();
    };

    document.getElementById("openSettingsBtn")?.addEventListener("click", () => {
      renderSettingsModal();
      document.getElementById("settingsModal")?.classList.remove("hidden");
    });
    const closeSettingsModal = () => {
      document.getElementById("settingsModal")?.classList.add("hidden");
    };
    document.getElementById("closeSettingsBtn")?.addEventListener("click", closeSettingsModal);
    document.getElementById("closeSettingsDoneBtn")?.addEventListener("click", closeSettingsModal);

    document.querySelectorAll("[data-setting-lighting]").forEach((btn) => {
      btn.addEventListener("click", () => {
        updateActiveRolePref({ lighting: btn.getAttribute("data-setting-lighting") || "day" });
      });
    });
    document.querySelectorAll("[data-setting-autorule]").forEach((btn) => {
      btn.addEventListener("click", () => {
        updateActiveRolePref({ autoRule: btn.getAttribute("data-setting-autorule") || "system" });
      });
    });
    document.querySelectorAll("[data-setting-palette]").forEach((btn) => {
      btn.addEventListener("click", () => {
        updateActiveRolePref({ palette: btn.getAttribute("data-setting-palette") || "blush" });
      });
    });
    document.getElementById("settingAvatar")?.addEventListener("change", (e) => {
      updateActiveRolePref({ avatar: e.target.value || "🩰" });
    });
    document.getElementById("settingStudioName")?.addEventListener("input", (e) => {
      updateActiveRolePref({ studioName: e.target.value });
    });

    // Listen to OS/phone dark mode changes when Auto Rule === "system"
    if (typeof window !== "undefined" && window.matchMedia) {
      const darkMedia = window.matchMedia("(prefers-color-scheme: dark)");
      darkMedia.addEventListener?.("change", () => {
        const pref = getRolePersonalization(state);
        if (pref.lighting === "auto" && pref.autoRule === "system") {
          applyPersonalizationTheme();
        }
      });
    }

    // Profile Modal (👤)
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
        if (state.viewerRole === "Dancer") {
          maybeShowDancerCheckinPopup({ force: true });
        }
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
      p.gender = document.getElementById("profGender")?.value === "male" ? "male" : "female";
      p.age = parseInt(document.getElementById("profAge")?.value, 10) || 14;
      p.weightLbs = parseFloat(document.getElementById("profWeight")?.value) || 110;
      p.heightFt = parseInt(document.getElementById("profHeightFt")?.value, 10) || 5;
      p.heightIn = parseInt(document.getElementById("profHeightIn")?.value, 10) || 0;
      p.potsLevel = document.getElementById("profPotsLevel")?.value || "standard";
      p.gbLevel = document.getElementById("profGbLevel")?.value || "moderate";
      p.customSodium = parseInt(document.getElementById("profCustomSodium")?.value, 10) || 4000;
      p.customWater = parseInt(document.getElementById("profCustomWater")?.value, 10) || 85;
      p.customMealFat = parseFloat(document.getElementById("profCustomMealFat")?.value) || 5.5;
      p.customCalories = parseInt(document.getElementById("profCustomCalories")?.value, 10) || 2000;

      saveAndSync();
      renderAll();
      document.getElementById("gearModal")?.classList.add("hidden");
      showToast("Dancer Profile saved");
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
      const res = await silentPullFromCloud();
      showToast(res.ok ? "Refreshed Family Sync" : "Working offline on this phone");
    });

    // Pair Another Device Modal
    document.getElementById("openPairDeviceBtn")?.addEventListener("click", () => {
      const syncUrl = state.googleSheetWebAppUrl || auth.syncUrl || "";
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
        showToast("Family setup link copied!");
      } catch (_e) {
        showToast("Select and copy the link above");
      }
    });
    document.getElementById("sharePairLinkBtn")?.addEventListener("click", async () => {
      const link = document.getElementById("pairLinkInput")?.value;
      if (!link) return;
      await shareOrCopyText(
        `Tap to open En Pointe & Steady (only our Family PIN is needed): ${link}`,
        "En Pointe & Steady Family Link",
        "Family link copied!"
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
      showToast(pushed ? "Family PIN updated & saved!" : "Family PIN updated on this phone");
    });

    document.getElementById("lockAppBtn")?.addEventListener("click", () => {
      hasPendingCloudPush = false;
      dancerCheckinShownThisOpen = false;
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
          if (errEl) errEl.textContent = "That PIN didn't match your family's saved PIN. Please try again.";
          return;
        }
      }

      state.googleSheetWebAppUrl = syncUrl;
      saveDeviceAuth({ unlocked: true, passphrase: pin, syncUrl, rememberDevice: remember });
      document.getElementById("pinOverlay")?.classList.add("hidden");
      renderAll();
      maybeShowDancerCheckinPopup({ force: true });
    });

    window.addEventListener("focus", () => {
      if (auth.unlocked) silentPullFromCloud();
    });
  }

  function initApp() {
    // Support #admin or ?admin=1 shortcut to open Admin PIN Gate
    if (window.location.hash === "#admin" || window.location.search.includes("admin=1")) {
      setTimeout(() => openAdminDashboardModal(), 150);
    }

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
      showToast("Family link connected! Enter your Family PIN to open.");
    }

    rolloverDayIfNeeded();
    wireEvents();
    renderAll();

    if (auth.unlocked && auth.passphrase) {
      document.getElementById("pinOverlay")?.classList.add("hidden");
      maybeShowDancerCheckinPopup({ force: true });
      silentPullFromCloud();
    } else {
      const pinUrlInput = document.getElementById("pinSyncUrlInput");
      if (pinUrlInput && (state.googleSheetWebAppUrl || auth.syncUrl)) {
        pinUrlInput.value = state.googleSheetWebAppUrl || auth.syncUrl;
      }
      document.getElementById("pinOverlay")?.classList.remove("hidden");
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).catch(() => {});
    }
  }

  document.addEventListener("DOMContentLoaded", initApp);
}
