import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View, TouchableOpacity, StyleSheet, Animated, Platform, Image } from "react-native";
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
import StorybookViewerScreen from "./src/screens/StorybookViewerScreen";
import FeedAI from "./src/screens/FeedAI";
import MediaEditorScreen from "./src/screens/MediaEditorScreen";
import VoiceRecorderScreen from "./src/screens/VoiceRecorderScreen";
import UserProfileScreen from "./src/screens/UserProfileScreen";
import ChatScreen from "./src/screens/ChatScreen";
import FamilyScreen from "./src/screens/FamilyScreen";
import TimelineScreen from "./src/screens/TimelineScreen";
import StoryViewerScreen from "./src/screens/StoryViewerScreen";
import StoryCameraScreen from "./src/screens/StoryCameraScreen";
import FamilyTreeScreen from "./src/screens/FamilyTreeScreen";
import FamilyCalendarScreen from "./src/screens/FamilyCalendarScreen";
import FamilyRecipesScreen from "./src/screens/FamilyRecipesScreen";
import FamilyBudgetScreen from "./src/screens/FamilyBudgetScreen";
import FamilyProfileScreen from "./src/screens/FamilyProfileScreen";
import FamilyMomentsScreen from "./src/screens/FamilyMomentsScreen";
import FamilyAIScreen from "./src/screens/FamilyAIScreen";
import PostInsightsScreen from "./src/screens/PostInsightsScreen";
import AccountSwitcherScreen from "./src/screens/AccountSwitcherScreen";
import OnThisDayScreen from "./src/screens/OnThisDayScreen";
import ConnectionCRMScreen from "./src/screens/ConnectionCRMScreen";
import EditProfileScreen from "./src/screens/EditProfileScreen";
import PostDetailScreen from "./src/screens/PostDetailScreen";
import MessageRequestsScreen from "./src/screens/MessageRequestsScreen";
import CallScreen from "./src/screens/CallScreen";
import CallLogsScreen from "./src/screens/CallLogsScreen";
import ReelsScreen from "./src/screens/ReelsScreen";
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

// ── Custom Tab Bar ───────────────────────────────────────────
const TAB_ITEMS = [
  { name: 'Feed',     icon: 'home-outline',        iconFilled: 'home',        label: 'Home'    },
  { name: 'Search',   icon: 'compass-outline',      iconFilled: 'compass',     label: 'Discover' },
  { name: 'Create',   icon: 'add',                  iconFilled: 'add',         label: ''        },
  { name: 'Reels',    icon: 'film-outline',          iconFilled: 'film',        label: 'Reels'   },
  { name: 'Messages', icon: 'chatbubbles-outline',   iconFilled: 'chatbubbles', label: 'Messages' },
  { name: 'Profile',  icon: 'person-outline',        iconFilled: 'person',      label: 'Profile' },
];

