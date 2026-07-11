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

export function LifeScreen() {
  const { theme } = useTheme();

  const [books, setBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);

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
    try {
      await api.logPages(bookId, pages);
      loadBooks();
    } catch (e) {
      console.error("Failed to log pages", e);
    }
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
          currentlyReading.map((book) => (
            <View key={book.id} style={{ marginTop: 12 }}>
              <Text style={{ color: theme.textStrong, fontSize: 14 }}>{book.title}</Text>
              <Text style={{ color: theme.textSoft, fontSize: 12 }}>{book.author}</Text>
              <View style={styles.pageButtonRow}>
                {[10, 20, 30].map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => handleLogPages(book.id, n)}
                    style={[styles.pageButton, { backgroundColor: theme.teal.bg }]}
                  >
                    <Text style={{ color: theme.teal.fg, fontSize: 12 }}>+{n} pages</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))
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
});
