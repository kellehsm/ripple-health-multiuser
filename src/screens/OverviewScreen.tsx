import React, { useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from "react-native";
import * as Haptics from "expo-haptics";
import Svg, { Rect, Text as SvgText, Polyline, Line, Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../theme/ThemeContext";
import { api } from "../api/client";
import { USER_ID } from "../api/config";

const INK = "#111111";

// ─── Types ───────────────────────────────────────────────────────────────────

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
  type: "mood" | "spend" | "meal" | "glucose_spike";
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

function stepsDisplay(steps: WeeklyDigest["steps"]): string {
  const total = steps.this_week.toLocaleString();
  if (steps.last_week === 0) return total + " steps";
  const pct = Math.round(((steps.this_week - steps.last_week) / steps.last_week) * 100);
  return total + " steps · " + (pct >= 0 ? "↑" : "↓") + Math.abs(pct) + "% vs prior week";
}

function hobbiesDisplay(h: WeeklyDigest["hobbies"]): string {
  const s = h.this_week_sessions;
  const label = s === 1 ? "1 session" : s + " sessions";
  const diff = s - h.last_week_sessions;
  if (diff === 0) return label + " · same as last week";
  return label + " · " + (diff > 0 ? "↑" : "↓") + Math.abs(diff) + " vs last week";
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
    const gap = t - new Date(before.recorded_at).getTime();
    return gap <= 20 * 60 * 1000 ? Number(before.mg_dl) : null;
  }
  const bt = new Date(before.recorded_at).getTime();
  const at = new Date(after.recorded_at).getTime();
  const frac = (t - bt) / (at - bt);
  return Number(before.mg_dl) + frac * (Number(after.mg_dl) - Number(before.mg_dl));
}

function glucoseY(val: number, minVal: number, maxVal: number): number {
  const usableH = CHART_H - PAD_T - PAD_B;
  return PAD_T + usableH - ((val - minVal) / (maxVal - minVal)) * usableH;
}

function eventX(t: number, windowStart: number, windowEnd: number): number {
  const usableW = CHART_W - PAD_L;
  return PAD_L + ((t - windowStart) / (windowEnd - windowStart)) * usableW;
}

function computeCallout(events: DayEvent[], glucose: GlucoseReading[]): string | null {
  if (glucose.length === 0) return null;
  const meals = events.filter((e) => e.type === "meal");
  for (const meal of meals) {
    const mealT = new Date(meal.time).getTime();
    const baseline = interpolateGlucose(glucose, mealT);
    if (baseline === null) continue;
    const postMeal = glucose.filter((r) => {
      const rt = new Date(r.recorded_at).getTime();
      return rt > mealT && rt <= mealT + 90 * 60 * 1000;
    });
    if (postMeal.length === 0) continue;
    const peak = Math.max(...postMeal.map((r) => Number(r.mg_dl)));
    if (peak - baseline >= 20) {
      return "Glucose rose after " + meal.label.toLowerCase() + " today — worth watching";
    }
  }
  return null;
}

function weekGlucoseAvg(glucose_by_tod: WeeklyDigest["glucose_by_tod"]): number | null {
  let totalWeighted = 0;
  let totalCount = 0;
  for (const v of Object.values(glucose_by_tod)) {
    if (v) { totalWeighted += v.avg * v.count; totalCount += v.count; }
  }
  return totalCount > 0 ? Math.round(totalWeighted / totalCount) : null;
}

// ─── Weekly correlation chart constants ──────────────────────────────────────
const CORR_W = SCREEN_W - 64;
const CORR_H = 90;
const BAR_W = Math.floor((CORR_W / 7) * 0.35);
const STEP = CORR_W / 7;

function buildGlanceSummary(
  patternEvents: PatternEvent[],
  dayGlucose: GlucoseReading[],
  todayEntries: JournalEntry[],
): string {
  const clauses: string[] = [];
  const mealCount = patternEvents.filter(e => e.type === "meal").length;
  if (mealCount > 0) clauses.push(mealCount + (mealCount === 1 ? " meal logged" : " meals logged"));
  const moodCount = todayEntries.filter(e => e.entry_type !== "moment").length;
  if (moodCount > 0) clauses.push(moodCount === 1 ? "mood checked in" : moodCount + " mood check-ins");
  if (dayGlucose.length >= 3) {
    const inRange = dayGlucose.filter(r => r.mg_dl >= 70 && r.mg_dl <= 180).length;
    const pct = inRange / dayGlucose.length;
    if (pct >= 0.8) clauses.push("glucose mostly in range");
    else if (pct < 0.4) clauses.push("glucose running high");
  }
  const spendEvents = patternEvents.filter(e => e.type === "spend");
  if (spendEvents.length > 0) {
    let total = 0;
    for (const e of spendEvents) {
      const m = e.label.match(/\$(\d+(?:\.\d+)?)/);
      if (m) total += parseFloat(m[1]);
    }
    if (total > 0) clauses.push("$" + Math.round(total) + " spent");
  }
  return clauses.slice(0, 4).join(" · ");
}

// ─── Component ───────────────────────────────────────────────────────────────

export function OverviewScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();

  const [todayEntries, setTodayEntries] = useState<JournalEntry[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyDay[]>([]);
  const [patternEvents, setPatternEvents] = useState<PatternEvent[]>([]);
  const [digest, setDigest] = useState<WeeklyDigest | null>(null);
  const [dayGlucose, setDayGlucose] = useState<GlucoseReading[]>([]);
  const [dayEvents, setDayEvents] = useState<DayEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [activePicker, setActivePicker] = useState<Bucket | "moment" | null>(null);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [pendingNote, setPendingNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [correlation, setCorrelation] = useState<"sleep" | "spend">("sleep");
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [streak, setStreak] = useState(0);
  const [recapDismissed, setRecapDismissed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async function () {
    try {
      const today = new Date().toISOString().split("T")[0];
      const [entries, weekly, pattern, dig, day, streakData] = await Promise.all([
        api.journalToday(USER_ID),
        api.weeklyMoodSummary(USER_ID),
        api.pattern(USER_ID),
        api.weeklyDigest(USER_ID),
        api.dayView(USER_ID, today),
        api.streaks(USER_ID),
      ]);
      setTodayEntries(Array.isArray(entries) ? entries : []);
      setWeeklyData(Array.isArray(weekly) ? weekly : []);
      setPatternEvents(Array.isArray(pattern) ? pattern : []);
      setDigest(dig ?? null);
      setStreak(Number(streakData?.meal_streak ?? 0));
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

  const entryPerPeriod: Partial<Record<Bucket, JournalEntry>> = {};
  const momentEntries: JournalEntry[] = [];
  for (const entry of todayEntries) {
    if (entry.entry_type === "moment") {
      momentEntries.push(entry);
      continue;
    }
    const p = (entry.period ?? timeOfDayBucket(new Date(entry.logged_at))) as Bucket;
    entryPerPeriod[p] = entry;
  }

  const currentBucket = timeOfDayBucket(new Date());
  const currentEntry = entryPerPeriod[currentBucket] ?? null;

  async function handleSubmit() {
    if (!pendingLabel || !activePicker) return;
    const score = MOOD_OPTIONS.find((m) => m.label === pendingLabel)?.score;
    if (!score) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSubmitting(true);
    try {
      if (activePicker === "moment") {
        await api.logMoodMoment(USER_ID, score, pendingLabel, pendingNote.trim() || undefined);
      } else {
        await api.upsertPeriodMood(USER_ID, score, activePicker, pendingLabel, pendingNote.trim() || undefined);
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
    const existing = target !== "moment" ? entryPerPeriod[target] : null;
    setActivePicker(target);
    setPendingLabel(existing?.mood_label ?? null);
    setPendingNote(existing?.entry_text ?? "");
  }

  const currentUnlogged = currentEntry === null;

  // Correlation chart helpers
  const maxSpend = Math.max(...weeklyData.map((d) => d.total_spent), 1);
  const maxSleep = Math.max(...weeklyData.map((d) => d.sleep_hours), 8);
  function moodBarH(avg_mood: number | null): number {
    if (avg_mood === null) return 0;
    return ((avg_mood - 1) / 4) * CORR_H;
  }
  function compBarH(day: WeeklyDay): number {
    if (correlation === "sleep") return (day.sleep_hours / maxSleep) * CORR_H;
    return (day.total_spent / maxSpend) * CORR_H;
  }

  // Glucose chart for Today's pattern
  const glucoseValues = dayGlucose.map((r) => Number(r.mg_dl));
  const minVal = glucoseValues.length ? Math.min(...glucoseValues, 70) - 10 : 60;
  const maxVal = glucoseValues.length ? Math.max(...glucoseValues, 140) + 10 : 200;
  const dayTimes = dayGlucose.map((r) => new Date(r.recorded_at).getTime());
  const windowStart = dayTimes.length ? Math.min(...dayTimes) : Date.now() - 8 * 3600000;
  const windowEnd = dayTimes.length ? Math.max(Math.max(...dayTimes), Date.now()) : Date.now();

  const glucosePoints = dayGlucose.map(function (r) {
    const t = new Date(r.recorded_at).getTime();
    return eventX(t, windowStart, windowEnd) + "," + glucoseY(Number(r.mg_dl), minVal, maxVal);
  }).join(" ");

  const highBandY = glucoseY(180, minVal, maxVal);
  const lowBandY = glucoseY(70, minVal, maxVal);
  const usableH = CHART_H - PAD_T - PAD_B;

  const callout = computeCallout(dayEvents, dayGlucose);
  const visibleEvents = showAllEvents ? patternEvents : patternEvents.slice(0, 5);
  const hasMoreEvents = patternEvents.length > 5;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.page }]}>
        <ActivityIndicator color={theme.teal.bar} />
      </View>
    );
  }

  const isWeekStart = new Date().getDay() === 1;
  const showRecap = isWeekStart && !recapDismissed && digest !== null;

  // 7-day summary data for solid blocks
  const glucoseAvg = digest ? weekGlucoseAvg(digest.glucose_by_tod) : null;

  return (
    <ScrollView
      style={{ backgroundColor: theme.page }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.teal.bar} />}
    >
      {/* Greeting */}
      <Text style={[styles.greeting, { color: theme.textStrong }]}>
        {greetingPrefix()}, Kelly
      </Text>

      {(() => {
        const summary = buildGlanceSummary(patternEvents, dayGlucose, todayEntries);
        return summary ? (
          <Text style={[styles.glanceSummary, { color: theme.textSoft }]}>{summary}</Text>
        ) : null;
      })()}

      {/* Streak pill badge */}
      {streak >= 3 ? (
        <View style={{ flexDirection: "row", marginBottom: 8 }}>
          <View style={styles.streakPill}>
            <Text style={styles.streakPillText}>🔥 {streak} DAY STREAK</Text>
          </View>
        </View>
      ) : null}

      {/* Trends card */}
      <Pressable
        onPress={function () { navigation.getParent()?.navigate("Trends"); }}
        style={[styles.card, { backgroundColor: theme.violet.tint }]}
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

      {/* Weekly recap (Mon only) */}
      {showRecap && digest ? (
        <View style={[styles.card, { backgroundColor: theme.teal.tint }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text style={[styles.cardTitle, { color: theme.teal.fg }]}>Your week</Text>
            <Pressable onPress={() => setRecapDismissed(true)}>
              <Ionicons name="close" size={16} color={theme.teal.fg} />
            </Pressable>
          </View>
          {digest.steps.this_week > 0 ? (
            <Text style={{ color: theme.teal.fg, fontSize: 13 }}>
              {digest.steps.this_week.toLocaleString()} steps
              {digest.steps.last_week > 0 ? (
                digest.steps.this_week >= digest.steps.last_week ? " · up from last week" : " · fewer than last week"
              ) : ""}
            </Text>
          ) : null}
          {digest.hobbies.this_week_sessions > 0 ? (
            <Text style={{ color: theme.teal.fg, fontSize: 13, marginTop: 3 }}>
              {digest.hobbies.this_week_sessions} hobby session{digest.hobbies.this_week_sessions === 1 ? "" : "s"}
            </Text>
          ) : null}
          {digest.meal_flags.length > 0 ? (
            <Text style={{ color: theme.teal.fg, fontSize: 12, marginTop: 3, opacity: 0.8 }}>
              {digest.meal_flags.length} meal note{digest.meal_flags.length === 1 ? "" : "s"} worth reviewing
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* ── Mood check-in card (coral-tint background) ── */}
      <View style={[styles.card, { backgroundColor: theme.coral.tint }]}>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, { color: theme.coral.fg }]}>Mood check-in</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {currentUnlogged ? (
              <View style={styles.dueNowPill}>
                <Text style={styles.dueNowText}>DUE NOW</Text>
              </View>
            ) : null}
            <Pressable
              onPress={function () { openPicker("moment"); }}
              style={styles.momentBtn}
            >
              <Ionicons name="add" size={13} color={INK} />
              <Text style={styles.momentBtnText}>MOMENT</Text>
            </Pressable>
          </View>
        </View>

        {/* Period status tiles — white bordered */}
        <View style={styles.periodRow}>
          {BUCKET_ORDER.map(function (b) {
            const entry = entryPerPeriod[b];
            const isNow = b === currentBucket;
            return (
              <Pressable
                key={b}
                onPress={function () { openPicker(b); }}
                style={[
                  styles.periodTile,
                  {
                    backgroundColor: "#ffffff",
                    borderColor: isNow && !entry ? theme.coral.solid : INK,
                    borderWidth: isNow && !entry ? 2.5 : 2,
                  },
                ]}
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

        {/* Mood picker */}
        {activePicker !== null ? (
          <View style={[styles.pickerBox, { backgroundColor: "#ffffff" }]}>
            <Text style={{ color: theme.textSoft, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
              {activePicker === "moment"
                ? "Log a moment"
                : (BUCKET_LABEL[activePicker as Bucket] + (entryPerPeriod[activePicker as Bucket] ? " — update" : ""))}
            </Text>

            {/* Emoji mood tiles */}
            <View style={styles.moodOptionsRow}>
              {MOOD_OPTIONS.map(function (opt) {
                const selected = pendingLabel === opt.label;
                const c = (theme as any)[opt.colorKey];
                return (
                  <Pressable
                    key={opt.label}
                    onPress={function () { setPendingLabel(opt.label); }}
                    style={[
                      styles.moodTile,
                      {
                        backgroundColor: selected ? c.tint : "#ffffff",
                        borderColor: selected ? c.solid : INK,
                        borderWidth: selected ? 2.5 : 2,
                      },
                    ]}
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
            />

            <View style={styles.pickerActions}>
              <Pressable
                onPress={function () { setActivePicker(null); setPendingLabel(null); setPendingNote(""); }}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>CANCEL</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                disabled={pendingLabel === null || submitting}
                style={[
                  styles.logBtn,
                  { backgroundColor: pendingLabel !== null ? theme.coral.solid : theme.cardBorder, opacity: pendingLabel === null ? 0.5 : 1 },
                ]}
              >
                {submitting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.logBtnText}>LOG</Text>
                }
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Moment entries today */}
        {momentEntries.length > 0 ? (
          <View style={{ marginTop: 8, gap: 4 }}>
            {momentEntries.map(function (e) {
              return (
                <Text key={e.id} style={{ color: theme.coral.fg, fontSize: 12 }}>
                  {fmtTime(e.logged_at)} · {SCORE_EMOJI[e.mood_score] ?? ""} {e.mood_label ?? String(e.mood_score)}
                  {e.entry_text ? " — " + e.entry_text : ""}
                </Text>
              );
            })}
          </View>
        ) : null}
      </View>

      {/* ── 7-day review (4 solid-color summary blocks) ── */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.textStrong }]}>7-day review</Text>

        {digest ? (
          <>
            {/* 4 solid-color summary blocks */}
            <View style={styles.summaryBlocksRow}>
              {/* STEPS — teal solid */}
              <View style={[styles.summaryBlock, { backgroundColor: theme.teal.solid }]}>
                <Text style={styles.summaryBlockLabel}>STEPS</Text>
                <Text style={styles.summaryBlockValue}>{digest.steps.this_week.toLocaleString()}</Text>
              </View>
              {/* GLUCOSE — berry solid */}
              <View style={[styles.summaryBlock, { backgroundColor: theme.berry.solid }]}>
                <Text style={styles.summaryBlockLabel}>GLUCOSE</Text>
                <Text style={styles.summaryBlockValue}>{glucoseAvg !== null ? glucoseAvg + " avg" : "--"}</Text>
              </View>
              {/* HOBBIES — purple solid */}
              <View style={[styles.summaryBlock, { backgroundColor: theme.purple.solid }]}>
                <Text style={styles.summaryBlockLabel}>HOBBIES</Text>
                <Text style={styles.summaryBlockValue}>{digest.hobbies.this_week_sessions} sess.</Text>
              </View>
              {/* MEALS — coral solid */}
              <View style={[styles.summaryBlock, { backgroundColor: theme.coral.solid }]}>
                <Text style={styles.summaryBlockLabel}>MEAL NOTES</Text>
                <Text style={styles.summaryBlockValue}>
                  {digest.meal_flags.length === 0 ? "All clear" : digest.meal_flags.length + " flagged"}
                </Text>
              </View>
            </View>

            {/* Glucose by time-of-day */}
            {["morning", "afternoon", "evening"].some((b) => digest.glucose_by_tod[b]) ? (
              <>
                <Text style={[styles.digestLabel, { color: theme.textSoft }]}>Glucose by time</Text>
                <View style={styles.todRow}>
                  {(["morning", "afternoon", "evening"] as const).map(function (b) {
                    const data = digest.glucose_by_tod[b];
                    if (!data) return null;
                    return (
                      <View key={b} style={[styles.todChip, { backgroundColor: theme.berry.tint, borderColor: INK }]}>
                        <Text style={{ color: theme.berry.fg, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 }}>{b.slice(0, 3).toUpperCase()}</Text>
                        <Text style={{ color: theme.berry.fg, fontSize: 17, fontWeight: "800" }}>{data.avg}</Text>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : null}

            {/* Heart rate line */}
            <Text style={[styles.digestLabel, { color: theme.textSoft }]}>Heart rate</Text>
            <Text style={{ color: theme.textStrong, fontSize: 13, marginBottom: 4, fontWeight: "600" }}>
              {digest.heart_rate.has_data
                ? "Resting " + digest.heart_rate.resting + " · Peak " + digest.heart_rate.peak + " bpm"
                : "No data yet"}
            </Text>

            <Text style={[styles.digestLabel, { color: theme.textSoft }]}>Steps</Text>
            <Text style={{ color: theme.textStrong, fontSize: 13, marginBottom: 4, fontWeight: "600" }}>{stepsDisplay(digest.steps)}</Text>

            <Text style={[styles.digestLabel, { color: theme.textSoft }]}>Hobbies</Text>
            <Text style={{ color: theme.textStrong, fontSize: 13, fontWeight: "600" }}>{hobbiesDisplay(digest.hobbies)}</Text>

            {/* Callout strip for flags */}
            {(digest.meal_flags.length > 0 || digest.spending_spikes.length > 0) ? (
              <View style={[styles.calloutStrip, { backgroundColor: theme.coral.tint, borderColor: INK }]}>
                {digest.meal_flags.map((f, i) => (
                  <Text key={"mf" + i} style={{ color: theme.coral.fg, fontSize: 12 }}>🍽 {f.label}</Text>
                ))}
                {digest.spending_spikes.map((s, i) => (
                  <Text key={"ss" + i} style={{ color: theme.purple.fg, fontSize: 12 }}>$ {s.label}</Text>
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <ActivityIndicator size="small" color={theme.teal.bar} style={{ alignSelf: "flex-start", marginTop: 4 }} />
        )}
      </View>

      {/* ── 7-day mood/sleep/spend correlation ── */}
      {weeklyData.length > 0 ? (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.textStrong }]}>7-day mood pattern</Text>
          <Text style={{ color: theme.textSoft, fontSize: 11, marginBottom: 8 }}>
            Same days shown side by side — draw your own conclusions.
          </Text>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.violet.solid }]} />
              <Text style={{ color: theme.textSoft, fontSize: 11 }}>Mood (1–5)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: correlation === "sleep" ? theme.amber.solid : theme.purple.solid }]} />
              <Text style={{ color: theme.textSoft, fontSize: 11 }}>
                {correlation === "sleep" ? "Sleep (hrs)" : "Spending ($)"}
              </Text>
            </View>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={function () { setCorrelation(correlation === "sleep" ? "spend" : "sleep"); }}
              style={styles.toggleChip}
            >
              <Text style={{ color: INK, fontSize: 10, fontWeight: "800", letterSpacing: 0.4 }}>
                VS {correlation === "sleep" ? "SPENDING" : "SLEEP"}
              </Text>
            </Pressable>
          </View>
          <Svg width={CORR_W} height={CORR_H + 20} style={{ marginTop: 8 }}>
            {weeklyData.map(function (day, i) {
              const mH = moodBarH(day.avg_mood);
              const cH = compBarH(day);
              const groupX = i * STEP;
              const moodX = groupX + STEP / 2 - BAR_W - 1;
              const compX = groupX + STEP / 2 + 1;
              const compColor = correlation === "sleep" ? theme.amber.solid : theme.purple.solid;
              return (
                <React.Fragment key={day.date}>
                  {mH > 0
                    ? <Rect x={moodX} y={CORR_H - mH} width={BAR_W} height={mH} fill={theme.violet.solid} rx={3} />
                    : <Rect x={moodX} y={CORR_H - 2} width={BAR_W} height={2} fill={theme.cardBorder} rx={1} />}
                  {cH > 0
                    ? <Rect x={compX} y={CORR_H - cH} width={BAR_W} height={cH} fill={compColor} rx={3} />
                    : <Rect x={compX} y={CORR_H - 2} width={BAR_W} height={2} fill={theme.cardBorder} rx={1} />}
                  <SvgText x={groupX + STEP / 2} y={CORR_H + 14} fontSize={10} fill={theme.textSoft} textAnchor="middle">
                    {fmtDayLabel(day.date)}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
        </View>
      ) : null}

      {/* ── Today's pattern — glucose curve with event markers ── */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.textStrong }]}>Today's pattern</Text>

        {dayGlucose.length > 0 ? (
          <>
            <Svg width={CHART_W} height={CHART_H} style={{ marginBottom: 6 }}>
              {/* Target range band with dashed ink border */}
              <Rect
                x={PAD_L}
                y={highBandY}
                width={CHART_W - PAD_L}
                height={lowBandY - highBandY}
                fill={theme.berry.tint}
                opacity={0.4}
                stroke={INK}
                strokeWidth={1}
                strokeDasharray="5,5"
              />
              <SvgText x={PAD_L - 3} y={highBandY + 4} fontSize={8} fill={theme.textSoft} textAnchor="end">180</SvgText>
              <SvgText x={PAD_L - 3} y={lowBandY + 4} fontSize={8} fill={theme.textSoft} textAnchor="end">70</SvgText>

              {/* Glucose — double stroke */}
              {glucosePoints ? (
                <>
                  <Polyline points={glucosePoints} fill="none" stroke={INK} strokeWidth={3.5} />
                  <Polyline points={glucosePoints} fill="none" stroke={theme.berry.bar} strokeWidth={2} />
                </>
              ) : null}

              {/* Event markers — bordered circles */}
              {dayEvents.map(function (ev, i) {
                const t = new Date(ev.time).getTime();
                if (t < windowStart || t > windowEnd) return null;
                const x = eventX(t, windowStart, windowEnd);
                const gVal = interpolateGlucose(dayGlucose, t);
                const y = gVal !== null ? glucoseY(gVal, minVal, maxVal) : PAD_T + usableH;

                const markerText = ev.type === "spend" ? "$"
                  : ev.type === "mood" && ev.mood_score ? SCORE_EMOJI[ev.mood_score] ?? "·"
                  : ev.type === "mood" ? "·"
                  : "M";

                const markerBg = ev.type === "meal" ? theme.coral.tint
                  : ev.type === "spend" ? theme.purple.tint
                  : theme.violet.tint;

                return (
                  <React.Fragment key={i}>
                    <Circle cx={x} cy={y} r={9} fill={markerBg} stroke={INK} strokeWidth={2} />
                    <SvgText x={x} y={y + 4} fontSize={8} fill={INK} textAnchor="middle" fontWeight="bold">
                      {markerText}
                    </SvgText>
                  </React.Fragment>
                );
              })}
            </Svg>

            {/* Legend */}
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.berry.bar, borderWidth: 1.5, borderColor: INK }]} />
                <Text style={{ color: theme.textSoft, fontSize: 10 }}>Glucose</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.coral.tint, borderWidth: 1.5, borderColor: INK }]} />
                <Text style={{ color: theme.textSoft, fontSize: 10 }}>Meal</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.violet.tint, borderWidth: 1.5, borderColor: INK }]} />
                <Text style={{ color: theme.textSoft, fontSize: 10 }}>Mood</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.purple.tint, borderWidth: 1.5, borderColor: INK }]} />
                <Text style={{ color: theme.textSoft, fontSize: 10 }}>Spend</Text>
              </View>
            </View>

            {callout ? (
              <View style={[styles.calloutBox, { backgroundColor: theme.coral.tint, borderColor: INK }]}>
                <Text style={{ color: theme.coral.fg, fontSize: 12, fontWeight: "600" }}>{callout}</Text>
              </View>
            ) : null}
          </>
        ) : (
          <Text style={{ color: theme.textSoft, fontSize: 12, marginBottom: 8 }}>
            No glucose data yet today.
          </Text>
        )}

        {/* Chronological event feed */}
        {patternEvents.length === 0 ? (
          <Text style={{ color: theme.textSoft, fontSize: 12, marginTop: 4 }}>
            No events logged today yet.
          </Text>
        ) : (
          <>
            {visibleEvents.map(function (ev, i) {
              const dotColor = ev.type === "mood" ? theme.violet.solid
                : ev.type === "spend" ? theme.purple.solid
                : ev.type === "meal" ? theme.coral.solid
                : ev.type === "glucose_spike" ? theme.red.solid
                : theme.textSoft;
              return (
                <View key={i} style={styles.timelineRow}>
                  <Text style={[styles.timelineTime, { color: theme.textSoft }]}>{fmtTime(ev.time)}</Text>
                  <View style={[styles.timelineDot, { backgroundColor: dotColor }]} />
                  <Text style={{ color: theme.textStrong, fontSize: 13, flex: 1, fontWeight: "500" }} numberOfLines={1}>
                    {ev.label}
                  </Text>
                </View>
              );
            })}
            {hasMoreEvents ? (
              <Pressable onPress={function () { setShowAllEvents(!showAllEvents); }} style={styles.showMoreBtn}>
                <Text style={{ color: theme.textSoft, fontSize: 12 }}>
                  {showAllEvents ? "Show less" : "Show all " + patternEvents.length + " events"}
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  greeting: { fontSize: 22, fontWeight: "800", marginBottom: 4 },
  glanceSummary: { fontSize: 13, marginBottom: 10, marginTop: 2 },

  streakPill: {
    backgroundColor: "#3FA0A6",
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
    shadowColor: INK,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  streakPillText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },

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
  cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  cardTitle: { fontSize: 19, fontWeight: "800" },

  dueNowPill: {
    backgroundColor: "#E8654E",
    borderWidth: 2,
    borderColor: INK,
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
    borderColor: INK,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#ffffff",
    shadowColor: INK,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  momentBtnText: { fontSize: 9, fontWeight: "800", color: INK, letterSpacing: 0.4 },

  periodRow: { flexDirection: "row", gap: 6 },
  periodTile: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
    gap: 1,
    shadowColor: INK,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  periodLabel: { fontSize: 9, fontWeight: "800", color: INK, letterSpacing: 0.5 },

  pickerBox: {
    marginTop: 12,
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 12,
    padding: 12,
    shadowColor: INK,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  moodOptionsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 10 },
  moodTile: {
    flex: 1,
    minWidth: 56,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    shadowColor: INK,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  moodTileLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },

  noteInput: {
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    marginBottom: 10,
    backgroundColor: "#ffffff",
    shadowColor: INK,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  pickerActions: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  cancelBtn: {
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
    shadowColor: INK,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  cancelBtnText: { color: INK, fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },
  logBtn: {
    borderRadius: 10,
    borderWidth: 2,
    borderColor: INK,
    paddingHorizontal: 20,
    paddingVertical: 8,
    minWidth: 60,
    alignItems: "center",
    shadowColor: INK,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  logBtnText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },

  digestLabel: { fontSize: 10, fontWeight: "800", marginTop: 10, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.7 },

  summaryBlocksRow: { flexDirection: "row", gap: 6, marginTop: 10, marginBottom: 4 },
  summaryBlock: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: INK,
    padding: 8,
    shadowColor: INK,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  summaryBlockLabel: { color: "#fff", fontSize: 8, fontWeight: "800", letterSpacing: 0.5, marginBottom: 4 },
  summaryBlockValue: { color: "#fff", fontSize: 13, fontWeight: "800" },

  calloutStrip: {
    borderWidth: 2,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    gap: 4,
  },

  todRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 4 },
  todChip: {
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
    shadowColor: INK,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },

  legendRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  toggleChip: {
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#ffffff",
    shadowColor: INK,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },

  calloutBox: { borderWidth: 2, borderRadius: 10, padding: 10, marginTop: 8, marginBottom: 4 },

  timelineRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  timelineTime: { fontSize: 12, width: 38 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: INK },
  showMoreBtn: { paddingTop: 6 },
});
