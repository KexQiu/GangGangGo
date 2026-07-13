const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const contractsRoot = path.resolve(workspaceRoot, 'packages/contracts');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [path.resolve(workspaceRoot, 'packages/contracts')];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.extraNodeModules = {
  expo: path.resolve(workspaceRoot, 'node_modules/expo'),
};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isContractsEsmSource =
    context.originModulePath.startsWith(`${contractsRoot}${path.sep}`) &&
    moduleName.startsWith('.') &&
    moduleName.endsWith('.js');

  if (isContractsEsmSource) {
    return context.resolveRequest(context, moduleName.slice(0, -3), platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
