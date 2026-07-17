import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  Dimensions,
  RefreshControl
} from "react-native";
import { LoadingIndicator } from "../components/LoadingIndicator";
import * as Haptics from "expo-haptics";
import notifee from "@notifee/react-native";
import Svg, { Polyline, Text as SvgText } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { onSolid } from "../theme/colorUtils";
import { api } from "../api/client";

import { BarcodeScannerModal } from "../components/BarcodeScannerModal";
import { toast, Msg } from "../lib/toast";

// ── Substance types ───────────────────────────────────────────────────────────

type SubstanceType = "caffeine" | "alcohol";

type SubstanceResult = {
  source_food_id: string;
  name: string;
  caffeine_mg?: number | null;
  abv_percent?: number | null;
  source_db: string;
};

type SubstancePending = {
  name: string;
  substance_type: SubstanceType;
  caffeine_mg: number | null;
  abv_percent: number | null;
  volume_ml: number | null;
  source_food_id?: string;
  source_db?: string;
};

type SubstanceEntry = {
  id: string;
  substance_type: SubstanceType;
  name: string;
  caffeine_mg: number | null;
  abv_percent: number | null;
  volume_ml: number | null;
  logged_at: string;
};

type SubstanceTotals = {
  caffeine_mg: number;
  standard_drinks: number;
};

// ── Caffeine edit form ────────────────────────────────────────────────────────

