import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View, TouchableOpacity, StyleSheet, Animated, Platform } from "react-native";
import AppText from "./src/components/AppText";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState, useRef } from "react";
import * as Notifications from "expo-notifications";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import api from "./src/api/axios";
import { useTranslation } from "./src/i18n";
import useIncomingCall from "./src/hooks/useIncomingCall";

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
import OnThisDayScreen from "./src/screens/OnThisDayScreen";
import ConnectionCRMScreen from "./src/screens/ConnectionCRMScreen";
import EditProfileScreen from "./src/screens/EditProfileScreen";
import PostDetailScreen from "./src/screens/PostDetailScreen";
import MessageRequestsScreen from "./src/screens/MessageRequestsScreen";
import CallScreen from "./src/screens/CallScreen";
import CallLogsScreen from "./src/screens/CallLogsScreen";
import FamilyPublicScreen from "./src/screens/FamilyPublicScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Configure how notifications are handled when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function MainTabs() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [msgUnread, setMsgUnread] = useState(0);
  const [notifUnread, setNotifUnread] = useState(0);
  const pollRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    const poll = async () => {
      try {
        const [notifRes, msgRes] = await Promise.all([
          api.get("/notifications/count").catch(() => ({ data: { unread_count: 0 } })),
          api.get("/messages/conversations").catch(() => ({ data: { conversations: [] } })),
        ]);
        setNotifUnread(notifRes.data?.unread_count || 0);
        const convs = msgRes.data?.conversations || [];
        setMsgUnread(convs.reduce((sum, c) => sum + (c.unread_count || 0), 0));
      } catch {}
    };
    poll();
    pollRef.current = setInterval(poll, 8000);
    return () => clearInterval(pollRef.current);
  }, [user]);

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
          tabBarLabel: t('home'),
          tabBarIcon: ({ color, focused }) => (
            <View>
              <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
              {notifUnread > 0 && (
                <View style={tabBadge.dot}>
                  <AppText style={tabBadge.dotText}>{notifUnread > 9 ? "9+" : notifUnread}</AppText>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          tabBarLabel: t('discover'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "compass" : "compass-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Create"
        component={CreateScreen}
        options={{
          tabBarLabel: t('create'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "add-circle" : "add-circle-outline"} size={28} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{
          tabBarLabel: t('messages'),
          tabBarIcon: ({ color, focused }) => (
            <View>
              <Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} size={24} color={color} />
              {msgUnread > 0 && (
                <View style={tabBadge.dot}>
                  <AppText style={tabBadge.dotText}>{msgUnread > 9 ? "9+" : msgUnread}</AppText>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: t('profile'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const tabBadge = {
  dot: { position: "absolute", top: -4, right: -8, backgroundColor: "#e11d48", borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  dotText: { color: "#fff", fontSize: 9, fontWeight: "800" },
};

function RootNavigator({ navigationRef }) {
  const { user, loading } = useAuth();
  const { theme, isDark } = useTheme();

  // ── Incoming call polling ──────────────────────────────────
  useIncomingCall((call) => {
    if (!user) return;
    navigationRef.current?.navigate('Call', {
      callType: call.call_type,
      callerName: call.caller_name,
      callerAvatar: call.caller_avatar,
      isIncoming: true,
      conversationId: call.conversation_id,
      incomingChannel: call.channel,
      incomingToken: call.token,
      incomingCallerId: call.caller_id,
    });
  });

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#7c3aed" size="large" />
      </View>
    );
  }

  // Profile is complete when username is set.
  // Bio is optional in onboarding, so it should not block navigation.
  const isProfileComplete = !!user?.username;

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
          <Stack.Screen name="OnThisDay" component={OnThisDayScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="ConnectionCRM" component={ConnectionCRMScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="MessageRequests" component={MessageRequestsScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="Call" component={CallScreen} options={{ animation: "slide_from_bottom", presentation: "fullScreenModal" }} />
          <Stack.Screen name="CallLogs" component={CallLogsScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="FamilyPublic" component={FamilyPublicScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="JoinFamily" component={JoinFamilyScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="FamilyGate" component={FamilyGateScreen} options={{ animation: "slide_from_right" }} />
        </>
      )}
    </Stack.Navigator>
  );
}

function PushNotificationSetup() {
  const { user } = useAuth();
  const navigationRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== "granted") return;
        const token = (await Notifications.getExpoPushTokenAsync()).data;
        // Send token to backend so server can push to this device
        api.post("/auth/push-token", { token }).catch(() => {});
      } catch {}
    })();
  }, [user]);

  return null;
}

export default function App() {
  const navRef = useRef(null);
  return (
    <ThemeProvider>
      <AuthProvider>
        <NavigationContainer ref={navRef}>
          <StatusBar style="auto" />
          <PushNotificationSetup />
          <RootNavigator navigationRef={navRef} />
        </NavigationContainer>
      </AuthProvider>
    </ThemeProvider>
  );
}
