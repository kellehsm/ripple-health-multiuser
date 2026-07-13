import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import Svg, { Rect, Text as SvgText, Polyline, Line, Circle, Path } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { api } from "../api/client";
import { USER_ID } from "../api/config";

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
  { score: 5, label: "Great", emoji: "😃", colorKey: "green" as const },
  { score: 4, label: "Good",  emoji: "🙂", colorKey: "teal"  as const },
  { score: 3, label: "Okay",  emoji: "😐", colorKey: "amber" as const },
  { score: 2, label: "Low",   emoji: "😕", colorKey: "coral" as const },
  { score: 1, label: "Bad",   emoji: "😣", colorKey: "red"   as const },
];

const TOD_BG: Record<string, string> = {
  morning: "#F5D89A", afternoon: "#B9E9D6", evening: "#F2BBD1", night: "#B9DBF7",
};
const TOD_FG: Record<string, string> = {
  morning: "#8A5A0C", afternoon: "#149D74", evening: "#993556", night: "#185FA5",
};

const SCREEN_W = Dimensions.get("window").width;
const CHART_W = SCREEN_W - 64; // inside card with 16px padding each side
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

// Interpolate glucose value at a given timestamp from sorted readings.
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
    // Only extrapolate forward up to 20 minutes
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

// Single-day callout: did glucose rise after a meal?
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

// ─── Chart constants for weekly correlation ──────────────────────────────────
const CORR_W = SCREEN_W - 64;
const CORR_H = 90;
const BAR_W = Math.floor((CORR_W / 7) * 0.35);
const STEP = CORR_W / 7;

const EVENT_COLORS: Record<string, string> = {
  mood: "#A5401F", spend: "#6F4518", meal: "#8A5A0C", glucose_spike: "#A32D2D",
};

// ─── Component ───────────────────────────────────────────────────────────────

