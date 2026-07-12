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
} from "react-native";
import Svg, { Rect, Text as SvgText } from "react-native-svg";
import { useTheme } from "../theme/ThemeContext";
import { api } from "../api/client";
import { USER_ID } from "../api/config";

type JournalEntry = {
  id: string;
  logged_at: string;
  mood_score: number;
  entry_text: string | null;
};

type PatternEvent = {
  time: string;
  type: "mood" | "spend" | "meal" | "glucose_spike";
  label: string;
};

type WeeklyDay = {
  date: string;
  avg_mood: number | null;
  sleep_hours: number;
  total_spent: number;
};

type Bucket = "morning" | "afternoon" | "evening" | "night";

const BUCKET_ORDER: Bucket[] = ["morning", "afternoon", "evening", "night"];
const BUCKET_LABEL: Record<Bucket, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
};

function timeOfDayBucket(date: Date): Bucket {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 16) return "afternoon";
  if (hour >= 16 && hour < 21) return "evening";
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
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return h + ":" + m;
}

function fmtDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()];
}

const SCREEN_W = Dimensions.get("window").width;
const CHART_W = SCREEN_W - 64;
const CHART_H = 90;
const BAR_W = Math.floor((CHART_W / 7) * 0.35);
const STEP = CHART_W / 7;

const EVENT_COLORS: Record<string, string> = {
  mood: "#A5401F",
  spend: "#6F4518",
  meal: "#8A5A0C",
  glucose_spike: "#A32D2D",
};

