import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";
import { colors } from "./src/theme";

// Auth screens
import WelcomeScreen from "./src/screens/WelcomeScreen";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import SetupProfileScreen from "./src/screens/SetupProfileScreen";
import JoinFamilyScreen from "./src/screens/JoinFamilyScreen";
import FamilyGateScreen from "./src/screens/FamilyGateScreen";

// Main tabs
import FeedScreen from "./src/screens/FeedScreen";
import SearchScreen from "./src/screens/SearchScreen";
import CreateScreen from "./src/screens/CreateScreen";
import MessagesScreen from "./src/screens/MessagesScreen";
import ProfileScreen from "./src/screens/ProfileScreen";

// Stack screens
import AIProcessingScreen from "./src/screens/AIProcessingScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import StorybooksScreen from "./src/screens/StorybooksScreen";
import StorybookGeneratorScreen from "./src/screens/StorybookGeneratorScreen";
import FeedAI from "./src/screens/FeedAI";
import MediaEditorScreen from "./src/screens/MediaEditorScreen";
import VoiceRecorderScreen from "./src/screens/VoiceRecorderScreen";
import UserProfileScreen from "./src/screens/UserProfileScreen";
import ChatScreen from "./src/screens/ChatScreen";
import FamilyScreen from "./src/screens/FamilyScreen";
import TimelineScreen from "./src/screens/TimelineScreen";
import StoryViewerScreen from "./src/screens/StoryViewerScreen";
import FamilyTreeScreen from "./src/screens/FamilyTreeScreen";
import FamilyCalendarScreen from "./src/screens/FamilyCalendarScreen";
import FamilyRecipesScreen from "./src/screens/FamilyRecipesScreen";
import FamilyBudgetScreen from "./src/screens/FamilyBudgetScreen";
import PostInsightsScreen from "./src/screens/PostInsightsScreen";
import AccountSwitcherScreen from "./src/screens/AccountSwitcherScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { theme } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.tabBar,
          borderTopColor: theme.tabBarBorder,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 10,
          shadowColor: theme.primary,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.15,
          shadowRadius: 16,
          elevation: 20,
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.dim,
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
          tabBarLabel: "Discover",
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
        name="Messages"
        component={MessagesScreen}
        options={{
          tabBarLabel: "Messages",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} size={24} color={color} />
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
  const { theme, isDark } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#7c3aed" size="large" />
      </View>
    );
  }

  // Profile is complete when username, bio, and at least 1 interest are set
  const isProfileComplete = !!(user?.username && user?.bio && user?.interests?.length > 0);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: "fade_from_bottom" }}>
      {!user ? (
        <>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="SetupProfile" component={SetupProfileScreen} />
          <Stack.Screen name="JoinFamily" component={JoinFamilyScreen} />
        </>
      ) : !isProfileComplete ? (
        // Logged in but profile not complete — must finish setup
        <>
          <Stack.Screen name="SetupProfile" component={SetupProfileScreen} />
        </>
      ) : !user.family_id ? (
        <>
          <Stack.Screen name="FamilyGate" component={FamilyGateScreen} />
          <Stack.Screen name="JoinFamily" component={JoinFamilyScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="Chat" component={ChatScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="StoryViewer" component={StoryViewerScreen} options={{ animation: "fade", presentation: "fullScreenModal" }} />
          <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="Family" component={FamilyScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="Timeline" component={TimelineScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="FeedAI" component={FeedAI} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="Storybooks" component={StorybooksScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="StorybookGenerator" component={StorybookGeneratorScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="AIProcessing" component={AIProcessingScreen} options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="MediaEditor" component={MediaEditorScreen} options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="VoiceRecorder" component={VoiceRecorderScreen} options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="FamilyTree" component={FamilyTreeScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="FamilyCalendar" component={FamilyCalendarScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="FamilyRecipes" component={FamilyRecipesScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="FamilyBudget" component={FamilyBudgetScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="PostInsights" component={PostInsightsScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="AccountSwitcher" component={AccountSwitcherScreen} options={{ animation: "slide_from_right" }} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="auto" />
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </ThemeProvider>
  );
}
