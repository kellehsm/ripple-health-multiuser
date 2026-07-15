import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";

type ColorKey = "teal" | "blue" | "amber" | "coral" | "pink" | "green" | "red" | "berry" | "violet" | "purple";

type Props = {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  colorKey: ColorKey;
  sublabel?: string;
  onAction?: () => void;
  // solid = saturated fill + white text; tint = light bg + colored dark text
  variant?: "solid" | "tint";
};

export function MetricCard({ label, value, icon, colorKey, sublabel, onAction, variant = "tint" }: Props) {
  const { theme } = useTheme();
  const ink = theme.ink;
  const c = (theme as any)[colorKey];

  const bg = variant === "solid" ? c.solid : c.tint;
  const textColor = variant === "solid" ? "#ffffff" : c.fg;
  const subColor = variant === "solid" ? "rgba(255,255,255,0.8)" : c.sub;
  const iconColor = variant === "solid" ? "rgba(255,255,255,0.9)" : c.fg;

  return (
    <View style={[styles.tile, { backgroundColor: bg, borderColor: ink, shadowColor: ink }]}>
      <View style={styles.labelRow}>
        <Ionicons name={icon} size={11} color={iconColor} />
        <Text style={[styles.label, { color: subColor }]}>{label.toUpperCase()}</Text>
      </View>
      <Text style={[styles.value, { color: textColor }]}>{value}</Text>
      {sublabel ? <Text style={[styles.sublabel, { color: subColor }]}>{sublabel}</Text> : null}
      {onAction ? (
        <Pressable
          onPress={onAction}
          style={[
            styles.actionButton,
            {
              backgroundColor: variant === "solid" ? "rgba(255,255,255,0.2)" : "#ffffff",
              borderColor: variant === "solid" ? "rgba(255,255,255,0.5)" : ink,
              shadowColor: ink,
            },
          ]}
        >
          <Ionicons name="add" size={11} color={variant === "solid" ? "#fff" : c.fg} />
          <Text style={[styles.actionLabel, { color: variant === "solid" ? "#fff" : c.fg }]}>+1</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 10,
    flexGrow: 1,
    minWidth: 130,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 },
  label: { fontSize: 10, fontWeight: "800", letterSpacing: 0.7 },
  value: { fontSize: 22, fontWeight: "800" },
  sublabel: { fontSize: 11, marginTop: 4 },
  actionButton: {
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  actionLabel: { fontSize: 10, fontWeight: "800" },
});