function CaffeineForm({
  initial,
  onSave,
  onCancel,
  theme,
}: {
  initial: SubstancePending;
  onSave: (v: SubstancePending) => void;
  onCancel: () => void;
  theme: any;
}) {
  const ink = theme.ink;
  const card = theme.card;
  const styles = useMemo(() => makeStyles(ink, card), [ink, card]);
  const [name, setName] = useState(initial.name);
  const [mg, setMg] = useState(initial.caffeine_mg != null ? String(initial.caffeine_mg) : "");
  const [nameErr, setNameErr] = useState("");
  const [mgErr, setMgErr] = useState("");

  function handleSave() {
    let valid = true;
    if (!name.trim()) { setNameErr("Drink name is required."); valid = false; } else setNameErr("");
    const parsed = parseFloat(mg);
    if (!mg.trim() || isNaN(parsed) || parsed <= 0) { setMgErr("Enter caffeine amount in mg (e.g. 95)."); valid = false; } else setMgErr("");
    if (!valid) return;
    if (parsed > 1000) {
      Alert.alert(
        "Does this look right?",
        `${parsed} mg caffeine is quite a lot for one drink — just checking it's not a typo.`,
        [
          { text: "Let me fix it", style: "cancel" },
          { text: "Yes, save it", onPress: () => onSave({ ...initial, name: name.trim(), caffeine_mg: parsed }) },
        ]
      );
      return;
    }
    onSave({ ...initial, name: name.trim(), caffeine_mg: parsed });
  }

  return (
    <View style={styles.editForm}>
      <TextInput
        value={name}
        onChangeText={v => { setName(v); setNameErr(""); }}
        placeholder="Drink name"
        placeholderTextColor={theme.textSoft}
        style={[styles.textInput, { color: theme.textStrong, borderColor: nameErr ? theme.coral.solid : ink }]}
      />
      {nameErr ? <Text style={{ color: theme.coral.solid, fontSize: 11, marginTop: -4 }}>{nameErr}</Text> : null}
      <View style={styles.macroInputRow}>
        <TextInput
          value={mg}
          onChangeText={v => { setMg(v); setMgErr(""); }}
          placeholder="mg"
          placeholderTextColor={theme.textSoft}
          keyboardType="decimal-pad"
          style={[styles.macroInput, { color: theme.textStrong, flex: 1, borderColor: mgErr ? theme.coral.solid : ink }]}
        />
      </View>
      {mgErr ? <Text style={{ color: theme.coral.solid, fontSize: 11, marginTop: -4 }}>{mgErr}</Text> : null}
      <View style={styles.macroInputRow}>
        <Text style={[styles.macroLabel, { color: ink }]}>CAFFEINE (mg)</Text>
      </View>
      {initial.source_db === "usda" || initial.source_db === "openfoodfacts" ? (
        <Text style={{ color: theme.textSoft, fontSize: 11 }}>
          Value is per 100g — adjust for your actual serving.
        </Text>
      ) : null}
      <View style={styles.editFormButtons}>
        <Pressable onPress={onCancel} style={styles.cancelBtn}>
          <Text style={styles.cancelBtnText}>CANCEL</Text>
        </Pressable>
        <Pressable onPress={handleSave} style={[styles.actionBtn, { backgroundColor: theme.coral.sub, flex: 1 }]}>
          <Text style={[styles.actionBtnText, { color: onSolid(theme.coral.sub) }]}>LOG IT</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Alcohol edit form ─────────────────────────────────────────────────────────

function AlcoholForm({
  initial,
  onSave,
  onCancel,
  theme,
}: {
  initial: SubstancePending;
  onSave: (v: SubstancePending) => void;
  onCancel: () => void;
  theme: any;
}) {
  const ink = theme.ink;
  const card = theme.card;
  const styles = useMemo(() => makeStyles(ink, card), [ink, card]);
  const [name, setName] = useState(initial.name);
  const [abv, setAbv] = useState(initial.abv_percent != null ? String(initial.abv_percent) : "");
  const [vol, setVol] = useState(initial.volume_ml != null ? String(initial.volume_ml) : "");
  const [nameErr, setNameErr] = useState("");
  const [abvErr, setAbvErr] = useState("");
  const [volErr, setVolErr] = useState("");

  function handleSave() {
    let valid = true;
    if (!name.trim()) { setNameErr("Drink name is required."); valid = false; } else setNameErr("");
    const pAbv = parseFloat(abv);
    const pVol = parseFloat(vol);
    if (!abv.trim() || isNaN(pAbv) || pAbv <= 0) { setAbvErr("Enter the ABV % (e.g. 5)."); valid = false; } else setAbvErr("");
    if (!vol.trim() || isNaN(pVol) || pVol <= 0) { setVolErr("Enter the volume in mL (e.g. 355)."); valid = false; } else setVolErr("");
    if (!valid) return;
    const unusual: string[] = [];
    if (pAbv > 96) unusual.push(`${pAbv}% ABV`);
    if (pVol > 2000) unusual.push(`${pVol} mL`);
    if (unusual.length > 0) {
      Alert.alert(
        "Does this look right?",
        `${unusual.join(", ")} seems unusual for one drink — just checking it's not a typo.`,
        [
          { text: "Let me fix it", style: "cancel" },
          { text: "Yes, save it", onPress: () => onSave({ ...initial, name: name.trim(), abv_percent: pAbv, volume_ml: pVol }) },
        ]
      );
      return;
    }
    onSave({ ...initial, name: name.trim(), abv_percent: pAbv, volume_ml: pVol });
  }

  // Show computed standard drinks as live preview
  const previewDrinks =
    abv && vol && !isNaN(parseFloat(abv)) && !isNaN(parseFloat(vol))
      ? Math.round(((parseFloat(abv) / 100) * parseFloat(vol) * 0.789) / 14 * 10) / 10
      : null;

  return (
    <View style={styles.editForm}>
      <TextInput
        value={name}
        onChangeText={v => { setName(v); setNameErr(""); }}
        placeholder="Drink name"
        placeholderTextColor={theme.textSoft}
        style={[styles.textInput, { color: theme.textStrong, borderColor: nameErr ? theme.coral.solid : ink }]}
      />
      {nameErr ? <Text style={{ color: theme.coral.solid, fontSize: 11, marginTop: -4 }}>{nameErr}</Text> : null}
      <View style={styles.macroInputRow}>
        <TextInput
          value={abv}
          onChangeText={v => { setAbv(v); setAbvErr(""); }}
          placeholder="%"
          placeholderTextColor={theme.textSoft}
          keyboardType="decimal-pad"
          style={[styles.macroInput, { color: theme.textStrong, borderColor: abvErr ? theme.coral.solid : ink }]}
        />
        <TextInput
          value={vol}
          onChangeText={v => { setVol(v); setVolErr(""); }}
          placeholder="mL"
          placeholderTextColor={theme.textSoft}
          keyboardType="decimal-pad"
          style={[styles.macroInput, { color: theme.textStrong, borderColor: volErr ? theme.coral.solid : ink }]}
        />
      </View>
      <View style={styles.macroInputRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.macroLabel, { color: ink }]}>ABV %</Text>
          {abvErr ? <Text style={{ color: theme.coral.solid, fontSize: 10 }}>{abvErr}</Text> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.macroLabel, { color: ink }]}>VOLUME (mL)</Text>
          {volErr ? <Text style={{ color: theme.coral.solid, fontSize: 10 }}>{volErr}</Text> : null}
        </View>
      </View>
      {previewDrinks != null ? (
        <Text style={{ color: theme.textSoft, fontSize: 11 }}>
          ≈ {previewDrinks} standard drink{previewDrinks !== 1 ? "s" : ""}
        </Text>
      ) : null}
      <View style={styles.editFormButtons}>
        <Pressable onPress={onCancel} style={styles.cancelBtn}>
          <Text style={styles.cancelBtnText}>CANCEL</Text>
        </Pressable>
        <Pressable onPress={handleSave} style={[styles.actionBtn, { backgroundColor: theme.purple.solid, flex: 1 }]}>
          <Text style={[styles.actionBtnText, { color: onSolid(theme.purple.solid) }]}>LOG IT</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

type FrequentMeal = {
  name: string;
  source_food_id: string | null;
  source_db: string | null;
  carbs_g: number | null;
  sugar_g: number | null;
  calories: number | null;
  frequency: number;
};

type FoodResult = {
  source_food_id: string;
  name: string;
  carbs_g: number | null;
  sugar_g: number | null;
  calories: number | null;
  source_db?: string;
};

type Meal = {
  id: string;
  name: string;
  meal_type: string;
  carbs_g: number | null;
  sugar_g: number | null;
  calories: number | null;
  logged_at?: string;
};

type PendingFood = {
  name: string;
  carbs_g: number | null;
  sugar_g: number | null;
  calories: number | null;
  source_food_id?: string;
  source_db?: string;
};

type MacroValues = {
  name: string;
  carbs_g: number | null;
  sugar_g: number | null;
  calories: number | null;
};

type GlucoseReading = {
  recorded_at: string;
  mg_dl: number;
};

const SCREEN_WIDTH = Dimensions.get("window").width;
const MINI_CHART_WIDTH = SCREEN_WIDTH - 96;
const MINI_CHART_HEIGHT = 100;
const MC_PAD_LEFT = 24;
const MC_PAD_BOTTOM = 16;
const MC_PAD_TOP = 10;

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function mealSolidColor(type: string, theme: any): string {
  const map: Record<string, string> = {
    breakfast: theme.teal.solid,
    lunch: theme.coral.solid,
    dinner: theme.berry.solid,
    snack: theme.purple.solid,
  };
  return map[type] ?? theme.teal.solid;
}

function mealTintColor(type: string, theme: any): string {
  const map: Record<string, string> = {
    breakfast: theme.teal.tint,
    lunch: theme.coral.tint,
    dinner: theme.berry.tint,
    snack: theme.purple.tint,
  };
  return map[type] ?? theme.coral.tint;
}

function chipColors(i: number, theme: any): { bg: string; fg: string; sub: string } {
  const palette = [
    { bg: theme.teal.tint, fg: theme.teal.fg, sub: theme.teal.sub },
    { bg: theme.coral.tint, fg: theme.coral.fg, sub: theme.coral.sub },
    { bg: theme.purple.tint, fg: theme.purple.fg, sub: theme.purple.sub },
    { bg: theme.berry.tint, fg: theme.berry.fg, sub: theme.berry.sub },
  ];
  return palette[i % palette.length];
}

function buildMiniPoints(
  readings: GlucoseReading[],
  windowStart: number,
  windowEnd: number,
  minVal: number,
  maxVal: number
): string {
  const windowMs = windowEnd - windowStart;
  if (windowMs === 0) return "";
  const usableWidth = MINI_CHART_WIDTH - MC_PAD_LEFT;
  const usableHeight = MINI_CHART_HEIGHT - MC_PAD_TOP - MC_PAD_BOTTOM;
  return readings
    .map(function (r) {
      const t = new Date(r.recorded_at).getTime();
      const x = MC_PAD_LEFT + ((t - windowStart) / windowMs) * usableWidth;
      const y =
        MC_PAD_TOP +
        usableHeight -
        ((Number(r.mg_dl) - minVal) / (maxVal - minVal)) * usableHeight;
      return x + "," + y;
    })
    .join(" ");
}

function formatNutrition(
  carbs_g: number | null,
  sugar_g: number | null,
  calories: number | null
): string {
  const parts: string[] = [];
  if (carbs_g != null) parts.push(carbs_g + "g carbs");
  if (sugar_g != null) parts.push(sugar_g + "g sugar");
  if (calories != null) parts.push(calories + " cal");
  return parts.join(" · ");
}

function MacroEditForm({
  initial,
  saveLabel,
  onSave,
  onCancel,
}: {
  initial: MacroValues;
  saveLabel: string;
  onSave: (values: MacroValues) => void;
  onCancel: () => void;
}) {
  const { theme } = useTheme();
  const ink = theme.ink;
  const card = theme.card;
  const styles = useMemo(() => makeStyles(ink, card), [ink, card]);
  const [name, setName] = useState(initial.name);
  const [carbs, setCarbs] = useState(initial.carbs_g != null ? String(initial.carbs_g) : "");
  const [sugar, setSugar] = useState(initial.sugar_g != null ? String(initial.sugar_g) : "");
  const [cals, setCals] = useState(initial.calories != null ? String(initial.calories) : "");
  const [nameErr, setNameErr] = useState("");
  const [macroErr, setMacroErr] = useState("");

  function parseNum(s: string): number | null {
    const t = s.trim();
    if (!t) return null;
    const n = parseFloat(t);
    return isNaN(n) ? null : n;
  }

  function doSaveMacro() {
    onSave({ name: name.trim(), carbs_g: parseNum(carbs), sugar_g: parseNum(sugar), calories: parseNum(cals) });
  }

  function handleSave() {
    let valid = true;
    if (!name.trim()) { setNameErr("Please enter a meal name."); valid = false; } else setNameErr("");
    const badMacro = (carbs.trim() && isNaN(parseFloat(carbs))) ||
      (sugar.trim() && isNaN(parseFloat(sugar))) ||
      (cals.trim() && isNaN(parseFloat(cals)));
    if (badMacro) { setMacroErr("Carbs, sugar, and calories must be numbers or left blank."); valid = false; } else setMacroErr("");
    if (!valid) return;
    const carbsVal = parseNum(carbs);
    const sugarVal = parseNum(sugar);
    const calsVal = parseNum(cals);
    const unusual: string[] = [];
    if (carbsVal !== null && carbsVal > 500) unusual.push(`${carbsVal}g carbs`);
    if (sugarVal !== null && sugarVal > 200) unusual.push(`${sugarVal}g sugar`);
    if (calsVal !== null && (calsVal > 5000 || calsVal < 0)) unusual.push(`${calsVal} cal`);
    if (unusual.length > 0) {
      Alert.alert(
        "Does this look right?",
        `${unusual.join(", ")} seems high for a single meal — just checking it's not a typo.`,
        [
          { text: "Let me fix it", style: "cancel" },
          { text: "Yes, save it", onPress: doSaveMacro },
        ]
      );
      return;
    }
    doSaveMacro();
  }

  return (
    <View style={styles.editForm}>
      <TextInput
        value={name}
        onChangeText={v => { setName(v); setNameErr(""); }}
        placeholder="Food name"
        placeholderTextColor={theme.textSoft}
        style={[styles.textInput, { color: theme.textStrong, borderColor: nameErr ? theme.coral.solid : ink }]}
        accessibilityLabel="Meal name"
      />
      {nameErr ? <Text style={{ color: theme.coral.solid, fontSize: 11, marginTop: -4 }}>{nameErr}</Text> : null}
      <View style={styles.macroInputRow}>
        <TextInput
          value={carbs}
          onChangeText={v => { setCarbs(v); setMacroErr(""); }}
          placeholder="g"
          placeholderTextColor={theme.textSoft}
          keyboardType="decimal-pad"
          style={[styles.macroInput, { color: theme.textStrong }]}
          accessibilityLabel="Carbohydrates in grams"
        />
        <TextInput
          value={sugar}
          onChangeText={v => { setSugar(v); setMacroErr(""); }}
          placeholder="g"
          placeholderTextColor={theme.textSoft}
          keyboardType="decimal-pad"
          style={[styles.macroInput, { color: theme.textStrong }]}
          accessibilityLabel="Sugar in grams"
        />
        <TextInput
          value={cals}
          onChangeText={v => { setCals(v); setMacroErr(""); }}
          placeholder="kcal"
          placeholderTextColor={theme.textSoft}
          keyboardType="decimal-pad"
          style={[styles.macroInput, { color: theme.textStrong }]}
          accessibilityLabel="Calories in kcal"
        />
      </View>
      <View style={styles.macroInputRow}>
        <Text style={[styles.macroLabel, { color: ink }]}>CARBS</Text>
        <Text style={[styles.macroLabel, { color: ink }]}>SUGAR</Text>
        <Text style={[styles.macroLabel, { color: ink }]}>CALORIES</Text>
      </View>
      {macroErr ? <Text style={{ color: theme.coral.solid, fontSize: 11 }}>{macroErr}</Text> : null}
      <View style={styles.editFormButtons}>
        <Pressable onPress={onCancel} style={styles.cancelBtn}>
          <Text style={styles.cancelBtnText}>CANCEL</Text>
        </Pressable>
        <Pressable onPress={handleSave} style={[styles.actionBtn, { backgroundColor: theme.coral.solid, flex: 1 }]}>
          <Text style={[styles.actionBtnText, { color: onSolid(theme.coral.solid) }]}>{saveLabel.toUpperCase()}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MiniGlucoseChart({
  readings,
  mealLoggedAt,
}: {
  readings: GlucoseReading[];
  mealLoggedAt: string | null;
}) {
  const { theme } = useTheme();
  const ink = theme.ink;
  if (readings.length === 0) {
    return (
      <Text style={{ color: theme.textSoft, fontSize: 12 }}>
        No glucose readings found for this meal window.
      </Text>
    );
  }

  const values = readings.map(function (r) { return Number(r.mg_dl); });
  const minVal = Math.min.apply(null, values.concat([70])) - 5;
  const maxVal = Math.max.apply(null, values.concat([140])) + 10;
  const times = readings.map(function (r) { return new Date(r.recorded_at).getTime(); });
  const windowStart = Math.min.apply(null, times);
  const windowEnd = Math.max.apply(null, times);
  const points = buildMiniPoints(readings, windowStart, windowEnd, minVal, maxVal);

  const peakIdx = values.indexOf(Math.max.apply(null, values));
  const peakVal = values[peakIdx];
  const peakTime = times[peakIdx];

  let summaryText = "Peak: " + peakVal + " mg/dL";
  if (mealLoggedAt) {
    const mealTime = new Date(mealLoggedAt).getTime();
    const minutesAfter = Math.round((peakTime - mealTime) / 60000);
    if (minutesAfter > 0) {
      summaryText = "Peaked at " + peakVal + " mg/dL, " + minutesAfter + " min after eating";
    }
  }

  const isHighResponse = peakVal > 180;
  const chartLineColor = isHighResponse ? theme.red.solid : theme.berry.sub;

  return (
    <View style={{ marginTop: 4, borderRadius: 8, borderWidth: isHighResponse ? 1.5 : 0, borderColor: isHighResponse ? theme.red.solid : "transparent", padding: isHighResponse ? 4 : 0 }}>
      {isHighResponse && (
        <Text style={{ color: theme.red.fg, fontSize: 10, fontWeight: "700", marginBottom: 2 }}>⚠ HIGH RESPONSE ({peakVal} mg/dL)</Text>
      )}
      {points.length > 0 && (
        <Svg width={MINI_CHART_WIDTH} height={MINI_CHART_HEIGHT}>
          <SvgText x={0} y={MC_PAD_TOP + 6} fontSize={9} fill={theme.textSoft}>{Math.round(maxVal)}</SvgText>
          <SvgText x={0} y={MINI_CHART_HEIGHT - MC_PAD_BOTTOM} fontSize={9} fill={theme.textSoft}>{Math.round(minVal)}</SvgText>
          <Polyline points={points} fill="none" stroke={ink} strokeWidth={2.5} />
          <Polyline points={points} fill="none" stroke={chartLineColor} strokeWidth={1.5} />
        </Svg>
      )}
      <Text style={{ color: theme.textSoft, fontSize: 11, marginTop: 4 }}>{summaryText}</Text>
    </View>
  );
}

export function MealsScreen() {
  const { theme } = useTheme();
  const ink = theme.ink;
  const card = theme.card;
  const styles = useMemo(() => makeStyles(ink, card), [ink, card]);

  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [meals, setMeals] = useState<Meal[]>([]);
  const [loadingMeals, setLoadingMeals] = useState(true);
  const [mealsError, setMealsError] = useState<string | null>(null);

  const [scannerVisible, setScannerVisible] = useState(false);
  const [subScannerVisible, setSubScannerVisible] = useState(false);
  const [pendingFood, setPendingFood] = useState<PendingFood | null>(null);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [frequentMeals, setFrequentMeals] = useState<FrequentMeal[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);
  const [glucoseData, setGlucoseData] = useState<Record<string, GlucoseReading[]>>({});
  const [loadingGlucose, setLoadingGlucose] = useState<Record<string, boolean>>({});
  const [glucoseErrors, setGlucoseErrors] = useState<Record<string, string>>({});

  // ── Substance state ───────────────────────────────────────────────────────
  const [subType, setSubType] = useState<SubstanceType>("caffeine");
  const [subQuery, setSubQuery] = useState("");
  const [subResults, setSubResults] = useState<SubstanceResult[]>([]);
  const [subSearching, setSubSearching] = useState(false);
  const [subSearchError, setSubSearchError] = useState<string | null>(null);
  const [pendingSub, setPendingSub] = useState<SubstancePending | null>(null);
  const [subEntries, setSubEntries] = useState<SubstanceEntry[]>([]);
  const [subTotals, setSubTotals] = useState<SubstanceTotals>({ caffeine_mg: 0, standard_drinks: 0 });
  const [subLoading, setSubLoading] = useState(false);

  const loadMeals = useCallback(function () {
    const today = new Date().toISOString().split("T")[0];
    setLoadingMeals(true);
    setMealsError(null);
    api.meals(today)
      .then(function (data: Meal[]) { setMeals(Array.isArray(data) ? data : []); })
      .catch(function (e: Error) { setMealsError(e.message || "Failed to load meals"); })
      .finally(function () { setLoadingMeals(false); });
  }, []);

  const loadSubstances = useCallback(function () {
    const today = new Date().toISOString().split("T")[0];
    setSubLoading(true);
    api.substancesToday(today)
      .then(function (data: { entries: SubstanceEntry[]; totals: SubstanceTotals }) {
        setSubEntries(Array.isArray(data?.entries) ? data.entries : []);
        if (data?.totals) setSubTotals(data.totals);
      })
      .catch(function () {})
      .finally(function () { setSubLoading(false); });
  }, []);

  useEffect(function () {
    loadMeals();
    loadSubstances();
    api.frequentMeals()
      .then(function (data) { setFrequentMeals(Array.isArray(data) ? data : []); })
      .catch(function () {});
  }, [loadMeals, loadSubstances]);

  function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    setSearchResults([]);
    setPendingFood(null);
    api.searchFood(searchQuery)
      .then(function (data: FoodResult[]) { setSearchResults(Array.isArray(data) ? data : []); })
      .catch(function (e: Error) { setSearchError(e.message || "Food search failed"); })
      .finally(function () { setSearching(false); });
  }

  function handleSelectFood(food: FoodResult) {
    setPendingFood({
      name: food.name,
      carbs_g: food.carbs_g,
      sugar_g: food.sugar_g,
      calories: food.calories,
      source_food_id: food.source_food_id,
      source_db: food.source_db,
    });
  }

  function handleSelectFrequent(meal: FrequentMeal) {
    setSearchResults([]);
    setSearchQuery("");
    setPendingFood({
      name: meal.name,
      carbs_g: meal.carbs_g,
      sugar_g: meal.sugar_g,
      calories: meal.calories,
      source_food_id: meal.source_food_id ?? undefined,
      source_db: meal.source_db ?? "manual",
    });
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        loadMeals(),
        loadSubstances(),
        api.frequentMeals().then(d => setFrequentMeals(Array.isArray(d) ? d : [])).catch(() => {}),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  function handleSavePending(values: MacroValues) {
    if (!pendingFood) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearchError(null);
    api.addMeal({
      meal_type: mealType,
      source_food_id: pendingFood.source_food_id,
      source_db: pendingFood.source_db ?? "manual",
      ...values,
    })
      .then(function () {
        setPendingFood(null);
        setSearchQuery("");
        setSearchResults([]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        toast("Meal logged.");
        loadMeals();
        const h = new Date().getHours();
        const periodKey = h >= 4 && h < 11 ? "breakfast" : h >= 11 && h < 15 ? "lunch" : h >= 17 && h < 23 ? "dinner" : null;
        if (periodKey) notifee.cancelNotification(`meal-reminder-${periodKey}`).catch(() => {});
      })
      .catch(function () { setSearchError("Your meal wasn't saved. Try again — nothing was lost."); });
  }

  function handleOpenEdit(meal: Meal) {
    setEditingMealId(meal.id);
    if (expandedMealId === meal.id) setExpandedMealId(null);
  }

  function handleSaveEdit(mealId: string, values: MacroValues) {
    api.updateMeal(mealId, values)
      .then(function () { setEditingMealId(null); loadMeals(); })
      .catch(function () { toast("Couldn't save that change. Try again.", "error"); });
  }

  function handleDeleteMeal(meal: Meal) {
    Alert.alert("Delete meal", 'Remove "' + meal.name + '"?', [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: function () {
          api.deleteMeal(meal.id)
            .then(function () {
              if (expandedMealId === meal.id) setExpandedMealId(null);
              if (editingMealId === meal.id) setEditingMealId(null);
              loadMeals();
            })
            .catch(function (e: Error) { setMealsError(e.message || "Failed to delete meal"); });
        },
      },
    ]);
  }

  // ── Substance handlers ────────────────────────────────────────────────────

  function handleSubSearch() {
    if (!subQuery.trim()) return;
    setSubSearching(true);
    setSubSearchError(null);
    setPendingSub(null);
    api.searchSubstances(subQuery, subType)
      .then(function (data: SubstanceResult[]) { setSubResults(Array.isArray(data) ? data : []); })
      .catch(function (e: Error) { setSubSearchError(e.message || "Search failed"); })
      .finally(function () { setSubSearching(false); });
  }

  function handleSelectSubResult(result: SubstanceResult) {
    setSubResults([]);
    setPendingSub({
      name: result.name,
      substance_type: subType,
      caffeine_mg: result.caffeine_mg ?? null,
      abv_percent: result.abv_percent ?? null,
      volume_ml: null,
      source_food_id: result.source_food_id,
      source_db: result.source_db,
    });
  }

  function handleLogSubstance(values: SubstancePending) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    api.logSubstance({
      substance_type: values.substance_type,
      name: values.name,
      caffeine_mg: values.caffeine_mg,
      abv_percent: values.abv_percent,
      volume_ml: values.volume_ml,
      source_db: values.source_db ?? "manual",
    })
      .then(function () {
        setPendingSub(null);
        setSubQuery("");
        setSubResults([]);
        loadSubstances();
      })
      .catch(function (e: Error) { setSubSearchError(e.message || "Failed to log"); });
  }

  function handleDeleteSubstance(entry: SubstanceEntry) {
    Alert.alert(
      "Remove entry",
      `Remove "${entry.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove", style: "destructive",
          onPress: function () {
            api.deleteSubstance(entry.id)
              .then(loadSubstances)
              .catch(function () {});
          },
        },
      ]
    );
  }

  function handleToggleGlucose(meal: Meal) {
    if (editingMealId === meal.id) return;
    if (expandedMealId === meal.id) { setExpandedMealId(null); return; }
    setExpandedMealId(meal.id);
    if (glucoseData[meal.id] !== undefined) return;

    setLoadingGlucose(function (prev) { return Object.assign({}, prev, { [meal.id]: true }); });
    api.mealGlucoseResponse(meal.id)
      .then(function (data) {
        const readings: GlucoseReading[] = Array.isArray(data)
          ? data : Array.isArray(data?.readings) ? data.readings : [];
        setGlucoseData(function (prev) { return Object.assign({}, prev, { [meal.id]: readings }); });
      })
      .catch(function (e: Error) {
        setGlucoseErrors(function (prev) { return Object.assign({}, prev, { [meal.id]: e.message || "Failed to load glucose data" }); });
      })
      .finally(function () {
        setLoadingGlucose(function (prev) { return Object.assign({}, prev, { [meal.id]: false }); });
      });
  }

  const totals = meals.length > 0 ? {
    carbs: meals.some(function (m) { return m.carbs_g != null; })
      ? Math.round(meals.reduce(function (s, m) { return s + (Number(m.carbs_g) || 0); }, 0)) : null,
    sugar: meals.some(function (m) { return m.sugar_g != null; })
      ? Math.round(meals.reduce(function (s, m) { return s + (Number(m.sugar_g) || 0); }, 0)) : null,
    calories: meals.some(function (m) { return m.calories != null; })
      ? Math.round(meals.reduce(function (s, m) { return s + (Number(m.calories) || 0); }, 0)) : null,
  } : null;

  return (
    <ScrollView
      style={{ backgroundColor: theme.page }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.teal.bar} />}
    >
      {/* Totals strip — 3 solid-color blocks */}
      {totals !== null && (
        <View style={styles.totalsRow}>
          {totals.carbs !== null ? (
            <View style={[styles.totalBlock, { backgroundColor: theme.teal.solid }]}>
              <Text style={[styles.totalBlockLabel, { color: onSolid(theme.teal.solid) }]}>CARBS</Text>
              <Text style={[styles.totalBlockValue, { color: onSolid(theme.teal.solid) }]}>{totals.carbs}g</Text>
            </View>
          ) : null}
          {totals.sugar !== null ? (
            <View style={[styles.totalBlock, { backgroundColor: theme.coral.solid }]}>
              <Text style={[styles.totalBlockLabel, { color: onSolid(theme.coral.solid) }]}>SUGAR</Text>
              <Text style={[styles.totalBlockValue, { color: onSolid(theme.coral.solid) }]}>{totals.sugar}g</Text>
            </View>
          ) : null}
          {totals.calories !== null ? (
            <View style={[styles.totalBlock, { backgroundColor: theme.berry.solid }]}>
              <Text style={[styles.totalBlockLabel, { color: onSolid(theme.berry.solid) }]}>CALORIES</Text>
              <Text style={[styles.totalBlockValue, { color: onSolid(theme.berry.solid) }]}>{totals.calories}</Text>
            </View>
          ) : null}
        </View>
      )}

      {/* Log a meal card */}
      <View style={[styles.card, { backgroundColor: theme.coral.tint }]}>
        <Text style={[styles.cardTitle, { color: theme.textStrong }]}>Log a meal</Text>

        {/* Frequent meals */}
        {frequentMeals.length > 0 ? (
          <View style={styles.frequentSection}>
            <Text style={[styles.sectionLabel, { color: theme.textSoft }]}>YOUR USUAL</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.frequentRow}>
              {frequentMeals.map(function (meal, i) {
                const cc = chipColors(i, theme);
                return (
                  <Pressable
                    key={meal.source_food_id ?? meal.name + i}
                    onPress={function () { handleSelectFrequent(meal); }}
                    style={[styles.frequentChip, { backgroundColor: cc.bg }]}
                  >
                    <Text style={{ color: cc.fg, fontSize: 13, fontWeight: "700" }} numberOfLines={1}>{meal.name}</Text>
                    {(meal.calories != null || meal.carbs_g != null) ? (
                      <Text style={{ color: cc.sub, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                        {meal.calories != null ? meal.calories + " cal" : meal.carbs_g + "g carbs"}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* Meal type selector */}
        <View style={styles.chipRow}>
          {MEAL_TYPES.map(function (type) {
            const selected = mealType === type;
            return (
              <Pressable
                key={type}
                onPress={function () { setMealType(type); }}
                style={[
                  styles.typeChip,
                  { backgroundColor: selected ? ink : card },
                ]}
              >
                <Text style={{ color: selected ? "#ffffff" : ink, fontSize: 11, fontWeight: "800", letterSpacing: 0.3 }}>
                  {type.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Search field */}
        <View style={styles.searchRow}>
          <TextInput
            placeholder="search food..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            style={[styles.textInput, { color: theme.textStrong, flex: 1 }]}
            placeholderTextColor={theme.textSoft}
          />
          <Pressable style={[styles.actionBtn, { backgroundColor: theme.coral.solid }]} onPress={handleSearch}>
            {searching ? (
              <LoadingIndicator color={onSolid(theme.coral.solid)} size="small" />
            ) : (
              <Text style={[styles.actionBtnText, { color: onSolid(theme.coral.solid) }]}>SEARCH</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.belowSearchRow}>
          <Pressable
            onPress={function () { setScannerVisible(true); }}
            style={styles.secondaryBtn}
          >
            <Ionicons name="barcode-outline" size={15} color={ink} />
            <Text style={styles.secondaryBtnText}>SCAN BARCODE</Text>
          </Pressable>
          <Pressable
            onPress={function () {
              setPendingFood({ name: "", carbs_g: null, sugar_g: null, calories: null, source_db: "manual" });
              setSearchResults([]);
            }}
            style={styles.secondaryBtn}
            hitSlop={8}
          >
            <Text style={styles.secondaryBtnText}>+ ADD MANUALLY</Text>
          </Pressable>
        </View>

        {searchError ? (
          <Text style={{ color: theme.coral.sub, fontSize: 12, marginTop: 6 }}>{searchError}</Text>
        ) : null}

        {pendingFood ? (
          <MacroEditForm
            initial={pendingFood}
            saveLabel="Log it"
            onSave={handleSavePending}
            onCancel={function () { setPendingFood(null); }}
          />
        ) : searchResults.length > 0 ? (
          <View style={{ marginTop: 12, gap: 8 }}>
            {searchResults.map(function (food, i) {
              const nutrition = formatNutrition(food.carbs_g, food.sugar_g, food.calories);
              return (
                <Pressable
                  key={food.source_food_id ?? String(i)}
                  onPress={function () { handleSelectFood(food); }}
                  style={[styles.resultRow, { borderColor: ink }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.textStrong, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>{food.name}</Text>
                    {nutrition ? <Text style={{ color: theme.textSoft, fontSize: 11, marginTop: 2 }}>{nutrition}</Text> : null}
                  </View>
                  <Ionicons name="create-outline" size={18} color={theme.coral.sub} />
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {/* Caffeine & Alcohol */}
      <View style={[styles.card, { backgroundColor: theme.coral.tint }]}>
        <Text style={[styles.cardTitle, { color: theme.textStrong }]}>Caffeine & Alcohol</Text>

        {/* Totals strip */}
        {(subTotals.caffeine_mg > 0 || subTotals.standard_drinks > 0) && (
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
            {subTotals.caffeine_mg > 0 && (
              <View style={[styles.totalBlock, { backgroundColor: theme.coral.sub, flex: 1 }]}>
                <Text style={[styles.totalBlockLabel, { color: onSolid(theme.coral.sub) }]}>CAFFEINE TODAY</Text>
                <Text style={[styles.totalBlockValue, { color: onSolid(theme.coral.sub) }]}>{subTotals.caffeine_mg}mg</Text>
              </View>
            )}
            {subTotals.standard_drinks > 0 && (
              <View style={[styles.totalBlock, { backgroundColor: theme.purple.solid, flex: 1 }]}>
                <Text style={[styles.totalBlockLabel, { color: onSolid(theme.purple.solid) }]}>STD DRINKS TODAY</Text>
                <Text style={[styles.totalBlockValue, { color: onSolid(theme.purple.solid) }]}>{subTotals.standard_drinks}</Text>
              </View>
            )}
          </View>
        )}

        {/* Type toggle */}
        <View style={[styles.chipRow, { marginBottom: 10 }]}>
          {(["caffeine", "alcohol"] as SubstanceType[]).map(function (t) {
            const selected = subType === t;
            const activeColor = t === "caffeine" ? theme.coral.sub : theme.purple.solid;
            return (
              <Pressable
                key={t}
                onPress={function () {
                  setSubType(t);
                  setSubResults([]);
                  setPendingSub(null);
                  setSubQuery("");
                }}
                style={[
                  styles.typeChip,
                  { backgroundColor: selected ? activeColor : card, borderColor: selected ? activeColor : ink },
                ]}
              >
                <Text style={{ color: selected ? "#ffffff" : ink, fontSize: 11, fontWeight: "800", letterSpacing: 0.3 }}>
                  {t === "caffeine" ? "CAFFEINE" : "ALCOHOL"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <TextInput
            placeholder={subType === "caffeine" ? "search coffee, tea, energy drinks..." : "search beer, wine, spirits..."}
            value={subQuery}
            onChangeText={setSubQuery}
            onSubmitEditing={handleSubSearch}
            style={[styles.textInput, { color: theme.textStrong, flex: 1 }]}
            placeholderTextColor={theme.textSoft}
          />
          <Pressable
            style={[styles.actionBtn, { backgroundColor: subType === "caffeine" ? theme.coral.sub : theme.purple.solid }]}
            onPress={handleSubSearch}
          >
            {subSearching ? (
              <LoadingIndicator color={onSolid(subType === "caffeine" ? theme.coral.sub : theme.purple.solid)} size="small" />
            ) : (
              <Text style={[styles.actionBtnText, { color: onSolid(subType === "caffeine" ? theme.coral.sub : theme.purple.solid) }]}>SEARCH</Text>
            )}
          </Pressable>
        </View>

        <View style={[styles.belowSearchRow, { marginBottom: 4 }]}>
          <Pressable
            onPress={function () { setSubScannerVisible(true); }}
            style={styles.secondaryBtn}
          >
            <Ionicons name="barcode-outline" size={15} color={ink} />
            <Text style={styles.secondaryBtnText}>SCAN BARCODE</Text>
          </Pressable>
          <Pressable
            onPress={function () {
              setPendingSub({
                name: "",
                substance_type: subType,
                caffeine_mg: null,
                abv_percent: null,
                volume_ml: null,
                source_db: "manual",
              });
              setSubResults([]);
            }}
            style={styles.secondaryBtn}
          >
            <Text style={styles.secondaryBtnText}>+ ADD MANUALLY</Text>
          </Pressable>
        </View>

        {subSearchError ? (
          <Text style={{ color: theme.coral.sub, fontSize: 12, marginTop: 4 }}>{subSearchError}</Text>
        ) : null}

        {/* Search results */}
        {!pendingSub && subResults.length > 0 && (
          <View style={{ marginTop: 8, gap: 8 }}>
            {subResults.map(function (r, i) {
              const detail = subType === "caffeine"
                ? (r.caffeine_mg != null ? r.caffeine_mg + "mg per 100g" : null)
                : (r.abv_percent != null ? r.abv_percent + "% ABV" : null);
              return (
                <Pressable
                  key={r.source_food_id ?? String(i)}
                  onPress={function () { handleSelectSubResult(r); }}
                  style={[styles.resultRow, { borderColor: ink }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.textStrong, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>{r.name}</Text>
                    {detail ? <Text style={{ color: theme.textSoft, fontSize: 11, marginTop: 2 }}>{detail}</Text> : null}
                  </View>
                  <Ionicons name="create-outline" size={18} color={subType === "caffeine" ? theme.coral.sub : theme.purple.solid} />
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Edit forms */}
        {pendingSub && pendingSub.substance_type === "caffeine" ? (
          <CaffeineForm
            initial={pendingSub}
            onSave={handleLogSubstance}
            onCancel={function () { setPendingSub(null); }}
            theme={theme}
          />
        ) : pendingSub && pendingSub.substance_type === "alcohol" ? (
          <AlcoholForm
            initial={pendingSub}
            onSave={handleLogSubstance}
            onCancel={function () { setPendingSub(null); }}
            theme={theme}
          />
        ) : null}

        {/* Today's logged substances */}
        {subLoading ? (
          <LoadingIndicator style={{ marginTop: 8 }} />
        ) : subEntries.length > 0 ? (
          <View style={{ marginTop: 10, gap: 6 }}>
            <Text style={[styles.sectionLabel, { color: theme.textSoft }]}>TODAY</Text>
            {subEntries.map(function (entry) {
              const detail = entry.substance_type === "caffeine"
                ? (entry.caffeine_mg != null ? entry.caffeine_mg + "mg caffeine" : "caffeine")
                : (entry.abv_percent != null && entry.volume_ml != null
                  ? entry.abv_percent + "% · " + entry.volume_ml + "mL"
                  : "alcohol");
              const iconColor = entry.substance_type === "caffeine" ? theme.coral.sub : theme.purple.solid;
              return (
                <View key={entry.id} style={[styles.resultRow, { borderColor: ink }]}>
                  <View style={[styles.mealIconTile, { backgroundColor: iconColor, width: 32, height: 32 }]}>
                    <Ionicons
                      name={entry.substance_type === "caffeine" ? "cafe-outline" : "wine-outline"}
                      size={14}
                      color={onSolid(iconColor)}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={{ color: theme.textStrong, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>
                      {entry.name || (entry.substance_type === "caffeine" ? "Caffeine" : "Alcohol")}
                    </Text>
                    <Text style={{ color: theme.textSoft, fontSize: 11, marginTop: 1 }}>{detail}</Text>
                  </View>
                  <Pressable onPress={function () { handleDeleteSubstance(entry); }} hitSlop={8}>
                    <Ionicons name="trash-outline" size={15} color={theme.coral.solid} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>

      {/* Today's meals list */}
      <View style={[styles.card, { backgroundColor: theme.coral.tint }]}>
        <Text style={[styles.cardTitle, { color: theme.textStrong }]}>Today's meals</Text>

        {mealsError ? (
          <Text style={{ color: theme.coral.sub, fontSize: 12, marginTop: 6 }}>{mealsError}</Text>
        ) : null}

        {loadingMeals ? (
          <LoadingIndicator style={{ marginTop: 10 }} />
        ) : meals.length === 0 ? (
          <Text style={{ color: theme.textSoft, fontSize: 12, marginTop: 10 }}>No meals logged yet today.</Text>
        ) : (
          meals.map(function (meal) {
            const nutrition = formatNutrition(meal.carbs_g, meal.sugar_g, meal.calories);
            const isExpanded = expandedMealId === meal.id;
            const isEditing = editingMealId === meal.id;
            const readings = glucoseData[meal.id] ?? [];
            const isLoadingG = loadingGlucose[meal.id] ?? false;
            const gError = glucoseErrors[meal.id];
            const mealColor = mealSolidColor(meal.meal_type, theme);

            return (
              <View key={meal.id} style={[styles.mealCard, { borderColor: ink, backgroundColor: mealTintColor(meal.meal_type, theme) }]}>
                <View style={styles.mealContent}>
                  {/* Colored icon tile */}
                  <View style={[styles.mealIconTile, { backgroundColor: mealColor }]}>
                    <Ionicons name="restaurant" size={16} color={onSolid(mealColor)} />
                  </View>

                  <Pressable
                    style={styles.mealMain}
                    onPress={function () { handleToggleGlucose(meal); }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.textStrong, fontSize: 13, fontWeight: "700" }} numberOfLines={1}>
                        {meal.name}
                      </Text>
                      <Text style={{ color: theme.textSoft, fontSize: 10, fontWeight: "800", letterSpacing: 0.4, marginTop: 1 }}>
                        {meal.meal_type.toUpperCase()}
                      </Text>
                      {nutrition ? (
                        <Text style={{ color: theme.textSoft, fontSize: 11, marginTop: 2 }}>{nutrition}</Text>
                      ) : null}
                    </View>
                    <Ionicons
                      name={isExpanded && !isEditing ? "chevron-up" : "pulse"}
                      size={15}
                      color={theme.berry.sub}
                      style={{ marginLeft: 8 }}
                    />
                  </Pressable>

                  <Pressable onPress={function () { handleOpenEdit(meal); }} style={styles.iconBtn} hitSlop={8}>
                    <Ionicons name="pencil-outline" size={15} color={isEditing ? theme.coral.solid : theme.textSoft} />
                  </Pressable>
                  <Pressable onPress={function () { handleDeleteMeal(meal); }} style={styles.iconBtn} hitSlop={8}>
                    <Ionicons name="trash-outline" size={15} color={theme.coral.solid} />
                  </Pressable>
                </View>

                {isEditing ? (
                  <View style={[styles.glucosePanel, { borderTopColor: theme.cardBorder }]}>
                    <MacroEditForm
                      initial={{ name: meal.name, carbs_g: meal.carbs_g, sugar_g: meal.sugar_g, calories: meal.calories }}
                      saveLabel="Save"
                      onSave={function (values) { handleSaveEdit(meal.id, values); }}
                      onCancel={function () { setEditingMealId(null); }}
                    />
                  </View>
                ) : isExpanded ? (
                  <View style={[styles.glucosePanel, { borderTopColor: theme.cardBorder }]}>
                    {isLoadingG ? (
                      <LoadingIndicator style={{ marginVertical: 10 }} />
                    ) : gError ? (
                      <Text style={{ color: theme.coral.sub, fontSize: 12 }}>{gError}</Text>
                    ) : (
                      <MiniGlucoseChart readings={readings} mealLoggedAt={meal.logged_at ?? null} />
                    )}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </View>

      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={function () { setScannerVisible(false); }}
        onResult={function (food) { handleSelectFood(food); }}
      />
      <BarcodeScannerModal
        visible={subScannerVisible}
        onClose={function () { setSubScannerVisible(false); }}
        mode={subType}
        onSubstanceResult={function (substance) { handleSelectSubResult(substance); }}
        onManual={function () {
          setPendingSub({
            name: "",
            substance_type: subType,
            caffeine_mg: null,
            abv_percent: null,
            volume_ml: null,
            source_db: "manual",
          });
        }}
      />
    </ScrollView>
  );
}

function makeStyles(ink: string, card: string) {
  return StyleSheet.create({
  content: { padding: 16, gap: 12 },

  // Totals strip
  totalsRow: { flexDirection: "row", gap: 8 },
  totalBlock: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: ink,
    padding: 10,
    shadowColor: ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  totalBlockLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.6, marginBottom: 4 },
  totalBlockValue: { fontSize: 20, fontWeight: "800" },

  // Card
  card: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: ink,
    padding: 14,
    shadowColor: ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  cardTitle: { fontSize: 19, fontWeight: "800", marginBottom: 8 },

  sectionLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.7, marginBottom: 6 },

  frequentSection: { marginBottom: 8 },
  frequentRow: { gap: 8, paddingBottom: 2 },
  frequentChip: {
    borderWidth: 2,
    borderColor: ink,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: 150,
    shadowColor: ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },

  chipRow: { flexDirection: "row", gap: 6, marginBottom: 10, flexWrap: "wrap" },
  typeChip: {
    borderWidth: 2,
    borderColor: ink,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },

  searchRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  textInput: {
    borderWidth: 2,
    borderColor: ink,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: card,
    fontSize: 14,
    shadowColor: ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  actionBtn: {
    borderRadius: 10,
    borderWidth: 2,
    borderColor: ink,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 72,
    shadowColor: ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  actionBtnText: { fontWeight: "800", fontSize: 11, letterSpacing: 0.4 },

  belowSearchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 2,
    borderColor: ink,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: card,
    shadowColor: ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  secondaryBtnText: { color: ink, fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },

  resultRow: {
    flexDirection: "row",
    gap: 10,
    borderWidth: 2,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    backgroundColor: card,
    shadowColor: ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },

  editForm: { marginTop: 12, gap: 8 },
  macroInputRow: { flexDirection: "row", gap: 6 },
  macroInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: ink,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 12,
    backgroundColor: card,
    shadowColor: ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  macroLabel: { flex: 1, fontSize: 9, fontWeight: "800", letterSpacing: 0.6, textAlign: "center" },
  editFormButtons: { flexDirection: "row", gap: 8 },
  cancelBtn: {
    borderWidth: 2,
    borderColor: ink,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: card,
    shadowColor: ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  cancelBtnText: { color: ink, fontWeight: "800", fontSize: 11, letterSpacing: 0.4 },

  // Meal row card
  mealCard: {
    marginTop: 10,
    borderWidth: 2,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  mealContent: { flexDirection: "row", alignItems: "flex-start", padding: 10 },
  mealIconTile: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: ink,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    shadowColor: ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
    flexShrink: 0,
  },
  mealMain: { flex: 1, flexDirection: "row", alignItems: "flex-start" },
  iconBtn: { padding: 6, marginLeft: 2 },
  glucosePanel: { borderTopWidth: 1, marginHorizontal: 10, paddingTop: 10, paddingBottom: 10 },
  });
}
