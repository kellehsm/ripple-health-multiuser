import React, { useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
} from "react-native";
import * as Haptics from "expo-haptics";
import notifee from "@notifee/react-native";
import Svg, { Polyline, Text as SvgText } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { api } from "../api/client";
import { USER_ID } from "../api/config";
import { BarcodeScannerModal } from "../components/BarcodeScannerModal";

const INK = "#111111";

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

// Color and icon per meal type for the icon tile
const MEAL_TYPE_COLORS: Record<string, string> = {
  breakfast: "#3FA0A6",  // teal
  lunch: "#E8654E",      // coral
  dinner: "#A62A50",     // berry
  snack: "#7B3FBF",      // purple
};

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
  const [name, setName] = useState(initial.name);
  const [carbs, setCarbs] = useState(initial.carbs_g != null ? String(initial.carbs_g) : "");
  const [sugar, setSugar] = useState(initial.sugar_g != null ? String(initial.sugar_g) : "");
  const [cals, setCals] = useState(initial.calories != null ? String(initial.calories) : "");

  function parseNum(s: string): number | null {
    const t = s.trim();
    if (!t) return null;
    const n = parseFloat(t);
    return isNaN(n) ? null : n;
  }

  function handleSave() {
    if (!name.trim()) { Alert.alert("Name required", "Please enter a meal name."); return; }
    if (carbs.trim() && isNaN(parseFloat(carbs))) { Alert.alert("Invalid value", "Carbs must be a number or blank."); return; }
    if (sugar.trim() && isNaN(parseFloat(sugar))) { Alert.alert("Invalid value", "Sugar must be a number or blank."); return; }
    if (cals.trim() && isNaN(parseFloat(cals))) { Alert.alert("Invalid value", "Calories must be a number or blank."); return; }
    onSave({ name: name.trim(), carbs_g: parseNum(carbs), sugar_g: parseNum(sugar), calories: parseNum(cals) });
  }

  return (
    <View style={styles.editForm}>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Food name"
        placeholderTextColor={theme.textSoft}
        style={[styles.textInput, { color: theme.textStrong }]}
      />
      <View style={styles.macroInputRow}>
        <TextInput
          value={carbs}
          onChangeText={setCarbs}
          placeholder="Carbs (g)"
          placeholderTextColor={theme.textSoft}
          keyboardType="decimal-pad"
          style={[styles.macroInput, { color: theme.textStrong }]}
        />
        <TextInput
          value={sugar}
          onChangeText={setSugar}
          placeholder="Sugar (g)"
          placeholderTextColor={theme.textSoft}
          keyboardType="decimal-pad"
          style={[styles.macroInput, { color: theme.textStrong }]}
        />
        <TextInput
          value={cals}
          onChangeText={setCals}
          placeholder="Calories"
          placeholderTextColor={theme.textSoft}
          keyboardType="decimal-pad"
          style={[styles.macroInput, { color: theme.textStrong }]}
        />
      </View>
      <View style={styles.editFormButtons}>
        <Pressable onPress={onCancel} style={styles.cancelBtn}>
          <Text style={styles.cancelBtnText}>CANCEL</Text>
        </Pressable>
        <Pressable onPress={handleSave} style={[styles.actionBtn, { backgroundColor: theme.coral.solid, flex: 1 }]}>
          <Text style={styles.actionBtnText}>{saveLabel.toUpperCase()}</Text>
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

  return (
    <View style={{ marginTop: 4 }}>
      {points.length > 0 && (
        <Svg width={MINI_CHART_WIDTH} height={MINI_CHART_HEIGHT}>
          <SvgText x={0} y={MC_PAD_TOP + 6} fontSize={9} fill={theme.textSoft}>{Math.round(maxVal)}</SvgText>
          <SvgText x={0} y={MINI_CHART_HEIGHT - MC_PAD_BOTTOM} fontSize={9} fill={theme.textSoft}>{Math.round(minVal)}</SvgText>
          {/* Double-stroke mini chart */}
          <Polyline points={points} fill="none" stroke={INK} strokeWidth={2.5} />
          <Polyline points={points} fill="none" stroke={theme.berry.sub} strokeWidth={1.5} />
        </Svg>
      )}
      <Text style={{ color: theme.textSoft, fontSize: 11, marginTop: 4 }}>{summaryText}</Text>
    </View>
  );
}

