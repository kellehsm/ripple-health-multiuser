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
import Svg, { Polyline, Text as SvgText } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { api } from "../api/client";
import { USER_ID } from "../api/config";
import { BarcodeScannerModal } from "../components/BarcodeScannerModal";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

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
    if (!name.trim()) {
      Alert.alert("Name required", "Please enter a meal name.");
      return;
    }
    if (carbs.trim() && isNaN(parseFloat(carbs))) {
      Alert.alert("Invalid value", "Carbs must be a number or blank.");
      return;
    }
    if (sugar.trim() && isNaN(parseFloat(sugar))) {
      Alert.alert("Invalid value", "Sugar must be a number or blank.");
      return;
    }
    if (cals.trim() && isNaN(parseFloat(cals))) {
      Alert.alert("Invalid value", "Calories must be a number or blank.");
      return;
    }
    onSave({
      name: name.trim(),
      carbs_g: parseNum(carbs),
      sugar_g: parseNum(sugar),
      calories: parseNum(cals),
    });
  }

  return (
    <View style={styles.editForm}>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Food name"
        placeholderTextColor={theme.textSoft}
        style={[styles.input, { borderColor: theme.cardBorder, color: theme.textStrong }]}
      />
      <View style={styles.macroInputRow}>
        <TextInput
          value={carbs}
          onChangeText={setCarbs}
          placeholder="Carbs (g)"
          placeholderTextColor={theme.textSoft}
          keyboardType="decimal-pad"
          style={[styles.macroInput, { borderColor: theme.cardBorder, color: theme.textStrong }]}
        />
        <TextInput
          value={sugar}
          onChangeText={setSugar}
          placeholder="Sugar (g)"
          placeholderTextColor={theme.textSoft}
          keyboardType="decimal-pad"
          style={[styles.macroInput, { borderColor: theme.cardBorder, color: theme.textStrong }]}
        />
        <TextInput
          value={cals}
          onChangeText={setCals}
          placeholder="Calories"
          placeholderTextColor={theme.textSoft}
          keyboardType="decimal-pad"
          style={[styles.macroInput, { borderColor: theme.cardBorder, color: theme.textStrong }]}
        />
      </View>
      <View style={styles.editFormButtons}>
        <Pressable
          onPress={onCancel}
          style={[styles.editFormCancel, { borderColor: theme.cardBorder }]}
        >
          <Text style={{ color: theme.textSoft, fontSize: 13 }}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          style={[styles.actionButton, { backgroundColor: theme.coral.sub, flex: 1 }]}
        >
          <Text style={styles.actionButtonText}>{saveLabel}</Text>
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

  const values = readings.map(function (r) {
    return Number(r.mg_dl);
  });
  const minVal = Math.min.apply(null, values.concat([70])) - 5;
  const maxVal = Math.max.apply(null, values.concat([140])) + 10;

  const times = readings.map(function (r) {
    return new Date(r.recorded_at).getTime();
  });
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
      summaryText =
        "Peaked at " + peakVal + " mg/dL, " + minutesAfter + " min after eating";
    }
  }

  return (
    <View style={{ marginTop: 4 }}>
      {points.length > 0 && (
        <Svg width={MINI_CHART_WIDTH} height={MINI_CHART_HEIGHT}>
          <SvgText x={0} y={MC_PAD_TOP + 6} fontSize={9} fill={theme.textSoft}>
            {Math.round(maxVal)}
          </SvgText>
          <SvgText
            x={0}
            y={MINI_CHART_HEIGHT - MC_PAD_BOTTOM}
            fontSize={9}
            fill={theme.textSoft}
          >
            {Math.round(minVal)}
          </SvgText>
          <Polyline points={points} fill="none" stroke={theme.berry.sub} strokeWidth={2} />
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

  const [refreshing, setRefreshing] = useState(false);
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);
  const [glucoseData, setGlucoseData] = useState<Record<string, GlucoseReading[]>>({});
  const [loadingGlucose, setLoadingGlucose] = useState<Record<string, boolean>>({});
  const [glucoseErrors, setGlucoseErrors] = useState<Record<string, string>>({});

  const loadMeals = useCallback(function () {
    const today = new Date().toISOString().split("T")[0];
    setLoadingMeals(true);
    setMealsError(null);
    api
      .meals(USER_ID, today)
      .then(function (data: Meal[]) {
        setMeals(Array.isArray(data) ? data : []);
      })
      .catch(function (e: Error) {
        setMealsError(e.message || "Failed to load meals");
      })
      .finally(function () {
        setLoadingMeals(false);
      });
  }, []);

  useEffect(function () {
    loadMeals();
  }, [loadMeals]);

  function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    setPendingFood(null);
    api
      .searchFood(searchQuery)
      .then(function (data: FoodResult[]) {
        setSearchResults(Array.isArray(data) ? data : []);
      })
      .catch(function (e: Error) {
        setSearchError(e.message || "Food search failed");
      })
      .finally(function () {
        setSearching(false);
      });
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

  async function handleRefresh() {
    setRefreshing(true);
    try { await loadMeals(); } finally { setRefreshing(false); }
  }

  function handleSavePending(values: MacroValues) {
    if (!pendingFood) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearchError(null);
    api
      .addMeal({
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
      })
      .catch(function (e: Error) {
        setSearchError(e.message || "Failed to log meal");
      });
  }

  function handleOpenEdit(meal: Meal) {
    setEditingMealId(meal.id);
    if (expandedMealId === meal.id) setExpandedMealId(null);
  }

  function handleSaveEdit(mealId: string, values: MacroValues) {
    api
      .updateMeal(mealId, values)
      .then(function () {
        setEditingMealId(null);
        loadMeals();
      })
      .catch(function (e: Error) {
        setMealsError(e.message || "Failed to update meal");
      });
  }

  function handleDeleteMeal(meal: Meal) {
    Alert.alert("Delete meal", 'Remove "' + meal.name + '"?', [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: function () {
          api
            .deleteMeal(meal.id)
            .then(function () {
              if (expandedMealId === meal.id) setExpandedMealId(null);
              if (editingMealId === meal.id) setEditingMealId(null);
              loadMeals();
            })
            .catch(function (e: Error) {
              setMealsError(e.message || "Failed to delete meal");
            });
        },
      },
    ]);
  }

  function handleToggleGlucose(meal: Meal) {
    if (editingMealId === meal.id) return;
    if (expandedMealId === meal.id) {
      setExpandedMealId(null);
      return;
    }
    setExpandedMealId(meal.id);
    if (glucoseData[meal.id] !== undefined) return;

    setLoadingGlucose(function (prev) {
      return Object.assign({}, prev, { [meal.id]: true });
    });
    api
      .mealGlucoseResponse(meal.id)
      .then(function (data) {
        const readings: GlucoseReading[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.readings)
          ? data.readings
          : [];
        setGlucoseData(function (prev) {
          return Object.assign({}, prev, { [meal.id]: readings });
        });
      })
      .catch(function (e: Error) {
        setGlucoseErrors(function (prev) {
          return Object.assign({}, prev, { [meal.id]: e.message || "Failed to load glucose data" });
        });
      })
      .finally(function () {
        setLoadingGlucose(function (prev) {
          return Object.assign({}, prev, { [meal.id]: false });
        });
      });
  }

  const totals =
    meals.length > 0
      ? {
          carbs: meals.some(function (m) {
            return m.carbs_g != null;
          })
            ? Math.round(
                meals.reduce(function (s, m) {
                  return s + (Number(m.carbs_g) || 0);
                }, 0)
              )
            : null,
          sugar: meals.some(function (m) {
            return m.sugar_g != null;
          })
            ? Math.round(
                meals.reduce(function (s, m) {
                  return s + (Number(m.sugar_g) || 0);
                }, 0)
              )
            : null,
          calories: meals.some(function (m) {
            return m.calories != null;
          })
            ? Math.round(
                meals.reduce(function (s, m) {
                  return s + (Number(m.calories) || 0);
                }, 0)
              )
            : null,
        }
      : null;

  return (
    <ScrollView
      style={{ backgroundColor: theme.page }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.teal.bar} />}
    >
      {/* A. Log a meal */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Text style={[styles.cardTitle, { color: theme.textStrong }]}>Log a meal</Text>

        <View style={styles.chipRow}>
          {MEAL_TYPES.map(function (type) {
            const selected = mealType === type;
            return (
              <Pressable
                key={type}
                onPress={function () {
                  setMealType(type);
                }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? theme.coral.bg : theme.page,
                    borderColor: selected ? theme.coral.sub : theme.cardBorder,
                  },
                ]}
              >
                <Text
                  style={{
                    color: selected ? theme.coral.fg : theme.textSoft,
                    fontSize: 12,
                    fontWeight: selected ? "600" : "400",
                  }}
                >
                  {type}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.searchRow}>
          <TextInput
            placeholder="search food..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            style={[styles.input, { borderColor: theme.cardBorder, color: theme.textStrong }]}
            placeholderTextColor={theme.textSoft}
          />
          <Pressable
            style={[styles.actionButton, { backgroundColor: theme.coral.sub }]}
            onPress={handleSearch}
          >
            {searching ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.actionButtonText}>Search</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.belowSearchRow}>
          <Pressable
            onPress={function () { setScannerVisible(true); }}
            style={[styles.barcodeButton, { borderColor: theme.cardBorder }]}
          >
            <Ionicons name="barcode-outline" size={18} color={theme.textSoft} />
            <Text style={{ color: theme.textSoft, fontSize: 13, marginLeft: 6 }}>
              Scan barcode
            </Text>
          </Pressable>
          <Pressable
            onPress={function () {
              setPendingFood({ name: "", carbs_g: null, sugar_g: null, calories: null, source_db: "manual" });
              setSearchResults([]);
            }}
            hitSlop={8}
          >
            <Text style={{ color: theme.textSoft, fontSize: 12 }}>+ Add manually</Text>
          </Pressable>
        </View>

        {searchError ? (
          <Text style={{ color: theme.coral.sub, fontSize: 12, marginTop: 6 }}>
            {searchError}
          </Text>
        ) : null}

        {pendingFood ? (
          <MacroEditForm
            initial={pendingFood}
            saveLabel="Log it"
            onSave={handleSavePending}
            onCancel={function () { setPendingFood(null); }}
          />
        ) : searchResults.length > 0 ? (
          <View style={{ marginTop: 12, gap: 6 }}>
            {searchResults.map(function (food, i) {
              const nutrition = formatNutrition(food.carbs_g, food.sugar_g, food.calories);
              return (
                <Pressable
                  key={food.source_food_id ?? String(i)}
                  onPress={function () {
                    handleSelectFood(food);
                  }}
                  style={[styles.resultRow, { borderColor: theme.cardBorder }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ color: theme.textStrong, fontSize: 13 }}
                      numberOfLines={1}
                    >
                      {food.name}
                    </Text>
                    {nutrition ? (
                      <Text style={{ color: theme.textSoft, fontSize: 11, marginTop: 2 }}>
                        {nutrition}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="create-outline" size={18} color={theme.coral.sub} />
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {/* B. Today's totals */}
      {totals !== null && (
        <View
          style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
        >
          <Text style={[styles.cardTitle, { color: theme.textStrong }]}>Today's totals</Text>
          <Text
            style={{ color: theme.coral.fg, fontSize: 15, fontWeight: "500", marginTop: 8 }}
          >
            {formatNutrition(totals.carbs, totals.sugar, totals.calories)}
          </Text>
        </View>
      )}

      {/* C & D. Today's meals list with glucose response */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Text style={[styles.cardTitle, { color: theme.textStrong }]}>Today's meals</Text>

        {mealsError ? (
          <Text style={{ color: theme.coral.sub, fontSize: 12, marginTop: 6 }}>
            {mealsError}
          </Text>
        ) : null}

        {loadingMeals ? (
          <ActivityIndicator style={{ marginTop: 10 }} />
        ) : meals.length === 0 ? (
          <Text style={{ color: theme.textSoft, fontSize: 12, marginTop: 10 }}>
            No meals logged yet today.
          </Text>
        ) : (
          meals.map(function (meal) {
            const nutrition = formatNutrition(meal.carbs_g, meal.sugar_g, meal.calories);
            const isExpanded = expandedMealId === meal.id;
            const isEditing = editingMealId === meal.id;
            const readings = glucoseData[meal.id] ?? [];
            const isLoadingG = loadingGlucose[meal.id] ?? false;
            const gError = glucoseErrors[meal.id];

            return (
              <View key={meal.id} style={[styles.mealRow, { borderTopColor: theme.cardBorder }]}>
                <View style={styles.mealContent}>
                  <Pressable
                    style={styles.mealMain}
                    onPress={function () {
                      handleToggleGlucose(meal);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={styles.mealNameRow}>
                        <Text style={{ color: theme.textStrong, fontSize: 13 }}>
                          {meal.name}
                        </Text>
                        <View
                          style={[styles.mealTypeChip, { backgroundColor: theme.coral.bg }]}
                        >
                          <Text style={{ color: theme.coral.fg, fontSize: 10 }}>
                            {meal.meal_type}
                          </Text>
                        </View>
                      </View>
                      {nutrition ? (
                        <Text style={{ color: theme.textSoft, fontSize: 11, marginTop: 2 }}>
                          {nutrition}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons
                      name={isExpanded && !isEditing ? "chevron-up" : "pulse"}
                      size={16}
                      color={theme.berry.sub}
                      style={{ marginLeft: 8 }}
                    />
                  </Pressable>
                  <Pressable
                    onPress={function () { handleOpenEdit(meal); }}
                    style={styles.editButton}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="pencil-outline"
                      size={15}
                      color={isEditing ? theme.coral.sub : theme.textSoft}
                    />
                  </Pressable>
                  <Pressable
                    onPress={function () {
                      handleDeleteMeal(meal);
                    }}
                    style={styles.deleteButton}
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={16} color={theme.coral.sub} />
                  </Pressable>
                </View>

                {isEditing ? (
                  <View style={[styles.glucosePanel, { borderTopColor: theme.cardBorder }]}>
                    <MacroEditForm
                      initial={{
                        name: meal.name,
                        carbs_g: meal.carbs_g,
                        sugar_g: meal.sugar_g,
                        calories: meal.calories,
                      }}
                      saveLabel="Save"
                      onSave={function (values) { handleSaveEdit(meal.id, values); }}
                      onCancel={function () { setEditingMealId(null); }}
                    />
                  </View>
                ) : isExpanded ? (
                  <View
                    style={[styles.glucosePanel, { borderTopColor: theme.cardBorder }]}
                  >
                    {isLoadingG ? (
                      <ActivityIndicator style={{ marginVertical: 10 }} />
                    ) : gError ? (
                      <Text style={{ color: theme.coral.sub, fontSize: 12 }}>{gError}</Text>
                    ) : (
                      <MiniGlucoseChart
                        readings={readings}
                        mealLoggedAt={meal.logged_at ?? null}
                      />
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
  card: { borderRadius: 14, borderWidth: 0.5, padding: 16 },
  cardTitle: { fontSize: 14, fontWeight: "500" },
  chipRow: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  searchRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  belowSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionButton: {
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: "center",
    minWidth: 70,
    alignItems: "center",
  },
  actionButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  barcodeButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  resultRow: {
    flexDirection: "row",
    gap: 10,
    borderWidth: 0.5,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  editForm: { marginTop: 12, gap: 8 },
  macroInputRow: { flexDirection: "row", gap: 6 },
  macroInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 12,
  },
  editFormButtons: { flexDirection: "row", gap: 8 },
  editFormCancel: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  mealRow: { borderTopWidth: 0.5, paddingTop: 12, marginTop: 12 },
  mealContent: { flexDirection: "row", alignItems: "flex-start" },
  mealMain: { flex: 1, flexDirection: "row", alignItems: "flex-start" },
  mealNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  mealTypeChip: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  editButton: { padding: 4, marginLeft: 8 },
  deleteButton: { padding: 4, marginLeft: 4 },
  glucosePanel: { borderTopWidth: 0.5, marginTop: 10, paddingTop: 10 },
});
