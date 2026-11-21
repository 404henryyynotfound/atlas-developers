'use strict';

/** Deterministic, offline business metrics and insight generation. */

const model = require('./model');

const DAY = 24 * 60 * 60 * 1000;

function monthKeys(count = 6) {
  const keys = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(date.toISOString().slice(0, 7));
  }
  return keys;
}

function sum(list, selector = () => 0) {
  return list.reduce((total, item) => total + model.num(selector(item), 0), 0);
}

function cashflow(data, months = 6) {
  const keys = monthKeys(months);
  const currency = (data && data.settings && data.settings.currency) || 'USD';
  return keys.map((key) => {
    const inMonth = model.arr(data && data.payments).filter((payment) => model.monthKey(payment.date) === key);
    const income = sum(inMonth.filter((p) => p.type === 'income' && p.status === 'paid'), (p) => p.amount);
    const expense = sum(inMonth.filter((p) => p.type === 'expense' && p.status === 'paid'), (p) => p.amount);
    return {
      month: key,
      label: new Date(`${key}-01T00:00:00Z`).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
      income: model.roundMoney(income),
      expense: model.roundMoney(expense),
      net: model.roundMoney(income - expense),
      currency
    };
  });
}

function burnRate(data) {
  const recent = cashflow(data, 3);
  const withSpend = recent.filter((point) => point.expense > 0);
  if (withSpend.length) return model.roundMoney(sum(withSpend, (p) => p.expense) / withSpend.length);
  const cutoff = Date.now() - 30 * DAY;
  const last30 = model.arr(data && data.payments).filter((payment) => (
    payment.type === 'expense' && new Date(`${model.isoDate(payment.date)}T00:00:00Z`).getTime() >= cutoff
  ));
  return model.roundMoney(sum(last30, (p) => p.amount));
}

function avgIncome(data) {
  const recent = cashflow(data, 3);
  const withIncome = recent.filter((point) => point.income > 0);
  if (!withIncome.length) return 0;
  return model.roundMoney(sum(withIncome, (p) => p.income) / withIncome.length);
}

function clientName(data, id) {
  const client = model.arr(data && data.clients).find((item) => item.id === id);
  return client ? client.name : 'Unassigned';
}

function projectName(data, id) {
  const project = model.arr(data && data.projects).find((item) => item.id === id);
  return project ? project.name : 'Unassigned';
}

