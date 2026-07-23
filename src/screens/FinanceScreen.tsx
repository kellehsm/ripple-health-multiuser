import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  ScrollView, View, Text, TextInput, Pressable, StyleSheet,
  RefreshControl, Alert, Modal, KeyboardAvoidingView, Platform,
  TouchableWithoutFeedback, Keyboard,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../theme/ThemeContext";
import { coloredShadow } from "../theme/styleUtils";
import { IconBadge } from "../components/IconBadge";
import { api } from "../api/client";
import { LoadingIndicator } from "../components/LoadingIndicator";
import { EmptyState } from "../components/EmptyState";
import { toast } from "../lib/toast";
import { TooltipBubble } from "../components/TooltipBubble";
import { hasSeenTooltip, markTooltipSeen } from "../utils/tooltipSeen";
import { SectionEditorModal, SectionDef } from "../components/SectionEditorModal";
import { FeatureTour, TourStep } from "../components/FeatureTour";

const FINANCE_SECTIONS: SectionDef[] = [
  { id: 'totals',       label: 'Total spent',              description: 'Spending total card with add button' },
  { id: 'breakdown',    label: 'Where it went',             description: 'Category breakdown bar chart' },
  { id: 'mood_suggest', label: 'Spending-mood suggestion',  description: 'Banner linking spend to nearby mood entries' },
];

type SpendingEntry = {
  id: string;
  amount: number;
  category: string | null;
  merchant_name: string | null;
  notes: string | null;
  source: string | null;
  plaid_transaction_id: string | null;
  logged_at: string;
};

const CATEGORIES = [
  "Food & Dining",
  "Shopping",
  "Entertainment",
  "Personal Care",
  "Transport",
  "Health",
  "Subscriptions",
  "Home",
  "Rent / Mortgage",
  "Utilities",
  "Other",
];

const CAT_COLOR: Record<string, string> = {
  "Food & Dining":   "#A62A50",
  "Shopping":        "#7B3FBF",
  "Entertainment":   "#3FA0A6",
  "Personal Care":   "#CE7A92",
  "Transport":       "#5A7FA8",
  "Health":          "#5FAD8C",
  "Subscriptions":   "#B8860B",
  "Home":            "#8A8A8A",
  "Rent / Mortgage": "#AAAAAA",
  "Utilities":       "#AAAAAA",
  "Other":           "#999999",
};

function normalizeCategory(cat: string | null): string {
  if (!cat) return "Other";
  const map: Record<string, string> = {
    "food":              "Food & Dining",
    "food & dining":     "Food & Dining",
    "transport":         "Transport",
    "health":            "Health",
    "shopping":          "Shopping",
    "entertainment":     "Entertainment",
    "subscriptions":     "Subscriptions",
    "subscription":      "Subscriptions",
    "personal care":     "Personal Care",
    "personal_care":     "Personal Care",
    "home":              "Home",
    "other":             "Other",
    "income / transfer": "Other",
  };
  return map[cat.toLowerCase()] ?? cat;
}

