/** Atlas AI: deterministic local engine first, opt-in external LLM second. */

import { RUNTIME } from './config.js';
import { arr, num, round, money, isoDate, todayISO, addDaysISO, esc } from './utils.js';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'INR', 'BRL', 'NGN', 'ZAR'];

function currency(data) {
  return CURRENCIES.includes(String(data.settings.currency).toUpperCase()) ? data.settings.currency.toUpperCase() : 'USD';
}

function sum(list, pick = () => 0) {
  return list.reduce((total, item) => total + num(pick(item)), 0);
}

function months(count) {
  const result = [];
  const now = new Date();
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1));
    result.push(date.toISOString().slice(0, 7));
  }
  return result;
}

function cashflow(data, count = 6) {
  const code = currency(data);
  return months(count).map((key) => {
    const inMonth = arr(data.payments).filter((payment) => isoDate(payment.date).slice(0, 7) === key && payment.status === 'paid');
    const income = sum(inMonth.filter((p) => p.type === 'income'), (p) => p.amount);
    const expense = sum(inMonth.filter((p) => p.type === 'expense'), (p) => p.amount);
    return {
      month: key,
      label: new Date(`${key}-01T00:00:00Z`).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
      income: round(income), expense: round(expense), net: round(income - expense), currency: code
    };
  });
}

function burnRate(data) {
  const recent = cashflow(data, 3).filter((point) => point.expense > 0);
  if (recent.length) return round(sum(recent, (point) => point.expense) / recent.length);
  const cutoff = Date.now() - 30 * 86400000;
  return round(sum(arr(data.payments).filter((payment) => (
    payment.type === 'expense' && new Date(`${isoDate(payment.date)}T00:00:00Z`).getTime() >= cutoff
  )), (payment) => payment.amount));
}

function nameFor(data, collection, id) {
  const item = arr(data[collection]).find((entry) => entry.id === id);
  return item ? item.name : 'Unassigned';
}

