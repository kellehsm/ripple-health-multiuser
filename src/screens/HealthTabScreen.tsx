import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useTabPreferences } from '../hooks/useTabPreferences';
import { useNavigation } from '@react-navigation/native';
import { api } from '../api/client';

type SubTab = 'overview' | 'medication' | 'cycle';

interface MedSlot {
  id: string;
  time_of_day: string;
  specific_time: string | null;
  sort_order: number;
  dose_log: { id: string; status: string; taken_at: string } | null;
}

interface ColorCategory {
  id: string;
  label: string;
  color_hex: string;
}

interface MedPrescriber {
  id: string;
  name: string;
}

interface Medication {
  id: string;
  name: string;
  dosage: string | null;
  active: boolean;
  notes: string | null;
  purpose: string | null;
  refill_date: string | null;
  created_at: string;
  prescriber: MedPrescriber | null;
  color_category: ColorCategory | null;
  slots: MedSlot[];
}

type MedStatus = 'active' | 'new' | 'expiring' | 'refill_needed';

function computeMedStatus(med: Medication): MedStatus {
  const daysSinceAdded = (Date.now() - new Date(med.created_at).getTime()) / 86400000;
  if (daysSinceAdded < 7) return 'new';
  if (med.refill_date) {
    const daysUntil = (new Date(med.refill_date).getTime() - Date.now()) / 86400000;
    if (daysUntil <= 0) return 'refill_needed';
    if (daysUntil <= 7) return 'expiring';
  }
  return 'active';
}

const STATUS_BADGE: Record<MedStatus, { label: string; bg: string; fg: string }> = {
  active:        { label: 'Active',          bg: 'transparent',  fg: 'transparent' },
  new:           { label: 'New',             bg: '#DCFCE7',      fg: '#166534' },
  expiring:      { label: 'Refill soon',     bg: '#FEF9C3',      fg: '#854D0E' },
  refill_needed: { label: 'Refill needed',   bg: '#FEE2E2',      fg: '#991B1B' },
};

const TOD_HOUR: Record<string, number> = { morning: 8, midday: 12, evening: 20 };

function nextDoseCallout(medications: Medication[]): string | null {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  let earliest: { name: string; mins: number } | null = null;

  for (const med of medications) {
    for (const slot of med.slots) {
      if (slot.dose_log !== null) continue;
      let slotMins: number;
      if (slot.specific_time && slot.time_of_day === 'custom') {
        const [hh, mm] = slot.specific_time.split(':').map(Number);
        slotMins = (hh || 0) * 60 + (mm || 0);
      } else {
        slotMins = (TOD_HOUR[slot.time_of_day] ?? 8) * 60;
      }
      if (slotMins >= nowMins && (!earliest || slotMins < earliest.mins)) {
        earliest = { name: med.name, mins: slotMins };
      }
    }
  }

  if (!earliest) return null;
  const diffMins = earliest.mins - nowMins;
  if (diffMins < 60) return `${earliest.name} in ${diffMins} min`;
  const h = Math.floor(diffMins / 60);
  const m = diffMins % 60;
  return m > 0 ? `${earliest.name} in ${h}h ${m}m` : `${earliest.name} in ${h}h`;
}

interface CycleLog {
  id: string;
  log_date: string;
  flow_intensity: string | null;
  symptoms: string[] | null;
  mood_label: string | null;
  notes: string | null;
}

interface Prediction {
  predictedNextStart: string | null;
  avgCycleLength: number | null;
  cycleLengthsUsed: number;
  confidence: string;
  lastPeriodStart?: string;
  currentCycleDay?: number;
}

const FLOW_COLORS: Record<string, string> = {
  none: 'transparent',
  spotting: '#FDE8ED',
  light: '#F9B8C5',
  medium: '#E87A96',
  heavy: '#C43060',
};

const FLOW_OPTIONS = ['none', 'spotting', 'light', 'medium', 'heavy'];

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getPhaseLabel(cycleDay: number): string {
  if (cycleDay <= 5) return 'Menstrual';
  if (cycleDay <= 13) return 'Follicular';
  return 'Luteal';
}

