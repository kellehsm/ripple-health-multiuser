import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { api } from '../api/client';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { WorkoutSetupWizard } from './WorkoutSetupWizard';
import { useTabPreferences } from '../hooks/useTabPreferences';

interface WorkoutSuggestion {
  type: string;
  title: string;
  body: string;
  cta: string | null;
  data: Record<string, any> | null;
}

const SUGGESTION_ICON: Record<string, string> = {
  rest_day: '😴',
  neglected_muscle: '🎯',
  program_gap: '📋',
  preferred_day: '📅',
  consistency_streak: '🔥',
  low_completion: '⏱️',
  no_history: '🏋️',
  generic: '💪',
};

interface ActiveProgram {
  id: string;
  name: string;
  days_per_week: number;
  preferred_minutes: number;
  is_active: boolean;
  days: Array<{
    id: string;
    day_number: number;
    focus: string;
    exercises: Array<{ exercise_id: string; name: string; sets: number; rep_range_min: number; rep_range_max: number }>;
  }>;
}

interface ExerciseSession {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  entry_count: number;
  exercise_names: string[] | null;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000 && d.getDate() === now.getDate()) return 'Today';
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const FOCUS_LABEL: Record<string, string> = {
  push: 'Push', pull: 'Pull', legs: 'Legs',
  upper: 'Upper Body', lower: 'Lower Body', full_body: 'Full Body',
};

