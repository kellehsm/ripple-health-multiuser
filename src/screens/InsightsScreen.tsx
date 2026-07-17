import React, { useCallback, useState } from "react";
import {
  ScrollView, View, Text, StyleSheet, RefreshControl, Pressable, ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { api } from "../api/client";
import { InsightCard, Insight } from "../components/InsightCard";

const TYPE_GROUPS: { label: string; types: string[]; emoji: string }[] = [
  { label: "All", types: [], emoji: "✨" },
  { label: "Wellness", types: ["glucose", "sleep", "activity", "water"], emoji: "❤️" },
  { label: "Mind", types: ["mood", "books", "hobbies"], emoji: "🧠" },
  { label: "Habits", types: ["spending", "streak"], emoji: "🔥" },
];

export function InsightsScreen() {
  const { theme } = useTheme();
  const ink = theme.ink;
  const card = theme.card;

  const [insights, setInsights] = useState<Insight[]>([]);
  const [dismissed, setDismissed] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [activeGroup, setActiveGroup] = useState(0);
  const [showDismissed, setShowDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [active, history] = await Promise.all([api.getInsights(), api.getInsightHistory()]);
      const activeList: Insight[] = Array.isArray(active) ? active : [];
      const activeIds = new Set(activeList.map((i: Insight) => i.id));
      const dismissedList: Insight[] = Array.isArray(history)
        ? history.filter((i: any) => i.dismissed && !activeIds.has(i.id))
        : [];
      setInsights(activeList);
      setDismissed(dismissedList);
    } catch (e: any) {
      setError("Couldn't load insights — pull to retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  async function handleDismiss(id: string) {
    try {
      await api.dismissInsight(id);
      const item = insights.find(i => i.id === id);
      setInsights(prev => prev.filter(i => i.id !== id));
      if (item) setDismissed(prev => [{ ...item, dismissed: true }, ...prev]);
    } catch (_) {}
  }

  async function handleUndismiss(id: string) {
    try {
      await api.undismissInsight(id);
      const item = dismissed.find(i => i.id === id);
      setDismissed(prev => prev.filter(i => i.id !== id));
      if (item) setInsights(prev => [{ ...item, dismissed: false }, ...prev]);
    } catch (_) {}
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      await api.regenerateInsights();
      await load();
    } catch (_) {}
    setRegenerating(false);
  }

  const group = TYPE_GROUPS[activeGroup];
  const filtered = group.types.length === 0
    ? insights
    : insights.filter(i => group.types.includes(i.type));

  const streaks   = filtered.filter(i => i.type === "streak");
  const patterns  = filtered.filter(i => i.type !== "streak");

  const styles = makeStyles(theme.page, ink, card);

  return (
    <ScrollView
      style={{ backgroundColor: theme.page }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.teal.bar} />}
    >
      {/* Header */}
      <View style={styles.headerBlock}>
        <Text style={[styles.heading, { color: theme.textStrong }]}>Your Insights</Text>
        <Text style={[styles.subheading, { color: theme.textSoft }]}>
          Patterns observed in your own data — not medical advice.
        </Text>
        <Pressable
          onPress={handleRegenerate}
          style={[styles.regenBtn, { borderColor: ink, opacity: regenerating ? 0.5 : 1 }]}
          disabled={regenerating}
        >
          {regenerating
            ? <ActivityIndicator size="small" color={theme.textSoft} />
            : <><Ionicons name="refresh" size={13} color={theme.textSoft} /><Text style={[styles.regenText, { color: theme.textSoft }]}>  Refresh analysis</Text></>
          }
        </Pressable>
      </View>

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: "row", gap: 8, paddingRight: 4 }}>
          {TYPE_GROUPS.map((g, idx) => {
            const active = activeGroup === idx;
            return (
              <Pressable
                key={g.label}
                onPress={() => setActiveGroup(idx)}
                style={[
                  styles.filterTab,
                  { borderColor: ink, backgroundColor: active ? ink : "transparent" },
                ]}
              >
                <Text style={[styles.filterText, { color: active ? theme.page : theme.textSoft }]}>
                  {g.emoji}  {g.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {loading && (
        <View style={{ paddingVertical: 40, alignItems: "center" }}>
          <ActivityIndicator size="large" color={theme.teal.solid} />
          <Text style={[styles.emptyText, { color: theme.textSoft, marginTop: 12 }]}>Analyzing your data…</Text>
        </View>
      )}

      {!loading && error && (
        <Text style={[styles.emptyText, { color: theme.coral.solid }]}>{error}</Text>
      )}

      {!loading && !error && insights.length === 0 && (
        <View style={[styles.emptyCard, { backgroundColor: card, borderColor: ink }]}>
          <Text style={{ fontSize: 32, marginBottom: 12 }}>🌱</Text>
          <Text style={[styles.emptyTitle, { color: theme.textStrong }]}>Building your profile</Text>
          <Text style={[styles.emptyText, { color: theme.textSoft }]}>
            Keep logging meals, mood, and activity. Patterns start appearing after 2–3 weeks of data.
          </Text>
        </View>
      )}

      {!loading && !error && filtered.length === 0 && insights.length > 0 && (
        <Text style={[styles.emptyText, { color: theme.textSoft }]}>
          No {group.label.toLowerCase()} insights yet — keep logging!
        </Text>
      )}

      {/* Streak badges */}
      {streaks.length > 0 && (
        <View style={{ marginBottom: 4 }}>
          <Text style={[styles.sectionLabel, { color: theme.textSoft }]}>STREAKS</Text>
          <View style={{ gap: 10 }}>
            {streaks.map(insight => (
              <InsightCard key={insight.id} insight={insight} onDismiss={handleDismiss} />
            ))}
          </View>
        </View>
      )}

      {/* Pattern insights */}
      {patterns.length > 0 && (
        <View>
          {streaks.length > 0 && (
            <Text style={[styles.sectionLabel, { color: theme.textSoft, marginTop: 8 }]}>PATTERNS</Text>
          )}
          <View style={{ gap: 10 }}>
            {patterns.map(insight => (
              <InsightCard key={insight.id} insight={insight} onDismiss={handleDismiss} />
            ))}
          </View>
        </View>
      )}

      {/* Dismissed section */}
      {dismissed.length > 0 && (
        <View style={{ marginTop: 8 }}>
          <Pressable
            onPress={() => setShowDismissed(v => !v)}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 }}
          >
            <Ionicons name={showDismissed ? "chevron-down" : "chevron-forward"} size={14} color={theme.textSoft} />
            <Text style={[styles.sectionLabel, { color: theme.textSoft, marginBottom: 0 }]}>
              DISMISSED ({dismissed.length})
            </Text>
          </Pressable>
          {showDismissed && (
            <View style={{ gap: 8, marginTop: 6 }}>
              {dismissed.map(insight => (
                <View key={insight.id} style={[styles.dismissedRow, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
                  <Text style={{ color: theme.textSoft, fontSize: 13, flex: 1, lineHeight: 18 }}>{insight.title}</Text>
                  <Pressable
                    onPress={() => handleUndismiss(insight.id)}
                    hitSlop={8}
                    style={[styles.restoreBtn, { borderColor: theme.ink }]}
                    accessibilityLabel="Restore insight"
                  >
                    <Text style={{ color: theme.textSoft, fontSize: 11, fontWeight: "700" }}>RESTORE</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      <Text style={[styles.footer, { color: theme.textSoft }]}>
        Insights are based on statistical patterns in your personal data only. They describe observations, never diagnoses. Always consult a healthcare professional for medical decisions.
      </Text>
    </ScrollView>
  );
}

function makeStyles(page: string, ink: string, card: string) {
  return StyleSheet.create({
    content: { padding: 16, gap: 12 },
    headerBlock: { gap: 4, marginBottom: 4 },
    heading: { fontSize: 24, fontWeight: "900" },
    subheading: { fontSize: 13, lineHeight: 18 },
    regenBtn: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      marginTop: 8,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    regenText: { fontSize: 12, fontWeight: "600" },
    filterTab: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1.5,
    },
    filterText: { fontSize: 12, fontWeight: "700" },
    sectionLabel: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    emptyCard: {
      borderRadius: 16,
      borderWidth: 2,
      padding: 24,
      alignItems: "center",
    },
    emptyTitle: { fontSize: 16, fontWeight: "800", marginBottom: 8 },
    emptyText: { fontSize: 13, lineHeight: 19, textAlign: "center" },
    dismissedRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
    },
    restoreBtn: {
      borderWidth: 1.5,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    footer: {
      fontSize: 11,
      lineHeight: 16,
      fontStyle: "italic",
      textAlign: "center",
      marginTop: 8,
      paddingHorizontal: 8,
    },
  });
}
