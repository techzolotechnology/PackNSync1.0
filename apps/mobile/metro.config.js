const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const monorepoCandidate = path.resolve(projectRoot, '../..');
const monorepoPackagePath = path.join(monorepoCandidate, 'package.json');
const isMonorepo = fs.existsSync(monorepoPackagePath)
  && Boolean(JSON.parse(fs.readFileSync(monorepoPackagePath, 'utf8')).workspaces);
const monorepoRoot = isMonorepo ? monorepoCandidate : projectRoot;

const config = getDefaultConfig(projectRoot);

config.watchFolders = isMonorepo ? [monorepoRoot] : [];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  ...(isMonorepo ? [path.resolve(monorepoRoot, 'node_modules')] : []),
];
// Prevent resolving the wrong nested RN under expo/node_modules (0.85.x).
config.resolver.disableHierarchicalLookup = true;
config.resolver.extraNodeModules = {
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
  react: path.resolve(projectRoot, 'node_modules/react'),
  expo: path.resolve(projectRoot, 'node_modules/expo'),
};

module.exports = config;
