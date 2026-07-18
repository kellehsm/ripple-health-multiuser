import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useTabPreferences } from '../hooks/useTabPreferences';

type HealthSubTab = 'medication' | 'cycle';

export function HealthTabScreen() {
  const { theme } = useTheme();
  const { preferences } = useTabPreferences();
  const { medication, cycle } = preferences.health;

  const bothEnabled = medication && cycle;
  const [activeSubTab, setActiveSubTab] = useState<HealthSubTab>('medication');

  if (!medication && !cycle) {
    return (
      <View style={[styles.center, { backgroundColor: theme.page }]}>
        <Text style={[styles.placeholder, { color: theme.textSoft }]}>
          No health modules enabled. Go to Settings → Customize Tabs to turn them on.
        </Text>
      </View>
    );
  }

  const effectiveTab: HealthSubTab = bothEnabled
    ? activeSubTab
    : medication
    ? 'medication'
    : 'cycle';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.page }} contentContainerStyle={styles.container}>
      {bothEnabled && (
        <View style={[styles.chipRow, { borderBottomColor: theme.cardBorder }]}>
          {(['medication', 'cycle'] as HealthSubTab[]).map((tab) => (
            <Pressable
              key={tab}
              style={[
                styles.chip,
                {
                  backgroundColor: effectiveTab === tab ? theme.coral.bg : theme.card,
                  borderColor: effectiveTab === tab ? theme.coral.solid : theme.cardBorder,
                  borderWidth: effectiveTab === tab ? 2 : 1,
                },
              ]}
              onPress={() => setActiveSubTab(tab)}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: effectiveTab === tab ? theme.coral.sub : theme.textSoft, fontWeight: effectiveTab === tab ? '700' : '400' },
                ]}
              >
                {tab === 'medication' ? '💊 Medication' : '🩸 Cycle'}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.content}>
        <Text style={[styles.placeholder, { color: theme.textSoft }]}>
          {effectiveTab === 'medication'
            ? '💊 Medication logging coming soon.'
            : '🩸 Cycle tracking coming soon.'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  container: {
    flexGrow: 1,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderBottomWidth: 1,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  chipText: {
    fontSize: 13,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    minHeight: 200,
  },
  placeholder: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
});
