import React, { useEffect, useState } from "react";
import { Linking, Platform, ToastAndroid, Alert, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import notifee, { EventType } from "@notifee/react-native";
import { CommonActions } from "@react-navigation/native";
import { ThemeProvider } from "./src/theme/ThemeContext";
import { RootTabs } from "./src/navigation/RootTabs";
import { OnboardingFlow } from "./src/screens/OnboardingFlow";
import { LoginScreen } from "./src/screens/LoginScreen";
import { navigationRef } from "./src/navigation/navigationRef";
import { api } from "./src/api/client";
import { getToken, clearToken, registerLogoutHandler } from "./src/lib/auth";

type AppState = "loading" | "login" | "onboarding" | "app";

function navigateWhenReady(name: "Meals" | "Health") {
  const attempt = () => {
    if (navigationRef.isReady()) {
      navigationRef.dispatch(CommonActions.navigate({ name: "Tabs", params: { screen: name } }));
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

function shouldGoToMeals(data: any, actionId?: string): boolean {
  return data?.target === "meals" || actionId === "log-meal";
}

export default function App() {
  const [appState, setAppState] = useState<AppState>("loading");

  // Register logout handler so Settings can sign the user out
  registerLogoutHandler(() => setAppState("login"));

  useEffect(() => {
    initAuth();

    // Notification cold-start
    notifee.getInitialNotification().then((initial) => {
      if (!initial) return;
      if (shouldGoToMeals(initial.notification?.data, initial.pressAction?.id)) {
        navigateWhenReady("Meals");
      }
    });

    // Deep-link cold-start
    Linking.getInitialURL().then(handleUrl);

    const unsubscribeNotif = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
        if (shouldGoToMeals(detail.notification?.data, detail.pressAction?.id)) {
          navigateWhenReady("Meals");
        }
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
    } catch {
      await clearToken();
      setAppState("login");
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
        <StatusBar style="auto" />
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </ThemeProvider>
    );
  }

  if (appState === "onboarding") {
    return (
      <ThemeProvider>
        <StatusBar style="auto" />
        <OnboardingFlow onComplete={handleOnboardingComplete} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <StatusBar style="auto" />
      <RootTabs />
    </ThemeProvider>
  );
}
