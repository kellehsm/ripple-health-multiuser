import React from "react";
import { Pressable, View, Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator, BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { OverviewScreen } from "../screens/OverviewScreen";
import { HealthScreen } from "../screens/HealthScreen";
import { MealsScreen } from "../screens/MealsScreen";
import { FinanceScreen } from "../screens/FinanceScreen";
import { LifeScreen } from "../screens/LifeScreen";
import { HealthTabScreen } from "../screens/HealthTabScreen";
import { ExerciseScreen } from "../screens/ExerciseScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { HistoryScreen } from "../screens/HistoryScreen";
import { StepsDetailScreen } from "../screens/StepsDetailScreen";
import { HeartRateDetailScreen } from "../screens/HeartRateDetailScreen";
import { TrendsScreen } from "../screens/TrendsScreen";
import { CompletedScreen } from "../screens/CompletedScreen";
import { InsightsScreen } from "../screens/InsightsScreen";
import { MindfulnessScreen } from "../screens/MindfulnessScreen";
import { CustomizeDashboardScreen } from "../screens/CustomizeDashboardScreen";
import { GlobalSearchScreen } from "../screens/GlobalSearchScreen";
import { HelpScreen } from "../screens/HelpScreen";
import { TabPreferencesScreen } from "../screens/TabPreferencesScreen";
import { AppearanceSettingsScreen } from "../screens/settings/AppearanceSettingsScreen";
import { HealthConnectSettingsScreen } from "../screens/settings/HealthConnectSettingsScreen";
import { DexcomSettingsScreen } from "../screens/settings/DexcomSettingsScreen";
import { NotificationsSettingsScreen } from "../screens/settings/NotificationsSettingsScreen";
import { TrackingSettingsScreen } from "../screens/settings/TrackingSettingsScreen";
import { SecuritySettingsScreen } from "../screens/settings/SecuritySettingsScreen";
import { PreferencesSettingsScreen } from "../screens/settings/PreferencesSettingsScreen";
import { ExportBackupSettingsScreen } from "../screens/settings/ExportBackupSettingsScreen";
import { OnboardingFlow } from "../screens/OnboardingFlow";
import { BottomNav } from "../components/BottomNav";
import { useTabPreferences } from "../hooks/useTabPreferences";
import { useTheme } from "../theme/ThemeContext";
import { navigationRef } from "./navigationRef";
import { ModuleId } from "../types/tabPreferences";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Map module IDs ↔ tab route names
const MODULE_TO_ROUTE: Record<ModuleId | 'home', string> = {
  wellness: 'Wellness',
  meals: 'Meals',
  health: 'Health',
  exercise: 'Exercise',
  hobbies: 'Life',
  finance: 'Finance',
  home: 'Home',
};

const ROUTE_TO_MODULE: Record<string, ModuleId | 'home'> = {
  Wellness: 'wellness',
  Meals: 'meals',
  Health: 'health',
  Exercise: 'exercise',
  Life: 'hobbies',
  Finance: 'finance',
  Home: 'home',
};

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { preferences } = useTabPreferences();
  const activeRouteName = state.routes[state.index]?.name ?? 'Home';
  const activeModule = ROUTE_TO_MODULE[activeRouteName] ?? 'home';

  return (
    <BottomNav
      preferences={preferences}
      activeRoute={activeModule}
      onNavigate={(module) => {
        const routeName = MODULE_TO_ROUTE[module];
        navigation.navigate(routeName);
      }}
    />
  );
}