function CustomTabBar({ state, navigation, msgUnread, notifUnread, theme, user }) {
  const scales = useRef(TAB_ITEMS.map(() => new Animated.Value(1))).current;

  const handlePress = (name, index, isFocused) => {
    Animated.sequence([
      Animated.timing(scales[index], { toValue: 0.82, duration: 80, useNativeDriver: true }),
      Animated.spring(scales[index], { toValue: 1, useNativeDriver: true, speed: 20 }),
    ]).start();
    if (!isFocused) {
      if (name === 'Create') {
        navigation.navigate(name, { initialMode: 'story' });
      } else {
        navigation.navigate(name);
      }
    }
  };

  const isDark = theme.mode === 'dark';
  const barBg = isDark ? 'rgba(11,15,26,0.97)' : 'rgba(248,250,252,0.97)';
  const borderCol = isDark ? 'rgba(124,58,237,0.2)' : 'rgba(124,58,237,0.12)';

  return (
    <View style={nb.wrapper} pointerEvents="box-none">
      <BlurView
        intensity={Platform.OS === 'ios' ? 60 : 100}
        tint={isDark ? 'dark' : 'light'}
        style={[nb.blur, { backgroundColor: barBg, borderColor: borderCol }]}
      >
        {/* Gold/green top accent line */}
        <View style={[nb.topLine, {
          backgroundColor: '#7C3AED',
        }]} />

        <View style={nb.row}>
          {TAB_ITEMS.map((item, index) => {
            const isFocused = state.index === index;
            const isCreate = item.name === 'Create';

            const badge =
              item.name === 'Messages' ? msgUnread :
              item.name === 'Feed'     ? notifUnread : 0;

            return (
              <TouchableOpacity
                key={item.name}
                onPress={() => handlePress(item.name, index, isFocused)}
                activeOpacity={1}
                style={nb.tab}
              >
                <Animated.View
                  style={[
                    nb.tabInner,
                    { transform: [{ scale: scales[index] }] },
                  ]}
                >
                  {isCreate ? (
                    <LinearGradient
                      colors={['#7C3AED', '#3B82F6']}
                      style={nb.createBtn}
                    >
                      <Ionicons name="add" size={30} color="#fff" />
                    </LinearGradient>
                  ) : (
                    <View style={nb.iconWrap}>
                      {isFocused && (
                        <View style={[nb.activeDot, { backgroundColor: theme.primary }]} />
                      )}

                      {/* Active tab gets a subtle pill background */}
                      {isFocused && (
                        <View style={[nb.activePill, {
                          backgroundColor: isDark
                            ? 'rgba(124,58,237,0.15)'
                            : 'rgba(124,58,237,0.1)',
                        }]} />
                      )}

                      {/* Profile tab — show user avatar instead of icon */}
                      {item.name === 'Profile' ? (
                        <View style={[
                          nb.avatarWrap,
                          isFocused && { borderColor: theme.primary, borderWidth: 2 },
                          !isFocused && { borderColor: theme.dim, borderWidth: 1.5 },
                        ]}>
                          {user?.avatar_url ? (
                            <Image
                              source={{ uri: user.avatar_url }}
                              style={nb.avatarImg}
                            />
                          ) : (
                            <View style={[nb.avatarFallback, { backgroundColor: theme.primary }]}>
                              <AppText style={nb.avatarLetter}>
                                {user?.name?.[0]?.toUpperCase() || 'U'}
                              </AppText>
                            </View>
                          )}
                        </View>
                      ) : (
                        <Ionicons
                          name={isFocused ? item.iconFilled : item.icon}
                          size={24}
                          color={isFocused ? theme.primary : theme.dim}
                        />
                      )}

                      {isFocused && (
                        <AppText style={[nb.label, { color: theme.primary }]}>
                          {item.label}
                        </AppText>
                      )}

                      {badge > 0 && (
                        <View style={nb.badge}>
                          <AppText style={nb.badgeText}>
                            {badge > 9 ? '9+' : badge}
                          </AppText>
                        </View>
                      )}
                    </View>
                  )}
                </Animated.View>
              </TouchableOpacity>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const nb = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    zIndex: 999,
  },
  blur: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  topLine: {
    height: 1,
    opacity: 0.35,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  activePill: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 14,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginBottom: 3,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  createBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#C0392B',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  avatarWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
});

// ── Main Tabs ─────────────────────────────────────────────────
function MainTabs() {
  const { theme } = useTheme();
  const { user } = useAuth();
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
      screenOptions={{ headerShown: false }}
      tabBar={(props) => (
        <CustomTabBar
          {...props}
          msgUnread={msgUnread}
          notifUnread={notifUnread}
          theme={theme}
          user={user}
        />
      )}
    >
      <Tab.Screen name="Feed"     component={FeedScreen} />
      <Tab.Screen name="Search"   component={SearchScreen} />
      <Tab.Screen name="Create"   component={CreateScreen} />
      <Tab.Screen name="Reels"    component={ReelsScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Profile"  component={ProfileScreen} />
    </Tab.Navigator>
  );
}

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
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center", gap: 12 }}>
        <ActivityIndicator color="#7c3aed" size="large" />
        <AppText style={{ color: theme.dim, fontSize: 13 }}>Connecting to server…</AppText>
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
      ) : (
        // User is logged in and profile is complete - go to Main
        // Family is now optional, so we don't block on !user.family_id
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="Chat" component={ChatScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="StoryViewer" component={StoryViewerScreen} options={{ animation: "fade", presentation: "fullScreenModal" }} />
          <Stack.Screen name="StoryCamera" component={StoryCameraScreen} options={{ animation: "slide_from_bottom", presentation: "fullScreenModal", headerShown: false }} />
          <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="Family" component={FamilyScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="Timeline" component={TimelineScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="FeedAI" component={FeedAI} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="Storybooks" component={StorybooksScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="StorybookGenerator" component={StorybookGeneratorScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="StorybookViewer" component={StorybookViewerScreen} options={{ animation: "slide_from_right", presentation: "modal" }} />
          <Stack.Screen name="AIProcessing" component={AIProcessingScreen} options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="MediaEditor" component={MediaEditorScreen} options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="VoiceRecorder" component={VoiceRecorderScreen} options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="FamilyTree" component={FamilyTreeScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="FamilyCalendar" component={FamilyCalendarScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="FamilyRecipes" component={FamilyRecipesScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="FamilyBudget" component={FamilyBudgetScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="FamilyProfile" component={FamilyProfileScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="FamilyMoments" component={FamilyMomentsScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="FamilyProfileEdit" component={FamilyProfileScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="FamilyAI" component={FamilyAIScreen} options={{ animation: "slide_from_right" }} />
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
