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
} from "react-native";
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
  total_chapters: number | null;
  current_chapter: number | null;
};

type Hobby = {
  id: string;
  name: string;
  unit_label: string;
};

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
  const [chapterInputs, setChapterInputs] = useState<Record<string, string>>({});

  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<BookSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [hobbies, setHobbies] = useState<Hobby[]>([]);
  const [loadingHobbies, setLoadingHobbies] = useState(true);
  const [hobbyListError, setHobbyListError] = useState<string | null>(null);
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

  const loadHobbies = useCallback(function () {
    setLoadingHobbies(true);
    setHobbyListError(null);
    api
      .hobbies(USER_ID)
      .then(function (data: Hobby[]) {
        setHobbies(Array.isArray(data) ? data : []);
      })
      .catch(function (e: Error) {
        setHobbyListError(e.message || "Failed to load hobbies");
      })
      .finally(function () {
        setLoadingHobbies(false);
      });
  }, []);

  useEffect(() => {
    loadBooks();
    loadHobbies();
  }, [loadBooks, loadHobbies]);

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

  async function handleUpdateChapter(bookId: string, chapter: number) {
    if (chapter <= 0) return;
    try {
      const updated = await api.updateBook(bookId, { current_chapter: chapter });
      setBooks((prev) => prev.map((b) => b.id === bookId ? { ...b, current_chapter: updated.current_chapter } : b));
    } catch (e) {
      console.error("Failed to update chapter", e);
    }
  }

  async function handleManualChapter(bookId: string) {
    const n = parseInt(chapterInputs[bookId] ?? "", 10);
    if (!n || n <= 0) return;
    await handleUpdateChapter(bookId, n);
    setChapterInputs((prev) => ({ ...prev, [bookId]: "" }));
  }

  async function handleIncrementChapter(book: Book) {
    await handleUpdateChapter(book.id, (book.current_chapter ?? 0) + 1);
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

  function handleLogHobby(hobbyId: string, minutes: number) {
    setLogHobbyError(null);
    api
      .logHobby(hobbyId, minutes, undefined, undefined)
      .catch(function (e: Error) {
        setLogHobbyError(e.message || "Failed to log hobby");
      });
  }

  const currentlyReading = books.filter((b) => b.status === "reading");

  return (
    <ScrollView style={{ backgroundColor: theme.page }} contentContainerStyle={styles.content}>
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
                  <Text style={{ color: theme.textStrong, fontSize: 14, fontWeight: "600" }} numberOfLines={2}>{book.title}</Text>
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

                  {book.total_chapters != null && (
                    <View style={styles.chapterSection}>
                      <View style={[styles.progressTrack, { backgroundColor: theme.blue.bg }]}>
                        <View style={[styles.progressFill, { backgroundColor: theme.blue.sub, width: `${Math.min(Math.round(((book.current_chapter ?? 0) / book.total_chapters) * 100), 100)}%` }]} />
                      </View>
                      <Text style={[styles.progressText, { color: theme.textSoft }]}>Chapter {book.current_chapter ?? 0} of {book.total_chapters}</Text>
                      <View style={styles.pageButtonRow}>
                        <Pressable onPress={() => handleIncrementChapter(book)} style={[styles.pageButton, { backgroundColor: theme.blue.bg }]}>
                          <Text style={{ color: theme.blue.fg, fontSize: 12 }}>+1 chapter</Text>
                        </Pressable>
                      </View>
                      <View style={styles.manualRow}>
                        <TextInput
                          placeholder="chapter #"
                          keyboardType="numeric"
                          value={chapterInputs[book.id] ?? ""}
                          onChangeText={(v) => setChapterInputs((prev) => ({ ...prev, [book.id]: v }))}
                          style={[styles.manualInput, { borderColor: theme.cardBorder, color: theme.textStrong }]}
                          placeholderTextColor={theme.textSoft}
                        />
                        <Pressable style={[styles.logBtn, { backgroundColor: theme.blue.sub }]} onPress={() => handleManualChapter(book.id)}>
                          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>Set</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
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
            return (
              <View key={hobby.id} style={{ marginTop: 12 }}>
                <Text style={{ color: theme.textStrong, fontSize: 14 }}>{hobby.name}</Text>
                <View style={styles.pageButtonRow}>
                  {[15, 30, 60].map(function (mins) {
                    return (
                      <Pressable
                        key={mins}
                        onPress={function () {
                          handleLogHobby(hobby.id, mins);
                        }}
                        style={[styles.pageButton, { backgroundColor: theme.coral.bg }]}
                      >
                        <Text style={{ color: theme.coral.fg, fontSize: 12 }}>+{mins} min</Text>
                      </Pressable>
                    );
                  })}
                </View>
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
  chapterSection: { marginTop: 10 },
});
