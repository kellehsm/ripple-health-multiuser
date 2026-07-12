import notifee, { AndroidImportance } from "@notifee/react-native";
import { initialize, readRecords } from "react-native-health-connect";
import { api } from "../api/client";
import { USER_ID } from "../api/config";

const CHANNEL_ID = "ripple-health-live";
const NOTIF_ID = "ripple-health-live";

async function ensureChannel() {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: "Live Health Tracking",
    importance: AndroidImportance.LOW,
  });
}

async function syncAndUpdateNotification(notificationId: string) {
  let stepsText = "-- steps";
  let glucoseText = "--";

  try {
    await initialize();
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const result = await readRecords("Steps", {
      timeRangeFilter: {
        operator: "between",
        startTime: startOfDay.toISOString(),
        endTime: now.toISOString(),
      },
    });
    const total = (result.records as any[]).reduce(
      (sum, r) => sum + (r.count ?? 0),
      0
    );
    if (total > 0) {
      const today = now.toISOString().split("T")[0];
      await api.syncSteps(USER_ID, today, total);
      stepsText = total.toLocaleString() + " steps today";
    }
  } catch (e) {
    console.error("FG service steps error", e);
  }

  try {
    const status = await api.glucoseStatus(USER_ID);
    if (status?.hasData && status?.mg_dl != null) {
      glucoseText =
        status.mg_dl + " mg/dL" + (status.arrow ? " " + status.arrow : "");
    }
  } catch (e) {
    console.error("FG service glucose error", e);
  }

  await notifee.displayNotification({
    id: notificationId,
    title: "Ripple Health",
    body: glucoseText + " · " + stepsText,
    android: {
      channelId: CHANNEL_ID,
      asForegroundService: true,
      ongoing: true,
      importance: AndroidImportance.LOW,
      pressAction: { id: "default" },
    },
  });
}

// Called from index.js — registers the headless handler before the React tree mounts.
export function registerForegroundServiceHandler() {
  notifee.registerForegroundService((notification) => {
    const sleep = (ms: number) =>
      new Promise<void>((r) => setTimeout(r, ms));
    const INTERVAL = 5 * 60 * 1000;

    return new Promise(async () => {
      await syncAndUpdateNotification(notification.id!);
      while (true) {
        await sleep(INTERVAL);
        await syncAndUpdateNotification(notification.id!);
      }
    });
  });
}

export async function startForegroundService() {
  await ensureChannel();
  await notifee.displayNotification({
    id: NOTIF_ID,
    title: "Ripple Health",
    body: "Starting live tracking…",
    android: {
      channelId: CHANNEL_ID,
      asForegroundService: true,
      ongoing: true,
      importance: AndroidImportance.LOW,
      pressAction: { id: "default" },
    },
  });
}

export async function stopForegroundService() {
  await notifee.stopForegroundService();
}

export async function isForegroundServiceRunning(): Promise<boolean> {
  const displayed = await notifee.getDisplayedNotifications();
  return displayed.some((n) => n.id === NOTIF_ID);
}
