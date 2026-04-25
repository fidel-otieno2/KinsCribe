import { useState, useEffect, useRef } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Animated,
  Dimensions, StatusBar, Image, Vibration, PanResponder, Alert, Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AppText from '../components/AppText';
import api from '../api/axios';

// ── Agora SDK (graceful fallback for Expo Go) ──────────────────
let createAgoraRtcEngine = null;
let RtcSurfaceView = null;
let VideoSourceType = null;
try {
  const Agora = require('react-native-agora');
  createAgoraRtcEngine = Agora.createAgoraRtcEngine;
  RtcSurfaceView = Agora.RtcSurfaceView;
  VideoSourceType = Agora.VideoSourceType;
} catch {}

const AGORA_APP_ID = '339b4c69704b45298cc7e2a441aa4aa9';
const { width: W, height: H } = Dimensions.get('window');

// ── Floating draggable self-preview ───────────────────────────
function FloatingSelf({ uid, cameraOff, callerAvatar }) {
  const pan = useRef(new Animated.ValueXY({ x: W - 120, y: 60 })).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({ x: pan.x._value, y: pan.y._value });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => pan.flattenOffset(),
    })
  ).current;

  return (
    <Animated.View
      style={[s.selfPreview, { transform: pan.getTranslateTransform() }]}
      {...panResponder.panHandlers}
    >
      {RtcSurfaceView && !cameraOff ? (
        <RtcSurfaceView
          style={{ width: 100, height: 140 }}
          canvas={{ uid: 0, sourceType: VideoSourceType?.VideoSourceCamera }}
        />
      ) : (
        <View style={s.selfPreviewOff}>
          {callerAvatar
            ? <Image source={{ uri: callerAvatar }} style={s.selfPreviewAvatar} />
            : <Ionicons name="person" size={28} color="rgba(255,255,255,0.5)" />}
        </View>
      )}
    </Animated.View>
  );
}

// ── Control button ─────────────────────────────────────────────
function CtrlBtn({ icon, label, onPress, active, danger, color }) {
  return (
    <TouchableOpacity style={s.ctrlWrap} onPress={onPress} activeOpacity={0.75}>
      <View style={[
        s.ctrlBtn,
        active && s.ctrlBtnActive,
        danger && s.ctrlBtnDanger,
      ]}>
        <Ionicons name={icon} size={24} color={danger ? '#fff' : active ? '#fff' : (color || '#fff')} />
      </View>
      {label ? <AppText style={s.ctrlLabel}>{label}</AppText> : null}
    </TouchableOpacity>
  );
}

// ── Group call grid tile ──────────────────────────────────────
function GroupTile({ uid, isActive, name, avatar }) {
  return (
    <View style={[s.gridTile, isActive && s.gridTileActive]}>
      {RtcSurfaceView && uid !== 0 ? (
        <RtcSurfaceView
          style={StyleSheet.absoluteFill}
          canvas={{ uid, sourceType: VideoSourceType?.VideoSourceRemote }}
        />
      ) : (
        <View style={s.gridTileOff}>
          {avatar
            ? <Image source={{ uri: avatar }} style={s.gridTileAvatar} />
            : <View style={s.gridTileInitial}>
                <AppText style={s.gridTileInitialText}>{(name || 'U')[0].toUpperCase()}</AppText>
              </View>}
        </View>
      )}
      <View style={s.gridTileLabel}>
        <AppText style={s.gridTileName} numberOfLines={1}>{name || `User ${uid}`}</AppText>
        {isActive && <View style={s.gridTileActiveDot} />}
      </View>
    </View>
  );
}

