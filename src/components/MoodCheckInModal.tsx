import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../theme/ThemeContext";
import { onSolid } from "../theme/colorUtils";
import { api } from "../api/client";
import { toast } from "../lib/toast";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MoodPeriod = "morning" | "afternoon" | "evening" | "night";

interface MoodDef {
  label: string;
  emoji: string;
  score: number;
  categoryColor: string;
}

interface MoodCategory {
  label: string;
  colorKey: string;
  moods: Omit<MoodDef, "score" | "categoryColor">[];
  score: number;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const PERIOD_META: Record<MoodPeriod, { label: string; emoji: string }> = {
  morning:   { label: "Morning",   emoji: "🌅" },
  afternoon: { label: "Afternoon", emoji: "☀️" },
  evening:   { label: "Evening",   emoji: "🌆" },
  night:     { label: "Night",     emoji: "🌙" },
};

const MOOD_CATEGORIES: MoodCategory[] = [
  {
    label: "Happy",
    colorKey: "violet",
    score: 5,
    moods: [
      { label: "Joyful",    emoji: "😄" },
      { label: "Grateful",  emoji: "🙏" },
      { label: "Excited",   emoji: "🤩" },
      { label: "Content",   emoji: "😌" },
      { label: "Proud",     emoji: "💪" },
    ],
  },
  {
    label: "Calm",
    colorKey: "teal",
    score: 4,
    moods: [
      { label: "Relaxed",   emoji: "😊" },
      { label: "Peaceful",  emoji: "☮️" },
      { label: "Focused",   emoji: "🎯" },
      { label: "Hopeful",   emoji: "🌟" },
      { label: "Refreshed", emoji: "🌿" },
    ],
  },
  {
    label: "Okay",
    colorKey: "blue",
    score: 3,
    moods: [
      { label: "Okay",       emoji: "😐" },
      { label: "Tired",      emoji: "😴" },
      { label: "Distracted", emoji: "😶" },
      { label: "Bored",      emoji: "😑" },
      { label: "Meh",        emoji: "🤷" },
    ],
  },
  {
    label: "Sad",
    colorKey: "coral",
    score: 2,
    moods: [
      { label: "Melancholy",    emoji: "😢" },
      { label: "Lonely",        emoji: "😞" },
      { label: "Disappointed",  emoji: "😔" },
      { label: "Empty",         emoji: "😶‍🌫️" },
      { label: "Drained",       emoji: "🥱" },
    ],
  },
  {
    label: "Stressed",
    colorKey: "red",
    score: 1,
    moods: [
      { label: "Frustrated",  emoji: "😤" },
      { label: "Overwhelmed", emoji: "😫" },
      { label: "Anxious",     emoji: "😰" },
      { label: "Irritated",   emoji: "😠" },
      { label: "Stressed",    emoji: "😣" },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  period: MoodPeriod;
  onDismiss: () => void;
  onSubmitted: () => void;
}

export function MoodCheckInModal({ visible, period, onDismiss, onSubmitted }: Props) {
  const { theme } = useTheme();
  const ink = theme.ink;

  const [selected, setSelected] = useState<{ label: string; score: number; colorKey: string } | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const meta = PERIOD_META[period];

  function handleSelect(mood: Omit<MoodDef, "score" | "categoryColor">, score: number, colorKey: string) {
    Haptics.selectionAsync();
    setSelected({ label: mood.label, score, colorKey });
  }

  async function handleLog() {
    if (!selected) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSubmitting(true);
    try {
      await api.upsertPeriodMood(selected.score, period, selected.label, note.trim() || undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast("Check-in saved.");
      setSelected(null);
      setNote("");
      onSubmitted();
    } catch {
      toast("Couldn't save — try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDismiss() {
    setSelected(null);
    setNote("");
    onDismiss();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={handleDismiss} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.sheetWrapper}
        pointerEvents="box-none"
      >
        <View style={[styles.sheet, { backgroundColor: theme.page, borderColor: ink }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: ink }]}>
            <View>
              <Text style={[styles.periodLabel, { color: theme.textSoft }]}>
                {meta.emoji}  {meta.label.toUpperCase()}
              </Text>
              <Text style={[styles.headerTitle, { color: theme.textStrong }]}>
                How are you feeling?
              </Text>
            </View>
            <Pressable onPress={handleDismiss} style={[styles.closeBtn, { borderColor: ink }]} accessibilityLabel="Dismiss">
              <Text style={[styles.closeBtnText, { color: ink }]}>✕</Text>
            </Pressable>
          </View>

          {/* Mood categories */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {MOOD_CATEGORIES.map((cat) => {
              const catColor = (theme as any)[cat.colorKey];
              return (
                <View key={cat.label} style={styles.category}>
                  <View style={styles.catHeader}>
                    <View style={[styles.catDot, { backgroundColor: catColor?.solid ?? ink }]} />
                    <Text style={[styles.catLabel, { color: theme.textSoft }]}>{cat.label.toUpperCase()}</Text>
                  </View>
                  <View style={styles.moodRow}>
                    {cat.moods.map((mood) => {
                      const isSelected = selected?.label === mood.label;
                      const c = catColor;
                      return (
                        <Pressable
                          key={mood.label}
                          onPress={() => handleSelect(mood, cat.score, cat.colorKey)}
                          style={[
                            styles.moodTile,
                            {
                              backgroundColor: isSelected ? (c?.tint ?? theme.card) : theme.card,
                              borderColor: isSelected ? (c?.solid ?? ink) : ink,
                              borderWidth: isSelected ? 2.5 : 2,
                              shadowColor: ink,
                              shadowOffset: { width: isSelected ? 3 : 2, height: isSelected ? 3 : 2 },
                              elevation: isSelected ? 4 : 2,
                            },
                          ]}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: isSelected }}
                          accessibilityLabel={mood.label}
                        >
                          <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                          <Text style={[styles.moodLabel, { color: isSelected ? (c?.fg ?? ink) : theme.textSoft }]}>
                            {mood.label.toUpperCase()}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            {/* Note input */}
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Anything on your mind? (optional)"
              placeholderTextColor={theme.textSoft}
              style={[styles.noteInput, { color: theme.textStrong, borderColor: ink, backgroundColor: theme.card }]}
              multiline
              accessibilityLabel="Mood note"
            />
          </ScrollView>

          {/* Actions */}
          <View style={[styles.actions, { borderTopColor: ink }]}>
            <Pressable
              onPress={handleDismiss}
              style={[styles.skipBtn, { borderColor: ink }]}
              accessibilityRole="button"
              accessibilityLabel="Skip"
            >
              <Text style={[styles.skipText, { color: theme.textSoft }]}>SKIP</Text>
            </Pressable>
            <Pressable
              onPress={handleLog}
              disabled={!selected || submitting}
              style={[
                styles.logBtn,
                {
                  backgroundColor: selected ? theme.coral.solid : theme.cardBorder ?? ink,
                  opacity: selected ? 1 : 0.4,
                  borderColor: ink,
                  shadowColor: ink,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Log mood"
            >
              {submitting
                ? <ActivityIndicator size="small" color={onSolid(selected ? theme.coral.solid : (theme.cardBorder ?? theme.ink))} />
                : <Text style={[styles.logText, { color: onSolid(selected ? theme.coral.solid : (theme.cardBorder ?? theme.ink)) }]}>LOG</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheetWrapper: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 2,
    borderBottomWidth: 0,
    maxHeight: "82%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 18,
    borderBottomWidth: 2,
  },
  periodLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: "800",
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  category: {
    gap: 8,
  },
  catHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  catDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  catLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  moodRow: {
    flexDirection: "row",
    gap: 6,
  },
  moodTile: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: 10,
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  moodEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  moodLabel: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  noteInput: {
    borderWidth: 2,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 56,
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    borderTopWidth: 2,
  },
  skipBtn: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  skipText: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
  },
  logBtn: {
    flex: 2,
    borderWidth: 2,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  logText: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
  },
});
