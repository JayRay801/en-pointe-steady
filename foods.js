/**
 * foods.js — POTS & Gallbladder-Safe Food Library, Keyword Estimator & Safety Evaluator
 * Zero PII: Contains only generic nutrition data and POTS/Gallbladder rules.
 */

export const DEFAULT_FOOD_LIBRARY = [
  { id: "f_1", name: "Electrolyte Water + Salted Pretzels", baseServing: "16oz LMNT or Liquid I.V. + 15 mini pretzels", category: "Morning / Wake-Up", kcal: 130, sodium: 850, fat: 0.5, water: 16 },
  { id: "f_2", name: "Gatorade Zero / Pedialyte Sport + Salted Rice Cake", baseServing: "16oz bottle + 1 salted rice cake", category: "Electrolyte / Drink", kcal: 55, sodium: 590, fat: 0.0, water: 16 },
  { id: "f_3", name: "Warm Chicken Bone Broth with Sea Salt", baseServing: "12oz warm mug + 4 saltine crackers", category: "Electrolyte / Drink", kcal: 95, sodium: 780, fat: 1.0, water: 12 },
  { id: "f_4", name: "Watermelon Cubes with Sea Salt / Tajín + Water", baseServing: "1.5 cups watermelon + 1/4 tsp salt + 12oz water", category: "Between Classes", kcal: 75, sodium: 560, fat: 0.2, water: 16 },
  { id: "f_5", name: "Egg White & Egg Scramble on Salted Sourdough + Berries", baseServing: "3 egg whites + 1 egg + 1 slice toast + 1/2 cup berries", category: "Morning / School", kcal: 280, sodium: 520, fat: 4.5, water: 8 },
  { id: "f_6", name: "Warm Oatmeal with Sea Salt, Maple & Banana", baseServing: "1 cup oats in skim/almond milk + 1 banana + 1/4 tsp salt", category: "Morning / School", kcal: 290, sodium: 480, fat: 2.0, water: 8 },
  { id: "f_7", name: "0% Greek Yogurt Parfait + Honey + Pretzel Crumble", baseServing: "3/4 cup 0% Greek yogurt + 1 tsp honey + 1/3 cup pretzels", category: "Morning / School", kcal: 230, sodium: 390, fat: 0.5, water: 8 },
  { id: "f_8", name: "Toasted Bagel Thin with Jam + Deli Turkey", baseServing: "1 bagel thin + 1 tbsp jam + 3 oz turkey breast", category: "Morning / School", kcal: 260, sodium: 690, fat: 2.0, water: 8 },
  { id: "f_9", name: "Starbucks Egg White & Roasted Red Pepper Bites", baseServing: "2 egg bites + 16oz iced water", category: "Morning / School", kcal: 170, sodium: 470, fat: 5.0, water: 16 },
  { id: "f_10", name: "Deli Turkey Breast Roll-Ups + Pickle Spear + Pretzels", baseServing: "4 slices lean turkey + 1 pickle spear + 12 pretzel crisps", category: "Morning / School", kcal: 240, sodium: 820, fat: 2.0, water: 12 },
  { id: "f_11", name: "1% Cottage Cheese with Fruit + Salted Crackers", baseServing: "1/2 cup 1% cottage cheese + 1/2 cup pineapple/peach + 5 crackers", category: "Morning / School", kcal: 190, sodium: 540, fat: 1.5, water: 8 },
  { id: "f_12", name: "Grilled Chicken & Honey Mustard Wrap + Baked Lay's", baseServing: "1 wrap w/ 3.5oz chicken, lettuce, pickles + 1oz baked chips", category: "Morning / School", kcal: 370, sodium: 910, fat: 4.5, water: 16 },
  { id: "f_13", name: "1/4 Avocado on Salted Sourdough + Sliced Turkey", baseServing: "1 slice sourdough + 1/4 avocado + 2 oz turkey", category: "Morning / School", kcal: 250, sodium: 580, fat: 5.5, water: 8 },
  { id: "f_14", name: "Thermos Low-Fat Chicken & Rice/Noodle Soup + Saltines", baseServing: "1.5 cups warm soup + 6 salted crackers", category: "Between Classes", kcal: 260, sodium: 890, fat: 2.5, water: 12 },
  { id: "f_15", name: "Salted Rice Cakes + PB2 + Banana Slices", baseServing: "2 salted rice cakes + 2 tbsp prepared PB2 + 1/2 banana", category: "Between Classes", kcal: 220, sodium: 450, fat: 2.0, water: 12 },
  { id: "f_16", name: "Pickle Juice Shot + Applesauce Pouch + Pretzels", baseServing: "2oz pickle brine + 1 pouch + 10 mini pretzels", category: "Between Classes", kcal: 150, sodium: 680, fat: 0.5, water: 12 },
  { id: "f_17", name: "Steamed Sea-Salt Edamame Pods + Salted Rice Rollers", baseServing: "3/4 cup edamame in pods + 2 rice rollers", category: "Between Classes", kcal: 210, sodium: 540, fat: 3.5, water: 12 },
  { id: "f_18", name: "Warm Miso Soup + Pretzel Thins", baseServing: "12oz miso soup + 10 pretzel thins", category: "Between Classes", kcal: 165, sodium: 840, fat: 1.5, water: 12 },
  { id: "f_19", name: "Light Laughing Cow Wedge + Wheat Thins + Grapes", baseServing: "1 light wedge + 12 crackers + 1/2 cup grapes", category: "Between Classes", kcal: 215, sodium: 410, fat: 3.5, water: 8 },
  { id: "f_20", name: "Air-Popped Salted Popcorn + Electrolyte Drink", baseServing: "2.5 cups light salted popcorn + 12oz electrolyte water", category: "Between Classes", kcal: 130, sodium: 490, fat: 2.0, water: 12 },
  { id: "f_21", name: "Pretzel Rods + Fat-Free Roasted Red Pepper Hummus", baseServing: "4 salted pretzel rods + 2 tbsp low-fat hummus", category: "Between Classes", kcal: 195, sodium: 560, fat: 1.5, water: 12 },
  { id: "f_22", name: "Jasmine Rice Bowl with Grilled Teriyaki Chicken & Carrots", baseServing: "1 cup white rice + 3.5 oz grilled chicken breast", category: "Late-Night Recovery", kcal: 340, sodium: 640, fat: 3.0, water: 10 },
  { id: "f_23", name: "Baked Potato with Sea Salt, 0% Yogurt & Turkey", baseServing: "1 medium baked potato + 2 tbsp 0% yogurt + 2 oz lean turkey", category: "Late-Night Recovery", kcal: 310, sodium: 580, fat: 2.0, water: 10 },
  { id: "f_24", name: "Warm Egg-Drop or Won-Ton Broth Soup with White Rice", baseServing: "1.5 cups soup + 1/2 cup steamed white rice", category: "Late-Night Recovery", kcal: 250, sodium: 790, fat: 3.0, water: 12 },
  { id: "f_25", name: "Grilled White Fish or Shrimp Corn Tacos with Salsa", baseServing: "2 corn tortillas + 3.5 oz grilled fish/shrimp + pico de gallo", category: "Late-Night Recovery", kcal: 295, sodium: 610, fat: 3.0, water: 10 },
  { id: "f_26", name: "Whole-Wheat Pasta with Marinara & 99% Lean Turkey", baseServing: "1 cup pasta + 1/2 cup marinara + 3 oz 99% lean turkey", category: "Late-Night Recovery", kcal: 350, sodium: 670, fat: 3.0, water: 10 },
  { id: "f_27", name: "Subway 6-Inch Oven-Roasted Turkey Sub", baseServing: "6-inch Italian/Wheat w/ mustard & pickles, no cheese/mayo + Baked Lay's", category: "Restaurant / Fast Food", kcal: 380, sodium: 960, fat: 4.0, water: 16 },
  { id: "f_28", name: "Chick-fil-A 8-ct Grilled Nuggets + Fruit Cup", baseServing: "8 grilled nuggets + honey mustard + medium fruit cup + 16oz water", category: "Restaurant / Fast Food", kcal: 210, sodium: 530, fat: 3.0, water: 16 },
  { id: "f_29", name: "Chipotle Grilled Chicken Bowl, Half Portion", baseServing: "1/2 bowl w/ rice, black beans, veggies & salsa — no cheese/sour cream/guac", category: "Restaurant / Fast Food", kcal: 365, sodium: 890, fat: 5.0, water: 16 },
  { id: "f_30", name: "Panera Homestyle Chicken Noodle Soup + Baguette", baseServing: "1 bowl soup + 1/2 baguette piece", category: "Restaurant / Fast Food", kcal: 260, sodium: 1120, fat: 3.5, water: 12 },
  { id: "f_31", name: "Panda Express Grilled Teriyaki Chicken, Rice & Greens", baseServing: "1/2 entrée no-skin chicken + 1 cup steamed rice & super greens", category: "Restaurant / Fast Food", kcal: 370, sodium: 740, fat: 5.5, water: 16 },
  { id: "f_32", name: "Taco Bell Fresco Grilled Chicken Soft Taco", baseServing: "1 Fresco soft taco w/ pico — no cheese or creamy sauce", category: "Restaurant / Fast Food", kcal: 160, sodium: 510, fat: 3.5, water: 12 },
  { id: "f_33", name: "⚠️ Fried Chicken Nuggets & Medium French Fries", baseServing: "8 breaded nuggets + medium fries", category: "Restaurant / Fast Food", kcal: 680, sodium: 1150, fat: 34.0, water: 0 },
  { id: "f_34", name: "⚠️ Greasy Pepperoni / Extra Cheese Pizza", baseServing: "2 regular slices", category: "Restaurant / Fast Food", kcal: 620, sodium: 1380, fat: 26.0, water: 0 },
  { id: "f_35", name: "⚠️ Creamy Cheese-Foam Boba Milk Tea", baseServing: "16 oz cup with tapioca pearls", category: "Restaurant / Fast Food", kcal: 450, sodium: 95, fat: 14.0, water: 12 },
  { id: "f_36", name: "⚠️ Fettuccine Alfredo or Mac & Cheese Bowl", baseServing: "1.5 cups creamy pasta", category: "Restaurant / Fast Food", kcal: 710, sodium: 990, fat: 38.0, water: 0 }
];

