import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";

type ColorKey = "teal" | "blue" | "amber" | "coral" | "pink" | "green";

type Props = {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  colorKey: ColorKey;
  sublabel?: string;
  onAction?: () => void;
};

// One card = one metric. Reused across Overview/Health/Finance tabs so the
// color-per-metric-type rule (steps=teal, sleep=blue, etc.) can't drift.
export function MetricCard({ label, value, icon, colorKey, sublabel, onAction }: Props) {
  const { theme } = useTheme();
  const c = theme[colorKey];

  return (
    <View style={[styles.card, { backgroundColor: c.bg }]}>
      <View style={styles.labelRow}>
        <Ionicons name={icon} size={15} color={c.fg} />
        <Text style={[styles.label, { color: c.sub }]}>{label}</Text>
      </View>
      <Text style={[styles.value, { color: c.fg }]}>{value}</Text>
      {sublabel ? <Text style={[styles.sublabel, { color: c.sub }]}>{sublabel}</Text> : null}
      {onAction ? (
        <Pressable onPress={onAction} style={[styles.actionButton, { backgroundColor: c.fg + "22" }]}>
          <Ionicons name="add" size={14} color={c.fg} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, padding: 14, flexGrow: 1, minWidth: 130 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  label: { fontSize: 12 },
  value: { fontSize: 21, fontWeight: "500" },
  sublabel: { fontSize: 12, marginTop: 4 },
  actionButton: { marginTop: 10, borderRadius: 8, padding: 5, alignSelf: "flex-end" },
});
