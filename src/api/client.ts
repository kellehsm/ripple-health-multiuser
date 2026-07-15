const BASE_URL = "https://app.kels.gg/api";

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(BASE_URL + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error("API error " + res.status + ": " + (await res.text()));
  return res.json();
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

// Wraps request() for mutating calls that should survive offline/5xx.
// On network error or 5xx: queues the payload locally and returns null.
// On 4xx (bad payload): propagates the error normally.
async function requestQueued(
  path: string,
  options: RequestInit,
  payload: Record<string, unknown>
): Promise<any> {
  try {
    return await request(path, options);
  } catch (err) {
    // Lazy import avoids circular dep at module load time
    const { queueOfflineRequest, isQueueableEndpoint } = await import("../utils/syncQueue");
    if (isNetworkOrServerError(err) && isQueueableEndpoint(path)) {
      queueOfflineRequest(path, options.method as string, payload);
      return null;
    }
    throw err;
  }
}
export const GOOGLE_CLIENT_ID =
  "629396147708-a40h3rld7t1bjt1nsm097g010p2jaai9.apps.googleusercontent.com";
export const api = {
  today: function (userId: string) {
    return request("/summary/today?user_id=" + userId);
  },
  pattern: function (userId: string, date?: string) {
    return request("/summary/pattern?user_id=" + userId + (date ? "&date=" + date : ""));
  },

  books: function (userId: string, status?: string) {
    return request("/books?user_id=" + userId + (status ? "&status=" + status : ""));
  },
  searchBooks: function (q: string) {
    return request("/books-search/search?q=" + encodeURIComponent(q));
  },
  createBook: function (payload: Record<string, unknown>) {
    return request("/books", { method: "POST", body: JSON.stringify(payload) });
  },
  logPages: function (bookId: string, pages_read: number) {
    return request("/books/" + bookId + "/logs", { method: "POST", body: JSON.stringify({ pages_read: pages_read }) });
  },
  bookProgress: function (bookId: string) {
    return request("/books/" + bookId + "/progress");
  },
  updateBook: function (bookId: string, payload: Record<string, unknown>) {
    return request("/books/" + bookId, { method: "PATCH", body: JSON.stringify(payload) });
  },

  hobbies: function (userId: string, status?: string) {
    return request("/hobbies?user_id=" + userId + (status ? "&status=" + status : ""));
  },
  updateHobby: function (hobbyId: string, payload: Record<string, unknown>) {
    return request("/hobbies/" + hobbyId, { method: "PATCH", body: JSON.stringify(payload) });
  },
  completed: function (userId: string) {
    return request("/completed?user_id=" + userId);
  },
  createHobby: function (payload: Record<string, unknown>) {
    return request("/hobbies", { method: "POST", body: JSON.stringify(payload) });
  },
  logHobby: function (hobbyId: string, amount: number, rating?: number, note?: string) {
    return request("/hobbies/" + hobbyId + "/logs", { method: "POST", body: JSON.stringify({ amount: amount, rating: rating, note: note }) });
  },
  hobbyStats: function (hobbyId: string, weekStartDay?: number) {
    const qs = weekStartDay !== undefined ? "?week_start_day=" + weekStartDay : "";
    return request("/hobbies/" + hobbyId + "/stats" + qs);
  },

  glucoseToday: function (userId: string, date: string) {
    return request("/glucose?user_id=" + userId + "&date=" + date);
  },
  glucoseRange: function (userId: string, start: string, end: string) {
    return request("/glucose?user_id=" + userId + "&start=" + encodeURIComponent(start) + "&end=" + encodeURIComponent(end));
  },
  glucoseStatus: function (userId: string) {
    return request("/glucose/status?user_id=" + userId);
  },

  searchFood: function (q: string) {
    return request("/food/search?q=" + encodeURIComponent(q));
  },
  lookupBarcode: function (code: string, type?: "caffeine" | "alcohol") {
    return request("/food/barcode/" + code + (type ? "?type=" + type : ""));
  },
  meals: function (userId: string, date: string) {
    return request("/meals?user_id=" + userId + "&date=" + date);
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
  frequentMeals: function (userId: string) {
    return request("/meals/frequent?user_id=" + userId);
  },

  spending: function (userId: string, since?: string) {
    return request("/spending?user_id=" + userId + (since ? "&since=" + since : ""));
  },
  addSpending: function (payload: Record<string, unknown>) {
    return requestQueued("/spending", { method: "POST", body: JSON.stringify(payload) }, payload);
  },

  deleteBook: function (bookId: string) {
    return request("/books/" + bookId, { method: "DELETE" });
  },
  deleteHobby: function (hobbyId: string) {
    return request("/hobbies/" + hobbyId, { method: "DELETE" });
  },

  logMood: function (userId: string, mood_score: number, entry_text?: string) {
    const payload = { user_id: userId, mood_score, entry_text };
    return requestQueued("/journal", { method: "POST", body: JSON.stringify(payload) }, payload);
  },
  upsertPeriodMood: function (userId: string, mood_score: number, period: string, mood_label?: string, entry_text?: string) {
    const payload = { user_id: userId, mood_score, period, mood_label, entry_text, entry_type: "period" };
    return requestQueued("/journal", { method: "POST", body: JSON.stringify(payload) }, payload);
  },
  logMoodMoment: function (userId: string, mood_score: number, mood_label?: string, entry_text?: string) {
    const payload = { user_id: userId, mood_score, mood_label, entry_text, entry_type: "moment" };
    return requestQueued("/journal", { method: "POST", body: JSON.stringify(payload) }, payload);
  },
  dayView: function (userId: string, date: string) {
    return request("/summary/day?user_id=" + userId + "&date=" + date);
  },
  journalToday: function (userId: string) {
    return request("/journal/today?user_id=" + userId);
  },
  weeklyMoodSummary: function (userId: string, days?: number) {
    const qs = days ? "&days=" + days : "";
    return request("/journal/weekly-summary?user_id=" + userId + qs);
  },

  stepsToday: function (userId: string, date: string) {
    return request("/health-connect/steps?user_id=" + userId + "&date=" + date);
  },
  syncSteps: function (userId: string, date: string, count: number) {
    return request("/health-connect/steps", { method: "POST", body: JSON.stringify({ user_id: userId, date, count }) });
  },
  sleepToday: function (userId: string, date: string) {
    return request("/health-connect/sleep?user_id=" + userId + "&date=" + date);
  },
  sleepStats: function (userId: string) {
    return request("/health-connect/sleep/stats?user_id=" + userId);
  },
  syncSleep: function (userId: string, sessions: Array<{ start_time: string; end_time: string; quality_score: number | null }>) {
    return request("/health-connect/sleep", { method: "POST", body: JSON.stringify({ user_id: userId, sessions }) });
  },
  syncHeartRate: function (userId: string, readings: Array<{ recorded_at: string; bpm: number }>) {
    return request("/health-connect/heart-rate", { method: "POST", body: JSON.stringify({ user_id: userId, readings }) });
  },

  getStepsMetric: function (userId: string) {
    return request("/metrics?user_id=" + userId + "&name=steps");
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
  heartRateRange: function (userId: string, start: string, end: string) {
    return request("/heart-rate?user_id=" + userId + "&start=" + encodeURIComponent(start) + "&end=" + encodeURIComponent(end));
  },
  heartRateDaily: function (userId: string, days: number = 7) {
    return request("/heart-rate/daily?user_id=" + userId + "&days=" + days);
  },
  reportUrl: function (userId: string, start: string, end: string): string {
    return BASE_URL + "/export/doctor-report?user_id=" + userId + "&start=" + encodeURIComponent(start) + "&end=" + encodeURIComponent(end);
  },
  weeklyDigest: function (userId: string) {
    return request("/summary/weekly-digest?user_id=" + userId);
  },
  streaks: function (userId: string) {
    return request("/summary/streaks?user_id=" + userId);
  },
  searchGlucose: function (userId: string, params: { threshold?: number; bucket?: string; start?: string; end?: string } = {}) {
    const qs = new URLSearchParams({ user_id: userId, ...Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])) });
    return request("/search/glucose?" + qs.toString());
  },
  searchMeals: function (userId: string, params: { q?: string; min_carbs?: number; start?: string; end?: string } = {}) {
    const qs = new URLSearchParams({ user_id: userId, ...Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])) });
    return request("/search/meals?" + qs.toString());
  },
  searchMood: function (userId: string, params: { min_score?: number; max_score?: number; start?: string; end?: string } = {}) {
    const qs = new URLSearchParams({ user_id: userId, ...Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])) });
    return request("/search/mood?" + qs.toString());
  },
  searchSpending: function (userId: string, params: { min_amount?: number; category?: string; start?: string; end?: string } = {}) {
    const qs = new URLSearchParams({ user_id: userId, ...Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])) });
    return request("/search/spending?" + qs.toString());
  },
  exportAllUrl: function (userId: string): string {
    return BASE_URL + "/export/all?user_id=" + userId;
  },
  contextCorrelation: function (userId: string, key: string, compareTo: "mood" | "glucose", days?: number) {
    const qs = new URLSearchParams({ user_id: userId, key, compare_to: compareTo, ...(days ? { days: String(days) } : {}) });
    return request("/analytics/context-correlation?" + qs.toString());
  },
  getSettings: function (userId: string) {
    return request("/settings?user_id=" + userId);
  },
  patchSettings: function (userId: string, patch: Record<string, unknown>) {
    return request("/settings", { method: "PATCH", body: JSON.stringify({ user_id: userId, ...patch }) });
  },
  getDriveStatus: function (userId: string) {
    return request("/settings/google-drive/status?user_id=" + userId);
  },
  triggerDriveBackup: function (userId: string) {
    return request("/settings/google-drive/backup", { method: "POST", body: JSON.stringify({ user_id: userId }) });
  },
  setDriveAutoBackup: function (userId: string, enabled: boolean) {
    return request("/settings/google-drive/auto-backup", { method: "PATCH", body: JSON.stringify({ user_id: userId, enabled }) });
  },
  disconnectDrive: function (userId: string) {
    return request("/settings/google-drive/disconnect", { method: "POST", body: JSON.stringify({ user_id: userId }) });
  },

  searchSubstances: function (q: string, type: "caffeine" | "alcohol") {
    return request("/substances/search?query=" + encodeURIComponent(q) + "&type=" + type);
  },
  logSubstance: function (payload: Record<string, unknown>) {
    return requestQueued("/substances", { method: "POST", body: JSON.stringify(payload) }, payload);
  },
  substancesToday: function (userId: string, date: string) {
    return request("/substances?user_id=" + userId + "&date=" + date);
  },
  substancesSummary: function (userId: string, start: string, end: string) {
    return request("/substances/summary?user_id=" + userId + "&start=" + start + "&end=" + end);
  },
  deleteSubstance: function (id: string) {
    return request("/substances/" + id, { method: "DELETE" });
  },

  getOrCreateWaterMetric: async function (userId: string) {
    const list = await request("/metrics?user_id=" + userId + "&name=water");
    if (list && list.length > 0) return list[0];
    return request("/metrics", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, name: "water", value_type: "number", unit: "glasses", icon: "water", color_key: "blue" }),
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
};
