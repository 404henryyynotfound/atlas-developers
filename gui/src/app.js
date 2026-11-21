'use strict';

/** Classic script for the optional desktop shell documentation page. */

(function () {
  var version = document.getElementById('app-version');
  var platform = document.getElementById('app-platform');
  var bridge = window.atlasDesktop;

  if (version && bridge && typeof bridge.getVersion === 'function') {
    bridge.getVersion().then(function (value) { version.textContent = value; }).catch(function () {});
  }
  if (platform && bridge && bridge.platform) platform.textContent = bridge.platform;

  var open = document.getElementById('open-data');
  if (open && bridge && typeof bridge.openDataFolder === 'function') {
    open.addEventListener('click', function () { bridge.openDataFolder(); });
  } else if (open) {
    open.textContent = 'Open data folder (desktop app only)';
    open.disabled = true;
  }
})();