function ChipRow({ active, onChange, theme }: { active: SubTab; onChange: (t: SubTab) => void; theme: any }) {
  return (
    <View style={[chipStyles.row, { borderBottomColor: theme.cardBorder }]}>
      {(['overview', 'medication', 'cycle'] as SubTab[]).map((tab) => (
        <Pressable
          key={tab}
          style={[
            chipStyles.chip,
            {
              backgroundColor: active === tab ? theme.teal.solid : theme.card,
              borderColor: theme.ink,
              shadowColor: theme.ink,
            },
          ]}
          onPress={() => onChange(tab)}
        >
          <Text style={[chipStyles.chipText, { color: active === tab ? '#fff' : theme.textSoft, fontWeight: active === tab ? '700' : '400' }]}>
            {tab === 'overview' ? 'Overview' : tab === 'medication' ? 'Medication' : 'Cycle'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, padding: 12, borderBottomWidth: 1 },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 2,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  chipText: { fontSize: 13 },
});

function HealthOverview({ onNavigate, theme }: { onNavigate: (t: SubTab) => void; theme: any }) {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [insight, setInsight] = useState<{ id: string; text: string; confidence: string } | null>(null);
  const [cycleLogModalDate, setCycleLogModalDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getMedications().catch(() => []),
      api.getCyclePrediction().catch(() => null),
      api.getHealthOverviewInsight().catch(() => null),
    ]).then(([meds, pred, ins]) => {
      setMedications(meds ?? []);
      setPrediction(pred);
      setInsight(ins);
    }).finally(() => setLoading(false));
  }, []);

  const totalSlots = medications.reduce((acc, m) => acc + m.slots.length, 0);
  const takenSlots = medications.reduce((acc, m) => acc + m.slots.filter((s) => s.dose_log !== null).length, 0);
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      {loading && <ActivityIndicator color={theme.teal.solid} style={{ marginTop: 40 }} />}

      <View style={[overviewStyles.card, { backgroundColor: theme.card, borderColor: theme.ink, shadowColor: theme.ink }]}>
        <Text style={[overviewStyles.cardTitle, { color: theme.textStrong }]}>Today's Medications</Text>
        {totalSlots === 0 ? (
          <Text style={{ color: theme.textSoft, fontSize: 13 }}>No medications scheduled.</Text>
        ) : (
          <Text style={{ color: theme.textStrong, fontSize: 22, fontWeight: '800' }}>
            {takenSlots} <Text style={{ fontSize: 14, fontWeight: '400', color: theme.textSoft }}>of {totalSlots} taken today</Text>
          </Text>
        )}
        <Pressable
          style={[overviewStyles.btn, { borderColor: theme.ink, backgroundColor: theme.teal.tint, shadowColor: theme.ink }]}
          onPress={() => onNavigate('medication')}
        >
          <Text style={{ color: theme.teal.fg, fontWeight: '700', fontSize: 13 }}>View schedule</Text>
        </Pressable>
      </View>

      <View style={[overviewStyles.card, { backgroundColor: theme.card, borderColor: theme.ink, shadowColor: theme.ink }]}>
        <Text style={[overviewStyles.cardTitle, { color: theme.textStrong }]}>Cycle Tracker</Text>
        {!prediction || prediction.confidence === 'none' ? (
          <Text style={{ color: theme.textSoft, fontSize: 13 }}>Log 3+ periods to see predictions.</Text>
        ) : (
          <>
            <Text style={{ color: theme.textStrong, fontSize: 22, fontWeight: '800' }}>
              Day {prediction.currentCycleDay ?? '—'}
            </Text>
            <Text style={{ color: theme.textSoft, fontSize: 13, marginTop: 2 }}>
              {getPhaseLabel(prediction.currentCycleDay ?? 1)} phase
            </Text>
            {prediction.predictedNextStart && (
              <Text style={{ color: theme.textSoft, fontSize: 12, marginTop: 4 }}>
                Period expected ~{formatDate(addDays(prediction.predictedNextStart, -2))} – {formatDate(addDays(prediction.predictedNextStart, 2))}
              </Text>
            )}
          </>
        )}
        <Pressable
          style={[overviewStyles.btn, { borderColor: theme.ink, backgroundColor: '#FDE8ED', shadowColor: theme.ink }]}
          onPress={() => setCycleLogModalDate(todayStr)}
        >
          <Text style={{ color: '#C43060', fontWeight: '700', fontSize: 13 }}>Log today</Text>
        </Pressable>
      </View>

      {insight && (
        <View style={[overviewStyles.insightBanner, { backgroundColor: theme.purple?.tint ?? '#F3EEFF', borderColor: theme.purple?.sub ?? '#9B6DFF' }]}>
          <Text style={{ color: theme.purple?.fg ?? '#5B21B6', fontSize: 13, fontWeight: '600', lineHeight: 18 }}>
            {insight.text}
          </Text>
          {insight.confidence === 'tentative' && (
            <Text style={{ color: theme.purple?.sub ?? '#9B6DFF', fontSize: 11, marginTop: 2 }}>
              Based on limited data — may change as more cycles are logged.
            </Text>
          )}
        </View>
      )}

      {cycleLogModalDate && (
        <CycleDayLogModal
          date={cycleLogModalDate}
          existingLog={null}
          theme={theme}
          onClose={() => setCycleLogModalDate(null)}
          onSaved={() => setCycleLogModalDate(null)}
        />
      )}
    </ScrollView>
  );
}

const overviewStyles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 2,
    padding: 16,
    gap: 8,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  cardTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', opacity: 0.6 },
  insightBanner: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 14,
    gap: 2,
  },
  btn: {
    marginTop: 4,
    borderWidth: 2,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
});

