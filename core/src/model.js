'use strict';

/**
 * Atlas Developers shared data model.
 *
 * Every consumer (CLI, GUI, web dashboard) normalizes through this shape so a
 * JSON file produced in one place is readable in all the others.
 */

const crypto = require('crypto');
const { VERSION } = require('./version');

const COLLECTIONS = [
  'clients',
  'projects',
  'payments',
  'invoices',
  'subscriptions',
  'payouts',
  'timeEntries',
  'goals',
  'ai',
  'activity'
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'INR', 'BRL', 'NGN', 'ZAR'];

function uid(prefix = 'id') {
  let random;
  try {
    random = crypto.randomBytes(8).toString('hex');
  } catch (_) {
    random = Math.random().toString(36).slice(2);
  }
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

function str(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return typeof value === 'string' ? value : String(value);
}

function num(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1) return true;
  if (value === 'false' || value === 0) return false;
  return fallback;
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function pick(options, allowed) {
  return allowed.includes(options) ? options : allowed[0];
}

function isoDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return str(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(date, days) {
  const base = date ? new Date(`${isoDate(date)}T00:00:00Z`) : new Date();
  base.setUTCDate(base.getUTCDate() + num(days, 0));
  return base.toISOString().slice(0, 10);
}

function monthKey(date) {
  return isoDate(date).slice(0, 7);
}

function roundMoney(value) {
  const number = num(value, 0);
  return Math.round((number + Number.EPSILON) * 100) / 100;
}

function parseMoney(value) {
  if (typeof value === 'number') return roundMoney(value);
  const cleaned = str(value).replace(/[^0-9.\-]/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? roundMoney(parsed) : 0;
}

const SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', CAD: 'C$', AUD: 'A$', JPY: '¥',
  CHF: 'CHF ', INR: '₹', BRL: 'R$', NGN: '₦', ZAR: 'R '
};

function currencySymbol(code) {
  return SYMBOLS[str(code).toUpperCase()] || `${str(code).toUpperCase()} `;
}

function formatMoney(amount, currency = 'USD', options = {}) {
  const code = str(currency, 'USD').toUpperCase() || 'USD';
  const value = num(amount, 0);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: options.compact ? 0 : 2,
      minimumFractionDigits: options.compact ? 0 : 2
    }).format(value);
  } catch (_) {
    return `${currencySymbol(code)}${value.toFixed(2)}`;
  }
}

function normalizeSettings(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    currency: pick(str(source.currency, 'USD').toUpperCase(), CURRENCIES),
    theme: str(source.theme, 'ink') === 'paper' ? 'paper' : 'ink',
    name: str(source.name),
    syncEndpoint: str(source.syncEndpoint),
    cloudToken: str(source.cloudToken),
    clientId: str(source.clientId) || uid('client'),
    onboardingComplete: bool(source.onboardingComplete, false)
  };
}

function normalizeProfile(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return { name: str(source.name), role: str(source.role), company: str(source.company) };
}

function normalizeClient(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    id: str(source.id) || uid('cli'),
    name: str(source.name, 'Unnamed client'),
    email: str(source.email),
    company: str(source.company),
    rate: roundMoney(source.rate),
    currency: pick(str(source.currency, 'USD').toUpperCase(), CURRENCIES),
    status: str(source.status, 'active') === 'archived' ? 'archived' : 'active'
  };
}

function normalizeProject(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const status = str(source.status, 'active');
  return {
    id: str(source.id) || uid('prj'),
    clientId: str(source.clientId),
    name: str(source.name, 'Unnamed project'),
    status: ['active', 'paused', 'done'].includes(status) ? status : 'active',
    rate: roundMoney(source.rate),
    currency: pick(str(source.currency, 'USD').toUpperCase(), CURRENCIES)
  };
}

function normalizePayment(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const type = str(source.type, 'income') === 'expense' ? 'expense' : 'income';
  const status = str(source.status, 'paid');
  return {
    id: str(source.id) || uid('pay'),
    type,
    clientId: str(source.clientId),
    projectId: str(source.projectId),
    date: isoDate(source.date) || todayISO(),
    description: str(source.description),
    amount: roundMoney(source.amount),
    currency: pick(str(source.currency, 'USD').toUpperCase(), CURRENCIES),
    status: ['pending', 'paid', 'overdue'].includes(status) ? status : 'paid',
    method: str(source.method),
    category: str(source.category),
    notes: str(source.notes)
  };
}

