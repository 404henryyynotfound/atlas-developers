/** Small browser utilities. Every value rendered into HTML must pass through esc(). */

export function esc(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function round(value) {
  return Math.round((num(value) + Number.EPSILON) * 100) / 100;
}

export function parseMoney(value) {
  if (typeof value === 'number') return round(value);
  const cleaned = String(value || '').replace(/[^0-9.\-]/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? round(parsed) : 0;
}

export function money(value, currency = 'USD', options = {}) {
  const code = String(currency || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: options.compact ? 0 : 2,
      minimumFractionDigits: options.compact ? 0 : 2
    }).format(num(value));
  } catch (_) {
    return `${code} ${num(value).toFixed(2)}`;
  }
}

export function uid(prefix = 'id') {
  const random = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

export function isoDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(date, days) {
  const base = date ? new Date(`${isoDate(date)}T00:00:00Z`) : new Date();
  base.setUTCDate(base.getUTCDate() + num(days));
  return base.toISOString().slice(0, 10);
}

export function prettyDate(value) {
  if (!value) return '—';
  const date = new Date(`${isoDate(value)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return esc(value);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function relativeDate(value) {
  if (!value) return '—';
  const target = new Date(`${isoDate(value)}T00:00:00Z`).getTime();
  const now = new Date(`${todayISO()}T00:00:00Z`).getTime();
  const days = Math.round((target - now) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (days < 0) return `${Math.abs(days)}d overdue`;
  return `in ${days}d`;
}

export function percent(current, target) {
  if (!num(target)) return 0;
  return Math.max(0, Math.min(100, Math.round((num(current) / num(target)) * 100)));
}

export function truncate(value, length = 42) {
  const text = String(value === undefined || value === null || value === '' ? '—' : value);
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

export function arr(value) {
  return Array.isArray(value) ? value : [];
}

export function debounce(fn, delay = 200) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) { /* fall through to legacy path */ }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch (_) {
    return false;
  }
}

export function downloadText(filename, text, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function emptyState(title, message, action = '') {
  return `<div class="empty-state"><div class="empty-icon">◇</div><h3>${esc(title)}</h3><p>${esc(message)}</p>${action}</div>`;
}

export function statusPill(status) {
  const clean = String(status || 'none').toLowerCase();
  return `<span class="pill pill-${esc(clean)}">${esc(clean)}</span>`;
}

export function sectionHead(title, subtitle, actions = '') {
  return `<div class="section-head"><div><h2>${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div><div class="section-actions">${actions}</div></div>`;
}

export function attr(value) {
  return esc(value);
}
