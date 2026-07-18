import { getToken } from "../lib/auth";
import { setNetworkOnline } from "../utils/networkState";

const BASE_URL = __DEV__ ? "http://129.121.125.214:4002" : "https://app.kels.gg/api";

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const token = await getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = "Bearer " + token;
  try {
    const res = await fetch(BASE_URL + path, { headers, ...options });
    if (!res.ok) throw new Error("API error " + res.status + ": " + (await res.text()));
    setNetworkOnline(true);
    return res.json();
  } catch (err) {
    const msg = (err as Error)?.message ?? "";
    if (
      msg.includes("Network request failed") ||
      msg.includes("Failed to fetch") ||
      (msg.includes("network") && !msg.includes("API error"))
    ) {
      setNetworkOnline(false);
    }
    throw err;
  }
}

function isNetworkOrServerError(err: unknown): boolean {
  const msg = (err as Error)?.message ?? "";
  return (
    msg.includes("Network request failed") ||
    msg.includes("Failed to fetch") ||
    msg.includes("network") ||
    /API error 5\d\d/.test(msg)
  );
}

async function requestQueued(
  path: string,
  options: RequestInit,
  payload: Record<string, unknown>
): Promise<any> {
  try {
    return await request(path, options);
  } catch (err) {
    const { queueOfflineRequest, isQueueableEndpoint, getPendingQueueCount } = await import("../utils/syncQueue");
    if (isNetworkOrServerError(err) && isQueueableEndpoint(path)) {
      queueOfflineRequest(path, options.method as string, payload);
      const { setNetworkPending } = await import("../utils/networkState");
      setNetworkPending(getPendingQueueCount());
      return null;
    }
    throw err;
  }
}

// Returns BASE_URL with auth token appended — for URL-based file downloads/PDFs.
async function authedUrl(path: string): Promise<string> {
  const token = await getToken();
  const sep = path.includes("?") ? "&" : "?";
  return BASE_URL + path + (token ? sep + "token=" + encodeURIComponent(token) : "");
}

export const GOOGLE_CLIENT_ID =
  "629396147708-a40h3rld7t1bjt1nsm097g010p2jaai9.apps.googleusercontent.com";

