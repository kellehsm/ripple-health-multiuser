import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../theme/ThemeContext";
import { api } from "../api/client";
import { toast } from "../lib/toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type Section = "breathing" | "grounding" | "meditation" | "gratitude";
type BreathPattern = "box" | "478" | "equal";
type GroundTechnique = "54321" | "pmr" | "stop";

// ─── Data ─────────────────────────────────────────────────────────────────────

const BREATH_PATTERNS: Record<BreathPattern, { label: string; desc: string; phases: [number, number, number, number] }> = {
  box:   { label: "Box Breathing",   desc: "4 · 4 · 4 · 4",  phases: [4, 4, 4, 4] },
  "478": { label: "4-7-8",           desc: "4 · 7 · 8 · 0",  phases: [4, 7, 8, 0] },
  equal: { label: "Equal Breathing", desc: "5 · 0 · 5 · 0",  phases: [5, 0, 5, 0] },
};

const PHASE_LABELS = ["INHALE", "HOLD", "EXHALE", "HOLD"];

const PMR_STEPS = [
  "Feet & toes",
  "Calves",
  "Thighs",
  "Abdomen",
  "Hands & arms",
  "Shoulders",
  "Face & jaw",
];
const PMR_DURATION = 10; // seconds per step (tense), same for release

const GROUNDING_54321 = [
  { count: 5, sense: "SEE",         prompt: "Name 5 things you can see around you." },
  { count: 4, sense: "TOUCH",       prompt: "Notice 4 things you can physically feel." },
  { count: 3, sense: "HEAR",        prompt: "Identify 3 sounds you can hear right now." },
  { count: 2, sense: "SMELL",       prompt: "Notice 2 things you can smell." },
  { count: 1, sense: "TASTE",       prompt: "Notice 1 thing you can taste." },
];

const STOP_STEPS = [
  { letter: "S", word: "Stop",    prompt: "Pause whatever you're doing — just stop for a moment." },
  { letter: "T", word: "Take",    prompt: "Take a slow, deep breath in … and out." },
  { letter: "O", word: "Observe", prompt: "Notice your thoughts, feelings, and body sensations without judgment." },
  { letter: "P", word: "Proceed", prompt: "Continue with a little more awareness of the present moment." },
];

const GRATITUDE_PROMPTS = [
  "What's one thing that went well today, however small?",
  "Who made you smile or feel supported recently?",
  "What's something your body did well today?",
  "Name a simple pleasure you experienced this week.",
  "What's one thing in your environment you're grateful for?",
  "Who is someone you're glad to have in your life, and why?",
  "What challenge taught you something valuable recently?",
  "What made you feel calm or at ease today?",
];

// ─── Component ────────────────────────────────────────────────────────────────

export function MindfulnessScreen() {
  const { theme } = useTheme();
  const ink = theme.ink;

  const [activeSection, setActiveSection] = useState<Section | null>(null);

  function goBack() { setActiveSection(null); }

  return (
    <ScrollView
      style={{ backgroundColor: theme.page }}
      contentContainerStyle={{ padding: 16, gap: 14 }}
      keyboardShouldPersistTaps="handled"
    >
      {activeSection === null && <TileGrid theme={theme} ink={ink} onSelect={setActiveSection} />}
      {activeSection === "breathing"  && <BreathingSection  theme={theme} ink={ink} onBack={goBack} />}
      {activeSection === "grounding"  && <GroundingSection  theme={theme} ink={ink} onBack={goBack} />}
      {activeSection === "meditation" && <MeditationSection theme={theme} ink={ink} onBack={goBack} />}
      {activeSection === "gratitude"  && <GratitudeSection  theme={theme} ink={ink} onBack={goBack} />}
    </ScrollView>
  );
}

// ─── Tile grid ────────────────────────────────────────────────────────────────

