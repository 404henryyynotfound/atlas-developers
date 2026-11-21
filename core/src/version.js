'use strict';

// Keep the CLI/GUI version in sync with the published package instead of a
// hand-edited constant in source.
function packageVersion() {
  try {
    return require('../package.json').version;
  } catch {
    return '0.0.0';
  }
}

const VERSION = packageVersion();

function version() {
  return VERSION;
}

module.exports = { VERSION, version };
