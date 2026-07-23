import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModuleId, ModuleDefinition, MODULE_DEFINITIONS, TabPreferences } from '../types/tabPreferences';
import { useTheme } from '../theme/ThemeContext';
import type { Theme } from '../theme/theme';

interface BottomNavProps {
  preferences: TabPreferences;
  activeRoute: ModuleId | 'home';
  onNavigate: (route: ModuleId | 'home') => void;
}

function splitAroundHome(selected: ModuleDefinition[]) {
  const half = Math.floor(selected.length / 2);
  return { left: selected.slice(0, half), right: selected.slice(half) };
}

export function BottomNav({ preferences, activeRoute, onNavigate }: BottomNavProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const selectedDefs = useMemo(
    () => MODULE_DEFINITIONS.filter((m) => preferences.selectedModules.includes(m.id)),
    [preferences.selectedModules]
  );
  const { left, right } = useMemo(() => splitAroundHome(selectedDefs), [selectedDefs]);

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.page,
          borderTopColor: theme.ink,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      {left.map((mod) => (
        <NavIcon
          key={mod.id}
          def={mod}
          active={activeRoute === mod.id}
          onPress={() => onNavigate(mod.id)}
          theme={theme}
        />
      ))}

      {/* Fixed-width center slot for the raised Home button */}
      <View style={styles.homeSlot}>
        <Pressable
          onPress={() => onNavigate('home')}
          style={[styles.homeButton, { borderColor: theme.ink, shadowColor: theme.ink }]}
          accessibilityRole="button"
          accessibilityLabel="Home"
        >
          {/* 4-quadrant Ripple icon */}
          <View style={{ flexDirection: 'row', height: 26 }}>
            <View style={{ flex: 1, backgroundColor: theme.teal.solid }} />
            <View style={{ flex: 1, backgroundColor: theme.coral.solid }} />
          </View>
          <View style={{ flexDirection: 'row', height: 26 }}>
            <View style={{ flex: 1, backgroundColor: theme.purple.solid }} />
            <View style={{ flex: 1, backgroundColor: theme.berry.solid }} />
          </View>
          <View style={styles.homeEmojiOverlay}>
            <Text style={styles.homeEmoji}>🏠</Text>
          </View>
        </Pressable>
      </View>

      {right.map((mod) => (
        <NavIcon
          key={mod.id}
          def={mod}
          active={activeRoute === mod.id}
          onPress={() => onNavigate(mod.id)}
          theme={theme}
        />
      ))}
    </View>
  );
}

function NavIcon({
  def,
  active,
  onPress,
  theme,
}: {
  def: ModuleDefinition;
  active: boolean;
  onPress: () => void;
  theme: Theme;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.iconSlot}
      accessibilityRole="button"
      accessibilityLabel={def.label}
    >
      <Text style={[styles.emoji, { opacity: active ? 1 : 0.45 }]}>{def.emoji}</Text>
      <Text
        style={[
          styles.label,
          { color: active ? theme.ink : theme.textSoft, fontWeight: active ? '700' : '400' },
        ]}
      >
        {def.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 8,
    paddingHorizontal: 4,
    borderTopWidth: 2,
  },
  iconSlot: {
    flex: 1,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 2,
  },
  emoji: {
    fontSize: 21,
    textAlign: 'center',
  },
  label: {
    fontSize: 10,
    marginTop: 2,
  },
  homeSlot: {
    flexBasis: 64,
    flexGrow: 0,
    flexShrink: 0,
    height: 44,
    alignItems: 'center',
  },
  homeButton: {
    position: 'absolute',
    bottom: 6,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 2.5,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 7,
  },
  homeEmojiOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeEmoji: {
    fontSize: 24,
  },
});
