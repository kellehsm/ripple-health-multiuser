import React, { useEffect, useState } from "react";
import { ScrollView, View, Text, Switch, Pressable, StyleSheet, Alert } from "react-native";
import { LoadingIndicator } from "../../components/LoadingIndicator";
import { useTheme } from "../../theme/ThemeContext";
import { api } from "../../api/client";
import { getMuteUntil, muteFor, clearMute, untilTomorrow7am, MUTE_PRESETS } from "../../lib/muteNotifications";

type SmartNotifs = {
  meal_reminders?: { enabled?: boolean; breakfast?: any; lunch?: any; dinner?: any };
  glucose_spike?: { enabled?: boolean };
  evening_checkin?: { enabled?: boolean; hour?: number };
  water_reminder?: { enabled?: boolean; start_hour?: number; goal?: number };
  streak_protection?: { enabled?: boolean; hour?: number };
  mood_checkin?: { enabled?: boolean };
  book_reminder?: { enabled?: boolean; hour?: number };
  hobby_reminder?: { enabled?: boolean; hour?: number };
};

type HealthNotifs = {
  medication_reminders_enabled?: boolean;
  medication_morning_hour?: number;
  medication_midday_hour?: number;
  medication_evening_hour?: number;
  period_approaching_reminder_enabled?: boolean;
  period_approaching_lead_days?: number;
  cycle_log_reminders_enabled?: boolean;
  cycle_log_hour?: number;
};

