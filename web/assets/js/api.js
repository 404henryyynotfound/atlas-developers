/** Optional atlas-sync bridge. Local-only by default; no OAuth anywhere. */

import { store, normalizeData } from './store.js';

let source = null;
let state = { mode: 'local', endpoint: '', error: '', lastSync: '' };
let changeListener = null;

function snapshot() {
  return { ...state, connected: Boolean(source) };
}

function notify() {
  if (typeof changeListener === 'function') changeListener(snapshot());
}

function disconnect() {
  if (source && typeof source.close === 'function') source.close();
  source = null;
  state = { ...state, mode: 'local', connected: false };
  notify();
}

function connect(endpoint, token, onChange) {
  disconnect();
  changeListener = typeof onChange === 'function' ? onChange : null;
  const url = String(endpoint || '').trim();
  if (!url) { notify(); return snapshot(); }
  if (typeof window.EventSource !== 'function') {
    state.error = 'This browser does not support EventSource; staying local.';
    notify();
    return snapshot();
  }
  try {
    const separator = url.includes('?') ? '&' : '?';
    const streamUrl = `${url}${separator}token=${encodeURIComponent(String(token || ''))}`;
    source = new window.EventSource(streamUrl);
    state = { mode: 'cloud', endpoint: url, error: '', lastSync: state.lastSync };
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload && payload.data) {
          store.save(normalizeData(payload.data));
          state.lastSync = new Date().toISOString();
          notify();
        }
      } catch (_) {
        state.error = 'Received a malformed sync update; local data unchanged.';
        notify();
      }
    };
    source.onerror = () => {
      state.error = 'Sync stream unavailable; continuing with local data.';
      if (source && typeof source.close === 'function') source.close();
      source = null;
      state.mode = 'local';
      notify();
    };
  } catch (_) {
    state.error = 'Could not connect to sync endpoint; continuing with local data.';
    notify();
  }
  return snapshot();
}

async function publish(data) {
  const url = String(state.endpoint || '').trim();
  if (!url || !source) return { ok: false, reason: 'local mode' };
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data, clientId: store.get().settings.clientId })
    });
    return { ok: response.ok, status: response.status };
  } catch (_) {
    return { ok: false, reason: 'network unavailable' };
  }
}

export const api = { connect, disconnect, publish, snapshot };
export default api;
