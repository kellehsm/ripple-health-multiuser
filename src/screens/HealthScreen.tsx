import React, { useEffect, useState, useCallback } from "react";
import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, Dimensions, Platform, Alert, RefreshControl } from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import Svg, { Polyline, Line, Text as SvgText, Rect } from "react-native-svg";
import { useTheme } from "../theme/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { MetricCard } from "../components/MetricCard";
import { api } from "../api/client";
import { USER_ID } from "../api/config";
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

  const loadStepsAndSleep = useCallback(async function () {
    const _now = new Date();
    const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}-${String(_now.getDate()).padStart(2, "0")}`;
    try {
      const s = await api.stepsToday(USER_ID, today);
      setStepsCount(s?.steps ?? null);
    } catch (e) {
      console.error("Failed to load steps", e);
    }
    try {
      const stepsList = await api.getStepsMetric(USER_ID);
      if (stepsList && stepsList.length > 0) {
        setStepsMetricId(stepsList[0].id);
        const settings = await api.getSettings(USER_ID).catch(() => null);
        const wsd = settings?.week_start?.steps ?? 1;
        setWeekStepsStart(wsd);
        const weekly = await api.stepsWeeklyTotal(stepsList[0].id, wsd);
        setStepsWeekTotal(weekly?.week_total ?? null);
      }
    } catch (_) {}
    try {
      const session = await api.sleepToday(USER_ID, today);
      if (session?.start_time && session?.end_time) {
        setSleepDisplay(formatSleepDuration(session.start_time, session.end_time));
      } else {
        setSleepDisplay(null);
      }
    } catch (e) {
      console.error("Failed to load sleep", e);
    }
    try {
      const stats = await api.sleepStats(USER_ID);
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
      const metric = await api.getOrCreateWaterMetric(USER_ID);
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
      const readings = await api.heartRateRange(USER_ID, start.toISOString(), now.toISOString());
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
      api.glucoseRange(USER_ID, todayStart, todayEnd),
      api.glucoseRange(USER_ID, yestStart, yestEnd),
      api.glucoseStatus(USER_ID),
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

  const glucoseValue = status && status.hasData ? status.mg_dl + " " + (status.arrow || "") : "--";
  const glucoseSub = status && status.delta != null
    ? (status.delta > 0 ? "+" : "") + status.delta + " from last"
    : undefined;

  return (
    <ScrollView
      style={{ backgroundColor: theme.page }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.teal.bar} />}
    >
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
            sublabel={stepsWeekTotal !== null ? stepsWeekTotal.toLocaleString() + " this week" : undefined}
          />
        </Pressable>
        <View style={styles.halfCell}>
          <MetricCard
            label="Sleep"
            value={sleepDisplay ?? "--"}
            icon="moon"
            colorKey="amber"
            sublabel={sleepStatLine ?? undefined}
          />
        </View>
        <View style={styles.halfCell}>
          <MetricCard
            label="Water"
            value={waterCount !== null ? waterCount + " / " + WATER_GOAL : "-- / " + WATER_GOAL}
            icon="water"
            colorKey="blue"
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
            colorKey="red"
          />
        </Pressable>
        <View style={styles.fullCell}>
          <MetricCard label="Glucose" value={glucoseValue} icon="pulse" colorKey="berry" sublabel={glucoseSub} />
        </View>
      </View>

      {status && status.alerts && status.alerts.length > 0 ? (
        <View style={[styles.alertCard, { backgroundColor: theme.red.bg }]}>
          {status.alerts.map(function (alert: string, i: number) {
            return (
              <Text key={i} style={{ color: theme.red.fg, fontSize: 13 }}>
                Alert: {alert}
              </Text>
            );
          })}
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, { color: theme.textStrong }]}>Glucose</Text>
          {peak !== null ? (
            <Text style={{ color: theme.pink.sub, fontSize: 13 }}>{peak} mg/dL peak</Text>
          ) : null}
        </View>

        <View style={styles.rangeRow}>
          {RANGE_OPTIONS.map(function (hrs) {
            return (
              <Pressable
                key={hrs}
                onPress={function () {
                  setRangeHours(hrs);
                }}
                style={[
                  styles.rangeButton,
                  {
                    backgroundColor: rangeHours === hrs ? theme.teal.bar : theme.page,
                    borderColor: theme.cardBorder,
                  },
                ]}
              >
                <Text style={{ color: rangeHours === hrs ? "#fff" : theme.textSoft, fontSize: 12 }}>
                  {hrs}h
                </Text>
              </Pressable>
            );
          })}
        </View>

        {status && status.hasData ? (
          <View style={[styles.glucoseCurrentBox, { backgroundColor: theme.berry.bg }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.glucoseCurrentValue, { color: theme.berry.fg }]}>
                {status.mg_dl}{status.arrow ? " " + status.arrow : ""}
              </Text>
              {status.minutesSinceReading != null ? (
                <Text style={{ color: theme.berry.fg, fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                  as of {status.minutesSinceReading} min ago
                </Text>
              ) : null}
            </View>
            {status.delta != null ? (
              <Text style={{ color: theme.berry.fg, fontSize: 14, fontWeight: "500" }}>
                {status.delta > 0 ? "+" : ""}{status.delta} from last
              </Text>
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
          <Svg width={CHART_WIDTH} height={CHART_HEIGHT} style={{ marginTop: 12 }}>
            {gridValues.map((v) => {
              const gy = PAD_TOP + chartInnerHeight - ((v - minVal) / (maxVal - minVal)) * chartInnerHeight;
              return (
                <React.Fragment key={v}>
                  <Line x1={PAD_LEFT} x2={CHART_WIDTH} y1={gy} y2={gy} stroke={theme.cardBorder} strokeDasharray="2,3" strokeWidth={0.5} />
                  <SvgText x={PAD_LEFT - 4} y={gy + 4} fontSize={9} fill={theme.textSoft} textAnchor="end">{v}</SvgText>
                </React.Fragment>
              );
            })}

            <Line x1={PAD_LEFT} x2={CHART_WIDTH} y1={highY} y2={highY} stroke={theme.red.sub} strokeDasharray="3,3" strokeWidth={1} />
            <Line x1={PAD_LEFT} x2={CHART_WIDTH} y1={lowY} y2={lowY} stroke={theme.red.sub} strokeDasharray="3,3" strokeWidth={1} />

            {yesterdayPoints.length > 0 ? (
              <Polyline points={yesterdayPoints} fill="none" stroke={theme.textSoft} strokeWidth={2} opacity={0.35} />
            ) : null}

            <Polyline points={todayPoints} fill="none" stroke={theme.berry.bar} strokeWidth={2.5} />
          </Svg>
        )}

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.berry.bar }]} />
            <Text style={{ color: theme.textSoft, fontSize: 11 }}>Today</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.textSoft, opacity: 0.5 }]} />
            <Text style={{ color: theme.textSoft, fontSize: 11 }}>Yesterday (same time)</Text>
          </View>
        </View>

        {status && status.isStale ? (
          <Text style={{ color: theme.textSoft, fontSize: 11, marginTop: 8 }}>
            Last reading {status.minutesSinceReading} min ago - sensor may be disconnected.
          </Text>
        ) : null}
      </View>

      {/* Heart Rate chart */}
      {(() => {
        const hrValues = hrReadings.map((r) => r.bpm);
        const hrMin = hrValues.length ? Math.min(...hrValues) - 5 : 40;
        const hrMax = hrValues.length ? Math.max(...hrValues) + 5 : 120;
        const hrRange = hrMax - hrMin || 1;
        const now = Date.now();
        const hrWindowStart = now - hrRangeHours * 60 * 60 * 1000;
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
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.cardTitle, { color: theme.textStrong }]}>Heart Rate</Text>
              {peakBpm !== null ? (
                <Text style={{ color: theme.red.sub, fontSize: 13 }}>peak {peakBpm} bpm</Text>
              ) : null}
            </View>
            {restingBpm !== null ? (
              <Text style={{ color: theme.textSoft, fontSize: 12, marginBottom: 2 }}>
                Resting: {restingBpm} bpm
              </Text>
            ) : null}
            <View style={styles.rangeRow}>
              {HR_RANGE_OPTIONS.map(function (hrs) {
                return (
                  <Pressable
                    key={hrs}
                    onPress={function () { setHrRangeHours(hrs); }}
                    style={[styles.rangeButton, {
                      backgroundColor: hrRangeHours === hrs ? theme.red.sub : theme.page,
                      borderColor: theme.cardBorder,
                    }]}
                  >
                    <Text style={{ color: hrRangeHours === hrs ? "#fff" : theme.textSoft, fontSize: 12 }}>
                      {hrs}h
                    </Text>
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
                <Polyline points={hrPoints} fill="none" stroke={theme.red.sub} strokeWidth={2} />
              </Svg>
            )}
          </View>
        );
      })()}

      {Platform.OS === "android" ? (
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: theme.textStrong }]}>Health Connect</Text>
          <Pressable
            onPress={handleHealthConnectSync}
            disabled={hcSyncing}
            style={[styles.hcButton, { backgroundColor: theme.teal.bg, borderColor: theme.teal.sub }]}
          >
            {hcSyncing
              ? <ActivityIndicator size="small" color={theme.teal.fg} />
              : <Text style={{ color: theme.teal.fg, fontSize: 13, fontWeight: "500" }}>Sync from Health Connect</Text>
            }
          </Pressable>
          {hcResult ? (
            <Text style={{ color: theme.textSoft, fontSize: 12, marginTop: 8 }}>{hcResult}</Text>
          ) : null}

          <Pressable
            onPress={handleToggleLiveTracking}
            style={[styles.hcButton, {
              backgroundColor: liveTracking ? theme.coral.bg : theme.blue.bg,
              borderColor: liveTracking ? theme.coral.sub : theme.blue.sub,
              marginTop: 10,
            }]}
          >
            <Text style={{ color: liveTracking ? theme.coral.fg : theme.blue.fg, fontSize: 13, fontWeight: "500" }}>
              {liveTracking ? "Stop live tracking" : "Start live tracking"}
            </Text>
          </Pressable>

          {liveTracking ? (
            <Pressable
              onPress={handleBatteryOptimization}
              style={[styles.hcButton, { backgroundColor: theme.page, borderColor: theme.cardBorder, marginTop: 8 }]}
            >
              <Text style={{ color: theme.textSoft, fontSize: 12 }}>Enable always-on tracking (battery exemption)</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: CARD_GAP },
  halfCell: { width: HALF_CARD_WIDTH },
  fullCell: { width: "100%" },
  card: { borderRadius: 14, borderWidth: 0.5, padding: 16, marginTop: 4 },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 14, fontWeight: "500" },
  alertCard: { borderRadius: 12, padding: 12, gap: 4 },
  rangeRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  rangeButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  legendRow: { flexDirection: "row", gap: 16, marginTop: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  hcButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  glucoseCurrentBox: {
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  glucoseCurrentValue: { fontSize: 24, fontWeight: "500" },
});

