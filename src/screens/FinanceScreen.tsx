import React, { useState, useCallback, useMemo } from "react";
import {
  ScrollView, View, Text, TextInput, Pressable,
  StyleSheet, RefreshControl, Alert
} from "react-native";
import { LoadingIndicator } from "../components/LoadingIndicator";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { api } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { toast, Msg } from "../lib/toast";

type SpendingEntry = {
  id: string;
  amount: number;
  category: string | null;
  logged_at: string;
};

const CATEGORIES = ["food", "transport", "health", "shopping", "entertainment", "subscriptions", "other"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatAmount(n: number): string {
  return "$" + n.toFixed(2);
}

function startOfWeek(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay()); // Sunday
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function FinanceScreen() {
  const { theme } = useTheme();
  const ink = theme.ink;
  const card = theme.card;
  const styles = useMemo(() => makeStyles(ink, card), [ink, card]);

  const [entries, setEntries] = useState<SpendingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add expense form
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("other");
  const [submitting, setSubmitting] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const data = await api.spending(since);
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      setError(Msg.loadData);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  // Weekly total (Sunday–Saturday)
  const weekStart = useMemo(() => new Date(startOfWeek()), []);
  const weekEntries = useMemo(
    () => entries.filter(e => new Date(e.logged_at) >= weekStart),
    [entries, weekStart]
  );
  const weekTotal = useMemo(
    () => weekEntries.reduce((s, e) => s + Number(e.amount), 0),
    [weekEntries]
  );

  // Category breakdown for this week
  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of weekEntries) {
      const cat = e.category?.toLowerCase() || "other";
      map[cat] = (map[cat] || 0) + Number(e.amount);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [weekEntries]);

  const maxCatTotal = categoryTotals[0]?.[1] ?? 1;

  // Recent entries (last 14 days)
  const recent = useMemo(
    () => entries.slice(0, 30),
    [entries]
  );

  async function submitExpense(parsed: number) {
    setSubmitting(true);
    try {
      await api.addSpending({ amount: parsed, category, logged_at: new Date().toISOString() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast("Expense logged.");
      setAmount("");
      setCategory("other");
      setShowForm(false);
      await load();
    } catch {
      toast(Msg.addSpending, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddExpense() {
    setAmountError(null);
    const parsed = parseFloat(amount.replace(",", "."));
    if (!amount.trim() || isNaN(parsed) || parsed <= 0) {
      setAmountError("Please enter a valid amount greater than $0.");
      return;
    }
    if (parsed > 10000) {
      Alert.alert(
        "Does this look right?",
        `$${parsed.toFixed(2)} is a large single expense — just checking it's not a typo.`,
        [
          { text: "Let me fix it", style: "cancel" },
          { text: "Yes, save it", onPress: () => submitExpense(parsed) },
        ]
      );
      return;
    }
    await submitExpense(parsed);
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.page }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.teal.bar} />}
    >
      {loading ? (
        <View style={{ paddingVertical: 40, alignItems: "center" }}>
          <LoadingIndicator size="large" color={theme.purple.solid} />
        </View>
      ) : error ? (
        <EmptyState emoji="⚠️" title="Couldn't load spending" message={error} actionLabel="Retry" onAction={() => load()} />
      ) : (
        <>
          {/* Weekly total */}
          <View style={[styles.card, { backgroundColor: theme.purple.tint, borderColor: ink }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View>
                <Text style={[styles.sectionLabel, { color: theme.purple.sub }]}>SPENT THIS WEEK</Text>
                <Text style={[styles.weekTotal, { color: theme.purple.fg }]}>{formatAmount(weekTotal)}</Text>
                <Text style={[styles.subLabel, { color: theme.purple.sub }]}>
                  {weekEntries.length} transaction{weekEntries.length !== 1 ? "s" : ""} · last 7 days
                </Text>
              </View>
              <Pressable
                onPress={() => setShowForm(s => !s)}
                style={[styles.addBtn, { backgroundColor: theme.purple.solid, borderColor: ink }]}
                accessibilityRole="button"
                accessibilityLabel="Add expense"
              >
                <Ionicons name={showForm ? "close" : "add"} size={18} color="#fff" />
              </Pressable>
            </View>
          </View>

          {/* Add expense form */}
          {showForm && (
            <View style={[styles.card, { borderColor: ink }]}>
              <Text style={[styles.cardTitle, { color: theme.textStrong }]}>Log expense</Text>

              <Text style={[styles.fieldLabel, { color: theme.textSoft }]}>Amount ($)</Text>
              <TextInput
                value={amount}
                onChangeText={v => { setAmount(v); setAmountError(null); }}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={theme.textSoft}
                style={[styles.textInput, { color: theme.textStrong, borderColor: amountError ? theme.coral.solid : ink }]}
                returnKeyType="done"
                accessibilityLabel="Expense amount"
              />
              {amountError ? (
                <Text style={[styles.errorText, { color: theme.coral.solid }]}>{amountError}</Text>
              ) : null}

              <Text style={[styles.fieldLabel, { color: theme.textSoft }]}>Category</Text>
              <View style={styles.catRow}>
                {CATEGORIES.map(cat => (
                  <Pressable
                    key={cat}
                    onPress={() => setCategory(cat)}
                    style={[styles.catChip, {
                      backgroundColor: category === cat ? theme.purple.solid : "transparent",
                      borderColor: category === cat ? theme.purple.solid : ink,
                    }]}
                    accessibilityRole="button"
                    accessibilityLabel={cat}
                  >
                    <Text style={{ color: category === cat ? "#fff" : theme.textSoft, fontSize: 12, fontWeight: "600" }}>
                      {cat}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={handleAddExpense}
                disabled={submitting}
                style={[styles.submitBtn, { backgroundColor: theme.purple.solid, borderColor: ink, opacity: submitting ? 0.6 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel="Save expense"
              >
                {submitting
                  ? <LoadingIndicator size="small" color="#fff" />
                  : <Text style={styles.submitText}>Save</Text>}
              </Pressable>
            </View>
          )}

          {/* Category breakdown */}
          {categoryTotals.length > 0 ? (
            <View style={[styles.card, { borderColor: ink }]}>
              <Text style={[styles.cardTitle, { color: theme.textStrong }]}>This week by category</Text>
              <View style={{ gap: 10, marginTop: 4 }}>
                {categoryTotals.map(([cat, total]) => (
                  <View key={cat}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                      <Text style={[styles.catLabel, { color: theme.textStrong }]}>{cat}</Text>
                      <Text style={[styles.catLabel, { color: theme.purple.sub }]}>{formatAmount(total)}</Text>
                    </View>
                    <View style={[styles.barTrack, { backgroundColor: theme.purple.bg }]}>
                      <View
                        style={[styles.barFill, {
                          backgroundColor: theme.purple.solid,
                          width: `${Math.round((total / maxCatTotal) * 100)}%` as any,
                        }]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Recent entries */}
          {recent.length > 0 ? (
            <View style={[styles.card, { borderColor: ink }]}>
              <Text style={[styles.cardTitle, { color: theme.textStrong }]}>Recent</Text>
              {recent.map((e, i) => (
                <View
                  key={e.id}
                  style={[styles.entryRow, i < recent.length - 1 && { borderBottomWidth: 1, borderBottomColor: ink + "1A" }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.entryCategory, { color: theme.textStrong }]}>{e.category || "other"}</Text>
                    <Text style={[styles.entryDate, { color: theme.textSoft }]}>{formatDate(e.logged_at)}</Text>
                  </View>
                  <Text style={[styles.entryAmount, { color: theme.purple.sub }]}>{formatAmount(Number(e.amount))}</Text>
                </View>
              ))}
            </View>
          ) : (
            <EmptyState
              emoji="💳"
              title="No spending logged yet"
              message="Add expenses to discover patterns in how you spend — and how it relates to your mood and stress levels."
              actionLabel="Log your first expense"
              onAction={() => setShowForm(true)}
            />
          )}
        </>
      )}
    </ScrollView>
  );
}

function makeStyles(ink: string, card: string) {
  const shadow = {
    shadowColor: ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1 as const,
    shadowRadius: 0,
    elevation: 4,
  };
  return StyleSheet.create({
    content: { padding: 16, gap: 12 },
    card: { borderRadius: 14, borderWidth: 2, padding: 16, backgroundColor: card, ...shadow, gap: 6 },
    cardTitle: { fontSize: 16, fontWeight: "800", marginBottom: 4 },
    sectionLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8, marginBottom: 4 },
    weekTotal: { fontSize: 36, fontWeight: "900", lineHeight: 42 },
    subLabel: { fontSize: 12, marginTop: 2 },
    addBtn: {
      width: 36, height: 36, borderRadius: 18, borderWidth: 2,
      alignItems: "center", justifyContent: "center",
      shadowColor: ink, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3,
    },
    fieldLabel: { fontSize: 12, marginBottom: 2 },
    textInput: {
      borderWidth: 2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
      fontSize: 18, fontWeight: "700",
      shadowColor: ink, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0, elevation: 2,
    },
    errorText: { fontSize: 12, marginTop: -2 },
    catRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    catChip: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
    catLabel: { fontSize: 13, fontWeight: "600" },
    submitBtn: {
      borderRadius: 10, borderWidth: 2, paddingVertical: 12,
      alignItems: "center", marginTop: 4,
      shadowColor: ink, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0, elevation: 2,
    },
    submitText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    barTrack: { height: 6, borderRadius: 4, overflow: "hidden" },
    barFill: { height: "100%", borderRadius: 4 },
    entryRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
    entryCategory: { fontSize: 14, fontWeight: "600", textTransform: "capitalize" },
    entryDate: { fontSize: 11, marginTop: 1 },
    entryAmount: { fontSize: 15, fontWeight: "700" },
  });
}
