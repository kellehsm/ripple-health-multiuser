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
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as IntentLauncher from "expo-intent-launcher";
import * as WebBrowser from "expo-web-browser";
import notifee, { AuthorizationStatus } from "@notifee/react-native";
import * as Notifications from "expo-notifications";
import { useFocusEffect } from "@react-navigation/core";
import { getGrantedPermissions } from "react-native-health-connect";
import { useTheme } from "../theme/ThemeContext";
import { ThemePickerModal } from "./ThemePickerModal";
import { PALETTES } from "../theme/palettes";
import { api } from "../api/client";
import { logout, getUserId } from "../lib/auth";

import { GOOGLE_CLIENT_ID } from "../api/client";
import { requestHealthPermissions, syncHealthData } from "../lib/healthConnect";
import {
  startForegroundService,
  stopForegroundService,
  isForegroundServiceRunning,
} from "../lib/foregroundService";

WebBrowser.maybeCompleteAuthSession();

const WEEK_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type MealPeriodSettings = { enabled?: boolean; hour?: number };
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
  smart_notifications?: {
    meal_reminders?: {
      enabled?: boolean;
      breakfast?: MealPeriodSettings;
      lunch?: MealPeriodSettings;
      dinner?: MealPeriodSettings;
    };
    glucose_spike?: { enabled?: boolean; threshold_mg_dl?: number };
    evening_checkin?: { enabled?: boolean; hour?: number };
    water_reminder?: { enabled?: boolean; start_hour?: number; goal?: number };
    streak_protection?: { enabled?: boolean; hour?: number };
    mood_checkin?: { enabled?: boolean };
    book_reminder?: { enabled?: boolean; hour?: number };
    hobby_reminder?: { enabled?: boolean; hour?: number };
  };
};

type DriveStatus = {
  connected: boolean;
  last_backup: string | null;
  auto_backup: boolean;
  connected_at: string | null;
};