function TabNavigator() {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={({ navigation }) => ({
        headerRight: () => (
          <View style={{ flexDirection: "row", marginRight: 12, alignItems: "center" }}>
            <Pressable onPress={() => (navigation as any).getParent()?.navigate("Settings")} style={{ padding: 8 }}>
              <Text style={{ fontSize: 19 }}>⚙️</Text>
            </Pressable>
          </View>
        ),
        headerStyle: { backgroundColor: theme.page },
        headerTitleStyle: { color: theme.textStrong, fontWeight: "800", fontSize: 19 },
      })}
    >
      <Tab.Screen name="Wellness" component={HealthScreen} />
      <Tab.Screen name="Meals" component={MealsScreen} />
      <Tab.Screen name="Health" component={HealthTabScreen} />
      <Tab.Screen name="Exercise" component={ExerciseScreen} />
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
                borderColor: theme.ink,
                borderRadius: 12,
                backgroundColor: theme.card,
                shadowColor: theme.ink,
                shadowOffset: { width: 4, height: 4 },
                shadowOpacity: 1,
                shadowRadius: 0,
                elevation: 4,
              }}
            >
              {([
                { emoji: "💡", label: "INSIGHT", screen: "Insights" },
                { emoji: "📈", label: "TRENDS", screen: "Trends" },
                { emoji: "🔍", label: "SEARCH", screen: "GlobalSearch" },
                { emoji: "⚙️", label: "SETTINGS", screen: "Settings" },
              ] as const).map((btn, i) => (
                <React.Fragment key={btn.label}>
                  {i > 0 && <View style={{ width: 2, backgroundColor: theme.ink }} />}
                  <Pressable
                    onPress={() => (navigation as any).getParent()?.navigate(btn.screen)}
                    style={{ alignItems: "center", justifyContent: "center", paddingHorizontal: 10, paddingVertical: 6 }}
                  >
                    <Text style={{ fontSize: 18 }}>{btn.emoji}</Text>
                    <Text style={{ fontSize: 8, fontWeight: "700", letterSpacing: 0.5, color: theme.ink, marginTop: 2 }}>
                      {btn.label}
                    </Text>
                  </Pressable>
                </React.Fragment>
              ))}
            </View>
          ),
        })}
      />
      <Tab.Screen name="Life" component={LifeScreen} options={{ title: "Hobbies" }} />
      <Tab.Screen name="Finance" component={FinanceScreen} />
    </Tab.Navigator>
  );
}

interface RootTabsProps {
  onNavigationStateChange?: () => void;
}

export function RootTabs({ onNavigationStateChange }: RootTabsProps) {
  const { theme } = useTheme();

  return (
    <NavigationContainer ref={navigationRef} onStateChange={onNavigationStateChange}>
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
        <Stack.Screen name="Mindfulness" component={MindfulnessScreen} options={{ title: "Mindfulness" }} />
        <Stack.Screen name="CustomizeDashboard" component={CustomizeDashboardScreen} options={{ title: "Customize Dashboard" }} />
        <Stack.Screen name="GlobalSearch" component={GlobalSearchScreen} options={{ title: "Search" }} />
        <Stack.Screen name="Help" component={HelpScreen} options={{ title: "Help & FAQ" }} />
        <Stack.Screen name="SettingsAppearance" component={AppearanceSettingsScreen} options={{ title: "Appearance" }} />
        <Stack.Screen name="SettingsHealthConnect" component={HealthConnectSettingsScreen} options={{ title: "Health Connect" }} />
        <Stack.Screen name="SettingsDexcom" component={DexcomSettingsScreen} options={{ title: "Dexcom" }} />
        <Stack.Screen name="SettingsNotifications" component={NotificationsSettingsScreen} options={{ title: "Notifications" }} />
        <Stack.Screen name="SettingsTracking" component={TrackingSettingsScreen} options={{ title: "Always-on Tracking" }} />
        <Stack.Screen name="SettingsSecurity" component={SecuritySettingsScreen} options={{ title: "App Lock" }} />
        <Stack.Screen name="SettingsPreferences" component={PreferencesSettingsScreen} options={{ title: "Preferences" }} />
        <Stack.Screen name="SettingsExportBackup" component={ExportBackupSettingsScreen} options={{ title: "Export & Backup" }} />
        <Stack.Screen name="SettingsCustomizeTabs" options={{ title: "Customize Tabs" }}>
          {({ navigation }) => (
            <TabPreferencesScreen
              mode="settings"
              onDone={() => navigation.goBack()}
              onCancel={() => navigation.goBack()}
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          name="OnboardingReplay"
          options={{ headerShown: false, presentation: "fullScreenModal" }}
        >
          {({ navigation }) => (
            <OnboardingFlow replayMode onComplete={() => navigation.goBack()} />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
