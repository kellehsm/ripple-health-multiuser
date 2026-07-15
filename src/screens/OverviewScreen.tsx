import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Dimensions,
  RefreshControl,
} from "react-native";
import * as Haptics from "expo-haptics";
import Svg, { Rect, Text as SvgText, Polyline, Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../theme/ThemeContext";
import { api } from "../api/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type JournalEntry = {
  id: string;
  logged_at: string;
  mood_score: number;
  mood_label: string | null;
  entry_text: string | null;
  period: string | null;
  entry_type: string;
};

type WeeklyDay = {
  date: string;
  avg_mood: number | null;
  sleep_hours: number;
  total_spent: number;
};

type PatternEvent = {
  time: string;
  type: "mood" | "spend" | "meal" | "glucose_spike" | "water" | "hobby";
  label: string;
  entry_type?: string;
  period?: string;
};

type GlucoseReading = { recorded_at: string; mg_dl: number };

type DayEvent = {
  time: string;
  type: "mood" | "meal" | "spend";
  label: string;
  entry_type?: string;
  mood_score?: number;
  carbs_g?: number | null;
};

type WeeklyDigest = {
  glucose_by_tod: Partial<Record<string, { avg: number; count: number }>>;
  meal_flags: Array<{ label: string }>;
  spending_spikes: Array<{ label: string }>;
  heart_rate: { has_data: boolean; resting?: number; peak?: number };
  steps: { this_week: number; last_week: number };
  hobbies: { this_week_sessions: number; last_week_sessions: number };
};

type GlucoseStatus = { hasData: boolean; mg_dl: number | null; arrow: string | null };
type SleepStats = { yesterday_seconds: number; seven_day_average_seconds: number };

type Bucket = "morning" | "afternoon" | "evening" | "night";

// ─── Constants ────────────────────────────────────────────────────────────────

const BUCKET_ORDER: Bucket[] = ["morning", "afternoon", "evening", "night"];
const BUCKET_LABEL: Record<Bucket, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
};

const MOOD_OPTIONS = [
  { score: 5, label: "Great", emoji: "😃", colorKey: "violet" as const },
  { score: 4, label: "Good",  emoji: "🙂", colorKey: "teal"   as const },
  { score: 3, label: "Okay",  emoji: "😐", colorKey: "blue"   as const },
  { score: 2, label: "Low",   emoji: "😕", colorKey: "coral"  as const },
  { score: 1, label: "Bad",   emoji: "😣", colorKey: "red"    as const },
];

const SCORE_EMOJI: Record<number, string> = { 5: "😃", 4: "🙂", 3: "😐", 2: "😕", 1: "😣" };

const SCREEN_W = Dimensions.get("window").width;
const CHART_W = SCREEN_W - 64;
const CHART_H = 140;
const PAD_L = 28;
const PAD_B = 16;
const PAD_T = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeOfDayBucket(date: Date): Bucket {
  const h = date.getHours();
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 16) return "afternoon";
  if (h >= 16 && h < 21) return "evening";
  return "night";
}

function greetingPrefix(): string {
  const b = timeOfDayBucket(new Date());
  if (b === "morning") return "Good morning";
  if (b === "afternoon") return "Good afternoon";
  if (b === "evening") return "Good evening";
  return "Good night";
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0");
}

function fmtDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()];
}

function fmtSleep(seconds: number): string {
  if (seconds <= 0) return "--";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (m === 0) return h + "h";
  return h + "h " + m + "m";
}

function computeTIR(readings: GlucoseReading[]): number | null {
  if (readings.length < 3) return null;
  const inRange = readings.filter(r => Number(r.mg_dl) >= 70 && Number(r.mg_dl) <= 180).length;
  return Math.round((inRange / readings.length) * 100);
}

function weekGlucoseAvg(glucose_by_tod: WeeklyDigest["glucose_by_tod"]): number | null {
  let totalWeighted = 0;
  let totalCount = 0;
  for (const v of Object.values(glucose_by_tod)) {
    if (v) { totalWeighted += v.avg * v.count; totalCount += v.count; }
  }
  return totalCount > 0 ? Math.round(totalWeighted / totalCount) : null;
}

function interpolateGlucose(readings: GlucoseReading[], t: number): number | null {
  if (readings.length === 0) return null;
  let before: GlucoseReading | null = null;
  let after: GlucoseReading | null = null;
  for (const r of readings) {
    const rt = new Date(r.recorded_at).getTime();
    if (rt <= t) before = r;
    else if (!after) after = r;
  }
  if (!before && !after) return null;
  if (!before) return Number(after!.mg_dl);
  if (!after) {
    return (t - new Date(before.recorded_at).getTime()) <= 20 * 60 * 1000 ? Number(before.mg_dl) : null;
  }
  const bt = new Date(before.recorded_at).getTime();
  const at = new Date(after.recorded_at).getTime();
  return Number(before.mg_dl) + ((t - bt) / (at - bt)) * (Number(after.mg_dl) - Number(before.mg_dl));
}

function glucoseY(val: number, minVal: number, maxVal: number): number {
  const usableH = CHART_H - PAD_T - PAD_B;
  return PAD_T + usableH - ((val - minVal) / (maxVal - minVal)) * usableH;
}

function eventX(t: number, windowStart: number, windowEnd: number): number {
  return PAD_L + ((t - windowStart) / (windowEnd - windowStart)) * (CHART_W - PAD_L);
}

