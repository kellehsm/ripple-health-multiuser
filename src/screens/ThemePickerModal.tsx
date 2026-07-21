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
  "morning-mist":   "Warm cream & soft greens — the classic default",
  "pale-sage":      "Botanical greens, terracotta & ochre — earthy calm",
  "blush-hour":     "Copper, tangerine & mauve — cozy warm pastels",
  "jewel-light":    "Sapphire, ruby & amethyst — crisp jewel contrast",
  "clean-slate":    "Pure grays & bold saturated accents — clean & modern",
  "midnight-steel": "Steel blue darks, bright teal & lavender — focused",
  "deep-navy":      "Deep navy, neon cyan & electric purple — AMOLED",
  "velvet-dusk":    "Deep plum, vivid rose & bright mint — evening glow",
  "forest-night":   "Dark forest, lime & sky blue — earthy night mode",
  "espresso":       "Rich espresso, terracotta & sage — warm dark comfort",
};

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ThemePickerModal({ visible, onClose }: Props) {
  const { theme, paletteId, setPalette } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={[styles.root, { backgroundColor: theme.page }]}>
        <View style={[styles.header, { borderBottomColor: theme.cardBorder }]}>
          <Text style={[styles.headerTitle, { color: theme.textStrong }]}>Appearance</Text>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={22} color={theme.ink} />
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
              {ids.map((id) => {
                const p = PALETTES[id];
                return (
                  <ThemeRow
                    key={id}
                    palette={p}
                    selected={paletteId === id}
                    onPress={() => { setPalette(id); onClose(); }}
                  />
                );
              })}
            </View>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Theme row ────────────────────────────────────────────────────────────────

type RowProps = {
  palette: Theme;
  selected: boolean;
  onPress: () => void;
};

function ThemeRow({ palette: p, selected, onPress }: RowProps) {
  // 7-color swatch: background, card surface, then 5 distinct accent roles
  const swatchColors = [
    p.page,
    p.card,
    p.teal.solid,
    p.coral.solid,
    p.amber.solid,
    p.berry.solid,
    p.violet.solid,
  ];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={`${p.name} theme — ${BEST_FOR[p.id] ?? ""}`}
      accessibilityState={{ checked: selected }}
      style={[
        styles.row,
        {
          backgroundColor: p.card,
          borderColor: selected ? p.teal.solid : p.cardBorder,
          borderWidth: selected ? 2.5 : 1.5,
        },
      ]}
    >
      {/* Color swatch strip */}
      <View style={styles.swatchStrip}>
        {swatchColors.map((color, i) => (
          <View
            key={i}
            style={[
              styles.swatchSegment,
              { backgroundColor: color },
              i === 0 && styles.swatchLeft,
              i === swatchColors.length - 1 && styles.swatchRight,
            ]}
          />
        ))}
      </View>

      {/* Name + checkmark */}
      <View style={styles.nameRow}>
        <Text style={[styles.themeName, { color: p.textStrong }]} numberOfLines={1}>
          {p.name}
        </Text>
        {selected
          ? <Ionicons name="checkmark-circle" size={20} color={p.teal.solid} />
          : <View style={styles.checkPlaceholder} />
        }
      </View>

      {/* Description */}
      <Text style={[styles.description, { color: p.textSoft }]} numberOfLines={1}>
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
  group: { marginBottom: 28 },
  groupLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  row: {
    borderRadius: 26,
    overflow: "hidden",
    marginBottom: 10,
  },
  swatchStrip: {
    flexDirection: "row",
    height: 56,
  },
  swatchSegment: {
    flex: 1,
  },
  swatchLeft: { borderTopLeftRadius: 12 },
  swatchRight: { borderTopRightRadius: 12 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 2,
  },
  themeName: { fontSize: 15, fontWeight: "800", flex: 1, marginRight: 6 },
  checkPlaceholder: { width: 20, height: 20 },
  description: { fontSize: 11, paddingHorizontal: 14, paddingBottom: 12, lineHeight: 15 },
});
