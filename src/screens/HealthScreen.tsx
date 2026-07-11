import React, { useEffect, useState, useCallback } from "react";
import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, Dimensions } from "react-native";
import Svg, { Polyline, Line, Text as SvgText } from "react-native-svg";
import { useTheme } from "../theme/ThemeContext";
import { MetricCard } from "../components/MetricCard";
import { api } from "../api/client";
import { USER_ID } from "../api/config";

const RANGE_OPTIONS = [3, 6, 12, 24];
const SCREEN_WIDTH = Dimensions.get("window").width;
const CHART_WIDTH = SCREEN_WIDTH - 64;
const CHART_HEIGHT = 200;
const PAD_LEFT = 32;
const PAD_BOTTOM = 20;
const PAD_TOP = 14;

function buildPoints(readings, windowStart, windowEnd, minVal, maxVal) {
  const usableWidth = CHART_WIDTH - PAD_LEFT;
  const usableHeight = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const windowMs = windowEnd - windowStart;

  return readings
    .map(function (r) {
      const t = new Date(r.recorded_at).getTime();
      const x = PAD_LEFT + ((t - windowStart) / windowMs) * usableWidth;
      const y = PAD_TOP + usableHeight - ((Number(r.mg_dl) - minVal) / (maxVal - minVal)) * usableHeight;
      return x + "," + y;
    })
    .join(" ");
}

export function HealthScreen() {
  const themeCtx = useTheme();
  const theme = themeCtx.theme;
  const [rangeHours, setRangeHours] = useState(6);
  const [todayReadings, setTodayReadings] = useState([]);
  const [yesterdayReadings, setYesterdayReadings] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(function (hours) {
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
          yestArray.map(function (r) {
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

  const peak = todayReadings.length > 0
    ? Math.max.apply(null, todayReadings.map(function (r) { return Number(r.mg_dl); }))
    : null;

  const glucoseValue = status && status.hasData ? status.mg_dl + " " + (status.arrow || "") : "--";
  const glucoseSub = status && status.delta != null
    ? (status.delta > 0 ? "+" : "") + status.delta + " from last"
    : undefined;

  return (
    <ScrollView style={{ backgroundColor: theme.page }} contentContainerStyle={styles.content}>
      <View style={styles.grid}>
        <MetricCard label="Steps" value="8,412" icon="walk" colorKey="teal" />
        <MetricCard label="Sleep" value="7h 12m" icon="moon" colorKey="blue" />
        <MetricCard label="Water" value="5 / 8" icon="water" colorKey="amber" />
        <MetricCard label="Glucose" value={glucoseValue} icon="pulse" colorKey="pink" sublabel={glucoseSub} />
      </View>

      {status && status.alerts && status.alerts.length > 0 ? (
        <View style={[styles.alertCard, { backgroundColor: theme.coral.bg }]}>
          {status.alerts.map(function (alert, i) {
            return (
              <Text key={i} style={{ color: theme.coral.fg, fontSize: 13 }}>
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

        {loading ? (
          <ActivityIndicator style={{ marginVertical: 30 }} />
        ) : todayReadings.length === 0 ? (
          <Text style={{ color: theme.textSoft, fontSize: 12, marginTop: 10 }}>
            No glucose readings in this window yet.
          </Text>
        ) : (
          <Svg width={CHART_WIDTH} height={CHART_HEIGHT} style={{ marginTop: 12 }}>
            <SvgText x={0} y={PAD_TOP + 6} fontSize={10} fill={theme.textSoft}>
              {Math.round(maxVal)}
            </SvgText>
            <SvgText x={0} y={CHART_HEIGHT - PAD_BOTTOM} fontSize={10} fill={theme.textSoft}>
              {Math.round(minVal)}
            </SvgText>

            <Line x1={PAD_LEFT} x2={CHART_WIDTH} y1={highY} y2={highY} stroke={theme.coral.sub} strokeDasharray="3,3" strokeWidth={1} />
            <Line x1={PAD_LEFT} x2={CHART_WIDTH} y1={lowY} y2={lowY} stroke={theme.coral.sub} strokeDasharray="3,3" strokeWidth={1} />

            {yesterdayPoints.length > 0 ? (
              <Polyline points={yesterdayPoints} fill="none" stroke={theme.textSoft} strokeWidth={2} opacity={0.35} />
            ) : null}

            <Polyline points={todayPoints} fill="none" stroke={theme.teal.bar} strokeWidth={2.5} />
          </Svg>
        )}

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.teal.bar }]} />
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: { borderRadius: 14, borderWidth: 0.5, padding: 16, marginTop: 4 },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 14, fontWeight: "500" },
  alertCard: { borderRadius: 12, padding: 12, gap: 4 },
  rangeRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  rangeButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  legendRow: { flexDirection: "row", gap: 16, marginTop: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
});
