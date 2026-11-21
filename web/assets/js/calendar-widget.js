/** Derived-calendar widget for the Atlas Developers web app. No dependencies. */

const CALENDAR_HOME = 'https://atlas-calendar.surge.sh';
const CALENDAR_OVERVIEW = `${CALENDAR_HOME}/#/app/overview`;
const STYLE_ID = 'atlas-cal-widget-styles';

const WIDGET_CSS = `
.atlas-cal-widget,
.atlas-cal-widget * { box-sizing: border-box; }
.atlas-cal-widget { color: currentColor; font-family: inherit; }
.atlas-cal-widget [hidden] { display: none !important; }

.atlas-cal-widget-launcher {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 40;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 15px;
  border: 1px solid color-mix(in srgb, currentColor 32%, transparent);
  border-radius: 999px;
  background: var(--panel-solid, Canvas);
  background: color-mix(in srgb, currentColor 10%, var(--panel-solid, Canvas));
  color: currentColor;
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  line-height: 1.2;
  cursor: pointer;
  box-shadow: 0 10px 30px color-mix(in srgb, currentColor 16%, transparent);
  transition: transform .15s ease, background .15s ease;
}
.atlas-cal-widget-launcher::before {
  content: "◷";
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 15px;
  line-height: 1;
}
.atlas-cal-widget-launcher:hover { transform: translateY(-1px); }
.atlas-cal-widget-launcher:focus-visible,
.atlas-cal-widget-refresh:focus-visible,
.atlas-cal-widget-link:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

.atlas-cal-widget-panel {
  position: fixed;
  right: 18px;
  bottom: 64px;
  z-index: 39;
  display: flex;
  flex-direction: column;
  width: min(360px, calc(100vw - 36px));
  max-height: min(520px, calc(100vh - 92px));
  overflow: hidden;
  border: 1px solid color-mix(in srgb, currentColor 26%, transparent);
  border-radius: 14px;
  background: var(--panel-solid, Canvas);
  background: color-mix(in srgb, currentColor 7%, var(--panel-solid, Canvas));
  box-shadow: 0 18px 50px color-mix(in srgb, currentColor 20%, transparent);
  color: currentColor;
  backdrop-filter: blur(12px);
}

.atlas-cal-widget-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid color-mix(in srgb, currentColor 18%, transparent);
}
.atlas-cal-widget-heading { min-width: 0; }
.atlas-cal-widget-title {
  margin: 0;
  font-size: 14px;
  font-weight: 650;
  line-height: 1.25;
}
.atlas-cal-widget-subtitle {
  margin: 2px 0 0;
  font-size: 11px;
  line-height: 1.3;
  opacity: .7;
}
.atlas-cal-widget-refresh {
  margin-left: auto;
  padding: 5px 10px;
  border: 1px solid color-mix(in srgb, currentColor 24%, transparent);
  border-radius: 8px;
  background: transparent;
  color: currentColor;
  font: inherit;
  font-size: 12px;
  line-height: 1.2;
  cursor: pointer;
}
.atlas-cal-widget-refresh:hover { background: color-mix(in srgb, currentColor 10%, transparent); }
.atlas-cal-widget-refresh[disabled] { opacity: .55; cursor: default; }

.atlas-cal-widget-status {
  margin: 0;
  padding: 7px 14px;
  border-bottom: 1px solid color-mix(in srgb, currentColor 12%, transparent);
  font-size: 11px;
  line-height: 1.4;
  opacity: .75;
}
.atlas-cal-widget-status:empty { display: none; }

.atlas-cal-widget-content {
  min-height: 72px;
  overflow-y: auto;
  padding: 6px 8px 8px;
}
.atlas-cal-widget-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.atlas-cal-widget-event {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 10px;
  padding: 8px;
  border-radius: 9px;
}
.atlas-cal-widget-event:hover { background: color-mix(in srgb, currentColor 6%, transparent); }
.atlas-cal-widget-date {
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 10.5px;
  line-height: 1.35;
  opacity: .72;
  overflow-wrap: anywhere;
}
.atlas-cal-widget-event-main { min-width: 0; }
.atlas-cal-widget-event-title {
  display: block;
  font-size: 12.5px;
  line-height: 1.35;
  overflow-wrap: anywhere;
}
.atlas-cal-widget-event-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  margin-top: 4px;
}
.atlas-cal-widget-badge {
  padding: 1px 6px;
  border: 1px solid color-mix(in srgb, currentColor 24%, transparent);
  border-radius: 999px;
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 9.5px;
  letter-spacing: .04em;
  line-height: 1.5;
  text-transform: uppercase;
}
.atlas-cal-widget-source {
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 9.5px;
  opacity: .6;
  overflow-wrap: anywhere;
}
.atlas-cal-widget-description {
  margin: 4px 0 0;
  font-size: 11px;
  line-height: 1.45;
  opacity: .75;
  overflow-wrap: anywhere;
}
.atlas-cal-widget-message {
  padding: 18px 14px;
  font-size: 12px;
  line-height: 1.55;
  text-align: center;
  opacity: .85;
}
.atlas-cal-widget-message[data-state="error"] { opacity: 1; }
.atlas-cal-widget-message a {
  color: currentColor;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.atlas-cal-widget-footer {
  padding: 9px 14px;
  border-top: 1px solid color-mix(in srgb, currentColor 18%, transparent);
  font-size: 11px;
  line-height: 1.4;
}
.atlas-cal-widget-link {
  color: currentColor;
  opacity: .8;
  text-decoration: none;
}
.atlas-cal-widget-link:hover { opacity: 1; text-decoration: underline; }

@media (max-width: 480px) {
  .atlas-cal-widget-launcher { right: 12px; bottom: 12px; }
  .atlas-cal-widget-panel {
    right: 12px;
    left: 12px;
    bottom: 58px;
    width: auto;
    max-height: calc(100vh - 76px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .atlas-cal-widget-launcher { transition: none; }
}
`;

function makeEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function safeCall(fn) {
  if (typeof fn !== 'function') return '';
  try { return fn(); } catch (_) { return ''; }
}

function clean(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function endpointOf(getEndpoint) {
  return clean(safeCall(getEndpoint)).replace(/\/+$/, '');
}

function tokenOf(getToken) {
  return clean(safeCall(getToken));
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const options = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
  if (date.getFullYear() !== new Date().getFullYear()) options.year = 'numeric';
  try {
    return new Intl.DateTimeFormat(undefined, options).format(date);
  } catch (_) {
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }
}

function eventStart(event) {
  const row = event && typeof event === 'object' ? event : {};
  return clean(row.startAt || row.start);
}

function sortEvents(events) {
  return events.slice().sort((a, b) => {
    const left = new Date(eventStart(a)).getTime();
    const right = new Date(eventStart(b)).getTime();
    if (Number.isNaN(left) && Number.isNaN(right)) return 0;
    if (Number.isNaN(left)) return 1;
    if (Number.isNaN(right)) return -1;
    return left - right;
  });
}

function renderEvent(item, fallbackApp) {
  const source = item && typeof item === 'object' ? item : {};
  const row = makeEl('li', 'atlas-cal-widget-event');
  const rawStart = eventStart(source);
  const date = makeEl('time', 'atlas-cal-widget-date', rawStart ? formatDate(rawStart) : '—');
  if (rawStart && !Number.isNaN(new Date(rawStart).getTime())) {
    date.dateTime = new Date(rawStart).toISOString();
  }

  const main = makeEl('div', 'atlas-cal-widget-event-main');
  main.appendChild(makeEl('strong', 'atlas-cal-widget-event-title', clean(source.title) || 'Untitled event'));

  const meta = makeEl('div', 'atlas-cal-widget-event-meta');
  meta.appendChild(makeEl('span', 'atlas-cal-widget-badge', clean(source.app) || fallbackApp || 'app'));
  const sourceId = clean(source.sourceId);
  if (sourceId) meta.appendChild(makeEl('span', 'atlas-cal-widget-source', `#${sourceId}`));
  main.appendChild(meta);

  const description = clean(source.description);
  if (description) main.appendChild(makeEl('p', 'atlas-cal-widget-description', description));

  row.appendChild(date);
  row.appendChild(main);
  return row;
}

/** Mount the widget. Returns a cleanup function. */
export function initCalendarWidget(options) {
  const settings = options && typeof options === 'object' ? options : {};
  const getEndpoint = settings.getEndpoint;
  const getToken = settings.getToken;
  const appName = clean(settings.app) || 'atlas-app';

  if (typeof document === 'undefined' || document.querySelector('.atlas-cal-widget')) {
    return () => {};
  }
  if (typeof window === 'undefined') return () => {};

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = WIDGET_CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  const root = makeEl('div', 'atlas-cal-widget');
  const launcher = makeEl('button', 'atlas-cal-widget-launcher', 'Calendar');
  launcher.type = 'button';
  launcher.setAttribute('aria-expanded', 'false');
  launcher.setAttribute('aria-pressed', 'false');
  launcher.setAttribute('aria-controls', 'atlas-cal-widget-panel');

  const panel = makeEl('section', 'atlas-cal-widget-panel');
  panel.id = 'atlas-cal-widget-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Derived calendar dates');
  panel.dataset.atlasCalWidgetApp = appName;

  const header = makeEl('header', 'atlas-cal-widget-header');
  const heading = makeEl('div', 'atlas-cal-widget-heading');
  heading.appendChild(makeEl('h2', 'atlas-cal-widget-title', 'Derived dates'));
  heading.appendChild(makeEl('p', 'atlas-cal-widget-subtitle', 'From dates in your other apps'));
  const refresh = makeEl('button', 'atlas-cal-widget-refresh', 'Refresh');
  refresh.type = 'button';
  header.appendChild(heading);
  header.appendChild(refresh);

  const status = makeEl('p', 'atlas-cal-widget-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const content = makeEl('div', 'atlas-cal-widget-content');
  const message = makeEl('div', 'atlas-cal-widget-message');
  const list = makeEl('ul', 'atlas-cal-widget-list');
  list.hidden = true;
  content.appendChild(message);
  content.appendChild(list);

  const footer = makeEl('footer', 'atlas-cal-widget-footer');
  const overviewLink = makeEl('a', 'atlas-cal-widget-link', 'Open Atlas Calendar ↗');
  overviewLink.href = CALENDAR_OVERVIEW;
  overviewLink.target = '_blank';
  overviewLink.rel = 'noopener noreferrer';
  footer.appendChild(overviewLink);

  panel.appendChild(header);
  panel.appendChild(status);
  panel.appendChild(content);
  panel.appendChild(footer);
  root.appendChild(launcher);
  root.appendChild(panel);
  document.body.appendChild(root);

  let open = false;
  let destroyed = false;
  let source = null;
  let streamKey = '';
  let requestId = 0;
  let controller = null;

  function closeStream() {
    if (source) {
      try {
        if (typeof source.removeEventListener === 'function') {
          source.removeEventListener('calendar', onCalendarEvent);
        } else {
          source.oncalendar = null;
        }
      } catch (_) { /* EventSource host may not support removal */ }
      try { source.close(); } catch (_) { /* already closed */ }
      source = null;
    }
  }

  function onCalendarEvent() {
    if (!destroyed) load();
  }

  function syncStream(endpoint, token) {
    const nextKey = `${endpoint}\u0000${token}`;
    if (streamKey === nextKey && source) return;
    closeStream();
    streamKey = nextKey;
    if (!endpoint || !token || typeof window.EventSource !== 'function') return;
    try {
      source = new window.EventSource(`${endpoint}/api/events?token=${encodeURIComponent(token)}`);
      if (typeof source.addEventListener === 'function') {
        source.addEventListener('calendar', onCalendarEvent);
      } else {
        source.oncalendar = onCalendarEvent;
      }
    } catch (_) {
      closeStream();
      streamKey = '';
    }
  }

  function setStatus(text) {
    status.textContent = text || '';
  }

  function showMessage(kind, text, link) {
    message.replaceChildren();
    message.dataset.state = kind;
    if (text) message.appendChild(document.createTextNode(text));
    if (link) {
      const anchor = makeEl('a', '', link.label);
      anchor.href = link.href;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      if (text) message.appendChild(document.createTextNode(' '));
      message.appendChild(anchor);
    }
    message.hidden = false;
    list.replaceChildren();
    list.hidden = true;
  }

  function showEvents(events) {
    list.replaceChildren();
    sortEvents(events).forEach((event) => list.appendChild(renderEvent(event, appName)));
    list.hidden = false;
    message.hidden = true;
  }

  async function load() {
    if (destroyed) return;
    const endpoint = endpointOf(getEndpoint);
    const token = tokenOf(getToken);
    syncStream(endpoint, token);

    const id = ++requestId;
    if (controller) {
      try { controller.abort(); } catch (_) { /* ignore */ }
    }
    controller = typeof AbortController === 'function' ? new AbortController() : null;

    if (!token) {
      refresh.disabled = false;
      setStatus('');
      showMessage('signin', 'Sign in to Atlas Sync to see dates from your other apps', {
        label: 'Sign in ↗', href: CALENDAR_HOME
      });
      return;
    }
    if (!endpoint) {
      refresh.disabled = false;
      setStatus('');
      showMessage('error', 'No sync endpoint configured. Add one in Settings → Integrations.');
      return;
    }

    refresh.disabled = true;
    setStatus('Loading calendar dates…');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const options = { method: 'GET', headers, cache: 'no-store' };
      if (controller) options.signal = controller.signal;
      const response = await fetch(`${endpoint}/api/calendar/derived`, options);
      if (destroyed || id !== requestId) return;
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const payload = await response.json();
      if (destroyed || id !== requestId) return;
      const events = Array.isArray(payload)
        ? payload
        : payload && Array.isArray(payload.events) ? payload.events : [];
      showEvents(events);
      setStatus(events.length
        ? `${events.length} derived date${events.length === 1 ? '' : 's'}`
        : '');
      if (!events.length) {
        showMessage('empty', 'No derived dates yet. Connected apps will appear here once they publish events.');
      }
    } catch (error) {
      if (destroyed || id !== requestId) return;
      if (error && error.name === 'AbortError') return;
      setStatus('');
      const detail = error && error.message ? ` ${error.message}` : '';
      showMessage('error', `Couldn't load calendar dates.${detail}`);
    } finally {
      if (id === requestId) refresh.disabled = false;
    }
  }

  function setOpen(next) {
    if (destroyed) return;
    open = Boolean(next);
    panel.hidden = !open;
    launcher.setAttribute('aria-expanded', String(open));
    launcher.setAttribute('aria-pressed', String(open));
    if (open) load();
  }

  function onLauncherClick() { setOpen(!open); }
  function onRefreshClick() { load(); }
  function onKeydown(event) {
    if (open && event.key === 'Escape') {
      setOpen(false);
      launcher.focus();
    }
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    closeStream();
    if (controller) {
      try { controller.abort(); } catch (_) { /* ignore */ }
    }
    launcher.removeEventListener('click', onLauncherClick);
    refresh.removeEventListener('click', onRefreshClick);
    document.removeEventListener('keydown', onKeydown);
    window.removeEventListener('pagehide', destroy);
    window.removeEventListener('beforeunload', destroy);
    root.remove();
  }

  launcher.addEventListener('click', onLauncherClick);
  refresh.addEventListener('click', onRefreshClick);
  document.addEventListener('keydown', onKeydown);
  window.addEventListener('pagehide', destroy);
  window.addEventListener('beforeunload', destroy);

  return destroy;
}

export default initCalendarWidget;
