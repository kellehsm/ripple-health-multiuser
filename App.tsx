import React, { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Platform, ToastAndroid, Alert, View, StyleSheet, Text, Pressable, AppState as RNAppState } from "react-native";
import { StatusBar } from "expo-status-bar";
import notifee, { EventType } from "@notifee/react-native";
import { CommonActions } from "@react-navigation/native";
import { ThemeProvider } from "./src/theme/ThemeContext";
import { OfflineBanner } from "./src/components/OfflineBanner";
import { RootTabs } from "./src/navigation/RootTabs";
import { RippleLoader } from "./src/components/RippleLoader";
import { OnboardingFlow } from "./src/screens/OnboardingFlow";
import { LoginScreen } from "./src/screens/LoginScreen";
import { SignupScreen } from "./src/screens/SignupScreen";
import { AppErrorBoundary } from "./src/components/AppErrorBoundary";
import { navigationRef } from "./src/navigation/navigationRef";
import { api } from "./src/api/client";
import { getToken, clearToken, registerLogoutHandler } from "./src/lib/auth";
import {
  isBiometricLockEnabled,
  isCurrentlyUnlocked,
  markUnlocked,
  authenticateWithBiometrics,
  setBiometricLockEnabled,
} from "./src/lib/biometricLock";

// ── Diagnostic flags (toggle to isolate grey-screen suspects) ───────────────
// Set DISABLE_RIPPLE_TRANSITION=true to rule out the RippleLoader overlay
// Set DISABLE_BIOMETRIC_LOCK=true to rule out the biometric lock overlay
const DISABLE_RIPPLE_TRANSITION = false;
const DISABLE_BIOMETRIC_LOCK    = false;

type AppState = "loading" | "login" | "signup" | "onboarding" | "app";

type TabName = "Meals" | "Health" | "Home" | "Life" | "Finance";

function navigateWhenReady(name: TabName, params?: Record<string, unknown>) {
  const attempt = () => {
    if (navigationRef.isReady()) {
      const screenParams = params ? { ...params } : undefined;
      navigationRef.dispatch(
        CommonActions.navigate({ name: "Tabs", params: { screen: name, params: screenParams } })
      );
      return true;
    }
    return false;
  };
  if (attempt()) return;
  const deadline = Date.now() + 5000;
  const timer = setInterval(() => {
    if (attempt() || Date.now() > deadline) clearInterval(timer);
  }, 50);
}

function toast(msg: string) {
  if (Platform.OS === "android") ToastAndroid.show(msg, ToastAndroid.SHORT);
  else Alert.alert(msg);
}

async function logWaterFromShortcut() {
  try {
    const metric = await api.getOrCreateWaterMetric();
    await api.logWater(metric.id);
    toast("Water logged");
  } catch (e) {
    toast("Couldn't log water — try again from the app.");
  }
  navigateWhenReady("Health");
}

function handleUrl(url: string | null) {
  if (!url) return;
  if (url.includes("log-water")) {
    logWaterFromShortcut();
  } else if (url.includes("meals")) {
    navigateWhenReady("Meals");
  }
}

function handleNotificationAction(data: any, actionId?: string) {
  const target = data?.target;
  const action = data?.action;

  if (actionId === "log-water") {
    logWaterFromShortcut();
    return;
  }
  if (actionId === "log-meal" || target === "meals") {
    navigateWhenReady("Meals", action === "add" ? { openAddMeal: true } : undefined);
    return;
  }
  if (actionId === "log-mood" || target === "home") {
    navigateWhenReady("Home");
    return;
  }
  if (actionId === "review-today") {
    navigateWhenReady("Home");
    return;
  }
  if (actionId === "log-book" || target === "life") {
    navigateWhenReady("Life");
    return;
  }
  if (actionId === "log-hobby") {
    navigateWhenReady("Life");
    return;
  }
  if (actionId === "log-spend" || target === "finance") {
    navigateWhenReady("Finance");
    return;
  }
  if (target === "health") {
    navigateWhenReady("Health");
  }
}

// Keep for backward compat with existing references
function shouldGoToMeals(data: any, actionId?: string): boolean {
  return data?.target === "meals" || actionId === "log-meal";
}