function HourChips({ hours, current, onSelect, accentColor, theme }: {
  hours: number[]; current: number; onSelect: (h: number) => void; accentColor: string; theme: any;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
        {hours.map((h) => {
          const label = h === 0 ? "12am" : h < 12 ? h + "am" : h === 12 ? "12pm" : (h - 12) + "pm";
          return (
            <Pressable key={h} onPress={() => onSelect(h)}
              style={[styles.chip, { backgroundColor: current === h ? accentColor : theme.page, borderColor: theme.ink }]}>
              <Text style={{ color: current === h ? "#fff" : theme.textSoft, fontSize: 12 }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

function ToggleRow({ label, value, onChange, theme }: { label: string; value: boolean; onChange: (v: boolean) => void; theme: any }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 4 }}>
      <Text style={{ color: theme.textStrong, flex: 1 }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: theme.cardBorder, true: theme.teal.bar }} thumbColor="#fff" />
    </View>
  );
}

export function NotificationsSettingsScreen() {
  const { theme } = useTheme();
  const [sn, setSn] = useState<SmartNotifs>({});
  const [hn, setHn] = useState<HealthNotifs>({});
  const [saving, setSaving] = useState(false);
  const [muteUntilMs, setMuteUntilMs] = useState<number | null>(null);

  useEffect(() => {
    api.getSettings().then((s) => {
      setSn(s?.smart_notifications ?? {});
      setHn(s?.health_notifications ?? {});
    }).catch(() => {});
    getMuteUntil().then(setMuteUntilMs).catch(() => {});
  }, []);

  async function save(patch: SmartNotifs) {
    const merged = { ...sn, ...patch };
    setSn(merged);
    setSaving(true);
    try {
      await api.patchSettings({ smart_notifications: merged });
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function saveHealth(patch: HealthNotifs) {
    const merged = { ...hn, ...patch };
    setHn(merged);
    setSaving(true);
    try {
      await api.patchSettings({ health_notifications: merged });
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  function patchMeals(patch: object) { save({ meal_reminders: { ...(sn.meal_reminders ?? {}), ...patch } }); }
  function patchMeal(meal: "breakfast" | "lunch" | "dinner", patch: object) {
    patchMeals({ [meal]: { ...(sn.meal_reminders?.[meal] ?? {}), ...patch } });
  }

  return (
    <ScrollView style={{ backgroundColor: theme.page }} contentContainerStyle={styles.content}>
      {saving && <LoadingIndicator size="small" style={{ alignSelf: "flex-end" }} />}

      {/* Mute */}
      <Text style={[styles.groupLabel, { color: theme.textSoft }]}>SILENCE ALL</Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.ink }]}>
        {muteUntilMs ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: theme.textSoft, fontSize: 12 }}>
              Muted until {new Date(muteUntilMs).toLocaleString()}
            </Text>
            <Pressable
              onPress={async () => { await clearMute(); setMuteUntilMs(null); }}
              style={[styles.btn, { backgroundColor: theme.coral.bg, borderColor: theme.coral.sub, marginTop: 0 }]}
            >
              <Text style={{ color: theme.coral.fg, fontWeight: "500" }}>Clear mute</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {MUTE_PRESETS.map((preset) => (
              <Pressable key={preset.label}
                onPress={async () => {
                  const until = preset.ms === -1 ? untilTomorrow7am() : Date.now() + preset.ms;
                  await muteFor(until - Date.now());
                  setMuteUntilMs(until);
                }}
                style={[styles.chip, { borderColor: theme.ink, backgroundColor: theme.page }]}
              >
                <Text style={{ color: theme.textStrong, fontSize: 12 }}>{preset.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Meal reminders */}
      <Text style={[styles.groupLabel, { color: theme.textSoft }]}>MEAL REMINDERS</Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.ink }]}>
        <ToggleRow label="Remind me to log meals" value={sn.meal_reminders?.enabled === true}
          onChange={(v) => patchMeals({ enabled: v })} theme={theme} />
        {sn.meal_reminders?.enabled === true && (
          <>
            {(["breakfast", "lunch", "dinner"] as const).map((meal) => {
              const defaults: Record<string, number> = { breakfast: 9, lunch: 13, dinner: 19 };
              const cfg = sn.meal_reminders?.[meal] ?? {};
              const hours = meal === "breakfast" ? [7, 8, 9, 10] : meal === "lunch" ? [11, 12, 13, 14] : [17, 18, 19, 20, 21];
              return (
                <View key={meal} style={{ marginTop: 8, gap: 4 }}>
                  <ToggleRow
                    label={meal.charAt(0).toUpperCase() + meal.slice(1)}
                    value={cfg.enabled !== false}
                    onChange={(v) => patchMeal(meal, { enabled: v })}
                    theme={theme}
                  />
                  {cfg.enabled !== false && (
                    <HourChips hours={hours} current={cfg.hour ?? defaults[meal]} onSelect={(h) => patchMeal(meal, { hour: h })} accentColor={theme.coral.sub} theme={theme} />
                  )}
                </View>
              );
            })}
          </>
        )}
      </View>

      {/* Glucose spike */}
      <Text style={[styles.groupLabel, { color: theme.textSoft }]}>GLUCOSE SPIKE</Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.ink }]}>
        <Text style={[styles.desc, { color: theme.textSoft }]}>Asks if you ate something when glucose rises 30+ mg/dL in an hour.</Text>
        <ToggleRow label="Prompt on glucose spike" value={sn.glucose_spike?.enabled === true}
          onChange={(v) => save({ glucose_spike: { ...sn.glucose_spike, enabled: v } })} theme={theme} />
      </View>

      {/* Evening check-in */}
      <Text style={[styles.groupLabel, { color: theme.textSoft }]}>EVENING CHECK-IN</Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.ink }]}>
        <ToggleRow label="Daily end-of-day summary" value={sn.evening_checkin?.enabled === true}
          onChange={(v) => save({ evening_checkin: { ...sn.evening_checkin, enabled: v } })} theme={theme} />
        {sn.evening_checkin?.enabled === true && (
          <HourChips hours={[19, 20, 21, 22]} current={sn.evening_checkin?.hour ?? 21}
            onSelect={(h) => save({ evening_checkin: { ...sn.evening_checkin, hour: h } })}
            accentColor={theme.teal.bar} theme={theme} />
        )}
      </View>

      {/* Water reminder */}
      <Text style={[styles.groupLabel, { color: theme.textSoft }]}>WATER REMINDER</Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.ink }]}>
        <Text style={[styles.desc, { color: theme.textSoft }]}>Nudges every 2 hours if you haven't hit your daily glass goal.</Text>
        <ToggleRow label="Remind me to drink water" value={sn.water_reminder?.enabled === true}
          onChange={(v) => save({ water_reminder: { ...sn.water_reminder, enabled: v } })} theme={theme} />
        {sn.water_reminder?.enabled === true && (
          <>
            <Text style={[styles.subLabel, { color: theme.textStrong }]}>Daily goal</Text>
            <HourChips hours={[6, 7, 8, 9, 10, 12]} current={sn.water_reminder?.goal ?? 8}
              onSelect={(g) => save({ water_reminder: { ...sn.water_reminder, goal: g } })}
              accentColor={theme.blue.sub} theme={theme} />
            <Text style={[styles.subLabel, { color: theme.textStrong }]}>Start at</Text>
            <HourChips hours={[7, 8, 9, 10]} current={sn.water_reminder?.start_hour ?? 9}
              onSelect={(h) => save({ water_reminder: { ...sn.water_reminder, start_hour: h } })}
              accentColor={theme.blue.sub} theme={theme} />
          </>
        )}
      </View>

      {/* Streak protection */}
      <Text style={[styles.groupLabel, { color: theme.textSoft }]}>STREAK PROTECTION</Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.ink }]}>
        <Text style={[styles.desc, { color: theme.textSoft }]}>Warns you before midnight if you haven't logged today and have an active streak.</Text>
        <ToggleRow label="Protect my streak" value={sn.streak_protection?.enabled === true}
          onChange={(v) => save({ streak_protection: { ...sn.streak_protection, enabled: v } })} theme={theme} />
        {sn.streak_protection?.enabled === true && (
          <HourChips hours={[18, 19, 20, 21, 22]} current={sn.streak_protection?.hour ?? 20}
            onSelect={(h) => save({ streak_protection: { ...sn.streak_protection, hour: h } })}
            accentColor={theme.coral.sub} theme={theme} />
        )}
      </View>

      {/* Mood check-in */}
      <Text style={[styles.groupLabel, { color: theme.textSoft }]}>MOOD CHECK-IN</Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.ink }]}>
        <Text style={[styles.desc, { color: theme.textSoft }]}>Nudges around 2pm and 7pm if you haven't logged a mood check-in.</Text>
        <ToggleRow label="Remind me to check in" value={sn.mood_checkin?.enabled === true}
          onChange={(v) => save({ mood_checkin: { ...sn.mood_checkin, enabled: v } })} theme={theme} />
      </View>

      {/* Book reminder */}
      <Text style={[styles.groupLabel, { color: theme.textSoft }]}>READING REMINDER</Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.ink }]}>
        <Text style={[styles.desc, { color: theme.textSoft }]}>Reminds you to log reading time if you have a book in progress.</Text>
        <ToggleRow label="Remind me to read" value={sn.book_reminder?.enabled === true}
          onChange={(v) => save({ book_reminder: { ...sn.book_reminder, enabled: v } })} theme={theme} />
      </View>

      {/* Medication reminders */}
      <Text style={[styles.groupLabel, { color: theme.textSoft }]}>MEDICATION REMINDERS</Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.ink }]}>
        <Text style={[styles.desc, { color: theme.textSoft }]}>Reminds you when each time-of-day medication slot is due and hasn't been logged.</Text>
        <ToggleRow label="Medication reminders" value={hn.medication_reminders_enabled === true}
          onChange={(v) => saveHealth({ medication_reminders_enabled: v })} theme={theme} />
        {hn.medication_reminders_enabled === true && (
          <>
            {([
              { key: "medication_morning_hour" as const, label: "Morning reminder", hours: [6, 7, 8, 9, 10], def: 8 },
              { key: "medication_midday_hour"  as const, label: "Midday reminder",  hours: [11, 12, 13, 14], def: 12 },
              { key: "medication_evening_hour" as const, label: "Evening reminder", hours: [18, 19, 20, 21, 22], def: 20 },
            ]).map(({ key, label, hours, def }) => (
              <View key={key} style={{ marginTop: 8 }}>
                <Text style={[styles.subLabel, { color: theme.textStrong }]}>{label}</Text>
                <HourChips hours={hours} current={hn[key] ?? def}
                  onSelect={(h) => saveHealth({ [key]: h })}
                  accentColor={theme.teal.sub} theme={theme} />
              </View>
            ))}
          </>
        )}
      </View>

      {/* Cycle reminders */}
      <Text style={[styles.groupLabel, { color: theme.textSoft }]}>CYCLE REMINDERS</Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.ink }]}>
        <ToggleRow label="Period approaching reminder"
          value={hn.period_approaching_reminder_enabled !== false}
          onChange={(v) => saveHealth({ period_approaching_reminder_enabled: v })} theme={theme} />
        {hn.period_approaching_reminder_enabled !== false && (
          <View style={{ marginTop: 4 }}>
            <Text style={[styles.subLabel, { color: theme.textStrong }]}>Days before to remind</Text>
            <HourChips hours={[1, 2, 3, 4, 5]}
              current={hn.period_approaching_lead_days ?? 2}
              onSelect={(d) => saveHealth({ period_approaching_lead_days: d })}
              accentColor={theme.coral?.sub ?? "#E87A96"} theme={theme} />
          </View>
        )}
        <View style={{ marginTop: 8 }}>
          <ToggleRow label="Daily cycle log reminder (optional)"
            value={hn.cycle_log_reminders_enabled === true}
            onChange={(v) => saveHealth({ cycle_log_reminders_enabled: v })} theme={theme} />
          {hn.cycle_log_reminders_enabled === true && (
            <HourChips hours={[17, 18, 19, 20, 21]}
              current={hn.cycle_log_hour ?? 20}
              onSelect={(h) => saveHealth({ cycle_log_hour: h })}
              accentColor={theme.coral?.sub ?? "#E87A96"} theme={theme} />
          )}
        </View>
      </View>

      {/* Activity reminder */}
      <Text style={[styles.groupLabel, { color: theme.textSoft }]}>ACTIVITY REMINDER</Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.ink }]}>
        <Text style={[styles.desc, { color: theme.textSoft }]}>Reminds you to log a hobby or activity if you have any set up.</Text>
        <ToggleRow label="Remind me to log activities" value={sn.hobby_reminder?.enabled === true}
          onChange={(v) => save({ hobby_reminder: { ...sn.hobby_reminder, enabled: v } })} theme={theme} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  groupLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginTop: 4, marginBottom: -4 },
  card: { borderRadius: 14, borderWidth: 2, padding: 16, gap: 8 },
  desc: { fontSize: 12, marginBottom: 4 },
  subLabel: { fontSize: 13, marginTop: 8 },
  btn: { borderWidth: 2, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  chip: { borderWidth: 2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
});
