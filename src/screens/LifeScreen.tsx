import React, { useEffect, useState, useCallback, useMemo } from "react";
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
  ToastAndroid,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
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
  status: string;
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
  const dir = stats.change > 0 ? "↑" : "↓";
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
  const ink = theme.ink;
  const card = theme.card;
  const styles = useMemo(() => makeStyles(ink, card), [ink, card]);
  const navigation = useNavigation<any>();

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
  const [completedCount, setCompletedCount] = useState(0);

  const loadBooks = useCallback(async () => {
    setLoadingBooks(true);
    try {
      const data = await api.books(USER_ID, "reading");
      setBooks(data);
      const entries = await Promise.all(
        data.map(async (b: Book) => {
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
      const settings = await api.getSettings(USER_ID).catch(() => null);
      const wsd: number = settings?.week_start?.hobbies ?? 1;
      const data: Hobby[] = await api.hobbies(USER_ID);
      const list = Array.isArray(data) ? data : [];
      setHobbies(list);
      const entries = await Promise.all(
        list.map(async (h) => {
          const s: HobbyStats = await api.hobbyStats(h.id, wsd);
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

  const loadCompletedCount = useCallback(async () => {
    try {
      const data = await api.completed(USER_ID);
      setCompletedCount(Array.isArray(data) ? data.length : 0);
    } catch (_) {
      setCompletedCount(0);
    }
  }, []);

  useEffect(() => {
    loadBooks();
    loadHobbies();
    loadCompletedCount();
  }, [loadBooks, loadHobbies, loadCompletedCount]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await Promise.all([loadBooks(), loadHobbies(), loadCompletedCount()]); } finally { setRefreshing(false); }
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
      if (p.percent_complete != null && p.percent_complete >= 100) {
        await api.updateBook(bookId, { status: "finished" });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        ToastAndroid.show("🎉 Finished! Moved to Completed.", ToastAndroid.LONG);
        loadBooks();
        loadCompletedCount();
      }
    } catch (e) {
      console.error("Failed to log pages", e);
    }
  }

  async function handleManualPages(bookId: string) {
    const n = parseInt(pageInputs[bookId] ?? "", 10);
    if (!n || n <= 0) return;
    setPageInputs((prev) => ({ ...prev, [bookId]: "" }));
    await handleLogPages(bookId, n);
  }

  async function handleMarkBookFinished(bookId: string) {
    try {
      await api.updateBook(bookId, { status: "finished" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      ToastAndroid.show("🎉 Marked as finished!", ToastAndroid.SHORT);
      loadBooks();
      loadCompletedCount();
    } catch (e) {
      console.error("Failed to mark book finished", e);
    }
  }

  function handleDeleteBook(bookId: string, title: string) {
    Alert.alert("Delete book", 'Remove "' + title + '" and all its reading logs?', [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try { await api.deleteBook(bookId); loadBooks(); }
          catch (e) { console.error("Failed to delete book", e); }
        },
      },
    ]);
  }

  async function handleMarkHobbyComplete(hobbyId: string, name: string) {
    Alert.alert("Complete hobby", `Mark "${name}" as completed?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Complete", style: "default",
        onPress: async () => {
          try {
            await api.updateHobby(hobbyId, { status: "completed" });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            ToastAndroid.show("✅ Hobby completed!", ToastAndroid.SHORT);
            loadHobbies();
            loadCompletedCount();
          } catch (e) {
            console.error("Failed to complete hobby", e);
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
          try { await api.deleteHobby(hobbyId); loadHobbies(); }
          catch (e) { console.error("Failed to delete hobby", e); }
        },
      },
    ]);
  }

  function handleCreateHobby() {
    if (!hobbyName.trim()) return;
    setCreatingHobby(true);
    setCreateHobbyError(null);
    api.createHobby({
      user_id: USER_ID,
      name: hobbyName.trim(),
      unit_label: "minutes",
      icon: "star",
      color_key: "coral",
    })
      .then(function () { setHobbyName(""); loadHobbies(); })
      .catch(function (e: Error) { setCreateHobbyError(e.message || "Failed to create hobby"); })
      .finally(function () { setCreatingHobby(false); });
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

  return (
    <ScrollView
      style={{ backgroundColor: theme.page }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.teal.bar} />}
    >
      {/* Completed banner */}
      <Pressable
        onPress={() => navigation.navigate("Completed")}
        style={[styles.completedBtn, { backgroundColor: theme.teal.tint, borderColor: ink }]}
      >
        <Text style={{ color: theme.teal.fg, fontWeight: "800", fontSize: 13 }}>
          Completed ({completedCount})
        </Text>
        <Ionicons name="chevron-forward" size={16} color={theme.teal.fg} />
      </Pressable>

      {/* Add a book card */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.textStrong }]}>Add a book</Text>
        <View style={styles.searchRow}>
          <TextInput
            placeholder="search by title..."
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={handleSearch}
            style={[styles.textInput, { color: theme.textStrong, flex: 1 }]}
            placeholderTextColor={theme.textSoft}
          />
          <Pressable style={[styles.actionBtn, { backgroundColor: theme.teal.solid }]} onPress={handleSearch}>
            {searching ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>SEARCH</Text>}
          </Pressable>
        </View>

        {searchResults.length > 0 && (
          <View style={{ marginTop: 12, gap: 8 }}>
            {searchResults.map((result, i) => (
              <Pressable
                key={i}
                onPress={() => handleAddBook(result)}
                style={styles.resultRow}
              >
                {result.cover_url ? (
                  <Image source={{ uri: result.cover_url }} style={styles.coverThumb} />
                ) : (
                  <View style={[styles.coverThumb, { backgroundColor: theme.teal.tint }]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.textStrong, fontSize: 13, fontWeight: "700" }} numberOfLines={1}>
                    {result.title}
                  </Text>
                  <Text style={{ color: theme.textSoft, fontSize: 11 }} numberOfLines={1}>
                    {result.author ?? "Unknown author"}
                    {result.total_pages ? ` · ${result.total_pages}p` : ""}
                  </Text>
                </View>
                <Ionicons name="add-circle-outline" size={20} color={theme.teal.solid} />
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Currently reading — each book its own card */}
      {loadingBooks ? (
        <ActivityIndicator style={{ marginTop: 10 }} color={theme.teal.bar} />
      ) : books.length === 0 ? (
        <View style={[styles.card, { borderColor: ink, borderWidth: 2 }]}>
          <Text style={{ color: theme.textSoft, fontSize: 13 }}>No books in progress — search above to add one.</Text>
        </View>
      ) : (
        books.map((book) => {
          const prog = progress[book.id];
          const pagesTotal = prog?.pages_read_total ?? 0;
          const totalPages = prog?.total_pages ?? null;
          const pct = prog?.percent_complete ?? null;

          return (
            <View key={book.id} style={[styles.card, { backgroundColor: theme.coral.tint }]}>
              <View style={styles.bookRow}>
                {book.cover_url ? (
                  <Image source={{ uri: book.cover_url }} style={styles.coverThumb} />
                ) : (
                  <View style={[styles.coverThumb, { backgroundColor: theme.teal.tint, borderWidth: 2, borderColor: ink }]} />
                )}

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <Text style={[styles.bookTitle, { color: theme.textStrong, flex: 1 }]} numberOfLines={2}>{book.title}</Text>
                    <Pressable onPress={() => handleDeleteBook(book.id, book.title)} hitSlop={8} style={{ marginLeft: 8 }}>
                      <Ionicons name="trash-outline" size={16} color={theme.textSoft} />
                    </Pressable>
                  </View>
                  {book.author ? <Text style={{ color: theme.textSoft, fontSize: 12 }}>{book.author}</Text> : null}

                  {totalPages ? (
                    <>
                      <View style={styles.progressOuter}>
                        <View style={[styles.progressFill, {
                          backgroundColor: theme.teal.solid,
                          width: `${Math.min(pct ?? 0, 100)}%` as any,
                        }]} />
                      </View>
                      <Text style={{ color: theme.textSoft, fontSize: 11, marginTop: 4 }}>
                        {pagesTotal} of {totalPages} pages · {pct ?? 0}%
                      </Text>
                    </>
                  ) : pagesTotal > 0 ? (
                    <Text style={{ color: theme.textSoft, fontSize: 11, marginTop: 4 }}>{pagesTotal} pages read</Text>
                  ) : null}

                  <View style={styles.quickBtnRow}>
                    {[10, 20, 30].map((n) => (
                      <Pressable key={n} onPress={() => handleLogPages(book.id, n)} style={[styles.quickBtn, { backgroundColor: theme.coral.tint }]}>
                        <Text style={[styles.quickBtnText, { color: theme.coral.fg }]}>+{n}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={styles.manualRow}>
                    <TextInput
                      placeholder="pages"
                      keyboardType="numeric"
                      value={pageInputs[book.id] ?? ""}
                      onChangeText={(v) => setPageInputs((prev) => ({ ...prev, [book.id]: v }))}
                      style={[styles.manualInput, { color: theme.textStrong }]}
                      placeholderTextColor={theme.textSoft}
                    />
                    <Pressable style={[styles.actionBtn, { backgroundColor: theme.teal.solid }]} onPress={() => handleManualPages(book.id)}>
                      <Text style={styles.actionBtnText}>LOG</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleMarkBookFinished(book.id)}
                      style={[styles.actionBtn, { backgroundColor: theme.teal.tint, borderColor: ink }]}
                    >
                      <Text style={[styles.actionBtnText, { color: theme.teal.fg }]}>DONE ✓</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          );
        })
      )}

      {/* Hobbies section — add form */}
      <View style={[styles.card, { backgroundColor: theme.coral.tint }]}>
        <Text style={[styles.cardTitle, { color: theme.textStrong }]}>Hobbies</Text>
        <View style={styles.searchRow}>
          <TextInput
            placeholder="add a hobby..."
            value={hobbyName}
            onChangeText={setHobbyName}
            onSubmitEditing={handleCreateHobby}
            style={[styles.textInput, { color: theme.textStrong, flex: 1 }]}
            placeholderTextColor={theme.textSoft}
          />
          <Pressable style={[styles.actionBtn, { backgroundColor: theme.teal.solid }]} onPress={handleCreateHobby}>
            {creatingHobby ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>ADD</Text>}
          </Pressable>
        </View>
        {createHobbyError ? <Text style={{ color: theme.teal.sub, fontSize: 12, marginTop: 6 }}>{createHobbyError}</Text> : null}
        {logHobbyError ? <Text style={{ color: theme.teal.sub, fontSize: 12, marginTop: 6 }}>{logHobbyError}</Text> : null}
        {hobbyListError ? <Text style={{ color: theme.teal.sub, fontSize: 12, marginTop: 6 }}>{hobbyListError}</Text> : null}
      </View>

      {/* Individual hobby cards */}
      {loadingHobbies ? (
        <ActivityIndicator style={{ marginTop: 4 }} color={theme.teal.bar} />
      ) : hobbies.length === 0 ? (
        <View style={[styles.card, { borderColor: ink, borderWidth: 2 }]}>
          <Text style={{ color: theme.textSoft, fontSize: 13 }}>No hobbies yet — add one above.</Text>
        </View>
      ) : (
        hobbies.map(function (hobby) {
          const stats = hobbyStats[hobby.id];
          return (
            <View key={hobby.id} style={[styles.card, { backgroundColor: theme.coral.tint }]}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                <View style={[styles.hobbyIconTile, { backgroundColor: theme.coral.solid }]}>
                  <Ionicons name="star" size={16} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.hobbyName, { color: theme.textStrong }]}>{hobby.name}</Text>
                  {stats ? (
                    <>
                      <Text style={[styles.hobbyStatLabel, { color: theme.textSoft }]}>THIS WEEK</Text>
                      <View style={styles.hobbyStatBadge}>
                        <Text style={styles.hobbyStatValue}>
                          {formatAmount(stats.this_week_total, hobby.unit_label)}
                        </Text>
                      </View>
                      <Text style={{ color: theme.textSoft, fontSize: 11, marginTop: 4 }}>{weekCompareText(stats, hobby.unit_label)}</Text>
                    </>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => handleMarkHobbyComplete(hobby.id, hobby.name)}
                  hitSlop={8}
                  style={{ marginRight: 10 }}
                >
                  <Ionicons name="checkmark-circle-outline" size={20} color={theme.teal.solid} />
                </Pressable>
                <Pressable onPress={() => handleDeleteHobby(hobby.id, hobby.name)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={16} color={theme.textSoft} />
                </Pressable>
              </View>

              <View style={styles.quickBtnRow}>
                {[15, 30, 60].map(function (mins) {
                  return (
                    <Pressable
                      key={mins}
                      onPress={function () { handleLogHobby(hobby.id, mins); }}
                      style={[styles.quickBtn, { backgroundColor: theme.coral.tint }]}
                    >
                      <Text style={[styles.quickBtnText, { color: theme.coral.fg }]}>+{mins} min</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={[styles.manualRow, { marginTop: 8 }]}>
                <TextInput
                  placeholder={hobby.unit_label}
                  keyboardType="numeric"
                  value={hobbyAmountInputs[hobby.id] ?? ""}
                  onChangeText={(v) => setHobbyAmountInputs((prev) => ({ ...prev, [hobby.id]: v }))}
                  style={[styles.manualInput, { color: theme.textStrong }]}
                  placeholderTextColor={theme.textSoft}
                />
                <Pressable style={[styles.actionBtn, { backgroundColor: theme.coral.solid }]} onPress={() => handleManualHobbyLog(hobby.id)}>
                  <Text style={styles.actionBtnText}>LOG</Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

function makeStyles(ink: string, card: string) {
  return StyleSheet.create({
  content: { padding: 16, gap: 12 },

  completedBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },

  card: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: ink,
    padding: 14,
    shadowColor: ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  cardTitle: { fontSize: 19, fontWeight: "800", marginBottom: 8 },

  searchRow: { flexDirection: "row", gap: 8 },
  textInput: {
    borderWidth: 2,
    borderColor: ink,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: card,
    fontSize: 14,
    shadowColor: ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  actionBtn: {
    borderRadius: 10,
    borderWidth: 2,
    borderColor: ink,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 60,
    shadowColor: ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  actionBtnText: { color: "#fff", fontWeight: "800", fontSize: 11, letterSpacing: 0.4 },

  resultRow: {
    flexDirection: "row",
    gap: 10,
    borderWidth: 2,
    borderColor: ink,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    shadowColor: ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  coverThumb: { width: 36, height: 52, borderRadius: 4 },

  bookRow: { flexDirection: "row", gap: 12 },
  bookTitle: { fontSize: 15, fontWeight: "800", marginBottom: 2 },

  progressOuter: {
    height: 10,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: ink,
    overflow: "hidden",
    marginTop: 8,
    backgroundColor: card,
  },
  progressFill: { height: "100%" },

  quickBtnRow: { flexDirection: "row", gap: 6, marginTop: 10 },
  quickBtn: {
    borderRadius: 10,
    borderWidth: 2,
    borderColor: ink,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fff",
    shadowColor: ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  quickBtnText: { fontSize: 11, fontWeight: "800", color: ink, letterSpacing: 0.3 },

  manualRow: { flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap" },
  manualInput: {
    width: 80,
    borderWidth: 2,
    borderColor: ink,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    backgroundColor: card,
    shadowColor: ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },

  hobbyIconTile: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: ink,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    shadowColor: ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
    flexShrink: 0,
  },
  hobbyName: { fontSize: 16, fontWeight: "800", marginBottom: 2 },
  hobbyStatLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.7, marginTop: 2 },
  hobbyStatBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#E8654E",
    borderWidth: 2,
    borderColor: ink,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 3,
    shadowColor: ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  hobbyStatValue: { fontSize: 15, fontWeight: "800", color: "#fff" },
  });
}