function topClients(data, limit = 5) {
  const groups = new Map();
  arr(data.payments).filter((p) => p.type === 'income' && p.status === 'paid').forEach((payment) => {
    const key = payment.clientId || 'unassigned';
    const entry = groups.get(key) || { clientId: key, name: nameFor(data, 'clients', key), amount: 0, count: 0 };
    entry.amount += num(payment.amount);
    entry.count += 1;
    groups.set(key, entry);
  });
  return Array.from(groups.values())
    .map((entry) => ({ ...entry, amount: round(entry.amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

function overdue(data) {
  const today = todayISO();
  return arr(data.invoices).filter((invoice) => invoice.status !== 'paid' && (invoice.status === 'overdue' || invoice.dueDate < today));
}

function upcoming(data, limit = 8) {
  const today = todayISO();
  const items = [];
  arr(data.subscriptions).filter((s) => s.status === 'active').forEach((s) => {
    items.push({ date: s.nextDate, kind: 'subscription', label: s.name, amount: s.amount, currency: s.currency });
  });
  arr(data.payouts).filter((p) => p.status === 'pending').forEach((p) => {
    items.push({ date: p.date, kind: 'payout', label: p.destination || 'Payout', amount: p.amount, currency: p.currency });
  });
  arr(data.invoices).filter((i) => i.status !== 'paid').forEach((i) => {
    items.push({ date: i.dueDate, kind: 'invoice', label: `${i.number} due`, amount: i.amount, currency: i.currency });
  });
  return items.filter((item) => item.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, limit);
}

function analyze(data) {
  const code = currency(data);
  const payments = arr(data.payments);
  const invoices = arr(data.invoices);
  const received = round(sum(payments.filter((p) => p.type === 'income' && p.status === 'paid'), (p) => p.amount));
  const spent = round(sum(payments.filter((p) => p.type === 'expense' && p.status === 'paid'), (p) => p.amount));
  const outstanding = round(sum(invoices.filter((i) => i.status === 'sent' || i.status === 'overdue'), (i) => i.amount));
  const late = overdue(data);
  const overdueAmount = round(sum(late, (i) => i.amount));
  const factors = { weekly: 52, monthly: 12, quarterly: 4, yearly: 1 };
  const annualSubscriptions = round(sum(arr(data.subscriptions).filter((s) => s.status === 'active'), (s) => s.amount * (factors[s.frequency] || 12)));
  const billableHours = round(sum(arr(data.timeEntries).filter((t) => t.billable), (t) => t.hours));
  const billableValue = round(sum(arr(data.timeEntries).filter((t) => t.billable), (entry) => {
    const project = arr(data.projects).find((p) => p.id === entry.projectId);
    const client = arr(data.clients).find((c) => c.id && project && c.id === project.clientId);
    return num(entry.hours) * num((project && project.rate) || (client && client.rate) || 0);
  }));
  const burn = burnRate(data);
  const activeClients = arr(data.clients).filter((c) => c.status === 'active').length;
  const metrics = {
    currency: code, received, spent, net: round(received - spent), outstanding,
    overdueCount: late.length, overdueAmount, activeClients,
    activeProjects: arr(data.projects).filter((p) => p.status === 'active').length,
    burnRate: burn, annualSubscriptions, billableHours, billableValue,
    trackedHours: round(sum(arr(data.timeEntries), (t) => t.hours)),
    paymentCount: payments.length, invoiceCount: invoices.length
  };
  const leaders = topClients(data);
  const findings = [
    leaders.length
      ? `Top client by paid income: ${leaders[0].name} (${money(leaders[0].amount, code)} across ${leaders[0].count} payments).`
      : 'No paid income yet. Add a payment with a client to unlock rankings.',
    `Average monthly burn: ${money(burn, code)}.`,
    outstanding > 0
      ? `Outstanding invoices total ${money(outstanding, code)}${late.length ? `, including ${late.length} overdue` : ''}.`
      : 'No outstanding invoice balance is recorded.',
    `Active subscriptions annualize to ${money(annualSubscriptions, code)}.`
  ];
  const actions = [];
  if (late.length) actions.push(`Follow up on ${late.length} overdue invoice(s) worth ${money(overdueAmount, code)}.`);
  if (billableHours > 0) actions.push(`Review ${billableHours} billable hours (${money(billableValue, code)}) for invoicing.`);
  if (annualSubscriptions > 0) actions.push(`Audit recurring tools: ${money(annualSubscriptions, code)} per year is committed.`);
  if (activeClients < 3) actions.push('Diversify: aim for at least three active clients.');
  if (!actions.length) actions.push('Bookkeeping looks current. Log this week’s time and reconcile upcoming dates.');
  return {
    mode: 'local', generatedAt: new Date().toISOString(),
    headline: `${money(received, code)} received · ${money(outstanding, code)} outstanding · ${activeClients} active client${activeClients === 1 ? '' : 's'}`,
    metrics, findings, actions, topClients: leaders, upcoming: upcoming(data), cashflow: cashflow(data),
    overdueInvoices: late
  };
}

function settings(config = {}) {
  const source = config && typeof config === 'object' ? config : {};
  return {
    endpoint: source.aiEndpoint || RUNTIME.aiEndpoint || '',
    key: source.aiKey || RUNTIME.aiKey || '',
    model: source.aiModel || RUNTIME.aiModel || 'atlas-local-llm'
  };
}

function mode(config) {
  const current = settings(config);
  return current.endpoint && current.key ? 'external' : 'local';
}

function modeLabel(config) {
  return mode(config) === 'external' ? 'External LLM (opt-in)' : 'Local deterministic engine';
}

function localAsk(data, question) {
  const result = analyze(data);
  const m = result.metrics;
  const q = String(question || '').toLowerCase();
  const fmt = (value) => money(value, m.currency);
  let answer;
  if (!q || /\b(help|what can you do|commands|hello|hi)\b/.test(q)) {
    answer = 'Ask about income, burn rate, overdue invoices, top clients, subscriptions, cashflow, billable time, goals, or payouts.';
  } else if (/\b(top|best|biggest)\b.*\b(client|customer)/.test(q) || (/\bclient/.test(q) && /\bwho|rank|revenue/.test(q))) {
    answer = result.topClients.length
      ? `Top clients: ${result.topClients.map((c, i) => `${i + 1}. ${c.name} — ${fmt(c.amount)} (${c.count} payments)`).join('; ')}.`
      : 'No paid client income recorded yet.';
  } else if (/\bburn|monthly cost|monthly spend|expense rate/.test(q)) {
    answer = `Monthly burn averages ${fmt(m.burnRate)}. Total paid expenses are ${fmt(m.spent)}.`;
  } else if (/\boverdue|late|unpaid|remind/.test(q)) {
    answer = m.overdueCount
      ? `${m.overdueCount} invoice(s) overdue, totaling ${fmt(m.overdueAmount)}.`
      : 'No overdue invoices recorded.';
  } else if (/\boutstanding|receivable|due|invoice/.test(q)) {
    answer = `Outstanding invoice balance is ${fmt(m.outstanding)} across ${m.invoiceCount} invoices.`;
  } else if (/\bsubscription|recurring|annual cost|saas/.test(q)) {
    answer = `Active subscriptions cost ${fmt(m.annualSubscriptions)} annually.`;
  } else if (/\bcashflow|cash flow|trend|net/.test(q)) {
    answer = `Six-month net cashflow: ${result.cashflow.map((p) => `${p.label} ${fmt(p.net)}`).join(', ')}.`;
  } else if (/\btime|billable|hours/.test(q)) {
    answer = `${m.trackedHours} hours tracked, ${m.billableHours} billable, valued at ${fmt(m.billableValue)}.`;
  } else if (/\bgoal|target/.test(q)) {
    answer = arr(data.goals).length
      ? `Goals: ${arr(data.goals).slice(0, 5).map((g) => `${g.name} ${Math.round((num(g.current) / (num(g.target) || 1)) * 100)}%`).join('; ')}.`
      : 'No goals tracked yet.';
  } else if (/\bpayout|withdraw/.test(q)) {
    answer = `${arr(data.payouts).filter((p) => p.status === 'pending').length} pending payout(s).`;
  } else if (/\bexpense|spend|spent|cost/.test(q)) {
    answer = `Paid expenses total ${fmt(m.spent)}; burn averages ${fmt(m.burnRate)} monthly.`;
  } else if (/\bincome|revenue|received|earn/.test(q)) {
    answer = `Paid income totals ${fmt(m.received)}. Outstanding invoices add ${fmt(m.outstanding)}.`;
  } else if (/\bsummary|insight|status|overview/.test(q)) {
    answer = `${result.headline}. ${result.findings.slice(0, 3).join(' ')} Next: ${result.actions[0]}`;
  } else {
    answer = `I could not map "${String(question || '').slice(0, 120)}" to a local metric. Ask about clients, burn, invoices, subscriptions, cashflow, time, goals, or payouts.`;
  }
  return { mode: 'local', answer, intent: 'local-parse', at: new Date().toISOString(), question: String(question || '') };
}

async function ask(data, question, config = {}) {
  const current = settings(config);
  if (mode(config) === 'external') {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(current.endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${current.key}` },
          body: JSON.stringify({
            model: current.model,
            system: 'You are Atlas AI, a concise bookkeeping assistant. Use only the provided context. Never invent transactions. Under 150 words.',
            question: String(question || ''),
            context: {
              currency: data.settings.currency,
              metrics: analyze(data).metrics,
              topClients: topClients(data, 5),
              upcoming: upcoming(data, 5)
            }
          }),
          signal: controller.signal
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json().catch(() => ({}));
        const answer = String(payload.answer || payload.response || payload.content || '').trim();
        if (!answer) throw new Error('No response text');
        return { mode: 'external', answer, intent: 'external-llm', at: new Date().toISOString(), question };
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      const fallback = localAsk(data, question);
      fallback.answer = `External AI unavailable (${esc(String(error && error.message).slice(0, 80))}). ${fallback.answer}`;
      fallback.fallback = true;
      return fallback;
    }
  }
  return localAsk(data, question);
}

export const ai = { analyze, localAsk, ask, mode, modeLabel, settings, cashflow, topClients, upcoming, overdue };
export default ai;
