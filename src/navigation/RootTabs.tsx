import React from "react";
import { Pressable, View, Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { OverviewScreen } from "../screens/OverviewScreen";
import { HealthScreen } from "../screens/HealthScreen";
import { MealsScreen } from "../screens/MealsScreen";
import { FinanceScreen } from "../screens/FinanceScreen";
import { LifeScreen } from "../screens/LifeScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { HistoryScreen } from "../screens/HistoryScreen";
import { StepsDetailScreen } from "../screens/StepsDetailScreen";
import { HeartRateDetailScreen } from "../screens/HeartRateDetailScreen";
import { TrendsScreen } from "../screens/TrendsScreen";
import { CompletedScreen } from "../screens/CompletedScreen";
import { InsightsScreen } from "../screens/InsightsScreen";
import { useTheme } from "../theme/ThemeContext";
import { navigationRef } from "./navigationRef";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  const { theme } = useTheme();
  const ink = theme.ink;

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route, navigation }) => ({
        headerRight: () => (
          <View style={{ flexDirection: "row", marginRight: 12, alignItems: "center" }}>
            <Pressable onPress={() => (navigation as any).getParent()?.navigate("Settings")} style={{ padding: 8 }}>
              <Text style={{ fontSize: 19 }}>⚙️</Text>
            </Pressable>
          </View>
        ),
        headerStyle: { backgroundColor: theme.page },
        headerTitleStyle: { color: theme.textStrong, fontWeight: "800", fontSize: 19 },
        tabBarStyle: {
          backgroundColor: theme.page,
          borderTopColor: ink,
          borderTopWidth: 2,
          height: 64,
        },
        tabBarActiveTintColor: ink,
        tabBarInactiveTintColor: theme.textSoft,
        tabBarItemStyle: route.name !== "Finance"
          ? { borderRightWidth: 1, borderRightColor: ink }
          : {},
      })}
    >
      <Tab.Screen
        name="Health"
        component={HealthScreen}
        options={{
          tabBarIcon: () => (
            <Text style={{ fontSize: 22 }}>❤️</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Meals"
        component={MealsScreen}
        options={{
          tabBarIcon: () => (
            <Text style={{ fontSize: 22 }}>🍜</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Home"
        component={OverviewScreen}
        options={({ navigation }) => ({
          headerRight: () => (
            <View
              style={{
                flexDirection: "row",
                marginRight: 12,
                borderWidth: 2,
                borderColor: ink,
                borderRadius: 12,
                backgroundColor: theme.card,
                shadowColor: ink,
                shadowOffset: { width: 4, height: 4 },
                shadowOpacity: 1,
                shadowRadius: 0,
                elevation: 4,
              }}
            >
              {([
                { emoji: "💡", label: "INSIGHT", screen: "Insights" },
                { emoji: "📈", label: "TRENDS", screen: "Trends" },
                { emoji: "🔍", label: "SEARCH", screen: "History" },
                { emoji: "⚙️", label: "SETTINGS", screen: "Settings" },
              ] as const).map((btn, i) => (
                <React.Fragment key={btn.label}>
                  {i > 0 && <View style={{ width: 2, backgroundColor: ink }} />}
                  <Pressable
                    onPress={() => (navigation as any).getParent()?.navigate(btn.screen)}
                    style={{ alignItems: "center", justifyContent: "center", paddingHorizontal: 10, paddingVertical: 6 }}
                  >
                    <Text style={{ fontSize: 18 }}>{btn.emoji}</Text>
                    <Text style={{ fontSize: 8, fontWeight: "700", letterSpacing: 0.5, color: ink, marginTop: 2 }}>
                      {btn.label}
                    </Text>
                  </Pressable>
                </React.Fragment>
              ))}
            </View>
          ),
          tabBarIcon: () => null,
          tabBarLabel: () => null,
          tabBarButton: (props) => (
            <Pressable
              onPress={props.onPress}
              onLongPress={props.onLongPress}
              accessibilityRole="button"
              style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", paddingBottom: 6 }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  overflow: "hidden",
                  marginTop: -32,
                  borderWidth: 2.5,
                  borderColor: ink,
                  shadowColor: ink,
                  shadowOffset: { width: 4, height: 4 },
                  shadowOpacity: 1,
                  shadowRadius: 0,
                  elevation: 7,
                }}
              >
                <View style={{ flexDirection: "row", height: 26 }}>
                  <View style={{ flex: 1, backgroundColor: theme.teal.solid }} />
                  <View style={{ flex: 1, backgroundColor: theme.coral.solid }} />
                </View>
                <View style={{ flexDirection: "row", height: 26 }}>
                  <View style={{ flex: 1, backgroundColor: theme.purple.solid }} />
                  <View style={{ flex: 1, backgroundColor: theme.berry.solid }} />
                </View>
                <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 24 }}>🏠</Text>
                </View>
              </View>
              <Text style={{ color: theme.textSoft, fontSize: 10, marginTop: 3 }}>Trends</Text>
            </Pressable>
          ),
        })}
      />
      <Tab.Screen
        name="Life"
        component={LifeScreen}
        options={{
          title: "Hobbies",
          tabBarIcon: () => (
            <Text style={{ fontSize: 22 }}>📖</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Finance"
        component={FinanceScreen}
        options={{
          tabBarIcon: () => (
            <Text style={{ fontSize: 22 }}>💳</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function RootTabs() {
  const { theme } = useTheme();

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.page },
          headerTitleStyle: { color: theme.textStrong, fontWeight: "800", fontSize: 19 },
          headerTintColor: theme.textStrong,
        }}
      >
        <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
        <Stack.Screen name="History" component={HistoryScreen} options={{ title: "History" }} />
        <Stack.Screen name="StepsDetail" component={StepsDetailScreen} options={{ title: "Steps" }} />
        <Stack.Screen name="HeartRateDetail" component={HeartRateDetailScreen} options={{ title: "Heart Rate" }} />
        <Stack.Screen name="Trends" component={TrendsScreen} options={{ title: "Trends & Insights" }} />
        <Stack.Screen name="Completed" component={CompletedScreen} options={{ title: "Completed" }} />
        <Stack.Screen name="Insights" component={InsightsScreen} options={{ title: "Insights" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
