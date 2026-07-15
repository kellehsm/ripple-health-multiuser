import React, { useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import notifee from "@notifee/react-native";
import { useTheme } from "../theme/ThemeContext";
import { GOOGLE_CLIENT_ID } from "../api/client";
import { requestHealthPermissions } from "../lib/healthConnect";
WebBrowser.maybeCompleteAuthSession();

// Color-object keys in the theme (have .bg, .sub, .solid, etc.)
type AccentKey = "teal" | "coral" | "blue" | "amber" | "purple" | "berry" | "violet" | "red";

// ── Walkthrough page definitions ──────────────────────────────────────────────

const WALK_PAGES: Array<{
  emoji: string;
  label: string;
  desc: string;
  accentKey: AccentKey;
}> = [
  {
    emoji: "❤️",
    label: "HEALTH",
    desc: "Track glucose, steps, sleep, heart rate, and water — all in one place.",
    accentKey: "berry",
  },
  {
    emoji: "🍜",
    label: "MEALS",
    desc: "Log food, caffeine, and alcohol — scan a barcode or search by name.",
    accentKey: "coral",
  },
  {
    emoji: "🏠",
    label: "HOME",
    desc: "Your daily and weekly patterns, at a glance.",
    accentKey: "teal",
  },
  {
    emoji: "📖",
    label: "HOBBIES",
    desc: "Track books, hobbies, and personal goals.",
    accentKey: "teal",
  },
  {
    emoji: "💳",
    label: "FINANCE",
    desc: "See how spending connects to the rest of your day.",
    accentKey: "purple",
  },
];

type Step = "walkthrough" | "drive" | "health" | "notifications";

// ── Main component ────────────────────────────────────────────────────────────

export function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const { theme } = useTheme();
  const ink = theme.ink;
  const { width } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(ink, theme.card, width), [ink, theme.card, width]);

  const [step, setStep] = useState<Step>("walkthrough");
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const [loading, setLoading] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);

  // Advance to the next integration step (or finish)
  function advance() {
    if (step === "walkthrough") setStep("drive");
    else if (step === "drive") { setDriveError(null); setStep("health"); }
    else if (step === "health") setStep("notifications");
    else onComplete();
  }

  // ── Walkthrough navigation ────────────────────────────────────────────────

  function nextPage() {
    if (page < WALK_PAGES.length - 1) {
      const next = page + 1;
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      setPage(next);
    } else {
      setStep("drive");
    }
  }

  // ── Integration handlers ──────────────────────────────────────────────────

  async function handleDriveConnect() {
    if (!GOOGLE_CLIENT_ID) {
      setDriveError("Google Drive isn't configured — you can connect it later from Settings.");
      return;
    }
    setLoading(true);
    setDriveError(null);
    try {
      const redirectUri = "https://app.kels.gg/auth/google/callback";
      const scope = "https://www.googleapis.com/auth/drive.file";
      const authUrl =
        "https://accounts.google.com/o/oauth2/v2/auth?" +
        new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          redirect_uri: redirectUri,
          response_type: "code",
          scope,
          access_type: "offline",
          prompt: "consent",
        }).toString();

      const result = await WebBrowser.openAuthSessionAsync(authUrl, "wellnessfresh://oauth");
      if (result.type === "success" && result.url.includes("status=connected")) {
        advance();
      } else if (result.type === "success" && result.url.includes("status=error")) {
        setDriveError("Google authorization failed. Try again, or skip and connect later from Settings.");
      }
      // type === "dismiss" = user cancelled — stay on screen so they can retry or skip
    } catch (e: any) {
      setDriveError(e?.message ?? "Failed to open Google sign-in.");
    } finally {
      setLoading(false);
    }
  }

  async function handleHealthConnect() {
    setLoading(true);
    try {
      await requestHealthPermissions();
    } catch {
      // ignore; advance regardless
    } finally {
      setLoading(false);
      advance();
    }
  }

  async function handleNotifications() {
    setLoading(true);
    try {
      await notifee.requestPermission();
    } catch {
      // ignore; advance regardless
    } finally {
      setLoading(false);
      advance();
    }
  }

  // ── Walkthrough screen ────────────────────────────────────────────────────

  if (step === "walkthrough") {
    return (
      <View style={[styles.screen, { backgroundColor: theme.page }]}>
        {/* Skip tour link */}
        <View style={styles.topBar}>
          <Pressable onPress={() => setStep("drive")} hitSlop={12} style={styles.skipTouchable}>
            <Text style={[styles.skipText, { color: theme.textSoft }]}>Skip tour</Text>
          </Pressable>
        </View>

        {/* Pill-dot progress indicator */}
        <View style={styles.dots}>
          {WALK_PAGES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === page ? ink : theme.cardBorder,
                  width: i === page ? 22 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Paged walkthrough */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={32}
          onMomentumScrollEnd={(e) => {
            setPage(Math.round(e.nativeEvent.contentOffset.x / width));
          }}
          style={{ flex: 1 }}
        >
          {WALK_PAGES.map((p, i) => {
            const accent = theme[p.accentKey] as any;
            return (
              <View key={i} style={[styles.walkthroughPage, { width }]}>
                <View style={[styles.bigEmojiBlock, { backgroundColor: accent.bg, borderColor: ink }]}>
                  <Text style={styles.bigEmoji}>{p.emoji}</Text>
                </View>
                <Text style={[styles.pageLabel, { color: accent.sub }]}>{p.label}</Text>
                <Text style={[styles.pageDesc, { color: theme.textStrong }]}>{p.desc}</Text>
              </View>
            );
          })}
        </ScrollView>

        <View style={[styles.bottom, { borderTopColor: theme.cardBorder }]}>
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: ink, borderColor: ink }]}
            onPress={nextPage}
          >
            <Text style={[styles.primaryBtnText, { color: theme.page }]}>
              {page === WALK_PAGES.length - 1 ? "Get started  →" : "Next  →"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Integration step configs ──────────────────────────────────────────────

  type StepCfg = {
    emoji: string;
    accentKey: AccentKey;
    title: string;
    body: React.ReactNode;
    primaryLabel: string;
    primaryAction: () => void;
  };

  const stepCfg: Record<Exclude<Step, "walkthrough">, StepCfg> = {
    drive: {
      emoji: "🗂️",
      accentKey: "teal",
      title: "Back up your data",
      body: (
        <>
          <Text style={[styles.stepDesc, { color: theme.textStrong }]}>
            Ripple Health can automatically back up your data — glucose, meals, mood, spending, and more —
            to{" "}
            <Text style={{ fontWeight: "700" }}>your own Google Drive</Text>
            {" "}so you never lose your history.
          </Text>

          {/* Prominent decline disclosure — not buried */}
          <View style={[styles.disclosureBox, { backgroundColor: theme.page, borderColor: ink }]}>
            <Text style={[styles.disclosureLabel, { color: theme.textSoft }]}>IF YOU SKIP</Text>
            <Text style={[styles.disclosureText, { color: theme.textStrong }]}>
              Automatic backups won't happen. You can still export your data manually at any time from Settings.
            </Text>
          </View>

          {driveError ? (
            <Text style={[styles.errorText, { color: theme.coral.sub }]}>{driveError}</Text>
          ) : null}
        </>
      ),
      primaryLabel: "Connect Google Drive",
      primaryAction: handleDriveConnect,
    },
    health: {
      emoji: "🏃",
      accentKey: "berry",
      title: "Connect Health Connect",
      body: (
        <Text style={[styles.stepDesc, { color: theme.textStrong }]}>
          Automatically track your steps, sleep, and heart rate from Android's Health Connect.
          {"\n\n"}
          When you tap Connect, Android will open a system permissions dialog where you can choose exactly what to allow.
          {"\n\n"}
          You can also connect or adjust this later from Settings.
        </Text>
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
          <Text style={[styles.stepDesc, { color: theme.textStrong }]}>
            Notifications are used for:
          </Text>
          <View style={{ marginTop: 12, gap: 8 }}>
            {[
              "Mood check-in reminders (morning, afternoon, evening)",
              "An optional persistent notification showing live glucose and steps",
            ].map((item, i) => (
              <View key={i} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                <View style={[styles.bulletDot, { backgroundColor: (theme.amber as any).solid }]} />
                <Text style={[styles.bulletText, { color: theme.textStrong }]}>{item}</Text>
              </View>
            ))}
          </View>
          <Text style={[styles.stepDescSmall, { color: theme.textSoft, marginTop: 16 }]}>
            Tapping Connect opens Android's permission dialog. You can adjust what's enabled from Settings at any time.
          </Text>
        </>
      ),
      primaryLabel: "Enable notifications",
      primaryAction: handleNotifications,
    },
  };

  const cfg = stepCfg[step as Exclude<Step, "walkthrough">];
  const accent = theme[cfg.accentKey] as any;

  // ── Integration step screen ───────────────────────────────────────────────

  return (
    <View style={[styles.screen, { backgroundColor: theme.page }]}>
      {/* Card fills the middle */}
      <View style={[styles.stepCard, { backgroundColor: theme.card, borderColor: ink }]}>
        <View style={[styles.stepEmojiBlock, { backgroundColor: accent.bg, borderColor: ink }]}>
          <Text style={styles.stepEmoji}>{cfg.emoji}</Text>
        </View>
        <Text style={[styles.stepTitle, { color: theme.textStrong }]}>{cfg.title}</Text>
        {cfg.body}
      </View>

      {/* Equal-weight primary + secondary buttons */}
      <View style={[styles.bottom, { borderTopColor: theme.cardBorder }]}>
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: accent.solid, borderColor: ink }]}
          onPress={cfg.primaryAction}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>{cfg.primaryLabel}</Text>
          )}
        </Pressable>

        {/* "Not now" is the SAME size and border weight as the primary — no dark patterns */}
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

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(ink: string, card: string, _width: number) {
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
    topBar: {
      flexDirection: "row",
      justifyContent: "flex-end",
      paddingHorizontal: 20,
      paddingBottom: 6,
    },
    skipTouchable: { padding: 8 },
    skipText: { fontSize: 14 },

    dots: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 6,
      paddingBottom: 24,
    },
    dot: { height: 8, borderRadius: 4 },

    walkthroughPage: {
      paddingHorizontal: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    bigEmojiBlock: {
      width: 130,
      height: 130,
      borderRadius: 32,
      borderWidth: 3,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 32,
      ...shadow,
    },
    bigEmoji: { fontSize: 58 },
    pageLabel: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.4,
      marginBottom: 12,
    },
    pageDesc: {
      fontSize: 19,
      fontWeight: "500",
      textAlign: "center",
      lineHeight: 28,
    },

    // ── Shared bottom area ──
    bottom: {
      padding: 20,
      gap: 12,
      borderTopWidth: 1,
    },
    primaryBtn: {
      borderRadius: 14,
      borderWidth: 2,
      paddingVertical: 15,
      alignItems: "center",
      shadowColor: ink,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 4,
    },
    primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 15, letterSpacing: 0.2 },
    secondaryBtn: {
      borderRadius: 14,
      borderWidth: 2,
      paddingVertical: 13,
      alignItems: "center",
      shadowColor: ink,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 4,
    },
    secondaryBtnText: { fontWeight: "800", fontSize: 15, letterSpacing: 0.2 },

    // ── Integration step card ──
    stepCard: {
      margin: 20,
      flex: 1,
      borderRadius: 16,
      borderWidth: 2,
      padding: 24,
      ...shadow,
    },
    stepEmojiBlock: {
      width: 88,
      height: 88,
      borderRadius: 22,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
      alignSelf: "center",
      shadowColor: ink,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 4,
    },
    stepEmoji: { fontSize: 40 },
    stepTitle: {
      fontSize: 24,
      fontWeight: "800",
      textAlign: "center",
      marginBottom: 16,
    },
    stepDesc: { fontSize: 15, lineHeight: 24 },
    stepDescSmall: { fontSize: 13, lineHeight: 20 },

    disclosureBox: {
      marginTop: 16,
      borderRadius: 12,
      borderWidth: 2,
      padding: 14,
      gap: 4,
    },
    disclosureLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
    disclosureText: { fontSize: 13, lineHeight: 20, fontWeight: "500" },

    errorText: { fontSize: 13, marginTop: 10, lineHeight: 19 },

    bulletDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      marginTop: 7,
      flexShrink: 0,
    },
    bulletText: { flex: 1, fontSize: 15, lineHeight: 23 },
  });
}
