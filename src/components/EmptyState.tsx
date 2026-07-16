import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTheme } from "../theme/ThemeContext";

interface EmptyStateProps {
  emoji?: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ emoji = "📭", title, message, actionLabel, onAction }: EmptyStateProps) {
  const { theme } = useTheme();
  const ink = theme.ink;

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: ink }]}>
      {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
      <Text style={[styles.title, { color: theme.textStrong }]}>{title}</Text>
      {message ? <Text style={[styles.message, { color: theme.textSoft }]}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={[styles.actionBtn, { borderColor: ink }]}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={[styles.actionText, { color: theme.textStrong }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 2,
    padding: 28,
    alignItems: "center",
    gap: 8,
  },
  emoji: { fontSize: 36, marginBottom: 4 },
  title: { fontSize: 16, fontWeight: "800", textAlign: "center" },
  message: { fontSize: 13, lineHeight: 19, textAlign: "center" },
  actionBtn: {
    marginTop: 8,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  actionText: { fontSize: 13, fontWeight: "700" },
});