function TileGrid({ theme, ink, onSelect }: { theme: any; ink: string; onSelect: (s: Section) => void }) {
  const tiles: { section: Section; emoji: string; title: string; desc: string; colorKey: string }[] = [
    { section: "breathing",  emoji: "🫁", title: "Breathing",  desc: "Box · 4-7-8 · equal",            colorKey: "teal"   },
    { section: "grounding",  emoji: "🌿", title: "Grounding",  desc: "5-4-3-2-1 · PMR · STOP",         colorKey: "coral"  },
    { section: "meditation", emoji: "⏱",  title: "Meditation", desc: "Timed quiet session",             colorKey: "purple" },
    { section: "gratitude",  emoji: "📓", title: "Gratitude",  desc: "Prompts & journaling",            colorKey: "berry"  },
  ];

  return (
    <>
      <Text style={{ color: theme.textSoft, fontSize: 13, lineHeight: 18 }}>
        Choose a practice to begin.
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {tiles.map((t) => {
          const c = theme[t.colorKey];
          return (
            <Pressable
              key={t.section}
              onPress={() => { Haptics.selectionAsync(); onSelect(t.section); }}
              style={{
                width: "47%",
                borderRadius: 14,
                borderWidth: 2,
                borderColor: ink,
                backgroundColor: c?.solid ?? ink,
                padding: 18,
                shadowColor: ink,
                shadowOffset: { width: 4, height: 4 },
                shadowOpacity: 1,
                shadowRadius: 0,
                elevation: 4,
              }}
              accessibilityRole="button"
              accessibilityLabel={t.title}
            >
              <Text style={{ fontSize: 32, marginBottom: 8 }}>{t.emoji}</Text>
              <Text style={{ color: "#fff", fontSize: 17, fontWeight: "900", marginBottom: 4 }}>{t.title}</Text>
              <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>{t.desc}</Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

// ─── Back button ──────────────────────────────────────────────────────────────

function BackBtn({ ink, onBack }: { ink: string; onBack: () => void }) {
  return (
    <Pressable
      onPress={onBack}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}
      accessibilityRole="button"
      accessibilityLabel="Back to practices"
    >
      <Text style={{ color: ink, fontSize: 18, fontWeight: "800" }}>←</Text>
      <Text style={{ color: ink, fontSize: 13, fontWeight: "700" }}>Practices</Text>
    </Pressable>
  );
}

// ─── Breathing section ────────────────────────────────────────────────────────

function BreathingSection({ theme, ink, onBack }: { theme: any; ink: string; onBack: () => void }) {
  const [pattern, setPattern] = useState<BreathPattern | null>(null);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0); // 0=inhale 1=holdIn 2=exhale 3=holdOut
  const [cycles, setCycles] = useState(0);
  const breathAnim = useRef(new Animated.Value(0.5)).current;
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const runningRef = useRef(false);

  function clearTimers() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }

  function stopSession() {
    runningRef.current = false;
    clearTimers();
    breathAnim.stopAnimation();
    breathAnim.setValue(0.5);
    setRunning(false);
    setPhase(0);
    setCycles(0);
  }

  const runCycle = useCallback(function (phases: [number, number, number, number]) {
    if (!runningRef.current) return;
    const [inh, holdIn, exh, holdOut] = phases.map((s) => s * 1000);

    setPhase(0);
    Animated.timing(breathAnim, { toValue: 1, duration: inh, useNativeDriver: true }).start();

    const t1 = holdIn > 0 ? setTimeout(() => { if (runningRef.current) { breathAnim.stopAnimation(); setPhase(1); } }, inh) : null;
    const t2 = setTimeout(() => {
      if (!runningRef.current) return;
      setPhase(2);
      Animated.timing(breathAnim, { toValue: 0.5, duration: exh, useNativeDriver: true }).start();
    }, inh + holdIn);
    const t3 = holdOut > 0 ? setTimeout(() => { if (runningRef.current) { breathAnim.stopAnimation(); setPhase(3); } }, inh + holdIn + exh) : null;
    const total = inh + holdIn + exh + holdOut;
    const t4 = setTimeout(() => {
      if (!runningRef.current) return;
      setCycles((c) => c + 1);
      Haptics.selectionAsync();
      runCycle(phases);
    }, total);

    timersRef.current = [t1, t2, t3, t4].filter(Boolean) as ReturnType<typeof setTimeout>[];
  }, [breathAnim]);

  function startSession(key: BreathPattern) {
    setPattern(key);
    stopSession();
    runningRef.current = true;
    setRunning(true);
    setCycles(0);
    setTimeout(() => runCycle(BREATH_PATTERNS[key].phases), 100);
  }

  useEffect(() => () => { runningRef.current = false; clearTimers(); }, []);

  const scaleInterp = breathAnim.interpolate({ inputRange: [0.5, 1], outputRange: [0.5, 1] });

  return (
    <>
      <BackBtn ink={ink} onBack={() => { stopSession(); onBack(); }} />
      <Text style={{ color: theme.textStrong, fontSize: 20, fontWeight: "900", marginBottom: 2 }}>Breathing</Text>

      {!running ? (
        <>
          <Text style={{ color: theme.textSoft, fontSize: 13, marginBottom: 10 }}>Choose a pattern to begin.</Text>
          {(Object.keys(BREATH_PATTERNS) as BreathPattern[]).map((key) => {
            const p = BREATH_PATTERNS[key];
            return (
              <Pressable
                key={key}
                onPress={() => startSession(key)}
                style={[styles.card, { backgroundColor: theme.teal.tint, borderColor: ink }]}
                accessibilityRole="button"
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.teal.fg, fontSize: 16, fontWeight: "800" }}>{p.label}</Text>
                  <Text style={{ color: theme.teal.sub, fontSize: 12, marginTop: 2 }}>{p.desc}</Text>
                </View>
                <Text style={{ color: theme.teal.fg, fontSize: 20 }}>▶</Text>
              </Pressable>
            );
          })}
        </>
      ) : (
        <View style={{ alignItems: "center", gap: 20, paddingVertical: 16 }}>
          <Text style={{ color: theme.textSoft, fontSize: 13, letterSpacing: 0.5 }}>
            {pattern ? BREATH_PATTERNS[pattern].label : ""}
          </Text>

          {/* Animated circle */}
          <View style={{ width: 200, height: 200, alignItems: "center", justifyContent: "center" }}>
            <Animated.View style={{ transform: [{ scale: scaleInterp }] }}>
              <View style={{
                width: 180,
                height: 180,
                borderRadius: 90,
                backgroundColor: (theme.teal as any)?.solid ?? ink,
                borderWidth: 3,
                borderColor: ink,
                shadowColor: ink,
                shadowOffset: { width: 4, height: 4 },
                shadowOpacity: 1,
                shadowRadius: 0,
                elevation: 6,
                alignItems: "center",
                justifyContent: "center",
              }}>
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 1.5 }}>
                  {PHASE_LABELS[phase]}
                </Text>
              </View>
            </Animated.View>
          </View>

          <Text style={{ color: theme.textSoft, fontSize: 13 }}>
            Cycles completed: <Text style={{ color: theme.textStrong, fontWeight: "800" }}>{cycles}</Text>
          </Text>

          <Pressable
            onPress={stopSession}
            style={[styles.endBtn, { borderColor: ink, backgroundColor: theme.card }]}
            accessibilityRole="button"
          >
            <Text style={{ color: ink, fontSize: 13, fontWeight: "800", letterSpacing: 0.5 }}>END SESSION</Text>
          </Pressable>
        </View>
      )}
    </>
  );
}

