/** Local-first browser store. Shape matches core/src/model.js. */

import { uid, todayISO, addDaysISO, isoDate, num, esc } from './utils.js';

const STORAGE_KEY = 'atlas-developers-data-v1';
const listeners = new Set();
let memoryFallback = null;

function str(value, fallback = '') {
  return value === undefined || value === null ? fallback : String(value);
}

function bool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1) return true;
  if (value === 'false' || value === 0) return false;
  return fallback;
}

function arr(value) { return Array.isArray(value) ? value : []; }
function pick(value, allowed, fallback) { return allowed.includes(value) ? value : fallback; }
function money(value) { return Math.round((num(value) + Number.EPSILON) * 100) / 100; }
function one(item, shape) {
  const source = item && typeof item === 'object' ? item : {};
  const result = {};
  Object.keys(shape).forEach((key) => { result[key] = source[key] === undefined ? shape[key] : source[key]; });
  return result;
}

const NORMALIZERS = {
  clients: (item) => {
    const row = one(item, {
      id: '', name: 'Unnamed client', email: '', company: '', rate: 0, currency: 'USD', status: 'active'
    });
    return {
      ...row,
      id: str(row.id) || uid('cli'),
      name: str(row.name, 'Unnamed client'),
      email: str(row.email), company: str(row.company),
      rate: money(row.rate),
      currency: pick(str(row.currency).toUpperCase(), ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'INR', 'BRL', 'NGN', 'ZAR'], 'USD'),
      status: pick(row.status, ['active', 'archived'], 'active')
    };
  },
  projects: (item) => {
    const row = one(item, { id: '', clientId: '', name: 'Unnamed project', status: 'active', rate: 0, currency: 'USD' });
    return {
      ...row, id: str(row.id) || uid('prj'), clientId: str(row.clientId), name: str(row.name, 'Unnamed project'),
      status: pick(row.status, ['active', 'paused', 'done'], 'active'), rate: money(row.rate),
      currency: pick(str(row.currency).toUpperCase(), ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'INR', 'BRL', 'NGN', 'ZAR'], 'USD')
    };
  },
  payments: (item) => {
    const row = one(item, {
      id: '', type: 'income', clientId: '', projectId: '', date: '', description: '', amount: 0,
      currency: 'USD', status: 'paid', method: '', category: '', notes: ''
    });
    return {
      ...row,
      id: str(row.id) || uid('pay'),
      type: pick(row.type, ['income', 'expense'], 'income'),
      clientId: str(row.clientId), projectId: str(row.projectId),
      date: isoDate(row.date) || todayISO(), description: str(row.description), amount: money(row.amount),
      currency: pick(str(row.currency).toUpperCase(), ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'INR', 'BRL', 'NGN', 'ZAR'], 'USD'),
      status: pick(row.status, ['pending', 'paid', 'overdue'], 'paid'),
      method: str(row.method), category: str(row.category), notes: str(row.notes)
    };
  },
  invoices: (item) => {
    const row = one(item, {
      id: '', clientId: '', projectId: '', issueDate: '', dueDate: '', amount: 0, currency: 'USD',
      status: 'draft', number: '', notes: ''
    });
    return {
      ...row,
      id: str(row.id) || uid('inv'), clientId: str(row.clientId), projectId: str(row.projectId),
      issueDate: isoDate(row.issueDate) || todayISO(), dueDate: isoDate(row.dueDate) || addDaysISO(todayISO(), 14),
      amount: money(row.amount),
      currency: pick(str(row.currency).toUpperCase(), ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'INR', 'BRL', 'NGN', 'ZAR'], 'USD'),
      status: pick(row.status, ['draft', 'sent', 'paid', 'overdue'], 'draft'),
      number: str(row.number) || `INV-${Date.now().toString(36).toUpperCase()}`,
      notes: str(row.notes)
    };
  },
  subscriptions: (item) => {
    const row = one(item, {
      id: '', name: 'Unnamed subscription', vendor: '', amount: 0, currency: 'USD',
      frequency: 'monthly', nextDate: '', status: 'active', category: ''
    });
    return {
      ...row,
      id: str(row.id) || uid('sub'), name: str(row.name, 'Unnamed subscription'), vendor: str(row.vendor),
      amount: money(row.amount), currency: pick(str(row.currency).toUpperCase(), ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'INR', 'BRL', 'NGN', 'ZAR'], 'USD'),
      frequency: pick(row.frequency, ['weekly', 'monthly', 'quarterly', 'yearly'], 'monthly'),
      nextDate: isoDate(row.nextDate) || addDaysISO(todayISO(), 30),
      status: pick(row.status, ['active', 'cancelled'], 'active'), category: str(row.category)
    };
  },
  payouts: (item) => {
    const row = one(item, { id: '', date: '', amount: 0, currency: 'USD', destination: '', status: 'pending', notes: '' });
    return {
      ...row, id: str(row.id) || uid('po'), date: isoDate(row.date) || todayISO(), amount: money(row.amount),
      currency: pick(str(row.currency).toUpperCase(), ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'INR', 'BRL', 'NGN', 'ZAR'], 'USD'),
      destination: str(row.destination), status: pick(row.status, ['pending', 'paid'], 'pending'), notes: str(row.notes)
    };
  },
  timeEntries: (item) => {
    const row = one(item, { id: '', projectId: '', date: '', hours: 0, description: '', billable: true });
    return {
      ...row, id: str(row.id) || uid('time'), projectId: str(row.projectId), date: isoDate(row.date) || todayISO(),
      hours: num(row.hours), description: str(row.description), billable: bool(row.billable, true)
    };
  },
  goals: (item) => {
    const row = one(item, { id: '', name: 'Unnamed goal', target: 0, current: 0, deadline: '' });
    return {
      ...row, id: str(row.id) || uid('goal'), name: str(row.name, 'Unnamed goal'),
      target: num(row.target), current: num(row.current), deadline: isoDate(row.deadline)
    };
  },
  ai: (item) => {
    const row = one(item, { id: '', at: '', prompt: '', response: '' });
    return { ...row, id: str(row.id) || uid('ai'), at: str(row.at) || new Date().toISOString(), prompt: str(row.prompt), response: str(row.response) };
  },
  activity: (item) => {
    const row = one(item, { id: '', at: '', type: 'update', message: '' });
    return { ...row, id: str(row.id) || uid('act'), at: str(row.at) || new Date().toISOString(), type: str(row.type, 'update'), message: str(row.message) };
  }
};

