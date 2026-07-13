const BASE_URL = "https://app.kels.gg/api";

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(BASE_URL + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error("API error " + res.status + ": " + (await res.text()));
  return res.json();
}

export const api = {
  today: function (userId: string) {
    return request("/summary/today?user_id=" + userId);
  },
  pattern: function (userId: string, date?: string) {
    return request("/summary/pattern?user_id=" + userId + (date ? "&date=" + date : ""));
  },

  books: function (userId: string) {
    return request("/books?user_id=" + userId);
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

  hobbies: function (userId: string) {
    return request("/hobbies?user_id=" + userId);
  },
  createHobby: function (payload: Record<string, unknown>) {
    return request("/hobbies", { method: "POST", body: JSON.stringify(payload) });
  },
  logHobby: function (hobbyId: string, amount: number, rating?: number, note?: string) {
    return request("/hobbies/" + hobbyId + "/logs", { method: "POST", body: JSON.stringify({ amount: amount, rating: rating, note: note }) });
  },
  hobbyStats: function (hobbyId: string) {
    return request("/hobbies/" + hobbyId + "/stats");
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
  lookupBarcode: function (code: string) {
    return request("/food/barcode/" + code);
  },
  meals: function (userId: string, date: string) {
    return request("/meals?user_id=" + userId + "&date=" + date);
  },
  addMeal: function (payload: Record<string, unknown>) {
    return request("/meals", { method: "POST", body: JSON.stringify(payload) });
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

  spending: function (userId: string, since?: string) {
    return request("/spending?user_id=" + userId + (since ? "&since=" + since : ""));
  },
  addSpending: function (payload: Record<string, unknown>) {
    return request("/spending", { method: "POST", body: JSON.stringify(payload) });
  },

  deleteBook: function (bookId: string) {
    return request("/books/" + bookId, { method: "DELETE" });
  },
  deleteHobby: function (hobbyId: string) {
    return request("/hobbies/" + hobbyId, { method: "DELETE" });
  },

  logMood: function (userId: string, mood_score: number, entry_text?: string) {
    return request("/journal", { method: "POST", body: JSON.stringify({ user_id: userId, mood_score: mood_score, entry_text: entry_text }) });
  },
  upsertPeriodMood: function (userId: string, mood_score: number, period: string, mood_label?: string, entry_text?: string) {
    return request("/journal", { method: "POST", body: JSON.stringify({ user_id: userId, mood_score, period, mood_label, entry_text, entry_type: "period" }) });
  },
  logMoodMoment: function (userId: string, mood_score: number, mood_label?: string, entry_text?: string) {
    return request("/journal", { method: "POST", body: JSON.stringify({ user_id: userId, mood_score, mood_label, entry_text, entry_type: "moment" }) });
  },
  dayView: function (userId: string, date: string) {
    return request("/summary/day?user_id=" + userId + "&date=" + date);
  },
  journalToday: function (userId: string) {
    return request("/journal/today?user_id=" + userId);
  },
  weeklyMoodSummary: function (userId: string) {
    return request("/journal/weekly-summary?user_id=" + userId);
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
  heartRateRange: function (userId: string, start: string, end: string) {
    return request("/heart-rate?user_id=" + userId + "&start=" + encodeURIComponent(start) + "&end=" + encodeURIComponent(end));
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
  getSettings: function (userId: string) {
    return request("/settings?user_id=" + userId);
  },
  patchSettings: function (userId: string, patch: Record<string, unknown>) {
    return request("/settings", { method: "PATCH", body: JSON.stringify({ user_id: userId, ...patch }) });
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
    return request("/metrics/" + metricId + "/logs", {
      method: "POST",
      body: JSON.stringify({ value: 1, logged_at: new Date().toISOString() }),
    });
  },
  todaysWaterCount: function (metricId: string) {
    return request("/metrics/" + metricId + "/logs");
  },
};
