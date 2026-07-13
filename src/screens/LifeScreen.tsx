import React, { useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { api } from "../api/client";
import { USER_ID } from "../api/config";

type Book = {
  id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  status: string;
  total_pages: number | null;
};

type Hobby = {
  id: string;
  name: string;
  unit_label: string;
};

type HobbyStats = {
  this_week_total: number;
  last_week_total: number;
  change: number;
};

function formatAmount(amount: number, unit: string): string {
  if (unit === "minutes") {
    if (amount === 0) return "0 min";
    const h = Math.floor(amount / 60);
    const m = amount % 60;
    if (h === 0) return m + " min";
    if (m === 0) return h + "h";
    return h + "h " + m + "m";
  }
  return amount + " " + unit;
}

function weekCompareText(stats: HobbyStats, unit: string): string {
  if (stats.last_week_total === 0) return "first week tracking this";
  if (stats.change === 0) return "same as last week";
  const dir = stats.change > 0 ? "up" : "down";
  return dir + " from " + formatAmount(stats.last_week_total, unit) + " last week";
}

type BookSearchResult = {
  title: string;
  author: string | null;
  cover_url: string | null;
  total_pages: number | null;
};

type Progress = {
  pages_read_total: number;
  total_pages: number | null;
  percent_complete: number | null;
};

export function LifeScreen() {
  const { theme } = useTheme();

  const [books, setBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [pageInputs, setPageInputs] = useState<Record<string, string>>({});

  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<BookSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [hobbies, setHobbies] = useState<Hobby[]>([]);
  const [loadingHobbies, setLoadingHobbies] = useState(true);
  const [hobbyListError, setHobbyListError] = useState<string | null>(null);
  const [hobbyStats, setHobbyStats] = useState<Record<string, HobbyStats>>({});
  const [hobbyAmountInputs, setHobbyAmountInputs] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [hobbyName, setHobbyName] = useState("");
  const [creatingHobby, setCreatingHobby] = useState(false);
  const [createHobbyError, setCreateHobbyError] = useState<string | null>(null);
  const [logHobbyError, setLogHobbyError] = useState<string | null>(null);

  const loadBooks = useCallback(async () => {
    setLoadingBooks(true);
    try {
      const data = await api.books(USER_ID);
      setBooks(data);
      const reading = data.filter((b: Book) => b.status === "reading");
      const entries = await Promise.all(
        reading.map(async (b: Book) => {
          const p = await api.bookProgress(b.id);
          return [b.id, p] as [string, Progress];
        })
      );
      setProgress(Object.fromEntries(entries));
    } catch (e) {
      console.error("Failed to load books", e);
    } finally {
      setLoadingBooks(false);
    }
  }, []);

  const loadHobbies = useCallback(async function () {
    setLoadingHobbies(true);
    setHobbyListError(null);
    try {
      const data: Hobby[] = await api.hobbies(USER_ID);
      const list = Array.isArray(data) ? data : [];
      setHobbies(list);
      const entries = await Promise.all(
        list.map(async (h) => {
          const s: HobbyStats = await api.hobbyStats(h.id);
          return [h.id, s] as [string, HobbyStats];
        })
      );
      setHobbyStats(Object.fromEntries(entries));
    } catch (e: any) {
      setHobbyListError((e as Error).message || "Failed to load hobbies");
    } finally {
      setLoadingHobbies(false);
    }
  }, []);

  useEffect(() => {
    loadBooks();
    loadHobbies();
  }, [loadBooks, loadHobbies]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await Promise.all([loadBooks(), loadHobbies()]); } finally { setRefreshing(false); }
  }

  async function handleSearch() {
    if (!searchText.trim()) return;
    setSearching(true);
    try {
      const results = await api.searchBooks(searchText);
      setSearchResults(results);
    } catch (e) {
      console.error("Book search failed", e);
    } finally {
      setSearching(false);
    }
  }

  async function handleAddBook(result: BookSearchResult) {
    try {
      await api.createBook({
        user_id: USER_ID,
        title: result.title,
        author: result.author,
        cover_url: result.cover_url,
        total_pages: result.total_pages,
      });
      setSearchText("");
      setSearchResults([]);
      loadBooks();
    } catch (e) {
      console.error("Failed to add book", e);
    }
  }

  async function handleLogPages(bookId: string, pages: number) {
    if (pages <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await api.logPages(bookId, pages);
      const p = await api.bookProgress(bookId);
      setProgress((prev) => ({ ...prev, [bookId]: p }));
    } catch (e) {
      console.error("Failed to log pages", e);
    }
  }

  async function handleManualPages(bookId: string) {
    const n = parseInt(pageInputs[bookId] ?? "", 10);
    if (!n || n <= 0) return;
    await handleLogPages(bookId, n);
    setPageInputs((prev) => ({ ...prev, [bookId]: "" }));
  }

  function handleDeleteBook(bookId: string, title: string) {
    Alert.alert("Delete book", 'Remove "' + title + '" and all its reading logs?', [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await api.deleteBook(bookId);
            loadBooks();
          } catch (e) {
            console.error("Failed to delete book", e);
          }
        },
      },
    ]);
  }

  function handleDeleteHobby(hobbyId: string, name: string) {
    Alert.alert("Delete hobby", 'Remove "' + name + '" and all its logs?', [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await api.deleteHobby(hobbyId);
            loadHobbies();
          } catch (e) {
            console.error("Failed to delete hobby", e);
          }
        },
      },
    ]);
  }

  function handleCreateHobby() {
    if (!hobbyName.trim()) return;
    setCreatingHobby(true);
    setCreateHobbyError(null);
    api
      .createHobby({
        user_id: USER_ID,
        name: hobbyName.trim(),
        unit_label: "minutes",
        icon: "star",
        color_key: "coral",
      })
      .then(function () {
        setHobbyName("");
        loadHobbies();
      })
      .catch(function (e: Error) {
        setCreateHobbyError(e.message || "Failed to create hobby");
      })
      .finally(function () {
        setCreatingHobby(false);
      });
  }

  async function handleLogHobby(hobbyId: string, amount: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLogHobbyError(null);
    try {
      await api.logHobby(hobbyId, amount, undefined, undefined);
      const s: HobbyStats = await api.hobbyStats(hobbyId);
      setHobbyStats((prev) => ({ ...prev, [hobbyId]: s }));
    } catch (e: any) {
      setLogHobbyError((e as Error).message || "Failed to log hobby");
    }
  }

  async function handleManualHobbyLog(hobbyId: string) {
    const n = parseFloat(hobbyAmountInputs[hobbyId] ?? "");
    if (!n || n <= 0) return;
    setHobbyAmountInputs((prev) => ({ ...prev, [hobbyId]: "" }));
    await handleLogHobby(hobbyId, n);
  }

  const currentlyReading = books.filter((b) => b.status === "reading");

  return (
    <ScrollView
      style={{ backgroundColor: theme.page }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.teal.bar} />}
    >
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Text style={[styles.cardTitle, { color: theme.textStrong }]}>Add a book</Text>
        <View style={styles.searchRow}>
          <TextInput
            placeholder="search by title..."
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={handleSearch}
            style={[styles.input, { borderColor: theme.cardBorder, color: theme.textStrong }]}
            placeholderTextColor={theme.textSoft}
          />
          <Pressable
            style={[styles.addButton, { backgroundColor: theme.teal.bar }]}
            onPress={handleSearch}
          >
            {searching ? <ActivityIndicator color="#fff" /> : <Text style={styles.addButtonText}>Search</Text>}
          </Pressable>
        </View>

        {searchResults.length > 0 && (
          <View style={{ marginTop: 12, gap: 8 }}>
            {searchResults.map((result, i) => (
              <Pressable
                key={i}
                onPress={() => handleAddBook(result)}
                style={[styles.resultRow, { borderColor: theme.cardBorder }]}
              >
                {result.cover_url ? (
                  <Image source={{ uri: result.cover_url }} style={styles.coverThumb} />
                ) : (
                  <View style={[styles.coverThumb, { backgroundColor: theme.teal.bg }]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.textStrong, fontSize: 13 }} numberOfLines={1}>
                    {result.title}
                  </Text>
                  <Text style={{ color: theme.textSoft, fontSize: 11 }} numberOfLines={1}>
                    {result.author ?? "Unknown author"}
                    {result.total_pages ? ` · ${result.total_pages}p` : ""}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Text style={[styles.cardTitle, { color: theme.textStrong }]}>Currently reading</Text>
        {loadingBooks ? (
          <ActivityIndicator style={{ marginTop: 10 }} />
        ) : currentlyReading.length === 0 ? (
          <Text style={{ color: theme.textSoft, fontSize: 12, marginTop: 10 }}>
            No books yet - search above to add one.
          </Text>
        ) : (
          currentlyReading.map((book) => {
            const prog = progress[book.id];
            const pagesTotal = prog?.pages_read_total ?? 0;
            const totalPages = prog?.total_pages ?? null;
            const pct = prog?.percent_complete ?? null;
            return (
              <View key={book.id} style={styles.bookRow}>
                {book.cover_url ? (
                  <Image source={{ uri: book.cover_url }} style={styles.coverThumb} />
                ) : (
                  <View style={[styles.coverThumb, { backgroundColor: theme.teal.bg }]} />
                )}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <Text style={{ color: theme.textStrong, fontSize: 14, fontWeight: "600", flex: 1 }} numberOfLines={2}>{book.title}</Text>
                    <Pressable onPress={() => handleDeleteBook(book.id, book.title)} hitSlop={8} style={{ marginLeft: 8 }}>
                      <Ionicons name="trash-outline" size={16} color={theme.textSoft} />
                    </Pressable>
                  </View>
                  {book.author ? <Text style={{ color: theme.textSoft, fontSize: 12 }}>{book.author}</Text> : null}

                  {totalPages ? (
                    <>
                      <View style={[styles.progressTrack, { backgroundColor: theme.teal.bg }]}>
                        <View style={[styles.progressFill, { backgroundColor: theme.teal.bar, width: `${Math.min(pct ?? 0, 100)}%` }]} />
                      </View>
                      <Text style={[styles.progressText, { color: theme.textSoft }]}>{pagesTotal} of {totalPages} pages · {pct ?? 0}%</Text>
                    </>
                  ) : pagesTotal > 0 ? (
                    <Text style={[styles.progressText, { color: theme.textSoft }]}>{pagesTotal} pages read</Text>
                  ) : null}

                  <View style={styles.pageButtonRow}>
                    {[10, 20, 30].map((n) => (
                      <Pressable key={n} onPress={() => handleLogPages(book.id, n)} style={[styles.pageButton, { backgroundColor: theme.teal.bg }]}>
                        <Text style={{ color: theme.teal.fg, fontSize: 12 }}>+{n}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.manualRow}>
                    <TextInput
                      placeholder="pages"
                      keyboardType="numeric"
                      value={pageInputs[book.id] ?? ""}
                      onChangeText={(v) => setPageInputs((prev) => ({ ...prev, [book.id]: v }))}
                      style={[styles.manualInput, { borderColor: theme.cardBorder, color: theme.textStrong }]}
                      placeholderTextColor={theme.textSoft}
                    />
                    <Pressable style={[styles.logBtn, { backgroundColor: theme.teal.bar }]} onPress={() => handleManualPages(book.id)}>
                      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>Log</Text>
                    </Pressable>
                  </View>

                </View>
              </View>
            );
          })
        )}
      </View>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Text style={[styles.cardTitle, { color: theme.textStrong }]}>Hobbies</Text>
        <View style={styles.searchRow}>
          <TextInput
            placeholder="add a hobby..."
            value={hobbyName}
            onChangeText={setHobbyName}
            onSubmitEditing={handleCreateHobby}
            style={[styles.input, { borderColor: theme.cardBorder, color: theme.textStrong }]}
            placeholderTextColor={theme.textSoft}
          />
          <Pressable
            style={[styles.addButton, { backgroundColor: theme.coral.sub }]}
            onPress={handleCreateHobby}
          >
            {creatingHobby ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.addButtonText}>Add</Text>
            )}
          </Pressable>
        </View>

        {createHobbyError ? (
          <Text style={{ color: theme.coral.sub, fontSize: 12, marginTop: 6 }}>
            {createHobbyError}
          </Text>
        ) : null}

        {logHobbyError ? (
          <Text style={{ color: theme.coral.sub, fontSize: 12, marginTop: 6 }}>
            {logHobbyError}
          </Text>
        ) : null}

        {hobbyListError ? (
          <Text style={{ color: theme.coral.sub, fontSize: 12, marginTop: 6 }}>
            {hobbyListError}
          </Text>
        ) : null}

        {loadingHobbies ? (
          <ActivityIndicator style={{ marginTop: 10 }} />
        ) : hobbies.length === 0 ? (
          <Text style={{ color: theme.textSoft, fontSize: 12, marginTop: 10 }}>
            No hobbies yet — add one above.
          </Text>
        ) : (
          hobbies.map(function (hobby) {
            const stats = hobbyStats[hobby.id];
            return (
              <View key={hobby.id} style={{ marginTop: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ color: theme.textStrong, fontSize: 14 }}>{hobby.name}</Text>
                  <Pressable onPress={() => handleDeleteHobby(hobby.id, hobby.name)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={16} color={theme.textSoft} />
                  </Pressable>
                </View>
                <View style={styles.pageButtonRow}>
                  {[15, 30, 60].map(function (mins) {
                    return (
                      <Pressable
                        key={mins}
                        onPress={function () { handleLogHobby(hobby.id, mins); }}
                        style={[styles.pageButton, { backgroundColor: theme.coral.bg }]}
                      >
                        <Text style={{ color: theme.coral.fg, fontSize: 12 }}>+{mins} min</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.manualRow}>
                  <TextInput
                    placeholder={hobby.unit_label}
                    keyboardType="numeric"
                    value={hobbyAmountInputs[hobby.id] ?? ""}
                    onChangeText={(v) => setHobbyAmountInputs((prev) => ({ ...prev, [hobby.id]: v }))}
                    style={[styles.manualInput, { borderColor: theme.cardBorder, color: theme.textStrong }]}
                    placeholderTextColor={theme.textSoft}
                  />
                  <Pressable style={[styles.logBtn, { backgroundColor: theme.coral.sub }]} onPress={() => handleManualHobbyLog(hobby.id)}>
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>Log</Text>
                  </Pressable>
                </View>
                {stats ? (
                  <View style={{ marginTop: 6 }}>
                    <Text style={{ color: theme.coral.sub, fontSize: 13, fontWeight: "500" }}>
                      {formatAmount(stats.this_week_total, hobby.unit_label)} this week
                    </Text>
                    <Text style={{ color: theme.textSoft, fontSize: 11, marginTop: 2 }}>
                      {weekCompareText(stats, hobby.unit_label)}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  card: { borderRadius: 14, borderWidth: 0.5, padding: 16 },
  cardTitle: { fontSize: 14, fontWeight: "500" },
  searchRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  input: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  addButton: { borderRadius: 10, paddingHorizontal: 16, justifyContent: "center", minWidth: 70, alignItems: "center" },
  addButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  resultRow: { flexDirection: "row", gap: 10, borderWidth: 0.5, borderRadius: 10, padding: 8, alignItems: "center" },
  coverThumb: { width: 36, height: 52, borderRadius: 4 },
  pageButtonRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  pageButton: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  bookRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  progressTrack: { height: 6, borderRadius: 6, overflow: "hidden", marginTop: 8 },
  progressFill: { height: "100%" },
  progressText: { fontSize: 11, marginTop: 4 },
  manualRow: { flexDirection: "row", gap: 6, marginTop: 6 },
  manualInput: { width: 72, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, fontSize: 13 },
  logBtn: { borderRadius: 8, paddingHorizontal: 12, justifyContent: "center" },
});
