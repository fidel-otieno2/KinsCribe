const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude folders that don't exist / shouldn't be watched
config.watchFolders = [__dirname];
config.resolver.blockList = [
  /dist\/.*/,
  /\.expo\/.*/,
];

module.exports = config;
