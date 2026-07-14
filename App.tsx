import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import notifee, { EventType } from "@notifee/react-native";
import { CommonActions } from "@react-navigation/native";
import { ThemeProvider } from "./src/theme/ThemeContext";
import { RootTabs } from "./src/navigation/RootTabs";
import { navigationRef } from "./src/navigation/navigationRef";

function navigateToMeals() {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(CommonActions.navigate({ name: "Tabs", params: { screen: "Meals" } }));
  }
}

function shouldGoToMeals(data: any, actionId?: string): boolean {
  return data?.target === "meals" || actionId === "log-meal";
}

export default function App() {
  useEffect(() => {
    // Handle initial notification when app launches from a killed state
    notifee.getInitialNotification().then((initial) => {
      if (!initial) return;
      const data = initial.notification?.data;
      const actionId = initial.pressAction?.id;
      if (shouldGoToMeals(data, actionId)) {
        const deadline = Date.now() + 5000;
        const timer = setInterval(() => {
          if (navigationRef.isReady() || Date.now() > deadline) {
            clearInterval(timer);
            if (navigationRef.isReady()) navigateToMeals();
          }
        }, 50);
      }
    });

    // Handle notification press while app is in foreground
    const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
        const data = detail.notification?.data;
        const actionId = detail.pressAction?.id;
        if (shouldGoToMeals(data, actionId)) navigateToMeals();
      }
    });

    return () => { unsubscribe(); };
  }, []);

  return (
    <ThemeProvider>
      <StatusBar style="auto" />
      <RootTabs />
    </ThemeProvider>
  );
}
