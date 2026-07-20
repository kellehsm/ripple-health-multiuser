import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Animated,
  Easing,
} from "react-native";
import { LoadingIndicator } from "../components/LoadingIndicator";
import { LoginLogo } from "../components/LoginLogo";
import { api } from "../api/client";
import { setToken } from "../lib/auth";
import { useTheme } from "../theme/ThemeContext";

interface Props {
  onLoginSuccess: () => void;
  onShowSignup: () => void;
}

export function LoginScreen({ onLoginSuccess, onShowSignup }: Props) {
  const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Blob drift animations ──────────────────────────────────────────────────
  const blob1X = useRef(new Animated.Value(0)).current;
  const blob1Y = useRef(new Animated.Value(0)).current;
  const blob2X = useRef(new Animated.Value(0)).current;
  const blob2Y = useRef(new Animated.Value(0)).current;
  const blob3X = useRef(new Animated.Value(0)).current;
  const blob3Y = useRef(new Animated.Value(0)).current;
  const blob4X = useRef(new Animated.Value(0)).current;
  const blob4Y = useRef(new Animated.Value(0)).current;

  // ── Entrance animations ────────────────────────────────────────────────────
  const ELEM = 6;
  const fadeAnims = useRef(Array.from({ length: ELEM }, () => new Animated.Value(0))).current;
  const slideAnims = useRef(Array.from({ length: ELEM }, () => new Animated.Value(16))).current;

  useEffect(() => {
    // Blob drift loops
    const blobCfgs = [
      { x: blob1X, y: blob1Y, xTo: 35, yTo: -25, dur: 11000 },
      { x: blob2X, y: blob2Y, xTo: -28, yTo: 32, dur: 9500 },
      { x: blob3X, y: blob3Y, xTo: 20, yTo: 18, dur: 13000 },
      { x: blob4X, y: blob4Y, xTo: -22, yTo: -30, dur: 10500 },
    ];
    blobCfgs.forEach((cfg, i) => {
      const delay = i * 800;
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(cfg.x, { toValue: cfg.xTo, duration: cfg.dur, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
            Animated.timing(cfg.y, { toValue: cfg.yTo, duration: cfg.dur, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
          ]),
          Animated.parallel([
            Animated.timing(cfg.x, { toValue: 0, duration: cfg.dur, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
            Animated.timing(cfg.y, { toValue: 0, duration: cfg.dur, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
          ]),
        ])
      ).start();
    });

    // Staggered entrance
    Animated.stagger(
      90,
      fadeAnims.map((f, i) =>
        Animated.parallel([
          Animated.timing(f, { toValue: 1, duration: 380, useNativeDriver: true }),
          Animated.timing(slideAnims[i], { toValue: 0, duration: 380, useNativeDriver: true }),
        ])
      )
    ).start();
  }, []);

  async function handleLogin() {
    setError(null);
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.login(trimmedEmail, password);
      if (!res.token) throw new Error("No token received");
      await setToken(res.token);
      onLoginSuccess();
    } catch (err: any) {
      const msg = err?.message ?? "";
      if (msg.includes("401") || msg.includes("Invalid")) {
        setError("Incorrect email or password.");
      } else {
        setError("Couldn't connect. Check your network and try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.page ?? "#F5F1E8" }}>
      {/* Background blobs */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {[
          { anim: blob1X, animY: blob1Y, size: 140, top: -30, left: -40, color: "#A62A50" },
          { anim: blob2X, animY: blob2Y, size: 110, top: 160, right: -30, color: "#E8654E" },
          { anim: blob3X, animY: blob3Y, size: 160, bottom: 100, left: -50, color: "#A62A50" },
          { anim: blob4X, animY: blob4Y, size: 100, bottom: 120, right: 20, color: "#E8654E" },
        ].map((b, i) => (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              width: b.size,
              height: b.size,
              borderRadius: b.size / 2,
              backgroundColor: b.color,
              opacity: 0.07,
              top: (b as any).top,
              left: (b as any).left,
              bottom: (b as any).bottom,
              right: (b as any).right,
              transform: [{ translateX: b.anim }, { translateY: b.animY }],
            }}
          />
        ))}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 28, paddingVertical: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo — SVG droplet with animated pulse line, no background */}
          <Animated.View
            style={{ alignItems: "center", marginBottom: 32, opacity: fadeAnims[0], transform: [{ translateY: slideAnims[0] }] }}
          >
            <LoginLogo />
          </Animated.View>

          {/* Title */}
          <Animated.View
            style={{ alignItems: "center", marginBottom: 32, opacity: fadeAnims[1], transform: [{ translateY: slideAnims[1] }] }}
          >
            <Text style={{ fontSize: 30, fontWeight: "900", color: theme.textStrong ?? "#111", letterSpacing: -0.5 }}>
              Ripple Wellness
            </Text>
            <Text style={{ fontSize: 15, color: theme.textSoft ?? "#888", marginTop: 6 }}>
              See how it all connects
            </Text>
          </Animated.View>

          {/* Email field */}
          <Animated.View style={{ marginBottom: 14, opacity: fadeAnims[2], transform: [{ translateY: slideAnims[2] }] }}>
            <Text style={[styles.label, { color: theme.ink }]}>EMAIL</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.card, borderColor: theme.ink, color: theme.textStrong }]}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="your@email.com"
              placeholderTextColor={theme.textSoft}
            />
          </Animated.View>

          {/* Password field */}
          <Animated.View style={{ marginBottom: 8, opacity: fadeAnims[3], transform: [{ translateY: slideAnims[3] }] }}>
            <Text style={[styles.label, { color: theme.ink }]}>PASSWORD</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.card, borderColor: theme.ink, color: theme.textStrong }]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={theme.textSoft}
            />
          </Animated.View>

          {/* Error */}
          {error ? (
            <Text style={{ color: theme.danger ?? "#C0392B", fontSize: 13, marginBottom: 8, textAlign: "center" }}>
              {error}
            </Text>
          ) : null}

          {/* Forgot password */}
          <Pressable onPress={() => {/* no-op for now */}} style={{ alignSelf: "flex-end", marginBottom: 20 }}>
            <Text style={{ color: theme.textSoft ?? "#888", fontSize: 13 }}>Forgot password?</Text>
          </Pressable>

          {/* Sign in button */}
          <Animated.View style={{ opacity: fadeAnims[4], transform: [{ translateY: slideAnims[4] }] }}>
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: "#A62A50", borderColor: theme.ink ?? "#111" }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <LoadingIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>SIGN IN</Text>
              )}
            </Pressable>
          </Animated.View>

          {/* Create account link */}
          <Animated.View
            style={{ alignItems: "center", marginTop: 20, opacity: fadeAnims[5], transform: [{ translateY: slideAnims[5] }] }}
          >
            <Pressable onPress={onShowSignup}>
              <Text style={{ color: theme.textStrong ?? "#111", fontSize: 14 }}>
                {"Don't have an account? "}
                <Text style={{ fontWeight: "700", textDecorationLine: "underline" }}>Create one</Text>
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  input: {
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    shadowColor: "#111",
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  primaryBtn: {
    borderRadius: 12,
    borderWidth: 2,
    paddingVertical: 15,
    alignItems: "center",
    shadowColor: "#111",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: 1.2,
  },
});
