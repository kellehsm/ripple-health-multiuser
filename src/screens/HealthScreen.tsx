import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, Dimensions, Platform, Alert, RefreshControl } from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import Svg, { Polyline, Line, Text as SvgText, Rect, Circle } from "react-native-svg";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { useTheme } from "../theme/ThemeContext";
import { onSolid } from "../theme/colorUtils";
import { Ionicons } from "@expo/vector-icons";
import { MetricCard } from "../components/MetricCard";
import { api } from "../api/client";

import { requestHealthPermissions, syncHealthData } from "../lib/healthConnect";
import {
  startForegroundService,
  stopForegroundService,
  isForegroundServiceRunning,
} from "../lib/foregroundService";
import * as IntentLauncher from "expo-intent-launcher";

type GlucoseReading = {
  recorded_at: string;
  mg_dl: number;
};

type HRReading = {
  recorded_at: string;
  bpm: number;
};

type GlucoseStatus = {
  hasData: boolean;
  mg_dl: number | null;
  arrow: string | null;
  delta: number | null;
  isStale: boolean;
  minutesSinceReading: number | null;
  alerts: string[];
};

const RANGE_OPTIONS = [3, 6, 12, 24];
const SCREEN_WIDTH = Dimensions.get("window").width;
const CHART_WIDTH = SCREEN_WIDTH - 64;
const CARD_GAP = 10;
const HALF_CARD_WIDTH = (SCREEN_WIDTH - 32 - CARD_GAP) / 2;
const CHART_HEIGHT = 200;
const PAD_LEFT = 32;
const PAD_BOTTOM = 20;
const PAD_TOP = 14;

function buildPoints(readings: GlucoseReading[], windowStart: number, windowEnd: number, minVal: number, maxVal: number): string {
  const usableWidth = CHART_WIDTH - PAD_LEFT;
  const usableHeight = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const windowMs = windowEnd - windowStart;

  return readings
    .map(function (r: GlucoseReading) {
      const t = new Date(r.recorded_at).getTime();
      const x = PAD_LEFT + ((t - windowStart) / windowMs) * usableWidth;
      const y = PAD_TOP + usableHeight - ((Number(r.mg_dl) - minVal) / (maxVal - minVal)) * usableHeight;
      return x + "," + y;
    })
    .join(" ");
}

function getTimeTicks(windowStart: number, windowEnd: number, rangeHours: number): Array<{ t: number; label: string }> {
  const intervalMins = rangeHours <= 3 ? 15 : rangeHours <= 6 ? 30 : rangeHours <= 12 ? 60 : 120;
  const intervalMs = intervalMins * 60 * 1000;
  const showMins = rangeHours <= 6;
  const ticks: Array<{ t: number; label: string }> = [];
  for (let t = Math.ceil(windowStart / intervalMs) * intervalMs; t <= windowEnd; t += intervalMs) {
    const d = new Date(t);
    const h = d.getHours();
    const m = d.getMinutes();
    const ap = h >= 12 ? "p" : "a";
    const h12 = h % 12 || 12;
    ticks.push({ t, label: showMins ? `${h12}:${String(m).padStart(2, "0")}${ap}` : `${h12}${ap}` });
  }
  return ticks;
}

const WATER_GOAL = 8;

function formatSleepDuration(start: string, end: string): string {
  const totalMins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m > 0 ? h + "h " + m + "m" : h + "h";
}

function sumTodayLogs(logs: Array<{ logged_at: string; value: number }>): number {
  const today = new Date().toDateString();
  return logs
    .filter((l) => new Date(l.logged_at).toDateString() === today)
    .reduce((sum, l) => sum + Number(l.value), 0);
}

