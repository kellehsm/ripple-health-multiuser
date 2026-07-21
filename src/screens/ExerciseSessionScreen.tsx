import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, Alert,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { api } from '../api/client';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { ExerciseSearchModal } from '../components/ExerciseSearchModal';

interface LogEntry {
  id: string;
  sets: number | null;
  reps: number | null;
  duration_seconds: number | null;
  logged_at: string;
  sort_order: number;
  weight_used: number | null;
  target_rep_range_min: number | null;
  target_rep_range_max: number | null;
  actual_reps_per_set: number[] | null;
  all_sets_maxed: boolean | null;
  exercise: {
    id: string;
    name: string;
    category: string;
    equipment: string | null;
    primary_muscles: string[];
  };
}

function formatElapsed(startedAt: string): string {
  const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function entryLabel(entry: LogEntry): string {
  const wt = entry.weight_used ? ` @ ${entry.weight_used} lbs` : '';
  if (entry.actual_reps_per_set && entry.actual_reps_per_set.length > 0) {
    const arr = entry.actual_reps_per_set;
    const allSame = arr.every((r) => r === arr[0]);
    if (allSame) return `${arr.length} × ${arr[0]} reps${wt}`;
    return `${arr.join('/')} reps${wt}`;
  }
  if (entry.sets && entry.reps) return `${entry.sets} × ${entry.reps} reps${wt}`;
  if (entry.sets) return `${entry.sets} set${entry.sets > 1 ? 's' : ''}${wt}`;
  if (entry.duration_seconds) {
    const m = Math.floor(entry.duration_seconds / 60);
    const s = entry.duration_seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  return 'Logged';
}

export function ExerciseSessionScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { sessionId } = route.params as { sessionId: string };
  const ink = theme.ink;

  const [startedAt, setStartedAt] = useState<string>('');
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [searchVisible, setSearchVisible] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [elapsed, setElapsed] = useState('00:00');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Prevents the interval from being created more than once per mount,
  // even if useFocusEffect fires multiple times (re-navigation, tab switch).
  const timerStartedRef = useRef(false);
  // Prevents setStartedAt from being called again on re-focus — the absolute
  // started_at value never changes, so resetting it would re-trigger useEffect
  // and create a duplicate interval.
  const sessionLoadedRef = useRef(false);

  // Load session details — on first focus, capture startedAt to seed the timer.
  // On subsequent focuses (navigate away → back), only refresh entries.
  const loadSession = useCallback(async (firstLoad = false) => {
    try {
      const s = await api.getExerciseSession(sessionId);
      if (firstLoad) setStartedAt(s.started_at);
      setEntries(s.entries ?? []);
    } catch {
      Alert.alert('Error', 'Could not load session.');
    } finally {
      setLoadingEntries(false);
    }
  }, [sessionId]);

  useFocusEffect(useCallback(() => {
    if (!sessionLoadedRef.current) {
      sessionLoadedRef.current = true;
      loadSession(true);   // first focus: fetch startedAt + entries
    } else {
      loadSession(false);  // re-focus: refresh entries only, timer keeps running
    }
  }, [loadSession]));

  // Timer — starts once when startedAt is first set, never restarts on re-focus.
  useEffect(() => {
    if (!startedAt || timerStartedRef.current) return;
    timerStartedRef.current = true;
    setElapsed(formatElapsed(startedAt));
    timerRef.current = setInterval(() => setElapsed(formatElapsed(startedAt)), 1000);
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      timerStartedRef.current = false;
    };
  }, [startedAt]);

  async function handleAdd(exercise: any, form: {
    sets?: number; reps?: number; duration_seconds?: number;
    weight_used?: number; target_rep_range_min?: number; target_rep_range_max?: number;
    actual_reps_per_set?: number[];
  }) {
    try {
      const entry = await api.addExerciseEntry(sessionId, {
        exercise_id: exercise.id,
        ...form,
      });
      // Refresh entries
      await loadSession();
    } catch {
      Alert.alert('Error', 'Could not log exercise.');
    }
  }

  async function handleDeleteEntry(entryId: string) {
    Alert.alert('Remove', 'Remove this exercise from the session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await api.deleteExerciseEntry(entryId);
            setEntries((prev) => prev.filter((e) => e.id !== entryId));
          } catch {
            Alert.alert('Error', 'Could not remove entry.');
          }
        },
      },
    ]);
  }

  async function handleFinish() {
    Alert.alert('Finish workout', 'End this session?', [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'Finish', onPress: async () => {
          setFinishing(true);
          try {
            await api.finishExerciseSession(sessionId);
            navigation.replace('ExerciseDetail', { sessionId });
          } catch {
            Alert.alert('Error', 'Could not finish session.');
          } finally {
            setFinishing(false);
          }
        },
      },
    ]);
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.page }]}>
      {/* Timer */}
      <View style={[styles.timerBar, { backgroundColor: theme.card, borderBottomColor: ink }]}>
        <View>
          <Text style={[styles.timerLabel, { color: theme.textSoft }]}>SESSION TIME</Text>
          <Text style={[styles.timer, { color: ink }]}>{elapsed}</Text>
        </View>
        <Pressable
          onPress={handleFinish}
          disabled={finishing}
          style={[styles.finishBtn, { backgroundColor: theme.coral.solid, borderColor: ink }]}
        >
          {finishing
            ? <LoadingIndicator color="#fff" size="small" />
            : <Text style={styles.finishBtnText}>Finish</Text>
          }
        </Pressable>
      </View>

      {/* Entries */}
      <ScrollView contentContainerStyle={styles.entries}>
        {loadingEntries ? (
          <View style={styles.center}><LoadingIndicator /></View>
        ) : entries.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: theme.textSoft }]}>
              Tap "Add exercise" below to log your first set.
            </Text>
          </View>
        ) : (
          entries.map((entry) => (
            <Pressable
              key={entry.id}
              onLongPress={() => handleDeleteEntry(entry.id)}
              style={[styles.entryCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.entryName, { color: theme.textStrong }]}>{entry.exercise.name}</Text>
                <Text style={[styles.entryDetail, { color: theme.teal.fg }]}>{entryLabel(entry)}</Text>
              </View>
              <Text style={{ color: theme.textSoft, fontSize: 11 }}>hold to remove</Text>
            </Pressable>
          ))
        )}
      </ScrollView>

      {/* Add button */}
      <View style={[styles.footer, { borderTopColor: theme.cardBorder }]}>
        <Pressable
          onPress={() => setSearchVisible(true)}
          style={[styles.addBtn, { backgroundColor: ink, borderColor: ink, shadowColor: "rgba(60,40,20,0.1)" }]}
        >
          <Text style={[styles.addBtnText, { color: theme.page }]}>+ Add exercise</Text>
        </Pressable>
      </View>

      <ExerciseSearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onAdd={handleAdd}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  timerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 2,
  },
  timerLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  timer: { fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 2 },
  finishBtn: {
    borderRadius: 16,
    borderWidth: 2,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  finishBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  entries: { padding: 14, gap: 10, paddingBottom: 24 },
  center: { paddingTop: 40, alignItems: 'center' },
  empty: { paddingTop: 48, alignItems: 'center', paddingHorizontal: 32 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
  },
  entryName: { fontSize: 15, fontWeight: '700' },
  entryDetail: { fontSize: 13, marginTop: 2 },
  footer: { padding: 14, borderTopWidth: 1 },
  addBtn: {
    borderRadius: 26,
    borderWidth: 2,
    paddingVertical: 15,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  addBtnText: { fontSize: 16, fontWeight: '800' },
});
