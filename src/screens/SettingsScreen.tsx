import React, { useCallback, useState } from "react";
import { ScrollView, View, Text, Pressable, StyleSheet, Alert } from "react-native";
import { LoadingIndicator } from "../components/LoadingIndicator";
import { useFocusEffect } from "@react-navigation/core";
import { useNavigation } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import { useTheme } from "../theme/ThemeContext";
import { PALETTES } from "../theme/palettes";
import { api } from "../api/client";
import { logout } from "../lib/auth";

type Journey = { total_meals: number; total_mood_checkins: number; total_active_days: number; member_since: string | null };

function MenuRow({ title, subtitle, onPress, theme, accent }: {
  title: string; subtitle?: string; onPress: () => void; theme: any; accent?: string;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.row, { borderColor: theme.cardBorder }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: accent ?? theme.textStrong, fontSize: 15, fontWeight: "600" }}>{title}</Text>
        {subtitle ? <Text style={{ color: theme.textSoft, fontSize: 12, marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      <Text style={{ color: theme.textSoft, fontSize: 22, lineHeight: 26 }}>›</Text>
    </Pressable>
  );
}

export function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { theme, paletteId } = useTheme();
  const [journey, setJourney] = useState<Journey | null>(null);
  const [journeyLoading, setJourneyLoading] = useState(true);

  // Cancel legacy expo-notifications on every Settings open
  useFocusEffect(useCallback(() => {
    Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
    setJourneyLoading(true);
    api.journey().then(setJourney).catch(() => {}).finally(() => setJourneyLoading(false));
  }, []));

  function nav(screen: string) { navigation.navigate(screen); }

  return (
    <ScrollView style={{ backgroundColor: theme.page }} contentContainerStyle={styles.content}>

      {/* Journey — top of settings */}
      {journeyLoading ? (
        <View style={[styles.journeyCard, { backgroundColor: theme.teal.tint, borderColor: theme.ink }]}>
          <LoadingIndicator size="small" color={theme.teal.fg} />
        </View>
      ) : journey ? (
        <View style={[styles.journeyCard, { backgroundColor: theme.teal.tint, borderColor: theme.ink }]}>
          <Text style={[styles.journeyTitle, { color: theme.teal.fg }]}>Your journey so far</Text>
          {journey.member_since && (
            <Text style={{ color: theme.teal.sub, fontSize: 12, marginBottom: 12 }}>
              Member since {new Date(journey.member_since).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </Text>
          )}
          <View style={{ flexDirection: "row", gap: 10 }}>
            {[
              { value: journey.total_meals, label: "meals logged" },
              { value: journey.total_mood_checkins, label: "mood check-ins" },
              { value: journey.total_active_days, label: "active days" },
            ].map((stat) => (
              <View key={stat.label} style={[styles.statChip, { backgroundColor: theme.card, borderColor: theme.teal.sub }]}>
                <Text style={{ color: theme.teal.fg, fontSize: 22, fontWeight: "800" }}>{stat.value}</Text>
                <Text style={{ color: theme.teal.sub, fontSize: 11, fontWeight: "600" }}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Appearance */}
      <Text style={[styles.groupLabel, { color: theme.textSoft }]}>APPEARANCE</Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.ink }]}>
        <MenuRow title="Theme" subtitle={PALETTES[paletteId]?.name} onPress={() => nav("SettingsAppearance")} theme={theme} />
        <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />
        <MenuRow title="Customize Tabs" subtitle="Choose which tabs appear in the bottom bar" onPress={() => nav("SettingsCustomizeTabs")} theme={theme} />
      </View>

      {/* Data Sources */}
      <Text style={[styles.groupLabel, { color: theme.textSoft }]}>DATA SOURCES</Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.ink }]}>
        <MenuRow title="Health Connect" subtitle="Sync, permissions & live tracking" onPress={() => nav("SettingsHealthConnect")} theme={theme} />
        <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />
        <MenuRow title="Dexcom" subtitle="CGM credentials" onPress={() => nav("SettingsDexcom")} theme={theme} />
      </View>

      {/* Notifications */}
      <Text style={[styles.groupLabel, { color: theme.textSoft }]}>NOTIFICATIONS</Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.ink }]}>
        <MenuRow title="Notifications" subtitle="Smart reminders, mute & schedules" onPress={() => nav("SettingsNotifications")} theme={theme} />
        <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />
        <MenuRow title="Always-on Tracking" subtitle="Persistent notification & background sync" onPress={() => nav("SettingsTracking")} theme={theme} />
      </View>

      {/* Security */}
      <Text style={[styles.groupLabel, { color: theme.textSoft }]}>SECURITY</Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.ink }]}>
        <MenuRow title="App Lock" subtitle="Biometric unlock" onPress={() => nav("SettingsSecurity")} theme={theme} />
      </View>

      {/* Preferences */}
      <Text style={[styles.groupLabel, { color: theme.textSoft }]}>PREFERENCES</Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.ink }]}>
        <MenuRow title="Preferences" subtitle="Week start day & home screen" onPress={() => nav("SettingsPreferences")} theme={theme} />
      </View>

      {/* Export & Backup */}
      <Text style={[styles.groupLabel, { color: theme.textSoft }]}>EXPORT & BACKUP</Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.ink }]}>
        <MenuRow title="Export & Backup" subtitle="PDF report, JSON export & Google Drive" onPress={() => nav("SettingsExportBackup")} theme={theme} />
      </View>

      {/* Help */}
      <Text style={[styles.groupLabel, { color: theme.textSoft }]}>HELP</Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.ink }]}>
        <MenuRow title="Help & FAQ" onPress={() => nav("Help")} theme={theme} />
      </View>

      {/* Account */}
      <Text style={[styles.groupLabel, { color: theme.textSoft }]}>ACCOUNT</Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.ink }]}>
        <MenuRow
          title="Sign out"
          onPress={() => {
            Alert.alert("Sign out", "You'll need to sign in again to access your data.", [
              { text: "Cancel", style: "cancel" },
              { text: "Sign out", style: "destructive", onPress: () => logout() },
            ]);
          }}
          theme={theme}
          accent={theme.coral?.fg}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  groupLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginTop: 4, marginBottom: -4 },
  card: { borderRadius: 14, borderWidth: 2, overflow: "hidden" },
  row: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 0,
  },
  divider: { height: 1, marginHorizontal: 16 },
  journeyCard: { borderRadius: 14, borderWidth: 2, padding: 16, gap: 4, alignItems: "flex-start" },
  journeyTitle: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  statChip: { flex: 1, borderWidth: 1.5, borderRadius: 10, padding: 10, alignItems: "center", gap: 2 },
});
