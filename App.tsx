import React, { useEffect } from "react";
import { Linking, Platform, ToastAndroid, Alert } from "react-native";
import { StatusBar } from "expo-status-bar";
import notifee, { EventType } from "@notifee/react-native";
import { CommonActions } from "@react-navigation/native";
import { ThemeProvider } from "./src/theme/ThemeContext";
import { RootTabs } from "./src/navigation/RootTabs";
import { navigationRef } from "./src/navigation/navigationRef";
import { api } from "./src/api/client";
import { USER_ID } from "./src/api/config";

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
    const metric = await api.getOrCreateWaterMetric(USER_ID);
    await api.logWater(metric.id);
    toast("Water logged 💧");
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
  useEffect(() => {
    // Notification cold-start (killed → tap notification)
    notifee.getInitialNotification().then((initial) => {
      if (!initial) return;
      if (shouldGoToMeals(initial.notification?.data, initial.pressAction?.id)) {
        navigateWhenReady("Meals");
      }
    });

    // Deep-link cold-start (killed → app shortcut / scheme URL)
    Linking.getInitialURL().then(handleUrl);

    // Notification press while app is running
    const unsubscribeNotif = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
        if (shouldGoToMeals(detail.notification?.data, detail.pressAction?.id)) {
          navigateWhenReady("Meals");
        }
      }
    });

    // Deep-link while app is running
    const linkingSub = Linking.addEventListener("url", ({ url }) => handleUrl(url));

    return () => {
      unsubscribeNotif();
      linkingSub.remove();
    };
  }, []);

  return (
    <ThemeProvider>
      <StatusBar style="auto" />
      <RootTabs />
    </ThemeProvider>
  );
}