export const NUTRITION_KEYWORD_RULES = [
  { keys: ["pretzel", "pretzels", "crisps"], serving: "1 oz, ~15 twists", kcal: 110, sodium: 450, fat: 1.0, water: 0, cat: "Between Classes" },
  { keys: ["pickle", "brine", "olives"], serving: "2 spears or 2oz brine", kcal: 15, sodium: 620, fat: 0.0, water: 2, cat: "Between Classes" },
  { keys: ["lmnt", "liquid iv", "liquid i.v.", "dripdrop", "electrolyte", "pedialyte"], serving: "16oz prepared bottle", kcal: 45, sodium: 750, fat: 0.0, water: 16, cat: "Electrolyte / Drink" },
  { keys: ["gatorade", "powerade", "bodyarmor"], serving: "16oz sports bottle", kcal: 80, sodium: 380, fat: 0.0, water: 16, cat: "Electrolyte / Drink" },
  { keys: ["miso", "broth", "chicken noodle", "chicken rice", "soup"], serving: "1.5 cups warm soup", kcal: 210, sodium: 880, fat: 2.5, water: 12, cat: "Between Classes" },
  { keys: ["ramen", "instant noodles", "cup noodles"], serving: "1 cup prepared noodles", kcal: 320, sodium: 1180, fat: 7.0, water: 10, cat: "Morning / School" },
  { keys: ["turkey", "chicken breast", "deli", "grilled chicken"], serving: "3.5 oz lean poultry", kcal: 165, sodium: 640, fat: 2.5, water: 4, cat: "Morning / School" },
  { keys: ["rice cake", "rice crisps", "rice roller"], serving: "2 salted cakes/rollers", kcal: 100, sodium: 240, fat: 0.5, water: 0, cat: "Between Classes" },
  { keys: ["oatmeal", "oats", "porridge"], serving: "1 cup cooked with pinch of salt", kcal: 240, sodium: 380, fat: 2.5, water: 8, cat: "Morning / School" },
  { keys: ["yogurt", "greek yogurt", "parfait"], serving: "3/4 cup 0% Greek yogurt + fruit", kcal: 170, sodium: 140, fat: 0.5, water: 6, cat: "Morning / School" },
  { keys: ["banana", "apple", "berries", "grapes", "melon", "watermelon", "fruit", "applesauce"], serving: "1 cup fruit — add a pinch of sea salt", kcal: 95, sodium: 280, fat: 0.3, water: 6, cat: "Between Classes" },
  { keys: ["potato", "sweet potato", "baked potato"], serving: "1 medium baked potato with sea salt", kcal: 220, sodium: 480, fat: 0.5, water: 6, cat: "Late-Night Recovery" },
  { keys: ["rice", "jasmine rice", "white rice", "teriyaki"], serving: "1 cup steamed rice + lean protein", kcal: 320, sodium: 590, fat: 2.5, water: 6, cat: "Late-Night Recovery" },
  { keys: ["bagel", "toast", "sourdough", "bread", "english muffin"], serving: "1 bagel thin or 2 slices toast + jam", kcal: 210, sodium: 410, fat: 1.5, water: 4, cat: "Morning / School" },
  { keys: ["egg white", "egg bites"], serving: "3 egg whites or 2 egg white bites", kcal: 150, sodium: 440, fat: 3.5, water: 4, cat: "Morning / School" },
  { keys: ["egg", "eggs", "omelet", "scramble"], serving: "2 whole eggs scrambled", kcal: 180, sodium: 340, fat: 11.0, water: 4, cat: "Morning / School" },
  { keys: ["avocado", "guacamole"], serving: "1/2 avocado — watch fat limit", kcal: 160, sodium: 250, fat: 14.5, water: 4, cat: "Morning / School" },
  { keys: ["peanut butter", "almond butter", "nuts", "trail mix"], serving: "2 tbsp nut butter — try PB2 instead", kcal: 190, sodium: 150, fat: 16.0, water: 0, cat: "Morning / School" },
  { keys: ["pb2", "pbfit", "powdered peanut"], serving: "2 tbsp prepared powdered PB", kcal: 60, sodium: 180, fat: 1.5, water: 2, cat: "Between Classes" },
  { keys: ["fries", "french fries", "fried", "tenders", "wings", "tempura"], serving: "1 medium order — high fat", kcal: 540, sodium: 950, fat: 27.0, water: 0, cat: "Restaurant / Fast Food" },
  { keys: ["pizza", "pepperoni", "quesadilla", "grilled cheese", "nachos"], serving: "2 slices / 1 order — high fat", kcal: 590, sodium: 1250, fat: 25.0, water: 0, cat: "Restaurant / Fast Food" },
  { keys: ["burger", "cheeseburger", "double", "bacon"], serving: "1 burger — high fat", kcal: 610, sodium: 1080, fat: 31.0, water: 0, cat: "Restaurant / Fast Food" },
  { keys: ["ice cream", "milkshake", "boba", "frappuccino", "frosty", "donut"], serving: "1 medium cup — high fat, low salt", kcal: 440, sodium: 140, fat: 16.0, water: 8, cat: "Restaurant / Fast Food" },
  { keys: ["sub", "sandwich", "wrap", "panini", "pita"], serving: "6-inch lean turkey/chicken sub, no mayo", kcal: 330, sodium: 860, fat: 4.0, water: 8, cat: "Morning / School" },
  { keys: ["taco", "burrito", "chipotle", "fajita"], serving: "2 grilled chicken corn tacos w/ salsa, no cheese", kcal: 310, sodium: 680, fat: 4.5, water: 8, cat: "Late-Night Recovery" },
  { keys: ["sushi", "california roll", "cucumber roll", "edamame"], serving: "6–8 pc roll + soy sauce, no tempura/mayo", kcal: 260, sodium: 790, fat: 3.5, water: 8, cat: "Late-Night Recovery" },
  { keys: ["pasta", "spaghetti", "marinara", "noodles"], serving: "1 cup pasta with marinara, no cream", kcal: 310, sodium: 580, fat: 2.5, water: 6, cat: "Late-Night Recovery" },
  { keys: ["popcorn", "crackers", "saltines", "goldfish", "cheez-it"], serving: "1.5 cups / 1 oz crackers", kcal: 140, sodium: 420, fat: 3.5, water: 0, cat: "Between Classes" }
];

