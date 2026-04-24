import { useState, useEffect, useRef } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Animated,
  Dimensions, StatusBar, Image, Vibration, PanResponder, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AppText from '../components/AppText';
import api from '../api/axios';

// ── Try to import Agora — gracefully degrade if not in dev build ──
let RtcEngine, RtcSurfaceView, ChannelProfileType, ClientRoleType, IRtcEngine;
try {
  const Agora = require('react-native-agora');
  RtcEngine = Agora.createAgoraRtcEngine;
  RtcSurfaceView = Agora.RtcSurfaceView;
  ChannelProfileType = Agora.ChannelProfileType;
  ClientRoleType = Agora.ClientRoleType;
} catch {
  RtcEngine = null;
}

const AGORA_APP_ID = '339b4c69704b45298cc7e2a441aa4aa9';
const { width: W, height: H } = Dimensions.get('window');

function formatDuration(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function CallerAvatar({ uri, name, size = 110 }) {
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <LinearGradient
      colors={['#2D5A27', '#4A7C3F']}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
    >
      <AppText style={{ color: '#fff', fontSize: size * 0.4, fontWeight: '800' }}>
        {name?.[0]?.toUpperCase() || '?'}
      </AppText>
    </LinearGradient>
  );
}

function PulseRing({ size, color, delay = 0 }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.parallel([
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(scale, { toValue: 1.6, duration: 1400, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, { toValue: 0, duration: 1400, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.7, duration: 0, useNativeDriver: true }),
      ]),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', width: size, height: size, borderRadius: size / 2,
      borderWidth: 2, borderColor: color, transform: [{ scale }], opacity,
    }} />
  );
}

