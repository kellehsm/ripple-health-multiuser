import React from "react";
import {
  Modal,
  SafeAreaView,
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { PALETTES, PALETTE_GROUPS } from "../theme/palettes";
import type { Theme } from "../theme/theme";

const BEST_FOR: Record<string, string> = {
  "morning-mist":   "Daily wellness trackers, morning routines",
  "garden-path":    "Mindful eating, nutrition-focused users",
  "clinical-trust": "Medical monitoring, glucose management",
  "precision-slate":"Data-heavy use, professional review",
  "midnight-neon":  "Night-shift, AMOLED screens, tech fans",
  "carbon-arc":     "Evening review, low-light comfort",
  "onyx-gold":      "Premium feel, health optimization",
  "velvet-plum":    "Wellness journaling, mood tracking",
  "forest-floor":   "Outdoor athletes, nature lovers",
  "vivid-motion":   "Fitness motivation, step goals",
  "pure-clarity":   "iOS familiarity, minimal style",
  "still-water":    "ADHD, focus, reduced distraction",
};

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ThemePickerModal({ visible, onClose }: Props) {
  const { theme, paletteId, setPalette } = useTheme();
  const ink = theme.ink;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={[styles.root, { backgroundColor: theme.page }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.cardBorder }]}>
          <Text style={[styles.headerTitle, { color: theme.textStrong }]}>Appearance</Text>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={22} color={ink} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {Object.entries(PALETTE_GROUPS).map(([groupName, ids]) => (
            <View key={groupName} style={styles.group}>
              <Text style={[styles.groupLabel, { color: theme.textSoft }]}>
                {groupName.toUpperCase()}
              </Text>
              <View style={ids.length > 1 ? styles.row2 : styles.row1}>
                {ids.map((id) => {
                  const p = PALETTES[id];
                  const selected = paletteId === id;
                  return (
                    <PaletteCard
                      key={id}
                      palette={p}
                      selected={selected}
                      wide={ids.length === 1}
                      activeInk={ink}
                      onPress={() => { setPalette(id); onClose(); }}
                    />
                  );
                })}
              </View>
            </View>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Palette card ─────────────────────────────────────────────────────────────

type CardProps = {
  palette: Theme;
  selected: boolean;
  wide: boolean;
  activeInk: string;
  onPress: () => void;
};

function PaletteCard({ palette: p, selected, wide, activeInk, onPress }: CardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        wide && styles.cardWide,
        {
          backgroundColor: p.card,
          borderColor: selected ? p.teal.solid : p.cardBorder,
          borderWidth: selected ? 3 : 2,
          shadowColor: activeInk,
          shadowOffset: { width: selected ? 3 : 2, height: selected ? 3 : 2 },
          shadowOpacity: selected ? 0.9 : 0.4,
          shadowRadius: 0,
          elevation: selected ? 4 : 2,
        },
      ]}
    >
      {/* Swatch strip */}
      <View style={styles.swatchRow}>
        {[p.ink, p.page, p.teal.solid, p.coral.solid, p.berry.solid].map((color, i) => (
          <View
            key={i}
            style={[
              styles.swatch,
              { backgroundColor: color },
              i === 0 && styles.swatchFirst,
              i === 4 && styles.swatchLast,
            ]}
          />
        ))}
      </View>

      {/* Name + checkmark row */}
      <View style={styles.nameRow}>
        <Text style={[styles.paletteName, { color: p.textStrong }]} numberOfLines={1}>
          {p.name}
        </Text>
        {selected && (
          <Ionicons name="checkmark-circle" size={16} color={p.teal.solid} />
        )}
      </View>

      {/* Best for */}
      <Text style={[styles.bestFor, { color: p.textSoft }]} numberOfLines={2}>
        {BEST_FOR[p.id] ?? ""}
      </Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  closeBtn: { padding: 4 },
  scroll: { paddingHorizontal: 16, paddingTop: 20 },
  group: { marginBottom: 24 },
  groupLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  row2: { flexDirection: "row", gap: 10 },
  row1: { flexDirection: "row" },
  card: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
    padding: 0,
  },
  cardWide: { flex: 1 },
  swatchRow: {
    flexDirection: "row",
    height: 48,
  },
  swatch: {
    flex: 1,
  },
  swatchFirst: { borderTopLeftRadius: 12 },
  swatchLast: { borderTopRightRadius: 12 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 2,
  },
  paletteName: { fontSize: 13, fontWeight: "800", flex: 1, marginRight: 4 },
  bestFor: { fontSize: 10, paddingHorizontal: 10, paddingBottom: 10, lineHeight: 14 },
});
