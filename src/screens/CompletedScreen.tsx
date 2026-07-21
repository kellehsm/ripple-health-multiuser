import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  ScrollView,
  View,
  Text,
  Image,
  StyleSheet,
  Alert,
  Pressable,
  RefreshControl
} from "react-native";
import { LoadingIndicator } from "../components/LoadingIndicator";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { api } from "../api/client";


type CompletedItem = {
  id: string;
  name: string;
  kind: "book" | "hobby";
  completed_at: string;
  // book fields
  author?: string;
  cover_url?: string;
  rating?: number;
  // hobby fields
  icon?: string;
  color_key?: string;
  unit_label?: string;
};

function formatDate(str: string): string {
  return new Date(str).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StarRating({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2, marginTop: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={i <= rating ? "star" : "star-outline"} size={12} color="#E8AB30" />
      ))}
    </View>
  );
}

export function CompletedScreen() {
  const { theme } = useTheme();
  const ink = theme.ink;
  const styles = useMemo(() => makeStyles(ink), [ink]);

  const [items, setItems] = useState<CompletedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.completed();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to load completed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function handleDeleteBook(id: string, name: string) {
    Alert.alert("Remove book", `Remove "${name}" from completed?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        try { await api.deleteBook(id); load(); } catch (e) { console.error(e); }
      }},
    ]);
  }

  function handleDeleteHobby(id: string, name: string) {
    Alert.alert("Remove hobby", `Remove "${name}" from completed?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        try { await api.deleteHobby(id); load(); } catch (e) { console.error(e); }
      }},
    ]);
  }

  const books = items.filter((i) => i.kind === "book");
  const hobbies = items.filter((i) => i.kind === "hobby");

  return (
    <ScrollView
      style={{ backgroundColor: theme.page }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.teal.bar} />}
    >
      {loading ? (
        <LoadingIndicator color={theme.teal.bar} style={{ marginTop: 32 }} />
      ) : items.length === 0 ? (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={{ color: theme.textSoft, fontSize: 14, textAlign: "center" }}>
            Nothing completed yet — finish a book or mark a hobby complete to see it here.
          </Text>
        </View>
      ) : (
        <>
          {books.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: theme.textSoft }]}>BOOKS READ · {books.length}</Text>
              {books.map((item) => (
                <View key={item.id} style={[styles.card, { backgroundColor: theme.teal.tint }]}>
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    {item.cover_url ? (
                      <Image source={{ uri: item.cover_url }} style={styles.cover} />
                    ) : (
                      <View style={[styles.cover, { backgroundColor: theme.teal.bg, borderWidth: 2, borderColor: ink }]} />
                    )}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                        <Text style={[styles.title, { color: theme.textStrong, flex: 1 }]}>{item.name}</Text>
                        <Pressable onPress={() => handleDeleteBook(item.id, item.name)} hitSlop={8} style={{ marginLeft: 8 }}>
                          <Ionicons name="trash-outline" size={16} color={theme.textSoft} />
                        </Pressable>
                      </View>
                      {item.author ? (
                        <Text style={{ color: theme.textSoft, fontSize: 12 }}>{item.author}</Text>
                      ) : null}
                      {item.rating ? <StarRating rating={item.rating} /> : null}
                      <Text style={[styles.dateLabel, { color: theme.textSoft }]}>
                        Finished {formatDate(item.completed_at)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}

          {hobbies.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: theme.textSoft }]}>COMPLETED HOBBIES · {hobbies.length}</Text>
              {hobbies.map((item) => (
                <View key={item.id} style={[styles.card, { backgroundColor: theme.coral.tint }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={[styles.iconTile, { backgroundColor: theme.coral.solid, borderColor: ink }]}>
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.title, { color: theme.textStrong }]}>{item.name}</Text>
                      {item.unit_label ? (
                        <Text style={{ color: theme.textSoft, fontSize: 12 }}>{item.unit_label}</Text>
                      ) : null}
                      <Text style={[styles.dateLabel, { color: theme.textSoft }]}>
                        Completed {formatDate(item.completed_at)}
                      </Text>
                    </View>
                    <Ionicons name="trophy" size={20} color={theme.coral.sub} />
                    <Pressable onPress={() => handleDeleteHobby(item.id, item.name)} hitSlop={8} style={{ marginLeft: 4 }}>
                      <Ionicons name="trash-outline" size={16} color={theme.textSoft} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function makeStyles(ink: string) {
  return StyleSheet.create({
    content: { padding: 16, gap: 12 },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.8,
      marginBottom: -4,
      marginTop: 4,
    },
    card: {
      borderRadius: 22,
      borderWidth: 2,
      borderColor: ink,
      padding: 14,
      shadowColor: "rgba(60,40,20,0.1)",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 14,
      elevation: 4,
    },
    cover: { width: 44, height: 64, borderRadius: 4 },
    title: { fontSize: 15, fontWeight: "800", marginBottom: 2 },
    dateLabel: { fontSize: 11, marginTop: 4 },
    iconTile: {
      width: 44,
      height: 44,
      borderRadius: 16,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "rgba(60,40,20,0.1)",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 2,
    },
  });
}
