import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export function ExerciseScreen() {
  const { theme } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.page }]}>
      <Text style={{ fontSize: 48 }}>🏃</Text>
      <Text style={[styles.title, { color: theme.textStrong }]}>Exercise</Text>
      <Text style={[styles.sub, { color: theme.textSoft }]}>Coming soon — workout logging and activity tracking.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  title: { fontSize: 22, fontWeight: '800' },
  sub: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
