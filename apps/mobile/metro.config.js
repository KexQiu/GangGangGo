const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [
  path.resolve(workspaceRoot, 'packages/contracts'),
];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.extraNodeModules = {
  expo: path.resolve(workspaceRoot, 'node_modules/expo'),
  'expo-image-manipulator': path.resolve(workspaceRoot, 'node_modules/expo-image-manipulator'),
  'expo-image-picker': path.resolve(workspaceRoot, 'node_modules/expo-image-picker'),
};

module.exports = config;