export function OverviewScreen() {
  const { theme } = useTheme();
  const [todayEntries, setTodayEntries] = useState<JournalEntry[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyDay[]>([]);
  const [patternEvents, setPatternEvents] = useState<PatternEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingScore, setPendingScore] = useState<number | null>(null);
  const [pendingNote, setPendingNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [correlation, setCorrelation] = useState<"sleep" | "spend">("sleep");

  const load = useCallback(async function () {
    try {
      const [entries, weekly, pattern] = await Promise.all([
        api.journalToday(USER_ID),
        api.weeklyMoodSummary(USER_ID),
        api.pattern(USER_ID),
      ]);
      setTodayEntries(Array.isArray(entries) ? entries : []);
      setWeeklyData(Array.isArray(weekly) ? weekly : []);
      setPatternEvents(Array.isArray(pattern) ? pattern : []);
    } catch (e) {
      console.error("Overview load failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(function () { load(); }, [load]);

  const currentBucket = timeOfDayBucket(new Date());

  // Latest entry per bucket (entries are ASC so later ones overwrite)
  const latestPerBucket: Partial<Record<Bucket, JournalEntry>> = {};
  for (const entry of todayEntries) {
    const b = timeOfDayBucket(new Date(entry.logged_at));
    latestPerBucket[b] = entry;
  }
  const currentEntry = latestPerBucket[currentBucket] ?? null;

  async function handleSubmit() {
    if (pendingScore === null) return;
    setSubmitting(true);
    try {
      await api.logMood(USER_ID, pendingScore, pendingNote.trim() || undefined);
      setPendingScore(null);
      setPendingNote("");
      await load();
    } catch (e) {
      console.error("Failed to log mood", e);
    } finally {
      setSubmitting(false);
    }
  }

  // Correlation chart helpers
  const maxSpend = Math.max(...weeklyData.map((d) => d.total_spent), 1);
  const maxSleep = Math.max(...weeklyData.map((d) => d.sleep_hours), 8);

  function moodBarH(avg_mood: number | null): number {
    if (avg_mood === null) return 0;
    return ((avg_mood - 1) / 4) * CHART_H;
  }
  function compBarH(day: WeeklyDay): number {
    if (correlation === "sleep") return (day.sleep_hours / maxSleep) * CHART_H;
    return (day.total_spent / maxSpend) * CHART_H;
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.page }]}>
        <ActivityIndicator color={theme.teal.bar} />
      </View>
    );
  }

  const showPrompt = currentEntry === null || pendingScore !== null;

  return (
    <ScrollView style={{ backgroundColor: theme.page }} contentContainerStyle={styles.content}>
      <Text style={[styles.greeting, { color: theme.textStrong }]}>
        {greetingPrefix()}, Kelly
      </Text>

      {/* Mood check-in card */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Text style={[styles.cardTitle, { color: theme.textStrong }]}>
          {BUCKET_LABEL[currentBucket]} mood
        </Text>

        {/* Day-at-a-glance summary */}
        <View style={styles.bucketRow}>
          {BUCKET_ORDER.map(function (b) {
            const e = latestPerBucket[b];
            const isNow = b === currentBucket;
            return (
              <Text
                key={b}
                style={[
                  styles.bucketChip,
                  {
                    color: isNow ? theme.coral.fg : theme.textSoft,
                    fontWeight: isNow ? "600" : "400",
                  },
                ]}
              >
                {BUCKET_LABEL[b].slice(0, 3)}: {e ? String(e.mood_score) : "—"}
              </Text>
            );
          })}
        </View>

        {showPrompt ? (
          <>
            <Text style={[styles.promptLabel, { color: theme.textSoft }]}>
              {currentEntry ? "Update your " + BUCKET_LABEL[currentBucket].toLowerCase() + " mood:" : "How are you feeling?"}
            </Text>
            <View style={styles.scoreRow}>
              {[1, 2, 3, 4, 5].map(function (n) {
                const selected = pendingScore === n;
                return (
                  <Pressable
                    key={n}
                    onPress={function () { setPendingScore(n); }}
                    style={[
                      styles.scoreButton,
                      {
                        backgroundColor: selected ? theme.coral.sub : theme.page,
                        borderColor: selected ? theme.coral.sub : theme.cardBorder,
                      },
                    ]}
                  >
                    <Text style={{ color: selected ? "#fff" : theme.textSoft, fontSize: 16, fontWeight: "600" }}>
                      {n}
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
              style={[
                styles.noteInput,
                { color: theme.textStrong, borderColor: theme.cardBorder, backgroundColor: theme.page },
              ]}
            />

            <View style={styles.submitRow}>
              {currentEntry ? (
                <Pressable
                  onPress={function () { setPendingScore(null); setPendingNote(""); }}
                  style={[styles.cancelButton, { borderColor: theme.cardBorder }]}
                >
                  <Text style={{ color: theme.textSoft, fontSize: 13 }}>Cancel</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={handleSubmit}
                disabled={pendingScore === null || submitting}
                style={[
                  styles.logButton,
                  {
                    backgroundColor: pendingScore !== null ? theme.coral.sub : theme.cardBorder,
                    opacity: pendingScore === null ? 0.5 : 1,
                  },
                ]}
              >
                {submitting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>Log</Text>
                }
              </Pressable>
            </View>
          </>
        ) : (
          <Pressable
            onPress={function () {
              setPendingScore(currentEntry.mood_score);
              setPendingNote(currentEntry.entry_text ?? "");
            }}
            style={[styles.loggedState, { backgroundColor: theme.coral.bg }]}
          >
            <View style={styles.loggedRow}>
              <Text style={[styles.loggedScore, { color: theme.coral.fg }]}>
                {currentEntry.mood_score} / 5
              </Text>
              <Text style={{ color: theme.coral.sub, fontSize: 12 }}>Tap to update</Text>
            </View>
            {currentEntry.entry_text ? (
              <Text style={{ color: theme.coral.fg, fontSize: 13, marginTop: 4 }}>
                {currentEntry.entry_text}
              </Text>
            ) : null}
          </Pressable>
        )}
      </View>

      {/* Today's pattern timeline */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Text style={[styles.cardTitle, { color: theme.textStrong }]}>Today's pattern</Text>
        {patternEvents.length === 0 ? (
          <Text style={{ color: theme.textSoft, fontSize: 12, marginTop: 8 }}>
            No events logged today yet.
          </Text>
        ) : (
          patternEvents.map(function (ev, i) {
            const dotColor = EVENT_COLORS[ev.type] ?? theme.textSoft;
            return (
              <View key={i} style={styles.timelineRow}>
                <Text style={[styles.timelineTime, { color: theme.textSoft }]}>
                  {fmtTime(ev.time)}
                </Text>
                <View style={[styles.timelineDot, { backgroundColor: dotColor }]} />
                <Text style={{ color: theme.textStrong, fontSize: 13, flex: 1 }} numberOfLines={1}>
                  {ev.label}
                </Text>
              </View>
            );
          })
        )}
      </View>

      {/* Weekly correlation view */}
      {weeklyData.length > 0 ? (
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: theme.textStrong }]}>7-day patterns</Text>
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
              <Text style={{ color: theme.textSoft, fontSize: 11 }}>
                vs {correlation === "sleep" ? "Spending" : "Sleep"}
              </Text>
            </Pressable>
          </View>

          <Svg width={CHART_W} height={CHART_H + 20} style={{ marginTop: 8 }}>
            {weeklyData.map(function (day, i) {
              const mH = moodBarH(day.avg_mood);
              const cH = compBarH(day);
              const groupX = i * STEP;
              const moodX = groupX + STEP / 2 - BAR_W - 1;
              const compX = groupX + STEP / 2 + 1;
              const compColor = correlation === "sleep" ? theme.blue.sub : theme.green.sub;

              return (
                <React.Fragment key={day.date}>
                  {mH > 0 ? (
                    <Rect
                      x={moodX}
                      y={CHART_H - mH}
                      width={BAR_W}
                      height={mH}
                      fill={theme.coral.sub}
                      rx={3}
                    />
                  ) : (
                    <Rect x={moodX} y={CHART_H - 2} width={BAR_W} height={2} fill={theme.cardBorder} rx={1} />
                  )}
                  {cH > 0 ? (
                    <Rect
                      x={compX}
                      y={CHART_H - cH}
                      width={BAR_W}
                      height={cH}
                      fill={compColor}
                      rx={3}
                    />
                  ) : (
                    <Rect x={compX} y={CHART_H - 2} width={BAR_W} height={2} fill={theme.cardBorder} rx={1} />
                  )}
                  <SvgText
                    x={groupX + STEP / 2}
                    y={CHART_H + 14}
                    fontSize={10}
                    fill={theme.textSoft}
                    textAnchor="middle"
                  >
                    {fmtDayLabel(day.date)}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  greeting: { fontSize: 20, fontWeight: "600", marginBottom: 4 },
  card: { borderRadius: 14, borderWidth: 0.5, padding: 16 },
  cardTitle: { fontSize: 14, fontWeight: "500", marginBottom: 10 },
  bucketRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  bucketChip: { fontSize: 12 },
  promptLabel: { fontSize: 12, marginBottom: 8 },
  scoreRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  scoreButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: 10,
  },
  submitRow: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  cancelButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  logButton: {
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 7,
    minWidth: 52,
    alignItems: "center",
  },
  loggedState: { borderRadius: 12, padding: 12, marginTop: 4 },
  loggedRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  loggedScore: { fontSize: 22, fontWeight: "500" },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 },
  timelineTime: { fontSize: 12, width: 38 },
  timelineDot: { width: 8, height: 8, borderRadius: 4 },
  correlationNote: { fontSize: 11, marginBottom: 8 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  toggleChip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
});