function AddMedicationModal({ theme, onClose, onSaved }: { theme: any; onClose: () => void; onSaved: () => void }) {
  const ink = theme.ink;
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [notes, setNotes] = useState('');
  const [purpose, setPurpose] = useState('');
  const [refillDate, setRefillDate] = useState('');
  const [prescriberName, setPrescriberName] = useState('');
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [categories, setCategories] = useState<ColorCategory[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [customTime, setCustomTime] = useState('');
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.getMedicationCategories().then(setCategories).catch(() => {});
  }, []);

  function onNameChange(text: string) {
    setName(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (text.length >= 2) {
        try { setSuggestions((await api.searchMedicationNames(text)).slice(0, 5)); }
        catch { setSuggestions([]); }
      } else setSuggestions([]);
    }, 250);
  }

  function toggleTime(t: string) {
    setSelectedTimes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  }

  async function save() {
    if (!name.trim()) return Alert.alert('Name required');
    setSaving(true);
    try {
      const slots = selectedTimes.map((t) => ({
        time_of_day: t,
        specific_time: t === 'custom' ? customTime || null : null,
      }));
      let prescriber_id: string | null = null;
      if (prescriberName.trim()) {
        const existing = (await api.getMedicationPrescribers()) as MedPrescriber[];
        const found = existing.find((p) => p.name.toLowerCase() === prescriberName.trim().toLowerCase());
        if (found) { prescriber_id = found.id; }
        else { const p = await api.addMedicationPrescriber({ name: prescriberName.trim() }); prescriber_id = p?.id ?? null; }
      }
      await api.addMedication({
        name: name.trim(), dosage: dosage.trim() || null, notes: notes.trim() || null,
        purpose: purpose.trim() || null, refill_date: refillDate.trim() || null,
        color_category_id: selectedCatId, prescriber_id, slots,
      });
      onSaved();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.sheet, { backgroundColor: theme.card, borderColor: ink }]}>
          <View style={modalStyles.header}>
            <Text style={[modalStyles.title, { color: theme.textStrong }]}>Add Medication</Text>
            <Pressable onPress={onClose}><Text style={{ color: theme.textSoft, fontSize: 22 }}>✕</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
            <View>
              <TextInput
                style={[modalStyles.input, { borderColor: ink, color: theme.textStrong, backgroundColor: theme.page }]}
                placeholder="Medication name"
                placeholderTextColor={theme.textSoft}
                value={name}
                onChangeText={onNameChange}
              />
              {suggestions.length > 0 && (
                <View style={[modalStyles.suggestions, { backgroundColor: theme.card, borderColor: ink }]}>
                  {suggestions.map((s) => (
                    <Pressable key={s} style={[modalStyles.suggRow, { borderBottomColor: theme.cardBorder }]}
                      onPress={() => { setName(s); setSuggestions([]); }}>
                      <Text style={{ color: theme.textStrong, fontSize: 14 }}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
            <TextInput style={[modalStyles.input, { borderColor: ink, color: theme.textStrong, backgroundColor: theme.page }]}
              placeholder="Dosage (e.g. 10mg)" placeholderTextColor={theme.textSoft} value={dosage} onChangeText={setDosage} />
            <TextInput style={[modalStyles.input, { borderColor: ink, color: theme.textStrong, backgroundColor: theme.page }]}
              placeholder="Purpose (optional)" placeholderTextColor={theme.textSoft} value={purpose} onChangeText={setPurpose} />
            <TextInput style={[modalStyles.input, { borderColor: ink, color: theme.textStrong, backgroundColor: theme.page }]}
              placeholder="Prescriber (optional)" placeholderTextColor={theme.textSoft} value={prescriberName} onChangeText={setPrescriberName} />
            <TextInput style={[modalStyles.input, { borderColor: ink, color: theme.textStrong, backgroundColor: theme.page }]}
              placeholder="Refill date (YYYY-MM-DD)" placeholderTextColor={theme.textSoft} value={refillDate} onChangeText={setRefillDate} keyboardType="numeric" />
            <TextInput style={[modalStyles.input, { borderColor: ink, color: theme.textStrong, backgroundColor: theme.page }]}
              placeholder="Notes (optional)" placeholderTextColor={theme.textSoft} value={notes} onChangeText={setNotes} />

            {categories.length > 0 && (
              <>
                <Text style={[modalStyles.label, { color: theme.textSoft }]}>Category</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {categories.map((cat) => (
                    <Pressable key={cat.id} onPress={() => setSelectedCatId(selectedCatId === cat.id ? null : cat.id)}
                      style={[modalStyles.catChip, {
                        borderColor: selectedCatId === cat.id ? cat.color_hex : theme.cardBorder,
                        backgroundColor: selectedCatId === cat.id ? cat.color_hex + '22' : theme.page,
                      }]}>
                      <View style={[modalStyles.catDot, { backgroundColor: cat.color_hex }]} />
                      <Text style={{ fontSize: 12, color: theme.textStrong, fontWeight: '600' }}>{cat.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            <Text style={[modalStyles.label, { color: theme.textSoft }]}>Schedule</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {['morning', 'midday', 'evening', 'custom'].map((t) => (
                <Pressable key={t} style={[modalStyles.timeChip, {
                    backgroundColor: selectedTimes.includes(t) ? theme.teal.solid : theme.page, borderColor: ink }]}
                  onPress={() => toggleTime(t)}>
                  <Text style={{ color: selectedTimes.includes(t) ? '#fff' : theme.textSoft, fontWeight: '600', fontSize: 13 }}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
            {selectedTimes.includes('custom') && (
              <TextInput style={[modalStyles.input, { borderColor: ink, color: theme.textStrong, backgroundColor: theme.page }]}
                placeholder="Custom time (HH:MM)" placeholderTextColor={theme.textSoft} value={customTime} onChangeText={setCustomTime} />
            )}
            <Pressable style={[modalStyles.saveBtn, { backgroundColor: theme.teal.solid, borderColor: ink }]} onPress={save} disabled={saving}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>{saving ? 'Saving…' : 'Save Medication'}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 2,
    borderBottomWidth: 0,
    padding: 20,
    maxHeight: '90%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800' },
  input: {
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  timeChip: {
    borderWidth: 2,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  saveBtn: {
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  suggestions: {
    borderWidth: 2,
    borderTopWidth: 0,
    borderRadius: 0,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    zIndex: 10,
  },
  suggRow: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1 },
});

function MedicationView({ theme }: { theme: any }) {
  const navigation = useNavigation<any>();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [refresh, setRefresh] = useState(0);

  const load = useCallback(async () => {
    try {
      const meds = await api.getMedications();
      setMedications(meds ?? []);
    } catch {
      setMedications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refresh]);

  const buckets: Record<string, Medication[]> = { morning: [], midday: [], evening: [], custom: [] };
  for (const med of medications) {
    for (const slot of med.slots) {
      const bucket = ['morning', 'midday', 'evening'].includes(slot.time_of_day) ? slot.time_of_day : 'custom';
      if (!buckets[bucket].find((m) => m.id === med.id)) {
        buckets[bucket].push(med);
      }
    }
  }

  async function markAllTaken(time_of_day: string) {
    try {
      await api.markSlotTaken(time_of_day);
      setRefresh((r) => r + 1);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed');
    }
  }

  async function toggleSlot(slot: MedSlot) {
    try {
      if (slot.dose_log) {
        await api.deleteDoseLog(slot.dose_log.id);
      } else {
        await api.markSelectedTaken([slot.id]);
      }
      setRefresh((r) => r + 1);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed');
    }
  }

  async function markSelectedDone() {
    try {
      await api.markSelectedTaken(selectedSlotIds);
      setSelectedSlotIds([]);
      setSelectMode(false);
      setRefresh((r) => r + 1);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed');
    }
  }

  function deleteMed(id: string) {
    Alert.alert('Remove medication?', 'This will hide the medication from your schedule.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteMedication(id);
            setRefresh((r) => r + 1);
          } catch {}
        },
      },
    ]);
  }

  const BUCKET_LABELS: Record<string, string> = { morning: 'Morning', midday: 'Midday', evening: 'Evening', custom: 'Custom' };

  return (
    <View style={{ flex: 1 }}>
      {loading ? (
        <ActivityIndicator color={theme.teal.solid} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 100 }}>
          {/* Next dose callout */}
          {(() => { const msg = nextDoseCallout(medications); return msg ? (
            <View style={[medStyles.nextDoseBar, { backgroundColor: theme.teal.tint, borderColor: theme.teal.solid }]}>
              <Text style={{ fontSize: 14 }}>⏰</Text>
              <Text style={[medStyles.nextDoseText, { color: theme.teal.sub }]}>Next: {msg}</Text>
            </View>
          ) : null; })()}

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[medStyles.sectionHead, { color: theme.textStrong }]}>Today's Schedule</Text>
            <Pressable onPress={() => { setSelectMode((s) => !s); setSelectedSlotIds([]); }}>
              <Text style={{ color: theme.teal.solid, fontWeight: '700', fontSize: 13 }}>{selectMode ? 'Done' : 'Select'}</Text>
            </Pressable>
          </View>

          {Object.entries(buckets).map(([bucket, meds]) => {
            if (meds.length === 0) return null;
            const bucketSlots = meds.flatMap((m) => m.slots.filter((s) => {
              const b = ['morning', 'midday', 'evening'].includes(s.time_of_day) ? s.time_of_day : 'custom';
              return b === bucket;
            }));
            return (
              <View key={bucket} style={[medStyles.bucket, { backgroundColor: theme.card, borderColor: theme.ink, shadowColor: theme.ink }]}>
                <View style={medStyles.bucketHeader}>
                  <Text style={[medStyles.bucketLabel, { color: theme.textStrong }]}>{BUCKET_LABELS[bucket]}</Text>
                  <Pressable onPress={() => markAllTaken(bucket)}>
                    <Text style={{ color: theme.teal.solid, fontWeight: '700', fontSize: 12 }}>Mark all</Text>
                  </Pressable>
                </View>
                {meds.map((med) => {
                  const slot = med.slots.find((s) => {
                    const b = ['morning', 'midday', 'evening'].includes(s.time_of_day) ? s.time_of_day : 'custom';
                    return b === bucket;
                  });
                  if (!slot) return null;
                  const taken = slot.dose_log !== null;
                  const isSelected = selectedSlotIds.includes(slot.id);
                  return (
                    <Pressable
                      key={med.id + slot.id}
                      style={[medStyles.medRow, { borderTopColor: theme.cardBorder }]}
                      onPress={() => {
                        if (selectMode) {
                          setSelectedSlotIds((prev) => prev.includes(slot.id) ? prev.filter((x) => x !== slot.id) : [...prev, slot.id]);
                        } else {
                          toggleSlot(slot);
                        }
                      }}
                    >
                      <View style={[medStyles.circle, { borderColor: taken ? theme.teal.solid : theme.cardBorder, backgroundColor: taken ? theme.teal.solid : 'transparent' }]}>
                        {taken && <Text style={{ color: '#fff', fontSize: 11 }}>✓</Text>}
                        {selectMode && !taken && (
                          <View style={[medStyles.selectBox, { borderColor: theme.ink, backgroundColor: isSelected ? theme.teal.solid : 'transparent' }]}>
                            {isSelected && <Text style={{ color: '#fff', fontSize: 10 }}>✓</Text>}
                          </View>
                        )}
                      </View>
                      {med.color_category && (
                        <View style={[medStyles.colorDot, { backgroundColor: med.color_category.color_hex }]} />
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[medStyles.medName, { color: taken ? theme.textSoft : theme.textStrong }]}>{med.name}</Text>
                        {med.dosage ? <Text style={{ color: theme.textSoft, fontSize: 12 }}>{med.dosage}</Text> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            );
          })}

          <Text style={[medStyles.sectionHead, { color: theme.textStrong, marginTop: 8 }]}>My Medications</Text>
          <Pressable
            style={[medStyles.addBtn, { borderColor: theme.ink, backgroundColor: theme.teal.tint, shadowColor: theme.ink }]}
            onPress={() => setShowAddModal(true)}
          >
            <Text style={{ color: theme.teal.fg, fontWeight: '700', fontSize: 14 }}>+ Add medication</Text>
          </Pressable>

          {medications.map((med) => {
            const status = computeMedStatus(med);
            const badge = STATUS_BADGE[status];
            const refillDays = med.refill_date
              ? Math.ceil((new Date(med.refill_date).getTime() - Date.now()) / 86400000)
              : null;
            return (
              <Pressable
                key={med.id}
                style={[medStyles.medCard, { backgroundColor: theme.card, borderColor: theme.ink, shadowColor: theme.ink }]}
                onPress={() => navigation.navigate('MedicationHistory', { medicationId: med.id, medicationName: med.name })}
                onLongPress={() => Alert.alert(med.name, 'What would you like to do?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => deleteMed(med.id) },
                ])}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <View style={[medStyles.colorDot, { backgroundColor: med.color_category?.color_hex ?? '#D1D5DB' }]} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={[medStyles.medName, { color: theme.textStrong, flex: 1 }]}>{med.name}</Text>
                      {status !== 'active' && (
                        <View style={[medStyles.statusBadge, { backgroundColor: badge.bg }]}>
                          <Text style={[medStyles.statusBadgeText, { color: badge.fg }]}>{badge.label}</Text>
                        </View>
                      )}
                    </View>
                    {med.dosage && <Text style={{ color: theme.textSoft, fontSize: 12 }}>{med.dosage}</Text>}
                    {med.purpose && <Text style={{ color: theme.textSoft, fontSize: 12 }}>Purpose: {med.purpose}</Text>}
                    {med.prescriber && <Text style={{ color: theme.textSoft, fontSize: 12 }}>Dr. {med.prescriber.name}</Text>}
                    <Text style={{ color: theme.textSoft, fontSize: 12 }}>
                      {med.slots.map((s) => s.time_of_day).join(', ') || 'No schedule'}
                    </Text>
                    {refillDays !== null && (
                      <Text style={{ color: refillDays <= 0 ? theme.coral.solid : theme.textSoft, fontSize: 12 }}>
                        {refillDays <= 0 ? 'Refill overdue' : `Refill in ${refillDays} day${refillDays !== 1 ? 's' : ''}`}
                      </Text>
                    )}
                  </View>
                  <Text style={{ color: theme.textSoft, fontSize: 16 }}>›</Text>
                </View>
              </Pressable>
            );
          })}

          <Pressable onPress={() => navigation.navigate('MedicationImport')}>
            <Text style={{ color: theme.teal.solid, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline', textAlign: 'center', marginTop: 4 }}>
              Import from CSV / Excel
            </Text>
          </Pressable>
        </ScrollView>
      )}

      {selectMode && selectedSlotIds.length > 0 && (
        <View style={[medStyles.fab, { backgroundColor: theme.teal.solid, borderColor: theme.ink, shadowColor: theme.ink }]}>
          <Pressable onPress={markSelectedDone}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>
              Mark {selectedSlotIds.length} selected as taken
            </Text>
          </Pressable>
        </View>
      )}

      {showAddModal && (
        <AddMedicationModal
          theme={theme}
          onClose={() => setShowAddModal(false)}
          onSaved={() => { setShowAddModal(false); setRefresh((r) => r + 1); }}
        />
      )}
    </View>
  );
}

const medStyles = StyleSheet.create({
  sectionHead: { fontSize: 16, fontWeight: '800' },
  bucket: {
    borderRadius: 14,
    borderWidth: 2,
    overflow: 'hidden',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  bucketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, paddingBottom: 10 },
  bucketLabel: { fontSize: 14, fontWeight: '700' },
  medRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, gap: 12 },
  medName: { fontSize: 15, fontWeight: '600' },
  circle: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  selectBox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  addBtn: {
    borderWidth: 2,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  medCard: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 14,
    gap: 4,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    borderRadius: 14,
    borderWidth: 2,
    paddingVertical: 16,
    alignItems: 'center',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  colorDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  nextDoseBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  nextDoseText: { fontSize: 13, fontWeight: '700', flex: 1 },
});

function CycleDayLogModal({
  date,
  existingLog,
  theme,
  onClose,
  onSaved,
}: {
  date: string;
  existingLog: CycleLog | null;
  theme: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [flow, setFlow] = useState<string>(existingLog?.flow_intensity ?? '');
  const [symptoms, setSymptoms] = useState<string[]>(existingLog?.symptoms ?? []);
  const [moodSearch, setMoodSearch] = useState('');
  const [moodLabel, setMoodLabel] = useState(existingLog?.mood_label ?? '');
  const [notes, setNotes] = useState(existingLog?.notes ?? '');
  const [commonSymptoms, setCommonSymptoms] = useState<string[]>([]);
  const [moreSymptoms, setMoreSymptoms] = useState<string[]>([]);
  const [showMore, setShowMore] = useState(false);
  const [moods, setMoods] = useState<Array<{ label: string; uses: number }>>([]);
  const [customSymptom, setCustomSymptom] = useState('');
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.getRankedSymptoms().then((res: any) => {
      setCommonSymptoms(res?.common ?? []);
      setMoreSymptoms(res?.more ?? []);
    }).catch(() => {});
    api.getRankedMoods('').then((res: any) => setMoods(res ?? [])).catch(() => {});
  }, []);

  function onMoodSearchChange(text: string) {
    setMoodSearch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      api.getRankedMoods(text).then((res: any) => setMoods(res ?? [])).catch(() => {});
    }, 250);
  }

  function toggleSymptom(s: string) {
    setSymptoms((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  async function addCustomSymptom() {
    if (!customSymptom.trim()) return;
    const label = customSymptom.trim();
    try {
      await api.addCustomSymptom(label);
      toggleSymptom(label);
      setCustomSymptom('');
      const res: any = await api.getRankedSymptoms();
      setCommonSymptoms(res?.common ?? []);
      setMoreSymptoms(res?.more ?? []);
    } catch {}
  }

  async function save() {
    setSaving(true);
    try {
      await api.upsertCycleLog({
        log_date: date,
        flow_intensity: flow || null,
        symptoms: symptoms.length > 0 ? symptoms : null,
        mood_label: moodLabel || null,
        notes: notes || null,
      });
      onSaved();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function deleteLog() {
    Alert.alert('Delete log?', 'Remove this day\'s log?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteCycleLog(date);
            onSaved();
          } catch (err: any) {
            Alert.alert('Error', err?.message ?? 'Failed');
          }
        },
      },
    ]);
  }

  const visibleSymptoms = showMore ? [...commonSymptoms, ...moreSymptoms] : commonSymptoms;

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.sheet, { backgroundColor: theme.card, borderColor: theme.ink }]}>
          <View style={modalStyles.header}>
            <Text style={[modalStyles.title, { color: theme.textStrong }]}>
              {formatDate(date)}
            </Text>
            <Pressable onPress={onClose}><Text style={{ color: theme.textSoft, fontSize: 22 }}>✕</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 20 }}>
            <View>
              <Text style={[cycleStyles.label, { color: theme.textSoft }]}>Flow intensity</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {FLOW_OPTIONS.map((f) => (
                  <Pressable
                    key={f}
                    style={[
                      cycleStyles.flowBtn,
                      {
                        backgroundColor: f === 'none' ? (flow === f ? theme.ink : theme.page) : FLOW_COLORS[f],
                        borderColor: flow === f ? theme.ink : theme.cardBorder,
                        borderWidth: flow === f ? 3 : 1.5,
                      },
                    ]}
                    onPress={() => setFlow(f === flow ? '' : f)}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '600', color: f === 'heavy' ? '#fff' : theme.textStrong }}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View>
              <Text style={[cycleStyles.label, { color: theme.textSoft }]}>Symptoms</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {visibleSymptoms.map((s) => (
                  <Pressable
                    key={s}
                    style={[
                      cycleStyles.chip,
                      {
                        backgroundColor: symptoms.includes(s) ? theme.teal.solid : theme.page,
                        borderColor: theme.ink,
                      },
                    ]}
                    onPress={() => toggleSymptom(s)}
                  >
                    <Text style={{ color: symptoms.includes(s) ? '#fff' : theme.textSoft, fontSize: 13 }}>{s}</Text>
                  </Pressable>
                ))}
              </View>
              {moreSymptoms.length > 0 && (
                <Pressable onPress={() => setShowMore((s) => !s)} style={{ marginTop: 8 }}>
                  <Text style={{ color: theme.teal.solid, fontSize: 12, fontWeight: '600' }}>
                    {showMore ? 'Show less' : `View ${moreSymptoms.length} more`}
                  </Text>
                </Pressable>
              )}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <TextInput
                  style={[cycleStyles.input, { flex: 1, borderColor: theme.ink, color: theme.textStrong, backgroundColor: theme.page }]}
                  placeholder="Add custom symptom"
                  placeholderTextColor={theme.textSoft}
                  value={customSymptom}
                  onChangeText={setCustomSymptom}
                />
                <Pressable
                  style={[cycleStyles.addBtn, { borderColor: theme.ink, backgroundColor: theme.teal.tint }]}
                  onPress={addCustomSymptom}
                >
                  <Text style={{ color: theme.teal.fg, fontWeight: '700' }}>Add</Text>
                </Pressable>
              </View>
            </View>

            <View>
              <Text style={[cycleStyles.label, { color: theme.textSoft }]}>Mood</Text>
              <TextInput
                style={[cycleStyles.input, { borderColor: theme.ink, color: theme.textStrong, backgroundColor: theme.page, marginTop: 8 }]}
                placeholder="Search moods…"
                placeholderTextColor={theme.textSoft}
                value={moodSearch}
                onChangeText={onMoodSearchChange}
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {moods.slice(0, 12).map((m) => (
                  <Pressable
                    key={m.label}
                    style={[
                      cycleStyles.chip,
                      {
                        backgroundColor: moodLabel === m.label ? theme.violet.solid : theme.page,
                        borderColor: theme.ink,
                      },
                    ]}
                    onPress={() => setMoodLabel(moodLabel === m.label ? '' : m.label)}
                  >
                    <Text style={{ color: moodLabel === m.label ? '#fff' : theme.textSoft, fontSize: 13 }}>{m.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View>
              <Text style={[cycleStyles.label, { color: theme.textSoft }]}>Notes</Text>
              <TextInput
                style={[cycleStyles.input, { borderColor: theme.ink, color: theme.textStrong, backgroundColor: theme.page, marginTop: 8, minHeight: 80, textAlignVertical: 'top' }]}
                placeholder="How are you feeling today?"
                placeholderTextColor={theme.textSoft}
                value={notes}
                onChangeText={setNotes}
                multiline
              />
            </View>

            <Pressable
              style={[modalStyles.saveBtn, { backgroundColor: theme.teal.solid, borderColor: theme.ink }]}
              onPress={save}
              disabled={saving}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>{saving ? 'Saving…' : 'Save'}</Text>
            </Pressable>

            {existingLog && (
              <Pressable onPress={deleteLog} style={{ alignItems: 'center', marginTop: 4 }}>
                <Text style={{ color: theme.danger, fontSize: 13, fontWeight: '600' }}>Delete this log</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const cycleStyles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  flowBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20 },
  chip: { borderWidth: 2, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  input: { borderWidth: 2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  addBtn: { borderWidth: 2, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
});

function MonthCalendar({ theme, onDayPress }: { theme: any; onDayPress: (date: string) => void }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [logs, setLogs] = useState<CycleLog[]>([]);

  const { year, month } = currentMonth;
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const from = firstDay.toISOString().slice(0, 10);
    const to = lastDay.toISOString().slice(0, 10);
    api.getCycleLogs(from, to).then((res: any) => setLogs(res ?? [])).catch(() => setLogs([]));
  }, [year, month]);

  function prevMonth() { setCurrentMonth(({ year: y, month: m }) => m === 0 ? { year: y - 1, month: 11 } : { year: y, month: m - 1 }); }
  function nextMonth() { setCurrentMonth(({ year: y, month: m }) => m === 11 ? { year: y + 1, month: 0 } : { year: y, month: m + 1 }); }

  const logMap: Record<string, CycleLog> = {};
  for (const log of logs) {
    logMap[log.log_date] = log;
  }

  const monthLabel = firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const cells: Array<number | null> = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <View style={[calStyles.container, { backgroundColor: theme.card, borderColor: theme.ink, shadowColor: theme.ink }]}>
      <View style={calStyles.header}>
        <Pressable onPress={prevMonth}><Text style={{ color: theme.textStrong, fontSize: 20 }}>‹</Text></Pressable>
        <Text style={[calStyles.monthLabel, { color: theme.textStrong }]}>{monthLabel}</Text>
        <Pressable onPress={nextMonth}><Text style={{ color: theme.textStrong, fontSize: 20 }}>›</Text></Pressable>
      </View>
      <View style={calStyles.dowRow}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <Text key={d} style={[calStyles.dowLabel, { color: theme.textSoft }]}>{d}</Text>
        ))}
      </View>
      <View style={calStyles.grid}>
        {cells.map((day, idx) => {
          if (day === null) return <View key={'empty-' + idx} style={calStyles.cell} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const log = logMap[dateStr];
          const flowColor = log?.flow_intensity ? FLOW_COLORS[log.flow_intensity] : 'transparent';
          const isToday = dateStr === today;
          return (
            <Pressable
              key={dateStr}
              style={[
                calStyles.cell,
                { backgroundColor: flowColor, borderColor: isToday ? theme.ink : 'transparent', borderWidth: isToday ? 2 : 0 },
              ]}
              onPress={() => onDayPress(dateStr)}
            >
              <Text style={[calStyles.dayText, { color: theme.textStrong }]}>{day}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const calStyles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 2,
    padding: 14,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  monthLabel: { fontSize: 15, fontWeight: '800' },
  dowRow: { flexDirection: 'row', marginBottom: 4 },
  dowLabel: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  dayText: { fontSize: 12, fontWeight: '500' },
});

function CycleView({ theme }: { theme: any }) {
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [history, setHistory] = useState<Array<{ start: string; end: string; length_days: number }>>([]);
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [modalLog, setModalLog] = useState<CycleLog | null>(null);
  const [calRefresh, setCalRefresh] = useState(0);

  useEffect(() => {
    api.getCyclePrediction().then((res: any) => setPrediction(res)).catch(() => {});
    api.getCycleHistory().then((res: any) => setHistory(res ?? [])).catch(() => {});
  }, [calRefresh]);

  async function openDay(dateStr: string) {
    try {
      const log = await api.getCycleLog(dateStr);
      setModalLog(log ?? null);
    } catch {
      setModalLog(null);
    }
    setModalDate(dateStr);
  }

  const avgCycle = history.length >= 2
    ? Math.round(history.reduce((acc, _, i) => {
        if (i === 0) return acc;
        const prev = new Date(history[i - 1].start).getTime();
        const curr = new Date(history[i].start).getTime();
        return acc + (curr - prev) / 86400000;
      }, 0) / (history.length - 1))
    : null;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
      {prediction && prediction.confidence !== 'none' && (
        <View style={[overviewStyles.card, { backgroundColor: theme.card, borderColor: theme.ink, shadowColor: theme.ink }]}>
          <Text style={{ color: theme.textStrong, fontSize: 28, fontWeight: '800' }}>Day {prediction.currentCycleDay}</Text>
          <Text style={{ color: theme.textSoft, fontSize: 14, marginTop: 2 }}>
            {getPhaseLabel(prediction.currentCycleDay ?? 1)} phase
          </Text>
          {prediction.predictedNextStart && (
            <Text style={{ color: theme.textSoft, fontSize: 13, marginTop: 4 }}>
              Period expected ~{formatDate(addDays(prediction.predictedNextStart, -2))} – {formatDate(addDays(prediction.predictedNextStart, 2))}
            </Text>
          )}
          <Text style={{ color: theme.textSoft, fontSize: 12, marginTop: 2 }}>
            Based on {prediction.cycleLengthsUsed} cycles · {prediction.confidence} confidence
          </Text>
        </View>
      )}

      <MonthCalendar key={calRefresh} theme={theme} onDayPress={openDay} />

      {history.length >= 2 && avgCycle !== null && (
        <View style={[overviewStyles.card, { backgroundColor: theme.card, borderColor: theme.ink, shadowColor: theme.ink }]}>
          <Text style={[overviewStyles.cardTitle, { color: theme.textStrong }]}>Cycle trend</Text>
          <Text style={{ color: theme.textStrong, fontSize: 20, fontWeight: '800' }}>{avgCycle} days average</Text>
          <Text style={{ color: theme.textSoft, fontSize: 12 }}>Last {history.length} periods</Text>
        </View>
      )}

      {modalDate && (
        <CycleDayLogModal
          date={modalDate}
          existingLog={modalLog}
          theme={theme}
          onClose={() => setModalDate(null)}
          onSaved={() => { setModalDate(null); setCalRefresh((r) => r + 1); }}
        />
      )}
    </ScrollView>
  );
}

export function HealthTabScreen() {
  const { theme } = useTheme();
  const { preferences } = useTabPreferences();
  const { medication, cycle } = preferences.health;
  const bothEnabled = medication && cycle;
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('overview');

  if (!medication && !cycle) {
    return (
      <View style={[rootStyles.center, { backgroundColor: theme.page }]}>
        <Text style={[rootStyles.placeholder, { color: theme.textSoft }]}>
          No health modules enabled. Go to Settings → Customize Tabs to turn them on.
        </Text>
      </View>
    );
  }

  const effectiveTab: SubTab = bothEnabled ? activeSubTab : medication ? 'medication' : 'cycle';
  const showChips = bothEnabled;

  return (
    <View style={{ flex: 1, backgroundColor: theme.page }}>
      {showChips && <ChipRow active={effectiveTab} onChange={setActiveSubTab} theme={theme} />}
      {effectiveTab === 'overview' && <HealthOverview onNavigate={setActiveSubTab} theme={theme} />}
      {effectiveTab === 'medication' && <MedicationView theme={theme} />}
      {effectiveTab === 'cycle' && <CycleView theme={theme} />}
    </View>
  );
}

const rootStyles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  placeholder: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