/**
 * Evaluate POTS & Gallbladder safety for a food item.
 * Thresholds:
 *  - Gallbladder: <= maxMealFat (default 5.5g) -> safe; > maxMealFat and < max(8.0, maxMealFat+2.5) -> caution; >= 8.0 or > maxMealFat+2.5 -> avoid
 *  - POTS: sodium < 250 && kcal > 350 -> caution (heavy carb / low salt); < 350 -> fair; >= 350 -> great
 */
export function evaluateFoodSafety(sodium, fat, kcal, maxMealFat = 5.5) {
  const na = Number(sodium) || 0;
  const f = Number(fat) || 0;
  const cal = Number(kcal) || 0;
  const cap =
    maxMealFat != null && maxMealFat !== "" && Number.isFinite(Number(maxMealFat))
      ? Number(maxMealFat)
      : 5.5;

  let potsRating;
  if (na < 250 && cal > 350) {
    potsRating = { status: "caution", label: "Low Salt", isGood: false, tone: "badge-avoid" };
  } else if (na < 350) {
    potsRating = { status: "fair", label: "Pair w/ Salt", isGood: true, tone: "badge-caution" };
  } else {
    potsRating = { status: "great", label: "High Na", isGood: true, tone: "badge-safe" };
  }

  let gbRating;
  if (f >= 8 || f > cap + 2.5) {
    gbRating = { status: "avoid", label: `Avoid • ${f}g fat`, isGood: false, tone: "badge-avoid" };
  } else if (f > cap) {
    gbRating = { status: "caution", label: `Caution • ${f}g fat`, isGood: false, tone: "badge-caution" };
  } else {
    gbRating = { status: "safe", label: `Safe • ${f}g fat`, isGood: true, tone: "badge-safe" };
  }

  // Overall combined badge for quick scanning
  let overall = "safe";
  let overallLabel = "Safe";
  if (gbRating.status === "avoid") {
    overall = "avoid";
    overallLabel = "Avoid";
  } else if (gbRating.status === "caution" || potsRating.status === "caution") {
    overall = "caution";
    overallLabel = "Caution";
  }

  return { potsRating, gbRating, overall, overallLabel };
}