function computeInsights(params: {
  dayGlucose: GlucoseReading[];
  weeklyData: WeeklyDay[];
  patternEvents: PatternEvent[];
  streak: number;
  stepsCount: number | null;
  sleepStats: SleepStats | null;
  digest: WeeklyDigest | null;
}): string[] {
  const { dayGlucose, weeklyData, patternEvents, streak, stepsCount, sleepStats, digest } = params;
  const insights: string[] = [];
  const hour = new Date().getHours();

  // Glucose steadiness vs weekly average
  if (dayGlucose.length >= 6 && digest) {
    const todayValues = dayGlucose.map(r => Number(r.mg_dl));
    const todayAvg = todayValues.reduce((s, v) => s + v, 0) / todayValues.length;
    const weeklyAvg = weekGlucoseAvg(digest.glucose_by_tod);
    if (weeklyAvg !== null) {
      const diff = todayAvg - weeklyAvg;
      if (Math.abs(diff) >= 12) {
        if (diff < 0) {
          insights.push(`Glucose is running ${Math.abs(Math.round(diff))} mg/dL lower than your weekly average today.`);
        } else {
          insights.push(`Glucose is running ${Math.round(diff)} mg/dL higher than your weekly average today.`);
        }
      } else {
        const variance = todayValues.reduce((s, v) => s + (v - todayAvg) ** 2, 0) / todayValues.length;
        if (Math.sqrt(variance) < 18) {
          insights.push("Your glucose has been steady today — smaller swings than usual.");
        }
      }
    }
  }

  // Sleep vs rolling average
  if (sleepStats && sleepStats.yesterday_seconds > 0 && sleepStats.seven_day_average_seconds > 0) {
    const diffSecs = sleepStats.yesterday_seconds - sleepStats.seven_day_average_seconds;
    const diffMins = Math.abs(Math.round(diffSecs / 60));
    if (diffMins >= 20) {
      if (diffSecs > 0) {
        insights.push(`You slept ${diffMins} min more than your recent average last night.`);
      } else {
        insights.push(`You got ${diffMins} min less sleep than your recent average last night.`);
      }
    }
  }

  // Meal timing — gentle observation, not prescriptive
  if (hour >= 13 && hour < 16) {
    const hasMiddayMeal = patternEvents.some(e => {
      if (e.type !== "meal") return false;
      const h = new Date(e.time).getHours();
      return h >= 11 && h < 15;
    });
    if (!hasMiddayMeal) {
      insights.push("No midday meal logged yet — you usually log one around this time.");
    }
  }

  // Streak
  if (streak >= 3) {
    insights.push(`${streak}-day logging streak — great consistency!`);
  }

  // Steps vs daily average
  if (stepsCount !== null && stepsCount > 0 && digest && digest.steps.last_week > 0) {
    const dailyAvg = Math.round(digest.steps.last_week / 7);
    if (dailyAvg > 0) {
      const pct = Math.round((stepsCount / dailyAvg) * 100);
      if (pct >= 70) {
        insights.push(`${stepsCount.toLocaleString()} steps so far — on pace with your weekly average.`);
      }
    }
  }

  return insights.slice(0, 4);
}

// ─── Skeleton box component ───────────────────────────────────────────────────

function SkeletonBox({ style }: { style?: object }) {
  const anim = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.75, duration: 750, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.35, duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);
  return <Animated.View style={[{ backgroundColor: "#ccc", borderRadius: 10, opacity: anim }, style]} />;
}

// ─── Correlation chart constants ──────────────────────────────────────────────

const CORR_W = SCREEN_W - 64;
const CORR_H = 90;
const BAR_W = Math.floor((CORR_W / 7) * 0.35);
const STEP = CORR_W / 7;

// ─── Component ───────────────────────────────────────────────────────────────