function normalizeInvoice(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const status = str(source.status, 'draft');
  return {
    id: str(source.id) || uid('inv'),
    clientId: str(source.clientId),
    projectId: str(source.projectId),
    issueDate: isoDate(source.issueDate) || todayISO(),
    dueDate: isoDate(source.dueDate) || addDaysISO(todayISO(), 14),
    amount: roundMoney(source.amount),
    currency: pick(str(source.currency, 'USD').toUpperCase(), CURRENCIES),
    status: ['draft', 'sent', 'paid', 'overdue'].includes(status) ? status : 'draft',
    number: str(source.number) || `INV-${Date.now().toString(36).toUpperCase()}`,
    notes: str(source.notes)
  };
}

function normalizeSubscription(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const frequency = str(source.frequency, 'monthly');
  return {
    id: str(source.id) || uid('sub'),
    name: str(source.name, 'Unnamed subscription'),
    vendor: str(source.vendor),
    amount: roundMoney(source.amount),
    currency: pick(str(source.currency, 'USD').toUpperCase(), CURRENCIES),
    frequency: ['weekly', 'monthly', 'quarterly', 'yearly'].includes(frequency) ? frequency : 'monthly',
    nextDate: isoDate(source.nextDate) || addDaysISO(todayISO(), 30),
    status: str(source.status, 'active') === 'cancelled' ? 'cancelled' : 'active',
    category: str(source.category)
  };
}

function normalizePayout(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    id: str(source.id) || uid('po'),
    date: isoDate(source.date) || todayISO(),
    amount: roundMoney(source.amount),
    currency: pick(str(source.currency, 'USD').toUpperCase(), CURRENCIES),
    destination: str(source.destination),
    status: str(source.status, 'pending') === 'paid' ? 'paid' : 'pending',
    notes: str(source.notes)
  };
}

function normalizeTimeEntry(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    id: str(source.id) || uid('time'),
    projectId: str(source.projectId),
    date: isoDate(source.date) || todayISO(),
    hours: num(source.hours, 0),
    description: str(source.description),
    billable: bool(source.billable, true)
  };
}

function normalizeGoal(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    id: str(source.id) || uid('goal'),
    name: str(source.name, 'Unnamed goal'),
    target: num(source.target, 0),
    current: num(source.current, 0),
    deadline: isoDate(source.deadline)
  };
}

function normalizeAi(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    id: str(source.id) || uid('ai'),
    at: str(source.at) || new Date().toISOString(),
    prompt: str(source.prompt),
    response: str(source.response)
  };
}

function normalizeActivity(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    id: str(source.id) || uid('act'),
    at: str(source.at) || new Date().toISOString(),
    type: str(source.type, 'update'),
    message: str(source.message)
  };
}

function defaultData() {
  return {
    settings: normalizeSettings(),
    profile: normalizeProfile(),
    clients: [],
    projects: [],
    payments: [],
    invoices: [],
    subscriptions: [],
    payouts: [],
    timeEntries: [],
    goals: [],
    ai: [],
    activity: []
  };
}

function normalizeData(input) {
  const source = input && typeof input === 'object' ? input : {};
  const data = defaultData();
  data.settings = normalizeSettings(source.settings);
  data.profile = normalizeProfile(source.profile);
  data.clients = arr(source.clients).map(normalizeClient);
  data.projects = arr(source.projects).map(normalizeProject);
  data.payments = arr(source.payments).map(normalizePayment);
  data.invoices = arr(source.invoices).map(normalizeInvoice);
  data.subscriptions = arr(source.subscriptions).map(normalizeSubscription);
  data.payouts = arr(source.payouts).map(normalizePayout);
  data.timeEntries = arr(source.timeEntries).map(normalizeTimeEntry);
  data.goals = arr(source.goals).map(normalizeGoal);
  data.ai = arr(source.ai).map(normalizeAi);
  data.activity = arr(source.activity).map(normalizeActivity);
  return data;
}

function addActivity(data, message, type = 'update') {
  if (!data || !Array.isArray(data.activity)) return data;
  data.activity.unshift(normalizeActivity({ at: new Date().toISOString(), type, message }));
  data.activity = data.activity.slice(0, 150);
  return data;
}

module.exports = {
  VERSION,
  COLLECTIONS,
  CURRENCIES,
  uid, str, num, bool, arr, pick,
  isoDate, todayISO, addDaysISO, monthKey,
  roundMoney, parseMoney, currencySymbol, formatMoney,
  normalizeSettings, normalizeProfile, normalizeClient, normalizeProject,
  normalizePayment, normalizeInvoice, normalizeSubscription, normalizePayout,
  normalizeTimeEntry, normalizeGoal, normalizeAi, normalizeActivity,
  defaultData, normalizeData, addActivity
};
