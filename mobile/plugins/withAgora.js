const { withAndroidManifest, withInfoPlist } = require('@expo/config-plugins');

// Adds Agora-required permissions to Android manifest and iOS Info.plist
// without importing react-native-agora (which breaks on Node 20)

function withAgoraAndroid(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const mainApp = manifest.manifest;

    if (!mainApp['uses-permission']) mainApp['uses-permission'] = [];

    const perms = [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.READ_PHONE_STATE',
    ];

    const existing = new Set(
      mainApp['uses-permission'].map((p) => p.$?.['android:name'])
    );

    for (const perm of perms) {
      if (!existing.has(perm)) {
        mainApp['uses-permission'].push({ $: { 'android:name': perm } });
      }
    }

    return cfg;
  });
}

function withAgoraIOS(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.NSCameraUsageDescription =
      cfg.modResults.NSCameraUsageDescription || 'KinsCribe needs camera access for video calls.';
    cfg.modResults.NSMicrophoneUsageDescription =
      cfg.modResults.NSMicrophoneUsageDescription || 'KinsCribe needs microphone access for calls.';
    return cfg;
  });
}

module.exports = function withAgora(config) {
  config = withAgoraAndroid(config);
  config = withAgoraIOS(config);
  return config;
};
