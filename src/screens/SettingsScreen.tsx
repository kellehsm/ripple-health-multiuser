import React, { useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  Switch,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { api } from "../api/client";
import { USER_ID } from "../api/config";

const WEEK_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Settings = {
  week_start?: { water?: number; sleep?: number; steps?: number; hobbies?: number };
  health_connect?: {
    auto_sync_enabled?: boolean;
    sync_steps?: boolean;
    sync_sleep?: boolean;
    sync_heart_rate?: boolean;
  };
  dexcom?: {
    share_account_id?: string;
    share_region?: string;
    share_password_set?: boolean;
  };
};

export function SettingsScreen() {
  const { theme } = useTheme();
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dexcomAccountId, setDexcomAccountId] = useState("");
  const [dexcomPassword, setDexcomPassword] = useState("");
  const [dexcomRegion, setDexcomRegion] = useState<"us" | "ous">("us");

  const load = useCallback(async function () {
    try {
      const s = await api.getSettings(USER_ID);
      setSettings(s ?? {});
      setDexcomAccountId(s?.dexcom?.share_account_id ?? "");
      setDexcomRegion(s?.dexcom?.share_region === "ous" ? "ous" : "us");
    } catch (e) {
      console.error("Failed to load settings", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(function () { load(); }, [load]);

  async function save(patch: Record<string, unknown>) {
    setSaving(true);
    try {
      await api.patchSettings(USER_ID, patch);
      await load();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDexcom() {
    await save({
      dexcom: {
        share_account_id: dexcomAccountId.trim(),
        share_password: dexcomPassword,
        share_region: dexcomRegion,
      },
    });
    setDexcomPassword("");
    Alert.alert("Saved", "Dexcom credentials updated.");
  }

  function setWeekStart(section: string, dayIndex: number) {
    const updated = {
      week_start: {
        ...(settings.week_start ?? {}),
        [section]: dayIndex,
      },
    };
    setSettings((prev) => ({ ...prev, ...updated }));
    save(updated);
  }

  function setHcToggle(key: string, value: boolean) {
    const updated = {
      health_connect: {
        ...(settings.health_connect ?? {}),
        [key]: value,
      },
    };
    setSettings((prev) => ({ ...prev, ...updated }));
    save(updated);
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.page }]}>
        <ActivityIndicator color={theme.teal.bar} />
      </View>
    );
  }

  const hc = settings.health_connect ?? {};
  const ws = settings.week_start ?? {};

  return (
    <ScrollView style={{ backgroundColor: theme.page }} contentContainerStyle={styles.content}>
      {/* Week start preferences */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.textStrong }]}>Week Start Day</Text>
        <Text style={[styles.sectionDesc, { color: theme.textSoft }]}>
          Controls the "this week" calculation for each section.
        </Text>
        {(["water", "sleep", "steps", "hobbies"] as const).map((section) => {
          const current = (ws as any)[section] ?? 1;
          return (
            <View key={section} style={styles.weekRow}>
              <Text style={[styles.weekLabel, { color: theme.textStrong }]}>
                {section.charAt(0).toUpperCase() + section.slice(1)}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll}>
                {WEEK_DAYS.map((day, i) => (
                  <Pressable
                    key={day}
                    onPress={() => setWeekStart(section, i)}
                    style={[
                      styles.dayChip,
                      {
                        backgroundColor: current === i ? theme.teal.bar : theme.page,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                  >
                    <Text style={{ color: current === i ? "#fff" : theme.textSoft, fontSize: 12 }}>
                      {day.slice(0, 3)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          );
        })}
      </View>

      {/* Health Connect sync toggles */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.textStrong }]}>Health Connect Sync</Text>
        {saving ? <ActivityIndicator size="small" style={styles.savingIndicator} /> : null}
        <ToggleRow
          label="Auto-sync enabled"
          value={hc.auto_sync_enabled !== false}
          onChange={(v) => setHcToggle("auto_sync_enabled", v)}
          theme={theme}
        />
        <ToggleRow
          label="Sync steps"
          value={hc.sync_steps !== false}
          onChange={(v) => setHcToggle("sync_steps", v)}
          theme={theme}
        />
        <ToggleRow
          label="Sync sleep"
          value={hc.sync_sleep !== false}
          onChange={(v) => setHcToggle("sync_sleep", v)}
          theme={theme}
        />
        <ToggleRow
          label="Sync heart rate"
          value={hc.sync_heart_rate !== false}
          onChange={(v) => setHcToggle("sync_heart_rate", v)}
          theme={theme}
        />
      </View>

      {/* Dexcom credentials */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.textStrong }]}>Dexcom Share</Text>
        <Text style={[styles.sectionDesc, { color: theme.textSoft }]}>
          Credentials are stored on the server and never returned to the app after saving.
        </Text>

        <Text style={[styles.fieldLabel, { color: theme.textSoft }]}>Account ID</Text>
        <TextInput
          value={dexcomAccountId}
          onChangeText={setDexcomAccountId}
          placeholder="Dexcom account ID (UUID)"
          placeholderTextColor={theme.textSoft}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.textInput, { color: theme.textStrong, borderColor: theme.cardBorder, backgroundColor: theme.page }]}
        />

        <Text style={[styles.fieldLabel, { color: theme.textSoft }]}>
          Password {settings.dexcom?.share_password_set ? "(currently set — leave blank to keep)" : ""}
        </Text>
        <TextInput
          value={dexcomPassword}
          onChangeText={setDexcomPassword}
          placeholder={settings.dexcom?.share_password_set ? "Leave blank to keep existing" : "Password"}
          placeholderTextColor={theme.textSoft}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.textInput, { color: theme.textStrong, borderColor: theme.cardBorder, backgroundColor: theme.page }]}
        />

        <Text style={[styles.fieldLabel, { color: theme.textSoft }]}>Region</Text>
        <View style={styles.regionRow}>
          {(["us", "ous"] as const).map((r) => (
            <Pressable
              key={r}
              onPress={() => setDexcomRegion(r)}
              style={[
                styles.regionChip,
                {
                  backgroundColor: dexcomRegion === r ? theme.teal.bar : theme.page,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <Text style={{ color: dexcomRegion === r ? "#fff" : theme.textSoft, fontSize: 13 }}>
                {r === "us" ? "US" : "Outside US"}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={handleSaveDexcom}
          disabled={saving}
          style={[styles.saveButton, { backgroundColor: theme.teal.bg, borderColor: theme.teal.sub }]}
        >
          <Text style={{ color: theme.teal.fg, fontWeight: "500" }}>Save Dexcom credentials</Text>
        </Pressable>
      </View>

      {/* Export (placeholder for future PDF export spec) */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.textStrong }]}>Export</Text>
        <Text style={[styles.sectionDesc, { color: theme.textSoft }]}>
          Health report export will appear here.
        </Text>
      </View>
    </ScrollView>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  theme,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  theme: any;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={{ color: theme.textStrong, flex: 1 }}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.cardBorder, true: theme.teal.bar }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { borderRadius: 14, borderWidth: 0.5, padding: 16, gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  sectionDesc: { fontSize: 12, marginBottom: 4 },
  weekRow: { gap: 6 },
  weekLabel: { fontSize: 13 },
  dayScroll: { flexGrow: 0 },
  dayChip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginRight: 6 },
  toggleRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  fieldLabel: { fontSize: 12, marginTop: 8 },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    marginTop: 4,
  },
  regionRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  regionChip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  saveButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 8,
  },
  savingIndicator: { alignSelf: "flex-end" },
});