export function MealsScreen() {
  const { theme } = useTheme();

  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [meals, setMeals] = useState<Meal[]>([]);
  const [loadingMeals, setLoadingMeals] = useState(true);
  const [mealsError, setMealsError] = useState<string | null>(null);

  const [scannerVisible, setScannerVisible] = useState(false);
  const [pendingFood, setPendingFood] = useState<PendingFood | null>(null);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [frequentMeals, setFrequentMeals] = useState<FrequentMeal[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);
  const [glucoseData, setGlucoseData] = useState<Record<string, GlucoseReading[]>>({});
  const [loadingGlucose, setLoadingGlucose] = useState<Record<string, boolean>>({});
  const [glucoseErrors, setGlucoseErrors] = useState<Record<string, string>>({});

  const loadMeals = useCallback(function () {
    const today = new Date().toISOString().split("T")[0];
    setLoadingMeals(true);
    setMealsError(null);
    api.meals(USER_ID, today)
      .then(function (data: Meal[]) { setMeals(Array.isArray(data) ? data : []); })
      .catch(function (e: Error) { setMealsError(e.message || "Failed to load meals"); })
      .finally(function () { setLoadingMeals(false); });
  }, []);

  useEffect(function () {
    loadMeals();
    api.frequentMeals(USER_ID)
      .then(function (data) { setFrequentMeals(Array.isArray(data) ? data : []); })
      .catch(function () {});
  }, [loadMeals]);

  function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
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
      await loadMeals();
      const freq = await api.frequentMeals(USER_ID).catch(() => []);
      setFrequentMeals(Array.isArray(freq) ? freq : []);
    } finally {
      setRefreshing(false);
    }
  }

  function handleSavePending(values: MacroValues) {
    if (!pendingFood) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearchError(null);
    api.addMeal({
      user_id: USER_ID,
      meal_type: mealType,
      source_food_id: pendingFood.source_food_id,
      source_db: pendingFood.source_db ?? "manual",
      ...values,
    })
      .then(function () {
        setPendingFood(null);
        setSearchQuery("");
        setSearchResults([]);
        loadMeals();
        const h = new Date().getHours();
        const periodKey = h >= 4 && h < 11 ? "breakfast" : h >= 11 && h < 15 ? "lunch" : h >= 17 && h < 23 ? "dinner" : null;
        if (periodKey) notifee.cancelNotification(`meal-reminder-${periodKey}`).catch(() => {});
      })
      .catch(function (e: Error) { setSearchError(e.message || "Failed to log meal"); });
  }

  function handleOpenEdit(meal: Meal) {
    setEditingMealId(meal.id);
    if (expandedMealId === meal.id) setExpandedMealId(null);
  }

  function handleSaveEdit(mealId: string, values: MacroValues) {
    api.updateMeal(mealId, values)
      .then(function () { setEditingMealId(null); loadMeals(); })
      .catch(function (e: Error) { setMealsError(e.message || "Failed to update meal"); });
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
            <View style={[styles.totalBlock, { backgroundColor: theme.coral.solid }]}>
              <Text style={styles.totalBlockLabel}>CARBS</Text>
              <Text style={styles.totalBlockValue}>{totals.carbs}g</Text>
            </View>
          ) : null}
          {totals.sugar !== null ? (
            <View style={[styles.totalBlock, { backgroundColor: theme.berry.solid }]}>
              <Text style={styles.totalBlockLabel}>SUGAR</Text>
              <Text style={styles.totalBlockValue}>{totals.sugar}g</Text>
            </View>
          ) : null}
          {totals.calories !== null ? (
            <View style={[styles.totalBlock, { backgroundColor: theme.purple.solid }]}>
              <Text style={styles.totalBlockLabel}>CALORIES</Text>
              <Text style={styles.totalBlockValue}>{totals.calories}</Text>
            </View>
          ) : null}
        </View>
      )}

      {/* Log a meal card */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.textStrong }]}>Log a meal</Text>

        {/* Frequent meals */}
        {frequentMeals.length > 0 ? (
          <View style={styles.frequentSection}>
            <Text style={[styles.sectionLabel, { color: theme.textSoft }]}>YOUR USUAL</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.frequentRow}>
              {frequentMeals.map(function (meal, i) {
                return (
                  <Pressable
                    key={meal.source_food_id ?? meal.name + i}
                    onPress={function () { handleSelectFrequent(meal); }}
                    style={[styles.frequentChip, { backgroundColor: theme.coral.tint }]}
                  >
                    <Text style={{ color: theme.coral.fg, fontSize: 13, fontWeight: "700" }} numberOfLines={1}>{meal.name}</Text>
                    {(meal.calories != null || meal.carbs_g != null) ? (
                      <Text style={{ color: theme.coral.sub, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
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
                  { backgroundColor: selected ? INK : "#ffffff" },
                ]}
              >
                <Text style={{ color: selected ? "#ffffff" : INK, fontSize: 11, fontWeight: "800", letterSpacing: 0.3 }}>
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
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.actionBtnText}>SEARCH</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.belowSearchRow}>
          <Pressable
            onPress={function () { setScannerVisible(true); }}
            style={styles.secondaryBtn}
          >
            <Ionicons name="barcode-outline" size={15} color={INK} />
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
                  style={[styles.resultRow, { borderColor: INK }]}
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

      {/* Today's meals list */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.textStrong }]}>Today's meals</Text>

        {mealsError ? (
          <Text style={{ color: theme.coral.sub, fontSize: 12, marginTop: 6 }}>{mealsError}</Text>
        ) : null}

        {loadingMeals ? (
          <ActivityIndicator style={{ marginTop: 10 }} />
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
            const mealColor = MEAL_TYPE_COLORS[meal.meal_type] ?? "#3FA0A6";

            return (
              <View key={meal.id} style={[styles.mealCard, { borderColor: INK, backgroundColor: theme.card }]}>
                <View style={styles.mealContent}>
                  {/* Colored icon tile */}
                  <View style={[styles.mealIconTile, { backgroundColor: mealColor }]}>
                    <Ionicons name="restaurant" size={16} color="#fff" />
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
                      <ActivityIndicator style={{ marginVertical: 10 }} />
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },

  // Totals strip
  totalsRow: { flexDirection: "row", gap: 8 },
  totalBlock: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: INK,
    padding: 10,
    shadowColor: INK,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  totalBlockLabel: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.6, marginBottom: 4 },
  totalBlockValue: { color: "#fff", fontSize: 20, fontWeight: "800" },

  // Card
  card: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: INK,
    padding: 14,
    shadowColor: INK,
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
    borderColor: INK,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: 150,
    shadowColor: INK,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },

  chipRow: { flexDirection: "row", gap: 6, marginBottom: 10, flexWrap: "wrap" },
  typeChip: {
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: INK,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },

  searchRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  textInput: {
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    fontSize: 14,
    shadowColor: INK,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  actionBtn: {
    borderRadius: 10,
    borderWidth: 2,
    borderColor: INK,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 72,
    shadowColor: INK,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  actionBtnText: { color: "#fff", fontWeight: "800", fontSize: 11, letterSpacing: 0.4 },

  belowSearchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#ffffff",
    shadowColor: INK,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  secondaryBtnText: { color: INK, fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },

  resultRow: {
    flexDirection: "row",
    gap: 10,
    borderWidth: 2,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    backgroundColor: "#ffffff",
    shadowColor: INK,
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
    borderColor: INK,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 12,
    backgroundColor: "#ffffff",
    shadowColor: INK,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  editFormButtons: { flexDirection: "row", gap: 8 },
  cancelBtn: {
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
    shadowColor: INK,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  cancelBtnText: { color: INK, fontWeight: "800", fontSize: 11, letterSpacing: 0.4 },

  // Meal row card
  mealCard: {
    marginTop: 10,
    borderWidth: 2,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: INK,
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
    borderColor: INK,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    shadowColor: INK,
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