export function HealthScreen() {
  const themeCtx = useTheme();
  const theme = themeCtx.theme;
  const mode = themeCtx.mode;
  const ink = theme.ink;
  const card = theme.card;
  const styles = useMemo(() => makeStyles(ink, card), [ink, card]);
  const navigation = useNavigation<any>();
  const [rangeHours, setRangeHours] = useState(6);
  const [todayReadings, setTodayReadings] = useState<GlucoseReading[]>([]);
  const [yesterdayReadings, setYesterdayReadings] = useState<GlucoseReading[]>([]);
  const [status, setStatus] = useState<GlucoseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [waterMetricId, setWaterMetricId] = useState<string | null>(null);
  const [waterCount, setWaterCount] = useState<number | null>(null);
  const [waterStatLine, setWaterStatLine] = useState<string | null>(null);
  const [stepsCount, setStepsCount] = useState<number | null>(null);
  const [stepsWeekTotal, setStepsWeekTotal] = useState<number | null>(null);
  const [stepsMetricId, setStepsMetricId] = useState<string | null>(null);
  const [weekStepsStart, setWeekStepsStart] = useState(1);
  const [sleepDisplay, setSleepDisplay] = useState<string | null>(null);
  const [sleepStatLine, setSleepStatLine] = useState<string | null>(null);
  const [hrRangeHours, setHrRangeHours] = useState(6);
  const [hrReadings, setHrReadings] = useState<HRReading[]>([]);
  const [hrLoading, setHrLoading] = useState(false);
  const [hcSyncing, setHcSyncing] = useState(false);
  const [hcResult, setHcResult] = useState<string | null>(null);
  const [liveTracking, setLiveTracking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Glucose chart scrubbing
  const [scrubInfo, setScrubInfo] = useState<{
    px: number;
    time: string;
    todayVal: number | null;
    yestVal: number | null;
    delta: number | null;
  } | null>(null);
  // Ref holds latest chart data for the stable gesture callbacks
  const scrubCtx = useRef({
    todayReadings: [] as GlucoseReading[],
    yesterdayReadings: [] as GlucoseReading[],
    windowStart: 0,
    windowEnd: 0,
  });
  const lastSnappedRef = useRef<string | null>(null);

  const loadStepsAndSleep = useCallback(async function () {
    const _now = new Date();
    const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}-${String(_now.getDate()).padStart(2, "0")}`;
    try {
      const s = await api.stepsToday(today);
      setStepsCount(s?.steps ?? null);
    } catch (e) {
      console.error("Failed to load steps", e);
    }
    try {
      const stepsList = await api.getStepsMetric();
      if (stepsList && stepsList.length > 0) {
        setStepsMetricId(stepsList[0].id);
        const settings = await api.getSettings().catch(() => null);
        const wsd = settings?.week_start?.steps ?? 1;
        setWeekStepsStart(wsd);
        const weekly = await api.stepsWeeklyTotal(stepsList[0].id, wsd);
        setStepsWeekTotal(weekly?.week_total ?? null);
      }
    } catch (_) {}
    try {
      const session = await api.sleepToday(today);
      if (session?.start_time && session?.end_time) {
        setSleepDisplay(formatSleepDuration(session.start_time, session.end_time));
      } else {
        setSleepDisplay(null);
      }
    } catch (e) {
      console.error("Failed to load sleep", e);
    }
    try {
      const stats = await api.sleepStats();
      const fmt = (s: number) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        return m > 0 ? h + "h " + m + "m" : h + "h";
      };
      const yest = stats?.yesterday_seconds > 0 ? fmt(stats.yesterday_seconds) : "--";
      const avg = stats?.seven_day_average_seconds > 0 ? fmt(stats.seven_day_average_seconds) : "--";
      setSleepStatLine("Yesterday: " + yest + " · 7d avg: " + avg);
    } catch (e) {
      console.error("Failed to load sleep stats", e);
    }
  }, []);

  const loadWater = useCallback(async function () {
    try {
      const metric = await api.getOrCreateWaterMetric();
      setWaterMetricId(metric.id);
      const logs = await api.todaysWaterCount(metric.id);
      setWaterCount(sumTodayLogs(Array.isArray(logs) ? logs : []));
      try {
        const stats = await api.waterStats(metric.id);
        const yest = stats?.yesterday_total > 0 ? stats.yesterday_total + " glasses" : "--";
        const avg = stats?.seven_day_average > 0 ? Math.round(stats.seven_day_average) + " glasses" : "--";
        setWaterStatLine("Yesterday: " + yest + " · 7d avg: " + avg);
      } catch (_) {}
    } catch (e) {
      console.error("Failed to load water data", e);
    }
  }, []);

  const loadHeartRate = useCallback(async function (hours: number) {
    setHrLoading(true);
    try {
      const now = new Date();
      const start = new Date(now.getTime() - hours * 60 * 60 * 1000);
      const readings = await api.heartRateRange(start.toISOString(), now.toISOString());
      setHrReadings(Array.isArray(readings) ? readings : []);
    } catch (e) {
      console.error("Failed to load heart rate", e);
    } finally {
      setHrLoading(false);
    }
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([load(rangeHours), loadWater(), loadStepsAndSleep(), loadHeartRate(hrRangeHours)]);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleLogWater() {
    if (!waterMetricId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await api.logWater(waterMetricId);
      const logs = await api.todaysWaterCount(waterMetricId);
      setWaterCount(sumTodayLogs(Array.isArray(logs) ? logs : []));
    } catch (e) {
      console.error("Failed to log water", e);
    }
  }

  async function handleToggleLiveTracking() {
    try {
      if (liveTracking) {
        await stopForegroundService();
        setLiveTracking(false);
      } else {
        const granted = await requestHealthPermissions();
        if (!granted) {
          Alert.alert("Permission required", "Health Connect permission is needed for live tracking.");
          return;
        }
        await startForegroundService();
        setLiveTracking(true);
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to toggle live tracking.");
    }
  }

  function handleBatteryOptimization() {
    IntentLauncher.startActivityAsync(
      "android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
      { data: "package:com.kellehs.wellness" }
    ).catch(() => {
      Alert.alert("Unavailable", "Could not open battery settings on this device.");
    });
  }

  async function handleHealthConnectSync() {
    setHcSyncing(true);
    setHcResult(null);
    try {
      const granted = await requestHealthPermissions();
      if (!granted) {
        setHcResult("Permission denied by Health Connect.");
        return;
      }
      const result = await syncHealthData();
      const parts: string[] = [];
      if (result.steps !== null) parts.push(result.steps.toLocaleString() + " steps");
      if (result.sleepHours !== null) parts.push(result.sleepHours + "h sleep");
      if (result.heartRate !== null) parts.push(result.heartRate + " bpm");
      if (result.errors.length > 0) parts.push("errors: " + result.errors.join(", "));
      setHcResult(parts.length > 0 ? "Synced: " + parts.join(" · ") : "No new data found.");
      await loadStepsAndSleep();
    } catch (e: any) {
      setHcResult("Sync failed: " + (e?.message ?? "unknown error"));
    } finally {
      setHcSyncing(false);
    }
  }

  const load = useCallback(function (hours: number) {
    setLoading(true);
    const now = Date.now();
    const windowMs = hours * 60 * 60 * 1000;
    const dayMs = 24 * 60 * 60 * 1000;

    const todayStart = new Date(now - windowMs).toISOString();
    const todayEnd = new Date(now).toISOString();
    const yestStart = new Date(now - windowMs - dayMs).toISOString();
    const yestEnd = new Date(now - dayMs).toISOString();

    Promise.all([
      api.glucoseRange(todayStart, todayEnd),
      api.glucoseRange(yestStart, yestEnd),
      api.glucoseStatus(),
    ])
      .then(function (results) {
        const todayData = results[0];
        const yestData = results[1];
        const statusData = results[2];

        setTodayReadings(Array.isArray(todayData) ? todayData : []);
        const yestArray = Array.isArray(yestData) ? yestData : [];
        setYesterdayReadings(
          yestArray.map(function (r: GlucoseReading) {
            return Object.assign({}, r, {
              recorded_at: new Date(new Date(r.recorded_at).getTime() + dayMs).toISOString(),
            });
          })
        );
        setStatus(statusData);
      })
      .catch(function (e) {
        console.error("Failed to load glucose data", e);
      })
      .finally(function () {
        setLoading(false);
      });
  }, []);

  // Stable scrub callbacks — read fresh data from scrubCtx ref, never stale
  const onScrub = useCallback(function (x: number) {
    const ctx = scrubCtx.current;
    if (ctx.todayReadings.length === 0) return;

    const clampedX = Math.max(PAD_LEFT, Math.min(x, CHART_WIDTH));
    const frac = (clampedX - PAD_LEFT) / (CHART_WIDTH - PAD_LEFT);
    const t = ctx.windowStart + frac * (ctx.windowEnd - ctx.windowStart);
    const windowMs = ctx.windowEnd - ctx.windowStart;
    const usableW = CHART_WIDTH - PAD_LEFT;

    let bestToday: GlucoseReading | null = null;
    let bestTodayDiff = Infinity;
    let snappedPx = clampedX;
    for (const r of ctx.todayReadings) {
      const rt = new Date(r.recorded_at).getTime();
      const diff = Math.abs(rt - t);
      if (diff < bestTodayDiff) {
        bestTodayDiff = diff;
        bestToday = r;
        snappedPx = PAD_LEFT + ((rt - ctx.windowStart) / windowMs) * usableW;
      }
    }

    let bestYest: GlucoseReading | null = null;
    let bestYestDiff = Infinity;
    for (const r of ctx.yesterdayReadings) {
      const rt = new Date(r.recorded_at).getTime(); // already shifted +24h
      const diff = Math.abs(rt - t);
      if (diff < bestYestDiff) {
        bestYestDiff = diff;
        bestYest = r;
      }
    }

    const todayVal = bestToday ? Number(bestToday.mg_dl) : null;
    const yestVal = bestYest ? Number(bestYest.mg_dl) : null;
    const delta = todayVal !== null && yestVal !== null ? todayVal - yestVal : null;

    const d = bestToday ? new Date(bestToday.recorded_at) : new Date();
    const h = d.getHours(), m = d.getMinutes();
    const h12 = h % 12 || 12;
    const timeStr = `${h12}:${String(m).padStart(2, "0")}${h >= 12 ? "pm" : "am"}`;

    if (bestToday && bestToday.recorded_at !== lastSnappedRef.current) {
      lastSnappedRef.current = bestToday.recorded_at;
      Haptics.selectionAsync().catch(() => {});
    }

    setScrubInfo({ px: snappedPx, time: timeStr, todayVal, yestVal, delta });
  }, []);

  const onScrubEnd = useCallback(function () {
    setScrubInfo(null);
    lastSnappedRef.current = null;
  }, []);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-5, 5])
        .onUpdate((e) => { runOnJS(onScrub)(e.x); })
        .onEnd(() => { runOnJS(onScrubEnd)(); }),
    [onScrub, onScrubEnd]
  );

  useEffect(function () {
    load(rangeHours);
    const interval = setInterval(function () {
      load(rangeHours);
    }, 5 * 60 * 1000);
    return function () {
      clearInterval(interval);
    };
  }, [load, rangeHours]);

  useEffect(function () { loadWater(); }, [loadWater]);
  useEffect(function () { loadStepsAndSleep(); }, [loadStepsAndSleep]);
  useEffect(function () {
    isForegroundServiceRunning().then(setLiveTracking).catch(() => {});
  }, []);
  useEffect(function () { loadHeartRate(hrRangeHours); }, [loadHeartRate, hrRangeHours]);

  const now = Date.now();
  const windowStart = now - rangeHours * 60 * 60 * 1000;
  const allValues = todayReadings.concat(yesterdayReadings).map(function (r) {
    return Number(r.mg_dl);
  });
  const minVal = allValues.length ? Math.min.apply(null, allValues.concat([70])) - 10 : 60;
  const maxVal = allValues.length ? Math.max.apply(null, allValues.concat([180])) + 10 : 200;

  const todayPoints = buildPoints(todayReadings, windowStart, now, minVal, maxVal);
  const yesterdayPoints = buildPoints(yesterdayReadings, windowStart, now, minVal, maxVal);

  // Keep gesture callback ref in sync with latest render values
  scrubCtx.current = { todayReadings, yesterdayReadings, windowStart, windowEnd: now };

  const chartInnerHeight = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const highY = PAD_TOP + chartInnerHeight - ((180 - minVal) / (maxVal - minVal)) * chartInnerHeight;
  const lowY = PAD_TOP + chartInnerHeight - ((70 - minVal) / (maxVal - minVal)) * chartInnerHeight;

  const GRID_STEP = 20;
  const gridValues: number[] = [];
  for (let v = Math.ceil(minVal / GRID_STEP) * GRID_STEP; v <= maxVal; v += GRID_STEP) {
    gridValues.push(v);
  }

  const peak = todayReadings.length > 0
    ? Math.max.apply(null, todayReadings.map(function (r) { return Number(r.mg_dl); }))
    : null;

  return (
    <ScrollView
      style={{ backgroundColor: theme.page }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.teal.bar} />}
    >
      {/* Mindfulness button */}
      <Pressable
        onPress={() => navigation.getParent()?.navigate("Mindfulness")}
        style={{
          borderRadius: 14,
          borderWidth: 2,
          borderColor: ink,
          backgroundColor: theme.purple.solid,
          padding: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          shadowColor: ink,
          shadowOffset: { width: 4, height: 4 },
          shadowOpacity: 1,
          shadowRadius: 0,
          elevation: 4,
        }}
        accessibilityRole="button"
        accessibilityLabel="Open Mindfulness hub"
      >
        <Text style={{ fontSize: 32 }}>🧘</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: onSolid(theme.purple.solid), fontSize: 18, fontWeight: "900", marginBottom: 2 }}>Mindfulness</Text>
          <Text style={{ color: onSolid(theme.purple.solid), fontSize: 12, opacity: 0.75 }}>Breathing · grounding · gratitude</Text>
        </View>
        <Text style={{ color: onSolid(theme.purple.solid), fontSize: 20, fontWeight: "800", opacity: 0.85 }}>›</Text>
      </Pressable>

      {/* 2×2 metric tile grid */}
      <View style={styles.grid}>
        <Pressable
          style={styles.halfCell}
          onPress={() => stepsMetricId && navigation.getParent()?.navigate("StepsDetail", { metricId: stepsMetricId, weekStartDay: weekStepsStart })}
        >
          <MetricCard
            label="Steps"
            value={stepsCount !== null ? stepsCount.toLocaleString() : "--"}
            icon="walk"
            colorKey="teal"
            variant="solid"
            sublabel={stepsWeekTotal !== null ? stepsWeekTotal.toLocaleString() + " this week" : undefined}
          />
        </Pressable>
        <View style={styles.halfCell}>
          <MetricCard
            label="Sleep"
            value={sleepDisplay ?? "--"}
            icon="moon"
            colorKey="amber"
            variant="tint"
            sublabel={sleepStatLine ?? undefined}
          />
        </View>
        <View style={styles.halfCell}>
          <MetricCard
            label="Water"
            value={waterCount !== null ? waterCount + " / " + WATER_GOAL : "-- / " + WATER_GOAL}
            icon="water"
            colorKey="blue"
            variant="tint"
            onAction={handleLogWater}
            sublabel={waterStatLine ?? undefined}
          />
        </View>
        <Pressable
          style={styles.halfCell}
          onPress={() => navigation.getParent()?.navigate("HeartRateDetail")}
        >
          <MetricCard
            label="Heart Rate"
            value={hrReadings.length > 0 ? hrReadings[hrReadings.length - 1].bpm + " bpm" : "--"}
            icon="heart-circle"
            colorKey="berry"
            variant="tint"
          />
        </Pressable>
      </View>

      {/* Glucose alert banner */}
      {status && status.alerts && status.alerts.length > 0 ? (
        <View style={[styles.alertCard, { backgroundColor: theme.red.tint, borderColor: ink }]}>
          {status.alerts.map(function (alert: string, i: number) {
            return (
              <Text key={i} style={{ color: theme.red.fg, fontSize: 13, fontWeight: "700" }}>
                ⚠ {alert}
              </Text>
            );
          })}
        </View>
      ) : null}

      {/* Glucose chart card */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, { color: theme.textStrong }]}>Glucose</Text>
          {peak !== null ? (
            <View style={styles.peakBadge}>
              <Text style={styles.peakBadgeText}>{peak} PEAK</Text>
            </View>
          ) : null}
        </View>

        {/* Range selector buttons */}
        <View style={styles.rangeRow}>
          {RANGE_OPTIONS.map(function (hrs) {
            const active = rangeHours === hrs;
            return (
              <Pressable
                key={hrs}
                onPress={function () { setRangeHours(hrs); }}
                style={[
                  styles.rangeBtn,
                  { backgroundColor: active ? ink : card },
                ]}
              >
                <Text style={[styles.rangeBtnText, { color: active ? "#ffffff" : ink }]}>
                  {hrs}H
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Current reading — solid berry block */}
        {status && status.hasData ? (
          <View style={[styles.glucoseCurrentBox, { backgroundColor: theme.berry.solid }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.glucoseCurrentValue, { color: onSolid(theme.berry.solid) }]}>
                {status.mg_dl}{status.arrow ? " " + status.arrow : ""}
              </Text>
              {status.minutesSinceReading != null ? (
                <Text style={[styles.glucoseMinAgo, { color: onSolid(theme.berry.solid), opacity: 0.8 }]}>
                  {status.minutesSinceReading} min ago
                </Text>
              ) : null}
            </View>
            {status.delta != null ? (
              <View style={styles.deltaBadge}>
                <Text style={[styles.deltaBadgeText, { color: onSolid(theme.berry.solid) }]}>
                  {status.delta > 0 ? "+" : ""}{status.delta}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator style={{ marginVertical: 30 }} />
        ) : todayReadings.length === 0 ? (
          <Text style={{ color: theme.textSoft, fontSize: 12, marginTop: 10 }}>
            No glucose readings in this window yet.
          </Text>
        ) : (
          <GestureDetector gesture={panGesture}>
            <View>
              <Svg width={CHART_WIDTH} height={CHART_HEIGHT} style={{ marginTop: 12 }}>
                {gridValues.map((v) => {
                  const gy = PAD_TOP + chartInnerHeight - ((v - minVal) / (maxVal - minVal)) * chartInnerHeight;
                  return (
                    <React.Fragment key={v}>
                      <Line x1={PAD_LEFT} x2={CHART_WIDTH} y1={gy} y2={gy} stroke={theme.textSoft} strokeDasharray="2,3" strokeWidth={0.5} opacity={0.35} />
                      <SvgText x={PAD_LEFT - 4} y={gy + 4} fontSize={9} fill={theme.textSoft} textAnchor="end">{v}</SvgText>
                    </React.Fragment>
                  );
                })}

                {/* Target range band with dashed ink border */}
                <Rect
                  x={PAD_LEFT}
                  y={highY}
                  width={CHART_WIDTH - PAD_LEFT}
                  height={lowY - highY}
                  fill={mode === "dark" ? theme.berry.sub : theme.berry.tint}
                  opacity={mode === "dark" ? 0.25 : 0.4}
                  stroke={ink}
                  strokeWidth={1}
                  strokeDasharray="5,5"
                />

                {/* Yesterday — dotted, low opacity reference line */}
                {yesterdayPoints.length > 0 ? (
                  <Polyline points={yesterdayPoints} fill="none" stroke={theme.textSoft} strokeWidth={1.5} strokeDasharray="4,4" opacity={0.3} />
                ) : null}

                {/* Today — double stroke: ink outline below, color on top */}
                {todayPoints.length > 0 ? (
                  <>
                    <Polyline points={todayPoints} fill="none" stroke={ink} strokeWidth={3.5} />
                    <Polyline points={todayPoints} fill="none" stroke={theme.berry.bar} strokeWidth={2} />
                  </>
                ) : null}

                {/* X-axis time labels */}
                {getTimeTicks(windowStart, now, rangeHours).map(function ({ t, label }) {
                  const x = PAD_LEFT + ((t - windowStart) / (now - windowStart)) * (CHART_WIDTH - PAD_LEFT);
                  return (
                    <SvgText key={t} x={x} y={CHART_HEIGHT - 4} fontSize={8} fill={theme.textSoft} textAnchor="middle" opacity={0.8}>
                      {label}
                    </SvgText>
                  );
                })}

                {/* Scrub indicator: vertical line + hit dots */}
                {scrubInfo ? (
                  <>
                    <Line
                      x1={scrubInfo.px} x2={scrubInfo.px}
                      y1={PAD_TOP} y2={CHART_HEIGHT - PAD_BOTTOM}
                      stroke={ink} strokeWidth={1} strokeDasharray="3,3" opacity={0.7}
                    />
                    {scrubInfo.todayVal !== null ? (
                      <Circle
                        cx={scrubInfo.px}
                        cy={PAD_TOP + chartInnerHeight - ((scrubInfo.todayVal - minVal) / (maxVal - minVal)) * chartInnerHeight}
                        r={5} fill={theme.berry.bar} stroke={ink} strokeWidth={1.5}
                      />
                    ) : null}
                    {scrubInfo.yestVal !== null ? (
                      <Circle
                        cx={scrubInfo.px}
                        cy={PAD_TOP + chartInnerHeight - ((scrubInfo.yestVal - minVal) / (maxVal - minVal)) * chartInnerHeight}
                        r={4} fill={theme.textSoft} stroke={ink} strokeWidth={1} opacity={0.5}
                      />
                    ) : null}
                  </>
                ) : null}
              </Svg>

              {/* Scrub readout card */}
              {scrubInfo ? (
                <View style={[styles.scrubCard, { backgroundColor: card, borderColor: ink }]}>
                  <Text style={[styles.scrubTime, { color: theme.textSoft }]}>{scrubInfo.time}</Text>
                  <View style={styles.scrubStats}>
                    {scrubInfo.todayVal !== null ? (
                      <View style={styles.scrubStat}>
                        <Text style={[styles.scrubLabel, { color: theme.textSoft }]}>TODAY</Text>
                        <Text style={[styles.scrubVal, { color: theme.berry.sub }]}>{scrubInfo.todayVal}</Text>
                      </View>
                    ) : null}
                    {scrubInfo.yestVal !== null ? (
                      <View style={styles.scrubStat}>
                        <Text style={[styles.scrubLabel, { color: theme.textSoft }]}>YEST</Text>
                        <Text style={[styles.scrubVal, { color: theme.textSoft }]}>{scrubInfo.yestVal}</Text>
                      </View>
                    ) : null}
                    {scrubInfo.delta !== null ? (
                      <View style={styles.scrubStat}>
                        <Text style={[styles.scrubLabel, { color: theme.textSoft }]}>DELTA</Text>
                        <Text style={[styles.scrubVal, { color: scrubInfo.delta > 0 ? theme.red.sub : theme.teal.bar }]}>
                          {scrubInfo.delta > 0 ? "+" : ""}{scrubInfo.delta}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </View>
          </GestureDetector>
        )}

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.berry.bar, borderWidth: 1.5, borderColor: ink }]} />
            <Text style={{ color: theme.textSoft, fontSize: 11 }}>Today</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.textSoft, opacity: 0.4 }]} />
            <Text style={{ color: theme.textSoft, fontSize: 11 }}>Yesterday</Text>
          </View>
        </View>

        {status && status.isStale ? (
          <Text style={{ color: theme.textSoft, fontSize: 11, marginTop: 8 }}>
            Last reading {status.minutesSinceReading} min ago — sensor may be disconnected.
          </Text>
        ) : null}
      </View>

      {/* Heart Rate chart card */}
      {(() => {
        const hrValues = hrReadings.map((r) => r.bpm);
        const hrMin = hrValues.length ? Math.min(...hrValues) - 5 : 40;
        const hrMax = hrValues.length ? Math.max(...hrValues) + 5 : 120;
        const hrRange = hrMax - hrMin || 1;
        const hrNow = Date.now();
        const hrWindowStart = hrNow - hrRangeHours * 60 * 60 * 1000;
        const hrWindowMs = hrRangeHours * 60 * 60 * 1000;
        const usableW = CHART_WIDTH - PAD_LEFT;
        const usableH = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
        const hrPoints = hrReadings.map(function (r) {
          const t = new Date(r.recorded_at).getTime();
          const x = PAD_LEFT + ((t - hrWindowStart) / hrWindowMs) * usableW;
          const y = PAD_TOP + usableH - ((r.bpm - hrMin) / hrRange) * usableH;
          return x + "," + y;
        }).join(" ");
        const restingBpm = hrValues.length ? Math.min(...hrValues) : null;
        const peakBpm = hrValues.length ? Math.max(...hrValues) : null;
        const HR_RANGE_OPTIONS = [3, 6, 12, 24];
        return (
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.cardTitle, { color: theme.textStrong }]}>Heart Rate</Text>
              {peakBpm !== null ? (
                <View style={styles.peakBadge}>
                  <Text style={styles.peakBadgeText}>{peakBpm} PEAK</Text>
                </View>
              ) : null}
            </View>
            {restingBpm !== null ? (
              <Text style={{ color: theme.textSoft, fontSize: 12, marginBottom: 4 }}>
                Resting: {restingBpm} bpm
              </Text>
            ) : null}
            <View style={styles.rangeRow}>
              {HR_RANGE_OPTIONS.map(function (hrs) {
                const active = hrRangeHours === hrs;
                return (
                  <Pressable
                    key={hrs}
                    onPress={function () { setHrRangeHours(hrs); }}
                    style={[styles.rangeBtn, { backgroundColor: active ? ink : card }]}
                  >
                    <Text style={[styles.rangeBtnText, { color: active ? "#ffffff" : ink }]}>{hrs}H</Text>
                  </Pressable>
                );
              })}
            </View>
            {hrLoading ? (
              <ActivityIndicator style={{ marginVertical: 30 }} />
            ) : hrReadings.length === 0 ? (
              <Text style={{ color: theme.textSoft, fontSize: 12, marginTop: 10 }}>
                No heart rate data in this window.
              </Text>
            ) : (
              <Svg width={CHART_WIDTH} height={CHART_HEIGHT} style={{ marginTop: 12 }}>
                {/* Double-stroke HR line */}
                <Polyline points={hrPoints} fill="none" stroke={ink} strokeWidth={3.5} />
                <Polyline points={hrPoints} fill="none" stroke={theme.berry.sub} strokeWidth={2} />
              </Svg>
            )}
          </View>
        );
      })()}

      {/* Health Connect card (Android only) */}
      {Platform.OS === "android" ? (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.textStrong }]}>Health Connect</Text>
          <Pressable
            onPress={handleHealthConnectSync}
            disabled={hcSyncing}
            style={[styles.hcBtn, { backgroundColor: theme.teal.tint }]}
          >
            {hcSyncing
              ? <ActivityIndicator size="small" color={theme.teal.fg} />
              : <Text style={[styles.hcBtnText, { color: theme.teal.fg }]}>SYNC FROM HEALTH CONNECT</Text>
            }
          </Pressable>
          {hcResult ? (
            <Text style={{ color: theme.textSoft, fontSize: 12, marginTop: 8 }}>{hcResult}</Text>
          ) : null}

          <Pressable
            onPress={handleToggleLiveTracking}
            style={[styles.hcBtn, {
              backgroundColor: liveTracking ? theme.coral.tint : theme.blue.tint,
              marginTop: 10,
            }]}
          >
            <Text style={[styles.hcBtnText, { color: liveTracking ? theme.coral.fg : theme.blue.fg }]}>
              {liveTracking ? "STOP LIVE TRACKING" : "START LIVE TRACKING"}
            </Text>
          </Pressable>

          {liveTracking ? (
            <Pressable
              onPress={handleBatteryOptimization}
              style={[styles.hcBtn, { backgroundColor: theme.card, marginTop: 8 }]}
            >
              <Text style={[styles.hcBtnText, { color: theme.textSoft }]}>BATTERY EXEMPTION</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

    </ScrollView>
  );
}

function makeStyles(ink: string, card: string) {
  return StyleSheet.create({
  content: { padding: 16, gap: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: CARD_GAP },
  halfCell: { width: HALF_CARD_WIDTH },
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
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cardTitle: { fontSize: 19, fontWeight: "800" },
  alertCard: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 12,
    gap: 4,
    shadowColor: ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  peakBadge: {
    borderWidth: 2,
    borderColor: ink,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: card,
  },
  peakBadgeText: { fontSize: 10, fontWeight: "800", color: ink, letterSpacing: 0.5 },
  rangeRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  rangeBtn: {
    borderWidth: 2,
    borderColor: ink,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  rangeBtnText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },
  glucoseCurrentBox: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: ink,
    padding: 14,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  glucoseCurrentValue: { fontSize: 26, fontWeight: "800" },
  glucoseMinAgo: { fontSize: 11, marginTop: 2 },
  deltaBadge: {
    borderWidth: 2,
    borderColor: "rgba(128,128,128,0.4)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  deltaBadgeText: { fontSize: 14, fontWeight: "800" },
  legendRow: { flexDirection: "row", gap: 16, marginTop: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  scrubCard: {
    borderRadius: 10, borderWidth: 2, padding: 10, marginTop: 6,
    flexDirection: "row", alignItems: "center", gap: 12,
    shadowColor: ink, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0, elevation: 2,
  },
  scrubTime: { fontSize: 11, minWidth: 44 },
  scrubStats: { flexDirection: "row", gap: 16 },
  scrubStat: { alignItems: "center" },
  scrubLabel: { fontSize: 8, fontWeight: "800", letterSpacing: 0.5 },
  scrubVal: { fontSize: 16, fontWeight: "800", marginTop: 1 },
  hcBtn: {
    borderWidth: 2,
    borderColor: ink,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    shadowColor: ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  hcBtnText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  });
}
