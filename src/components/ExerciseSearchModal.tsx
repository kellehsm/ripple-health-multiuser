import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TextInput, Pressable, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { api } from '../api/client';
import { LoadingIndicator } from './LoadingIndicator';

interface ExerciseResult {
  id: string;
  name: string;
  category: string;
  equipment: string | null;
  primary_muscles: string[];
  images: string[];
}

interface LogForm {
  sets: string;
  reps: string;
  duration_minutes: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (exercise: ExerciseResult, form: { sets?: number; reps?: number; duration_seconds?: number }) => void;
}

export function ExerciseSearchModal({ visible, onClose, onAdd }: Props) {
  const { theme } = useTheme();
  const ink = theme.ink;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ExerciseResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ExerciseResult | null>(null);
  const [form, setForm] = useState<LogForm>({ sets: '', reps: '', duration_minutes: '' });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setSelected(null);
      setForm({ sets: '', reps: '', duration_minutes: '' });
    }
  }, [visible]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      api.searchExerciseLibrary({ search: query, limit: 25 })
        .then(setResults)
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  function handleAdd() {
    if (!selected) return;
    const sets = parseInt(form.sets, 10) || undefined;
    const reps = parseInt(form.reps, 10) || undefined;
    const duration_seconds = form.duration_minutes
      ? Math.round(parseFloat(form.duration_minutes) * 60) || undefined
      : undefined;
    onAdd(selected, { sets, reps, duration_seconds });
    onClose();
  }

  const EXERCISE_IMAGE_BASE =
    'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.sheet, { backgroundColor: theme.page }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.cardBorder }]}>
          <Text style={[styles.headerTitle, { color: theme.textStrong }]}>
            {selected ? selected.name : 'Add exercise'}
          </Text>
          <Pressable onPress={selected ? () => setSelected(null) : onClose} style={styles.headerClose}>
            <Text style={{ color: ink, fontSize: 15, fontWeight: '700' }}>
              {selected ? '← Back' : 'Cancel'}
            </Text>
          </Pressable>
        </View>

        {selected ? (
          /* ── Log entry form ── */
          <View style={styles.formContainer}>
            <View style={[styles.exerciseChip, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <Text style={{ fontSize: 18 }}>🏋️</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.chipName, { color: theme.textStrong }]}>{selected.name}</Text>
                {selected.primary_muscles.length > 0 && (
                  <Text style={[styles.chipMuscles, { color: theme.textSoft }]}>
                    {selected.primary_muscles.slice(0, 2).join(', ')}
                  </Text>
                )}
              </View>
            </View>

            <Text style={[styles.formLabel, { color: theme.textSoft }]}>SETS & REPS (strength)</Text>
            <View style={styles.formRow}>
              <View style={[styles.formField, { backgroundColor: theme.card, borderColor: ink }]}>
                <Text style={[styles.formFieldLabel, { color: theme.textSoft }]}>Sets</Text>
                <TextInput
                  style={[styles.formFieldInput, { color: theme.textStrong }]}
                  value={form.sets}
                  onChangeText={(v) => setForm((f) => ({ ...f, sets: v }))}
                  keyboardType="numeric"
                  placeholder="—"
                  placeholderTextColor={theme.textSoft}
                />
              </View>
              <View style={[styles.formField, { backgroundColor: theme.card, borderColor: ink }]}>
                <Text style={[styles.formFieldLabel, { color: theme.textSoft }]}>Reps</Text>
                <TextInput
                  style={[styles.formFieldInput, { color: theme.textStrong }]}
                  value={form.reps}
                  onChangeText={(v) => setForm((f) => ({ ...f, reps: v }))}
                  keyboardType="numeric"
                  placeholder="—"
                  placeholderTextColor={theme.textSoft}
                />
              </View>
            </View>

            <Text style={[styles.formLabel, { color: theme.textSoft }]}>OR DURATION (cardio / timed)</Text>
            <View style={[styles.formField, { backgroundColor: theme.card, borderColor: ink, alignSelf: 'stretch' }]}>
              <Text style={[styles.formFieldLabel, { color: theme.textSoft }]}>Minutes</Text>
              <TextInput
                style={[styles.formFieldInput, { color: theme.textStrong }]}
                value={form.duration_minutes}
                onChangeText={(v) => setForm((f) => ({ ...f, duration_minutes: v }))}
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor={theme.textSoft}
              />
            </View>

            <Pressable
              onPress={handleAdd}
              style={[styles.addBtn, { backgroundColor: ink, borderColor: ink, shadowColor: ink }]}
            >
              <Text style={[styles.addBtnText, { color: theme.page }]}>Log exercise</Text>
            </Pressable>
          </View>
        ) : (
          /* ── Search list ── */
          <>
            <View style={[styles.searchBar, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
              <TextInput
                style={[styles.searchInput, { color: theme.textStrong }]}
                value={query}
                onChangeText={setQuery}
                placeholder="Search exercises…"
                placeholderTextColor={theme.textSoft}
                autoFocus
                returnKeyType="search"
              />
              {loading && <LoadingIndicator size="small" />}
            </View>

            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 32 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => setSelected(item)}
                  style={[styles.resultRow, { borderBottomColor: theme.cardBorder }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.resultName, { color: theme.textStrong }]}>{item.name}</Text>
                    <Text style={[styles.resultMeta, { color: theme.textSoft }]}>
                      {[item.category, item.equipment, item.primary_muscles[0]].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Text style={{ color: theme.textSoft, fontSize: 16 }}>›</Text>
                </Pressable>
              )}
              ListEmptyComponent={
                !loading ? (
                  <Text style={[styles.emptyMsg, { color: theme.textSoft }]}>
                    {query ? 'No exercises found' : 'Start typing to search'}
                  </Text>
                ) : null
              }
            />
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', flex: 1 },
  headerClose: { padding: 4 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 16 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  resultName: { fontSize: 15, fontWeight: '600' },
  resultMeta: { fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  emptyMsg: { textAlign: 'center', marginTop: 40, fontSize: 14 },
  formContainer: { padding: 16, gap: 14 },
  exerciseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipName: { fontSize: 15, fontWeight: '700' },
  chipMuscles: { fontSize: 12, textTransform: 'capitalize', marginTop: 2 },
  formLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  formRow: { flexDirection: 'row', gap: 12 },
  formField: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 2,
    padding: 12,
    gap: 4,
  },
  formFieldLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  formFieldInput: { fontSize: 22, fontWeight: '800' },
  addBtn: {
    borderRadius: 14,
    borderWidth: 2,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  addBtnText: { fontSize: 16, fontWeight: '800' },
});