export default function App() {
  const [appState, setAppState] = useState<AppState>("loading");
  const [biometricLocked, setBiometricLocked] = useState(false);
  const [showRippleTransition, setShowRippleTransition] = useState(false);
  const rippleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNavigationStateChange = useCallback(() => {
    if (DISABLE_RIPPLE_TRANSITION) return;
    if (rippleTimer.current) clearTimeout(rippleTimer.current);
    setShowRippleTransition(true);
    rippleTimer.current = setTimeout(() => setShowRippleTransition(false), 480);
  }, []);

  // Register logout handler so Settings can sign the user out
  registerLogoutHandler(() => setAppState("login"));

  useEffect(() => {
    const appStateSub = RNAppState.addEventListener("change", async (nextState) => {
      console.log("[Diag] RNAppState →", nextState);
      if (nextState === "active") {
        const enabled = await isBiometricLockEnabled().catch(() => false);
        const unlocked = isCurrentlyUnlocked();
        console.log("[Diag] biometricEnabled:", enabled, "isCurrentlyUnlocked:", unlocked, "DISABLE_FLAG:", DISABLE_BIOMETRIC_LOCK);
        if (!DISABLE_BIOMETRIC_LOCK && enabled && !unlocked) {
          console.log("[Diag] → setting biometricLocked=true");
          setBiometricLocked(true);
        }
      }
    });
    return () => appStateSub.remove();
  }, []);

  async function handleBiometricUnlock() {
    const result = await authenticateWithBiometrics();
    if (result === "success") {
      setBiometricLocked(false);
    } else if (result === "unavailable") {
      await setBiometricLockEnabled(false);
      setBiometricLocked(false);
    }
  }

  useEffect(() => {
    initAuth();

    // Notification cold-start
    notifee.getInitialNotification().then((initial) => {
      if (!initial) return;
      handleNotificationAction(initial.notification?.data, initial.pressAction?.id);
    });

    // Deep-link cold-start
    Linking.getInitialURL().then(handleUrl);

    const unsubscribeNotif = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
        handleNotificationAction(detail.notification?.data, detail.pressAction?.id);
      }
    });

    const linkingSub = Linking.addEventListener("url", ({ url }) => handleUrl(url));

    return () => {
      unsubscribeNotif();
      linkingSub.remove();
    };
  }, []);

  async function initAuth() {
    console.log("[Diag] initAuth: start");
    const token = await getToken();
    console.log("[Diag] initAuth: token present:", !!token);
    if (!token) {
      setAppState("login");
      return;
    }
    try {
      const user = await api.me();
      if (!user) throw new Error("no user");
      console.log("[Diag] initAuth: user ok, onboarding_completed:", user.onboarding_completed);
      markUnlocked();
      setBiometricLocked(false);
      setAppState(user.onboarding_completed ? "app" : "onboarding");
    } catch (err: any) {
      // Only clear the token on actual auth rejection (401/403). Network errors or
      // server hiccups should not log the user out — just trust the stored token.
      const msg: string = err?.message ?? "";
      console.log("[Diag] initAuth: error:", msg);
      if (msg.includes("API error 401") || msg.includes("API error 403")) {
        await clearToken();
        setAppState("login");
      } else {
        markUnlocked();
        setBiometricLocked(false);
        setAppState("app");
      }
    }
  }

  async function handleLoginSuccess() {
    console.log("[Diag] handleLoginSuccess: start");
    try {
      const user = await api.me();
      console.log("[Diag] handleLoginSuccess: onboarding_completed:", user?.onboarding_completed);
      markUnlocked();
      setBiometricLocked(false);
      setAppState(user?.onboarding_completed ? "app" : "onboarding");
    } catch (e) {
      console.log("[Diag] handleLoginSuccess: error fallback", String(e));
      markUnlocked();
      setBiometricLocked(false);
      setAppState("app");
    }
  }

  async function handleOnboardingComplete() {
    console.log("[Diag] handleOnboardingComplete: start");
    try {
      await api.markOnboardingComplete();
      console.log("[Diag] handleOnboardingComplete: API call done");
    } catch (e) {
      console.log("[Diag] handleOnboardingComplete: API call failed (ignored):", String(e));
    }
    markUnlocked();
    setBiometricLocked(false);
    console.log("[Diag] handleOnboardingComplete: calling setAppState(app)");
    setAppState("app");
    console.log("[Diag] handleOnboardingComplete: done");
  }

  if (appState === "loading") {
    return <View style={{ flex: 1, backgroundColor: "#F5F1E8" }} />;
  }

  if (appState === "login") {
    return (
      <AppErrorBoundary>
        <ThemeProvider>
          <StatusBar style="dark" />
          <LoginScreen
            onLoginSuccess={handleLoginSuccess}
            onShowSignup={() => setAppState("signup")}
          />
        </ThemeProvider>
      </AppErrorBoundary>
    );
  }

  if (appState === "signup") {
    return (
      <AppErrorBoundary>
        <ThemeProvider>
          <StatusBar style="dark" />
          <SignupScreen
            onSignupSuccess={() => { markUnlocked(); setBiometricLocked(false); setAppState("onboarding"); }}
            onBackToLogin={() => setAppState("login")}
          />
        </ThemeProvider>
      </AppErrorBoundary>
    );
  }

  if (appState === "onboarding") {
    return (
      <AppErrorBoundary>
        <ThemeProvider>
          <StatusBar style="dark" />
          <OnboardingFlow onComplete={handleOnboardingComplete} />
        </ThemeProvider>
      </AppErrorBoundary>
    );
  }

  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <StatusBar style="dark" />
        <RootTabs onNavigationStateChange={handleNavigationStateChange} />
        <OfflineBanner />
        {!DISABLE_RIPPLE_TRANSITION && showRippleTransition && (
          <View pointerEvents="none" style={transitionStyles.overlay}>
            <RippleLoader size="large" />
          </View>
        )}
        {!DISABLE_BIOMETRIC_LOCK && biometricLocked && (
          <View style={lockStyles.overlay}>
            <Text style={lockStyles.appName}>Ripple</Text>
            <Text style={lockStyles.subtitle}>Your data is private</Text>
            <Pressable onPress={handleBiometricUnlock} style={lockStyles.unlockBtn}>
              <Text style={lockStyles.unlockBtnText}>Unlock with Biometrics</Text>
            </Pressable>
          </View>
        )}
      </ThemeProvider>
    </AppErrorBoundary>
  );
}

const transitionStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9997,
  },
});

const lockStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#161A20",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  appName: { color: "#FFFFFF", fontSize: 32, fontWeight: "800", marginBottom: 8 },
  subtitle: { color: "#9BA3AF", fontSize: 14, marginBottom: 40 },
  unlockBtn: {
    backgroundColor: "#4AB8D0",
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  unlockBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
});
