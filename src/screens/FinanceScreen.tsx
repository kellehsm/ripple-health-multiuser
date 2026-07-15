import React, { useState, useMemo } from "react";
import { ScrollView, View, Text, StyleSheet, RefreshControl } from "react-native";
import { useTheme } from "../theme/ThemeContext";

export function FinanceScreen() {
  const { theme } = useTheme();
  const ink = theme.ink;
  const card = theme.card;
  const styles = useMemo(() => makeStyles(ink, card), [ink, card]);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.page }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.teal.bar} />}
    >
      <View style={styles.card}>
        <Text style={[styles.cardTitle, { color: theme.textStrong }]}>Spending this week</Text>
        <Text style={{ color: theme.purple.sub, fontSize: 12, marginTop: 4 }}>$212 of $300 budget</Text>
        <View style={[styles.progressTrack, { backgroundColor: theme.purple.bg }]}>
          <View style={[styles.progressFill, { backgroundColor: theme.purple.sub, width: "70%" }]} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={[styles.cardTitle, { color: theme.textStrong }]}>Stress-spend correlation</Text>
        {/* TODO: chart spending vs. inverted mood score over the last 14-30 days */}
        <Text style={{ color: theme.textSoft, fontSize: 12, marginTop: 10 }}>
          Spending vs. mood overlay chart goes here.
        </Text>
      </View>
    </ScrollView>
  );
}

function makeStyles(ink: string, card: string) {
  return StyleSheet.create({
  content: { padding: 16, gap: 12 },
  card: {
    borderRadius: 14, borderWidth: 2, borderColor: ink, padding: 16, backgroundColor: card,
    shadowColor: ink, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4,
  },
  cardTitle: { fontSize: 19, fontWeight: "800" },
  progressTrack: { height: 8, borderRadius: 6, overflow: "hidden", marginTop: 10 },
  progressFill: { height: "100%" },
  });
}
