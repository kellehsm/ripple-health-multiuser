const BASE_URL = "http://129.121.125.214:4000/api";

async function request(path, options = {}) {
  const res = await fetch(BASE_URL + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error("API error " + res.status + ": " + (await res.text()));
  return res.json();
}

export const api = {
  today: function (userId) {
    return request("/summary/today?user_id=" + userId);
  },
  pattern: function (userId, date) {
    return request("/summary/pattern?user_id=" + userId + (date ? "&date=" + date : ""));
  },

  books: function (userId) {
    return request("/books?user_id=" + userId);
  },
  searchBooks: function (q) {
    return request("/books-search/search?q=" + encodeURIComponent(q));
  },
  createBook: function (payload) {
    return request("/books", { method: "POST", body: JSON.stringify(payload) });
  },
  logPages: function (bookId, pages_read) {
    return request("/books/" + bookId + "/logs", { method: "POST", body: JSON.stringify({ pages_read: pages_read }) });
  },
  updateBook: function (bookId, payload) {
    return request("/books/" + bookId, { method: "PATCH", body: JSON.stringify(payload) });
  },

  hobbies: function (userId) {
    return request("/hobbies?user_id=" + userId);
  },
  createHobby: function (payload) {
    return request("/hobbies", { method: "POST", body: JSON.stringify(payload) });
  },
  logHobby: function (hobbyId, amount, rating, note) {
    return request("/hobbies/" + hobbyId + "/logs", { method: "POST", body: JSON.stringify({ amount: amount, rating: rating, note: note }) });
  },

  glucoseToday: function (userId, date) {
    return request("/glucose?user_id=" + userId + "&date=" + date);
  },
  glucoseRange: function (userId, start, end) {
    return request("/glucose?user_id=" + userId + "&start=" + encodeURIComponent(start) + "&end=" + encodeURIComponent(end));
  },
  glucoseStatus: function (userId) {
    return request("/glucose/status?user_id=" + userId);
  },

  searchFood: function (q) {
    return request("/food/search?q=" + encodeURIComponent(q));
  },
  lookupBarcode: function (code) {
    return request("/food/barcode/" + code);
  },
  meals: function (userId, date) {
    return request("/meals?user_id=" + userId + "&date=" + date);
  },
  addMeal: function (payload) {
    return request("/meals", { method: "POST", body: JSON.stringify(payload) });
  },
  updateMeal: function (mealId, payload) {
    return request("/meals/" + mealId, { method: "PATCH", body: JSON.stringify(payload) });
  },
  deleteMeal: function (mealId) {
    return request("/meals/" + mealId, { method: "DELETE" });
  },
  mealGlucoseResponse: function (mealId) {
    return request("/meals/" + mealId + "/glucose-response");
  },

  spending: function (userId, since) {
    return request("/spending?user_id=" + userId + (since ? "&since=" + since : ""));
  },
  addSpending: function (payload) {
    return request("/spending", { method: "POST", body: JSON.stringify(payload) });
  },

  logMood: function (userId, mood_score, entry_text) {
    return request("/journal", { method: "POST", body: JSON.stringify({ user_id: userId, mood_score: mood_score, entry_text: entry_text }) });
  },
};