export function ExerciseScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const { preferences } = useTabPreferences();
  const ink = theme.ink;

  const [sessions, setSessions] = useState<ExerciseSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [suggestion, setSuggestion] = useState<WorkoutSuggestion | null>(null);
  const [activeProgram, setActiveProgram] = useState<ActiveProgram | null>(null);

  // Wizard gate — null = loading, false = show wizard, true = show main screen
  const [wizardDone, setWizardDone] = useState<boolean | null>(null);

  useFocusEffect(useCallback(() => {
    if (!preferences.selectedModules.includes('exercise')) {
      navigation.navigate('Home');
      return;
    }
    setLoading(true);
    Promise.all([
      api.getWorkoutWizardStatus().catch(() => ({ complete: false })),
      api.listExerciseSessions(20, 0).catch(() => []),
      api.getExerciseSuggestion().catch(() => null),
      api.listWorkoutPrograms().catch(() => []),
    ]).then(([status, sessionList, sug, progs]) => {
      setWizardDone(status.complete === true);
      setSessions(sessionList ?? []);
      setSuggestion(sug ?? null);
      setActiveProgram((progs as any[]).find((p: any) => p.is_active) ?? null);
    }).finally(() => setLoading(false));
  }, []));

  async function handleStart() {
    setStarting(true);
    try {
      const session = await api.startExerciseSession();
      navigation.navigate('ExerciseSession', { sessionId: session.id });
    } catch {
      Alert.alert('Error', 'Could not start session. Try again.');
    } finally {
      setStarting(false);
    }
  }

  // Loading state — show spinner while checking wizard status
  if (loading || wizardDone === null) {
    return (
      <View style={[styles.container, { backgroundColor: theme.page, alignItems: 'center', justifyContent: 'center' }]}>
        <LoadingIndicator />
      </View>
    );
  }

  // Wizard not yet completed — show setup wizard
  if (!wizardDone) {
    return (
      <WorkoutSetupWizard
        onComplete={() => {
          setWizardDone(true);
          api.listWorkoutPrograms()
            .then((progs: any[]) => setActiveProgram((progs ?? []).find((p: any) => p.is_active) ?? null))
            .catch(() => {});
        }}
      />
    );
  }

  // Check if there's an open (unfinished) session
  const openSession = sessions.find((s) => !s.ended_at);

  return (
    <View style={[styles.container, { backgroundColor: theme.page }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Active session banner */}
        {openSession && (
          <Pressable
            onPress={() => navigation.navigate('ExerciseSession', { sessionId: openSession.id })}
            style={[styles.activeBanner, { backgroundColor: theme.teal.tint, borderColor: theme.teal.solid }]}
          >
            <View style={[styles.activeDot, { backgroundColor: theme.teal.solid }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.activeBannerTitle, { color: theme.teal.sub }]}>Session in progress</Text>
              <Text style={[styles.activeBannerSub, { color: theme.textSoft }]}>
                Started {new Date(openSession.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · tap to continue
              </Text>
            </View>
            <Text style={{ color: theme.teal.solid, fontSize: 18 }}>›</Text>
          </Pressable>
        )}

        {/* Start new session button */}
        {!openSession && (
          <Pressable
            onPress={handleStart}
            disabled={starting}
            style={[styles.startBtn, { backgroundColor: ink, borderColor: ink, shadowColor: ink }]}
          >
            {starting
              ? <LoadingIndicator color="#fff" />
              : <Text style={[styles.startBtnText, { color: theme.page }]}>🏃 Start workout session</Text>
            }
          </Pressable>
        )}

        {/* Active workout program */}
        {activeProgram && (
          <>
            <Text style={[styles.sectionLabel, { color: theme.textSoft }]}>YOUR PLAN</Text>
            <View style={[styles.programCard, { backgroundColor: theme.card, borderColor: ink, shadowColor: ink }]}>
              <Text style={[styles.programName, { color: theme.textStrong }]}>{activeProgram.name}</Text>
              <Text style={{ color: theme.textSoft, fontSize: 12, marginBottom: 8 }}>
                {activeProgram.preferred_minutes} min · {activeProgram.days_per_week} day{activeProgram.days_per_week !== 1 ? 's' : ''}/week
              </Text>
              {(activeProgram.days ?? []).map((day, i) => (
                <View
                  key={day.id}
                  style={[styles.programDay, { borderTopColor: theme.cardBorder ?? '#E5E7EB', borderTopWidth: i === 0 ? 0 : 1 }]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <View style={[styles.dayBadge, { backgroundColor: theme.teal?.solid ?? ink }]}>
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>D{day.day_number}</Text>
                    </View>
                    <Text style={{ color: theme.textStrong, fontWeight: '700', fontSize: 13 }}>
                      {FOCUS_LABEL[day.focus] ?? day.focus}
                    </Text>
                  </View>
                  <Text style={{ color: theme.textSoft, fontSize: 12, lineHeight: 17 }} numberOfLines={2}>
                    {(day.exercises ?? []).map((e) => e.name).join(' · ')}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Suggestion card */}
        {suggestion && (
          <View style={[styles.suggestionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.suggestionHeader}>
              <Text style={styles.suggestionIcon}>{SUGGESTION_ICON[suggestion.type] ?? '💪'}</Text>
              <Text style={[styles.suggestionTitle, { color: theme.textStrong }]}>{suggestion.title}</Text>
            </View>
            <Text style={[styles.suggestionBody, { color: theme.textSoft }]}>{suggestion.body}</Text>
            {suggestion.cta && (
              <Pressable
                onPress={handleStart}
                disabled={starting}
                style={[styles.suggestionCta, { borderColor: ink }]}
              >
                <Text style={[styles.suggestionCtaText, { color: ink }]}>{suggestion.cta}</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Sessions history */}
        {loading ? (
          <View style={styles.center}><LoadingIndicator /></View>
        ) : sessions.filter((s) => s.ended_at).length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 40 }}>🏋️</Text>
            <Text style={[styles.emptyTitle, { color: theme.textStrong }]}>No workouts yet</Text>
            <Text style={[styles.emptySub, { color: theme.textSoft }]}>Start your first session above.</Text>
          </View>
        ) : (
          <>
            <Text style={[styles.sectionLabel, { color: theme.textSoft }]}>RECENT SESSIONS</Text>
            {sessions.filter((s) => s.ended_at).map((session) => (
              <Pressable
                key={session.id}
                onPress={() => navigation.navigate('ExerciseDetail', { sessionId: session.id })}
                style={[styles.sessionCard, { backgroundColor: theme.card, borderColor: ink, shadowColor: ink }]}
              >
                <View style={styles.sessionCardRow}>
                  <Text style={[styles.sessionDate, { color: theme.textStrong }]}>
                    {formatDate(session.started_at)}
                  </Text>
                  <Text style={[styles.sessionDuration, { color: theme.textSoft }]}>
                    {formatDuration(session.duration_seconds)}
                  </Text>
                </View>
                {session.exercise_names && session.exercise_names.length > 0 && (
                  <Text style={[styles.sessionExercises, { color: theme.textSoft }]} numberOfLines={1}>
                    {session.exercise_names.slice(0, 3).join(' · ')}
                    {session.exercise_names.length > 3 ? ` +${session.exercise_names.length - 3}` : ''}
                  </Text>
                )}
                <View style={styles.sessionCardRow}>
                  <Text style={[styles.sessionCount, { color: theme.teal.fg }]}>
                    {session.entry_count} exercise{session.entry_count !== 1 ? 's' : ''}
                  </Text>
                  <Text style={{ color: theme.textSoft, fontSize: 16 }}>›</Text>
                </View>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 2,
  },
  activeDot: { width: 10, height: 10, borderRadius: 5 },
  activeBannerTitle: { fontSize: 14, fontWeight: '700' },
  activeBannerSub: { fontSize: 12, marginTop: 2 },
  startBtn: {
    borderRadius: 14,
    borderWidth: 2,
    paddingVertical: 16,
    alignItems: 'center',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  startBtnText: { fontSize: 16, fontWeight: '800' },
  center: { paddingTop: 40, alignItems: 'center' },
  empty: { paddingTop: 48, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptySub: { fontSize: 14, textAlign: 'center' },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginTop: 4 },
  suggestionCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  suggestionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  suggestionIcon: { fontSize: 20 },
  suggestionTitle: { fontSize: 14, fontWeight: '800', flex: 1 },
  suggestionBody: { fontSize: 13, lineHeight: 19 },
  suggestionCta: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 2,
  },
  suggestionCtaText: { fontSize: 13, fontWeight: '700' },
  sessionCard: {
    borderRadius: 14,
    borderWidth: 2,
    padding: 14,
    gap: 6,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  sessionCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionDate: { fontSize: 16, fontWeight: '800' },
  sessionDuration: { fontSize: 13 },
  sessionExercises: { fontSize: 13 },
  sessionCount: { fontSize: 12, fontWeight: '700' },
  programCard: {
    borderRadius: 14,
    borderWidth: 2,
    padding: 14,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  programName: { fontSize: 15, fontWeight: '900', marginBottom: 2 },
  programDay: { paddingTop: 8, marginTop: 6 },
  dayBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
});
