import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '../theme/ThemeContext';
import { api } from '../api/client';
import { useNavigation } from '@react-navigation/native';

interface ParsedMedRow {
  name: string;
  dosage: string;
  time_of_day: string;
  specific_time: string;
  notes: string;
  errors: string[];
}

export function MedicationImportScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const [rows, setRows] = useState<ParsedMedRow[]>([]);
  const [checkedRows, setCheckedRows] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<'pick' | 'preview' | 'done'>('pick');
  const [importedCount, setImportedCount] = useState(0);

  async function pickFile() {
    setLoading(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/plain', 'text/comma-separated-values',
               'application/csv', 'application/vnd.ms-excel', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];
      if (!asset.name?.toLowerCase().endsWith('.csv')) {
        Alert.alert('Wrong file type', 'Please select a .csv file.');
        return;
      }
      const uri = asset.uri;
      const fileContent = await FileSystem.readAsStringAsync(uri);
      const res = await api.previewMedicationImport(fileContent);
      const parsed: ParsedMedRow[] = res?.rows ?? [];
      setRows(parsed);
      const checked = new Set<number>();
      parsed.forEach((r, i) => { if (r.errors.length === 0) checked.add(i); });
      setCheckedRows(checked);
      setStep('preview');
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to read file');
    } finally {
      setLoading(false);
    }
  }

  function toggleRow(index: number) {
    setCheckedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function commitImport() {
    const selectedRows = rows.filter((_, i) => checkedRows.has(i) && rows[i].errors.length === 0);
    if (selectedRows.length === 0) {
      Alert.alert('Nothing to import', 'Select at least one valid row.');
      return;
    }
    setImporting(true);
    try {
      const res = await api.commitMedicationImport(selectedRows);
      setImportedCount(res?.imported ?? selectedRows.length);
      setStep('done');
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  const validCheckedCount = rows.filter((r, i) => checkedRows.has(i) && r.errors.length === 0).length;

  return (
    <View style={[styles.container, { backgroundColor: theme.page }]}>
      {step === 'pick' && (
        <View style={styles.centered}>
          <Text style={[styles.title, { color: theme.textStrong }]}>Import Medications</Text>
          <Text style={[styles.subtitle, { color: theme.textSoft }]}>
            Upload a CSV file with columns: name, dosage, time_of_day, specific_time, notes
          </Text>
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: theme.teal.solid, borderColor: theme.ink, shadowColor: theme.ink }]}
            onPress={pickFile}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Pick CSV file</Text>
            )}
          </Pressable>
        </View>
      )}

      {step === 'preview' && (
        <View style={{ flex: 1 }}>
          <View style={[styles.previewHeader, { borderBottomColor: theme.cardBorder }]}>
            <Text style={[styles.previewTitle, { color: theme.textStrong }]}>
              {rows.length} row{rows.length !== 1 ? 's' : ''} found
            </Text>
            <Text style={[styles.previewSub, { color: theme.textSoft }]}>
              {rows.filter((r) => r.errors.length === 0).length} valid · {rows.filter((r) => r.errors.length > 0).length} with errors
            </Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
            {rows.map((row, i) => {
              const hasErrors = row.errors.length > 0;
              const isChecked = checkedRows.has(i);
              return (
                <Pressable
                  key={i}
                  style={[
                    styles.rowCard,
                    {
                      backgroundColor: theme.card,
                      borderColor: hasErrors ? theme.danger : theme.ink,
                      shadowColor: theme.ink,
                      opacity: hasErrors ? 0.6 : 1,
                    },
                  ]}
                  onPress={() => { if (!hasErrors) toggleRow(i); }}
                  disabled={hasErrors}
                >
                  <View style={styles.rowLeft}>
                    {!hasErrors && (
                      <View style={[styles.checkbox, { borderColor: theme.ink, backgroundColor: isChecked ? theme.teal.solid : 'transparent' }]}>
                        {isChecked && <Text style={{ color: '#fff', fontSize: 11 }}>✓</Text>}
                      </View>
                    )}
                    {hasErrors && (
                      <Text style={{ fontSize: 16 }}>⚠️</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowName, { color: hasErrors ? theme.danger : theme.textStrong, textDecorationLine: hasErrors ? 'line-through' : 'none' }]}>
                      {row.name || '(no name)'}
                    </Text>
                    {row.dosage ? <Text style={{ color: theme.textSoft, fontSize: 12 }}>{row.dosage}</Text> : null}
                    {row.time_of_day ? <Text style={{ color: theme.textSoft, fontSize: 12 }}>{row.time_of_day}</Text> : null}
                    {hasErrors && (
                      <Text style={{ color: theme.danger, fontSize: 11, marginTop: 2 }}>
                        {row.errors.join(', ')}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={[styles.footer, { borderTopColor: theme.cardBorder, backgroundColor: theme.page }]}>
            <Pressable style={[styles.secondaryBtn, { borderColor: theme.ink }]} onPress={() => setStep('pick')}>
              <Text style={{ color: theme.textStrong, fontWeight: '700' }}>Back</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryBtn, { flex: 1, backgroundColor: theme.teal.solid, borderColor: theme.ink, shadowColor: theme.ink }]}
              onPress={commitImport}
              disabled={importing || validCheckedCount === 0}
            >
              {importing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Import {validCheckedCount} medication{validCheckedCount !== 1 ? 's' : ''}</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {step === 'done' && (
        <View style={styles.centered}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>✅</Text>
          <Text style={[styles.title, { color: theme.textStrong }]}>Import complete!</Text>
          <Text style={[styles.subtitle, { color: theme.textSoft }]}>
            {importedCount} medication{importedCount !== 1 ? 's' : ''} added to your schedule.
          </Text>
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: theme.teal.solid, borderColor: theme.ink, shadowColor: theme.ink }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.primaryBtnText}>Done</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  primaryBtn: {
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    minWidth: 160,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondaryBtn: {
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  previewHeader: { padding: 16, borderBottomWidth: 1 },
  previewTitle: { fontSize: 16, fontWeight: '800' },
  previewSub: { fontSize: 12, marginTop: 2 },
  rowCard: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  rowLeft: { width: 26, alignItems: 'center', justifyContent: 'center' },
  rowName: { fontSize: 15, fontWeight: '600' },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1 },
});
