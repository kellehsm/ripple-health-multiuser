import React, { useEffect, useState } from "react";
import { Linking, Platform, ToastAndroid, Alert, View, StyleSheet, Text, Pressable, AppState as RNAppState } from "react-native";
import { StatusBar } from "expo-status-bar";
import notifee, { EventType } from "@notifee/react-native";
import { CommonActions } from "@react-navigation/native";
import { ThemeProvider } from "./src/theme/ThemeContext";
import { OfflineBanner } from "./src/components/OfflineBanner";
import { RootTabs } from "./src/navigation/RootTabs";
import { OnboardingFlow } from "./src/screens/OnboardingFlow";
import { LoginScreen } from "./src/screens/LoginScreen";
import { SignupScreen } from "./src/screens/SignupScreen";
import { navigationRef } from "./src/navigation/navigationRef";
import { api } from "./src/api/client";
import { getToken, clearToken, registerLogoutHandler } from "./src/lib/auth";
import {
  isBiometricLockEnabled,
  isCurrentlyUnlocked,
  authenticateWithBiometrics,
  setBiometricLockEnabled,
} from "./src/lib/biometricLock";

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

  // Register logout handler so Settings can sign the user out
  registerLogoutHandler(() => setAppState("login"));

  useEffect(() => {
    const appStateSub = RNAppState.addEventListener("change", async (nextState) => {
      if (nextState === "active") {
        const enabled = await isBiometricLockEnabled().catch(() => false);
        if (enabled && !isCurrentlyUnlocked()) {
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
    const token = await getToken();
    if (!token) {
      setAppState("login");
      return;
    }
    try {
      const user = await api.me();
      if (!user) throw new Error("no user");
      setAppState(user.onboarding_completed ? "app" : "onboarding");
    } catch (err: any) {
      // Only clear the token on actual auth rejection (401/403). Network errors or
      // server hiccups should not log the user out — just trust the stored token.
      const msg: string = err?.message ?? "";
      if (msg.includes("API error 401") || msg.includes("API error 403")) {
        await clearToken();
        setAppState("login");
      } else {
        setAppState("app");
      }
    }
  }

  async function handleLoginSuccess() {
    // After login, re-check onboarding status from server
    try {
      const user = await api.me();
      setAppState(user?.onboarding_completed ? "app" : "onboarding");
    } catch {
      setAppState("app");
    }
  }

  async function handleOnboardingComplete() {
    try {
      await api.markOnboardingComplete();
    } catch (_) {}
    setAppState("app");
  }

  if (appState === "loading") {
    return <View style={{ flex: 1, backgroundColor: "#F5F1E8" }} />;
  }

  if (appState === "login") {
    return (
      <ThemeProvider>
        <StatusBar style="dark" />
        <LoginScreen
          onLoginSuccess={handleLoginSuccess}
          onShowSignup={() => setAppState("signup")}
        />
      </ThemeProvider>
    );
  }

  if (appState === "signup") {
    return (
      <ThemeProvider>
        <StatusBar style="dark" />
        <SignupScreen
          onSignupSuccess={() => setAppState("onboarding")}
          onBackToLogin={() => setAppState("login")}
        />
      </ThemeProvider>
    );
  }

  if (appState === "onboarding") {
    return (
      <ThemeProvider>
        <StatusBar style="dark" />
        <OnboardingFlow onComplete={handleOnboardingComplete} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <StatusBar style="dark" />
      <RootTabs />
      <OfflineBanner />
      {biometricLocked && (
        <View style={lockStyles.overlay}>
          <Text style={lockStyles.appName}>Ripple</Text>
          <Text style={lockStyles.subtitle}>Your data is private</Text>
          <Pressable onPress={handleBiometricUnlock} style={lockStyles.unlockBtn}>
            <Text style={lockStyles.unlockBtnText}>Unlock with Biometrics</Text>
          </Pressable>
        </View>
      )}
    </ThemeProvider>
  );
}

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
