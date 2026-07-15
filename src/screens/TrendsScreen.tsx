import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import { useTheme } from "../theme/ThemeContext";
import { api } from "../api/client";
import { USER_ID } from "../api/config";

const SCREEN_W = Dimensions.get("window").width;
// 16 scroll padding × 2 + 16 card padding × 2
const CHART_W = SCREEN_W - 64;
const CHART_H = 100;

// ── Math ──────────────────────────────────────────────────────────────────────

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 4) return NaN;
  const mx = xs.reduce((a, b) => a + b) / n;
  const my = ys.reduce((a, b) => a + b) / n;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const dx = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0));
  const dy = Math.sqrt(ys.reduce((s, y) => s + (y - my) ** 2, 0));
  if (dx === 0 || dy === 0) return NaN;
  return num / (dx * dy);
}

function linReg(xs: number[], ys: number[]) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b) / n;
  const my = ys.reduce((a, b) => a + b) / n;
  const slope =
    xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) /
    (xs.reduce((s, x) => s + (x - mx) ** 2, 0) || 1);
  return { slope, intercept: my - slope * mx };
}

// Splits xs by median, returns avg of paired ys above/below median
function splitAvg(xs: number[], ys: number[]): [number | null, number | null] {
  const sorted = [...xs].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  const avgFn = (arr: number[]) => arr.reduce((a, b) => a + b) / arr.length;
  const hi = ys.filter((_, i) => xs[i] >= med);
  const lo = ys.filter((_, i) => xs[i] < med);
  return [hi.length ? avgFn(hi) : null, lo.length ? avgFn(lo) : null];
}

// ── Scatter plot ──────────────────────────────────────────────────────────────

function ScatterPlot({
  xs, ys, dotColor, lineColor,
}: { xs: number[]; ys: number[]; dotColor: string; lineColor: string }) {
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  if (xMax - xMin < 0.001 || yMax - yMin < 0.001) return null;

  const PAD = 8;
  const W = CHART_W - PAD * 2;
  const H = CHART_H - PAD * 2;
  const px = (v: number) => PAD + ((v - xMin) / (xMax - xMin)) * W;
  const py = (v: number) => PAD + (1 - (v - yMin) / (yMax - yMin)) * H;

  const { slope, intercept } = linReg(xs, ys);
  const clamp = (v: number) => Math.max(PAD, Math.min(PAD + H, v));
  const lx1 = PAD, ly1 = clamp(py(slope * xMin + intercept));
  const lx2 = PAD + W, ly2 = clamp(py(slope * xMax + intercept));

  return (
    <Svg width={CHART_W} height={CHART_H}>
      <Line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke={lineColor} strokeWidth={1.5} strokeDasharray="5,4" opacity={0.45} />
      {xs.map((x, i) => (
        <Circle key={i} cx={px(x)} cy={py(ys[i])} r={4} fill={dotColor} opacity={0.72} />
      ))}
    </Svg>
  );
}

// ── Correlation card ──────────────────────────────────────────────────────────

function corrStrength(r: number): string {
  if (isNaN(r)) return "–";
  const a = Math.abs(r);
  const sign = r > 0 ? "positive" : "negative";
  if (a >= 0.6) return `Strong ${sign}`;
  if (a >= 0.35) return `Moderate ${sign}`;
  if (a >= 0.15) return `Weak ${sign}`;
  return "No clear link";
}

function badgeColors(r: number, theme: any): { bg: string; fg: string } {
  if (isNaN(r) || Math.abs(r) < 0.15)
    return { bg: theme.page, fg: theme.textSoft };
  if (r > 0)
    return Math.abs(r) >= 0.6
      ? { bg: theme.teal.bg, fg: theme.teal.fg }
      : { bg: theme.blue.bg, fg: theme.blue.fg };
  return Math.abs(r) >= 0.6
    ? { bg: theme.berry.bg, fg: theme.berry.fg }
    : { bg: theme.amber.bg, fg: theme.amber.fg };
}

type CardProps = {
  title: string;
  xLabel: string;
  yLabel: string;
  xs: number[];
  ys: number[];
  insight: string;
  dotColor: string;
  lineColor: string;
  theme: any;
};

