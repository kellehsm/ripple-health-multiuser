import React, { useState } from "react";
import { ScrollView, View, Text, Pressable, StyleSheet } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { ThemePickerModal } from "../ThemePickerModal";
import { PALETTES } from "../../theme/palettes";

export function AppearanceSettingsScreen() {
  const { theme, paletteId } = useTheme();
  const [pickerVisible, setPickerVisible] = useState(false);

  return (
    <ScrollView style={{ backgroundColor: theme.page }} contentContainerStyle={styles.content}>
      <ThemePickerModal visible={pickerVisible} onClose={() => setPickerVisible(false)} />

      <Text style={[styles.groupLabel, { color: theme.textSoft }]}>THEME</Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionDesc, { color: theme.textSoft }]}>
          Choose a colour palette for the entire app.
        </Text>
        <Pressable
          onPress={() => setPickerVisible(true)}
          style={[styles.row, { borderColor: theme.cardBorder }]}
        >
          <View style={styles.swatches}>
            {[theme.teal.solid, theme.coral.solid, theme.berry.solid, theme.purple.solid, theme.blue.solid].map((c, i) => (
              <View key={i} style={[styles.swatch, { backgroundColor: c }]} />
            ))}
          </View>
          <Text style={[styles.rowName, { color: theme.textStrong }]}>
            {PALETTES[paletteId]?.name ?? "Choose theme"}
          </Text>
          <Text style={[styles.chevron, { color: theme.textSoft }]}>›</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  groupLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 0.6, marginTop: 4, marginBottom: -4 },
  card: { borderRadius: 22, borderWidth: 2, padding: 16, gap: 8 },
  sectionDesc: { fontSize: 12, marginBottom: 4 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, marginTop: 4,
  },
  swatches: { flexDirection: "row", gap: 3 },
  swatch: { width: 14, height: 14, borderRadius: 7 },
  rowName: { flex: 1, fontSize: 14, fontWeight: "600" },
  chevron: { fontSize: 20, lineHeight: 22 },
});