export function OverviewScreen() {
  const { theme, mode } = useTheme();
  const navigation = useNavigation<any>();
  const ink = theme.ink;
  const card = theme.card;
  const styles = useMemo(() => makeStyles(ink, card), [ink, card]);

  // Existing state
  const [todayEntries, setTodayEntries] = useState<JournalEntry[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyDay[]>([]);
  const [patternEvents, setPatternEvents] = useState<PatternEvent[]>([]);
  const [digest, setDigest] = useState<WeeklyDigest | null>(null);
  const [dayGlucose, setDayGlucose] = useState<GlucoseReading[]>([]);
  const [dayEvents, setDayEvents] = useState<DayEvent[]>([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recapDismissed, setRecapDismissed] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);

  // New state for metric chips
  const [glucoseStatus, setGlucoseStatus] = useState<GlucoseStatus | null>(null);
  const [stepsCount, setStepsCount] = useState<number | null>(null);
  const [sleepStats, setSleepStats] = useState<SleepStats | null>(null);
  const [waterCount, setWaterCount] = useState<number>(0);
  const [todayMeals, setTodayMeals] = useState<any[]>([]);

  // Mood picker state
  const [activePicker, setActivePicker] = useState<Bucket | "moment" | null>(null);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [pendingNote, setPendingNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Correlation toggle
  const [correlation, setCorrelation] = useState<"sleep" | "spend">("sleep");

  const load = useCallback(async function () {
    try {
      const today = new Date().toISOString().split("T")[0];

      const [entries, weekly, pattern, dig, day, streakData, glucSt, meals, steps, sleep] =
        await Promise.all([
          api.journalToday(),
          api.weeklyMoodSummary(),
          api.pattern(),
          api.weeklyDigest(),
          api.dayView(today),
          api.streaks(),
          api.glucoseStatus().catch(() => null),
          api.meals(today).catch(() => []),
          api.stepsToday(today).catch(() => null),
          api.sleepStats().catch(() => null),
        ]);

      // Water count (sequential — needs metricId)
      let wCount = 0;
      try {
        const waterMetric = await api.getOrCreateWaterMetric();
        if (waterMetric?.id) {
          const logs: any[] = await api.todaysWaterCount(waterMetric.id);
          const todayStr = new Date().toDateString();
          wCount = Array.isArray(logs)
            ? logs
                .filter(l => new Date(l.logged_at).toDateString() === todayStr)
                .reduce((sum, l) => sum + Number(l.value), 0)
            : 0;
        }
      } catch (_) {}

      setTodayEntries(Array.isArray(entries) ? entries : []);
      setWeeklyData(Array.isArray(weekly) ? weekly : []);
      setPatternEvents(Array.isArray(pattern) ? pattern : []);
      setDigest(dig ?? null);
      setStreak(Number(streakData?.meal_streak ?? 0));
      setGlucoseStatus(glucSt);
      setTodayMeals(Array.isArray(meals) ? meals : []);
      setStepsCount(steps?.steps ?? null);
      setSleepStats(sleep ?? null);
      setWaterCount(wCount);

      if (day) {
        setDayGlucose(Array.isArray(day.glucose) ? day.glucose : []);
        setDayEvents(Array.isArray(day.events) ? day.events : []);
      }
    } catch (e) {
      console.error("Overview load failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  useEffect(function () { load(); }, [load]);

  // Mood period helpers
  const entryPerPeriod: Partial<Record<Bucket, JournalEntry>> = {};
  const momentEntries: JournalEntry[] = [];
  for (const entry of todayEntries) {
    if (entry.entry_type === "moment") { momentEntries.push(entry); continue; }
    const p = (entry.period ?? timeOfDayBucket(new Date(entry.logged_at))) as Bucket;
    entryPerPeriod[p] = entry;
  }
  const currentBucket = timeOfDayBucket(new Date());
  const currentEntry = entryPerPeriod[currentBucket] ?? null;
  const currentUnlogged = currentEntry === null;

  async function handleSubmit() {
    if (!pendingLabel || !activePicker) return;
    const score = MOOD_OPTIONS.find((m) => m.label === pendingLabel)?.score;
    if (!score) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSubmitting(true);
    try {
      if (activePicker === "moment") {
        await api.logMoodMoment(score, pendingLabel, pendingNote.trim() || undefined);
      } else {
        await api.upsertPeriodMood(score, activePicker, pendingLabel, pendingNote.trim() || undefined);
      }
      setActivePicker(null);
      setPendingLabel(null);
      setPendingNote("");
      await load();
    } catch (e) {
      console.error("Failed to log mood", e);
    } finally {
      setSubmitting(false);
    }
  }

  function openPicker(target: Bucket | "moment") {
    const existing = target !== "moment" ? entryPerPeriod[target as Bucket] : null;
    setActivePicker(target);
    setPendingLabel(existing?.mood_label ?? null);
    setPendingNote(existing?.entry_text ?? "");
  }

  // Derived values
  const tir = computeTIR(dayGlucose);
  const insights = useMemo(() => computeInsights({
    dayGlucose, weeklyData, patternEvents, streak, stepsCount, sleepStats, digest,
  }), [dayGlucose, weeklyData, patternEvents, streak, stepsCount, sleepStats, digest]);

  // Glucose chart
  const glucoseValues = dayGlucose.map((r) => Number(r.mg_dl));
  const minVal = glucoseValues.length ? Math.min(...glucoseValues, 70) - 10 : 60;
  const maxVal = glucoseValues.length ? Math.max(...glucoseValues, 140) + 10 : 200;
  const dayTimes = dayGlucose.map((r) => new Date(r.recorded_at).getTime());
  const windowStart = dayTimes.length ? Math.min(...dayTimes) : Date.now() - 8 * 3600000;
  const windowEnd = dayTimes.length ? Math.max(Math.max(...dayTimes), Date.now()) : Date.now();
  const glucosePoints = dayGlucose
    .map(r => eventX(new Date(r.recorded_at).getTime(), windowStart, windowEnd) + "," + glucoseY(Number(r.mg_dl), minVal, maxVal))
    .join(" ");
  const highBandY = glucoseY(180, minVal, maxVal);
  const lowBandY = glucoseY(70, minVal, maxVal);
  const usableH = CHART_H - PAD_T - PAD_B;

  // Correlation chart
  const maxSpend = Math.max(...weeklyData.map((d) => d.total_spent), 1);
  const maxSleep = Math.max(...weeklyData.map((d) => d.sleep_hours), 8);
  function moodBarH(avg_mood: number | null) { return avg_mood === null ? 0 : ((avg_mood - 1) / 4) * CORR_H; }
  function compBarH(d: WeeklyDay) {
    return correlation === "sleep" ? (d.sleep_hours / maxSleep) * CORR_H : (d.total_spent / maxSpend) * CORR_H;
  }

  // Timeline events — show all (water + hobbies now included from backend)
  const visibleEvents = showAllEvents ? patternEvents : patternEvents.slice(0, 8);

  // Weekly recap (Monday only)
  const isWeekStart = new Date().getDay() === 1;
  const showRecap = isWeekStart && !recapDismissed && digest !== null;
  const glucoseAvg = digest ? weekGlucoseAvg(digest.glucose_by_tod) : null;

  // Date string for header
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  // ── Event type styling helpers ─────────────────────────────────────────────
  function eventDotColor(type: PatternEvent["type"]): string {
    switch (type) {
      case "meal": return theme.coral.solid;
      case "mood": return theme.violet.solid;
      case "spend": return theme.purple.solid;
      case "glucose_spike": return (theme as any).red?.solid ?? "#C0392B";
      case "water": return (theme as any).blue?.solid ?? "#378ADD";
      case "hobby": return theme.teal.solid;
      default: return theme.textSoft;
    }
  }

  function eventIcon(type: PatternEvent["type"]): string {
    switch (type) {
      case "meal": return "restaurant";
      case "mood": return "happy-outline";
      case "spend": return "card-outline";
      case "glucose_spike": return "pulse";
      case "water": return "water-outline";
      case "hobby": return "barbell-outline";
      default: return "ellipse";
    }
  }

  // ─── Metric chip renderer ─────────────────────────────────────────────────
  type ChipData = {
    label: string;
    value: string;
    sub?: string;
    color: string;
    icon: string;
    empty?: boolean;
  };

  const currentMoodEntry = entryPerPeriod[currentBucket];
  const chips: ChipData[] = [
    {
      label: "GLUCOSE",
      value: glucoseStatus?.hasData && glucoseStatus.mg_dl != null
        ? String(glucoseStatus.mg_dl) + (glucoseStatus.arrow ? " " + glucoseStatus.arrow : "")
        : "--",
      sub: "mg/dL",
      color: theme.berry.solid,
      icon: "pulse",
      empty: !glucoseStatus?.hasData,
    },
    {
      label: "IN RANGE",
      value: tir !== null ? tir + "%" : "--",
      sub: "today",
      color: tir !== null ? (tir >= 70 ? theme.teal.solid : theme.coral.solid) : theme.textSoft,
      icon: "stats-chart",
      empty: tir === null,
    },
    {
      label: "STEPS",
      value: stepsCount != null ? stepsCount.toLocaleString() : "--",
      sub: "today",
      color: theme.teal.solid,
      icon: "walk",
      empty: stepsCount === null,
    },
    {
      label: "SLEEP",
      value: sleepStats && sleepStats.yesterday_seconds > 0
        ? fmtSleep(sleepStats.yesterday_seconds)
        : "--",
      sub: "last night",
      color: (theme as any).indigo?.solid ?? "#6C5CE7",
      icon: "moon-outline",
      empty: !sleepStats || sleepStats.yesterday_seconds === 0,
    },
    {
      label: "WATER",
      value: waterCount > 0 ? String(waterCount) : "--",
      sub: "glasses",
      color: (theme as any).blue?.solid ?? "#378ADD",
      icon: "water-outline",
      empty: waterCount === 0,
    },
    {
      label: "MEALS",
      value: todayMeals.length > 0 ? String(todayMeals.length) : "--",
      sub: "logged",
      color: theme.coral.solid,
      icon: "restaurant",
      empty: todayMeals.length === 0,
    },
    {
      label: "MOOD",
      value: currentMoodEntry ? (SCORE_EMOJI[currentMoodEntry.mood_score] ?? "--") : "--",
      sub: currentMoodEntry?.mood_label ?? "not logged",
      color: theme.violet.solid,
      icon: "happy-outline",
      empty: !currentMoodEntry,
    },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={{ backgroundColor: theme.page }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.teal.bar} />}
      accessibilityLabel="Today dashboard"
    >
      {/* ── 1. Header ── */}
      <View style={styles.headerBlock}>
        <Text style={[styles.greeting, { color: theme.textStrong }]} accessibilityRole="header">
          {greetingPrefix()}, Kelly
        </Text>
        <Text style={[styles.dateText, { color: theme.textSoft }]}>{dateStr}</Text>

        {streak >= 3 ? (
          <View style={[styles.streakPill, { backgroundColor: theme.teal.solid }]}>
            <Ionicons name="flame" size={12} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.streakPillText}>{streak} DAY STREAK</Text>
          </View>
        ) : null}
      </View>

      {/* ── 2. Metric chips (horizontal scroll) ── */}
      {loading ? (
        <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 2 }}>
          {[1,2,3,4].map(i => <SkeletonBox key={i} style={{ width: 100, height: 84 }} />)}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 4 }}
          accessibilityLabel="Key metrics"
        >
          {chips.map((chip) => (
            <View
              key={chip.label}
              style={[
                styles.metricChip,
                { borderColor: ink, opacity: chip.empty ? 0.55 : 1 },
              ]}
              accessibilityLabel={chip.label + ": " + chip.value}
            >
              <View style={[styles.chipIcon, { backgroundColor: chip.color }]}>
                <Ionicons name={chip.icon as any} size={13} color="#fff" />
              </View>
              <Text style={[styles.chipValue, { color: theme.textStrong }]} numberOfLines={1}>
                {chip.value}
              </Text>
              {chip.sub ? (
                <Text style={[styles.chipSub, { color: theme.textSoft }]} numberOfLines={1}>
                  {chip.sub}
                </Text>
              ) : null}
              <Text style={[styles.chipLabel, { color: theme.textSoft }]}>{chip.label}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── Trends nav card ── */}
      <Pressable
        onPress={() => navigation.getParent()?.navigate("Trends")}
        style={[styles.card, { backgroundColor: theme.violet.tint }]}
        accessibilityRole="button"
        accessibilityLabel="View Trends and Insights"
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: theme.violet.fg }]}>Trends & Insights</Text>
            <Text style={{ color: theme.violet.sub, fontSize: 12, lineHeight: 17, marginTop: 4 }}>
              See how sleep, spending & glucose relate to your mood
            </Text>
          </View>
          <Ionicons name="stats-chart" size={28} color={theme.violet.sub} style={{ marginLeft: 12 }} />
        </View>
      </Pressable>

      {/* ── 3. Mood check-in ── */}
      <View style={[styles.card, { backgroundColor: theme.coral.tint }]}>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, { color: theme.coral.fg }]}>Mood check-in</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {currentUnlogged ? (
              <View style={[styles.dueNowPill, { backgroundColor: theme.coral.solid }]}>
                <Text style={styles.dueNowText}>DUE NOW</Text>
              </View>
            ) : null}
            <Pressable
              onPress={() => openPicker("moment")}
              style={[styles.momentBtn, { backgroundColor: card }]}
              accessibilityRole="button"
              accessibilityLabel="Log a mood moment"
            >
              <Ionicons name="add" size={13} color={ink} />
              <Text style={styles.momentBtnText}>MOMENT</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.periodRow}>
          {BUCKET_ORDER.map(function (b) {
            const entry = entryPerPeriod[b];
            const isNow = b === currentBucket;
            return (
              <Pressable
                key={b}
                onPress={() => openPicker(b)}
                style={[
                  styles.periodTile,
                  {
                    backgroundColor: card,
                    borderColor: isNow && !entry ? theme.coral.solid : ink,
                    borderWidth: isNow && !entry ? 2.5 : 2,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={BUCKET_LABEL[b] + " mood: " + (entry ? entry.mood_label ?? String(entry.mood_score) : "not logged")}
              >
                <Text style={styles.periodLabel}>{BUCKET_LABEL[b].slice(0, 3).toUpperCase()}</Text>
                <Text style={{ fontSize: 16, marginVertical: 2 }}>
                  {entry ? (SCORE_EMOJI[entry.mood_score] ?? "·") : (isNow ? "·" : "—")}
                </Text>
                <Text style={{ color: theme.textSoft, fontSize: 10, fontWeight: "600" }}>
                  {entry ? (entry.mood_label ?? String(entry.mood_score)) : ""}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {activePicker !== null ? (
          <View style={[styles.pickerBox, { backgroundColor: card }]}>
            <Text style={styles.pickerTitle}>
              {activePicker === "moment"
                ? "Log a moment"
                : BUCKET_LABEL[activePicker as Bucket] + (entryPerPeriod[activePicker as Bucket] ? " — update" : "")}
            </Text>
            <View style={styles.moodOptionsRow}>
              {MOOD_OPTIONS.map(function (opt) {
                const selected = pendingLabel === opt.label;
                const c = (theme as any)[opt.colorKey];
                return (
                  <Pressable
                    key={opt.label}
                    onPress={() => setPendingLabel(opt.label)}
                    style={[
                      styles.moodTile,
                      { backgroundColor: selected ? c.tint : "#ffffff", borderColor: selected ? c.solid : ink, borderWidth: selected ? 2.5 : 2 },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={opt.label}
                  >
                    <Text style={{ fontSize: 22, marginBottom: 4 }}>{opt.emoji}</Text>
                    <Text style={[styles.moodTileLabel, { color: selected ? c.fg : theme.textSoft }]}>
                      {opt.label.toUpperCase()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              value={pendingNote}
              onChangeText={setPendingNote}
              placeholder="Note (optional)"
              placeholderTextColor={theme.textSoft}
              style={[styles.noteInput, { color: theme.textStrong }]}
              accessibilityLabel="Mood note"
            />
            <View style={styles.pickerActions}>
              <Pressable
                onPress={() => { setActivePicker(null); setPendingLabel(null); setPendingNote(""); }}
                style={styles.cancelBtn}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.cancelBtnText}>CANCEL</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                disabled={pendingLabel === null || submitting}
                style={[styles.logBtn, { backgroundColor: pendingLabel !== null ? theme.coral.solid : theme.cardBorder, opacity: pendingLabel === null ? 0.5 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel="Log mood"
              >
                {submitting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.logBtnText}>LOG</Text>}
              </Pressable>
            </View>
          </View>
        ) : null}

        {momentEntries.length > 0 ? (
          <View style={{ marginTop: 8, gap: 4 }}>
            {momentEntries.map(e => (
              <Text key={e.id} style={{ color: theme.coral.fg, fontSize: 12 }}>
                {fmtTime(e.logged_at)} · {SCORE_EMOJI[e.mood_score] ?? ""} {e.mood_label ?? String(e.mood_score)}
                {e.entry_text ? " — " + e.entry_text : ""}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      {/* ── 4. Today's timeline ── */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.textStrong }]}>Today's timeline</Text>

        {/* Glucose chart */}
        {loading ? (
          <SkeletonBox style={{ height: CHART_H, marginBottom: 8 }} />
        ) : dayGlucose.length > 0 ? (
          <>
            <Svg width={CHART_W} height={CHART_H} style={{ marginBottom: 6 }} accessibilityLabel="Glucose chart">
              <Rect
                x={PAD_L} y={highBandY}
                width={CHART_W - PAD_L} height={lowBandY - highBandY}
                fill={mode === "dark" ? theme.berry.sub : theme.berry.tint}
                opacity={mode === "dark" ? 0.25 : 0.4}
                stroke={ink} strokeWidth={1} strokeDasharray="5,5"
              />
              <SvgText x={PAD_L - 3} y={highBandY + 4} fontSize={8} fill={theme.textSoft} textAnchor="end">180</SvgText>
              <SvgText x={PAD_L - 3} y={lowBandY + 4} fontSize={8} fill={theme.textSoft} textAnchor="end">70</SvgText>
              {glucosePoints ? (
                <>
                  <Polyline points={glucosePoints} fill="none" stroke={ink} strokeWidth={3.5} />
                  <Polyline points={glucosePoints} fill="none" stroke={theme.berry.bar} strokeWidth={2} />
                </>
              ) : null}
              {dayEvents.map(function (ev, i) {
                const t = new Date(ev.time).getTime();
                if (t < windowStart || t > windowEnd) return null;
                const x = eventX(t, windowStart, windowEnd);
                const gVal = interpolateGlucose(dayGlucose, t);
                const y = gVal !== null ? glucoseY(gVal, minVal, maxVal) : PAD_T + usableH;
                const markerText = ev.type === "spend" ? "$" : ev.type === "mood" && ev.mood_score ? SCORE_EMOJI[ev.mood_score] ?? "·" : ev.type === "mood" ? "·" : "M";
                const markerBg = ev.type === "meal" ? theme.coral.tint : ev.type === "spend" ? theme.purple.tint : theme.violet.tint;
                return (
                  <React.Fragment key={i}>
                    <Circle cx={x} cy={y} r={9} fill={markerBg} stroke={ink} strokeWidth={2} />
                    <SvgText x={x} y={y + 4} fontSize={8} fill={ink} textAnchor="middle" fontWeight="bold">{markerText}</SvgText>
                  </React.Fragment>
                );
              })}
            </Svg>
            <View style={[styles.legendRow, { marginBottom: 12 }]}>
              {[
                { color: theme.berry.bar, label: "Glucose" },
                { color: theme.coral.tint, label: "Meal" },
                { color: theme.violet.tint, label: "Mood" },
                { color: theme.purple.tint, label: "Spend" },
              ].map(l => (
                <View key={l.label} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: l.color, borderWidth: 1.5, borderColor: ink }]} />
                  <Text style={{ color: theme.textSoft, fontSize: 10 }}>{l.label}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <View style={[styles.emptyState, { borderColor: ink }]}>
            <Ionicons name="pulse-outline" size={24} color={theme.textSoft} />
            <Text style={[styles.emptyText, { color: theme.textSoft }]}>No glucose data yet today</Text>
          </View>
        )}

        {/* Chronological event feed — vertical timeline */}
        {loading ? (
          <View style={{ gap: 12 }}>
            <SkeletonBox style={{ height: 18, width: "70%" }} />
            <SkeletonBox style={{ height: 18, width: "55%" }} />
            <SkeletonBox style={{ height: 18, width: "80%" }} />
          </View>
        ) : patternEvents.length === 0 ? (
          <View style={[styles.emptyState, { borderColor: ink }]}>
            <Ionicons name="calendar-outline" size={24} color={theme.textSoft} />
            <Text style={[styles.emptyText, { color: theme.textSoft }]}>No events logged today yet</Text>
          </View>
        ) : (
          <>
            {visibleEvents.map(function (ev, i) {
              const dotColor = eventDotColor(ev.type);
              const icon = eventIcon(ev.type);
              const isLast = i === visibleEvents.length - 1;
              return (
                <View key={i} style={{ flexDirection: "row", minHeight: 36 }}>
                  <Text style={[styles.tlTime, { color: theme.textSoft }]}>{fmtTime(ev.time)}</Text>
                  <View style={{ width: 20, alignItems: "center", marginRight: 10 }}>
                    <View style={[styles.tlIconDot, { backgroundColor: dotColor }]}>
                      <Ionicons name={icon as any} size={9} color="#fff" />
                    </View>
                    {!isLast && <View style={[styles.tlLine, { backgroundColor: theme.cardBorder }]} />}
                  </View>
                  <Text
                    style={{ flex: 1, color: theme.textStrong, fontSize: 13, fontWeight: "500", lineHeight: 18, paddingBottom: isLast ? 0 : 10 }}
                    numberOfLines={2}
                  >
                    {ev.label}
                    {ev.type === "mood" && ev.entry_type === "period" && ev.period
                      ? " · " + BUCKET_LABEL[ev.period as Bucket]
                      : ""}
                  </Text>
                </View>
              );
            })}
            {patternEvents.length > 8 ? (
              <Pressable onPress={() => setShowAllEvents(!showAllEvents)} style={{ paddingTop: 6 }}>
                <Text style={{ color: theme.teal.fg, fontSize: 12, fontWeight: "700" }}>
                  {showAllEvents ? "Show less" : "Show all " + patternEvents.length + " events"}
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>

      {/* ── 5. Insights ── */}
      {loading ? (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <SkeletonBox style={{ height: 18, width: "40%", marginBottom: 12 }} />
          <SkeletonBox style={{ height: 14, width: "90%", marginBottom: 8 }} />
          <SkeletonBox style={{ height: 14, width: "75%" }} />
        </View>
      ) : insights.length > 0 ? (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <View style={[styles.insightIcon, { backgroundColor: theme.violet.solid }]}>
              <Ionicons name="bulb-outline" size={14} color="#fff" />
            </View>
            <Text style={[styles.cardTitle, { color: theme.textStrong }]}>Insights</Text>
          </View>
          {insights.map((obs, i) => (
            <View key={i} style={styles.insightRow}>
              <View style={[styles.insightDot, { backgroundColor: theme.violet.solid }]} />
              <Text style={{ color: theme.textStrong, fontSize: 13, lineHeight: 18, flex: 1 }}>{obs}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* ── 6. 7-day review ── */}
      {showRecap && digest ? (
        <View style={[styles.card, { backgroundColor: theme.teal.tint }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text style={[styles.cardTitle, { color: theme.teal.fg }]}>Your week</Text>
            <Pressable onPress={() => setRecapDismissed(true)} accessibilityLabel="Dismiss weekly recap">
              <Ionicons name="close" size={16} color={theme.teal.fg} />
            </Pressable>
          </View>
          {digest.steps.this_week > 0 ? (
            <Text style={{ color: theme.teal.fg, fontSize: 13 }}>
              {digest.steps.this_week.toLocaleString()} steps
              {digest.steps.last_week > 0 ? (digest.steps.this_week >= digest.steps.last_week ? " · up from last week" : " · fewer than last week") : ""}
            </Text>
          ) : null}
          {digest.hobbies.this_week_sessions > 0 ? (
            <Text style={{ color: theme.teal.fg, fontSize: 13, marginTop: 3 }}>
              {digest.hobbies.this_week_sessions} hobby session{digest.hobbies.this_week_sessions === 1 ? "" : "s"}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.textStrong }]}>7-day review</Text>
        {loading ? (
          <View style={{ gap: 8, marginTop: 10 }}>
            <SkeletonBox style={{ height: 72, marginBottom: 4 }} />
            <SkeletonBox style={{ height: 14, width: "60%" }} />
          </View>
        ) : digest ? (
          <>
            <View style={styles.summaryBlocksRow}>
              <View style={[styles.summaryBlock, { backgroundColor: theme.teal.solid }]}>
                <Text style={styles.summaryBlockLabel}>STEPS</Text>
                <Text style={styles.summaryBlockValue}>{digest.steps.this_week.toLocaleString()}</Text>
              </View>
              <View style={[styles.summaryBlock, { backgroundColor: theme.berry.solid }]}>
                <Text style={styles.summaryBlockLabel}>GLUCOSE</Text>
                <Text style={styles.summaryBlockValue}>{glucoseAvg !== null ? glucoseAvg + " avg" : "--"}</Text>
              </View>
              <View style={[styles.summaryBlock, { backgroundColor: theme.purple.solid }]}>
                <Text style={styles.summaryBlockLabel}>HOBBIES</Text>
                <Text style={styles.summaryBlockValue}>{digest.hobbies.this_week_sessions} sess.</Text>
              </View>
              <View style={[styles.summaryBlock, { backgroundColor: theme.coral.solid }]}>
                <Text style={styles.summaryBlockLabel}>MEAL NOTES</Text>
                <Text style={styles.summaryBlockValue}>{digest.meal_flags.length === 0 ? "All clear" : digest.meal_flags.length + " flagged"}</Text>
              </View>
            </View>
            {digest.heart_rate.has_data ? (
              <>
                <Text style={[styles.digestLabel, { color: theme.textSoft }]}>Heart rate</Text>
                <Text style={{ color: theme.textStrong, fontSize: 13, marginBottom: 4, fontWeight: "600" }}>
                  Resting {digest.heart_rate.resting} · Peak {digest.heart_rate.peak} bpm
                </Text>
              </>
            ) : null}
            {(digest.meal_flags.length > 0 || digest.spending_spikes.length > 0) ? (
              <View style={[styles.calloutStrip, { backgroundColor: theme.coral.tint, borderColor: ink }]}>
                {digest.meal_flags.map((f, i) => <Text key={"mf" + i} style={{ color: theme.coral.fg, fontSize: 12 }}>🍽 {f.label}</Text>)}
                {digest.spending_spikes.map((s, i) => <Text key={"ss" + i} style={{ color: theme.purple.fg, fontSize: 12 }}>$ {s.label}</Text>)}
              </View>
            ) : null}
          </>
        ) : (
          <View style={[styles.emptyState, { borderColor: ink, marginTop: 8 }]}>
            <Text style={[styles.emptyText, { color: theme.textSoft }]}>No 7-day data yet</Text>
          </View>
        )}
      </View>

      {/* ── 7. Mood/sleep/spend correlation ── */}
      {weeklyData.length > 0 ? (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.textStrong }]}>7-day mood pattern</Text>
          <Text style={{ color: theme.textSoft, fontSize: 11, marginBottom: 8 }}>
            Same days side by side — draw your own conclusions.
          </Text>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.violet.solid }]} />
              <Text style={{ color: theme.textSoft, fontSize: 11 }}>Mood (1–5)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: correlation === "sleep" ? theme.amber?.solid ?? "#F0B429" : theme.purple.solid }]} />
              <Text style={{ color: theme.textSoft, fontSize: 11 }}>{correlation === "sleep" ? "Sleep (hrs)" : "Spending ($)"}</Text>
            </View>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={() => setCorrelation(correlation === "sleep" ? "spend" : "sleep")}
              style={[styles.toggleChip, { backgroundColor: card }]}
              accessibilityRole="button"
              accessibilityLabel={"Switch to compare with " + (correlation === "sleep" ? "spending" : "sleep")}
            >
              <Text style={{ color: ink, fontSize: 10, fontWeight: "800", letterSpacing: 0.4 }}>
                VS {correlation === "sleep" ? "SPENDING" : "SLEEP"}
              </Text>
            </Pressable>
          </View>
          <Svg width={CORR_W} height={CORR_H + 20} style={{ marginTop: 8 }}>
            {weeklyData.map(function (d, i) {
              const mH = moodBarH(d.avg_mood);
              const cH = compBarH(d);
              const groupX = i * STEP;
              const moodX = groupX + STEP / 2 - BAR_W - 1;
              const compX = groupX + STEP / 2 + 1;
              const compColor = correlation === "sleep" ? (theme.amber?.solid ?? "#F0B429") : theme.purple.solid;
              return (
                <React.Fragment key={d.date}>
                  {mH > 0 ? <Rect x={moodX} y={CORR_H - mH} width={BAR_W} height={mH} fill={theme.violet.solid} rx={3} /> : <Rect x={moodX} y={CORR_H - 2} width={BAR_W} height={2} fill={theme.cardBorder} rx={1} />}
                  {cH > 0 ? <Rect x={compX} y={CORR_H - cH} width={BAR_W} height={cH} fill={compColor} rx={3} /> : <Rect x={compX} y={CORR_H - 2} width={BAR_W} height={2} fill={theme.cardBorder} rx={1} />}
                  <SvgText x={groupX + STEP / 2} y={CORR_H + 14} fontSize={10} fill={theme.textSoft} textAnchor="middle">{fmtDayLabel(d.date)}</SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
        </View>
      ) : null}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(ink: string, card: string) {
  return StyleSheet.create({
    content: { padding: 16, gap: 12 },

    headerBlock: { marginBottom: 4 },
    greeting: { fontSize: 22, fontWeight: "800", marginBottom: 2 },
    dateText: { fontSize: 13, marginBottom: 8 },
    streakPill: {
      flexDirection: "row",
      alignSelf: "flex-start",
      alignItems: "center",
      borderWidth: 2,
      borderColor: ink,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 4,
      shadowColor: ink,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 2,
    },
    streakPillText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },

    metricChip: {
      width: 100,
      borderRadius: 12,
      borderWidth: 2,
      padding: 10,
      backgroundColor: card,
      shadowColor: ink,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    chipIcon: {
      width: 22,
      height: 22,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
    },
    chipValue: { fontSize: 16, fontWeight: "800", lineHeight: 18, marginBottom: 1 },
    chipSub: { fontSize: 10, lineHeight: 13 },
    chipLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.6, marginTop: 4 },

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
    cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
    cardTitle: { fontSize: 19, fontWeight: "800" },

    dueNowPill: {
      borderWidth: 2,
      borderColor: ink,
      borderRadius: 20,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    dueNowText: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },

    momentBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      borderWidth: 2,
      borderColor: ink,
      borderRadius: 20,
      paddingHorizontal: 8,
      paddingVertical: 4,
      shadowColor: ink,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 2,
    },
    momentBtnText: { fontSize: 9, fontWeight: "800", color: ink, letterSpacing: 0.4 },

    periodRow: { flexDirection: "row", gap: 6 },
    periodTile: {
      flex: 1,
      borderRadius: 10,
      paddingVertical: 8,
      alignItems: "center",
      gap: 1,
      shadowColor: ink,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 2,
    },
    periodLabel: { fontSize: 9, fontWeight: "800", color: ink, letterSpacing: 0.5 },

    pickerBox: {
      marginTop: 12,
      borderWidth: 2,
      borderColor: ink,
      borderRadius: 12,
      padding: 12,
      shadowColor: ink,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    pickerTitle: { color: ink, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
    moodOptionsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 10 },
    moodTile: {
      flex: 1,
      minWidth: 56,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: "center",
      shadowColor: ink,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 2,
    },
    moodTileLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
    noteInput: {
      borderWidth: 2,
      borderColor: ink,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 13,
      marginBottom: 10,
      backgroundColor: card,
      shadowColor: ink,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 2,
    },
    pickerActions: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
    cancelBtn: {
      borderWidth: 2,
      borderColor: ink,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: card,
      shadowColor: ink,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 2,
    },
    cancelBtnText: { color: ink, fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },
    logBtn: {
      borderRadius: 10,
      borderWidth: 2,
      borderColor: ink,
      paddingHorizontal: 20,
      paddingVertical: 8,
      minWidth: 60,
      alignItems: "center",
      shadowColor: ink,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 2,
    },
    logBtnText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },

    // Timeline
    tlTime: { fontSize: 11, width: 42, paddingTop: 3 },
    tlIconDot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 1.5,
      borderColor: ink,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    tlLine: { flex: 1, width: 2, marginTop: 2 },

    // Insights
    insightIcon: {
      width: 26,
      height: 26,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: ink,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: ink,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 2,
    },
    insightRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 5 },
    insightDot: { width: 7, height: 7, borderRadius: 4, marginTop: 6, flexShrink: 0 },

    // Empty state
    emptyState: {
      borderWidth: 2,
      borderRadius: 10,
      borderStyle: "dashed",
      paddingVertical: 18,
      alignItems: "center",
      gap: 6,
      marginBottom: 4,
    },
    emptyText: { fontSize: 13, fontWeight: "500" },

    // 7-day blocks
    summaryBlocksRow: { flexDirection: "row", gap: 6, marginTop: 10, marginBottom: 4 },
    summaryBlock: {
      flex: 1,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: ink,
      padding: 8,
      shadowColor: ink,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 2,
    },
    summaryBlockLabel: { color: "#fff", fontSize: 8, fontWeight: "800", letterSpacing: 0.5, marginBottom: 4 },
    summaryBlockValue: { color: "#fff", fontSize: 13, fontWeight: "800" },
    digestLabel: { fontSize: 10, fontWeight: "800", marginTop: 10, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.7 },
    calloutStrip: { borderWidth: 2, borderRadius: 10, padding: 10, marginTop: 10, gap: 4 },

    legendRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    toggleChip: {
      borderWidth: 2,
      borderColor: ink,
      borderRadius: 20,
      paddingHorizontal: 8,
      paddingVertical: 4,
      shadowColor: ink,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 2,
    },
  });
}
