const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const fs = require('fs');
const path = require('path');
const escape = require('escape-string-regexp');
const exclusionList = require('metro-config/src/defaults/exclusionList');
const pak = require('../package.json');

const root = path.resolve(__dirname, '..');
const modules = Object.keys({ ...pak.peerDependencies });

function peerPath(name) {
  const exampleCopy = path.join(__dirname, 'node_modules', name);
  const rootCopy = path.join(root, 'node_modules', name);
  if (fs.existsSync(exampleCopy) && !fs.lstatSync(exampleCopy).isSymbolicLink()) {
    return exampleCopy;
  }
  return rootCopy;
}

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  watchFolders: [root],

  // One copy of each peer. Prefer the example install; otherwise use the hoisted root copy.
  resolver: {
    blacklistRE: exclusionList(
      modules
        .filter((m) => peerPath(m) !== path.join(root, 'node_modules', m))
        .map(
          (m) =>
            new RegExp(`^${escape(path.join(root, 'node_modules', m))}\\/.*$`)
        )
    ),

    extraNodeModules: modules.reduce((acc, name) => {
      acc[name] = peerPath(name);
      return acc;
    }, {}),
  },

  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
