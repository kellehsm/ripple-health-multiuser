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
  Platform,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as IntentLauncher from "expo-intent-launcher";
import notifee, { AuthorizationStatus } from "@notifee/react-native";
import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import { useTheme } from "../theme/ThemeContext";
import { api } from "../api/client";
import { USER_ID } from "../api/config";
import { requestHealthPermissions } from "../lib/healthConnect";
import {
  startForegroundService,
  stopForegroundService,
  isForegroundServiceRunning,
} from "../lib/foregroundService";

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
  mood_reminders?: {
    enabled?: boolean;
    periods?: { morning?: boolean; afternoon?: boolean; evening?: boolean; night?: boolean };
  };
};

const REMINDER_PERIODS: { key: string; label: string; hour: number; minute: number }[] = [
  { key: "morning", label: "Morning", hour: 9, minute: 0 },
  { key: "afternoon", label: "Afternoon", hour: 14, minute: 0 },
  { key: "evening", label: "Evening", hour: 19, minute: 0 },
  { key: "night", label: "Night", hour: 22, minute: 0 },
];

export function SettingsScreen() {
  const { theme } = useTheme();
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dexcomAccountId, setDexcomAccountId] = useState("");
  const [dexcomPassword, setDexcomPassword] = useState("");
  const [dexcomRegion, setDexcomRegion] = useState<"us" | "ous">("us");
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);
  const [trackingBusy, setTrackingBusy] = useState(false);

  const defaultEnd = new Date().toISOString().slice(0, 10);
  const defaultStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [exportStart, setExportStart] = useState(defaultStart);
  const [exportEnd, setExportEnd] = useState(defaultEnd);
  const [exporting, setExporting] = useState(false);

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

  useEffect(function () {
    if (Platform.OS !== "android") return;
    isForegroundServiceRunning().then(setTrackingEnabled).catch(() => {});
    notifee.getNotificationSettings().then((s) => {
      setNotifGranted(s.authorizationStatus === AuthorizationStatus.AUTHORIZED);
    }).catch(() => {});
  }, []);

  async function handleTrackingToggle(value: boolean) {
    if (!value) {
      try {
        await stopForegroundService();
      } catch (_) {}
      setTrackingEnabled(false);
      return;
    }

    setTrackingBusy(true);
    try {
      // Step 1: notification permission
      const settings = await notifee.requestPermission();
      const granted = settings.authorizationStatus === AuthorizationStatus.AUTHORIZED;
      setNotifGranted(granted);
      if (!granted) {
        Alert.alert(
          "Notification permission required",
          "Without this permission the persistent notification can't appear. Open notification settings to enable it.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open settings",
              onPress: () => {
                IntentLauncher.startActivityAsync(
                  "android.settings.APP_NOTIFICATION_SETTINGS",
                  { extra: { "android.provider.extra.APP_PACKAGE": "com.kellehs.wellness" } }
                ).catch(() => IntentLauncher.startActivityAsync("android.settings.APPLICATION_DETAILS_SETTINGS", {
                  data: "package:com.kellehs.wellness",
                }));
              },
            },
          ]
        );
        return;
      }

      // Step 2: battery optimization exemption
      await IntentLauncher.startActivityAsync(
        "android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
        { data: "package:com.kellehs.wellness" }
      ).catch(() => {});

      // Step 3: Health Connect permissions
      const hcGranted = await requestHealthPermissions();
      if (!hcGranted) {
        Alert.alert(
          "Health Connect permissions needed",
          "Grant Health Connect permissions so the notification can show live health data.",
          [{ text: "OK" }]
        );
      }

      // Start service regardless of HC result — glucose data can still show without HC
      await startForegroundService();
      setTrackingEnabled(true);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to start tracking.");
    } finally {
      setTrackingBusy(false);
    }
  }

  async function scheduleMoodReminder(periodKey: string, hour: number, minute: number) {
    await Notifications.scheduleNotificationAsync({
      identifier: "mood-reminder-" + periodKey,
      content: {
        title: "How are you feeling?",
        body: "Log your " + periodKey + " mood check-in.",
        data: { period: periodKey },
      },
      trigger: {
        type: SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  }

  async function cancelMoodReminder(periodKey: string) {
    await Notifications.cancelScheduledNotificationAsync("mood-reminder-" + periodKey).catch(() => {});
  }

  async function applyMoodReminderSchedule(
    enabled: boolean,
    periods: Record<string, boolean>
  ) {
    for (const p of REMINDER_PERIODS) {
      if (enabled && periods[p.key] !== false) {
        await scheduleMoodReminder(p.key, p.hour, p.minute);
      } else {
        await cancelMoodReminder(p.key);
      }
    }
  }

  async function handleMoodReminderMasterToggle(value: boolean) {
    if (value && !notifGranted) {
      Alert.alert(
        "Notification permission required",
        "Enable the Always-on Tracking toggle first to grant notification permission.",
        [{ text: "OK" }]
      );
      return;
    }
    const periods = settings.mood_reminders?.periods ?? {};
    const updated = {
      mood_reminders: { ...(settings.mood_reminders ?? {}), enabled: value },
    };
    setSettings((prev) => ({ ...prev, ...updated }));
    await save(updated);
    await applyMoodReminderSchedule(value, periods as Record<string, boolean>);
  }

  async function handleMoodReminderPeriodToggle(periodKey: string, value: boolean) {
    const masterEnabled = settings.mood_reminders?.enabled === true;
    const updatedPeriods = {
      ...(settings.mood_reminders?.periods ?? {}),
      [periodKey]: value,
    };
    const updated = {
      mood_reminders: { ...(settings.mood_reminders ?? {}), periods: updatedPeriods },
    };
    setSettings((prev) => ({ ...prev, ...updated }));
    await save(updated);
    const p = REMINDER_PERIODS.find((r) => r.key === periodKey);
    if (p) {
      if (masterEnabled && value) {
        await scheduleMoodReminder(p.key, p.hour, p.minute);
      } else {
        await cancelMoodReminder(p.key);
      }
    }
  }

  async function handleExportReport() {
    setExporting(true);
    try {
      const startIso = new Date(exportStart).toISOString();
      const endIso = new Date(exportEnd + "T23:59:59").toISOString();
      const url = api.reportUrl(USER_ID, startIso, endIso);
      const localUri = (FileSystem.cacheDirectory ?? "") + "ripple-health-report.pdf";
      const { uri } = await FileSystem.downloadAsync(url, localUri);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Share health report" });
      } else {
        Alert.alert("Saved", "Report saved to: " + uri);
      }
    } catch (e: any) {
      Alert.alert("Export failed", e?.message ?? "Unknown error");
    } finally {
      setExporting(false);
    }
  }

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
      {/* Always-on tracking notification */}
      {Platform.OS === "android" ? (
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: theme.textStrong }]}>Always-on Tracking</Text>
          <Text style={[styles.sectionDesc, { color: theme.textSoft }]}>
            Shows a persistent notification with live glucose and steps. Keeps syncing in the background.
          </Text>

          <View style={styles.toggleRow}>
            <Text style={{ color: theme.textStrong, flex: 1 }}>Always-on tracking notification</Text>
            {trackingBusy
              ? <ActivityIndicator size="small" color={theme.teal.bar} />
              : (
                <Switch
                  value={trackingEnabled}
                  onValueChange={handleTrackingToggle}
                  trackColor={{ false: theme.cardBorder, true: theme.teal.bar }}
                  thumbColor="#fff"
                />
              )
            }
          </View>

          <View style={[styles.statusBox, { backgroundColor: theme.page, borderColor: theme.cardBorder }]}>
            <StatusRow
              label="Notification permission"
              status={notifGranted === null ? "unknown" : notifGranted ? "granted" : "denied"}
              theme={theme}
            />
            <StatusRow label="Battery optimization" status="manual" theme={theme} />
            <StatusRow label="Health Connect" status="manual" theme={theme} />
          </View>

          {notifGranted === false ? (
            <Pressable
              onPress={() => {
                IntentLauncher.startActivityAsync(
                  "android.settings.APP_NOTIFICATION_SETTINGS",
                  { extra: { "android.provider.extra.APP_PACKAGE": "com.kellehs.wellness" } }
                ).catch(() => IntentLauncher.startActivityAsync("android.settings.APPLICATION_DETAILS_SETTINGS", {
                  data: "package:com.kellehs.wellness",
                }));
              }}
              style={[styles.saveButton, { backgroundColor: theme.coral.bg, borderColor: theme.coral.sub }]}
            >
              <Text style={{ color: theme.coral.fg, fontWeight: "500" }}>Open notification settings</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Mood check-in reminders */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.textStrong }]}>Mood Check-in Reminders</Text>
        <Text style={[styles.sectionDesc, { color: theme.textSoft }]}>
          Daily reminders to log your mood for each time-of-day period.
        </Text>
        <ToggleRow
          label="Reminders enabled"
          value={settings.mood_reminders?.enabled === true}
          onChange={handleMoodReminderMasterToggle}
          theme={theme}
        />
        {settings.mood_reminders?.enabled === true ? (
          <View style={{ gap: 0, marginTop: 4 }}>
            {REMINDER_PERIODS.map((p) => (
              <ToggleRow
                key={p.key}
                label={p.label + " (" + (p.hour > 12 ? p.hour - 12 : p.hour) + (p.minute > 0 ? ":" + String(p.minute).padStart(2, "0") : "") + (p.hour >= 12 ? " PM" : " AM") + ")"}
                value={(settings.mood_reminders?.periods as any)?.[p.key] !== false}
                onChange={(v) => handleMoodReminderPeriodToggle(p.key, v)}
                theme={theme}
              />
            ))}
          </View>
        ) : null}
        {notifGranted === false ? (
          <Text style={{ color: theme.textSoft, fontSize: 12, marginTop: 4 }}>
            Notification permission not granted — enable Always-on Tracking first.
          </Text>
        ) : null}
      </View>

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

      {/* Doctor PDF export */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.textStrong }]}>Export Health Report</Text>
        <Text style={[styles.sectionDesc, { color: theme.textSoft }]}>
          Generates a PDF with glucose trends and meal timing — useful to bring to a doctor's appointment.
        </Text>
        <Text style={[styles.fieldLabel, { color: theme.textSoft }]}>Start date</Text>
        <TextInput
          value={exportStart}
          onChangeText={setExportStart}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.textSoft}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.textInput, { color: theme.textStrong, borderColor: theme.cardBorder, backgroundColor: theme.page }]}
        />
        <Text style={[styles.fieldLabel, { color: theme.textSoft }]}>End date</Text>
        <TextInput
          value={exportEnd}
          onChangeText={setExportEnd}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.textSoft}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.textInput, { color: theme.textStrong, borderColor: theme.cardBorder, backgroundColor: theme.page }]}
        />
        <Pressable
          onPress={handleExportReport}
          disabled={exporting}
          style={[styles.saveButton, { backgroundColor: theme.teal.bg, borderColor: theme.teal.sub, opacity: exporting ? 0.6 : 1 }]}
        >
          {exporting
            ? <ActivityIndicator size="small" color={theme.teal.fg} />
            : <Text style={{ color: theme.teal.fg, fontWeight: "500" }}>Generate &amp; share PDF</Text>
          }
        </Pressable>
      </View>
    </ScrollView>
  );
}

function StatusRow({
  label,
  status,
  theme,
}: {
  label: string;
  status: "granted" | "denied" | "unknown" | "manual";
  theme: any;
}) {
  const dot = status === "granted" ? "●" : status === "denied" ? "●" : "○";
  const color = status === "granted" ? theme.teal.fg : status === "denied" ? theme.coral.fg : theme.textSoft;
  const note = status === "granted" ? "Granted" : status === "denied" ? "Denied" : "Tap toggle to request";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 3 }}>
      <Text style={{ color, fontSize: 10 }}>{dot}</Text>
      <Text style={{ color: theme.textStrong, flex: 1, fontSize: 13 }}>{label}</Text>
      <Text style={{ color, fontSize: 12 }}>{note}</Text>
    </View>
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
  statusBox: {
    borderWidth: 0.5,
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    gap: 2,
  },
});