function CorrCard({ title, xLabel, yLabel, xs, ys, insight, dotColor, lineColor, theme }: CardProps) {
  const s = useMemo(() => makeStyles(theme.ink, theme.card), [theme.ink, theme.card]);
  // Filter out any NaN / null that slipped through
  const clean: [number, number][] = [];
  for (let i = 0; i < xs.length; i++) {
    if (!isNaN(xs[i]) && !isNaN(ys[i])) clean.push([xs[i], ys[i]]);
  }
  const cxs = clean.map(p => p[0]);
  const cys = clean.map(p => p[1]);
  const r = pearson(cxs, cys);
  const badge = badgeColors(r, theme);

  return (
    <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.ink }]}>
      <View style={s.cardHead}>
        <Text style={[s.cardTitle, { color: theme.textStrong }]}>{title}</Text>
        {!isNaN(r) && (
          <View style={[s.badge, { backgroundColor: badge.bg }]}>
            <Text style={[s.badgeTxt, { color: badge.fg }]}>
              {(r >= 0 ? "+" : "") + r.toFixed(2)}{"  "}{corrStrength(r)}
            </Text>
          </View>
        )}
      </View>

      {clean.length < 5 ? (
        <Text style={[s.noData, { color: theme.textSoft }]}>
          Not enough data yet — keep logging to reveal patterns.
        </Text>
      ) : (
        <>
          <View style={s.axisRow}>
            <Text style={[s.axisLbl, { color: theme.textSoft }]}>{xLabel} →</Text>
            <Text style={[s.axisLbl, { color: theme.textSoft }]}>↑ {yLabel}</Text>
          </View>
          <ScatterPlot xs={cxs} ys={cys} dotColor={dotColor} lineColor={lineColor} />
          <Text style={[s.insight, { color: theme.textSoft }]}>{insight}</Text>
        </>
      )}
    </View>
  );
}

// ── Insight text helpers ──────────────────────────────────────────────────────

function insightMood(xs: number[], ys: number[], hiLabel: string, loLabel: string): string {
  const [hi, lo] = splitAvg(xs, ys);
  if (hi == null || lo == null) return "Keep logging to reveal patterns.";
  return `${hiLabel}: mood avg ${hi.toFixed(1)} vs ${lo.toFixed(1)} on ${loLabel}.`;
}

function insightMetric(xs: number[], ys: number[], hiLabel: string, loLabel: string, yName: string): string {
  const [hi, lo] = splitAvg(xs, ys);
  if (hi == null || lo == null) return "Keep logging to reveal patterns.";
  return `${yName}: ${hi.toFixed(0)} on ${hiLabel} vs ${lo.toFixed(0)} on ${loLabel}.`;
}

// ── Main screen ───────────────────────────────────────────────────────────────

type DayRow = {
  date: string;
  avg_mood: number | null;
  sleep_hours: number;
  total_spent: number;
  avg_mg_dl: number | null;
  caffeine_mg: number;
  standard_drinks: number;
};

