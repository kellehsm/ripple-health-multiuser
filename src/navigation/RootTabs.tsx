import React from "react";
import { Pressable, View, Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { OverviewScreen } from "../screens/OverviewScreen";
import { HealthScreen } from "../screens/HealthScreen";
import { MealsScreen } from "../screens/MealsScreen";
import { FinanceScreen } from "../screens/FinanceScreen";
import { LifeScreen } from "../screens/LifeScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { HistoryScreen } from "../screens/HistoryScreen";
import { StepsDetailScreen } from "../screens/StepsDetailScreen";
import { useTheme } from "../theme/ThemeContext";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  const { theme, toggle, mode } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route, navigation }) => ({
        headerRight: () => (
          <View style={{ flexDirection: "row", gap: 16, marginRight: 16, alignItems: "center" }}>
            <Pressable onPress={() => (navigation as any).getParent()?.navigate("Settings")}>
              <Ionicons name="settings-outline" size={20} color={theme.textStrong} />
            </Pressable>
            <Pressable onPress={toggle}>
              <Ionicons name={mode === "light" ? "moon" : "sunny"} size={20} color={theme.textStrong} />
            </Pressable>
          </View>
        ),
        headerStyle: { backgroundColor: theme.page },
        headerTitleStyle: { color: theme.textStrong },
        tabBarStyle: {
          backgroundColor: theme.page,
          borderTopColor: theme.cardBorder,
          height: 64,
        },
        tabBarActiveTintColor: theme.textStrong,
        tabBarInactiveTintColor: theme.textSoft,
        tabBarItemStyle: route.name !== "Finance"
          ? { borderRightWidth: 0.5, borderRightColor: theme.cardBorder }
          : {},
      })}
    >
      <Tab.Screen
        name="Health"
        component={HealthScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons name="heart" size={22} color={focused ? theme.berry.sub : theme.textSoft} />
          ),
        }}
      />
      <Tab.Screen
        name="Meals"
        component={MealsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons name="restaurant" size={22} color={focused ? theme.coral.sub : theme.textSoft} />
          ),
        }}
      />
      <Tab.Screen
        name="Home"
        component={OverviewScreen}
        options={({ navigation }) => ({
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 16, marginRight: 16, alignItems: "center" }}>
              <Pressable onPress={() => (navigation as any).getParent()?.navigate("History")}>
                <Ionicons name="search" size={20} color={theme.textStrong} />
              </Pressable>
              <Pressable onPress={() => (navigation as any).getParent()?.navigate("Settings")}>
                <Ionicons name="settings-outline" size={20} color={theme.textStrong} />
              </Pressable>
              <Pressable onPress={toggle}>
                <Ionicons name={mode === "light" ? "moon" : "sunny"} size={20} color={theme.textStrong} />
              </Pressable>
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
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: "#888",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: -18,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.15,
                  shadowRadius: 4,
                  elevation: 4,
                }}
              >
                <Ionicons name="home" size={24} color="#fff" />
              </View>
              <Text style={{ color: theme.textSoft, fontSize: 10, marginTop: 3 }}>Home</Text>
            </Pressable>
          ),
        })}
      />
      <Tab.Screen
        name="Life"
        component={LifeScreen}
        options={{
          title: "Habits",
          tabBarIcon: ({ focused }) => (
            <Ionicons name="book" size={22} color={focused ? theme.teal.sub : theme.textSoft} />
          ),
        }}
      />
      <Tab.Screen
        name="Finance"
        component={FinanceScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons name="wallet" size={22} color={focused ? theme.purple.sub : theme.textSoft} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function RootTabs() {
  const { theme } = useTheme();

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.page },
          headerTitleStyle: { color: theme.textStrong },
          headerTintColor: theme.textStrong,
        }}
      >
        <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
        <Stack.Screen name="History" component={HistoryScreen} options={{ title: "History" }} />
        <Stack.Screen name="StepsDetail" component={StepsDetailScreen} options={{ title: "Steps" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