// ── Format duration ────────────────────────────────────────────
function fmtDuration(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ══════════════════════════════════════════════════════════════
export default function CallScreen({ route, navigation }) {
  const {
    callType = 'voice',
    isIncoming = false,
    callerName = 'Unknown',
    callerAvatar = null,
    conversationId,
    calleeId,
    incomingChannel,
    incomingToken,
  } = route.params || {};

  const [callState, setCallState] = useState(isIncoming ? 'ringing' : 'calling');
  const [muted, setMuted]         = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(callType === 'video');
  const [frontCam, setFrontCam]   = useState(true);
  const [duration, setDuration]   = useState(0);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [networkQuality, setNetworkQuality] = useState(null); // null | 'poor'
  const [activeSpeaker, setActiveSpeaker] = useState(null);

  const engineRef  = useRef(null);
  const channelRef = useRef(incomingChannel || null);
  const timerRef   = useRef(null);
  const startedRef = useRef(false); // prevent double-init

  // ── Init Agora ───────────────────────────────────────────────
  const initAgora = async (channel, token) => {
    if (!createAgoraRtcEngine || startedRef.current) return;
    startedRef.current = true;

    const engine = createAgoraRtcEngine();
    engineRef.current = engine;

    await engine.initialize({ appId: AGORA_APP_ID });
    await engine.setChannelProfile(1); // live broadcasting
    await engine.setClientRole(1);     // broadcaster

    await engine.enableAudio();
    await engine.setAudioProfile(4, 1); // music high quality + full band

    if (callType === 'video' || callType === 'group') {
      await engine.enableVideo();
      await engine.setVideoEncoderConfiguration({
        dimensions: { width: 640, height: 360 },
        frameRate: 15,
        bitrate: 800,
        orientationMode: 0,
      });
      await engine.startPreview();
    }

    await engine.setEnableSpeakerphone(speakerOn);

    // ── Listeners ──────────────────────────────────────────────
    engine.addListener('onActiveSpeaker', (connection, uid) => {
      setActiveSpeaker(uid);
    });

    engine.addListener('onUserJoined', (connection, uid) => {
      setRemoteUsers(prev => prev.includes(uid) ? prev : [...prev, uid]);
      setCallState('active');
      startTimer();
    });

    engine.addListener('onUserOffline', (connection, uid) => {
      setRemoteUsers(prev => prev.filter(id => id !== uid));
    });

    engine.addListener('onConnectionStateChanged', (connection, state) => {
      // state 4 = reconnecting, state 5 = failed
      if (state === 4) setCallState('reconnecting');
      if (state === 5) setCallState('failed');
      if (state === 3) setCallState('active'); // connected
    });

    engine.addListener('onNetworkQuality', (connection, uid, txQuality, rxQuality) => {
      const worst = Math.max(txQuality, rxQuality);
      if (worst >= 4) {
        setNetworkQuality('poor');
        // Auto-downgrade video → audio on poor network
        if ((callType === 'video' || callType === 'group') && !cameraOff) {
          engine.muteLocalVideoStream(true);
          setCameraOff(true);
        }
      } else {
        setNetworkQuality(null);
      }
    });

    engine.addListener('onTokenPrivilegeWillExpire', async () => {
      try {
        const { data } = await api.post('/calls/token', { channel_name: channel });
        engine.renewToken(data.token);
      } catch {}
    });

    await engine.joinChannel(token, channel, 0, {
      clientRoleType: 1,
      publishMicrophoneTrack: true,
      publishCameraTrack: callType === 'video' || callType === 'group',
      autoSubscribeAudio: true,
      autoSubscribeVideo: true,
    });
  };

  // ── Start outgoing call ──────────────────────────────────────
  const startCall = async () => {
    try {
      const { data } = await api.post('/calls/start', {
        callee_id: calleeId,
        call_type: callType,
        conversation_id: conversationId,
      });
      channelRef.current = data.channel;
      await initAgora(data.channel, data.token);
    } catch {
      Alert.alert('Error', 'Could not start call');
      navigation.goBack();
    }
  };

  // ── Accept incoming call ─────────────────────────────────────
  const acceptCall = async () => {
    Vibration.cancel();
    setCallState('connecting');
    try {
      const { data } = await api.post('/calls/answer', { channel: incomingChannel });
      channelRef.current = data.channel;
      await initAgora(data.channel, data.token);
    } catch {
      Alert.alert('Error', 'Could not join call');
      navigation.goBack();
    }
  };

  // ── Decline incoming call ────────────────────────────────────
  const declineCall = async () => {
    Vibration.cancel();
    try {
      await api.post('/calls/decline', { channel: incomingChannel });
    } catch {}
    navigation.goBack();
  };

  // ── End call ─────────────────────────────────────────────────
  const endCall = async () => {
    Vibration.cancel();
    clearInterval(timerRef.current);
    try {
      if (channelRef.current) {
        await api.post('/calls/end', {
          channel: channelRef.current,
          duration_secs: duration,
        });
      }
    } catch {}
    try {
      await engineRef.current?.leaveChannel();
      engineRef.current?.release();
    } catch {}
    setCallState('ended');
    navigation.goBack();
  };

  // ── Timer ────────────────────────────────────────────────────
  const startTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  };

  // ── Controls ─────────────────────────────────────────────────
  const toggleMute = async () => {
    await engineRef.current?.muteLocalAudioStream(!muted);
    setMuted(v => !v);
  };

  const toggleCamera = async () => {
    await engineRef.current?.muteLocalVideoStream(!cameraOff);
    setCameraOff(v => !v);
  };

  const toggleSpeaker = async () => {
    await engineRef.current?.setEnableSpeakerphone(!speakerOn);
    setSpeakerOn(v => !v);
  };

  const switchCamera = async () => {
    await engineRef.current?.switchCamera();
    setFrontCam(v => !v);
  };

  // ── Lifecycle ────────────────────────────────────────────────
  useEffect(() => {
    if (isIncoming) {
      Vibration.vibrate([0, 500, 300, 500], true);
    } else {
      startCall();
    }

    // Auto-timeout unanswered outgoing call after 30s
    const timeout = setTimeout(() => {
      if (!startedRef.current || callState === 'calling') {
        api.post('/calls/missed', { channel: channelRef.current }).catch(() => {});
        endCall();
      }
    }, 30000);

    return () => {
      clearTimeout(timeout);
      clearInterval(timerRef.current);
      Vibration.cancel();
      try { engineRef.current?.leaveChannel(); engineRef.current?.release(); } catch {}
    };
  }, []);

  // ── Status label ─────────────────────────────────────────────
  const statusLabel = () => {
    if (callState === 'calling')      return 'Calling…';
    if (callState === 'ringing')      return 'Incoming call…';
    if (callState === 'connecting')   return 'Connecting…';
    if (callState === 'reconnecting') return 'Reconnecting…';
    if (callState === 'failed')       return 'Call failed';
    if (networkQuality === 'poor')    return '⚠️ Poor network';
    if (callState === 'active')       return fmtDuration(duration);
    return '';
  };

  const isVideo  = callType === 'video' || callType === 'group';
  const isActive = callState === 'active' || callState === 'reconnecting';

  // ── Remote video (first remote user) ─────────────────────────
  const firstRemote = remoteUsers[0];

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* ── BACKGROUND: group grid OR remote video OR gradient ── */}
      {callType === 'group' && isActive ? (
        <View style={s.groupGrid}>
          <ScrollView contentContainerStyle={s.groupGridContent} showsVerticalScrollIndicator={false}>
            {/* Self tile */}
            <GroupTile uid={0} isActive={activeSpeaker === 0} name="You" avatar={callerAvatar} />
            {/* Remote tiles */}
            {remoteUsers.map(uid => (
              <GroupTile key={uid} uid={uid} isActive={activeSpeaker === uid} name={`User ${uid}`} />
            ))}
          </ScrollView>
        </View>
      ) : isVideo && isActive && firstRemote && RtcSurfaceView ? (
        <RtcSurfaceView
          style={StyleSheet.absoluteFill}
          canvas={{ uid: firstRemote, sourceType: VideoSourceType?.VideoSourceRemote }}
        />
      ) : (
        <LinearGradient
          colors={isVideo ? ['#0f0c29', '#302b63', '#24243e'] : ['#0f172a', '#1a0a2e', '#0f172a']}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* ── DARK OVERLAY when video active (for controls readability) ── */}
      {isVideo && isActive && (
        <View style={s.videoOverlay} pointerEvents="none" />
      )}

      {/* ── FLOATING SELF PREVIEW (video only, active) ── */}
      {isVideo && isActive && (
        <FloatingSelf uid={0} cameraOff={cameraOff} callerAvatar={callerAvatar} />
      )}

      {/* ── TOP STATUS BAR ── */}
      <View style={s.topBar}>
        {networkQuality === 'poor' && (
          <View style={s.networkBadge}>
            <Ionicons name="wifi" size={12} color="#f59e0b" />
            <AppText style={s.networkText}>Poor network</AppText>
          </View>
        )}
        {callState === 'reconnecting' && (
          <View style={[s.networkBadge, { backgroundColor: 'rgba(239,68,68,0.25)' }]}>
            <Ionicons name="reload" size={12} color="#ef4444" />
            <AppText style={[s.networkText, { color: '#ef4444' }]}>Reconnecting…</AppText>
          </View>
        )}
      </View>

      {/* ── CALLER INFO (voice call or pre-connect) ── */}
      {(!isVideo || !isActive) && (
        <View style={s.callerInfo}>
          {callerAvatar ? (
            <Image source={{ uri: callerAvatar }} style={s.avatar} />
          ) : (
            <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.avatarFallback}>
              <AppText style={s.avatarInitial}>
                {(callerName || 'U')[0].toUpperCase()}
              </AppText>
            </LinearGradient>
          )}
          <AppText style={s.callerName}>{callerName}</AppText>
          <AppText style={s.callStatus}>{statusLabel()}</AppText>
          {isVideo && (
            <View style={s.callTypeBadge}>
              <Ionicons name="videocam" size={13} color="#a78bfa" />
              <AppText style={s.callTypeBadgeText}>Video call</AppText>
            </View>
          )}
        </View>
      )}

      {/* ── ACTIVE CALL TIMER (video, shown top-center) ── */}
      {isVideo && isActive && (
        <View style={s.videoTimer}>
          <AppText style={s.videoTimerText}>{statusLabel()}</AppText>
        </View>
      )}

      {/* ── INCOMING CALL SCREEN ── */}
      {callState === 'ringing' && (
        <View style={s.incomingRow}>
          {/* Decline */}
          <TouchableOpacity style={s.declineBtn} onPress={declineCall} activeOpacity={0.8}>
            <View style={s.declineBtnInner}>
              <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </View>
            <AppText style={s.incomingBtnLabel}>Decline</AppText>
          </TouchableOpacity>

          {/* Accept */}
          <TouchableOpacity style={s.acceptBtn} onPress={acceptCall} activeOpacity={0.8}>
            <LinearGradient colors={['#22c55e', '#16a34a']} style={s.acceptBtnInner}>
              <Ionicons name="call" size={28} color="#fff" />
            </LinearGradient>
            <AppText style={s.incomingBtnLabel}>Accept</AppText>
          </TouchableOpacity>
        </View>
      )}

      {/* ── IN-CALL CONTROLS ── */}
      {callState !== 'ringing' && (
        <View style={s.controls}>
          <CtrlBtn
            icon={muted ? 'mic-off' : 'mic'}
            label={muted ? 'Unmute' : 'Mute'}
            onPress={toggleMute}
            active={muted}
          />

          <CtrlBtn
            icon={speakerOn ? 'volume-high' : 'volume-mute'}
            label="Speaker"
            onPress={toggleSpeaker}
            active={speakerOn}
          />

          {isVideo && (
            <CtrlBtn
              icon={cameraOff ? 'videocam-off' : 'videocam'}
              label={cameraOff ? 'Cam off' : 'Camera'}
              onPress={toggleCamera}
              active={cameraOff}
            />
          )}

          {isVideo && (
            <CtrlBtn
              icon="camera-reverse-outline"
              label="Flip"
              onPress={switchCamera}
            />
          )}

          {/* End call — always last */}
          <CtrlBtn
            icon="call"
            label="End"
            onPress={endCall}
            danger
          />
        </View>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  // Group call grid
  groupGrid: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0a14',
  },
  groupGridContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 4,
    paddingTop: 80,
    paddingBottom: 160,
  },
  gridTile: {
    width: (W - 12) / 2,
    height: (W - 12) / 2 * 1.2,
    margin: 2,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gridTileActive: {
    borderColor: '#22c55e',
  },
  gridTileOff: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
  },
  gridTileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  gridTileInitial: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridTileInitialText: { fontSize: 26, fontWeight: '800', color: '#fff' },
  gridTileLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  gridTileName: { flex: 1, fontSize: 12, fontWeight: '600', color: '#fff' },
  gridTileActiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },

  // Overlays
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },

  // Top bar
  topBar: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(245,158,11,0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
  },
  networkText: { fontSize: 12, color: '#f59e0b', fontWeight: '600' },

  // Caller info (voice / pre-connect)
  callerInfo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarFallback: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 44, fontWeight: '800', color: '#fff' },
  callerName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginTop: 18,
    letterSpacing: -0.5,
  },
  callStatus: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
    fontWeight: '500',
  },
  callTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.4)',
  },
  callTypeBadgeText: { fontSize: 12, color: '#a78bfa', fontWeight: '600' },

  // Video timer (shown top-center when video active)
  videoTimer: {
    position: 'absolute',
    top: 52,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    zIndex: 20,
  },
  videoTimerText: { fontSize: 14, color: '#fff', fontWeight: '700', letterSpacing: 1 },

  // Floating self-preview
  selfPreview: {
    position: 'absolute',
    width: 100,
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    zIndex: 30,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  selfPreviewOff: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfPreviewAvatar: { width: 60, height: 60, borderRadius: 30 },

  // Incoming call buttons
  incomingRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 60,
    paddingBottom: 60,
  },
  declineBtn: { alignItems: 'center', gap: 10 },
  declineBtnInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#e11d48',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: { alignItems: 'center', gap: 10 },
  acceptBtnInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomingBtnLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },

  // In-call controls bar
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 50,
    paddingTop: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  ctrlWrap: { alignItems: 'center', gap: 8, minWidth: 60 },
  ctrlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  ctrlBtnActive: {
    backgroundColor: 'rgba(124,58,237,0.5)',
    borderColor: '#7c3aed',
  },
  ctrlBtnDanger: {
    backgroundColor: '#e11d48',
    borderColor: '#e11d48',
  },
  ctrlLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '600',
    textAlign: 'center',
  },
});