function formatAmount(n: number): string {
  return "$" + Number(n).toFixed(2);
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(): Date {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function localDateStr(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDayHeader(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = startOfToday();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.getTime() === today.getTime()) return "Today";
  if (date.getTime() === yesterday.getTime()) return "Yesterday";
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function groupByDay(entries: SpendingEntry[]): [string, SpendingEntry[]][] {
  const map: Record<string, SpendingEntry[]> = {};
  for (const e of entries) {
    const day = localDateStr(e.logged_at);
    (map[day] ??= []).push(e);
  }
  return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────

export function FinanceScreen() {
  const { theme } = useTheme();
  const ink = theme.ink;

  const [hiddenSections, setHiddenSections] = useState<string[]>([]);
  const [showSectionEditor, setShowSectionEditor] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const tourTotalsRef = useRef<View>(null);
  const tourBreakdownRef = useRef<View>(null);

  const FINANCE_TOUR: TourStep[] = [
    { ref: tourTotalsRef,    title: "Spending Total", body: "Switch between Today and This Week. Tap the + button to log a new expense. Plaid users see transactions sync automatically." },
    { ref: tourBreakdownRef, title: "Where It Went",  body: "Your spending broken down by category with proportional bars. Categories are editable on each transaction." },
  ];
  const [entries, setEntries] = useState<SpendingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [view, setView] = useState<"day" | "week">("week");

  const [showAdd, setShowAdd] = useState(false);
  const [addAmount, setAddAmount] = useState("");
  const [addCategory, setAddCategory] = useState("Food & Dining");
  const [addMerchant, setAddMerchant] = useState("");
  const [addDate, setAddDate] = useState(todayStr());
  const [addNotes, setAddNotes] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [addSubmitting, setAddSubmitting] = useState(false);

  const [editEntry, setEditEntry] = useState<SpendingEntry | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [moodSuggestion, setMoodSuggestion] = useState<{ spending_id: string; amount: number; merchant_name: string | null; mood_label: string } | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else if (!entries.length) setLoading(true);
    try {
      const since = new Date(Date.now() - 60 * 86400000).toISOString();
      const [data, suggestion] = await Promise.all([
        api.spending(since),
        api.spendingMoodSuggest().catch(() => null),
      ]);
      setEntries(Array.isArray(data) ? data : []);
      if (suggestion && suggestion.spending_id) {
        setMoodSuggestion(suggestion);
      }
    } catch {
      toast("Couldn't load spending.", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function syncPlaid() {
    setSyncing(true);
    try {
      await api.plaidSync();
      await load();
    } catch {
      // silent — pull to refresh recovers
    } finally {
      setSyncing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      hasSeenTooltip("finance").then(seen => {
        if (!seen) {
          setShowTooltip(true);
          markTooltipSeen("finance");
        }
      });
      hasSeenTooltip("finance-tour").then(seen => {
        if (!seen) { markTooltipSeen("finance-tour"); setTimeout(() => setShowTour(true), 600); }
      });
      api.getSettings().then((s: any) => {
        setHiddenSections(s?.finance_hidden_sections ?? []);
      }).catch(() => {});
      load();
      syncPlaid();
    }, [])
  );

  async function handleSaveSections(newHidden: string[]) {
    setHiddenSections(newHidden);
    setShowSectionEditor(false);
    try { await api.patchSettings({ finance_hidden_sections: newHidden }); } catch (_) {}
  }

  const viewStart = view === "day" ? startOfToday() : startOfWeek();

  const filtered = useMemo(
    () => entries.filter((e) => new Date(e.logged_at) >= viewStart),
    [entries, view]
  );

  const total = useMemo(
    () => filtered.reduce((s, e) => s + Number(e.amount), 0),
    [filtered]
  );

  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of filtered) {
      const cat = normalizeCategory(e.category);
      map[cat] = (map[cat] ?? 0) + Number(e.amount);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const maxCat = categoryTotals[0]?.[1] ?? 1;
  const grouped = useMemo(() => groupByDay(filtered), [filtered]);

  function resetAdd() {
    setAddAmount("");
    setAddCategory("Food & Dining");
    setAddMerchant("");
    setAddDate(todayStr());
    setAddNotes("");
    setAddError(null);
  }

  async function submitAdd(parsed: number) {
    setAddSubmitting(true);
    try {
      await api.addSpending({
        amount: parsed,
        category: addCategory,
        merchant_name: addMerchant.trim() || null,
        notes: addNotes.trim() || null,
        logged_at: addDate + "T12:00:00.000Z",
        source: "manual",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAdd(false);
      resetAdd();
      await load();
      toast("Expense logged.");
    } catch {
      toast("Couldn't save expense.", "error");
    } finally {
      setAddSubmitting(false);
    }
  }

  async function handleAdd() {
    setAddError(null);
    const parsed = parseFloat(addAmount.replace(",", "."));
    if (!addAmount.trim() || isNaN(parsed) || parsed <= 0) {
      setAddError("Enter a valid amount.");
      return;
    }
    if (parsed > 10000) {
      Alert.alert("Large amount", `$${parsed.toFixed(2)} — confirm it's not a typo.`, [
        { text: "Fix it", style: "cancel" },
        { text: "Save", onPress: () => void submitAdd(parsed) },
      ]);
      return;
    }
    await submitAdd(parsed);
  }

  function openEdit(entry: SpendingEntry) {
    setEditEntry(entry);
    setEditCategory(normalizeCategory(entry.category));
    setEditNotes(entry.notes ?? "");
  }

  async function handleEdit() {
    if (!editEntry) return;
    setEditSubmitting(true);
    try {
      await api.patchSpending(editEntry.id, { category: editCategory, notes: editNotes.trim() || null });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditEntry(null);
      await load();
      toast("Updated.");
    } catch {
      toast("Couldn't update.", "error");
    } finally {
      setEditSubmitting(false);
    }
  }

  function handleDeleteFromEdit() {
    if (!editEntry) return;
    const label = editEntry.merchant_name ?? editEntry.category ?? "this entry";
    Alert.alert("Delete entry?", `Remove "${label}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await api.deleteSpending(editEntry.id);
            setEditEntry(null);
            await load();
            toast("Deleted.");
          } catch {
            toast("Couldn't delete.", "error");
          }
        },
      },
    ]);
  }

  const s = useMemo(() => makeStyles(ink, theme.card, theme.cardBorder), [ink, theme.card, theme.cardBorder]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.page, alignItems: "center", justifyContent: "center" }}>
        <LoadingIndicator size="large" color={theme.purple.solid} />
      </View>
    );
  }

  return (
    <>
      <LinearGradient colors={[theme.page, theme.gradientEnd]} style={{ flex: 1 }}>
      <ScrollView
        style={{ backgroundColor: "transparent" }}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.purple.solid} />
        }
      >
        {showTooltip && (
          <TooltipBubble
            message="Track spending by category — connect Plaid to auto-sync transactions, or log manually. Tap any entry to add notes or change the category."
            onDismiss={() => setShowTooltip(false)}
          />
        )}
        {/* Section editor pencil */}
        <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 4 }}>
          <Pressable onPress={() => setShowSectionEditor(true)} hitSlop={10} accessibilityLabel="Customize Finance screen">
            <Ionicons name="pencil-outline" size={17} color={theme.textSoft} />
          </Pressable>
        </View>

        {/* Day / Week toggle */}
        <View style={[s.toggle, { backgroundColor: theme.card, borderColor: ink }]}>
          {(["day", "week"] as const).map((v) => (
            <Pressable
              key={v}
              onPress={() => setView(v)}
              style={[s.toggleBtn, view === v && { backgroundColor: theme.purple.solid }]}
              accessibilityRole="button"
            >
              <Text style={[s.toggleText, { color: view === v ? "#fff" : theme.textSoft }]}>
                {v === "day" ? "Today" : "This Week"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Total card */}
        {!hiddenSections.includes('totals') && (
        <View ref={tourTotalsRef} style={[s.card, { backgroundColor: theme.purple.tint, borderColor: theme.purple.solid }]}>
          <View style={{ height: 4, backgroundColor: theme.purple.solid, borderRadius: 4, marginBottom: 10, marginHorizontal: -16, marginTop: -16 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View>
              <Text style={[s.label, { color: theme.purple.sub }]}>
                {view === "day" ? "SPENT TODAY" : "SPENT THIS WEEK"}
              </Text>
              <Text style={[s.totalAmt, { color: theme.purple.fg }]}>{formatAmount(total)}</Text>
              <Text style={[s.sublabel, { color: theme.purple.sub }]}>
                {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
                {syncing ? "  ·  syncing…" : ""}
              </Text>
            </View>
            <Pressable
              onPress={() => setShowAdd(true)}
              style={[s.addBtn, { backgroundColor: theme.purple.solid, borderColor: ink }]}
              accessibilityRole="button"
              accessibilityLabel="Add expense"
            >
              <Ionicons name="add" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>
        )}

        {/* Category breakdown chart */}
        {categoryTotals.length > 0 && !hiddenSections.includes('breakdown') && (
          <View ref={tourBreakdownRef} style={[s.card, { borderColor: theme.cardBorder }]}>
            <View style={{ height: 4, backgroundColor: theme.purple.solid, borderRadius: 4, marginBottom: 10, marginHorizontal: -16, marginTop: -16 }} />
            <Text style={[s.cardTitle, { color: theme.textStrong }]}>Where it went</Text>
            <View style={{ gap: 11, marginTop: 6 }}>
              {categoryTotals.map(([cat, amt]) => {
                const color = CAT_COLOR[cat] ?? "#999";
                return (
                  <View key={cat}>
                    <View style={s.chartRow}>
                      <Text style={[s.chartCat, { color: theme.textStrong }]}>{cat}</Text>
                      <Text style={[s.chartAmt, { color }]}>{formatAmount(amt)}</Text>
                    </View>
                    <View style={[s.barTrack, { backgroundColor: color + "22" }]}>
                      <View style={[s.barFill, { backgroundColor: color, width: `${Math.round((amt / maxCat) * 100)}%` as any }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Spending-Mood suggestion banner */}
        {moodSuggestion && !hiddenSections.includes('mood_suggest') && (
          <View style={[s.card, { borderColor: theme.berry?.solid ?? theme.cardBorder, backgroundColor: theme.berry?.tint ?? theme.card, borderWidth: 2 }]}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <Text style={{ fontSize: 20 }}>💭</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.textStrong, fontSize: 14, fontWeight: "900", marginBottom: 4 }}>Heads up</Text>
                <Text style={{ color: theme.textStrong, fontSize: 13, lineHeight: 18 }}>
                  {`This purchase ($${Number(moodSuggestion.amount).toFixed(2)}${moodSuggestion.merchant_name ? " from " + moodSuggestion.merchant_name : ""}) happened close to a ${moodSuggestion.mood_label} check-in. Want to tag it as related?`}
                </Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  <Pressable
                    onPress={async () => {
                      try {
                        await api.tagSpending(moodSuggestion.spending_id, 'emotional_spend');
                        setMoodSuggestion(null);
                        toast("Tagged");
                      } catch {
                        toast("Couldn't tag.", "error");
                      }
                    }}
                    style={[s.suggBtn, { backgroundColor: theme.teal.solid, borderColor: theme.teal.solid }]}
                  >
                    <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>Yes, tag it</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setMoodSuggestion(null)}
                    style={[s.suggBtn, { backgroundColor: "transparent", borderColor: theme.cardBorder }]}
                  >
                    <Text style={{ color: theme.textSoft, fontSize: 13, fontWeight: "700" }}>No thanks</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Transaction list grouped by day */}
        {grouped.length === 0 ? (
          <EmptyState
            emoji="💳"
            title={view === "day" ? "Nothing logged today" : "Nothing this week"}
            message="Track cash manually or connect a bank in Settings to auto-import transactions."
            actionLabel="Log an expense"
            onAction={() => setShowAdd(true)}
          />
        ) : (
          grouped.map(([day, dayEntries]) => (
            <View key={day}>
              <Text style={[s.dayHeader, { color: theme.textSoft }]}>{formatDayHeader(day)}</Text>
              <View style={[s.card, { borderColor: theme.cardBorder }]}>
                {dayEntries.map((e, i) => {
                  const cat = normalizeCategory(e.category);
                  const color = CAT_COLOR[cat] ?? "#999";
                  return (
                    <Pressable
                      key={e.id}
                      onPress={() => openEdit(e)}
                      style={[
                        s.txRow,
                        i < dayEntries.length - 1 && { borderBottomWidth: 1, borderBottomColor: ink + "18" },
                      ]}
                      accessibilityRole="button"
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                        <IconBadge name="card-outline" color={color} bgColor={color + "20"} size={16} containerSize={32} borderRadius={8} />
                        <View style={{ flex: 1, gap: 3 }}>
                        <Text style={[s.merchant, { color: theme.textStrong }]} numberOfLines={1}>
                          {e.merchant_name ?? cat}
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <View style={[s.catBadge, { backgroundColor: color + "20" }]}>
                            <Text style={[s.catBadgeText, { color }]}>{cat}</Text>
                          </View>
                          {e.source === "plaid" && (
                            <Ionicons name="card-outline" size={11} color={theme.textSoft} />
                          )}
                          <Text style={[s.txTime, { color: theme.textSoft }]}>{formatTime(e.logged_at)}</Text>
                        </View>
                        {e.notes ? (
                          <Text style={[s.txNotes, { color: theme.textSoft }]} numberOfLines={1}>{e.notes}</Text>
                        ) : null}
                        </View>
                      </View>
                      <Text style={[s.txAmt, { color: theme.purple.sub }]}>{formatAmount(Number(e.amount))}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
      </LinearGradient>

      {/* Add modal */}
      <Modal
        visible={showAdd}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowAdd(false); resetAdd(); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, backgroundColor: theme.page }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
              <View style={s.modalHeader}>
                <Text style={[s.modalTitle, { color: theme.textStrong }]}>Log expense</Text>
                <Pressable onPress={() => { setShowAdd(false); resetAdd(); }}>
                  <Ionicons name="close" size={24} color={theme.textSoft} />
                </Pressable>
              </View>

              <Text style={[s.fieldLabel, { color: theme.textSoft }]}>Amount</Text>
              <TextInput
                value={addAmount}
                onChangeText={(v) => { setAddAmount(v); setAddError(null); }}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={theme.textSoft}
                autoFocus
                style={[s.amountInput, { color: theme.textStrong, borderColor: addError ? "#E8654E" : ink }]}
                returnKeyType="done"
              />
              {addError ? <Text style={[s.errorText, { color: "#E8654E" }]}>{addError}</Text> : null}

              <Text style={[s.fieldLabel, { color: theme.textSoft }]}>Category</Text>
              <View style={s.chipWrap}>
                {CATEGORIES.map((cat) => {
                  const active = addCategory === cat;
                  const color = CAT_COLOR[cat] ?? "#999";
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setAddCategory(cat)}
                      style={[s.chip, {
                        borderColor: active ? color : ink + "55",
                        backgroundColor: active ? color + "22" : "transparent",
                      }]}
                    >
                      <Text style={[s.chipText, { color: active ? color : theme.textSoft, fontWeight: active ? "700" : "500" }]}>
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[s.fieldLabel, { color: theme.textSoft }]}>Store / merchant (optional)</Text>
              <TextInput
                value={addMerchant}
                onChangeText={setAddMerchant}
                placeholder="e.g. Chipotle, Amazon"
                placeholderTextColor={theme.textSoft}
                style={[s.textInput, { color: theme.textStrong, borderColor: ink }]}
                returnKeyType="next"
              />

              <Text style={[s.fieldLabel, { color: theme.textSoft }]}>Date</Text>
              <TextInput
                value={addDate}
                onChangeText={setAddDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.textSoft}
                style={[s.textInput, { color: theme.textStrong, borderColor: ink }]}
                returnKeyType="next"
              />

              <Text style={[s.fieldLabel, { color: theme.textSoft }]}>Notes (optional)</Text>
              <TextInput
                value={addNotes}
                onChangeText={setAddNotes}
                placeholder="Any extra detail…"
                placeholderTextColor={theme.textSoft}
                multiline
                numberOfLines={2}
                style={[s.textInput, { color: theme.textStrong, borderColor: ink, minHeight: 60, textAlignVertical: "top" }]}
              />

              <Pressable
                onPress={handleAdd}
                disabled={addSubmitting}
                style={[s.saveBtn, { backgroundColor: theme.purple.solid, borderColor: ink, opacity: addSubmitting ? 0.6 : 1 }]}
              >
                {addSubmitting
                  ? <LoadingIndicator size="small" color="#fff" />
                  : <Text style={s.saveBtnText}>Save expense</Text>}
              </Pressable>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      <SectionEditorModal
        visible={showSectionEditor}
        title="Customize Finance"
        sections={FINANCE_SECTIONS}
        hidden={hiddenSections}
        onSave={handleSaveSections}
        onCancel={() => setShowSectionEditor(false)}
      />

      {/* Edit modal */}
      <Modal
        visible={!!editEntry}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditEntry(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, backgroundColor: theme.page }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
              <View style={s.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.modalTitle, { color: theme.textStrong }]} numberOfLines={1}>
                    {editEntry?.merchant_name ?? "Edit entry"}
                  </Text>
                  {editEntry && (
                    <Text style={[s.editMeta, { color: theme.textSoft }]}>
                      {formatAmount(Number(editEntry.amount))}  ·  {formatTime(editEntry.logged_at)}
                      {editEntry.source === "plaid" ? "  ·  imported" : ""}
                    </Text>
                  )}
                </View>
                <Pressable onPress={() => setEditEntry(null)} style={{ marginLeft: 12 }}>
                  <Ionicons name="close" size={24} color={theme.textSoft} />
                </Pressable>
              </View>

              <Text style={[s.fieldLabel, { color: theme.textSoft }]}>Category</Text>
              <View style={s.chipWrap}>
                {CATEGORIES.map((cat) => {
                  const active = editCategory === cat;
                  const color = CAT_COLOR[cat] ?? "#999";
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setEditCategory(cat)}
                      style={[s.chip, {
                        borderColor: active ? color : ink + "55",
                        backgroundColor: active ? color + "22" : "transparent",
                      }]}
                    >
                      <Text style={[s.chipText, { color: active ? color : theme.textSoft, fontWeight: active ? "700" : "500" }]}>
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[s.fieldLabel, { color: theme.textSoft }]}>Notes</Text>
              <TextInput
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder="Add a note…"
                placeholderTextColor={theme.textSoft}
                multiline
                numberOfLines={3}
                style={[s.textInput, { color: theme.textStrong, borderColor: ink, minHeight: 70, textAlignVertical: "top" }]}
              />

              <Pressable
                onPress={handleEdit}
                disabled={editSubmitting}
                style={[s.saveBtn, { backgroundColor: theme.purple.solid, borderColor: ink, opacity: editSubmitting ? 0.6 : 1 }]}
              >
                {editSubmitting
                  ? <LoadingIndicator size="small" color="#fff" />
                  : <Text style={s.saveBtnText}>Save changes</Text>}
              </Pressable>

              <Pressable onPress={handleDeleteFromEdit} style={[s.deleteBtn, { borderColor: ink }]}>
                <Text style={[s.deleteBtnText, { color: "#E8654E" }]}>Delete entry</Text>
              </Pressable>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
      <FeatureTour steps={FINANCE_TOUR} visible={showTour} onDone={() => setShowTour(false)} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function makeStyles(ink: string, card: string, border: string) {
  const shadowCard = coloredShadow("#7B3FBF");
  return StyleSheet.create({
    content:     { padding: 16, gap: 12, paddingBottom: 40 },
    toggle:      { flexDirection: "row", borderRadius: 22, borderWidth: 2, overflow: "hidden", ...shadowCard },
    toggleBtn:   { flex: 1, paddingVertical: 10, alignItems: "center" },
    toggleText:  { fontSize: 13, fontWeight: "700" },
    card:        { borderRadius: 26, borderWidth: 2, padding: 16, backgroundColor: card, ...shadowCard, gap: 4 },
    cardTitle:   { fontSize: 15, fontWeight: "800", marginBottom: 2 },
    label:       { fontSize: 10, fontWeight: "800", letterSpacing: 0.8, marginBottom: 2 },
    totalAmt:    { fontSize: 48, fontWeight: "900", lineHeight: 56 },
    sublabel:    { fontSize: 12, marginTop: 2 },
    addBtn: {
      width: 38, height: 38, borderRadius: 19, borderWidth: 2,
      alignItems: "center", justifyContent: "center",
      shadowColor: "rgba(60,40,20,0.1)", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
    },
    chartRow:    { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
    chartCat:    { fontSize: 13, fontWeight: "600" },
    chartAmt:    { fontSize: 13, fontWeight: "700" },
    barTrack:    { height: 7, borderRadius: 4, overflow: "hidden" },
    barFill:     { height: "100%", borderRadius: 4 },
    dayHeader:   { fontSize: 11, fontWeight: "800", letterSpacing: 0.6, marginBottom: -4, marginLeft: 4 },
    txRow:       { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12 },
    merchant:    { fontSize: 14, fontWeight: "700" },
    catBadge:    { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
    catBadgeText:{ fontSize: 10, fontWeight: "700" },
    txTime:      { fontSize: 11 },
    txNotes:     { fontSize: 11, fontStyle: "italic" },
    txAmt:       { fontSize: 15, fontWeight: "800", minWidth: 64, textAlign: "right" },
    modalContent:{ padding: 20, gap: 10, paddingBottom: 40 },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
    modalTitle:  { fontSize: 20, fontWeight: "800" },
    editMeta:    { fontSize: 12, marginTop: 2 },
    fieldLabel:  { fontSize: 12, fontWeight: "600", marginBottom: -2 },
    amountInput: {
      borderWidth: 2, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 32, fontWeight: "800",
      shadowColor: "rgba(60,40,20,0.1)", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
    },
    errorText:   { fontSize: 12, marginTop: -4 },
    textInput: {
      borderWidth: 2, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10,
      fontSize: 15, fontWeight: "500",
      shadowColor: "rgba(60,40,20,0.1)", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
    },
    chipWrap:    { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    chip:        { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
    chipText:    { fontSize: 12 },
    saveBtn: {
      borderRadius: 22, borderWidth: 2, paddingVertical: 14, alignItems: "center", marginTop: 6,
      shadowColor: "rgba(60,40,20,0.1)", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
    },
    saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
    deleteBtn:   { borderRadius: 22, borderWidth: 2, paddingVertical: 12, alignItems: "center", backgroundColor: "transparent" },
    deleteBtnText:{ fontWeight: "700", fontSize: 15 },
    suggBtn:     { borderRadius: 16, borderWidth: 2, paddingHorizontal: 16, paddingVertical: 9, alignItems: "center", justifyContent: "center" },
  });
}