export function SettingsScreen() {
  const { theme, paletteId, setPalette } = useTheme();
  const [themePickerVisible, setThemePickerVisible] = useState(false);
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dexcomAccountId, setDexcomAccountId] = useState("");
  const [dexcomPassword, setDexcomPassword] = useState("");
  const [showDexcomPassword, setShowDexcomPassword] = useState(false);
  const [dexcomRegion, setDexcomRegion] = useState<"us" | "ous">("us");
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);
  const [batteryGranted, setBatteryGranted] = useState<boolean | null>(null);
  const [hcGranted, setHcGranted] = useState<boolean | null>(null);
  const [trackingBusy, setTrackingBusy] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);

  const defaultEnd = new Date().toISOString().slice(0, 10);
  const defaultStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [exportStart, setExportStart] = useState(defaultStart);
  const [exportEnd, setExportEnd] = useState(defaultEnd);
  const [exporting, setExporting] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);

  const [driveStatus, setDriveStatus] = useState<DriveStatus | null>(null);
  const [driveConnecting, setDriveConnecting] = useState(false);
  const [driveBackingUp, setDriveBackingUp] = useState(false);
  const [driveBackups, setDriveBackups] = useState<Array<{ id: string; name: string; createdTime: string; size?: string }> | null>(null);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const loadDriveStatus = useCallback(async function () {
    try {
      const status = await api.getDriveStatus();
      setDriveStatus(status);
    } catch (_) {}
  }, []);

  const load = useCallback(async function () {
    // Cancel any legacy expo-notifications mood reminders left over from before they were replaced
    Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
    try {
      const s = await api.getSettings();
      setSettings(s ?? {});
      setDexcomAccountId(s?.dexcom?.share_account_id ?? "");
      setDexcomRegion(s?.dexcom?.share_region === "ous" ? "ous" : "us");
    } catch (e) {
      console.error("Failed to load settings", e);
    } finally {
      setLoading(false);
    }
    loadDriveStatus();
  }, [loadDriveStatus]);

  useEffect(function () { load(); }, [load]);

  const checkPermissions = useCallback(async function () {
    if (Platform.OS !== "android") return;
    try {
      const running = await isForegroundServiceRunning();
      setTrackingEnabled(running);
    } catch (_) {}
    try {
      const notifSettings = await Notifications.getPermissionsAsync();
      const granted = notifSettings.granted;
      setNotifGranted(granted);
    } catch (_) {}
    try {
      const batteryOptOn = await notifee.isBatteryOptimizationEnabled();
      setBatteryGranted(!batteryOptOn);
    } catch (_) {}
    try {
      const granted = await getGrantedPermissions();
      const hasSteps = granted.some((p: any) => p.recordType === "Steps" && p.accessType === "read");
      const hasSleep = granted.some((p: any) => p.recordType === "SleepSession" && p.accessType === "read");
      const hasHR = granted.some((p: any) => p.recordType === "HeartRate" && p.accessType === "read");
      setHcGranted(hasSteps && hasSleep && hasHR);
    } catch (_) {
      setHcGranted(false);
    }
  }, []);

  useEffect(function () { checkPermissions(); }, [checkPermissions]);

  useFocusEffect(useCallback(function () {
    checkPermissions();
  }, [checkPermissions]));

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
      // Step 1: notification permission — only request if not already granted
      let notifOk = notifGranted;
      if (!notifOk) {
        const result = await notifee.requestPermission();
        notifOk = result.authorizationStatus === AuthorizationStatus.AUTHORIZED;
        setNotifGranted(notifOk);
      }
      if (!notifOk) {
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

      // Step 2: battery optimization — only prompt if not already exempted
      if (!batteryGranted) {
        await IntentLauncher.startActivityAsync(
          "android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
          { data: "package:com.kellehs.wellness" }
        ).catch(() => {});
        const batteryOptOn = await notifee.isBatteryOptimizationEnabled().catch(() => true);
        setBatteryGranted(!batteryOptOn);
      }

      // Step 3: Health Connect — only request if not already granted
      if (!hcGranted) {
        const granted = await requestHealthPermissions();
        setHcGranted(granted);
        if (!granted) {
          Alert.alert(
            "Health Connect permissions needed",
            "Grant Health Connect permissions so the notification can show live health data.",
            [{ text: "OK" }]
          );
        }
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

  async function handleConnectGoogleDrive() {
    if (!GOOGLE_CLIENT_ID) {
      Alert.alert("Not configured", "Set GOOGLE_CLIENT_ID in src/api/config.ts to enable Drive backups.");
      return;
    }
    setDriveConnecting(true);
    try {
      const userId = await getUserId();
      if (!userId) {
        Alert.alert("Error", "Could not determine user ID. Please log out and back in.");
        return;
      }
      const redirectUri = "https://app.kels.gg/auth/google/callback";
      const scope = "https://www.googleapis.com/auth/drive.file";
      const authUrl =
        "https://accounts.google.com/o/oauth2/v2/auth?" +
        new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          redirect_uri: redirectUri,
          response_type: "code",
          scope,
          access_type: "offline",
          prompt: "consent",
          state: userId,
        }).toString();

      const result = await WebBrowser.openAuthSessionAsync(authUrl, "wellnessfresh://oauth");
      if (result.type === "success" && result.url.includes("status=connected")) {
        await loadDriveStatus();
        Alert.alert("Connected", "Google Drive backup is set up. Nightly backups will run at 2 AM.");
      } else if (result.type === "success" && result.url.includes("status=error")) {
        Alert.alert("Connection failed", "Google authorization failed. Try again.");
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to open Google auth.");
    } finally {
      setDriveConnecting(false);
    }
  }

  async function handleManualBackup() {
    setDriveBackingUp(true);
    try {
      const res = await api.triggerDriveBackup();
      await loadDriveStatus();
      Alert.alert("Backup complete", res.filename ?? "Backup uploaded to Google Drive.");
    } catch (e: any) {
      Alert.alert("Backup failed", e?.message ?? "Unknown error");
    } finally {
      setDriveBackingUp(false);
    }
  }

  async function handleDriveAutoBackupToggle(value: boolean) {
    try {
      await api.setDriveAutoBackup(value);
      setDriveStatus((prev) => prev ? { ...prev, auto_backup: value } : prev);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to update setting.");
    }
  }

  async function handleLoadBackups() {
    setLoadingBackups(true);
    try {
      const res = await api.listDriveBackups();
      setDriveBackups(res.files ?? []);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not list backups.");
    } finally {
      setLoadingBackups(false);
    }
  }

  async function handleRestore(fileId: string, filename: string) {
    Alert.alert(
      "Restore from backup?",
      `This will import data from "${filename}" into your account. Existing records won't be overwritten — only missing records will be added.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          onPress: async () => {
            setRestoringId(fileId);
            try {
              const res = await api.restoreFromDrive(fileId);
              const c = res.counts ?? {};
              const lines = [
                c.glucose_readings && `${c.glucose_readings} glucose readings`,
                c.meals && `${c.meals} meals`,
                c.journal_entries && `${c.journal_entries} journal entries`,
                c.spending_entries && `${c.spending_entries} spending entries`,
                c.books && `${c.books} books`,
                c.hobbies && `${c.hobbies} hobbies`,
                c.hobby_logs && `${c.hobby_logs} hobby logs`,
                c.sleep_sessions && `${c.sleep_sessions} sleep sessions`,
                c.heart_rate_readings && `${c.heart_rate_readings} heart rate readings`,
                c.metrics && `${c.metrics} metrics`,
                c.metric_logs && `${c.metric_logs} metric logs`,
              ].filter(Boolean);
              const summary = lines.length > 0 ? lines.join(", ") : "Nothing new to import — all records already existed.";
              Alert.alert("Restore complete", "Added: " + summary);
            } catch (e: any) {
              Alert.alert("Restore failed", e?.message ?? "Unknown error");
            } finally {
              setRestoringId(null);
            }
          },
        },
      ]
    );
  }

  async function handleDisconnectDrive() {
    Alert.alert(
      "Disconnect Google Drive?",
      "Nightly backups will stop. Existing backup files in Drive will remain.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            try {
              await api.disconnectDrive();
              setDriveStatus(null);
            } catch (e: any) {
              Alert.alert("Error", e?.message ?? "Failed to disconnect.");
            }
          },
        },
      ]
    );
  }

  async function handleExportReport() {
    setExporting(true);
    try {
      const startIso = new Date(exportStart).toISOString();
      const endIso = new Date(exportEnd + "T23:59:59").toISOString();
      const url = await api.reportUrl(startIso, endIso);
      const localUri = (FileSystem.cacheDirectory ?? "") + "ripple-wellness-report.pdf";
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

  async function handleExportAll() {
    setExportingAll(true);
    try {
      const url = await api.exportAllUrl();
      const date = new Date().toISOString().slice(0, 10);
      const localUri = (FileSystem.cacheDirectory ?? "") + "ripple-backup-" + date + ".json";
      const { uri } = await FileSystem.downloadAsync(url, localUri);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: "application/json", dialogTitle: "Save data backup" });
      } else {
        Alert.alert("Saved", "Backup saved to: " + uri);
      }
    } catch (e: any) {
      Alert.alert("Export failed", e?.message ?? "Unknown error");
    } finally {
      setExportingAll(false);
    }
  }

  async function save(patch: Record<string, unknown>) {
    setSaving(true);
    try {
      await api.patchSettings(patch);
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

  async function handleBackfill() {
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const granted = await requestHealthPermissions();
      if (!granted) {
        setBackfillResult("Health Connect permission required.");
        return;
      }
      const result = await syncHealthData();
      const parts: string[] = [];
      if (result.steps !== null) parts.push(result.steps.toLocaleString() + " steps today");
      if (result.errors.length > 0) parts.push("errors: " + result.errors.join(", "));
      setBackfillResult(parts.length > 0 ? "Done — " + parts.join(", ") : "Backfill complete (30 days).");
    } catch (e: any) {
      setBackfillResult("Backfill failed: " + (e?.message ?? "unknown error"));
    } finally {
      setBackfilling(false);
    }
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
      <ThemePickerModal visible={themePickerVisible} onClose={() => setThemePickerVisible(false)} />

      {/* Appearance */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.ink }]}>
        <Text style={[styles.sectionTitle, { color: theme.textStrong }]}>Appearance</Text>
        <Pressable
          onPress={() => setThemePickerVisible(true)}
          style={[styles.themeRow, { borderColor: theme.cardBorder }]}
        >
          <View style={styles.themeSwatches}>
            {[theme.teal.solid, theme.coral.solid, theme.berry.solid, theme.purple.solid, theme.blue.solid].map((c, i) => (
              <View key={i} style={[styles.themeSwatch, { backgroundColor: c }]} />
            ))}
          </View>
          <Text style={[styles.themeRowName, { color: theme.textStrong }]}>
            {PALETTES[paletteId]?.name ?? "Choose theme"}
          </Text>
          <Text style={[styles.themeRowChevron, { color: theme.textSoft }]}>›</Text>
        </Pressable>
      </View>

      {/* Always-on tracking notification */}
      {Platform.OS === "android" ? (
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.ink }]}>
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

          <View style={[styles.statusBox, { backgroundColor: theme.page, borderColor: theme.ink }]}>
            <StatusRow
              label="Notification permission"
              status={notifGranted === null ? "unknown" : notifGranted ? "granted" : "denied"}
              theme={theme}
            />
            <StatusRow
              label="Battery optimization exempt"
              status={batteryGranted === null ? "unknown" : batteryGranted ? "granted" : "denied"}
              theme={theme}
            />
            <StatusRow
              label="Health Connect"
              status={hcGranted === null ? "unknown" : hcGranted ? "granted" : "denied"}
              theme={theme}
            />
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

      {/* Week start preferences */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.ink }]}>
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
                        borderColor: theme.ink,
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
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.ink }]}>
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
        <Pressable
          onPress={handleBackfill}
          disabled={backfilling}
          style={[styles.saveButton, { backgroundColor: theme.teal.bg, borderColor: theme.teal.sub, opacity: backfilling ? 0.6 : 1 }]}
        >
          {backfilling
            ? <ActivityIndicator size="small" color={theme.teal.fg} />
            : <Text style={{ color: theme.teal.fg, fontWeight: "500" }}>Backfill 30-day history</Text>
          }
        </Pressable>
        {backfillResult ? (
          <Text style={{ color: theme.textSoft, fontSize: 12, marginTop: 4 }}>{backfillResult}</Text>
        ) : null}
      </View>

      {/* Dexcom credentials */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.ink }]}>
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
          style={[styles.textInput, { color: theme.textStrong, borderColor: theme.ink, backgroundColor: theme.page }]}
        />

        <Text style={[styles.fieldLabel, { color: theme.textSoft }]}>
          Password {settings.dexcom?.share_password_set ? "(currently set — leave blank to keep)" : ""}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TextInput
            value={dexcomPassword}
            onChangeText={setDexcomPassword}
            placeholder={settings.dexcom?.share_password_set ? "Leave blank to keep existing" : "Password"}
            placeholderTextColor={theme.textSoft}
            secureTextEntry={!showDexcomPassword}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.textInput, { flex: 1, color: theme.textStrong, borderColor: theme.ink, backgroundColor: theme.page }]}
          />
          <Pressable
            onPress={() => setShowDexcomPassword(v => !v)}
            hitSlop={8}
            accessibilityLabel={showDexcomPassword ? "Hide password" : "Show password"}
            style={{ padding: 4 }}
          >
            <Ionicons name={showDexcomPassword ? "eye-off-outline" : "eye-outline"} size={20} color={theme.textSoft} />
          </Pressable>
        </View>

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
                  borderColor: theme.ink,
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

      {/* Smart notifications */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.ink }]}>
        <Text style={[styles.sectionTitle, { color: theme.textStrong }]}>Smart Notifications</Text>
        <Text style={[styles.sectionDesc, { color: theme.textSoft }]}>
          Requires Always-on Tracking to be enabled.
        </Text>

        {/* Meal reminders */}
        <Text style={[styles.subHead, { color: theme.textStrong }]}>Meal Reminders</Text>
        <ToggleRow
          label="Remind me to log meals"
          value={settings.smart_notifications?.meal_reminders?.enabled === true}
          onChange={(v) => save({ smart_notifications: { ...(settings.smart_notifications ?? {}), meal_reminders: { ...(settings.smart_notifications?.meal_reminders ?? {}), enabled: v } } })}
          theme={theme}
        />
        {settings.smart_notifications?.meal_reminders?.enabled === true ? (
          <>
            {(["breakfast", "lunch", "dinner"] as const).map((meal) => {
              const defaults: Record<string, number> = { breakfast: 9, lunch: 13, dinner: 19 };
              const mealLabel = meal.charAt(0).toUpperCase() + meal.slice(1);
              const mealCfg = settings.smart_notifications?.meal_reminders?.[meal] ?? {};
              const currentH = mealCfg.hour ?? defaults[meal];
              const hours = meal === "breakfast" ? [7, 8, 9, 10] : meal === "lunch" ? [11, 12, 13, 14] : [17, 18, 19, 20, 21];
              return (
                <View key={meal} style={styles.weekRow}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ToggleRow
                      label={mealLabel}
                      value={mealCfg.enabled !== false}
                      onChange={(v) => save({ smart_notifications: { ...(settings.smart_notifications ?? {}), meal_reminders: { ...(settings.smart_notifications?.meal_reminders ?? {}), [meal]: { ...mealCfg, enabled: v } } } })}
                      theme={theme}
                    />
                  </View>
                  {mealCfg.enabled !== false ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll}>
                      {hours.map((h) => {
                        const label12 = h === 0 ? "12am" : h < 12 ? h + "am" : h === 12 ? "12pm" : (h - 12) + "pm";
                        return (
                          <Pressable
                            key={h}
                            onPress={() => save({ smart_notifications: { ...(settings.smart_notifications ?? {}), meal_reminders: { ...(settings.smart_notifications?.meal_reminders ?? {}), [meal]: { ...mealCfg, hour: h } } } })}
                            style={[styles.dayChip, { backgroundColor: currentH === h ? theme.coral.sub : theme.page, borderColor: theme.ink }]}
                          >
                            <Text style={{ color: currentH === h ? "#fff" : theme.textSoft, fontSize: 12 }}>{label12}</Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  ) : null}
                </View>
              );
            })}
          </>
        ) : null}

        {/* Glucose spike */}
        <Text style={[styles.subHead, { color: theme.textStrong }]}>Glucose Spike Prompt</Text>
        <Text style={[styles.sectionDesc, { color: theme.textSoft }]}>
          Asks if you ate something when glucose rises 30+ mg/dL in an hour.
        </Text>
        <ToggleRow
          label="Prompt on glucose spike"
          value={settings.smart_notifications?.glucose_spike?.enabled === true}
          onChange={(v) => save({ smart_notifications: { ...(settings.smart_notifications ?? {}), glucose_spike: { ...(settings.smart_notifications?.glucose_spike ?? {}), enabled: v } } })}
          theme={theme}
        />

        {/* Evening check-in */}
        <Text style={[styles.subHead, { color: theme.textStrong }]}>Evening Check-in</Text>
        <ToggleRow
          label="Daily end-of-day summary"
          value={settings.smart_notifications?.evening_checkin?.enabled === true}
          onChange={(v) => save({ smart_notifications: { ...(settings.smart_notifications ?? {}), evening_checkin: { ...(settings.smart_notifications?.evening_checkin ?? {}), enabled: v } } })}
          theme={theme}
        />
        {settings.smart_notifications?.evening_checkin?.enabled === true ? (
          <View style={styles.weekRow}>
            <Text style={[styles.weekLabel, { color: theme.textStrong }]}>Send at</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll}>
              {[19, 20, 21, 22].map((h) => {
                const currentH = settings.smart_notifications?.evening_checkin?.hour ?? 21;
                const label12 = (h - 12) + "pm";
                return (
                  <Pressable
                    key={h}
                    onPress={() => save({ smart_notifications: { ...(settings.smart_notifications ?? {}), evening_checkin: { ...(settings.smart_notifications?.evening_checkin ?? {}), hour: h } } })}
                    style={[styles.dayChip, { backgroundColor: currentH === h ? theme.teal.bar : theme.page, borderColor: theme.ink }]}
                  >
                    <Text style={{ color: currentH === h ? "#fff" : theme.textSoft, fontSize: 12 }}>{label12}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* Water reminder */}
        <Text style={[styles.subHead, { color: theme.textStrong }]}>Water Reminder</Text>
        <Text style={[styles.sectionDesc, { color: theme.textSoft }]}>
          Nudges every 2 hours if you haven't hit your daily glass goal.
        </Text>
        <ToggleRow
          label="Remind me to drink water"
          value={settings.smart_notifications?.water_reminder?.enabled === true}
          onChange={(v) => save({ smart_notifications: { ...(settings.smart_notifications ?? {}), water_reminder: { ...(settings.smart_notifications?.water_reminder ?? {}), enabled: v } } })}
          theme={theme}
        />
        {settings.smart_notifications?.water_reminder?.enabled === true ? (
          <>
            <View style={styles.weekRow}>
              <Text style={[styles.weekLabel, { color: theme.textStrong }]}>Daily goal</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll}>
                {[6, 7, 8, 9, 10, 12].map((g) => {
                  const currentGoal = settings.smart_notifications?.water_reminder?.goal ?? 8;
                  return (
                    <Pressable
                      key={g}
                      onPress={() => save({ smart_notifications: { ...(settings.smart_notifications ?? {}), water_reminder: { ...(settings.smart_notifications?.water_reminder ?? {}), goal: g } } })}
                      style={[styles.dayChip, { backgroundColor: currentGoal === g ? theme.blue.sub : theme.page, borderColor: theme.ink }]}
                    >
                      <Text style={{ color: currentGoal === g ? "#fff" : theme.textSoft, fontSize: 12 }}>{g} glasses</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            <View style={styles.weekRow}>
              <Text style={[styles.weekLabel, { color: theme.textStrong }]}>Start at</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll}>
                {[7, 8, 9, 10].map((h) => {
                  const currentH = settings.smart_notifications?.water_reminder?.start_hour ?? 9;
                  const label12 = h + "am";
                  return (
                    <Pressable
                      key={h}
                      onPress={() => save({ smart_notifications: { ...(settings.smart_notifications ?? {}), water_reminder: { ...(settings.smart_notifications?.water_reminder ?? {}), start_hour: h } } })}
                      style={[styles.dayChip, { backgroundColor: currentH === h ? theme.blue.sub : theme.page, borderColor: theme.ink }]}
                    >
                      <Text style={{ color: currentH === h ? "#fff" : theme.textSoft, fontSize: 12 }}>{label12}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </>
        ) : null}

        {/* Streak protection */}
        <Text style={[styles.subHead, { color: theme.textStrong }]}>Streak Protection</Text>
        <Text style={[styles.sectionDesc, { color: theme.textSoft }]}>
          Warns you before midnight if you haven't logged anything today and have an active streak.
        </Text>
        <ToggleRow
          label="Protect my streak"
          value={settings.smart_notifications?.streak_protection?.enabled === true}
          onChange={(v) => save({ smart_notifications: { ...(settings.smart_notifications ?? {}), streak_protection: { ...(settings.smart_notifications?.streak_protection ?? {}), enabled: v } } })}
          theme={theme}
        />
        {settings.smart_notifications?.streak_protection?.enabled === true ? (
          <View style={styles.weekRow}>
            <Text style={[styles.weekLabel, { color: theme.textStrong }]}>Alert at</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll}>
              {[18, 19, 20, 21, 22].map((h) => {
                const currentH = settings.smart_notifications?.streak_protection?.hour ?? 20;
                const label12 = (h - 12) + "pm";
                return (
                  <Pressable
                    key={h}
                    onPress={() => save({ smart_notifications: { ...(settings.smart_notifications ?? {}), streak_protection: { ...(settings.smart_notifications?.streak_protection ?? {}), hour: h } } })}
                    style={[styles.dayChip, { backgroundColor: currentH === h ? theme.coral.sub : theme.page, borderColor: theme.ink }]}
                  >
                    <Text style={{ color: currentH === h ? "#fff" : theme.textSoft, fontSize: 12 }}>{label12}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* Mood check-in */}
        <Text style={[styles.subHead, { color: theme.textStrong }]}>Mood Check-in</Text>
        <Text style={[styles.sectionDesc, { color: theme.textSoft }]}>
          Nudges you around 2pm and 7pm if you haven't logged a mood check-in yet.
        </Text>
        <ToggleRow
          label="Remind me to check in"
          value={settings.smart_notifications?.mood_checkin?.enabled === true}
          onChange={(v) => save({ smart_notifications: { ...(settings.smart_notifications ?? {}), mood_checkin: { ...(settings.smart_notifications?.mood_checkin ?? {}), enabled: v } } })}
          theme={theme}
        />

        {/* Book reminder */}
        <Text style={[styles.subHead, { color: theme.textStrong }]}>Reading Reminder</Text>
        <Text style={[styles.sectionDesc, { color: theme.textSoft }]}>
          Reminds you to log reading time if you have a book in progress.
        </Text>
        <ToggleRow
          label="Remind me to read"
          value={settings.smart_notifications?.book_reminder?.enabled === true}
          onChange={(v) => save({ smart_notifications: { ...(settings.smart_notifications ?? {}), book_reminder: { ...(settings.smart_notifications?.book_reminder ?? {}), enabled: v } } })}
          theme={theme}
        />

        {/* Hobby / activity reminder */}
        <Text style={[styles.subHead, { color: theme.textStrong }]}>Activity Reminder</Text>
        <Text style={[styles.sectionDesc, { color: theme.textSoft }]}>
          Reminds you to log a hobby or activity if you have any set up.
        </Text>
        <ToggleRow
          label="Remind me to log activities"
          value={settings.smart_notifications?.hobby_reminder?.enabled === true}
          onChange={(v) => save({ smart_notifications: { ...(settings.smart_notifications ?? {}), hobby_reminder: { ...(settings.smart_notifications?.hobby_reminder ?? {}), enabled: v } } })}
          theme={theme}
        />
      </View>

      {/* Doctor PDF export */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.ink }]}>
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
          style={[styles.textInput, { color: theme.textStrong, borderColor: theme.ink, backgroundColor: theme.page }]}
        />
        <Text style={[styles.fieldLabel, { color: theme.textSoft }]}>End date</Text>
        <TextInput
          value={exportEnd}
          onChangeText={setExportEnd}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.textSoft}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.textInput, { color: theme.textStrong, borderColor: theme.ink, backgroundColor: theme.page }]}
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

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.ink }]}>
        <Text style={[styles.sectionTitle, { color: theme.textStrong }]}>Export My Data</Text>
        <Text style={[styles.sectionDesc, { color: theme.textSoft }]}>
          Full backup of all your data as JSON — glucose, meals, mood, spending, books, hobbies, sleep, and heart rate.
        </Text>
        <Pressable
          onPress={handleExportAll}
          disabled={exportingAll}
          style={[styles.saveButton, { backgroundColor: theme.teal.bg, borderColor: theme.teal.sub, opacity: exportingAll ? 0.6 : 1 }]}
        >
          {exportingAll
            ? <ActivityIndicator size="small" color={theme.teal.fg} />
            : <Text style={{ color: theme.teal.fg, fontWeight: "500" }}>Download full backup</Text>
          }
        </Pressable>
      </View>

      {/* Google Drive backups */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.ink }]}>
        <Text style={[styles.sectionTitle, { color: theme.textStrong }]}>Google Drive Backups</Text>
        <Text style={[styles.sectionDesc, { color: theme.textSoft }]}>
          Automatically backs up your full database to Google Drive every night at 2 AM. Keeps the last 14 days.
        </Text>

        {driveStatus?.connected ? (
          <>
            <View style={[styles.statusBox, { borderColor: theme.teal.sub, backgroundColor: theme.teal.bg }]}>
              <Text style={{ color: theme.teal.fg, fontSize: 13, fontWeight: "600" }}>● Connected</Text>
              {driveStatus.last_backup ? (
                <Text style={{ color: theme.teal.fg, fontSize: 12, marginTop: 2 }}>
                  Last backup: {new Date(driveStatus.last_backup).toLocaleString()}
                </Text>
              ) : (
                <Text style={{ color: theme.teal.sub, fontSize: 12, marginTop: 2 }}>No backup yet</Text>
              )}
            </View>

            <View style={styles.toggleRow}>
              <Text style={{ color: theme.textStrong, flex: 1 }}>Nightly auto-backup</Text>
              <Switch
                value={driveStatus.auto_backup}
                onValueChange={handleDriveAutoBackupToggle}
                trackColor={{ false: theme.cardBorder, true: theme.teal.bar }}
                thumbColor="#fff"
              />
            </View>

            <Pressable
              onPress={handleManualBackup}
              disabled={driveBackingUp}
              style={[styles.saveButton, { backgroundColor: theme.teal.bg, borderColor: theme.teal.sub, opacity: driveBackingUp ? 0.6 : 1 }]}
            >
              {driveBackingUp
                ? <ActivityIndicator size="small" color={theme.teal.fg} />
                : <Text style={{ color: theme.teal.fg, fontWeight: "500" }}>Back up now</Text>
              }
            </Pressable>

            {/* Restore from backup */}
            <Pressable
              onPress={handleLoadBackups}
              disabled={loadingBackups}
              style={[styles.saveButton, { backgroundColor: theme.purple.bg ?? theme.card, borderColor: theme.purple.sub, opacity: loadingBackups ? 0.6 : 1 }]}
            >
              {loadingBackups
                ? <ActivityIndicator size="small" color={theme.purple.fg} />
                : <Text style={{ color: theme.purple.fg, fontWeight: "500" }}>View backups to restore</Text>
              }
            </Pressable>

            {driveBackups !== null && (
              <View style={{ gap: 6, marginTop: 4 }}>
                {driveBackups.length === 0 ? (
                  <Text style={{ color: theme.textSoft, fontSize: 12, textAlign: "center" }}>No JSON backups found in Drive.</Text>
                ) : (
                  driveBackups.map((file) => (
                    <View
                      key={file.id}
                      style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: theme.cardBorder, borderRadius: 8, padding: 10 }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.textStrong, fontSize: 13, fontWeight: "600" }}>{file.name}</Text>
                        <Text style={{ color: theme.textSoft, fontSize: 11 }}>
                          {new Date(file.createdTime).toLocaleDateString()}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handleRestore(file.id, file.name)}
                        disabled={restoringId === file.id}
                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: theme.purple.sub, backgroundColor: theme.purple.bg ?? theme.card }}
                      >
                        {restoringId === file.id
                          ? <ActivityIndicator size="small" color={theme.purple.fg} />
                          : <Text style={{ color: theme.purple.fg, fontSize: 12, fontWeight: "600" }}>Restore</Text>
                        }
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            )}

            <Pressable
              onPress={handleDisconnectDrive}
              style={[styles.saveButton, { backgroundColor: theme.card, borderColor: theme.coral.sub, marginTop: 4 }]}
            >
              <Text style={{ color: theme.coral.fg, fontWeight: "500" }}>Disconnect Google Drive</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            onPress={handleConnectGoogleDrive}
            disabled={driveConnecting}
            style={[styles.saveButton, { backgroundColor: theme.blue.bg, borderColor: theme.blue.sub, opacity: driveConnecting ? 0.6 : 1 }]}
          >
            {driveConnecting
              ? <ActivityIndicator size="small" color={theme.blue.fg} />
              : <Text style={{ color: theme.blue.fg, fontWeight: "500" }}>Connect Google Drive</Text>
            }
          </Pressable>
        )}
      </View>

      {/* Account */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.ink }]}>
        <Text style={[styles.sectionTitle, { color: theme.textStrong }]}>Account</Text>
        <Pressable
          onPress={() => {
            Alert.alert("Sign out", "You'll need to sign in again to access your data.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Sign out",
                style: "destructive",
                onPress: () => logout(),
              },
            ]);
          }}
          style={[styles.saveButton, { backgroundColor: theme.card, borderColor: theme.coral.sub, marginTop: 4 }]}
        >
          <Text style={{ color: theme.coral.fg, fontWeight: "600" }}>Sign out</Text>
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
  card: { borderRadius: 14, borderWidth: 2, padding: 16, gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  sectionDesc: { fontSize: 12, marginBottom: 4 },
  subHead: { fontSize: 13, fontWeight: "500", marginTop: 8, marginBottom: 2 },
  weekRow: { gap: 6 },
  weekLabel: { fontSize: 13 },
  dayScroll: { flexGrow: 0 },
  dayChip: { borderWidth: 2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginRight: 6 },
  toggleRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  fieldLabel: { fontSize: 12, marginTop: 8 },
  textInput: {
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    marginTop: 4,
  },
  regionRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  regionChip: { borderWidth: 2, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  saveButton: {
    borderWidth: 2,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 8,
  },
  savingIndicator: { alignSelf: "flex-end" },
  statusBox: {
    borderWidth: 2,
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    gap: 2,
  },
  themeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  themeSwatches: { flexDirection: "row", gap: 3 },
  themeSwatch: { width: 14, height: 14, borderRadius: 7 },
  themeRowName: { flex: 1, fontSize: 14, fontWeight: "600" },
  themeRowChevron: { fontSize: 20, lineHeight: 22 },
});