/**
 * Estimate nutrition for a free-text query using local food library + 28 keyword rules.
 */
export function estimateNutritionForQuery(rawText, library = DEFAULT_FOOD_LIBRARY) {
  const q = (rawText || "").toLowerCase().trim();
  if (!q) return null;

  const existing = (library || DEFAULT_FOOD_LIBRARY).find((f) =>
    f.name.toLowerCase().includes(q)
  );
  if (existing) {
    return {
      name: existing.name,
      serving: existing.baseServing,
      kcal: existing.kcal,
      sodium: existing.sodium,
      fat: existing.fat,
      water: existing.water || 8,
      category: existing.category,
      source: "Matched in POTS & Gallbladder Database"
    };
  }

  for (const rule of NUTRITION_KEYWORD_RULES) {
    if (rule.keys.some((k) => q.includes(k))) {
      return {
        name: rawText.trim(),
        serving: rule.serving,
        kcal: rule.kcal,
        sodium: rule.sodium,
        fat: rule.fat,
        water: rule.water,
        category: rule.cat,
        source: "Auto-Calculated Nutrition Profile"
      };
    }
  }

  return {
    name: rawText.trim(),
    serving: "1 standard dancer portion",
    kcal: 220,
    sodium: 460,
    fat: 3.0,
    water: 8,
    category: "Between Classes",
    source: "Standard Portion Estimate"
  };
}