function topClients(data, limit = 5) {
  const groups = new Map();
  model.arr(data && data.payments).filter((p) => p.type === 'income' && p.status === 'paid').forEach((payment) => {
    const key = payment.clientId || 'unassigned';
    const entry = groups.get(key) || { clientId: key, name: clientName(data, key), amount: 0, count: 0 };
    entry.amount += model.num(payment.amount, 0);
    entry.count += 1;
    groups.set(key, entry);
  });
  return Array.from(groups.values())
    .map((entry) => ({ ...entry, amount: model.roundMoney(entry.amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

function annualizedSubscriptions(data) {
  const factors = { weekly: 52, monthly: 12, quarterly: 4, yearly: 1 };
  return model.roundMoney(sum(
    model.arr(data && data.subscriptions).filter((s) => s.status === 'active'),
    (s) => s.amount * (factors[s.frequency] || 12)
  ));
}

function overdueInvoices(data) {
  const today = model.todayISO();
  return model.arr(data && data.invoices).filter((invoice) => (
    invoice.status !== 'paid' && (invoice.status === 'overdue' || invoice.dueDate < today)
  ));
}

function upcoming(data, limit = 8) {
  const today = model.todayISO();
  const items = [];
  model.arr(data && data.subscriptions).filter((s) => s.status === 'active' && s.nextDate).forEach((s) => {
    items.push({ date: s.nextDate, kind: 'subscription', label: s.name, amount: s.amount, currency: s.currency, ref: s.id });
  });
  model.arr(data && data.payouts).filter((p) => p.status === 'pending' && p.date).forEach((p) => {
    items.push({ date: p.date, kind: 'payout', label: p.destination || 'Payout', amount: p.amount, currency: p.currency, ref: p.id });
  });
  model.arr(data && data.invoices).filter((i) => i.status !== 'paid' && i.dueDate).forEach((i) => {
    items.push({ date: i.dueDate, kind: 'invoice', label: `${i.number} due`, amount: i.amount, currency: i.currency, ref: i.id });
  });
  return items
    .filter((item) => item.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(0, limit);
}

function metrics(data) {
  const payments = model.arr(data && data.payments);
  const invoices = model.arr(data && data.invoices);
  const currency = (data && data.settings && data.settings.currency) || 'USD';
  const received = sum(payments.filter((p) => p.type === 'income' && p.status === 'paid'), (p) => p.amount);
  const spent = sum(payments.filter((p) => p.type === 'expense' && p.status === 'paid'), (p) => p.amount);
  const outstanding = sum(invoices.filter((i) => i.status === 'sent' || i.status === 'overdue'), (i) => i.amount);
  const overdue = overdueInvoices(data);
  const activeClients = model.arr(data && data.clients).filter((c) => c.status === 'active').length;
  const activeProjects = model.arr(data && data.projects).filter((p) => p.status === 'active').length;
  const billableHours = sum(model.arr(data && data.timeEntries).filter((t) => t.billable), (t) => t.hours);
  const trackedHours = sum(model.arr(data && data.timeEntries), (t) => t.hours);
  const billableValue = model.roundMoney(sum(model.arr(data && data.timeEntries).filter((t) => t.billable), (entry) => {
    const project = model.arr(data && data.projects).find((p) => p.id === entry.projectId);
    const client = model.arr(data && data.clients).find((c) => c.id === (project && project.clientId));
    return model.num(entry.hours) * model.num((project && project.rate) || (client && client.rate) || 0);
  }));
  const burn = burnRate(data);
  const income = avgIncome(data);
  const net = model.roundMoney(received - spent);
  return {
    currency,
    received: model.roundMoney(received),
    spent: model.roundMoney(spent),
    net,
    outstanding: model.roundMoney(outstanding),
    overdueCount: overdue.length,
    overdueAmount: model.roundMoney(sum(overdue, (i) => i.amount)),
    activeClients,
    activeProjects,
    burnRate: burn,
    avgIncome: income,
    runwayMonths: burn > 0 ? model.roundMoney(net / burn) : 0,
    annualSubscriptions: annualizedSubscriptions(data),
    billableHours: model.roundMoney(billableHours),
    trackedHours: model.roundMoney(trackedHours),
    billableValue,
    paymentCount: payments.length,
    invoiceCount: invoices.length
  };
}

function findings(data, m) {
  const list = [];
  const top = topClients(data, 3);
  if (top.length) {
    list.push(`Top client by paid income: ${top[0].name} (${model.formatMoney(top[0].amount, m.currency)} across ${top[0].count} payment${top[0].count === 1 ? '' : 's'}).`);
  } else {
    list.push('No paid income recorded yet. Add a payment to unlock client rankings.');
  }
  list.push(`Average monthly burn: ${model.formatMoney(m.burnRate, m.currency)} over the last active months.`);
  if (m.outstanding > 0) {
    list.push(`Outstanding invoices total ${model.formatMoney(m.outstanding, m.currency)}${m.overdueCount ? `, including ${m.overdueCount} overdue` : ''}.`);
  } else {
    list.push('No outstanding invoice balance is currently recorded.');
  }
  list.push(`Active subscriptions annualize to ${model.formatMoney(m.annualSubscriptions, m.currency)}.`);
  if (m.billableHours > 0) {
    list.push(`${m.billableHours} billable hours tracked, valued at ${model.formatMoney(m.billableValue, m.currency)}.`);
  }
  return list;
}

function actions(data, m) {
  const list = [];
  if (m.overdueCount > 0) {
    list.push(`Follow up on ${m.overdueCount} overdue invoice${m.overdueCount === 1 ? '' : 's'} (${model.formatMoney(m.overdueAmount, m.currency)}) before the next payout run.`);
  }
  const unbilled = model.arr(data && data.timeEntries).filter((t) => t.billable && !t.invoiced);
  if (unbilled.length) {
    list.push(`Review ${unbilled.length} billable time entr${unbilled.length === 1 ? 'y' : 'ies'} for invoicing.`);
  }
  if (m.annualSubscriptions > 0) {
    list.push(`Audit recurring tools: ${model.formatMoney(m.annualSubscriptions, m.currency)} per year is currently committed.`);
  }
  if (m.activeClients < 3) {
    list.push('Diversify: aim for at least three active clients to reduce concentration risk.');
  }
  if (m.runwayMonths > 0 && m.runwayMonths < 3) {
    list.push(`Runway is under three months at the current burn rate; consider shortening payment terms.`);
  }
  if (!list.length) list.push('Bookkeeping looks current. Log this week’s time and reconcile upcoming dates.');
  return list;
}

function insight(data) {
  const normalized = model.normalizeData(data);
  const m = metrics(normalized);
  return {
    mode: 'local',
    generatedAt: new Date().toISOString(),
    headline: `${model.formatMoney(m.received, m.currency)} received · ${model.formatMoney(m.outstanding, m.currency)} outstanding · ${m.activeClients} active client${m.activeClients === 1 ? '' : 's'}`,
    metrics: m,
    findings: findings(normalized, m),
    actions: actions(normalized, m),
    upcoming: upcoming(normalized),
    topClients: topClients(normalized),
    cashflow: cashflow(normalized)
  };
}

function formatInsightText(result, title = 'ATLAS AI — LOCAL INSIGHT') {
  const lines = [title, '='.repeat(title.length), ''];
  lines.push(result.headline || '');
  lines.push('');
  lines.push('FINDINGS');
  (result.findings || []).forEach((item) => lines.push(`  - ${item}`));
  lines.push('');
  lines.push('NEXT ACTIONS');
  (result.actions || []).forEach((item, index) => lines.push(`  ${index + 1}. ${item}`));
  if ((result.upcoming || []).length) {
    lines.push('');
    lines.push('UPCOMING');
    result.upcoming.slice(0, 5).forEach((item) => {
      lines.push(`  ${item.date}  ${item.kind.padEnd(12)} ${item.label}  ${model.formatMoney(item.amount, item.currency)}`);
    });
  }
  lines.push('');
  lines.push(`Generated ${result.generatedAt || new Date().toISOString()} · deterministic local engine · no network requests`);
  return lines.join('\n');
}

module.exports = {
  monthKeys, cashflow, burnRate, avgIncome, topClients, annualizedSubscriptions,
  overdueInvoices, upcoming, metrics, findings, actions, insight, formatInsightText,
  clientName, projectName
};
