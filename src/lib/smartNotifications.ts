import notifee, { AndroidImportance } from "@notifee/react-native";
import { api } from "../api/client";
import { USER_ID } from "../api/config";

export const CH_MEALS   = "ripple-meal-reminders";
export const CH_GLUCOSE = "ripple-glucose";
export const CH_EVENING = "ripple-evening";
export const CH_WATER   = "ripple-water";
export const CH_STREAK  = "ripple-streak";

export async function initSmartChannels() {
  await Promise.all([
    notifee.createChannel({ id: CH_MEALS,   name: "Meal Reminders",    importance: AndroidImportance.DEFAULT }),
    notifee.createChannel({ id: CH_GLUCOSE, name: "Glucose Alerts",    importance: AndroidImportance.HIGH }),
    notifee.createChannel({ id: CH_EVENING, name: "Evening Check-in",  importance: AndroidImportance.DEFAULT }),
    notifee.createChannel({ id: CH_WATER,   name: "Water Reminders",   importance: AndroidImportance.DEFAULT }),
    notifee.createChannel({ id: CH_STREAK,  name: "Streak Protection", importance: AndroidImportance.DEFAULT }),
  ]);
}

// ── Deduplication ──────────────────────────────────────────────────────────
// Module-level state persists for the life of the foreground service.
// A new day clears the set so each reminder can fire once per calendar day.
const sent = new Set<string>();
let sentDate = "";

function resetIfNewDay() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== sentDate) {
    sentDate = today;
    sent.clear();
  }
}

function wasSent(key: string): boolean {
  resetIfNewDay();
  return sent.has(key);
}

function markSent(key: string) {
  sent.add(key);
}

// ── Meal reminders ─────────────────────────────────────────────────────────
type MealCfg = { key: string; label: string; defaultHour: number; windowStart: number; windowEnd: number };
const MEALS: MealCfg[] = [
  { key: "breakfast", label: "Breakfast", defaultHour: 9,  windowStart: 4,  windowEnd: 11 },
  { key: "lunch",     label: "Lunch",     defaultHour: 13, windowStart: 11, windowEnd: 15 },
  { key: "dinner",    label: "Dinner",    defaultHour: 19, windowStart: 17, windowEnd: 23 },
];

export async function checkMealReminders(settings: any, now: Date) {
  const mealCfg = settings?.smart_notifications?.meal_reminders;
  if (!mealCfg?.enabled) return;

  const nowH = now.getHours();
  const today = now.toISOString().slice(0, 10);

  let meals: any[] = [];
  try { meals = await api.meals(USER_ID, today); } catch (_) {}

  for (const m of MEALS) {
    const periodCfg = mealCfg[m.key] ?? {};
    if (periodCfg.enabled === false) continue;

    const reminderH: number = periodCfg.hour ?? m.defaultHour;
    if (nowH < reminderH) continue;
    if (wasSent(`meal_${m.key}`)) continue;
    markSent(`meal_${m.key}`);

    const alreadyLogged = meals.some((entry: any) => {
      const h = new Date(entry.logged_at).getHours();
      return h >= m.windowStart && h < m.windowEnd;
    });
    if (alreadyLogged) continue;

    await notifee.displayNotification({
      id: `meal-reminder-${m.key}`,
      title: `${m.label} logged?`,
      body: `No ${m.label.toLowerCase()} logged yet — tap to add it.`,
      data: { target: "meals" },
      android: {
        channelId: CH_MEALS,
        smallIcon: "ic_launcher",
        pressAction: { id: "default", launchActivity: "default" },
        actions: [
          { title: "Log now",        pressAction: { id: "log-meal",           launchActivity: "default" } },
          { title: "Already logged", pressAction: { id: `ack-meal-${m.key}` } },
          { title: "Skip",           pressAction: { id: `skip-meal-${m.key}` } },
        ],
      },
    });
  }
}

// ── Glucose spike ──────────────────────────────────────────────────────────
// Tracks last spike time (ms) across the full day, not just per-hour.
let lastSpikeMs = 0;
const SPIKE_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours

export async function checkGlucoseSpike(settings: any, now: Date) {
  const spikeCfg = settings?.smart_notifications?.glucose_spike;
  if (!spikeCfg?.enabled) return;
  if (now.getTime() - lastSpikeMs < SPIKE_COOLDOWN_MS) return;

  const threshold: number = spikeCfg.threshold_mg_dl ?? 30;
  try {
    const windowStart = new Date(now.getTime() - 70 * 60 * 1000);
    const readings = await api.glucoseRange(USER_ID, windowStart.toISOString(), now.toISOString());
    if (!Array.isArray(readings) || readings.length < 2) return;

    const earliest = Number(readings[0].mg_dl);
    const latest = Number(readings[readings.length - 1].mg_dl);
    const rise = latest - earliest;
    if (rise < threshold) return;

    lastSpikeMs = now.getTime();
    await notifee.displayNotification({
      id: "glucose-spike",
      title: "Glucose rising \u{1F4C8}",
      body: `Up ${rise} mg/dL in the last hour (${earliest} → ${latest}). Did you eat something?`,
      data: { target: "meals" },
      android: {
        channelId: CH_GLUCOSE,
        smallIcon: "ic_launcher",
        pressAction: { id: "default", launchActivity: "default" },
        actions: [
          { title: "Yes, log a meal", pressAction: { id: "log-meal",     launchActivity: "default" } },
          { title: "No, nothing",     pressAction: { id: "dismiss-spike" } },
        ],
      },
    });
  } catch (_) {}
}