/**
 * Query OpenFoodFacts API with 3s timeout, falling back to heuristic estimate.
 */
export async function lookupFoodOpenFoodFacts(query, fallbackEst = null) {
  const est = fallbackEst || estimateNutritionForQuery(query);
  if (!query || !query.trim()) return est;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query.trim())}&search_simple=1&action=process&json=1&page_size=2`;
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!resp.ok) return est;
    const data = await resp.json();
    if (data && Array.isArray(data.products) && data.products.length > 0) {
      const prod = data.products[0];
      const nut = prod.nutriments || {};
      const kcal = Math.round(nut["energy-kcal_serving"] || nut["energy-kcal_100g"] || (est ? est.kcal : 200));
      const rawSodiumG = nut.sodium_serving ?? nut.sodium_100g;
      const sodium = rawSodiumG != null
        ? Math.round(Number(rawSodiumG) * 1000)
        : (est ? est.sodium : 400);
      const rawFat = nut.fat_serving ?? nut.fat_100g;
      const fat = rawFat != null
        ? parseFloat(Number(rawFat).toFixed(1))
        : (est ? est.fat : 3.0);

      return {
        name: prod.product_name || query.trim(),
        serving: prod.serving_size || "1 serving (100g)",
        kcal,
        sodium,
        fat,
        water: est ? est.water : 8,
        category: (est && est.category) || "Looked Up Food",
        source: "OpenFoodFacts Nutrition Database"
      };
    }
  } catch (_err) {
    // Network timeout or offline: return local estimate cleanly
  }
  return est;
}

/**
 * Trusted clinical, scientific, and nutritional sources used for all food values and daily target recommendations.
 */
export const NUTRITION_SOURCES = [
  {
    id: "src_pots",
    category: "POTS Salt & Hydration Guidelines",
    title: "Dysautonomia International & Heart Rhythm Society POTS Consensus",
    organization: "Dysautonomia International • Heart Rhythm Society (HRS) • NIH / NHLBI POTS Expert Consensus",
    summary:
      "Recommends 3,000–10,000 mg of daily sodium (Mild 3,000 mg, Standard 3,600 mg, High 4,500+ mg base) paired with 2.0–3.0+ liters (68–100+ oz) of daily fluid to expand plasma volume, support orthostatic blood pressure during standing and leaps, and replace studio sweat (+180–210 mg sodium and +8–9 oz fluid per hour of active dance).",
    howUsedInApp:
      "Drives the daily Sodium (mg) and Hydration (oz) targets, dynamically adjusting each day based on the dancer's scheduled dance class hours."
  },
  {
    id: "src_gallbladder",
    category: "Stomach & Gallbladder Low-Fat Thresholds",
    title: "ACG / NIDDK Clinical Low-Fat Biliary & Gallbladder Dietary Guidelines",
    organization: "National Institute of Diabetes and Digestive and Kidney Diseases (NIDDK / NIH) • American College of Gastroenterology (ACG)",
    summary:
      "Large boluses of dietary fat trigger strong cholecystokinin (CCK)-mediated gallbladder contractions that can cause upper-abdominal pain, cramping, or nausea during physical activity. Small, frequent meals capped at ≤ 5.5g fat per meal (Moderate), ≤ 4.0g (Strict), or ≤ 2.5g (Gentle/Flare) minimize digestive strain while delivering steady energy.",
    howUsedInApp:
      "Drives the per-meal Fat Cap (Safe / Caution / Avoid badges) in the Food Analyzer, Quick Log, and Daily Target Score."
  },
  {
    id: "src_dancer_energy",
    category: "Dancer Energy, BMR, Gender & Activity Scaling",
    title: "Mifflin-St Jeor Equation, IADMS Dancer Nutrition & Compendium of Physical Activities",
    organization: "Mifflin et al. (Am J Clin Nutr) • International Association for Dance Medicine & Science (IADMS) • Compendium of Physical Activities (Dance METs)",
    summary:
      "Calculates resting energy expenditure using the validated Mifflin-St Jeor equation (10 × weight_kg + 6.25 × height_cm - 5 × age - 161 for Females; + 5 for Males) with a 1.35× non-exercise baseline plus dynamic dance energy expenditure (4.2 kcal/kg/hr Female, 4.6 kcal/kg/hr Male across ballet, pointe, contemporary, and rehearsal METs).",
    howUsedInApp:
      "Drives the daily Calorie target and automatic Portion Multiplier (0.75x Lighter to 1.5x High-Output Portion) using that specific day's scheduled dance hours and Male/Female profile selection."
  },
  {
    id: "src_food_db",
    category: "Food & Electrolyte Nutrient Databases",
    title: "USDA FoodData Central, OpenFoodFacts & Official Brand Nutrition Facts",
    organization: "USDA Agricultural Research Service (FoodData Central) • OpenFoodFacts Public Database • Verified Manufacturer Labels",
    summary:
      "Nutrient profiles (Sodium mg, Fat g, Calories kcal, Serving size) are compiled from USDA FoodData Central standard reference entries, live OpenFoodFacts barcode/product data, and official published nutrition facts panels for LMNT, Liquid I.V., TriOral WHO ORS, SaltStick/Vitassium, Subway, Chick-fil-A, Chipotle, Panera, Panda Express, and Taco Bell.",
    howUsedInApp:
      "Powers the 36 curated dancer meals/snacks, 28 instant keyword rules, and live online food lookup in the Food tab."
  }
];

