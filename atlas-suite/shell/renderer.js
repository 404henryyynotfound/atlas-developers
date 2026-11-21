/* Atlas Suite shell controller. No secrets are stored here; only the bearer
   tokens returned by Atlas Sync, scoped to the local desktop profile. */

(() => {
  const bridge = window.atlasSuite || {};
  const DEFAULT_ENDPOINT = 'https://atlas-sync.greenhenry441.workers.dev';
  const SESSION_KEY = 'atlasSuite.session.v1';
  const ENDPOINT_KEY = 'atlasSuite.endpoint.v1';
  const ACTIVE_KEY = 'atlasSuite.active.v1';

  const FALLBACK_APPS = [
    { id: 'meridian', name: 'Meridian Finance', short: 'Meridian', glyph: '▤', route: '#/app/overview', color: '#5f8cff' },
    { id: 'airo', name: 'Airo Finance', short: 'Airo', glyph: '◉', route: '#/app/overview', color: '#4fd1c5' },
    { id: 'tandem', name: 'Tandem Finance', short: 'Tandem', glyph: '◈', route: '#/app/overview', color: '#a78bfa' },
    { id: 'business', name: 'Atlas Business', short: 'Business', glyph: '▣', route: '#/app/overview', color: '#f5a524' },
    { id: 'calendar', name: 'Atlas Calendar', short: 'Calendar', glyph: '▦', route: '#/overview', color: '#e8c268' },
    { id: 'developers', name: 'Atlas Developers', short: 'Developers', glyph: '⌘', route: '#/overview', color: '#34d399' },
  ];

  const DATA_APPS = {
    airo: { session: 'airo.session.v1', dataPrefix: 'airo.data.v1.' },
    tandem: { session: 'tandem.session.v1', dataPrefix: 'tandem.data.v1.' },
    business: { session: 'atlasbiz.session.v1', dataPrefix: 'atlasbiz.data.v1.' },
  };

  let apps = [];
  let session = null;
  const views = new Map();
  let toastTimer = null;

  const $ = (id) => document.getElementById(id);

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  function toast(message) {
    const el = $('toast');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 4200);
  }

  function readJSON(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* non-fatal */ }
  }

  function normalizeEndpoint(value) {
    const raw = String(value || '').trim().replace(/\/+$/, '');
    const final = raw || DEFAULT_ENDPOINT;
    writeJSON(ENDPOINT_KEY, final);
    return final;
  }

  function updatePill() {
    const pill = $('sync-pill');
    const button = $('sync-btn');
    if (!pill) return;
    if (session?.user?.email) {
      pill.textContent = `Synced · ${session.user.email}`;
      pill.classList.add('live');
      if (button) button.textContent = '◈ Switch account';
    } else {
      pill.textContent = 'Local-only';
      pill.classList.remove('live');
      if (button) button.textContent = '◈ Atlas Sync';
    }
  }

  function renderNav() {
    const nav = $('app-nav');
    if (!nav) return;
    nav.innerHTML = apps.map(app => `
      <button class="nav-btn" type="button" data-app="${esc(app.id)}" title="${esc(app.name)}">
        <span class="nav-glyph" style="color:${esc(app.color || 'var(--gold)')}">${esc(app.glyph)}</span>
        <span class="nav-copy"><strong>${esc(app.short || app.name)}</strong><small>${esc(app.name)}</small></span>
      </button>`).join('');
    nav.querySelectorAll('.nav-btn').forEach(button => {
      button.addEventListener('click', () => selectApp(button.dataset.app));
    });
  }

  function createViews() {
    const host = $('views');
    if (!host) return;
    host.innerHTML = '';
    apps.forEach(app => {
      const wrap = document.createElement('div');
      wrap.className = 'view';
      wrap.dataset.app = app.id;

      const webview = document.createElement('webview');
      webview.setAttribute('partition', 'persist:atlas-suite');
      webview.setAttribute('allowpopups', '');
      webview.setAttribute('webpreferences', 'contextIsolation=true,nodeIntegration=false');
      webview.addEventListener('did-finish-load', () => {
        if (session) applySessionTo(app.id, webview, session);
      });

      wrap.appendChild(webview);
      host.appendChild(wrap);
      views.set(app.id, { wrap, webview, loaded: false });
    });
  }

  function selectApp(id) {
    const app = apps.find(item => item.id === id) || apps[0];
    if (!app) return;
    const view = views.get(app.id);
    if (!view) return;

    document.querySelectorAll('.nav-btn').forEach(button => {
      button.classList.toggle('active', button.dataset.app === app.id);
    });
    views.forEach((item) => item.wrap.classList.remove('active'));
    view.wrap.classList.add('active');

    $('app-title').textContent = app.name;
    $('app-subtitle').textContent = app.id === 'meridian'
      ? 'Investments · local account and market data'
      : 'Bundled locally · synced with your Atlas account';
    $('app-glyph').textContent = app.glyph;
    document.title = `${app.name} · Atlas Suite`;
    localStorage.setItem(ACTIVE_KEY, app.id);

    if (!view.loaded) {
      view.webview.setAttribute('src', `/apps/${app.id}/index.html${app.route || ''}`);
      view.loaded = true;
    } else if (session) {
      applySessionTo(app.id, view.webview, session);
    }
  }

  function patchScript(key, patch) {
    return `(function(){try{var d={};try{d=JSON.parse(localStorage.getItem(${JSON.stringify(key)})||'{}')||{}}catch(e){};d.settings=Object.assign({},d.settings||{},${patch});localStorage.setItem(${JSON.stringify(key)},JSON.stringify(d));}catch(e){}})();`;
  }

  function sessionScript(appId, current) {
    if (!current) return null;
    const endpoint = current.endpoint || DEFAULT_ENDPOINT;
    const user = current.user || {};
    const profile = current.profile || null;
    const profiles = Array.isArray(current.profiles) ? current.profiles : [];

    if (DATA_APPS[appId]) {
      const spec = DATA_APPS[appId];
      const token = current.tokens?.[appId] || current.tokens?.personal || '';
      const dataKey = `${spec.dataPrefix}${user.id || 'unknown'}`;
      return `(function(){try{localStorage.setItem(${JSON.stringify(spec.session)},${JSON.stringify({ mode: 'cloud', token, user, at: Date.now() })});${patchScript(dataKey, { cloudToken: token, syncEndpoint: endpoint, name: user.name || '' })};}catch(e){}})();`;
    }

    if (appId === 'calendar') {
      const token = current.tokens?.personal || '';
      return `(function(){try{var s={};try{s=JSON.parse(localStorage.getItem('atlasCalendar.state')||'{}')||{}}catch(e){};s.token=${JSON.stringify(token)};s.user=${JSON.stringify(user)};s.profile=${JSON.stringify(profile)};s.profiles=${JSON.stringify(profiles.length ? profiles : s.profiles || [])};s.email=${JSON.stringify(user.email || '')};s.mode='cloud';s.settings=Object.assign({},s.settings||{},${JSON.stringify({ syncEndpoint: endpoint })});localStorage.setItem('atlasCalendar.state',JSON.stringify(s));}catch(e){}})();`;
    }

    if (appId === 'developers') {
      const token = current.tokens?.developer || current.tokens?.personal || '';
      return patchScript('atlas-developers-data-v1', { cloudToken: token, syncEndpoint: endpoint });
    }

    // Meridian uses its own local account system; leave it untouched.
    return null;
  }

  function clearScript(appId) {
    if (DATA_APPS[appId]) {
      const spec = DATA_APPS[appId];
      return `(function(){try{localStorage.setItem(${JSON.stringify(spec.session)},${JSON.stringify({ mode: 'local', token: '', at: Date.now() })});}catch(e){}})();`;
    }
    if (appId === 'calendar') {
      return `(function(){try{var s=JSON.parse(localStorage.getItem('atlasCalendar.state')||'{}')||{};s.token='';s.user=null;s.profile=null;s.profiles=[];s.mode='local';localStorage.setItem('atlasCalendar.state',JSON.stringify(s));}catch(e){}})();`;
    }
    if (appId === 'developers') {
      return patchScript('atlas-developers-data-v1', { cloudToken: '', syncEndpoint: '' });
    }
    return null;
  }

  function execute(view, code) {
    if (!view || !code) return;
    try { Promise.resolve(view.webview.executeScript({ code })).catch(() => {}); } catch { /* not ready */ }
  }

  function applySessionTo(appId, webview, current) {
    execute({ webview }, sessionScript(appId, current));
  }

  function applySessionEverywhere() {
    views.forEach((view, appId) => execute(view, sessionScript(appId, session)));
  }

  function clearSessionEverywhere() {
    views.forEach((view, appId) => execute(view, clearScript(appId)));
  }

  async function post(url, body, token) {
    const headers = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    try {
      const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      let data = {};
      try { data = await response.json(); } catch { /* empty body */ }
      return { ok: response.ok, status: response.status, data };
    } catch (error) {
      return { ok: false, status: 0, data: { error: error.message || 'Network unavailable' } };
    }
  }

  async function profileToken(endpoint, email, password, base, type) {
    const existing = (base.profiles || []).find(item => item.type === type);
    if (existing) {
      const result = await post(`${endpoint}/api/auth/login`, { email, password, type });
      if (result.ok) return result.data.token;
    }

    const created = await post(`${endpoint}/api/profiles`, {
      type,
      name: `${base.user?.name || email} · ${type}`,
    }, base.token);
    if (created.ok) return created.data.token;

    if (created.status === 409) {
      const result = await post(`${endpoint}/api/auth/login`, { email, password, type });
      if (result.ok) return result.data.token;
    }
    return null;
  }

  async function connect() {
    const endpoint = normalizeEndpoint($('endpoint').value);
    const email = String($('email').value || '').trim().toLowerCase();
    const password = String($('password').value || '');
    const signup = $('signup').checked;
    const name = String($('name').value || '').trim() || email.split('@')[0] || 'Atlas user';
    const error = $('auth-error');
    const submit = $('auth-submit');
    error.hidden = true;
    submit.disabled = true;
    submit.textContent = 'Connecting…';

    const authPath = signup ? '/api/auth/signup' : '/api/auth/login';
    const result = await post(`${endpoint}${authPath}`, { name, email, password, type: 'personal' });
    if (!result.ok) {
      error.textContent = result.data?.error || `Sign-in failed (${result.status || 'network'}).`;
      error.hidden = false;
      submit.disabled = false;
      submit.textContent = 'Connect';
      return;
    }

    const base = result.data;
    const tokens = { personal: base.token };
    for (const type of ['business', 'developer']) {
      const token = await profileToken(endpoint, email, password, base, type);
      if (token) tokens[type] = token;
    }

    session = { endpoint, user: base.user, profile: base.profile, profiles: base.profiles || [], tokens, at: Date.now() };
    writeJSON(SESSION_KEY, session);
    updatePill();
    applySessionEverywhere();
    $('auth-dialog').close();
    submit.disabled = false;
    submit.textContent = 'Connect';
    $('password').value = '';
    toast(`Connected as ${base.user?.email || email}. Tokens shared with all apps.`);
  }

  function signOut() {
    session = null;
    localStorage.removeItem(SESSION_KEY);
    clearSessionEverywhere();
    updatePill();
    toast('Atlas Sync disconnected on this device.');
  }

  function bindControls() {
    $('sync-btn')?.addEventListener('click', () => {
      $('endpoint').value = session?.endpoint || readJSON(ENDPOINT_KEY, DEFAULT_ENDPOINT);
      $('email').value = session?.user?.email || '';
      $('auth-error').hidden = true;
      $('auth-dialog').showModal();
    });
    $('data-btn')?.addEventListener('click', async () => {
      if (typeof bridge.openDataFolder === 'function') {
        await bridge.openDataFolder();
        toast('Opened the Atlas Suite data folder.');
      } else {
        toast('Data folder: ' + (await bridge.getDataDir?.() || 'this browser'));
      }
    });
    $('auth-submit')?.addEventListener('click', connect);
    $('signup')?.addEventListener('change', toggleNameField);
    $('name-wrap-toggle')?.addEventListener('change', toggleNameField);
    $('calendar-link')?.addEventListener('click', (event) => {
      event.preventDefault();
      selectApp('calendar');
    });
  }

  function toggleNameField() {
    const show = $('signup').checked || $('name-wrap-toggle').checked;
    $('name-field').hidden = !show;
  }

  async function init() {
    apps = typeof bridge.getApps === 'function' ? await bridge.getApps() : FALLBACK_APPS;
    if (!apps?.length) apps = FALLBACK_APPS;
    session = readJSON(SESSION_KEY, null);
    renderNav();
    createViews();
    bindControls();
    toggleNameField();
    updatePill();
    if (typeof bridge.getVersion === 'function') {
      $('version').textContent = `Atlas Suite ${await bridge.getVersion()}`;
    }
    selectApp(localStorage.getItem(ACTIVE_KEY) || 'meridian');
  }

  init().catch((error) => toast(`Atlas Suite failed to start: ${error.message}`));
})();
