const fs = require('fs');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const nodeModulesPaths = [
  path.join(projectRoot, 'node_modules'),
  path.join(workspaceRoot, 'node_modules'),
];
const config = getDefaultConfig(projectRoot);

// SDK 51 needs explicit access to hoisted dependencies. Watching just this
// directory avoids crawling unrelated workspace files or external skill trees.
// Standalone EAS copies have no parent workspace installation.
config.watchFolders = nodeModulesPaths.slice(1).filter(directory => fs.existsSync(directory));
config.resolver.nodeModulesPaths = nodeModulesPaths;
config.maxWorkers = 2;

// Resolve singleton packages from the app's installation, including hoisted
// installations, never from a dependency's nested peer dependency tree.
const versions = { react: '18.2.0', 'react-native': '0.74.5', 'react-dom': '18.2.0' };
const packageRoots = Object.fromEntries(Object.entries(versions).map(([name, version]) => {
  for (const directory of nodeModulesPaths) {
    const packageRoot = path.join(directory, name);
    const manifest = path.join(packageRoot, 'package.json');
    if (fs.existsSync(manifest) && JSON.parse(fs.readFileSync(manifest, 'utf8')).version === version) {
      return [name, packageRoot];
    }
  }
  throw new Error(`Metro requires ${name}@${version} in the mobile or workspace node_modules. Restore the workspace dependencies before bundling.`);
}));

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  ...packageRoots,
};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const name = Object.keys(packageRoots).find(packageName =>
    moduleName === packageName || moduleName.startsWith(`${packageName}/`));
  const request = name
    ? path.join(packageRoots[name], moduleName.slice(name.length))
    : moduleName;
  // Preserve Metro's platform extensions, package entry points and browser maps.
  return context.resolveRequest(context, request, platform);
};

module.exports = config;