// ── Evening check-in ───────────────────────────────────────────────────────
export async function checkEveningCheckin(settings: any, now: Date) {
  const checkinCfg = settings?.smart_notifications?.evening_checkin;
  if (!checkinCfg?.enabled) return;

  const targetH: number = checkinCfg.hour ?? 21;
  if (now.getHours() < targetH) return;
  if (wasSent("evening_checkin")) return;
  markSent("evening_checkin");

  const today = now.toISOString().slice(0, 10);
  let body = "Tap to review your day.";
  try {
    const [meals, streaks] = await Promise.all([
      api.meals(USER_ID, today).catch(() => [] as any[]),
      api.streaks(USER_ID).catch(() => null),
    ]);
    const parts: string[] = [];
    const mealCount = Array.isArray(meals) ? meals.length : 0;
    if (mealCount > 0) parts.push(`${mealCount} meal${mealCount !== 1 ? "s" : ""} logged`);
    if (streaks?.current_streak > 0) parts.push(`${streaks.current_streak}d streak`);
    if (parts.length > 0) body = parts.join(" · ") + " — how did the rest of the day go?";
  } catch (_) {}

  await notifee.displayNotification({
    id: "evening-checkin",
    title: "End of day check-in",
    body,
    android: {
      channelId: CH_EVENING,
      smallIcon: "ic_launcher",
      pressAction: { id: "default", launchActivity: "default" },
    },
  });
}

// ── Water reminder ─────────────────────────────────────────────────────────
let cachedWaterMetricId: string | null = null;
let lastWaterReminderMs = 0;
const WATER_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours between reminders

export async function checkWaterReminder(settings: any, now: Date) {
  const waterCfg = settings?.smart_notifications?.water_reminder;
  if (!waterCfg?.enabled) return;

  const startH: number = waterCfg.start_hour ?? 9;
  if (now.getHours() < startH) return;
  if (now.getTime() - lastWaterReminderMs < WATER_COOLDOWN_MS) return;

  const goal: number = waterCfg.goal ?? 8;

  try {
    if (!cachedWaterMetricId) {
      const metric = await api.getOrCreateWaterMetric(USER_ID);
      cachedWaterMetricId = metric?.id ?? null;
    }
    if (!cachedWaterMetricId) return;

    const logs: any[] = await api.todaysWaterCount(cachedWaterMetricId);
    const todayStr = now.toDateString();
    const todayCount = Array.isArray(logs)
      ? logs
          .filter((l) => new Date(l.logged_at).toDateString() === todayStr)
          .reduce((sum, l) => sum + Number(l.value), 0)
      : 0;

    if (todayCount >= goal) return;

    lastWaterReminderMs = now.getTime();
    await notifee.displayNotification({
      id: "water-reminder",
      title: "Stay hydrated 💧",
      body: `${todayCount}/${goal} glasses today — time for another?`,
      android: {
        channelId: CH_WATER,
        smallIcon: "ic_launcher",
        pressAction: { id: "default", launchActivity: "default" },
        actions: [
          { title: "Log glass", pressAction: { id: "log-water", launchActivity: "default" } },
          { title: "Skip",      pressAction: { id: "dismiss-water" } },
        ],
      },
    });
  } catch (_) {}
}

// ── Streak protection ──────────────────────────────────────────────────────
export async function checkStreakProtection(settings: any, now: Date) {
  const streakCfg = settings?.smart_notifications?.streak_protection;
  if (!streakCfg?.enabled) return;

  const targetH: number = streakCfg.hour ?? 20;
  if (now.getHours() < targetH) return;
  if (wasSent("streak_protection")) return;
  markSent("streak_protection");

  try {
    const [streaks, meals] = await Promise.all([
      api.streaks(USER_ID).catch(() => null),
      api.meals(USER_ID, now.toISOString().slice(0, 10)).catch(() => [] as any[]),
    ]);

    if (!streaks?.current_streak || streaks.current_streak < 1) return;
    if (Array.isArray(meals) && meals.length > 0) return;

    await notifee.displayNotification({
      id: "streak-protection",
      title: `Don't break your ${streaks.current_streak}-day streak! 🔥`,
      body: "Log a meal or habit before midnight to keep it going.",
      data: { target: "meals" },
      android: {
        channelId: CH_STREAK,
        smallIcon: "ic_launcher",
        pressAction: { id: "default", launchActivity: "default" },
        actions: [
          { title: "Log now", pressAction: { id: "log-meal", launchActivity: "default" } },
          { title: "Dismiss", pressAction: { id: "dismiss-streak" } },
        ],
      },
    });
  } catch (_) {}
}