export function TrendsScreen() {
  const { theme } = useTheme();
  const ink = theme.ink;
  const card = theme.card;
  const s = useMemo(() => makeStyles(ink, card), [ink, card]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DayRow[]>([]);

  const load = useCallback(async (n: number) => {
    setLoading(true);
    try {
      const end = new Date().toISOString().slice(0, 10);
      const start = new Date(Date.now() - (n - 1) * 86400000).toISOString().slice(0, 10);
      const [moodData, glucoseData, substanceData] = await Promise.all([
        api.weeklyMoodSummary(USER_ID, n),
        api.searchGlucose(USER_ID, { start, end, threshold: 0 }).catch(() => [] as any[]),
        api.substancesSummary(USER_ID, start, end).catch(() => [] as any[]),
      ]);

      const glucoseByDate = new Map<string, number>();
      if (Array.isArray(glucoseData)) {
        for (const g of glucoseData) glucoseByDate.set(g.date?.slice(0, 10), Number(g.avg_mg_dl));
      }

      const caffeineByDate = new Map<string, number>();
      const drinksByDate = new Map<string, number>();
      if (Array.isArray(substanceData)) {
        for (const s of substanceData) {
          caffeineByDate.set(s.date?.slice(0, 10), Number(s.caffeine_mg));
          drinksByDate.set(s.date?.slice(0, 10), Number(s.standard_drinks));
        }
      }

      setRows(
        Array.isArray(moodData)
          ? moodData.map((r: any) => ({
              date: r.date,
              avg_mood: r.avg_mood !== null ? Number(r.avg_mood) : null,
              sleep_hours: Number(r.sleep_hours),
              total_spent: Number(r.total_spent),
              avg_mg_dl: glucoseByDate.get(r.date?.slice(0, 10)) ?? null,
              caffeine_mg: caffeineByDate.get(r.date?.slice(0, 10)) ?? 0,
              standard_drinks: drinksByDate.get(r.date?.slice(0, 10)) ?? 0,
            }))
          : []
      );
    } catch (e) {
      console.error("TrendsScreen load error", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(days); }, [days, load]);

  // Pre-filter pairs for each correlation
  const smRows = rows.filter(r => r.avg_mood !== null && r.sleep_hours > 0);
  const spRows = rows.filter(r => r.avg_mood !== null);
  const gmRows = rows.filter(r => r.avg_mood !== null && r.avg_mg_dl !== null);
  const sgRows = rows.filter(r => r.avg_mg_dl !== null && r.sleep_hours > 0);
  // Substance correlations — only include days that actually have logged data
  const cgRows = rows.filter(r => r.caffeine_mg > 0 && r.avg_mg_dl !== null);
  const asRows = rows.filter(r => r.standard_drinks > 0 && r.sleep_hours > 0);
  const cmRows = rows.filter(r => r.caffeine_mg > 0 && r.avg_mood !== null);

  const smXs = smRows.map(r => r.sleep_hours),       smYs = smRows.map(r => r.avg_mood!);
  const spXs = spRows.map(r => r.total_spent),        spYs = spRows.map(r => r.avg_mood!);
  const gmXs = gmRows.map(r => r.avg_mg_dl!),         gmYs = gmRows.map(r => r.avg_mood!);
  const sgXs = sgRows.map(r => r.sleep_hours),        sgYs = sgRows.map(r => r.avg_mg_dl!);
  const cgXs = cgRows.map(r => r.caffeine_mg),        cgYs = cgRows.map(r => r.avg_mg_dl!);
  const asXs = asRows.map(r => r.standard_drinks),    asYs = asRows.map(r => r.sleep_hours);
  const cmXs = cmRows.map(r => r.caffeine_mg),        cmYs = cmRows.map(r => r.avg_mood!);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.page }}
      contentContainerStyle={s.page}
    >
      {/* Period selector */}
      <View style={s.periodRow}>
        {[14, 30, 60].map(n => (
          <Pressable
            key={n}
            onPress={() => setDays(n)}
            style={[
              s.chip,
              {
                backgroundColor: days === n ? theme.textStrong : theme.card,
                borderColor: theme.ink,
              },
            ]}
          >
            <Text style={{ color: days === n ? theme.page : theme.textSoft, fontSize: 13, fontWeight: days === n ? "600" : "400" }}>
              {n}d
            </Text>
          </Pressable>
        ))}
        <Text style={[s.periodNote, { color: theme.textSoft }]}>window</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.textSoft} style={{ marginTop: 48 }} />
      ) : rows.length === 0 ? (
        <View style={s.empty}>
          <Text style={[s.emptyTxt, { color: theme.textSoft }]}>
            Log mood, sleep, and meals for at least a week to see your personal health patterns here.
          </Text>
        </View>
      ) : (
        <>
          <CorrCard
            title="Sleep ↔ Mood"
            xLabel="Sleep hours"
            yLabel="Mood"
            xs={smXs}
            ys={smYs}
            dotColor={theme.amber.sub}
            lineColor={theme.amber.sub}
            insight={insightMood(smXs, smYs, "More sleep", "less sleep")}
            theme={theme}
          />

          <CorrCard
            title="Spending ↔ Mood"
            xLabel="Daily spend ($)"
            yLabel="Mood"
            xs={spXs}
            ys={spYs}
            dotColor={theme.purple.sub}
            lineColor={theme.purple.sub}
            insight={insightMood(spXs, spYs, "Higher-spend days", "lower-spend days")}
            theme={theme}
          />

          {gmRows.length >= 3 && (
            <CorrCard
              title="Glucose ↔ Mood"
              xLabel="Avg glucose (mg/dL)"
              yLabel="Mood"
              xs={gmXs}
              ys={gmYs}
              dotColor={theme.berry.sub}
              lineColor={theme.berry.sub}
              insight={insightMood(gmXs, gmYs, "Higher-glucose days", "lower-glucose days")}
              theme={theme}
            />
          )}

          {sgRows.length >= 3 && (
            <CorrCard
              title="Sleep ↔ Glucose"
              xLabel="Sleep hours"
              yLabel="Avg glucose"
              xs={sgXs}
              ys={sgYs}
              dotColor={theme.teal.sub}
              lineColor={theme.teal.sub}
              insight={insightMetric(sgXs, sgYs, "more sleep", "less sleep", "Avg glucose")}
              theme={theme}
            />
          )}

          {cgRows.length >= 3 && (
            <CorrCard
              title="Caffeine ↔ Glucose"
              xLabel="Caffeine (mg)"
              yLabel="Avg glucose"
              xs={cgXs}
              ys={cgYs}
              dotColor="#E8820E"
              lineColor="#E8820E"
              insight={insightMetric(cgXs, cgYs, "higher-caffeine days", "lower-caffeine days", "Avg glucose")}
              theme={theme}
            />
          )}

          {asRows.length >= 3 && (
            <CorrCard
              title="Alcohol ↔ Sleep"
              xLabel="Standard drinks"
              yLabel="Sleep hours"
              xs={asXs}
              ys={asYs}
              dotColor="#7B3FBF"
              lineColor="#7B3FBF"
              insight={insightMetric(asXs, asYs, "drinking days", "non-drinking days", "Sleep hours")}
              theme={theme}
            />
          )}

          {cmRows.length >= 3 && (
            <CorrCard
              title="Caffeine ↔ Mood"
              xLabel="Caffeine (mg)"
              yLabel="Mood"
              xs={cmXs}
              ys={cmYs}
              dotColor="#E8820E"
              lineColor="#E8820E"
              insight={insightMood(cmXs, cmYs, "Higher-caffeine days", "lower-caffeine days")}
              theme={theme}
            />
          )}

          <Text style={[s.footnote, { color: theme.textSoft }]}>
            Each dot represents one day. Dashed line shows the overall trend. Correlations based on {days}-day window.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(ink: string, card: string) {
  const shadow = {
    shadowColor: ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1 as const,
    shadowRadius: 0,
    elevation: 4,
  };
  return StyleSheet.create({
  page:       { padding: 16, paddingBottom: 32, gap: 14 },
  periodRow:  { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 2,
    shadowColor: ink, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0, elevation: 2,
  },
  periodNote: { fontSize: 13, marginLeft: 2 },
  card: { borderRadius: 14, borderWidth: 2, borderColor: ink, padding: 16, gap: 10, backgroundColor: card, ...shadow },
  cardHead:   { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  cardTitle:  { fontSize: 17, fontWeight: "800", flex: 1 },
  badge:      { borderRadius: 20, borderWidth: 2, borderColor: ink, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 1 },
  badgeTxt:   { fontSize: 11, fontWeight: "700" },
  axisRow:    { flexDirection: "row", justifyContent: "space-between", marginBottom: -4 },
  axisLbl:    { fontSize: 11 },
  insight:    { fontSize: 13, lineHeight: 20 },
  noData:     { fontSize: 13, lineHeight: 20 },
  footnote:   { fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 4 },
  empty:      { alignItems: "center", paddingVertical: 48 },
  emptyTxt:   { fontSize: 14, textAlign: "center", lineHeight: 22 },
  });
}