function CtrlBtn({ icon, onPress, active, danger, size = 58 }) {
  const bg = danger ? 'rgba(192,57,43,0.22)' : active ? 'rgba(74,124,63,0.3)' : 'rgba(255,255,255,0.12)';
  const iconColor = danger ? '#e74c3c' : active ? '#7FB069' : '#fff';
  return (
    <TouchableOpacity
      style={[s.ctrlBtn, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}
      onPress={onPress} activeOpacity={0.75}
    >
      <Ionicons name={icon} size={size * 0.4} color={iconColor} />
    </TouchableOpacity>
  );
}

function ConnectingDot({ delay }) {
  const anim = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(anim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0.25, duration: 500, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[s.connectDot, { opacity: anim }]} />;
}

// ─────────────────────────────────────────────────────────────

export default function CallScreen({ route, navigation }) {
  const {
    callType = 'voice',
    callerName = 'Unknown',
    callerAvatar = null,
    isIncoming = false,
    participants = [],
    conversationId = null,
    myName = 'Someone',
    // Passed when receiving an incoming call
    incomingChannel = null,
    incomingToken = null,
    incomingCallerId = null,
  } = route.params || {};

  const [callState, setCallState] = useState(isIncoming ? 'ringing' : 'calling');
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(callType !== 'voice');
  const [cameraOff, setCameraOff] = useState(false);
  const [facing, setFacing] = useState('front'); // 'front' | 'back'
  const [onHold, setOnHold] = useState(false);
  const [remoteUid, setRemoteUid] = useState(null);
  const [agoraReady, setAgoraReady] = useState(false);
  const [networkQuality, setNetworkQuality] = useState(null); // 'poor' | null

  const engineRef = useRef(null);
  const channelRef = useRef(incomingChannel || null);
  const tokenRef = useRef(incomingToken || null);
  const timerRef = useRef(null);
  const slideAnim = useRef(new Animated.Value(H)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // PiP drag
  const pipPos = useRef({ x: W - 114, y: 108 });
  const pipX = useRef(new Animated.Value(W - 114)).current;
  const pipY = useRef(new Animated.Value(108)).current;
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, { dx, dy }) => {
      pipX.setValue(pipPos.current.x + dx);
      pipY.setValue(pipPos.current.y + dy);
    },
    onPanResponderRelease: (_, { dx, dy }) => {
      const nx = Math.max(18, Math.min(pipPos.current.x + dx, W - 114));
      const ny = Math.max(108, Math.min(pipPos.current.y + dy, H - 200));
      pipPos.current = { x: nx, y: ny };
      Animated.spring(pipX, { toValue: nx, useNativeDriver: false }).start();
      Animated.spring(pipY, { toValue: ny, useNativeDriver: false }).start();
    },
  })).current;

  // ── Agora engine setup ─────────────────────────────────────
  const initAgora = async (channel, token) => {
    if (!RtcEngine) return; // Expo Go fallback
    try {
      const engine = RtcEngine();
      engineRef.current = engine;

      await engine.initialize({
        appId: AGORA_APP_ID,
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
      });

      engine.addListener('onUserJoined', (connection, uid) => {
        setRemoteUid(uid);
        setCallState('active');
        startTimer();
      });

      engine.addListener('onUserOffline', () => {
        setRemoteUid(null);
        endCall(false);
      });

      engine.addListener('onNetworkQuality', (conn, uid, txQuality, rxQuality) => {
        const worst = Math.max(txQuality, rxQuality);
        setNetworkQuality(worst >= 4 ? 'poor' : null);
      });

      if (callType === 'video') {
        await engine.enableVideo();
        await engine.startPreview();
      } else {
        await engine.enableAudio();
      }

      await engine.joinChannel(token || '', channel, 0, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
      });

      setAgoraReady(true);
    } catch (e) {
      console.warn('Agora init error:', e);
    }
  };

  const leaveAgora = async () => {
    if (!engineRef.current) return;
    try {
      await engineRef.current.leaveChannel();
      engineRef.current.release();
      engineRef.current = null;
    } catch {}
  };

  // ── Mount ──────────────────────────────────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 55, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();

    if (isIncoming) {
      Vibration.vibrate([0, 600, 400, 600, 400, 600], true);
    } else {
      // Outgoing — start call on backend, get channel + token
      startOutgoingCall();
    }

    return () => {
      Vibration.cancel();
      clearInterval(timerRef.current);
      leaveAgora();
    };
  }, []);

  const startOutgoingCall = async () => {
    try {
      const { data } = await api.post('/calls/start', {
        call_type: callType,
        callee_id: route.params?.calleeId || null,
        conversation_id: conversationId,
      });
      channelRef.current = data.channel;
      tokenRef.current = data.token;

      // Post "started" system message to chat
      if (conversationId) {
        const typeLabel = callType === 'video' ? 'video call' : callType === 'group' ? 'group call' : 'voice call';
        await api.post(`/messages/conversations/${conversationId}/messages`, {
          text: `${myName} started a ${typeLabel}`,
          message_type: 'call_started',
        }).catch(() => {});
      }

      await initAgora(data.channel, data.token);
    } catch (e) {
      Alert.alert('Call failed', 'Could not connect. Please try again.');
      navigation.goBack();
    }
  };

  // ── Helpers ────────────────────────────────────────────────
  const startTimer = () => {
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  };

  const acceptCall = async () => {
    Vibration.cancel();
    try {
      const { data } = await api.post('/calls/answer', { channel: incomingChannel });
      channelRef.current = data.channel;
      tokenRef.current = data.token;
      setCallState('connecting');
      await initAgora(data.channel, data.token);
      setCallState('active');
      startTimer();
    } catch {
      Alert.alert('Error', 'Could not join call.');
      navigation.goBack();
    }
  };

  const endCall = async (postEvent = true) => {
    Vibration.cancel();
    clearInterval(timerRef.current);

    if (postEvent && callState === 'active' && conversationId) {
      const typeLabel = callType === 'video' ? 'Video call' : callType === 'group' ? 'Group call' : 'Voice call';
      await api.post(`/messages/conversations/${conversationId}/messages`, {
        text: `${typeLabel} ended · ${formatDuration(duration)}`,
        message_type: 'call_ended',
      }).catch(() => {});
    }

    if (channelRef.current) {
      await api.post('/calls/end', { channel: channelRef.current }).catch(() => {});
    }

    await leaveAgora();
    setCallState('ended');

    Animated.parallel([
      Animated.timing(slideAnim, { toValue: H, duration: 320, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start(() => navigation.goBack());
  };

  const declineCall = async () => {
    Vibration.cancel();
    if (incomingChannel) {
      await api.post('/calls/decline', { channel: incomingChannel }).catch(() => {});
    }
    navigation.goBack();
  };

  // ── Agora controls ─────────────────────────────────────────
  const toggleMute = async () => {
    if (engineRef.current) await engineRef.current.muteLocalAudioStream(!muted);
    setMuted(m => !m);
  };

  const toggleSpeaker = async () => {
    if (engineRef.current) await engineRef.current.setEnableSpeakerphone(!speakerOn);
    setSpeakerOn(v => !v);
  };

  const toggleCamera = async () => {
    if (engineRef.current) await engineRef.current.muteLocalVideoStream(!cameraOff);
    setCameraOff(v => !v);
  };

  const flipCamera = async () => {
    if (engineRef.current) await engineRef.current.switchCamera();
    setFacing(f => f === 'front' ? 'back' : 'front');
  };

  // ── Status label ───────────────────────────────────────────
  const statusLabel = () => {
    if (callState === 'ringing') return 'Incoming call...';
    if (callState === 'calling') return 'Calling...';
    if (callState === 'connecting') return 'Connecting...';
    if (callState === 'ended') return 'Call ended';
    if (onHold) return 'On hold';
    if (networkQuality === 'poor') return '⚠️ Poor connection';
    return formatDuration(duration);
  };

  const isVideo = callType === 'video';
  const isGroup = callType === 'group';
  const isActive = callState === 'active';
  const isWaiting = callState === 'ringing' || callState === 'calling' || callState === 'connecting';

  // ── Render ─────────────────────────────────────────────────
  return (
    <Animated.View style={[s.root, { transform: [{ translateY: slideAnim }], opacity: fadeAnim }]}>
      <StatusBar barStyle="light-content" />

      <LinearGradient
        colors={isVideo ? ['#050a05', '#0d1a0d', '#050a05'] : ['#0a1408', '#1C3A18', '#0a1408']}
        style={StyleSheet.absoluteFill}
      />
      <View style={[s.blob, s.blob1]} />
      <View style={[s.blob, s.blob2]} />

      {/* ── Video: waiting — your camera full screen ── */}
      {isVideo && isWaiting && agoraReady && !cameraOff && RtcSurfaceView && (
        <View style={s.fullVideoWrap}>
          <RtcSurfaceView style={StyleSheet.absoluteFill} canvas={{ uid: 0 }} />
        </View>
      )}

      {/* ── Video: active — remote full screen ── */}
      {isVideo && isActive && remoteUid && RtcSurfaceView && (
        <View style={s.fullVideoWrap}>
          <RtcSurfaceView style={StyleSheet.absoluteFill} canvas={{ uid: remoteUid }} />
        </View>
      )}
      {isVideo && isActive && !remoteUid && (
        <View style={[s.fullVideoWrap, { alignItems: 'center', justifyContent: 'center' }]}>
          <LinearGradient colors={['#0d1a0d', '#050a05']} style={StyleSheet.absoluteFill} />
          <Ionicons name="person" size={80} color="rgba(255,255,255,0.08)" />
          <AppText style={s.remoteLabel}>Waiting for video...</AppText>
        </View>
      )}

      {/* ── Video: active — your PiP (draggable) ── */}
      {isVideo && isActive && agoraReady && !cameraOff && RtcSurfaceView && (
        <Animated.View {...panResponder.panHandlers} style={[s.pipWrap, { left: pipX, top: pipY }]}>
          <RtcSurfaceView style={StyleSheet.absoluteFill} canvas={{ uid: 0 }} />
        </Animated.View>
      )}
      {isVideo && isActive && cameraOff && (
        <Animated.View style={[s.pipWrap, s.pipOff, { left: pipX, top: pipY }]}>
          <Ionicons name="videocam-off" size={22} color="rgba(255,255,255,0.35)" />
        </Animated.View>
      )}

      {/* ── Main UI overlay ── */}
      <View style={[s.content, isVideo && s.contentVideo]}>

        {/* Top bar */}
        <View style={s.topBar}>
          <TouchableOpacity style={s.topBtn} onPress={() => endCall()}>
            <Ionicons name="chevron-down" size={24} color="rgba(255,255,255,0.65)" />
          </TouchableOpacity>
          <AppText style={s.topTitle}>
            {isVideo ? 'Video Call' : isGroup ? 'Group Call' : 'Voice Call'}
          </AppText>
          <View style={s.topBtn} />
        </View>

        {/* Avatar + name (voice calls or waiting) */}
        {!isGroup && !(isVideo && isActive) && (
          <View style={s.avatarSection}>
            <View style={s.avatarWrap}>
              {isWaiting && (
                <>
                  <PulseRing size={150} color="rgba(74,124,63,0.55)" delay={0} />
                  <PulseRing size={190} color="rgba(74,124,63,0.25)" delay={400} />
                </>
              )}
              <CallerAvatar uri={callerAvatar} name={callerName} size={110} />
            </View>
            <AppText style={s.callerName}>{callerName}</AppText>
            <View style={s.statusRow}>
              {isActive && !onHold && <View style={s.activeDot} />}
              <AppText style={[s.statusText, isActive && !onHold && s.statusActive]}>
                {statusLabel()}
              </AppText>
            </View>
            {callState === 'calling' && (
              <View style={s.connectingDots}>
                {[0, 200, 400].map((d, i) => <ConnectingDot key={i} delay={d} />)}
              </View>
            )}
          </View>
        )}

        {/* Video active — just show name + status at bottom */}
        {isVideo && isActive && (
          <View style={s.videoNameRow}>
            <AppText style={s.videoCallerName}>{callerName}</AppText>
            <AppText style={s.videoStatus}>{statusLabel()}</AppText>
          </View>
        )}

        {/* Group grid */}
        {isGroup && (
          <View style={s.groupGrid}>
            {(participants.length > 0 ? participants : [{ id: 'you', name: callerName, avatar: callerAvatar }])
              .slice(0, 6).map((p, i) => (
                <View key={p.id || i} style={s.groupTile}>
                  <CallerAvatar uri={p.avatar} name={p.name} size={72} />
                  <AppText style={s.groupTileName} numberOfLines={1}>{p.name}</AppText>
                </View>
              ))}
          </View>
        )}
        {isGroup && (
          <View style={s.groupStatusRow}>
            <AppText style={s.callerName}>Family Group Call</AppText>
            <AppText style={[s.statusText, isActive && s.statusActive]}>{statusLabel()}</AppText>
          </View>
        )}

        {/* Controls */}
        <View style={s.controls}>
          {isActive && (
            <View style={s.ctrlRow}>
              <View style={s.ctrlItem}>
                <CtrlBtn icon={muted ? 'mic-off' : 'mic'} onPress={toggleMute} active={muted} danger={muted} />
                <AppText style={s.ctrlLabel}>{muted ? 'Unmute' : 'Mute'}</AppText>
              </View>
              <View style={s.ctrlItem}>
                <CtrlBtn icon={speakerOn ? 'volume-high' : 'volume-medium-outline'} onPress={toggleSpeaker} active={speakerOn} />
                <AppText style={s.ctrlLabel}>{speakerOn ? 'Speaker' : 'Earpiece'}</AppText>
              </View>
              {isVideo ? (
                <>
                  <View style={s.ctrlItem}>
                    <CtrlBtn icon={cameraOff ? 'videocam-off' : 'videocam'} onPress={toggleCamera} active={cameraOff} danger={cameraOff} />
                    <AppText style={s.ctrlLabel}>{cameraOff ? 'Camera off' : 'Camera'}</AppText>
                  </View>
                  <View style={s.ctrlItem}>
                    <CtrlBtn icon="camera-reverse-outline" onPress={flipCamera} />
                    <AppText style={s.ctrlLabel}>Flip</AppText>
                  </View>
                </>
              ) : (
                <View style={s.ctrlItem}>
                  <CtrlBtn icon={onHold ? 'play' : 'pause'} onPress={() => setOnHold(v => !v)} active={onHold} />
                  <AppText style={s.ctrlLabel}>{onHold ? 'Resume' : 'Hold'}</AppText>
                </View>
              )}
            </View>
          )}

          {/* Incoming: accept + decline */}
          {callState === 'ringing' && isIncoming && (
            <View style={s.incomingRow}>
              <View style={s.ctrlItem}>
                <TouchableOpacity style={s.declineBtn} onPress={declineCall}>
                  <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                </TouchableOpacity>
                <AppText style={s.ctrlLabel}>Decline</AppText>
              </View>
              <View style={s.ctrlItem}>
                <TouchableOpacity style={s.acceptBtn} onPress={acceptCall}>
                  <Ionicons name="call" size={30} color="#fff" />
                </TouchableOpacity>
                <AppText style={s.ctrlLabel}>Accept</AppText>
              </View>
            </View>
          )}

          {/* Outgoing / active: end button */}
          {(callState === 'calling' || callState === 'connecting' || isActive) && (
            <View style={s.endRow}>
              <TouchableOpacity style={s.endBtn} onPress={() => endCall()}>
                <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
              <AppText style={s.ctrlLabel}>End</AppText>
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a1408' },
  blob: { position: 'absolute', borderRadius: 999, opacity: 0.1 },
  blob1: { width: 320, height: 320, backgroundColor: '#4A7C3F', top: -100, left: -100 },
  blob2: { width: 260, height: 260, backgroundColor: '#2D5A27', bottom: 80, right: -80 },

  fullVideoWrap: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  remoteLabel: { color: 'rgba(255,255,255,0.18)', fontSize: 13, marginTop: 12 },

  pipWrap: {
    position: 'absolute', width: 96, height: 140,
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)', zIndex: 20,
  },
  pipOff: { backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },

  content: { flex: 1, paddingTop: 54, paddingBottom: 44, paddingHorizontal: 24, zIndex: 10 },
  contentVideo: { backgroundColor: 'transparent' },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  topBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.65)', letterSpacing: 0.3 },

  avatarSection: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  avatarWrap: { width: 150, height: 150, alignItems: 'center', justifyContent: 'center' },
  callerName: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5, textAlign: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7FB069' },
  statusText: { fontSize: 15, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  statusActive: { color: '#7FB069', fontWeight: '700' },
  connectingDots: { flexDirection: 'row', gap: 8, marginTop: 8 },
  connectDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#7FB069' },

  videoNameRow: { flex: 1, justifyContent: 'flex-end', paddingBottom: 12, alignItems: 'center' },
  videoCallerName: { fontSize: 22, fontWeight: '800', color: '#fff', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  videoStatus: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 },

  groupGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', gap: 20, paddingVertical: 16 },
  groupTile: { alignItems: 'center', gap: 6, width: (W - 96) / 3 },
  groupTileName: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textAlign: 'center' },
  groupStatusRow: { alignItems: 'center', gap: 6, paddingBottom: 12 },

  controls: { gap: 20, paddingBottom: 4 },
  ctrlRow: { flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap', gap: 12 },
  ctrlItem: { alignItems: 'center', gap: 7, minWidth: 60 },
  ctrlBtn: { alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  ctrlLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '500', textAlign: 'center' },

  endRow: { alignItems: 'center', gap: 8 },
  endBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#c0392b', alignItems: 'center', justifyContent: 'center', shadowColor: '#c0392b', shadowOpacity: 0.55, shadowRadius: 18, elevation: 10 },
  incomingRow: { flexDirection: 'row', justifyContent: 'space-around' },
  declineBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#c0392b', alignItems: 'center', justifyContent: 'center', shadowColor: '#c0392b', shadowOpacity: 0.45, shadowRadius: 14, elevation: 7 },
  acceptBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#2D5A27', alignItems: 'center', justifyContent: 'center', shadowColor: '#4A7C3F', shadowOpacity: 0.55, shadowRadius: 18, elevation: 10 },
});
