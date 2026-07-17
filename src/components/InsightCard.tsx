import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { onSolid } from "../theme/colorUtils";

export type Confidence = "low" | "moderate" | "high" | "very_high";

export interface Insight {
  id: string;
  rule_id: string;
  type: string;
  title: string;
  description: string;
  confidence: Confidence;
  confidence_score: number;
  supporting_data: Record<string, unknown>;
  times_observed: number;
  first_detected: string;
  last_confirmed: string;
  dismissed: boolean;
}

const TYPE_ICON: Record<string, string> = {
  sleep: "moon-outline",
  glucose: "pulse",
  activity: "walk",
  water: "water-outline",
  mood: "happy-outline",
  books: "book-outline",
  hobbies: "bicycle-outline",
  spending: "wallet-outline",
  streak: "flame",
};

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  low: "Emerging",
  moderate: "Moderate",
  high: "Strong",
  very_high: "Very Strong",
};

function getConfidenceColor(confidence: Confidence, theme: any): string {
  switch (confidence) {
    case "low":       return theme.textSoft;
    case "moderate":  return theme.amber.solid;
    case "high":      return theme.teal.solid;
    case "very_high": return theme.success;
  }
}

function formatSupportingData(data: Record<string, unknown>): Array<{ label: string; value: string }> {
  const skip = new Set(["direction", "higher_on", "lower_on", "top_hobby", "highest_bucket", "lowest_bucket", "highest_type", "lowest_type", "meal_types", "buckets", "streak_type"]);
  return Object.entries(data)
    .filter(([k]) => !skip.has(k))
    .map(([k, v]) => ({
      label: k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      value: typeof v === "number" ? String(v) : String(v),
    }))
    .slice(0, 6);
}

interface InsightCardProps {
  insight: Insight;
  onDismiss?: (id: string) => void;
  compact?: boolean;
}

export function InsightCard({ insight, onDismiss, compact = false }: InsightCardProps) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const icon = TYPE_ICON[insight.type] ?? "bulb-outline";
  const confColor = getConfidenceColor(insight.confidence, theme);
  const confLabel = CONFIDENCE_LABEL[insight.confidence];
  const ink = theme.ink;
  const card = theme.card;

  const supportRows = expanded ? formatSupportingData(insight.supporting_data) : [];
  const age = Math.floor((Date.now() - new Date(insight.last_confirmed).getTime()) / 86400000);
  const ageLabel = age === 0 ? "today" : age === 1 ? "yesterday" : `${age} days ago`;

  return (
    <Pressable
      onPress={() => setExpanded(e => !e)}
      style={[styles.card, { backgroundColor: card, borderColor: ink, shadowColor: ink }]}
      accessibilityRole="button"
      accessibilityLabel={insight.title}
    >
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={[styles.iconBox, { backgroundColor: confColor }]}>
          <Ionicons name={icon as any} size={15} color={onSolid(confColor)} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.title, { color: theme.textStrong }]}>{insight.title}</Text>
          <View style={styles.metaRow}>
            <View style={[styles.confBadge, { backgroundColor: confColor + "22", borderColor: confColor }]}>
              <Text style={[styles.confText, { color: confColor }]}>{confLabel}</Text>
            </View>
            <Text style={[styles.ageText, { color: theme.textSoft }]}> · {ageLabel}</Text>
          </View>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={theme.textSoft}
          style={{ marginLeft: 6 }}
        />
      </View>

      {/* Description — always visible */}
      {!compact && (
        <Text style={[styles.description, { color: theme.textStrong }]}>{insight.description}</Text>
      )}
      {compact && !expanded && (
        <Text style={[styles.description, { color: theme.textStrong }]} numberOfLines={2}>
          {insight.description}
        </Text>
      )}
      {compact && expanded && (
        <Text style={[styles.description, { color: theme.textStrong }]}>{insight.description}</Text>
      )}

      {/* Expanded supporting data */}
      {expanded && (
        <View style={[styles.supportBox, { borderTopColor: ink + "33" }]}>
          <Text style={[styles.supportHeader, { color: theme.textSoft }]}>Why am I seeing this?</Text>
          <Text style={[styles.supportNote, { color: theme.textSoft }]}>
            This pattern was observed across {insight.times_observed} data points. Confidence is based on sample size and effect size — not a medical finding.
          </Text>
          <View style={styles.dataGrid}>
            {supportRows.map(row => (
              <View key={row.label} style={[styles.dataRow, { borderBottomColor: ink + "1A" }]}>
                <Text style={[styles.dataLabel, { color: theme.textSoft }]}>{row.label}</Text>
                <Text style={[styles.dataValue, { color: theme.textStrong }]}>{row.value}</Text>
              </View>
            ))}
          </View>
          {onDismiss && (
            <Pressable
              onPress={() => onDismiss(insight.id)}
              style={[styles.dismissBtn, { borderColor: ink + "44" }]}
              accessibilityRole="button"
              accessibilityLabel="Dismiss this insight"
            >
              <Text style={[styles.dismissText, { color: theme.textSoft }]}>Dismiss</Text>
            </Pressable>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 2,
    padding: 14,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  confBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  confText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  ageText: {
    fontSize: 11,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
  },
  supportBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  supportHeader: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  supportNote: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 10,
    fontStyle: "italic",
  },
  dataGrid: {
    gap: 0,
  },
  dataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottomWidth: 1,
  },
  dataLabel: {
    fontSize: 12,
    flex: 1,
  },
  dataValue: {
    fontSize: 12,
    fontWeight: "700",
  },
  dismissBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  dismissText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