export const api = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  login: function (email: string, password: string) {
    return request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  },
  signup: function (email: string, password: string, name?: string) {
    return request("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, ...(name ? { name } : {}) }),
    });
  },
  dexcomVerifyShare: function (params: { username?: string; account_id?: string; password: string; region?: string }) {
    return request("/dexcom/verify-share", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },
  me: function () {
    return request("/auth/me", { method: "POST", body: JSON.stringify({}) });
  },
  changePassword: function (current_password: string, new_password: string) {
    return request("/auth/change-password", { method: "POST", body: JSON.stringify({ current_password, new_password }) });
  },
  markOnboardingComplete: function () {
    return request("/auth/onboarding-complete", { method: "PATCH" });
  },

  // ── Summary ───────────────────────────────────────────────────────────────
  today: function () {
    return request("/summary/today");
  },
  pattern: function (date?: string) {
    return request("/summary/pattern" + (date ? "?date=" + date : ""));
  },
  dayView: function (date: string) {
    return request("/summary/day?date=" + date);
  },
  weeklyDigest: function () {
    return request("/summary/weekly-digest");
  },
  streaks: function () {
    return request("/summary/streaks");
  },
  dailySummary: function (date?: string) {
    const d = date ?? new Date().toISOString().slice(0, 10);
    return request("/summary/daily/" + d);
  },

  // ── Books ─────────────────────────────────────────────────────────────────
  books: function (status?: string) {
    return request("/books" + (status ? "?status=" + status : ""));
  },
  searchBooks: function (q: string) {
    return request("/books-search/search?q=" + encodeURIComponent(q));
  },
  createBook: function (payload: Record<string, unknown>) {
    return request("/books", { method: "POST", body: JSON.stringify(payload) });
  },
  logPages: function (bookId: string, pages_read: number) {
    return request("/books/" + bookId + "/logs", { method: "POST", body: JSON.stringify({ pages_read }) });
  },
  bookProgress: function (bookId: string) {
    return request("/books/" + bookId + "/progress");
  },
  updateBook: function (bookId: string, payload: Record<string, unknown>) {
    return request("/books/" + bookId, { method: "PATCH", body: JSON.stringify(payload) });
  },
  deleteBook: function (bookId: string) {
    return request("/books/" + bookId, { method: "DELETE" });
  },

  // ── Hobbies ───────────────────────────────────────────────────────────────
  hobbies: function (status?: string) {
    return request("/hobbies" + (status ? "?status=" + status : ""));
  },
  createHobby: function (payload: Record<string, unknown>) {
    return request("/hobbies", { method: "POST", body: JSON.stringify(payload) });
  },
  updateHobby: function (hobbyId: string, payload: Record<string, unknown>) {
    return request("/hobbies/" + hobbyId, { method: "PATCH", body: JSON.stringify(payload) });
  },
  logHobby: function (hobbyId: string, amount: number, rating?: number, note?: string) {
    return request("/hobbies/" + hobbyId + "/logs", { method: "POST", body: JSON.stringify({ amount, rating, note }) });
  },
  hobbyStats: function (hobbyId: string, weekStartDay?: number) {
    const qs = weekStartDay !== undefined ? "?week_start_day=" + weekStartDay : "";
    return request("/hobbies/" + hobbyId + "/stats" + qs);
  },
  deleteHobby: function (hobbyId: string) {
    return request("/hobbies/" + hobbyId, { method: "DELETE" });
  },

  // ── Completed ─────────────────────────────────────────────────────────────
  completed: function () {
    return request("/completed");
  },

  // ── Glucose ───────────────────────────────────────────────────────────────
  glucoseToday: function (date: string) {
    return request("/glucose?date=" + date);
  },
  glucoseRange: function (start: string, end: string) {
    return request("/glucose?start=" + encodeURIComponent(start) + "&end=" + encodeURIComponent(end));
  },
  glucoseStatus: function () {
    return request("/glucose/status");
  },

  // ── Food ──────────────────────────────────────────────────────────────────
  searchFood: function (q: string) {
    return request("/food/search?q=" + encodeURIComponent(q));
  },
  lookupBarcode: function (code: string, type?: "caffeine" | "alcohol") {
    return request("/food/barcode/" + code + (type ? "?type=" + type : ""));
  },
  saveBarcodeCorrection: function (
    barcode: string,
    correction: {
      name?: string | null;
      carbs_g?: number | null;
      calories?: number | null;
      sugar_g?: number | null;
      caffeine_mg?: number | null;
      abv_percent?: number | null;
      serving_size?: string | null;
    }
  ) {
    return request("/food/barcode/" + barcode + "/correction", {
      method: "POST",
      body: JSON.stringify(correction),
    });
  },

  // ── Meals ─────────────────────────────────────────────────────────────────
  meals: function (date: string) {
    return request("/meals?date=" + date);
  },
  addMeal: function (payload: Record<string, unknown>) {
    return requestQueued("/meals", { method: "POST", body: JSON.stringify(payload) }, payload);
  },
  updateMeal: function (mealId: string, payload: Record<string, unknown>) {
    return request("/meals/" + mealId, { method: "PATCH", body: JSON.stringify(payload) });
  },
  deleteMeal: function (mealId: string) {
    return request("/meals/" + mealId, { method: "DELETE" });
  },
  mealGlucoseResponse: function (mealId: string) {
    return request("/meals/" + mealId + "/glucose-response");
  },
  frequentMeals: function () {
    return request("/meals/frequent");
  },

  // ── Spending ──────────────────────────────────────────────────────────────
  spending: function (since?: string) {
    return request("/spending" + (since ? "?since=" + since : ""));
  },
  addSpending: function (payload: Record<string, unknown>) {
    return requestQueued("/spending", { method: "POST", body: JSON.stringify(payload) }, payload);
  },

  // ── Journal / Mood ────────────────────────────────────────────────────────
  logMood: function (mood_score: number, entry_text?: string) {
    const payload = { mood_score, entry_text };
    return requestQueued("/journal", { method: "POST", body: JSON.stringify(payload) }, payload);
  },
  upsertPeriodMood: function (mood_score: number, period: string, mood_label?: string, entry_text?: string) {
    const payload = { mood_score, period, mood_label, entry_text, entry_type: "period" };
    return requestQueued("/journal", { method: "POST", body: JSON.stringify(payload) }, payload);
  },
  logMoodMoment: function (mood_score: number, mood_label?: string, entry_text?: string) {
    const payload = { mood_score, mood_label, entry_text, entry_type: "moment" };
    return requestQueued("/journal", { method: "POST", body: JSON.stringify(payload) }, payload);
  },
  journalToday: function () {
    return request("/journal/today");
  },
  weeklyMoodSummary: function (days?: number) {
    const qs = days ? "?days=" + days : "";
    return request("/journal/weekly-summary" + qs);
  },

  // ── Health Connect ────────────────────────────────────────────────────────
  stepsToday: function (date: string) {
    return request("/health-connect/steps?date=" + date);
  },
  syncSteps: function (date: string, count: number) {
    return request("/health-connect/steps", { method: "POST", body: JSON.stringify({ date, count }) });
  },
  sleepToday: function (date: string) {
    return request("/health-connect/sleep?date=" + date);
  },
  sleepStats: function () {
    return request("/health-connect/sleep/stats");
  },
  syncSleep: function (sessions: Array<{ start_time: string; end_time: string; quality_score: number | null }>) {
    return request("/health-connect/sleep", { method: "POST", body: JSON.stringify({ sessions }) });
  },
  syncHeartRate: function (readings: Array<{ recorded_at: string; bpm: number }>) {
    return request("/health-connect/heart-rate", { method: "POST", body: JSON.stringify({ readings }) });
  },

  // ── Metrics ───────────────────────────────────────────────────────────────
  getStepsMetric: function () {
    return request("/metrics?name=steps");
  },
  waterStats: function (metricId: string) {
    return request("/metrics/" + metricId + "/stats");
  },
  stepsWeeklyTotal: function (metricId: string, weekStartDay?: number) {
    const qs = weekStartDay !== undefined ? "?week_start_day=" + weekStartDay : "";
    return request("/metrics/" + metricId + "/weekly-total" + qs);
  },
  metricDailyBreakdown: function (metricId: string, weekStartDay: number, agg: string = "max") {
    return request("/metrics/" + metricId + "/daily-breakdown?week_start_day=" + weekStartDay + "&agg=" + agg);
  },
  metricMonthlyBreakdown: function (metricId: string, weekStartDay: number, agg: string = "max") {
    return request("/metrics/" + metricId + "/monthly-breakdown?week_start_day=" + weekStartDay + "&agg=" + agg);
  },
  getOrCreateWaterMetric: async function () {
    const list = await request("/metrics?name=water");
    if (list && list.length > 0) return list[0];
    return request("/metrics", {
      method: "POST",
      body: JSON.stringify({ name: "water", value_type: "number", unit: "glasses", icon: "water", color_key: "blue" }),
    });
  },
  logWater: function (metricId: string) {
    const payload = { value: 1, logged_at: new Date().toISOString() };
    return requestQueued(
      "/metrics/" + metricId + "/logs",
      { method: "POST", body: JSON.stringify(payload) },
      payload
    );
  },
  todaysWaterCount: function (metricId: string) {
    return request("/metrics/" + metricId + "/logs");
  },

  // ── Heart Rate ────────────────────────────────────────────────────────────
  heartRateRange: function (start: string, end: string) {
    return request("/heart-rate?start=" + encodeURIComponent(start) + "&end=" + encodeURIComponent(end));
  },
  heartRateDaily: function (days: number = 7) {
    return request("/heart-rate/daily?days=" + days);
  },

  // ── Search ────────────────────────────────────────────────────────────────
  searchGlucose: function (params: { threshold?: number; bucket?: string; start?: string; end?: string } = {}) {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])));
    return request("/search/glucose?" + qs.toString());
  },
  searchMeals: function (params: { q?: string; min_carbs?: number; start?: string; end?: string } = {}) {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])));
    return request("/search/meals?" + qs.toString());
  },
  searchMood: function (params: { min_score?: number; max_score?: number; start?: string; end?: string } = {}) {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])));
    return request("/search/mood?" + qs.toString());
  },
  searchSpending: function (params: { min_amount?: number; category?: string; start?: string; end?: string } = {}) {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])));
    return request("/search/spending?" + qs.toString());
  },
  searchGlobal: function (q: string) {
    return request("/search/global?q=" + encodeURIComponent(q));
  },

  // ── Export (URL-based, token appended as query param) ─────────────────────
  reportUrl: async function (start: string, end: string): Promise<string> {
    return authedUrl("/export/doctor-report?start=" + encodeURIComponent(start) + "&end=" + encodeURIComponent(end));
  },
  exportAllUrl: async function (): Promise<string> {
    return authedUrl("/export/all");
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  getSettings: function () {
    return request("/settings");
  },
  patchSettings: function (patch: Record<string, unknown>) {
    return request("/settings", { method: "PATCH", body: JSON.stringify(patch) });
  },

  // ── Google Drive ──────────────────────────────────────────────────────────
  getDriveStatus: function () {
    return request("/settings/google-drive/status");
  },
  triggerDriveBackup: function () {
    return request("/settings/google-drive/backup", { method: "POST", body: JSON.stringify({}) });
  },
  setDriveAutoBackup: function (enabled: boolean) {
    return request("/settings/google-drive/auto-backup", { method: "PATCH", body: JSON.stringify({ enabled }) });
  },
  disconnectDrive: function () {
    return request("/settings/google-drive/disconnect", { method: "POST", body: JSON.stringify({}) });
  },
  listDriveBackups: function () {
    return request("/settings/google-drive/list-backups");
  },
  restoreFromDrive: function (file_id: string) {
    return request("/settings/google-drive/restore", { method: "POST", body: JSON.stringify({ file_id }) });
  },

  // ── Substances ────────────────────────────────────────────────────────────
  searchSubstances: function (q: string, type: "caffeine" | "alcohol") {
    return request("/substances/search?query=" + encodeURIComponent(q) + "&type=" + type);
  },
  logSubstance: function (payload: Record<string, unknown>) {
    return requestQueued("/substances", { method: "POST", body: JSON.stringify(payload) }, payload);
  },
  substancesToday: function (date: string) {
    return request("/substances?date=" + date);
  },
  substancesSummary: function (start: string, end: string) {
    return request("/substances/summary?start=" + start + "&end=" + end);
  },
  deleteSubstance: function (id: string) {
    return request("/substances/" + id, { method: "DELETE" });
  },

  // ── Insights ──────────────────────────────────────────────────────────────
  getInsights: function () {
    return request("/insights");
  },
  getInsightHistory: function () {
    return request("/insights/history");
  },
  dismissInsight: function (id: string) {
    return request("/insights/" + id + "/dismiss", { method: "POST", body: JSON.stringify({}) });
  },
  undismissInsight: function (id: string) {
    return request("/insights/" + id + "/undismiss", { method: "POST", body: JSON.stringify({}) });
  },
  regenerateInsights: function () {
    return request("/insights/regenerate", { method: "POST", body: JSON.stringify({}) });
  },

  // ── Analytics ─────────────────────────────────────────────────────────────
  contextCorrelation: function (key: string, compareTo: "mood" | "glucose", days?: number) {
    const qs = new URLSearchParams({ key, compare_to: compareTo, ...(days ? { days: String(days) } : {}) });
    return request("/analytics/context-correlation?" + qs.toString());
  },
  journey: function () {
    return request("/analytics/journey");
  },

  // ── Recipes ───────────────────────────────────────────────────────────────────
  recipes: function () {
    return request("/recipes");
  },
  createRecipe: function (payload: Record<string, unknown>) {
    return request("/recipes", { method: "POST", body: JSON.stringify(payload) });
  },
  updateRecipe: function (id: string, payload: Record<string, unknown>) {
    return request("/recipes/" + id, { method: "PATCH", body: JSON.stringify(payload) });
  },
  deleteRecipe: function (id: string) {
    return request("/recipes/" + id, { method: "DELETE" });
  },

  // ── Sync status ───────────────────────────────────────────────────────────────
  syncStatus: function () {
    return request("/settings/sync-status");
  },
};
