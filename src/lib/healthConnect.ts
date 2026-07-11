import { initialize, requestPermission, readRecords } from "react-native-health-connect";
import { api } from "../api/client";
import { USER_ID } from "../api/config";

export async function requestHealthPermissions(): Promise<boolean> {
  try {
    const ready = await initialize();
    if (!ready) return false;
    const granted = await requestPermission([
      { accessType: "read", recordType: "Steps" },
      { accessType: "read", recordType: "SleepSession" },
      { accessType: "read", recordType: "HeartRate" },
    ]);
    return granted.length > 0;
  } catch (e) {
    console.error("Health Connect permission request failed", e);
    return false;
  }
}

export type SyncResult = {
  steps: number | null;
  sleepHours: number | null;
  heartRate: number | null;
  errors: string[];
};

export async function syncHealthData(): Promise<SyncResult> {
  await initialize();

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  // Sleep window: 8pm yesterday → now
  const sleepWindowStart = new Date(now);
  sleepWindowStart.setDate(sleepWindowStart.getDate() - 1);
  sleepWindowStart.setHours(20, 0, 0, 0);

  const errors: string[] = [];
  let steps: number | null = null;
  let sleepHours: number | null = null;
  let heartRate: number | null = null;

  // Steps
  try {
    const result = await readRecords("Steps", {
      timeRangeFilter: {
        operator: "between",
        startTime: startOfDay.toISOString(),
        endTime: now.toISOString(),
      },
    });
    const total = (result.records as any[]).reduce((sum, r) => sum + (r.count ?? 0), 0);
    if (total > 0) {
      await api.syncSteps(USER_ID, now.toISOString().split("T")[0], total);
      steps = total;
    }
  } catch (e: any) {
    errors.push("Steps: " + (e?.message ?? "unknown error"));
  }

  // Sleep
  try {
    const result = await readRecords("SleepSession", {
      timeRangeFilter: {
        operator: "between",
        startTime: sleepWindowStart.toISOString(),
        endTime: now.toISOString(),
      },
    });
    if ((result.records as any[]).length > 0) {
      const sessions = (result.records as any[]).map((s) => ({
        start_time: s.startTime,
        end_time: s.endTime,
        quality_score: null,
      }));
      await api.syncSleep(USER_ID, sessions);
      const totalMs = (result.records as any[]).reduce(
        (sum, s) => sum + (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()),
        0
      );
      sleepHours = Math.round((totalMs / 3600000) * 10) / 10;
    }
  } catch (e: any) {
    errors.push("Sleep: " + (e?.message ?? "unknown error"));
  }

  // Heart rate
  try {
    const result = await readRecords("HeartRate", {
      timeRangeFilter: {
        operator: "between",
        startTime: startOfDay.toISOString(),
        endTime: now.toISOString(),
      },
    });
    const readings = (result.records as any[]).flatMap((r) =>
      (r.samples ?? []).map((s: any) => ({
        recorded_at: s.time,
        bpm: s.beatsPerMinute,
      }))
    );
    if (readings.length > 0) {
      await api.syncHeartRate(USER_ID, readings);
      heartRate = readings[readings.length - 1].bpm;
    }
  } catch (e: any) {
    errors.push("Heart rate: " + (e?.message ?? "unknown error"));
  }

  return { steps, sleepHours, heartRate, errors };
}
