import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { colors } from "./src/theme";

// Auth screens
import WelcomeScreen from "./src/screens/WelcomeScreen";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import SetupProfileScreen from "./src/screens/SetupProfileScreen";
import JoinFamilyScreen from "./src/screens/JoinFamilyScreen";
import FamilyGateScreen from "./src/screens/FamilyGateScreen";

// Main screens
import FeedScreen from "./src/screens/FeedScreen";
import TimelineScreen from "./src/screens/TimelineScreen";
import FamilyScreen from "./src/screens/FamilyScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import SearchScreen from "./src/screens/SearchScreen";

// Stack screens (pushed on top)
import AIProcessingScreen from "./src/screens/AIProcessingScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import StorybooksScreen from "./src/screens/StorybooksScreen";
import CreateScreen from "./src/screens/CreateScreen";
import StorybookGeneratorScreen from "./src/screens/StorybookGeneratorScreen";
import FeedAI from "./src/screens/FeedAI";
import MediaEditorScreen from "./src/screens/MediaEditorScreen";
import VoiceRecorderScreen from "./src/screens/VoiceRecorderScreen";
import UserProfileScreen from "./src/screens/UserProfileScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "rgba(15,23,42,0.97)",
          borderTopColor: "rgba(148,163,184,0.08)",
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 10,
          shadowColor: "#7c3aed",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.2,
          shadowRadius: 16,
          elevation: 20,
        },
        tabBarActiveTintColor: "#7c3aed",
        tabBarInactiveTintColor: "#475569",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          tabBarLabel: "Explore",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "compass" : "compass-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Create"
        component={CreateScreen}
        options={{
          tabBarLabel: "Create",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "add-circle" : "add-circle-outline"} size={28} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Timeline"
        component={TimelineScreen}
        options={{
          tabBarLabel: "Timeline",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "git-branch" : "git-branch-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Family"
        component={FamilyScreen}
        options={{
          tabBarLabel: "Family",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "people-circle" : "people-circle-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color="#7c3aed" size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, animation: "fade_from_bottom" }}
    >
      {!user ? (
        <>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="SetupProfile" component={SetupProfileScreen} />
          <Stack.Screen name="JoinFamily" component={JoinFamilyScreen} />
        </>
      ) : !user.family_id ? (
        <>
          <Stack.Screen name="FamilyGate" component={FamilyGateScreen} />
          <Stack.Screen name="JoinFamily" component={JoinFamilyScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="AIProcessing"
            component={AIProcessingScreen}
            options={{ animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="FeedAI"
            component={FeedAI}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="Storybooks"
            component={StorybooksScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="StorybookGenerator"
            component={StorybookGeneratorScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="MediaEditor"
            component={MediaEditorScreen}
            options={{ animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="VoiceRecorder"
            component={VoiceRecorderScreen}
            options={{ animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="UserProfile"
            component={UserProfileScreen}
            options={{ animation: "slide_from_right" }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
