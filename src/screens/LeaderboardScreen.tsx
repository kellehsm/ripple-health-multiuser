import React, { useCallback, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { ShadowCard } from "../components/ShadowCard";
import { getLeaderboard, LeaderboardEntry, SocialCategory } from "../api/friends";

const CATEGORY_ICON: Record<SocialCategory, keyof typeof Ionicons.glyphMap> = {
  steps: "footsteps-outline",
  exercise: "barbell-outline",
  hobbies: "star-outline",
  books: "book-outline",
};

const CATEGORY_LABEL: Record<SocialCategory, string> = {
  steps: "Steps This Week",
  exercise: "Exercise This Week",
  hobbies: "Hobbies This Week",
  books: "Books This Month",
};

function formatValue(value: number, category: SocialCategory): string {
  if (category === "steps") {
    return value.toLocaleString() + " steps";
  }
  if (category === "exercise") {
    const h = Math.floor(value / 60);
    const m = value % 60;
    if (h === 0) return m + " min";
    if (m === 0) return h + "h";
    return h + "h " + m + "m";
  }
  if (category === "hobbies") {
    const h = Math.floor(value / 60);
    const m = value % 60;
    if (h === 0) return m + " min";
    if (m === 0) return h + "h";
    return h + "h " + m + "m";
  }
  if (category === "books") {
    return value + (value === 1 ? " book" : " books");
  }
  return String(value);
}

const RANK_MEDALS = ["", "gold", "silver", "bronze"] as const;
const RANK_COLORS = ["", "#F5B800", "#A8A8A8", "#C07A4A"];

export function LeaderboardScreen() {
  const { theme } = useTheme();
  const route = useRoute<any>();
  const category: SocialCategory = route.params?.category ?? "steps";

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      getLeaderboard(category)
        .then((data) => { if (!cancelled) setEntries(Array.isArray(data) ? data : []); })
        .catch(() => { if (!cancelled) setEntries([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [category])
  );

  const myEntry = entries.find((e) => e.is_me);

  return (
    <ScrollView
      style={{ backgroundColor: theme.page }}
      contentContainerStyle={styles.content}
    >
      {/* Header card */}
      <ShadowCard padding={16} bg={theme.teal.tint} accent={theme.teal.solid}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Ionicons name={CATEGORY_ICON[category]} size={28} color={theme.teal.fg} />
          <View>
            <Text style={{ color: theme.teal.fg, fontSize: 20, fontWeight: "900" }}>
              {CATEGORY_LABEL[category]}
            </Text>
            <Text style={{ color: theme.teal.sub, fontSize: 12, marginTop: 2 }}>
              Compared with your friends
            </Text>
          </View>
        </View>
        {myEntry && (
          <View style={[styles.myBanner, { backgroundColor: theme.teal.solid, borderColor: theme.ink }]}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>
              Your position: #{myEntry.rank} — {formatValue(myEntry.value, category)}
            </Text>
          </View>
        )}
      </ShadowCard>

      {/* Privacy note */}
      <View style={[styles.privacyNote, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Ionicons name="shield-checkmark-outline" size={14} color={theme.textSoft} style={{ marginRight: 6 }} />
        <Text style={{ color: theme.textSoft, fontSize: 11, flex: 1 }}>
          Only data each person has chosen to share is visible here. All other health data stays completely private.
        </Text>
      </View>

      {/* Leaderboard */}
      {loading ? (
        <View style={{ alignItems: "center", paddingVertical: 40 }}>
          <ActivityIndicator color={theme.teal.bar} size="large" />
        </View>
      ) : entries.length < 2 ? (
        <ShadowCard padding={20}>
          <View style={{ alignItems: "center", gap: 12 }}>
            <Ionicons name="people-outline" size={40} color={theme.teal.solid} />
            <Text style={{ color: theme.textStrong, fontSize: 17, fontWeight: "800", textAlign: "center" }}>
              Invite friends to compare!
            </Text>
            <Text style={{ color: theme.textSoft, fontSize: 13, textAlign: "center" }}>
              You need at least two people with shared data to see a leaderboard. Add friends from the Friends tab.
            </Text>
          </View>
        </ShadowCard>
      ) : (
        <View style={[styles.board, { backgroundColor: theme.card, borderColor: theme.ink }]}>
          {entries.map((entry, i) => {
            const isTop3 = entry.rank <= 3;
            const medalColor = RANK_COLORS[entry.rank] ?? theme.textSoft;
            return (
              <View key={entry.user_id + String(i)}>
                {i > 0 && <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />}
                <View
                  style={[
                    styles.entryRow,
                    entry.is_me && { backgroundColor: theme.teal.tint },
                  ]}
                >
                  {/* Rank */}
                  <View style={[styles.rankBadge, isTop3 && { backgroundColor: medalColor + "22", borderColor: medalColor }]}>
                    <Text style={{ color: isTop3 ? medalColor : theme.textSoft, fontWeight: "900", fontSize: 15 }}>
                      {entry.rank}
                    </Text>
                  </View>

                  {/* Name */}
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text
                      style={{
                        color: theme.textStrong,
                        fontSize: 15,
                        fontWeight: entry.is_me ? "900" : "600",
                      }}
                    >
                      {entry.display_name}
                      {entry.is_me ? " (you)" : ""}
                    </Text>
                  </View>

                  {/* Value */}
                  <Text
                    style={{
                      color: entry.is_me ? theme.teal.fg : theme.textStrong,
                      fontWeight: "800",
                      fontSize: 14,
                    }}
                  >
                    {formatValue(entry.value, category)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Encouraging note */}
      {entries.length >= 2 && (
        <View style={[styles.encourageNote, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={{ color: theme.textSoft, fontSize: 12, textAlign: "center" }}>
            Keep it up — every bit of progress counts. The goal is to stay active together, not to race.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  myBanner: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  privacyNote: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 10,
  },
  board: {
    borderRadius: 22,
    borderWidth: 2,
    overflow: "hidden",
    shadowColor: "rgba(60,40,20,0.1)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  divider: { height: 1, marginHorizontal: 14 },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rankBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  encourageNote: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 12,
  },
});
