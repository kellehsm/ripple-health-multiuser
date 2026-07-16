import React, { useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  useWindowDimensions,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import notifee from "@notifee/react-native";
import { useTheme } from "../theme/ThemeContext";
import { GOOGLE_CLIENT_ID, api } from "../api/client";
import { getUserId } from "../lib/auth";
import { requestHealthPermissions } from "../lib/healthConnect";
import { PALETTES, PALETTE_GROUPS } from "../theme/palettes";
WebBrowser.maybeCompleteAuthSession();

type AccentKey = "teal" | "coral" | "blue" | "amber" | "purple" | "berry" | "violet" | "red";

type Step = "walkthrough" | "theme" | "drive" | "dexcom" | "health" | "notifications";

// ── Walkthrough page definitions ──────────────────────────────────────────────

const WALK_PAGES: Array<{
  emoji: string;
  label: string;
  desc: string;
  accentKey: AccentKey;
  preview: React.ReactNode;
}> = [
  {
    emoji: "❤️",
    label: "HEALTH",
    desc: "Track glucose, steps, sleep, and heart rate — all in one place.",
    accentKey: "berry",
    preview: null, // filled below after component defs
  },
  {
    emoji: "🍜",
    label: "MEALS",
    desc: "Log food, caffeine, and alcohol — scan a barcode or search by name.",
    accentKey: "coral",
    preview: null,
  },
  {
    emoji: "📖",
    label: "HOBBIES",
    desc: "Track books, hobbies, and personal goals.",
    accentKey: "teal",
    preview: null,
  },
  {
    emoji: "🏠",
    label: "HOME",
    desc: "Your daily and weekly patterns — insights without noise.",
    accentKey: "teal",
    preview: null,
  },
  {
    emoji: "💳",
    label: "FINANCE",
    desc: "See how spending connects to the rest of your day.",
    accentKey: "purple",
    preview: null,
  },
];

// ── Main component ────────────────────────────────────────────────────────────

export function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const { theme, paletteId, setPalette } = useTheme();
  const ink = theme.ink;
  const { width } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(ink, theme.card, theme.cardBorder, width), [ink, theme.card, theme.cardBorder, width]);

  const [step, setStep] = useState<Step>("walkthrough");
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const [loading, setLoading] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [dexcomAccountId, setDexcomAccountId] = useState("");
  const [dexcomPassword, setDexcomPassword] = useState("");
  const [dexcomRegion, setDexcomRegion] = useState<"us" | "ous">("us");
  const [dexcomError, setDexcomError] = useState<string | null>(null);

  function advance() {
    if (step === "walkthrough") setStep("theme");
    else if (step === "theme") setStep("drive");
    else if (step === "drive") { setDriveError(null); setStep("dexcom"); }
    else if (step === "dexcom") { setDexcomError(null); setStep("health"); }
    else if (step === "health") setStep("notifications");
    else onComplete();
  }

  function nextPage() {
    if (page < WALK_PAGES.length - 1) {
      const next = page + 1;
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      setPage(next);
    } else {
      setStep("theme");
    }
  }

  async function handleDriveConnect() {
    if (!GOOGLE_CLIENT_ID) {
      setDriveError("Google Drive isn't configured — connect it later from Settings.");
      return;
    }
    setLoading(true);
    setDriveError(null);
    try {
      const userId = await getUserId();
      if (!userId) {
        setDriveError("Could not determine user ID. Please log out and back in.");
        return;
      }
      const redirectUri = "https://app.kels.gg/auth/google/callback";
      const authUrl =
        "https://accounts.google.com/o/oauth2/v2/auth?" +
        new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          redirect_uri: redirectUri,
          response_type: "code",
          scope: "https://www.googleapis.com/auth/drive.file",
          access_type: "offline",
          prompt: "consent",
          state: userId,
        }).toString();

      const result = await WebBrowser.openAuthSessionAsync(authUrl, "wellnessfresh://oauth");
      if (result.type === "success" && result.url.includes("status=connected")) {
        advance();
      } else if (result.type === "success" && result.url.includes("status=error")) {
        setDriveError("Google authorization failed. Try again, or skip to connect later.");
      }
    } catch (e: any) {
      setDriveError(e?.message ?? "Failed to open Google sign-in.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDexcomSave() {
    const id = dexcomAccountId.trim();
    const pw = dexcomPassword.trim();
    if (!id || !pw) {
      setDexcomError("Enter your Dexcom Share Account ID and password.");
      return;
    }
    setLoading(true);
    setDexcomError(null);
    try {
      await api.patchSettings({ dexcom: { share_account_id: id, share_password: pw, share_region: dexcomRegion } });
      advance();
    } catch (e: any) {
      setDexcomError(e?.message ?? "Failed to save credentials. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleHealthConnect() {
    setLoading(true);
    try { await requestHealthPermissions(); } catch { }
    finally { setLoading(false); advance(); }
  }

  async function handleNotifications() {
    setLoading(true);
    try { await notifee.requestPermission(); } catch { }
    finally { setLoading(false); advance(); }
  }

  // ── Walkthrough previews (themed) ────────────────────────────────────────────

  function HealthPreview() {
    const chips = [
      { label: "Glucose", value: "142", unit: "mg/dL", sub: "stable", color: theme.berry.solid },
      { label: "Steps", value: "6,234", unit: "steps", sub: "today", color: theme.teal.solid },
      { label: "Sleep", value: "7h 12m", unit: "", sub: "last night", color: theme.amber.solid },
      { label: "Heart rate", value: "68", unit: "bpm", sub: "resting", color: theme.red.solid },
    ];
    return (
      <View style={styles.preview}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {chips.map((c) => (
            <View key={c.label} style={[styles.statChip, { backgroundColor: theme.card, borderColor: c.color }]}>
              <View style={[styles.statChipDot, { backgroundColor: c.color }]} />
              <Text style={[styles.statChipValue, { color: ink }]}>{c.value}<Text style={styles.statChipUnit}> {c.unit}</Text></Text>
              <Text style={[styles.statChipSub, { color: theme.textSoft }]}>{c.sub}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  function MealsPreview() {
    const rows = [
      { name: "Oatmeal with berries", type: "Breakfast", cal: "312 cal", color: theme.teal.solid },
      { name: "Chicken salad wrap", type: "Lunch", cal: "480 cal", color: theme.coral.solid },
    ];
    return (
      <View style={styles.preview}>
        {rows.map((r) => (
          <View key={r.name} style={[styles.mealRow, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={[styles.mealDot, { backgroundColor: r.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.mealName, { color: ink }]} numberOfLines={1}>{r.name}</Text>
              <Text style={[styles.mealMeta, { color: theme.textSoft }]}>{r.type}  ·  {r.cal}</Text>
            </View>
          </View>
        ))}
        <View style={[styles.substanceBadge, { backgroundColor: theme.coral.bg, borderColor: theme.coral.sub }]}>
          <Text style={[styles.substanceBadgeText, { color: theme.coral.sub }]}>☕  95 mg caffeine</Text>
        </View>
      </View>
    );
  }

  function HobbiesPreview() {
    return (
      <View style={styles.preview}>
        <View style={[styles.bookCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.bookTitle, { color: ink }]}>The Pragmatic Programmer</Text>
          <Text style={[styles.bookAuthor, { color: theme.textSoft }]}>Andrew Hunt & David Thomas</Text>
          <View style={[styles.progressTrack, { backgroundColor: theme.cardBorder }]}>
            <View style={[styles.progressFill, { backgroundColor: theme.teal.solid, width: "45%" }]} />
          </View>
          <Text style={[styles.progressLabel, { color: theme.textSoft }]}>45% · 175 / 390 pages</Text>
        </View>
        <View style={[styles.hobbyRow, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={[styles.hobbyIcon, { backgroundColor: theme.coral.bg }]}>
            <Text style={{ fontSize: 18 }}>🏃</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.hobbyName, { color: ink }]}>Running</Text>
            <Text style={[styles.hobbyMeta, { color: theme.textSoft }]}>4.2 km this week</Text>
          </View>
        </View>
      </View>
    );
  }

  // ── Walkthrough screen ────────────────────────────────────────────────────────

  if (step === "walkthrough") {
    const previews: React.ReactNode[] = [
      <HealthPreview key="h" />,
      <MealsPreview key="m" />,
      <HobbiesPreview key="ho" />,
      null,
      null,
    ];

    return (
      <View style={[styles.screen, { backgroundColor: theme.page }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => setStep("theme")} hitSlop={12} style={styles.skipTouchable}>
            <Text style={[styles.skipText, { color: theme.textSoft }]}>Skip tour</Text>
          </Pressable>
        </View>

        <View style={styles.dots}>
          {WALK_PAGES.map((_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i === page ? ink : theme.cardBorder, width: i === page ? 22 : 8 }]} />
          ))}
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={32}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          style={{ flex: 1 }}
        >
          {WALK_PAGES.map((p, i) => {
            const accent = theme[p.accentKey] as any;
            return (
              <ScrollView key={i} style={{ width }} contentContainerStyle={styles.walkthroughPage} showsVerticalScrollIndicator={false}>
                <View style={[styles.bigEmojiBlock, { backgroundColor: accent.bg, borderColor: ink }]}>
                  <Text style={styles.bigEmoji}>{p.emoji}</Text>
                </View>
                <Text style={[styles.pageLabel, { color: accent.sub }]}>{p.label}</Text>
                <Text style={[styles.pageDesc, { color: theme.textStrong }]}>{p.desc}</Text>
                {previews[i] ?? null}
              </ScrollView>
            );
          })}
        </ScrollView>

        <View style={[styles.bottom, { borderTopColor: theme.cardBorder }]}>
          <Pressable style={[styles.primaryBtn, { backgroundColor: ink, borderColor: ink }]} onPress={nextPage}>
            <Text style={[styles.primaryBtnText, { color: theme.page }]}>
              {page === WALK_PAGES.length - 1 ? "Get started  →" : "Next  →"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Theme picker step ─────────────────────────────────────────────────────────

  if (step === "theme") {
    const currentPalette = PALETTES[paletteId];
    return (
      <View style={[styles.screen, { backgroundColor: theme.page }]}>
        <View style={styles.themeHeader}>
          <Text style={[styles.stepTitle, { color: ink }]}>Choose your look</Text>
          <Text style={[styles.themeSubtitle, { color: theme.textSoft }]}>
            Change any time from Settings → Appearance
          </Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.themeGrid} showsVerticalScrollIndicator={false}>
          {Object.entries(PALETTE_GROUPS).map(([group, ids]) => (
            <View key={group}>
              <Text style={[styles.themeGroupLabel, { color: theme.textSoft }]}>{group.toUpperCase()}</Text>
              <View style={styles.themeRow}>
                {ids.map((id) => {
                  const p = PALETTES[id];
                  const selected = id === paletteId;
                  return (
                    <Pressable
                      key={id}
                      onPress={() => setPalette(id)}
                      style={[
                        styles.themeCard,
                        { backgroundColor: p.card, borderColor: selected ? p.teal.solid : p.cardBorder },
                        selected && { borderWidth: 3 },
                      ]}
                    >
                      <View style={styles.swatchRow}>
                        {[p.ink, p.page, p.teal.solid, p.coral.solid, p.berry.solid].map((c, ci) => (
                          <View key={ci} style={[styles.swatch, { backgroundColor: c }]} />
                        ))}
                      </View>
                      <Text style={[styles.themeCardName, { color: p.ink }]} numberOfLines={1}>{p.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={[styles.bottom, { borderTopColor: theme.cardBorder }]}>
          <Pressable style={[styles.primaryBtn, { backgroundColor: theme.teal.solid, borderColor: ink }]} onPress={advance}>
            <Text style={styles.primaryBtnText}>Use {currentPalette?.name ?? "this theme"}  →</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Integration step configs ──────────────────────────────────────────────────

  type StepCfg = {
    emoji: string;
    accentKey: AccentKey;
    title: string;
    body: React.ReactNode;
    primaryLabel: string;
    primaryAction: () => void;
    skipLabel?: string;
  };

  const stepCfg: Record<Exclude<Step, "walkthrough" | "theme">, StepCfg> = {
    drive: {
      emoji: "🗂️",
      accentKey: "teal",
      title: "Back up your data",
      body: (
        <>
          <Text style={[styles.stepDesc, { color: theme.textStrong }]}>
            Ripple can automatically back up your glucose, meals, mood, spending, and more to{" "}
            <Text style={{ fontWeight: "700" }}>your own Google Drive</Text> so you never lose your history.
          </Text>
          <View style={[styles.disclosureBox, { backgroundColor: theme.page, borderColor: ink }]}>
            <Text style={[styles.disclosureLabel, { color: theme.textSoft }]}>IF YOU SKIP</Text>
            <Text style={[styles.disclosureText, { color: theme.textStrong }]}>
              Automatic backups won't happen. You can export manually at any time from Settings.
            </Text>
          </View>
          {driveError ? <Text style={[styles.errorText, { color: theme.danger }]}>{driveError}</Text> : null}
        </>
      ),
      primaryLabel: "Connect Google Drive",
      primaryAction: handleDriveConnect,
    },
    dexcom: {
      emoji: "📡",
      accentKey: "berry",
      title: "Connect Dexcom CGM",
      body: (
        <>
          <Text style={[styles.stepDesc, { color: theme.textStrong }]}>
            Connect your Dexcom Share account to see live glucose readings in Ripple.
          </Text>

          <Text style={[styles.inputLabel, { color: ink }]}>Account ID</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.card, borderColor: theme.cardBorder, color: theme.textStrong }]}
            value={dexcomAccountId}
            onChangeText={setDexcomAccountId}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            placeholderTextColor={theme.textSoft}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={[styles.inputLabel, { color: ink }]}>Share Password</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.card, borderColor: theme.cardBorder, color: theme.textStrong }]}
            value={dexcomPassword}
            onChangeText={setDexcomPassword}
            placeholder="Share password"
            placeholderTextColor={theme.textSoft}
            secureTextEntry
          />

          <View style={styles.regionToggle}>
            {(["us", "ous"] as const).map((r) => (
              <Pressable
                key={r}
                onPress={() => setDexcomRegion(r)}
                style={[
                  styles.regionBtn,
                  { borderColor: ink, backgroundColor: dexcomRegion === r ? ink : theme.card },
                ]}
              >
                <Text style={[styles.regionBtnText, { color: dexcomRegion === r ? theme.page : ink }]}>
                  {r === "us" ? "United States" : "Outside US"}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={() => WebBrowser.openBrowserAsync("https://www.dexcom.com/faqs/how-do-i-find-my-account-id")}>
            <Text style={[styles.helpLink, { color: theme.teal.solid }]}>Where do I find my Account ID?</Text>
          </Pressable>

          {dexcomError ? <Text style={[styles.errorText, { color: theme.danger }]}>{dexcomError}</Text> : null}
        </>
      ),
      primaryLabel: "Save & connect",
      primaryAction: handleDexcomSave,
    },
    health: {
      emoji: "🏃",
      accentKey: "berry",
      title: "Connect Health Connect",
      body: (
        <>
          <Text style={[styles.stepDesc, { color: theme.textStrong }]}>
            Automatically sync steps, sleep, and heart rate from Android's Health Connect.
          </Text>
          <View style={{ marginTop: 14, gap: 10 }}>
            {["Steps — daily totals and week-over-week trends", "Sleep — duration and schedule", "Heart rate — resting BPM and daily patterns"].map((item, i) => (
              <View key={i} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                <View style={[styles.bulletDot, { backgroundColor: theme.berry.solid }]} />
                <Text style={[styles.bulletText, { color: theme.textStrong }]}>{item}</Text>
              </View>
            ))}
          </View>
          <Text style={[styles.stepDescSmall, { color: theme.textSoft, marginTop: 14 }]}>
            Android will open a system permissions dialog. You choose exactly what to allow.
          </Text>
        </>
      ),
      primaryLabel: "Connect Health Connect",
      primaryAction: handleHealthConnect,
    },
    notifications: {
      emoji: "🔔",
      accentKey: "amber",
      title: "Stay in the loop",
      body: (
        <>
          <Text style={[styles.stepDesc, { color: theme.textStrong }]}>Notifications are used for:</Text>
          <View style={{ marginTop: 12, gap: 8 }}>
            {[
              "Mood check-in reminders (morning, afternoon, evening)",
              "An optional persistent notification showing live glucose and steps",
            ].map((item, i) => (
              <View key={i} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                <View style={[styles.bulletDot, { backgroundColor: theme.amber.solid }]} />
                <Text style={[styles.bulletText, { color: theme.textStrong }]}>{item}</Text>
              </View>
            ))}
          </View>
          <Text style={[styles.stepDescSmall, { color: theme.textSoft, marginTop: 16 }]}>
            You can adjust what's enabled from Settings at any time.
          </Text>
        </>
      ),
      primaryLabel: "Enable notifications",
      primaryAction: handleNotifications,
    },
  };

  const cfg = stepCfg[step as Exclude<Step, "walkthrough" | "theme">];
  const accent = theme[cfg.accentKey] as any;

  return (
    <View style={[styles.screen, { backgroundColor: theme.page }]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.stepCard, { backgroundColor: theme.card, borderColor: ink }]}>
          <View style={[styles.stepEmojiBlock, { backgroundColor: accent.bg, borderColor: ink }]}>
            <Text style={styles.stepEmoji}>{cfg.emoji}</Text>
          </View>
          <Text style={[styles.stepTitle, { color: theme.textStrong }]}>{cfg.title}</Text>
          {cfg.body}
        </View>
      </ScrollView>

      <View style={[styles.bottom, { borderTopColor: theme.cardBorder }]}>
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: accent.solid, borderColor: ink }]}
          onPress={cfg.primaryAction}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{cfg.primaryLabel}</Text>}
        </Pressable>
        <Pressable
          style={[styles.secondaryBtn, { backgroundColor: theme.card, borderColor: ink }]}
          onPress={advance}
          disabled={loading}
        >
          <Text style={[styles.secondaryBtnText, { color: ink }]}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

function makeStyles(ink: string, card: string, cardBorder: string, _width: number) {
  const shadow = {
    shadowColor: ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1 as const,
    shadowRadius: 0,
    elevation: 6,
  };

  return StyleSheet.create({
    screen: { flex: 1, paddingTop: 52 },

    // ── Walkthrough ──
    topBar: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 20, paddingBottom: 6 },
    skipTouchable: { padding: 8 },
    skipText: { fontSize: 14 },
    dots: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, paddingBottom: 20 },
    dot: { height: 8, borderRadius: 4 },
    walkthroughPage: { paddingHorizontal: 28, alignItems: "center", paddingBottom: 24 },
    bigEmojiBlock: { width: 110, height: 110, borderRadius: 28, borderWidth: 3, alignItems: "center", justifyContent: "center", marginBottom: 24, ...shadow },
    bigEmoji: { fontSize: 50 },
    pageLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4, marginBottom: 8 },
    pageDesc: { fontSize: 17, fontWeight: "500", textAlign: "center", lineHeight: 26, marginBottom: 20 },

    // ── Preview components ──
    preview: { width: "100%", gap: 10 },
    statChip: { flex: 1, minWidth: "45%", borderRadius: 12, borderWidth: 2, padding: 12, gap: 2 },
    statChipDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },
    statChipValue: { fontSize: 18, fontWeight: "800" },
    statChipUnit: { fontSize: 12, fontWeight: "500" },
    statChipSub: { fontSize: 11 },
    mealRow: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, padding: 12, gap: 12 },
    mealDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
    mealName: { fontSize: 14, fontWeight: "700" },
    mealMeta: { fontSize: 12, marginTop: 2 },
    substanceBadge: { alignSelf: "flex-start", borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
    substanceBadgeText: { fontSize: 13, fontWeight: "700" },
    bookCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 4 },
    bookTitle: { fontSize: 14, fontWeight: "800" },
    bookAuthor: { fontSize: 12, marginBottom: 8 },
    progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
    progressFill: { height: 6, borderRadius: 3 },
    progressLabel: { fontSize: 11, marginTop: 4 },
    hobbyRow: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, padding: 12, gap: 12 },
    hobbyIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    hobbyName: { fontSize: 14, fontWeight: "700" },
    hobbyMeta: { fontSize: 12, marginTop: 2 },

    // ── Theme picker ──
    themeHeader: { paddingHorizontal: 24, paddingBottom: 16 },
    themeSubtitle: { fontSize: 14, marginTop: 6 },
    themeGrid: { paddingHorizontal: 20, paddingBottom: 24, gap: 20 },
    themeGroupLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2, marginBottom: 10 },
    themeRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    themeCard: { width: "46%", borderRadius: 12, borderWidth: 2, padding: 12, gap: 8 },
    swatchRow: { flexDirection: "row", gap: 4 },
    swatch: { flex: 1, height: 14, borderRadius: 4 },
    themeCardName: { fontSize: 13, fontWeight: "700" },

    // ── Shared bottom ──
    bottom: { padding: 20, gap: 12, borderTopWidth: 1 },
    primaryBtn: { borderRadius: 14, borderWidth: 2, paddingVertical: 15, alignItems: "center", shadowColor: ink, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
    primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 15, letterSpacing: 0.2 },
    secondaryBtn: { borderRadius: 14, borderWidth: 2, paddingVertical: 13, alignItems: "center", shadowColor: ink, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
    secondaryBtnText: { fontWeight: "800", fontSize: 15, letterSpacing: 0.2 },

    // ── Integration step card ──
    stepCard: { margin: 20, borderRadius: 16, borderWidth: 2, padding: 24, ...shadow },
    stepEmojiBlock: { width: 88, height: 88, borderRadius: 22, borderWidth: 2, alignItems: "center", justifyContent: "center", marginBottom: 20, alignSelf: "center", shadowColor: ink, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
    stepEmoji: { fontSize: 40 },
    stepTitle: { fontSize: 24, fontWeight: "800", textAlign: "center", marginBottom: 16 },
    stepDesc: { fontSize: 15, lineHeight: 24 },
    stepDescSmall: { fontSize: 13, lineHeight: 20 },

    // ── Dexcom inputs ──
    inputLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginTop: 14, marginBottom: 6 },
    input: { borderWidth: 2, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
    regionToggle: { flexDirection: "row", gap: 10, marginTop: 14 },
    regionBtn: { flex: 1, borderRadius: 10, borderWidth: 2, paddingVertical: 10, alignItems: "center" },
    regionBtnText: { fontWeight: "700", fontSize: 14 },
    helpLink: { fontSize: 13, fontWeight: "600", marginTop: 12, textDecorationLine: "underline" },

    // ── Disclosure box ──
    disclosureBox: { marginTop: 16, borderRadius: 12, borderWidth: 2, padding: 14, gap: 4 },
    disclosureLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
    disclosureText: { fontSize: 13, lineHeight: 20, fontWeight: "500" },

    errorText: { fontSize: 13, marginTop: 10, lineHeight: 19 },
    bulletDot: { width: 7, height: 7, borderRadius: 4, marginTop: 7, flexShrink: 0 },
    bulletText: { flex: 1, fontSize: 15, lineHeight: 23 },
  });
}