export function OverviewScreen() {
  const { theme } = useTheme();

  const [todayEntries, setTodayEntries] = useState<JournalEntry[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyDay[]>([]);
  const [patternEvents, setPatternEvents] = useState<PatternEvent[]>([]);
  const [digest, setDigest] = useState<WeeklyDigest | null>(null);
  const [dayGlucose, setDayGlucose] = useState<GlucoseReading[]>([]);
  const [dayEvents, setDayEvents] = useState<DayEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Mood picker state
  const [activePicker, setActivePicker] = useState<Bucket | "moment" | null>(null);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [pendingNote, setPendingNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [correlation, setCorrelation] = useState<"sleep" | "spend">("sleep");
  const [showAllEvents, setShowAllEvents] = useState(false);

  const load = useCallback(async function () {
    try {
      const today = new Date().toISOString().split("T")[0];
      const [entries, weekly, pattern, dig, day] = await Promise.all([
        api.journalToday(USER_ID),
        api.weeklyMoodSummary(USER_ID),
        api.pattern(USER_ID),
        api.weeklyDigest(USER_ID),
        api.dayView(USER_ID, today),
      ]);
      setTodayEntries(Array.isArray(entries) ? entries : []);
      setWeeklyData(Array.isArray(weekly) ? weekly : []);
      setPatternEvents(Array.isArray(pattern) ? pattern : []);
      setDigest(dig ?? null);
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

  useEffect(function () { load(); }, [load]);

  // Build period → entry map (use `period` field when set, fall back to derived bucket)
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
  const pendingScore = MOOD_OPTIONS.find((m) => m.label === pendingLabel)?.score ?? null;

  async function handleSubmit() {
    if (!pendingLabel || !activePicker) return;
    const score = MOOD_OPTIONS.find((m) => m.label === pendingLabel)?.score;
    if (!score) return;
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

  // Mood card: badge if current period has no entry
  const currentUnlogged = currentEntry === null;

  // Weekly correlation chart helpers
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

  // Glucose chart for "Today's pattern"
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

  return (
    <ScrollView style={{ backgroundColor: theme.page }} contentContainerStyle={styles.content}>
      <Text style={[styles.greeting, { color: theme.textStrong }]}>
        {greetingPrefix()}, Kelly
      </Text>

      {/* ── Mood check-in card ── */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, { color: theme.textStrong }]}>
            Mood check-in
            {currentUnlogged ? (
              <Text style={{ color: theme.coral.sub }}> ●</Text>
            ) : null}
          </Text>
          {/* Off-cycle moment button */}
          <Pressable
            onPress={function () { openPicker("moment"); }}
            style={[styles.momentBtn, { borderColor: theme.cardBorder }]}
          >
            <Ionicons name="add" size={14} color={theme.textSoft} />
            <Text style={{ color: theme.textSoft, fontSize: 11 }}>Moment</Text>
          </Pressable>
        </View>

        {/* Period status row — all tappable */}
        <View style={styles.periodRow}>
          {BUCKET_ORDER.map(function (b) {
            const entry = entryPerPeriod[b];
            const isNow = b === currentBucket;
            const bg = entry ? TOD_BG[b] : isNow ? theme.page : theme.page;
            const border = isNow && !entry ? theme.coral.sub : theme.cardBorder;
            return (
              <Pressable
                key={b}
                onPress={function () { openPicker(b); }}
                style={[styles.periodChip, { backgroundColor: bg, borderColor: border }]}
              >
                <Text style={{ color: TOD_FG[b], fontSize: 10, fontWeight: "500" }}>
                  {BUCKET_LABEL[b].slice(0, 3)}
                </Text>
                <Text style={{ color: entry ? TOD_FG[b] : theme.textSoft, fontSize: 12, fontWeight: entry ? "600" : "400" }}>
                  {entry ? (entry.mood_label ?? String(entry.mood_score)) : (isNow ? "tap" : "—")}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Active mood picker */}
        {activePicker !== null ? (
          <View style={[styles.pickerBox, { backgroundColor: theme.page, borderColor: theme.cardBorder }]}>
            <Text style={{ color: theme.textSoft, fontSize: 12, marginBottom: 8 }}>
              {activePicker === "moment"
                ? "Log a moment"
                : (BUCKET_LABEL[activePicker] + (entryPerPeriod[activePicker] ? " — update" : ""))}
            </Text>

            {/* Named mood buttons */}
            <View style={styles.moodOptionsRow}>
              {MOOD_OPTIONS.map(function (opt) {
                const selected = pendingLabel === opt.label;
                const c = (theme as any)[opt.colorKey];
                return (
                  <Pressable
                    key={opt.label}
                    onPress={function () { setPendingLabel(opt.label); }}
                    style={[
                      styles.moodOption,
                      { backgroundColor: selected ? c.bg : theme.page, borderColor: selected ? c.sub : theme.cardBorder },
                    ]}
                  >
                    <Text style={{ fontSize: 22, marginBottom: 2 }}>{opt.emoji}</Text>
                    <Text style={{ color: selected ? c.fg : theme.textSoft, fontSize: 12, fontWeight: selected ? "600" : "400" }}>
                      {opt.label}
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
              style={[styles.noteInput, { color: theme.textStrong, borderColor: theme.cardBorder, backgroundColor: theme.card }]}
            />

            <View style={styles.pickerActions}>
              <Pressable
                onPress={function () { setActivePicker(null); setPendingLabel(null); setPendingNote(""); }}
                style={[styles.cancelBtn, { borderColor: theme.cardBorder }]}
              >
                <Text style={{ color: theme.textSoft, fontSize: 13 }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                disabled={pendingLabel === null || submitting}
                style={[styles.logBtn, {
                  backgroundColor: pendingLabel !== null ? theme.coral.sub : theme.cardBorder,
                  opacity: pendingLabel === null ? 0.5 : 1,
                }]}
              >
                {submitting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>Log</Text>
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
                <Text key={e.id} style={{ color: theme.textSoft, fontSize: 12 }}>
                  {fmtTime(e.logged_at)} · {e.mood_label ?? String(e.mood_score)}
                  {e.entry_text ? " — " + e.entry_text : ""}
                </Text>
              );
            })}
          </View>
        ) : null}
      </View>

      {/* ── 7-day review ── */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Text style={[styles.cardTitle, { color: theme.textStrong }]}>7-day review</Text>

        {digest ? (
          <>
            <Text style={[styles.digestLabel, { color: theme.textSoft }]}>Glucose (time of day)</Text>
            <View style={styles.todRow}>
              {(["morning", "afternoon", "evening"] as const).map(function (b) {
                const data = digest.glucose_by_tod[b];
                if (!data) return null;
                return (
                  <View key={b} style={[styles.todChip, { backgroundColor: TOD_BG[b] }]}>
                    <Text style={{ color: TOD_FG[b], fontSize: 10, fontWeight: "500" }}>{BUCKET_LABEL[b].slice(0, 3)}</Text>
                    <Text style={{ color: TOD_FG[b], fontSize: 15, fontWeight: "600" }}>{data.avg}</Text>
                  </View>
                );
              })}
              {!["morning", "afternoon", "evening"].some((b) => digest.glucose_by_tod[b]) ? (
                <Text style={{ color: theme.textSoft, fontSize: 12 }}>No glucose data this week</Text>
              ) : null}
            </View>

            {digest.meal_flags.length > 0 ? (
              <>
                <Text style={[styles.digestLabel, { color: theme.textSoft }]}>Meals</Text>
                {digest.meal_flags.map((f, i) => (
                  <Text key={i} style={[styles.flagLine, { color: theme.textStrong }]}>· {f.label}</Text>
                ))}
              </>
            ) : null}

            {digest.spending_spikes.length > 0 ? (
              <>
                <Text style={[styles.digestLabel, { color: theme.textSoft }]}>Spending</Text>
                {digest.spending_spikes.map((s, i) => (
                  <Text key={i} style={[styles.flagLine, { color: theme.textStrong }]}>· {s.label}</Text>
                ))}
              </>
            ) : null}

            <Text style={[styles.digestLabel, { color: theme.textSoft }]}>Heart rate</Text>
            <Text style={{ color: theme.textStrong, fontSize: 13, marginBottom: 4 }}>
              {digest.heart_rate.has_data
                ? "Resting " + digest.heart_rate.resting + " · Peak " + digest.heart_rate.peak + " bpm"
                : "No data yet — monitor not connected"}
            </Text>

            <Text style={[styles.digestLabel, { color: theme.textSoft }]}>Steps</Text>
            <Text style={{ color: theme.textStrong, fontSize: 13, marginBottom: 4 }}>{stepsDisplay(digest.steps)}</Text>

            <Text style={[styles.digestLabel, { color: theme.textSoft }]}>Hobbies</Text>
            <Text style={{ color: theme.textStrong, fontSize: 13 }}>{hobbiesDisplay(digest.hobbies)}</Text>
          </>
        ) : (
          <ActivityIndicator size="small" color={theme.teal.bar} style={{ alignSelf: "flex-start", marginTop: 4 }} />
        )}
      </View>

      {/* ── 7-day mood/sleep/spend correlation ── */}
      {weeklyData.length > 0 ? (
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: theme.textStrong }]}>7-day mood pattern</Text>
          <Text style={[styles.correlationNote, { color: theme.textSoft }]}>
            Same days shown side by side — draw your own conclusions.
          </Text>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.coral.sub }]} />
              <Text style={{ color: theme.textSoft, fontSize: 11 }}>Mood (1–5)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: correlation === "sleep" ? theme.blue.sub : theme.green.sub }]} />
              <Text style={{ color: theme.textSoft, fontSize: 11 }}>
                {correlation === "sleep" ? "Sleep (hrs)" : "Spending ($)"}
              </Text>
            </View>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={function () { setCorrelation(correlation === "sleep" ? "spend" : "sleep"); }}
              style={[styles.toggleChip, { borderColor: theme.cardBorder }]}
            >
              <Text style={{ color: theme.textSoft, fontSize: 11 }}>vs {correlation === "sleep" ? "Spending" : "Sleep"}</Text>
            </Pressable>
          </View>
          <Svg width={CORR_W} height={CORR_H + 20} style={{ marginTop: 8 }}>
            {weeklyData.map(function (day, i) {
              const mH = moodBarH(day.avg_mood);
              const cH = compBarH(day);
              const groupX = i * STEP;
              const moodX = groupX + STEP / 2 - BAR_W - 1;
              const compX = groupX + STEP / 2 + 1;
              const compColor = correlation === "sleep" ? theme.blue.sub : theme.green.sub;
              return (
                <React.Fragment key={day.date}>
                  {mH > 0
                    ? <Rect x={moodX} y={CORR_H - mH} width={BAR_W} height={mH} fill={theme.coral.sub} rx={3} />
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
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Text style={[styles.cardTitle, { color: theme.textStrong }]}>Today's pattern</Text>

        {/* Glucose chart with event markers */}
        {dayGlucose.length > 0 ? (
          <>
            <Svg width={CHART_W} height={CHART_H} style={{ marginBottom: 6 }}>
              {/* Target range band (70-180) */}
              <Rect
                x={PAD_L}
                y={highBandY}
                width={CHART_W - PAD_L}
                height={lowBandY - highBandY}
                fill={theme.teal.bg}
                opacity={0.35}
              />
              {/* Range boundary lines */}
              <Line x1={PAD_L} x2={CHART_W} y1={highBandY} y2={highBandY} stroke={theme.teal.sub} strokeDasharray="3,3" strokeWidth={0.5} opacity={0.6} />
              <Line x1={PAD_L} x2={CHART_W} y1={lowBandY} y2={lowBandY} stroke={theme.teal.sub} strokeDasharray="3,3" strokeWidth={0.5} opacity={0.6} />
              {/* Y axis labels */}
              <SvgText x={PAD_L - 3} y={highBandY + 4} fontSize={8} fill={theme.textSoft} textAnchor="end">180</SvgText>
              <SvgText x={PAD_L - 3} y={lowBandY + 4} fontSize={8} fill={theme.textSoft} textAnchor="end">70</SvgText>
              {/* Glucose line */}
              {glucosePoints ? (
                <Polyline points={glucosePoints} fill="none" stroke={theme.teal.bar} strokeWidth={2} />
              ) : null}
              {/* Event markers */}
              {dayEvents.map(function (ev, i) {
                const t = new Date(ev.time).getTime();
                if (t < windowStart || t > windowEnd) return null;
                const x = eventX(t, windowStart, windowEnd);
                const gVal = interpolateGlucose(dayGlucose, t);
                const y = gVal !== null ? glucoseY(gVal, minVal, maxVal) : PAD_T + usableH;
                const isMoment = ev.type === "mood" && ev.entry_type === "moment";
                const color = ev.type === "meal" ? theme.amber.sub
                  : ev.type === "spend" ? theme.green.sub
                  : theme.coral.sub;
                return (
                  <React.Fragment key={i}>
                    {isMoment ? (
                      <Circle cx={x} cy={y} r={6} fill={theme.page} stroke={theme.coral.sub} strokeWidth={2} />
                    ) : (
                      <Circle cx={x} cy={y} r={5} fill={color} opacity={0.9} />
                    )}
                    <SvgText x={x} y={y - 9} fontSize={8} fill={color} textAnchor="middle">
                      {ev.type === "meal" ? "M" : ev.type === "spend" ? "$" : ev.type === "mood" ? "♥" : ""}
                    </SvgText>
                  </React.Fragment>
                );
              })}
            </Svg>

            {/* Legend */}
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.teal.bar }]} />
                <Text style={{ color: theme.textSoft, fontSize: 10 }}>Glucose</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.amber.sub }]} />
                <Text style={{ color: theme.textSoft, fontSize: 10 }}>Meal</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.coral.sub }]} />
                <Text style={{ color: theme.textSoft, fontSize: 10 }}>Mood</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.green.sub }]} />
                <Text style={{ color: theme.textSoft, fontSize: 10 }}>Spend</Text>
              </View>
            </View>

            {/* Single-day callout */}
            {callout ? (
              <View style={[styles.calloutBox, { backgroundColor: theme.amber.bg, borderColor: theme.amber.sub }]}>
                <Text style={{ color: theme.amber.fg, fontSize: 12 }}>{callout}</Text>
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
              const dotColor = EVENT_COLORS[ev.type] ?? theme.textSoft;
              const isMoment = ev.type === "mood" && ev.entry_type === "moment";
              return (
                <View key={i} style={styles.timelineRow}>
                  <Text style={[styles.timelineTime, { color: theme.textSoft }]}>{fmtTime(ev.time)}</Text>
                  <View style={[
                    styles.timelineDot,
                    { backgroundColor: isMoment ? "transparent" : dotColor, borderWidth: isMoment ? 1.5 : 0, borderColor: dotColor },
                  ]} />
                  <Text style={{ color: theme.textStrong, fontSize: 13, flex: 1 }} numberOfLines={1}>
                    {ev.label}{isMoment ? " ·" : ""}
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
  greeting: { fontSize: 20, fontWeight: "600", marginBottom: 4 },
  card: { borderRadius: 14, borderWidth: 0.5, padding: 16 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  cardTitle: { fontSize: 14, fontWeight: "500" },
  momentBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  periodRow: { flexDirection: "row", gap: 6 },
  periodChip: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 8, alignItems: "center", gap: 2 },
  pickerBox: { marginTop: 10, borderWidth: 0.5, borderRadius: 12, padding: 12 },
  moodOptionsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 10 },
  moodOption: { flex: 1, minWidth: 60, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  noteInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, marginBottom: 10 },
  pickerActions: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  cancelBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  logBtn: { borderRadius: 8, paddingHorizontal: 20, paddingVertical: 7, minWidth: 52, alignItems: "center" },
  digestLabel: { fontSize: 11, fontWeight: "500", marginTop: 10, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 },
  flagLine: { fontSize: 13, marginBottom: 2 },
  todRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  todChip: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignItems: "center" },
  correlationNote: { fontSize: 11, marginBottom: 8 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  toggleChip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  timelineTime: { fontSize: 12, width: 38 },
  timelineDot: { width: 8, height: 8, borderRadius: 4 },
  showMoreBtn: { paddingTop: 6 },
  calloutBox: { borderWidth: 0.5, borderRadius: 10, padding: 10, marginTop: 8, marginBottom: 4 },
});