// ─── Grounding section ────────────────────────────────────────────────────────

function GroundingSection({ theme, ink, onBack }: { theme: any; ink: string; onBack: () => void }) {
  const [technique, setTechnique] = useState<GroundTechnique | null>(null);
  const [step, setStep] = useState(0);
  const [pmrPhase, setPmrPhase] = useState<"tense" | "release">("tense");
  const [countdown, setCountdown] = useState(PMR_DURATION);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  function startPmrStep(s: number, phase: "tense" | "release") {
    stopTimer();
    setStep(s);
    setPmrPhase(phase);
    setCountdown(PMR_DURATION);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          stopTimer();
          if (phase === "tense") {
            startPmrStep(s, "release");
          } else if (s + 1 < PMR_STEPS.length) {
            startPmrStep(s + 1, "tense");
          } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setTechnique(null);
          }
          return PMR_DURATION;
        }
        return c - 1;
      });
    }, 1000);
  }

  function selectTechnique(t: GroundTechnique) {
    setTechnique(t);
    setStep(0);
    setPmrPhase("tense");
    if (t === "pmr") startPmrStep(0, "tense");
  }

  function handleBack() { stopTimer(); setTechnique(null); onBack(); }

  useEffect(() => () => stopTimer(), []);

  return (
    <>
      <BackBtn ink={ink} onBack={handleBack} />
      <Text style={{ color: theme.textStrong, fontSize: 20, fontWeight: "900", marginBottom: 2 }}>Grounding</Text>

      {technique === null ? (
        <>
          <Text style={{ color: theme.textSoft, fontSize: 13, marginBottom: 10 }}>Choose a technique.</Text>
          {([
            { key: "54321", label: "5-4-3-2-1 Sensory",           desc: "Engage all five senses sequentially" },
            { key: "pmr",   label: "Progressive Muscle Relaxation", desc: "Tense and release each muscle group" },
            { key: "stop",  label: "STOP Technique",               desc: "Stop · Take a breath · Observe · Proceed" },
          ] as const).map((t) => (
            <Pressable
              key={t.key}
              onPress={() => selectTechnique(t.key)}
              style={[styles.card, { backgroundColor: (theme.coral as any)?.tint, borderColor: ink }]}
              accessibilityRole="button"
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: (theme.coral as any)?.fg, fontSize: 15, fontWeight: "800" }}>{t.label}</Text>
                <Text style={{ color: (theme.coral as any)?.sub, fontSize: 12, marginTop: 2 }}>{t.desc}</Text>
              </View>
              <Text style={{ color: (theme.coral as any)?.fg, fontSize: 20 }}>▶</Text>
            </Pressable>
          ))}
        </>
      ) : technique === "54321" ? (
        <View style={{ gap: 14 }}>
          {GROUNDING_54321.map((item, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <View
                key={i}
                style={[styles.card, {
                  borderColor: current ? ink : theme.cardBorder ?? ink,
                  backgroundColor: current ? (theme.coral as any)?.tint : theme.card,
                  opacity: done ? 0.4 : 1,
                }]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: current ? 8 : 0 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: current ? (theme.coral as any)?.solid : theme.cardBorder, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: current ? "#fff" : theme.textSoft, fontWeight: "800", fontSize: 13 }}>{item.count}</Text>
                  </View>
                  <Text style={{ color: current ? (theme.coral as any)?.fg : theme.textSoft, fontWeight: "800", fontSize: 13, letterSpacing: 0.5 }}>
                    {item.sense}
                  </Text>
                  {done && <Text style={{ color: theme.textSoft, fontSize: 16 }}>✓</Text>}
                </View>
                {current && (
                  <>
                    <Text style={{ color: (theme.coral as any)?.fg, fontSize: 15, lineHeight: 21, marginBottom: 14 }}>{item.prompt}</Text>
                    <Pressable
                      onPress={() => { Haptics.selectionAsync(); if (step + 1 < GROUNDING_54321.length) { setStep(step + 1); } else { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setTechnique(null); } }}
                      style={[styles.nextBtn, { backgroundColor: (theme.coral as any)?.solid, borderColor: ink }]}
                      accessibilityRole="button"
                    >
                      <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>
                        {step + 1 < GROUNDING_54321.length ? "NEXT →" : "DONE ✓"}
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>
            );
          })}
        </View>
      ) : technique === "pmr" ? (
        <View style={{ gap: 14 }}>
          <Text style={{ color: theme.textSoft, fontSize: 13 }}>
            {step < PMR_STEPS.length ? `Step ${step + 1} of ${PMR_STEPS.length}` : "Complete"}
          </Text>
          {step < PMR_STEPS.length && (
            <View style={[styles.card, { backgroundColor: (theme.coral as any)?.tint, borderColor: ink }]}>
              <Text style={{ color: (theme.coral as any)?.fg, fontSize: 19, fontWeight: "900", marginBottom: 6 }}>
                {PMR_STEPS[step]}
              </Text>
              <Text style={{ color: (theme.coral as any)?.sub, fontSize: 15, marginBottom: 14 }}>
                {pmrPhase === "tense" ? "Tense this area as hard as you can." : "Slowly release the tension. Notice the difference."}
              </Text>
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: (theme.coral as any)?.fg, fontSize: 42, fontWeight: "900" }}>{countdown}</Text>
                <Text style={{ color: (theme.coral as any)?.sub, fontSize: 11, letterSpacing: 0.5 }}>{pmrPhase.toUpperCase()}</Text>
              </View>
            </View>
          )}
          <Pressable onPress={() => { stopTimer(); setTechnique(null); }} style={[styles.endBtn, { borderColor: ink, backgroundColor: theme.card }]}>
            <Text style={{ color: ink, fontSize: 13, fontWeight: "800" }}>STOP</Text>
          </Pressable>
        </View>
      ) : (
        // STOP technique
        <View style={{ gap: 12 }}>
          {STOP_STEPS.map((s, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <View
                key={i}
                style={[styles.card, {
                  borderColor: current ? ink : theme.cardBorder ?? ink,
                  backgroundColor: current ? (theme.coral as any)?.tint : theme.card,
                  opacity: done ? 0.4 : 1,
                }]}
              >
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: current ? (theme.coral as any)?.solid : theme.cardBorder, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Text style={{ color: current ? "#fff" : theme.textSoft, fontWeight: "900", fontSize: 15 }}>{s.letter}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: current ? (theme.coral as any)?.fg : theme.textSoft, fontWeight: "800", fontSize: 14, marginBottom: current ? 6 : 0 }}>{s.word}</Text>
                    {current && <Text style={{ color: (theme.coral as any)?.fg, fontSize: 14, lineHeight: 20 }}>{s.prompt}</Text>}
                  </View>
                  {done && <Text style={{ color: theme.textSoft, fontSize: 16 }}>✓</Text>}
                </View>
                {current && (
                  <Pressable
                    onPress={() => { Haptics.selectionAsync(); if (step + 1 < STOP_STEPS.length) { setStep(step + 1); } else { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setTechnique(null); } }}
                    style={[styles.nextBtn, { backgroundColor: (theme.coral as any)?.solid, borderColor: ink, marginTop: 12 }]}
                  >
                    <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>
                      {step + 1 < STOP_STEPS.length ? "NEXT →" : "DONE ✓"}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}
    </>
  );
}

// ─── Meditation section ───────────────────────────────────────────────────────

const DURATIONS = [5, 10, 15, 20, 30];

function MeditationSection({ theme, ink, onBack }: { theme: any; ink: string; onBack: () => void }) {
  const [duration, setDuration] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  function startSession(mins: number) {
    stopTimer();
    setDuration(mins);
    setRemaining(mins * 60);
    setRunning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    timerRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          stopTimer();
          setRunning(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }

  function stopSession() {
    stopTimer();
    setRunning(false);
    setDuration(null);
    setRemaining(0);
  }

  useEffect(() => () => stopTimer(), []);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const fmtTime = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const done = duration !== null && remaining === 0 && !running;

  return (
    <>
      <BackBtn ink={ink} onBack={() => { stopSession(); onBack(); }} />
      <Text style={{ color: theme.textStrong, fontSize: 20, fontWeight: "900", marginBottom: 2 }}>Meditation</Text>

      {!running && !done ? (
        <>
          <Text style={{ color: theme.textSoft, fontSize: 13, marginBottom: 10 }}>Choose a duration.</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {DURATIONS.map((d) => (
              <Pressable
                key={d}
                onPress={() => startSession(d)}
                style={{
                  borderWidth: 2, borderColor: ink, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 18,
                  backgroundColor: (theme.purple as any)?.tint,
                  shadowColor: ink, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0, elevation: 2,
                }}
                accessibilityRole="button"
                accessibilityLabel={d + " minutes"}
              >
                <Text style={{ color: (theme.purple as any)?.fg, fontWeight: "900", fontSize: 18 }}>{d}</Text>
                <Text style={{ color: (theme.purple as any)?.sub, fontSize: 11 }}>min</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : done ? (
        <View style={{ alignItems: "center", gap: 16, paddingVertical: 24 }}>
          <Text style={{ fontSize: 48 }}>🎉</Text>
          <Text style={{ color: theme.textStrong, fontSize: 20, fontWeight: "900" }}>Session complete</Text>
          <Text style={{ color: theme.textSoft, fontSize: 14 }}>{duration} min meditation</Text>
          <Pressable onPress={() => setDuration(null)} style={[styles.endBtn, { borderColor: ink, backgroundColor: theme.card }]}>
            <Text style={{ color: ink, fontSize: 13, fontWeight: "800" }}>DONE</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ alignItems: "center", gap: 20, paddingVertical: 16 }}>
          <Text style={{ color: theme.textSoft, fontSize: 13 }}>{duration} min session</Text>
          <View style={{
            width: 180, height: 180, borderRadius: 90,
            backgroundColor: (theme.purple as any)?.solid,
            borderWidth: 3, borderColor: ink,
            shadowColor: ink, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 6,
            alignItems: "center", justifyContent: "center",
          }}>
            <Text style={{ color: "#fff", fontSize: 36, fontWeight: "900" }}>{fmtTime}</Text>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, letterSpacing: 0.5, marginTop: 4 }}>REMAINING</Text>
          </View>
          <Pressable onPress={stopSession} style={[styles.endBtn, { borderColor: ink, backgroundColor: theme.card }]}>
            <Text style={{ color: ink, fontSize: 13, fontWeight: "800" }}>END SESSION</Text>
          </Pressable>
        </View>
      )}
    </>
  );
}

// ─── Gratitude section ────────────────────────────────────────────────────────

function GratitudeSection({ theme, ink, onBack }: { theme: any; ink: string; onBack: () => void }) {
  const [promptIdx] = useState(() => Math.floor(Math.random() * GRATITUDE_PROMPTS.length));
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await api.logMoodMoment(5, "Grateful", text.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast("Saved to your journal.");
      setSaved(true);
      setText("");
    } catch {
      toast("Couldn't save — try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <BackBtn ink={ink} onBack={onBack} />
      <Text style={{ color: theme.textStrong, fontSize: 20, fontWeight: "900", marginBottom: 2 }}>Gratitude</Text>

      {saved ? (
        <View style={{ alignItems: "center", gap: 16, paddingVertical: 24 }}>
          <Text style={{ fontSize: 48 }}>🙏</Text>
          <Text style={{ color: theme.textStrong, fontSize: 18, fontWeight: "800", textAlign: "center" }}>Saved to your journal</Text>
          <Pressable onPress={() => setSaved(false)} style={[styles.endBtn, { borderColor: ink, backgroundColor: theme.card }]}>
            <Text style={{ color: ink, fontSize: 13, fontWeight: "800" }}>WRITE ANOTHER</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={[styles.card, { backgroundColor: (theme.berry as any)?.tint, borderColor: ink }]}>
            <Text style={{ color: (theme.berry as any)?.sub, fontSize: 10, fontWeight: "800", letterSpacing: 0.8, marginBottom: 8 }}>TODAY'S PROMPT</Text>
            <Text style={{ color: (theme.berry as any)?.fg, fontSize: 16, lineHeight: 24, fontWeight: "600" }}>
              {GRATITUDE_PROMPTS[promptIdx]}
            </Text>
          </View>

          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Write your reflection here…"
            placeholderTextColor={theme.textSoft}
            style={{
              borderWidth: 2, borderColor: ink, borderRadius: 12, padding: 14,
              fontSize: 15, minHeight: 120, color: theme.textStrong,
              backgroundColor: theme.card, textAlignVertical: "top",
              shadowColor: ink, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0, elevation: 2,
            }}
            multiline
            accessibilityLabel="Gratitude journal entry"
          />

          <Pressable
            onPress={handleSave}
            disabled={!text.trim() || saving}
            style={[styles.saveBtn, { backgroundColor: (theme.berry as any)?.solid, borderColor: ink, opacity: text.trim() ? 1 : 0.4 }]}
            accessibilityRole="button"
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800", letterSpacing: 0.5 }}>SAVE TO JOURNAL</Text>}
          </Pressable>
        </>
      )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 14,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  endBtn: {
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  nextBtn: {
    borderWidth: 2,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  saveBtn: {
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
});