function defaultData() {
  return {
    settings: {
      currency: 'USD', theme: 'ink', name: '', syncEndpoint: '', cloudToken: '',
      aiEndpoint: '', aiKey: '', clientId: uid('client'), onboardingComplete: false
    },
    profile: { name: '', role: '', company: '' },
    clients: [], projects: [], payments: [], invoices: [], subscriptions: [],
    payouts: [], timeEntries: [], goals: [], ai: [], activity: []
  };
}

export function normalizeData(input) {
  const source = input && typeof input === 'object' ? input : {};
  const data = defaultData();
  const settings = source.settings && typeof source.settings === 'object' ? source.settings : {};
  data.settings = {
    ...data.settings,
    currency: pick(str(settings.currency).toUpperCase(), ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'INR', 'BRL', 'NGN', 'ZAR'], 'USD'),
    theme: pick(settings.theme, ['ink', 'paper'], 'ink'),
    name: str(settings.name),
    syncEndpoint: str(settings.syncEndpoint),
    cloudToken: str(settings.cloudToken),
    aiEndpoint: str(settings.aiEndpoint),
    aiKey: str(settings.aiKey),
    clientId: str(settings.clientId) || data.settings.clientId,
    onboardingComplete: bool(settings.onboardingComplete)
  };
  const profile = source.profile && typeof source.profile === 'object' ? source.profile : {};
  data.profile = { name: str(profile.name), role: str(profile.role), company: str(profile.company) };
  Object.keys(NORMALIZERS).forEach((key) => {
    data[key] = arr(source[key]).map(NORMALIZERS[key]);
  });
  return data;
}

function desktopBridge() {
  if (typeof window === 'undefined') return null;
  const bridge = window.atlasDesktop;
  return bridge && typeof bridge.readDataSync === 'function' && typeof bridge.writeDataSync === 'function'
    ? bridge
    : null;
}

function readStorage() {
  const bridge = desktopBridge();
  if (bridge) {
    try { return bridge.readDataSync(); } catch (_) { return memoryFallback; }
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return memoryFallback;
  }
}

function writeStorage(value) {
  memoryFallback = value;
  const bridge = desktopBridge();
  if (bridge) {
    try { bridge.writeDataSync(value); } catch (_) { /* keep in-memory copy */ }
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch (_) { /* in-memory fallback keeps the app usable */ }
}

function emit() {
  listeners.forEach((listener) => {
    try { listener(cache); } catch (_) { /* listener errors never break a save */ }
  });
}

let cache = null;

const store = {
  get() {
    if (!cache) cache = normalizeData(readStorage());
    return cache;
  },
  save(data) {
    cache = normalizeData(data);
    writeStorage(cache);
    emit();
    return cache;
  },
  update(mutator) {
    const current = this.get();
    const next = typeof mutator === 'function' ? mutator(current) : current;
    return this.save(next || current);
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  reset() {
    cache = defaultData();
    writeStorage(cache);
    emit();
    return cache;
  },
  exportJson() {
    return JSON.stringify(this.get(), null, 2);
  },
  importJson(text) {
    const parsed = JSON.parse(text);
    return this.save(normalizeData(parsed));
  },
  activity(data, message, type = 'update') {
    const next = data || this.get();
    next.activity.unshift({
      id: uid('act'), at: new Date().toISOString(), type: String(type), message: esc(String(message)).slice(0, 200)
    });
    next.activity = next.activity.slice(0, 150);
    return next;
  },
  findClient(data, ref) {
    if (!ref) return null;
    const key = String(ref).toLowerCase();
    return data.clients.find((client) => client.id.toLowerCase() === key || client.name.toLowerCase() === key || client.company.toLowerCase() === key) || null;
  },
  findProject(data, ref) {
    if (!ref) return null;
    const key = String(ref).toLowerCase();
    return data.projects.find((project) => project.id.toLowerCase() === key || project.name.toLowerCase() === key) || null;
  },
  normalizeData
};

export { store };
export default store;
