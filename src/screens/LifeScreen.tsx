import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useTabPreferences } from "../hooks/useTabPreferences";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  StyleSheet,
  Alert,
  RefreshControl
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { LoadingIndicator } from "../components/LoadingIndicator";
import { toast, Msg } from "../lib/toast";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../theme/ThemeContext";
import { coloredShadow } from "../theme/styleUtils";
import { ShadowCard } from "../components/ShadowCard";
import { IconBadge } from "../components/IconBadge";
import { api } from "../api/client";
import { UndoBanner } from "../components/UndoBanner";
import { HOBBY_LIST } from "../lib/hobbyList";
import { TooltipBubble } from "../components/TooltipBubble";
import { hasSeenTooltip, markTooltipSeen } from "../utils/tooltipSeen";
import { SectionEditorModal, SectionDef } from "../components/SectionEditorModal";
import { FeatureTour, TourStep } from "../components/FeatureTour";

const LIFE_SECTIONS: SectionDef[] = [
  { id: 'books',       label: 'Books & Reading', description: 'Currently reading list and book search' },
  { id: 'hobbies',     label: 'Hobbies',         description: 'Hobby logging and stats' },
  { id: 'experiments', label: 'Experiments',      description: 'Personal self-experiments entry point' },
];


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
  const styles = useMemo(() => makeStyles(ink, card, theme.cardBorder), [ink, card, theme.cardBorder]);
  const navigation = useNavigation<any>();
  const { preferences, loading: prefsLoading } = useTabPreferences();

  const [showTooltip, setShowTooltip] = useState(false);
  const [hiddenSections, setHiddenSections] = useState<string[]>([]);
  const [showSectionEditor, setShowSectionEditor] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const tourBooksRef = useRef<View>(null);
  const tourHobbiesRef = useRef<View>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);

  const LIFE_TOUR: TourStep[] = [
    { ref: tourBooksRef,   title: "Books & Reading", body: "Add books you're reading and log your progress. Search by title or author, and track pages or chapters." },
    { ref: tourHobbiesRef, title: "Hobbies",          body: "Log time spent on any hobby. Stats compare this week to last so you can see if you're keeping up with things you enjoy." },
  ];

  useFocusEffect(useCallback(() => {
    if (prefsLoading) return;
    if (!preferences.selectedModules.includes('hobbies')) {
      navigation.navigate('Home');
    }
    hasSeenTooltip("life").then(seen => {
      if (!seen) {
        setShowTooltip(true);
        markTooltipSeen("life");
      }
    });
    hasSeenTooltip("life-tour").then(seen => {
      if (!seen) { markTooltipSeen("life-tour"); setTimeout(() => setShowTour(true), 600); }
    });
    api.getSettings().then((s: any) => {
      setHiddenSections(s?.life_hidden_sections ?? []);
    }).catch(() => {});
  }, [prefsLoading, preferences.selectedModules]));

  async function handleSaveSections(newHidden: string[]) {
    setHiddenSections(newHidden);
    setShowSectionEditor(false);
    try { await api.patchSettings({ life_hidden_sections: newHidden }); } catch (_) {}
  }

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

  type UndoInfo =
    | { type: "book"; data: Book; timer: ReturnType<typeof setTimeout> }
    | { type: "hobby"; data: Hobby; timer: ReturnType<typeof setTimeout> };
  const [undoInfo, setUndoInfo] = useState<UndoInfo | null>(null);

  const loadBooks = useCallback(async () => {
    setLoadingBooks(true);
    try {
      const data = await api.books("reading");
      setBooks(data);
      const entries = await Promise.all(
        data.map(async (b: Book) => {
          const p = await api.bookProgress(b.id);
          return [b.id, p] as [string, Progress];
        })
      );
      setProgress(Object.fromEntries(entries));
    } catch {
      // non-critical — user sees empty list with empty state
    } finally {
      setLoadingBooks(false);
    }
  }, []);

  const loadHobbies = useCallback(async function () {
    setLoadingHobbies(true);
    setHobbyListError(null);
    try {
      const settings = await api.getSettings().catch(() => null);
      const wsd: number = settings?.week_start?.hobbies ?? 1;
      const data: Hobby[] = await api.hobbies();
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
      const data = await api.completed();
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
    } catch {
      toast("Book search failed. Try again.", "error");
    } finally {
      setSearching(false);
    }
  }

  async function handleAddBook(result: BookSearchResult) {
    try {
      await api.createBook({
        title: result.title,
        author: result.author,
        cover_url: result.cover_url,
        total_pages: result.total_pages,
      });
      setSearchText("");
      setSearchResults([]);
      toast("Book added.");
      loadBooks();
    } catch {
      toast("Couldn't add that book. Try again.", "error");
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
        toast("Finished! Moved to Completed.");
        loadBooks();
        loadCompletedCount();
      } else {
        toast("Reading progress saved.");
      }
    } catch {
      toast(Msg.logPages, "error");
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
      toast("Marked as finished!");
      loadBooks();
      loadCompletedCount();
    } catch {
      toast("Couldn't update book status. Try again.", "error");
    }
  }

  function handleDeleteBook(bookId: string, title: string) {
    const deleted = books.find((b) => b.id === bookId);
    if (!deleted) return;
    if (undoInfo) clearTimeout(undoInfo.timer);
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
    const timer = setTimeout(async () => {
      setUndoInfo(null);
      try { await api.deleteBook(bookId); }
      catch { toast("Couldn't delete that book. Try again.", "error"); loadBooks(); }
    }, 4000);
    setUndoInfo({ type: "book", data: deleted, timer });
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
            toast("Hobby completed!");
            loadHobbies();
            loadCompletedCount();
          } catch {
            toast("Couldn't complete that hobby. Try again.", "error");
          }
        },
      },
    ]);
  }

  function handleDeleteHobby(hobbyId: string, name: string) {
    const deleted = hobbies.find((h) => h.id === hobbyId);
    if (!deleted) return;
    if (undoInfo) clearTimeout(undoInfo.timer);
    setHobbies((prev) => prev.filter((h) => h.id !== hobbyId));
    const timer = setTimeout(async () => {
      setUndoInfo(null);
      try { await api.deleteHobby(hobbyId); }
      catch { toast("Couldn't delete that hobby. Try again.", "error"); loadHobbies(); }
    }, 4000);
    setUndoInfo({ type: "hobby", data: deleted, timer });
  }

  function handleUndoDelete() {
    if (!undoInfo) return;
    clearTimeout(undoInfo.timer);
    if (undoInfo.type === "book") {
      setBooks((prev) => [...prev, undoInfo.data as Book]);
    } else {
      setHobbies((prev) => [...prev, undoInfo.data as Hobby]);
    }
    setUndoInfo(null);
  }

  const [showSuggestions, setShowSuggestions] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const suggestions = useMemo(() => {
    const q = hobbyName.trim().toLowerCase();
    if (!q) return [];
    return HOBBY_LIST.filter(h => h.toLowerCase().includes(q)).slice(0, 8);
  }, [hobbyName]);

  const exactMatch = useMemo(
    () => HOBBY_LIST.some(h => h.toLowerCase() === hobbyName.trim().toLowerCase()),
    [hobbyName]
  );

  function handleCreateHobby(nameOverride?: string) {
    const name = (nameOverride ?? hobbyName).trim();
    if (!name) return;
    setShowSuggestions(false);
    setCreatingHobby(true);
    setCreateHobbyError(null);
    api.createHobby({
      name,
      unit_label: "minutes",
      icon: "star",
      color_key: "coral",
    })
      .then(function () { setHobbyName(""); loadHobbies(); })
      .catch(function (e: Error) { setCreateHobbyError(e.message || "Failed to create hobby"); })
      .finally(function () { setCreatingHobby(false); });
  }

  function handleSelectSuggestion(name: string) {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    handleCreateHobby(name);
  }

  async function handleLogHobby(hobbyId: string, amount: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLogHobbyError(null);
    const hobbyName = hobbies.find(h => h.id === hobbyId)?.name ?? "hobby";
    try {
      await api.logHobby(hobbyId, amount, undefined, undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast(`Logged ${amount} min for ${hobbyName} today.`);
      const s: HobbyStats = await api.hobbyStats(hobbyId);
      setHobbyStats((prev) => ({ ...prev, [hobbyId]: s }));
    } catch {
      toast(Msg.logHobby, "error");
    }
  }

  async function handleManualHobbyLog(hobbyId: string) {
    const n = parseFloat(hobbyAmountInputs[hobbyId] ?? "");
    if (!n || n <= 0) return;
    setHobbyAmountInputs((prev) => ({ ...prev, [hobbyId]: "" }));
    await handleLogHobby(hobbyId, n);
  }

  return (
    <View style={{ flex: 1 }}>
    <LinearGradient colors={[theme.page, theme.gradientEnd]} style={{ flex: 1 }}>
    <ScrollView
      ref={scrollViewRef}
      style={{ backgroundColor: "transparent" }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.teal.bar} />}
      scrollEventThrottle={16}
      onScroll={(e) => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
    >
      {showTooltip && (
        <TooltipBubble
          message="Track hobbies, books, journal entries, and mood here. Log time on the things you love to discover patterns in what recharges you."
          onDismiss={() => setShowTooltip(false)}
        />
      )}
      {/* Section editor pencil */}
      <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 4 }}>
        <Pressable onPress={() => setShowSectionEditor(true)} hitSlop={10} accessibilityLabel="Customize Life screen">
          <Ionicons name="pencil-outline" size={17} color={theme.textSoft} />
        </Pressable>
      </View>
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

      {/* Experiments entry */}
      {!hiddenSections.includes('experiments') && (
      <Pressable
        onPress={() => navigation.navigate("Experiments")}
        style={[styles.completedBtn, { backgroundColor: theme.card, borderColor: ink }]}
      >
        <Text style={{ fontSize: 16, marginRight: 4 }}>🧪</Text>
        <Text style={{ color: theme.textStrong, fontWeight: "800", fontSize: 13, flex: 1 }}>
          Experiments
        </Text>
        <Ionicons name="chevron-forward" size={16} color={theme.textSoft} />
      </Pressable>
      )}

      {/* Add a book card + Currently reading */}
      {!hiddenSections.includes('books') && (<>
      <View ref={tourBooksRef}>
      <ShadowCard size="card">
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
            {searching ? <LoadingIndicator color="#fff" /> : <Text style={styles.actionBtnText}>SEARCH</Text>}
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
      </ShadowCard>
      </View>

      {/* Currently reading — each book its own card */}
      {loadingBooks ? (
        <LoadingIndicator style={{ marginTop: 10 }} color={theme.teal.bar} />
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
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                        <Text style={{ color: theme.textSoft, fontSize: 11 }}>
                          {pagesTotal} of {totalPages} pages
                        </Text>
                        <Text style={{ color: theme.teal.fg, fontSize: 14, fontWeight: "800" }}>
                          {pct ?? 0}%
                        </Text>
                      </View>
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
      </>)}

      {/* Hobbies section — add form + individual cards */}
      {!hiddenSections.includes('hobbies') && (<>
      <View ref={tourHobbiesRef}>
      <ShadowCard size="card" bg={theme.coral.tint} accent={theme.coral.solid} rotate={-0.4}>
        <Text style={[styles.cardTitle, { color: theme.textStrong }]}>Hobbies</Text>
        <View style={styles.searchRow}>
          <TextInput
            placeholder="search hobbies..."
            value={hobbyName}
            onChangeText={(v) => { setHobbyName(v); setShowSuggestions(true); }}
            onSubmitEditing={() => handleCreateHobby()}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => {
              blurTimer.current = setTimeout(() => setShowSuggestions(false), 150);
            }}
            style={[styles.textInput, { color: theme.textStrong, flex: 1 }]}
            placeholderTextColor={theme.textSoft}
          />
          <Pressable style={[styles.actionBtn, { backgroundColor: theme.teal.solid }]} onPress={() => handleCreateHobby()}>
            {creatingHobby ? <LoadingIndicator color="#fff" /> : <Text style={styles.actionBtnText}>ADD</Text>}
          </Pressable>
        </View>

        {/* Autocomplete dropdown */}
        {showSuggestions && hobbyName.trim().length > 0 && (suggestions.length > 0 || !exactMatch) && (
          <View style={[styles.suggestionsBox, { borderColor: ink, backgroundColor: theme.card }]}>
            {suggestions.map((s, i) => (
              <Pressable
                key={s}
                onPress={() => handleSelectSuggestion(s)}
                style={[styles.suggestionRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.cardBorder }]}
              >
                <Ionicons name="star-outline" size={14} color={theme.coral.solid} style={{ marginRight: 8 }} />
                <Text style={{ color: theme.textStrong, fontSize: 14, flex: 1 }}>{s}</Text>
                <Ionicons name="add-circle-outline" size={18} color={theme.teal.solid} />
              </Pressable>
            ))}
            {!exactMatch && hobbyName.trim().length > 0 && (
              <Pressable
                onPress={() => handleCreateHobby()}
                style={[
                  styles.suggestionRow,
                  suggestions.length > 0 && { borderTopWidth: 1, borderTopColor: theme.cardBorder },
                  { backgroundColor: theme.teal.tint },
                ]}
              >
                <Ionicons name="add-circle" size={14} color={theme.teal.solid} style={{ marginRight: 8 }} />
                <Text style={{ color: theme.teal.fg, fontSize: 14, fontWeight: "700", flex: 1 }}>
                  Add "{hobbyName.trim()}"
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {createHobbyError ? <Text style={{ color: theme.teal.sub, fontSize: 12, marginTop: 6 }}>{createHobbyError}</Text> : null}
        {logHobbyError ? <Text style={{ color: theme.teal.sub, fontSize: 12, marginTop: 6 }}>{logHobbyError}</Text> : null}
        {hobbyListError ? <Text style={{ color: theme.teal.sub, fontSize: 12, marginTop: 6 }}>{hobbyListError}</Text> : null}
      </ShadowCard>
      </View>

      {/* Individual hobby cards */}
      {loadingHobbies ? (
        <LoadingIndicator style={{ marginTop: 4 }} color={theme.teal.bar} />
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
                <View style={{ marginRight: 12 }}>
                  <IconBadge name="star" color="#fff" bgColor={theme.coral.solid} size={16} containerSize={44} borderRadius={16} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.hobbyName, { color: theme.textStrong }]}>{hobby.name}</Text>
                  {stats ? (
                    <>
                      <Text style={[styles.hobbyStatLabel, { color: theme.textSoft }]}>THIS WEEK</Text>
                      <View style={[styles.hobbyStatBadge, { backgroundColor: theme.coral.solid }]}>
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
      </>)}
    </ScrollView>
    </LinearGradient>
    {undoInfo && (
      <UndoBanner
        message={undoInfo.type === "book" ? `"${(undoInfo.data as Book).title}" deleted` : `"${(undoInfo.data as Hobby).name}" deleted`}
        onUndo={handleUndoDelete}
        theme={theme}
      />
    )}
    <SectionEditorModal
      visible={showSectionEditor}
      title="Customize Life"
      sections={LIFE_SECTIONS}
      hidden={hiddenSections}
      onSave={handleSaveSections}
      onCancel={() => setShowSectionEditor(false)}
    />
    <FeatureTour steps={LIFE_TOUR} visible={showTour} onDone={() => setShowTour(false)} scrollRef={scrollViewRef} scrollY={scrollOffsetRef.current} />
    </View>
  );
}

function makeStyles(ink: string, card: string, border: string) {
  return StyleSheet.create({
  content: { padding: 16, gap: 12 },

  completedBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 22,
    borderWidth: 2,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "rgba(60,40,20,0.1)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 3,
  },

  card: {
    borderRadius: 22,
    borderWidth: 2,
    borderColor: border,
    padding: 14,
    ...coloredShadow("#3B82F6"),
  },
  cardTitle: { fontSize: 19, fontWeight: "900", letterSpacing: -0.5, marginBottom: 8 },

  searchRow: { flexDirection: "row", gap: 8 },
  textInput: {
    borderWidth: 2,
    borderColor: ink,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: card,
    fontSize: 14,
    shadowColor: "rgba(60,40,20,0.1)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  actionBtn: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: ink,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 60,
    shadowColor: "rgba(60,40,20,0.1)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  actionBtnText: { color: "#fff", fontWeight: "800", fontSize: 11, letterSpacing: 0.4 },

  resultRow: {
    flexDirection: "row",
    gap: 10,
    borderWidth: 2,
    borderColor: ink,
    borderRadius: 16,
    padding: 10,
    alignItems: "center",
    shadowColor: "rgba(60,40,20,0.1)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  coverThumb: { width: 80, height: 116, borderRadius: 6 },

  bookRow: { flexDirection: "row", gap: 12 },
  bookTitle: { fontSize: 15, fontWeight: "800", marginBottom: 2 },

  progressOuter: {
    height: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: ink,
    overflow: "hidden",
    marginTop: 8,
    backgroundColor: card,
  },
  progressFill: { height: "100%" },

  quickBtnRow: { flexDirection: "row", gap: 6, marginTop: 10 },
  quickBtn: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: ink,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: "#fff",
    shadowColor: "rgba(60,40,20,0.1)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  quickBtnText: { fontSize: 10, fontWeight: "800", color: ink, letterSpacing: 0.3 },

  manualRow: { flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap" },
  manualInput: {
    width: 80,
    borderWidth: 2,
    borderColor: ink,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    backgroundColor: card,
    shadowColor: "rgba(60,40,20,0.1)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },

  suggestionsBox: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 2,
    overflow: "hidden",
    shadowColor: "rgba(60,40,20,0.1)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 3,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
  },

  hobbyIconTile: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: ink,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    shadowColor: "rgba(60,40,20,0.1)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
    flexShrink: 0,
  },
  hobbyName: { fontSize: 16, fontWeight: "800", marginBottom: 2 },
  hobbyStatLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.7, marginTop: 2 },
  hobbyStatBadge: {
    alignSelf: "flex-start",
    borderWidth: 2,
    borderColor: ink,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 3,
    shadowColor: "rgba(60,40,20,0.1)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  hobbyStatValue: { fontSize: 15, fontWeight: "800", color: "#fff" },
  });
}
