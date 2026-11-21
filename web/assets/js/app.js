/** Atlas Developers dashboard — static ES-module SPA, no bundler, no runtime deps. */

import { APP, ROUTES, CURRENCIES, RUNTIME } from './config.js';
import {
  esc, attr, num, round, parseMoney, money, uid, todayISO, addDaysISO,
  prettyDate, relativeDate, percent, emptyState, statusPill, sectionHead,
  downloadText, copyText, qs
} from './utils.js';
import { store } from './store.js';
import { api } from './api.js';
import { ai } from './ai.js';
import * as charts from './charts.js';
import { mountDownloads } from './download.js';
import { initCalendarWidget } from './calendar-widget.js';

let data = store.get();
const state = {
  filters: {
    payments: { type: '', status: '', client: '', search: '' },
    invoices: { status: '', search: '' },
    clients: { search: '' },
    subscriptions: { status: 'active' }
  },
  editing: null,
  aiResult: null,
  sync: api.snapshot()
};

const landingEl = qs('#landing');
const appEl = qs('#app');
const viewEl = qs('#view');
const routesEl = qs('#routes');
const titleEl = qs('#route-title');
const toastEl = qs('#toast');
let toastTimer = null;

function toast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2800);
}

function routeFromHash() {
  const raw = String(location.hash || '').replace(/^#\/?/, '').split('?')[0].trim();
  if (!raw || raw === 'landing' || raw === 'home') return 'landing';
  return ROUTES.some(([id]) => id === raw) ? raw : 'overview';
}

function currentCurrency() { return data.settings.currency || 'USD'; }
function fmt(value) { return money(value, currentCurrency()); }

function clientName(id) {
  const client = data.clients.find((item) => item.id === id);
  return client ? client.name : 'Unassigned';
}

function projectName(id) {
  const project = data.projects.find((item) => item.id === id);
  return project ? project.name : 'Unassigned';
}

function clientOptions(selected = '') {
  return `<option value="">— no client —</option>${data.clients.map((client) => (
    `<option value="${attr(client.id)}"${client.id === selected ? ' selected' : ''}>${esc(client.name)}</option>`
  )).join('')}`;
}

function projectOptions(selected = '') {
  return `<option value="">— no project —</option>${data.projects.map((project) => (
    `<option value="${attr(project.id)}"${project.id === selected ? ' selected' : ''}>${esc(project.name)}</option>`
  )).join('')}`;
}

function currencyOptions(selected = '') {
  return CURRENCIES.map((code) => (
    `<option value="${attr(code)}"${code === selected ? ' selected' : ''}>${esc(code)}</option>`
  )).join('');
}

function textField(prefix, name, label, value = '', type = 'text', extra = '') {
  const id = `${prefix}-${name}`;
  return `<div class="field"><label for="${attr(id)}">${esc(label)}</label><input id="${attr(id)}" name="${attr(name)}" type="${attr(type)}" value="${attr(value)}" ${extra}></div>`;
}

function selectField(prefix, name, label, options) {
  const id = `${prefix}-${name}`;
  return `<div class="field"><label for="${attr(id)}">${esc(label)}</label><select id="${attr(id)}" name="${attr(name)}">${options}</select></div>`;
}

function checkField(prefix, name, label, checked) {
  const id = `${prefix}-${name}`;
  return `<div class="field field-checkbox"><input id="${attr(id)}" name="${attr(name)}" type="checkbox"${checked ? ' checked' : ''}><label for="${attr(id)}">${esc(label)}</label></div>`;
}

function editBanner(kind) {
  if (!state.editing || state.editing.kind !== kind) return '';
  return `<div class="install-head" style="margin-bottom:12px"><span class="kind-tag">editing</span><span class="hint">${esc(state.editing.id)}</span><button class="btn btn-small btn-ghost" type="button" data-action="cancel-edit">Cancel edit</button></div>`;
}

function metricCard(label, value, sub, accent = '') {
  return `<article class="card"><div class="card-head"><h3>${esc(label)}</h3></div><div class="metric ${accent}">${esc(value)}</div>${sub ? `<div class="metric-sub">${esc(sub)}</div>` : ''}</article>`;
}

/* ---------------- Views ---------------- */

function overviewView() {
  const result = ai.analyze(data);
  const m = result.metrics;
  const upcoming = result.upcoming.length
    ? `<div class="list">${result.upcoming.map((item) => `<div class="list-row">
        <span class="kind-tag">${esc(item.kind)}</span>
        <div class="main"><strong>${esc(item.label)}</strong><small>${esc(prettyDate(item.date))} · ${esc(relativeDate(item.date))}</small></div>
        <span class="value">${esc(money(item.amount, item.currency))}</span></div>`).join('')}</div>`
    : emptyState('Nothing upcoming', 'Add subscriptions, payouts or invoices to see dates here.');

  const activity = data.activity.length
    ? `<div class="list">${data.activity.slice(0, 7).map((item) => `<div class="list-row">
        <span class="kind-tag">${esc(item.type)}</span><div class="main"><strong>${esc(item.message)}</strong><small>${esc(String(item.at).slice(0, 16).replace('T', ' '))}</small></div></div>`).join('')}</div>`
    : emptyState('No activity yet', 'Changes you make in the app or CLI will appear here.');

  const leaders = result.topClients.length
    ? charts.barChart(result.topClients.map((client) => ({
      label: client.name, value: client.amount, display: money(client.amount, m.currency)
    })))
    : emptyState('No client ranking yet', 'Record paid income with a client to build this chart.');

  return `${sectionHead('Workspace overview', 'A live view of money in, money out, and what is next.', `<a class="btn btn-small" href="#/payments">＋ Add payment</a><a class="btn btn-small" href="#/insights">✦ Atlas AI</a>`)}
    <div class="grid grid-4">
      ${metricCard('Total received', money(m.received, m.currency), `${m.paymentCount} payments recorded`, 'hl')}
      ${metricCard('Outstanding invoices', money(m.outstanding, m.currency), `${m.overdueCount} overdue`, 'lime')}
      ${metricCard('Monthly burn', money(m.burnRate, m.currency), '3-month active average')}
      ${metricCard('Active clients', String(m.activeClients), `${m.activeProjects} active projects`)}
    </div>
    <div class="grid grid-2" style="margin-top:16px">
      <article class="card"><div class="card-head"><h3>Cashflow · 6 months</h3><span class="hint"><span style="color:var(--cyan)">━━</span> income &nbsp; <span style="color:var(--lime)">┄┄</span> expenses</span></div>${charts.lineChart(result.cashflow)}</article>
      <article class="card"><div class="card-head"><h3>Upcoming dates</h3><a class="hint" href="#/subscriptions">manage ↗</a></div>${upcoming}</article>
    </div>
    <div class="grid grid-2" style="margin-top:16px">
      <article class="card"><div class="card-head"><h3>Top clients</h3><a class="hint" href="#/clients">all clients ↗</a></div>${leaders}</article>
      <article class="card"><div class="card-head"><h3>Recent activity</h3><span class="hint">local audit trail</span></div>${activity}</article>
    </div>`;
}

function paymentFormMarkup() {
  const editing = state.editing && state.editing.kind === 'payment'
    ? data.payments.find((item) => item.id === state.editing.id) : null;
  return `<form class="inline-form" data-form="payment">
    ${editBanner('payment')}
    <input type="hidden" name="id" value="${attr(editing ? editing.id : '')}">
    <h3>${editing ? 'Edit payment' : 'Add a payment'}</h3>
    <div class="form-grid">
      ${selectField('pay', 'type', 'Type', `<option value="income"${!editing || editing.type === 'income' ? ' selected' : ''}>Income</option><option value="expense"${editing && editing.type === 'expense' ? ' selected' : ''}>Expense</option>`)}
      ${textField('pay', 'amount', 'Amount', editing ? editing.amount : '', 'number', 'min="0" step="0.01" required')}
      ${textField('pay', 'date', 'Date', editing ? editing.date : todayISO(), 'date')}
      ${selectField('pay', 'client', 'Client', clientOptions(editing ? editing.clientId : ''))}
      ${selectField('pay', 'project', 'Project', projectOptions(editing ? editing.projectId : ''))}
      ${textField('pay', 'description', 'Description', editing ? editing.description : '', 'text', 'placeholder="e.g. June retainer"')}
      ${textField('pay', 'category', 'Category', editing ? editing.category : '', 'text', 'placeholder="software, travel…"')}
      ${selectField('pay', 'status', 'Status', ['paid', 'pending', 'overdue'].map((s) => `<option value="${s}"${editing && editing.status === s || !editing && s === 'paid' ? ' selected' : ''}>${s}</option>`).join(''))}
      <div class="form-actions"><button class="btn btn-primary" type="submit">${editing ? 'Save changes' : '＋ Add payment'}</button></div>
    </div>
  </form>`;
}

function paymentsView() {
  const f = state.filters.payments;
  let rows = data.payments.slice();
  if (f.type) rows = rows.filter((p) => p.type === f.type);
  if (f.status) rows = rows.filter((p) => p.status === f.status);
  if (f.client) rows = rows.filter((p) => p.clientId === f.client);
  if (f.search) rows = rows.filter((p) => `${p.description} ${p.category}`.toLowerCase().includes(f.search.toLowerCase()));
  rows.sort((a, b) => a.date.localeCompare(b.date));
  let running = 0;
  const tableRows = rows.map((p) => {
    running += p.type === 'income' ? p.amount : -p.amount;
    return `<tr>
      <td>${esc(prettyDate(p.date))}</td>
      <td>${esc(p.type)}</td>
      <td>${esc(p.description || '—')}<br><span class="hint">${esc(p.category || '')}</span></td>
      <td>${esc(clientName(p.clientId))}</td>
      <td>${statusPill(p.status)}</td>
      <td class="num" style="color:${p.type === 'income' ? 'var(--lime)' : 'var(--red)'}">${p.type === 'expense' ? '-' : ''}${esc(money(p.amount, p.currency))}</td>
      <td class="num">${esc(fmt(running))}</td>
      <td class="actions"><div class="row-actions">
        <button type="button" data-action="edit-payment" data-id="${attr(p.id)}">Edit</button>
        ${p.status !== 'paid' ? `<button type="button" data-action="pay-paid" data-id="${attr(p.id)}">Paid</button>` : ''}
        <button type="button" data-action="delete-payment" data-id="${attr(p.id)}">✕</button>
      </div></td>
    </tr>`;
  }).join('');
  const income = rows.filter((p) => p.type === 'income').reduce((sum, p) => sum + p.amount, 0);
  const expense = rows.filter((p) => p.type === 'expense').reduce((sum, p) => sum + p.amount, 0);
  return `${sectionHead('Payments', 'Income and expenses, entirely manual and local.', '')}
    <div class="toolbar">
      <div class="field"><label for="filter-payment-search">Search</label><input id="filter-payment-search" data-filter="payments.search" value="${attr(f.search)}" placeholder="description or category"></div>
      ${selectField('filter-payment', 'type', 'Type', `<option value="">All types</option><option value="income"${f.type === 'income' ? ' selected' : ''}>Income</option><option value="expense"${f.type === 'expense' ? ' selected' : ''}>Expense</option>`)}
      ${selectField('filter-payment', 'status', 'Status', `<option value="">All statuses</option>${['paid', 'pending', 'overdue'].map((s) => `<option value="${s}"${f.status === s ? ' selected' : ''}>${s}</option>`).join('')}`)}
      ${selectField('filter-payment', 'client', 'Client', `<option value="">All clients</option>${data.clients.map((c) => `<option value="${attr(c.id)}"${f.client === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}`)}
    </div>
    ${paymentFormMarkup()}
    <div class="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Client</th><th>Status</th><th class="num">Amount</th><th class="num">Running</th><th></th></tr></thead><tbody>${tableRows || `<tr><td colspan="8">${emptyState('No matching payments', 'Adjust filters or add a payment above.')}</td></tr>`}</tbody></table></div>
    <div class="card" style="margin-top:16px"><div class="card-head"><h3>Filtered totals</h3><span class="hint">${rows.length} rows</span></div>
      <div class="grid grid-3"><div><span class="hint">Income</span><div class="metric hl">${esc(fmt(income))}</div></div><div><span class="hint">Expenses</span><div class="metric" style="color:var(--red)">${esc(fmt(expense))}</div></div><div><span class="hint">Net</span><div class="metric lime">${esc(fmt(income - expense))}</div></div></div>
    </div>`;
}

function invoiceFormMarkup() {
  const editing = state.editing && state.editing.kind === 'invoice'
    ? data.invoices.find((item) => item.id === state.editing.id) : null;
  const issue = editing ? editing.issueDate : todayISO();
  return `<form class="inline-form" data-form="invoice">
    ${editBanner('invoice')}
    <input type="hidden" name="id" value="${attr(editing ? editing.id : '')}">
    <h3>${editing ? 'Edit invoice' : 'Create an invoice'}</h3>
    <div class="form-grid">
      ${textField('inv', 'number', 'Number', editing ? editing.number : `INV-${new Date().getFullYear()}-${String(data.invoices.length + 1).padStart(3, '0')}`, 'text', 'required')}
      ${selectField('inv', 'client', 'Client', clientOptions(editing ? editing.clientId : ''))}
      ${selectField('inv', 'project', 'Project', projectOptions(editing ? editing.projectId : ''))}
      ${textField('inv', 'issueDate', 'Issue date', issue, 'date')}
      ${textField('inv', 'dueDate', 'Due date', editing ? editing.dueDate : addDaysISO(issue, 14), 'date')}
      ${textField('inv', 'amount', 'Amount', editing ? editing.amount : '', 'number', 'min="0" step="0.01" required')}
      ${selectField('inv', 'status', 'Status', ['draft', 'sent', 'paid', 'overdue'].map((s) => `<option value="${s}"${editing && editing.status === s || !editing && s === 'draft' ? ' selected' : ''}>${s}</option>`).join(''))}
      <div class="form-actions"><button class="btn btn-primary" type="submit">${editing ? 'Save changes' : '＋ Create invoice'}</button></div>
    </div>
  </form>`;
}

function invoicesView() {
  const f = state.filters.invoices;
  const today = todayISO();
  let rows = data.invoices.slice();
  if (f.status) rows = rows.filter((i) => f.status === 'overdue' ? (i.status !== 'paid' && i.dueDate < today) : i.status === f.status);
  if (f.search) rows = rows.filter((i) => `${i.number} ${clientName(i.clientId)}`.toLowerCase().includes(f.search.toLowerCase()));
  rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const outstanding = rows.filter((i) => i.status === 'sent' || i.status === 'overdue').reduce((sum, i) => sum + i.amount, 0);
  return `${sectionHead('Invoices', 'Track what is owed and what is late.', '')}
    <div class="toolbar">
      <div class="field"><label for="filter-invoice-search">Search</label><input id="filter-invoice-search" data-filter="invoices.search" value="${attr(f.search)}" placeholder="number or client"></div>
      ${selectField('filter-invoice', 'status', 'Status', `<option value="">All statuses</option>${['draft', 'sent', 'paid', 'overdue'].map((s) => `<option value="${s}"${f.status === s ? ' selected' : ''}>${s}</option>`).join('')}`)}
    </div>
    ${invoiceFormMarkup()}
    <div class="table-wrap"><table><thead><tr><th>Number</th><th>Client</th><th>Issued</th><th>Due</th><th>Status</th><th class="num">Amount</th><th></th></tr></thead><tbody>${rows.map((invoice) => {
      const late = invoice.status !== 'paid' && invoice.dueDate < today;
      return `<tr${late ? ' style="background:rgba(255,107,122,.05)"' : ''}>
        <td class="mono">${esc(invoice.number)}</td><td>${esc(clientName(invoice.clientId))}</td>
        <td>${esc(prettyDate(invoice.issueDate))}</td><td>${esc(prettyDate(invoice.dueDate))}<br><span class="hint">${esc(relativeDate(invoice.dueDate))}</span></td>
        <td>${statusPill(late ? 'overdue' : invoice.status)}</td><td class="num">${esc(money(invoice.amount, invoice.currency))}</td>
        <td class="actions"><div class="row-actions">
          ${invoice.status !== 'sent' && invoice.status !== 'paid' ? `<button type="button" data-action="invoice-send" data-id="${attr(invoice.id)}">Send</button>` : ''}
          ${invoice.status !== 'paid' ? `<button type="button" data-action="invoice-paid" data-id="${attr(invoice.id)}">Mark paid</button>` : ''}
          <button type="button" data-action="edit-invoice" data-id="${attr(invoice.id)}">Edit</button>
          <button type="button" data-action="delete-invoice" data-id="${attr(invoice.id)}">✕</button>
        </div></td></tr>`;
    }).join('') || `<tr><td colspan="7">${emptyState('No invoices yet', 'Create one above, or use: atlas invoices add --client &lt;id&gt; --amount 500')}</td></tr>`}</tbody></table></div>
    <div class="card" style="margin-top:16px"><div class="card-head"><h3>Outstanding (filtered)</h3></div><div class="metric lime">${esc(fmt(outstanding))}</div></div>`;
}

function clientsView() {
  const search = state.filters.clients.search.toLowerCase();
  const rows = data.clients.filter((c) => `${c.name} ${c.company} ${c.email}`.toLowerCase().includes(search));
  const editing = state.editing && state.editing.kind === 'client' ? data.clients.find((c) => c.id === state.editing.id) : null;
  return `${sectionHead('Clients', 'People and companies you invoice.', '')}
    <div class="toolbar"><div class="field"><label for="filter-client-search">Search</label><input id="filter-client-search" data-filter="clients.search" value="${attr(state.filters.clients.search)}" placeholder="name, company, email"></div></div>
    <form class="inline-form" data-form="client">
      ${editBanner('client')}
      <input type="hidden" name="id" value="${attr(editing ? editing.id : '')}"><h3>${editing ? 'Edit client' : 'Add a client'}</h3>
      <div class="form-grid">
        ${textField('cli', 'name', 'Name', editing ? editing.name : '', 'text', 'required')}
        ${textField('cli', 'company', 'Company', editing ? editing.company : '')}
        ${textField('cli', 'email', 'Email', editing ? editing.email : '', 'email')}
        ${textField('cli', 'rate', 'Default rate', editing ? editing.rate : '', 'number', 'min="0" step="1"')}
        ${selectField('cli', 'currency', 'Currency', currencyOptions(editing ? editing.currency : currentCurrency()))}
        <div class="form-actions"><button class="btn btn-primary" type="submit">${editing ? 'Save changes' : '＋ Add client'}</button></div>
      </div>
    </form>
    <div class="table-wrap"><table><thead><tr><th>Name</th><th>Company</th><th>Email</th><th>Rate</th><th>Projects</th><th>Status</th><th></th></tr></thead><tbody>${rows.map((c) => `<tr>
      <td><strong>${esc(c.name)}</strong></td><td>${esc(c.company || '—')}</td><td>${esc(c.email || '—')}</td>
      <td class="num">${esc(money(c.rate, c.currency))}</td><td>${data.projects.filter((p) => p.clientId === c.id).length}</td>
      <td>${statusPill(c.status)}</td><td class="actions"><div class="row-actions">
        <button type="button" data-action="edit-client" data-id="${attr(c.id)}">Edit</button>
        <button type="button" data-action="delete-client" data-id="${attr(c.id)}">✕</button></div></td></tr>`).join('') || `<tr><td colspan="7">${emptyState('No clients yet', 'Add a client to start tracking invoices and income.')}</td></tr>`}</tbody></table></div>`;
}

function projectsView() {
  const editing = state.editing && state.editing.kind === 'project' ? data.projects.find((p) => p.id === state.editing.id) : null;
  return `${sectionHead('Projects', 'Work attached to clients and hourly rates.', '')}
    <form class="inline-form" data-form="project">
      ${editBanner('project')}
      <input type="hidden" name="id" value="${attr(editing ? editing.id : '')}"><h3>${editing ? 'Edit project' : 'Add a project'}</h3>
      <div class="form-grid">
        ${textField('prj', 'name', 'Name', editing ? editing.name : '', 'text', 'required')}
        ${selectField('prj', 'client', 'Client', clientOptions(editing ? editing.clientId : ''))}
        ${textField('prj', 'rate', 'Hourly rate', editing ? editing.rate : '', 'number', 'min="0" step="1"')}
        ${selectField('prj', 'status', 'Status', ['active', 'paused', 'done'].map((s) => `<option value="${s}"${editing && editing.status === s || !editing && s === 'active' ? ' selected' : ''}>${s}</option>`).join(''))}
        <div class="form-actions"><button class="btn btn-primary" type="submit">${editing ? 'Save changes' : '＋ Add project'}</button></div>
      </div>
    </form>
    <div class="table-wrap"><table><thead><tr><th>Project</th><th>Client</th><th>Status</th><th class="num">Rate</th><th class="num">Hours</th><th></th></tr></thead><tbody>${data.projects.map((p) => `<tr>
      <td><strong>${esc(p.name)}</strong></td><td>${esc(clientName(p.clientId))}</td><td>${statusPill(p.status)}</td>
      <td class="num">${p.rate ? esc(money(p.rate, p.currency)) : '—'}</td>
      <td class="num">${esc(round(data.timeEntries.filter((t) => t.projectId === p.id).reduce((s, t) => s + t.hours, 0)))}</td>
      <td class="actions"><div class="row-actions"><button type="button" data-action="edit-project" data-id="${attr(p.id)}">Edit</button><button type="button" data-action="delete-project" data-id="${attr(p.id)}">✕</button></div></td></tr>`).join('') || `<tr><td colspan="6">${emptyState('No projects yet', 'Create a project to track billable time.')}</td></tr>`}</tbody></table></div>`;
}

function subscriptionsView() {
  const editing = state.editing && state.editing.kind === 'subscription' ? data.subscriptions.find((s) => s.id === state.editing.id) : null;
  const status = state.filters.subscriptions.status;
  const rows = data.subscriptions.filter((s) => !status || s.status === status);
  const annual = rows.filter((s) => s.status === 'active').reduce((sum, s) => {
    const factors = { weekly: 52, monthly: 12, quarterly: 4, yearly: 1 };
    return sum + s.amount * (factors[s.frequency] || 12);
  }, 0);
  return `${sectionHead('Subscriptions', 'Recurring tools and their true annual cost.', '')}
    <div class="toolbar">${selectField('filter-sub', 'status', 'Status', `<option value="">All</option><option value="active"${status === 'active' ? ' selected' : ''}>Active</option><option value="cancelled"${status === 'cancelled' ? ' selected' : ''}>Cancelled</option>`)}</div>
    <form class="inline-form" data-form="subscription">
      ${editBanner('subscription')}
      <input type="hidden" name="id" value="${attr(editing ? editing.id : '')}"><h3>${editing ? 'Edit subscription' : 'Add a subscription'}</h3>
      <div class="form-grid">
        ${textField('sub', 'name', 'Name', editing ? editing.name : '', 'text', 'required')}
        ${textField('sub', 'vendor', 'Vendor', editing ? editing.vendor : '')}
        ${textField('sub', 'amount', 'Amount', editing ? editing.amount : '', 'number', 'min="0" step="0.01" required')}
        ${selectField('sub', 'frequency', 'Frequency', ['weekly', 'monthly', 'quarterly', 'yearly'].map((x) => `<option value="${x}"${editing && editing.frequency === x || !editing && x === 'monthly' ? ' selected' : ''}>${x}</option>`).join(''))}
        ${textField('sub', 'nextDate', 'Next date', editing ? editing.nextDate : addDaysISO(todayISO(), 30), 'date')}
        ${selectField('sub', 'status', 'Status', ['active', 'cancelled'].map((x) => `<option value="${x}"${editing && editing.status === x || !editing && x === 'active' ? ' selected' : ''}>${x}</option>`).join(''))}
        <div class="form-actions"><button class="btn btn-primary" type="submit">${editing ? 'Save changes' : '＋ Add subscription'}</button></div>
      </div>
    </form>
    <div class="grid grid-3" style="margin-bottom:16px">
      ${metricCard('Annualized cost', fmt(annual), 'active subscriptions only', 'lime')}
      ${metricCard('Active', String(rows.filter((s) => s.status === 'active').length), 'subscriptions')}
      ${metricCard('Next payment', rows.filter((s) => s.status === 'active').map((s) => s.nextDate).sort()[0] ? prettyDate(rows.filter((s) => s.status === 'active').map((s) => s.nextDate).sort()[0]) : '—', 'earliest date')}
    </div>
    <div class="table-wrap"><table><thead><tr><th>Name</th><th>Vendor</th><th class="num">Amount</th><th>Frequency</th><th>Next</th><th>Status</th><th></th></tr></thead><tbody>${rows.map((s) => `<tr>
      <td><strong>${esc(s.name)}</strong></td><td>${esc(s.vendor || '—')}</td><td class="num">${esc(money(s.amount, s.currency))}</td>
      <td>${esc(s.frequency)}</td><td>${esc(prettyDate(s.nextDate))}</td><td>${statusPill(s.status)}</td>
      <td class="actions"><div class="row-actions"><button type="button" data-action="edit-subscription" data-id="${attr(s.id)}">Edit</button><button type="button" data-action="delete-subscription" data-id="${attr(s.id)}">✕</button></div></td></tr>`).join('') || `<tr><td colspan="7">${emptyState('No subscriptions', 'Add recurring costs to see annualized burn.')}</td></tr>`}</tbody></table></div>`;
}

function timeView() {
  const editing = state.editing && state.editing.kind === 'time' ? data.timeEntries.find((t) => t.id === state.editing.id) : null;
  const hours = data.timeEntries.reduce((sum, t) => sum + t.hours, 0);
  const billable = data.timeEntries.filter((t) => t.billable).reduce((sum, t) => sum + t.hours, 0);
  const value = data.timeEntries.filter((t) => t.billable).reduce((sum, entry) => {
    const project = data.projects.find((p) => p.id === entry.projectId);
    const client = data.clients.find((c) => c.id && project && c.id === project.clientId);
    return sum + entry.hours * num((project && project.rate) || (client && client.rate) || 0);
  }, 0);
  return `${sectionHead('Time tracking', 'Billable hours, valued at project or client rates.', '')}
    <form class="inline-form" data-form="time">
      ${editBanner('time')}
      <input type="hidden" name="id" value="${attr(editing ? editing.id : '')}"><h3>${editing ? 'Edit time entry' : 'Log time'}</h3>
      <div class="form-grid">
        ${selectField('time', 'project', 'Project', projectOptions(editing ? editing.projectId : ''))}
        ${textField('time', 'date', 'Date', editing ? editing.date : todayISO(), 'date')}
        ${textField('time', 'hours', 'Hours', editing ? editing.hours : '', 'number', 'min="0" step="0.25" required')}
        ${textField('time', 'description', 'Description', editing ? editing.description : '')}
        ${checkField('time', 'billable', 'Billable', editing ? editing.billable : true)}
        <div class="form-actions"><button class="btn btn-primary" type="submit">${editing ? 'Save changes' : '＋ Log time'}</button></div>
      </div>
    </form>
    <div class="grid grid-3" style="margin-bottom:16px">
      ${metricCard('Tracked', `${round(hours)}h`, 'all entries')}
      ${metricCard('Billable', `${round(billable)}h`, `${hours ? Math.round(billable / hours * 100) : 0}% of tracked`, 'hl')}
      ${metricCard('Billable value', fmt(value), 'at current rates', 'lime')}
    </div>
    <div class="table-wrap"><table><thead><tr><th>Date</th><th>Project</th><th>Description</th><th class="num">Hours</th><th>Billable</th><th></th></tr></thead><tbody>${data.timeEntries.map((t) => `<tr>
      <td>${esc(prettyDate(t.date))}</td><td>${esc(projectName(t.projectId))}</td><td>${esc(t.description || '—')}</td>
      <td class="num">${esc(round(t.hours))}</td><td>${statusPill(t.billable ? 'active' : 'draft')}</td>
      <td class="actions"><div class="row-actions"><button type="button" data-action="edit-time" data-id="${attr(t.id)}">Edit</button><button type="button" data-action="delete-time" data-id="${attr(t.id)}">✕</button></div></td></tr>`).join('') || `<tr><td colspan="6">${emptyState('No time logged', 'Track hours against a project to see billable value.')}</td></tr>`}</tbody></table></div>`;
}

function payoutsView() {
  const editing = state.editing && state.editing.kind === 'payout' ? data.payouts.find((p) => p.id === state.editing.id) : null;
  const pending = data.payouts.filter((p) => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);
  return `${sectionHead('Payouts', 'Money moving out to yourself or a destination.', '')}
    <form class="inline-form" data-form="payout">
      ${editBanner('payout')}
      <input type="hidden" name="id" value="${attr(editing ? editing.id : '')}"><h3>${editing ? 'Edit payout' : 'Schedule a payout'}</h3>
      <div class="form-grid">
        ${textField('po', 'date', 'Date', editing ? editing.date : todayISO(), 'date')}
        ${textField('po', 'amount', 'Amount', editing ? editing.amount : '', 'number', 'min="0" step="0.01" required')}
        ${textField('po', 'destination', 'Destination', editing ? editing.destination : '', 'text', 'placeholder="e.g. Business checking"')}
        ${selectField('po', 'status', 'Status', ['pending', 'paid'].map((s) => `<option value="${s}"${editing && editing.status === s || !editing && s === 'pending' ? ' selected' : ''}>${s}</option>`).join(''))}
        <div class="form-actions"><button class="btn btn-primary" type="submit">${editing ? 'Save changes' : '＋ Schedule payout'}</button></div>
      </div>
    </form>
    <div class="grid grid-3" style="margin-bottom:16px">
      ${metricCard('Pending payouts', fmt(pending), `${data.payouts.filter((p) => p.status === 'pending').length} scheduled`, 'lime')}
      ${metricCard('Paid out', fmt(data.payouts.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0)), 'all time')}
      ${metricCard('Next date', ai.upcoming(data).filter((u) => u.kind === 'payout')[0] ? prettyDate(ai.upcoming(data).filter((u) => u.kind === 'payout')[0].date) : '—', 'scheduled')}
    </div>
    <div class="table-wrap"><table><thead><tr><th>Date</th><th>Destination</th><th class="num">Amount</th><th>Status</th><th></th></tr></thead><tbody>${data.payouts.map((p) => `<tr>
      <td>${esc(prettyDate(p.date))}</td><td>${esc(p.destination || '—')}</td><td class="num">${esc(money(p.amount, p.currency))}</td><td>${statusPill(p.status)}</td>
      <td class="actions"><div class="row-actions">${p.status !== 'paid' ? `<button type="button" data-action="payout-paid" data-id="${attr(p.id)}">Mark paid</button>` : ''}<button type="button" data-action="edit-payout" data-id="${attr(p.id)}">Edit</button><button type="button" data-action="delete-payout" data-id="${attr(p.id)}">✕</button></div></td></tr>`).join('') || `<tr><td colspan="5">${emptyState('No payouts', 'Schedule a payout to see it in upcoming dates.')}</td></tr>`}</tbody></table></div>`;
}

function goalsView() {
  const editing = state.editing && state.editing.kind === 'goal' ? data.goals.find((g) => g.id === state.editing.id) : null;
  return `${sectionHead('Goals', 'Targets with visible progress.', '')}
    <form class="inline-form" data-form="goal">
      ${editBanner('goal')}
      <input type="hidden" name="id" value="${attr(editing ? editing.id : '')}"><h3>${editing ? 'Edit goal' : 'Add a goal'}</h3>
      <div class="form-grid">
        ${textField('goal', 'name', 'Name', editing ? editing.name : '', 'text', 'required')}
        ${textField('goal', 'target', 'Target', editing ? editing.target : '', 'number', 'min="0" step="0.01" required')}
        ${textField('goal', 'current', 'Current', editing ? editing.current : 0, 'number', 'min="0" step="0.01"')}
        ${textField('goal', 'deadline', 'Deadline', editing ? editing.deadline : '', 'date')}
        <div class="form-actions"><button class="btn btn-primary" type="submit">${editing ? 'Save changes' : '＋ Add goal'}</button></div>
      </div>
    </form>
    <div class="grid grid-3">${data.goals.map((g) => `<article class="card">
      <div class="card-head"><h3>${esc(g.name)}</h3><span class="hint">${esc(percent(g.current, g.target))}%</span></div>
      ${charts.progressBar(g.current, g.target)}
      <p class="card-note">${esc(fmt(g.current))} of ${esc(fmt(g.target))}${g.deadline ? ` · due ${esc(prettyDate(g.deadline))}` : ''}</p>
      <div class="row-actions" style="margin-top:12px"><button type="button" data-action="edit-goal" data-id="${attr(g.id)}">Edit</button><button type="button" data-action="delete-goal" data-id="${attr(g.id)}">✕</button></div>
    </article>`).join('') || `<div class="grid-3">${emptyState('No goals yet', 'Add a target to track progress.')}</div>`}</div>`;
}

function insightsView() {
  const result = ai.analyze(data);
  const m = result.metrics;
  const mode = ai.mode(data.settings);
  const answer = state.aiResult;
  return `${sectionHead('Insights & Atlas AI', 'Deterministic metrics, then an AI layer that never invents transactions.', `<button class="btn btn-small" type="button" data-action="refresh-insights">↻ Recalculate</button>`)}
    <div class="ai-banner"><div><h2>✦ Atlas AI</h2><p>Local by default: analyzes your payment history, top clients, burn rate and overdue risk without a network request.</p></div><span class="mode-chip${mode === 'external' ? ' external' : ''}">${esc(ai.modeLabel(data.settings).toUpperCase())}</span></div>
    <div class="grid grid-4">
      ${metricCard('Received', fmt(m.received), `${m.paymentCount} payments`, 'hl')}
      ${metricCard('Overdue risk', fmt(m.overdueAmount), `${m.overdueCount} invoices`, 'lime')}
      ${metricCard('Monthly burn', fmt(m.burnRate), 'active-month average')}
      ${metricCard('Annual subscriptions', fmt(m.annualSubscriptions), `${data.subscriptions.filter((s) => s.status === 'active').length} active`)}
    </div>
    <div class="grid grid-2" style="margin-top:16px">
      <article class="card"><div class="card-head"><h3>What the numbers say</h3></div><ul class="insight-list">${result.findings.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></article>
      <article class="card"><div class="card-head"><h3>Suggested next actions</h3></div><ul class="insight-list">${result.actions.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></article>
    </div>
    <div class="grid grid-2" style="margin-top:16px">
      <article class="card"><div class="card-head"><h3>Six-month cashflow</h3></div>${charts.lineChart(result.cashflow)}</article>
      <article class="card"><div class="card-head"><h3>Atlas AI ask</h3><span class="hint">prompt stays local unless configured</span></div>
        <form data-form="ai-ask"><div class="field"><label for="ai-question">Question</label><textarea id="ai-question" name="question" rows="3" placeholder="e.g. who are my top clients?">${esc(answer ? answer.question : '')}</textarea></div>
        <div style="margin-top:10px"><button class="btn btn-primary" type="submit">Ask Atlas AI →</button></div></form>
        ${answer ? `<div style="margin-top:16px"><span class="kind-tag">${esc(answer.mode)}</span><div class="answer" style="margin-top:10px">${esc(answer.answer)}</div></div>` : '<p class="card-note">Try a question, or run <code>atlas ai insight</code> in the terminal.</p>'}
      </article>
    </div>
    <article class="card" style="margin-top:16px"><div class="card-head"><h3>Cached insight history</h3><span class="hint">${data.ai.length} entries</span></div>
      ${data.ai.length ? `<div class="list">${data.ai.slice(0, 8).map((item) => `<div class="list-row"><div class="main"><strong>${esc(item.prompt)}</strong><small>${esc(String(item.at).slice(0, 16).replace('T', ' '))}</small></div><button type="button" class="btn btn-small btn-ghost" data-action="ai-replay" data-id="${attr(item.id)}">Replay</button></div>`).join('')}</div>` : emptyState('No AI history yet', 'Ask a question to cache an answer locally.')}
    </article>`;
}

function downloadsView() {
  return `${sectionHead('Downloads', 'Six builds. Same local data model. No account required.', '')}
    <div id="download-host" class="card"><p class="hint">Detecting your platform…</p></div>
    <article class="card" style="margin-top:16px"><div class="card-head"><h3>CLI from source</h3></div>
      <p class="card-note">Node 20+ and zero runtime dependencies. Clone the public repo, then run <code>node cli/bin/atlas.js init</code>.</p>
      <p class="card-note">GUI binaries are unsigned in CI. On macOS use right-click → Open; Windows SmartScreen may warn on first run.</p>
    </article>`;
}

function settingsView() {
  const s = data.settings;
  const sync = state.sync;
  return `${sectionHead('Settings', 'Local-first configuration. Optional sync and optional external AI.', '')}
    <div class="grid grid-2">
      <form class="card" data-form="settings">
        <div class="card-head"><h3>Preferences</h3></div>
        <div class="form-grid">
          ${textField('set', 'name', 'Your name', s.name)}
          ${selectField('set', 'theme', 'Theme', `<option value="ink"${s.theme === 'ink' ? ' selected' : ''}>Ink</option><option value="paper"${s.theme === 'paper' ? ' selected' : ''}>Paper</option>`)}
          ${selectField('set', 'currency', 'Currency', currencyOptions(s.currency))}
          ${textField('set', 'profileName', 'Profile name', data.profile.name)}
          ${textField('set', 'profileRole', 'Role', data.profile.role)}
          ${textField('set', 'profileCompany', 'Company', data.profile.company)}
        </div>
        <div style="margin-top:16px"><button class="btn btn-primary" type="submit">Save preferences</button></div>
      </form>
      <form class="card" data-form="integrations">
        <div class="card-head"><h3>Sync & Atlas AI</h3><span class="hint">optional</span></div>
        <div class="form-grid">
          ${textField('int', 'syncEndpoint', 'Sync endpoint', s.syncEndpoint, 'url', 'placeholder="https://…/api/developer"')}
          ${textField('int', 'cloudToken', 'Sync token', s.cloudToken, 'password', 'autocomplete="off"')}
          ${textField('int', 'aiEndpoint', 'AI endpoint', data.settings.aiEndpoint || RUNTIME.aiEndpoint || '', 'url', 'placeholder="https://…/v1/chat"')}
          ${textField('int', 'aiKey', 'AI key', data.settings.aiKey || '', 'password', 'autocomplete="off"')}
        </div>
        <p class="hint" style="margin-top:10px">No keys are committed. Values live in this browser only. <code>atlas-sync</code> app slug: <code>developer</code>.</p>
        <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-small" type="submit">Save</button><button class="btn btn-small" type="button" data-action="sync-connect">Connect stream</button><button class="btn btn-small btn-ghost" type="button" data-action="sync-disconnect">Disconnect</button></div>
        <p class="hint">Status: ${esc(sync.error || (sync.mode === 'cloud' ? 'Cloud stream connected.' : 'Local only — no network requests.'))}${sync.lastSync ? ` Last update ${esc(String(sync.lastSync).slice(0, 19).replace('T', ' '))}.` : ''}</p>
      </form>
    </div>
    <article class="card" style="margin-top:16px"><div class="card-head"><h3>Data management</h3><span class="hint">stored in this browser · CLI uses ~/.atlas-developers</span></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-small" type="button" data-action="export-json">↓ Export JSON</button>
        <label class="btn btn-small" for="import-file">↑ Import JSON</label>
        <input id="import-file" type="file" accept="application/json,.json" data-change="import-file" hidden>
        <button class="btn btn-small btn-danger" type="button" data-action="clear-data">Clear all data</button>
      </div>
      <p class="card-note">Import replaces current data after normalization. Export includes settings, records, AI history and activity.</p>
    </article>
    <article class="card" style="margin-top:16px"><div class="card-head"><h3>About</h3></div>
      <p class="card-note">${esc(APP.name)} — ${esc(APP.tagline)} ${esc(APP.productOf)} Static build at ${esc(APP.deployUrl)}.</p>
    </article>`;
}

const VIEWS = {
  overview: overviewView,
  payments: paymentsView,
  invoices: invoicesView,
  clients: clientsView,
  projects: projectsView,
  subscriptions: subscriptionsView,
  time: timeView,
  payouts: payoutsView,
  goals: goalsView,
  insights: insightsView,
  downloads: downloadsView,
  settings: settingsView
};

/* ---------------- Render + routing ---------------- */

function updateChrome(route) {
  const meta = ROUTES.find(([id]) => id === route) || ['overview', 'Overview', '◫'];
  if (titleEl) titleEl.textContent = meta[1];
  if (routesEl) {
    routesEl.innerHTML = ROUTES.map(([id, label, icon]) => (
      `<a href="#/${id}" class="route-link${id === route ? ' active' : ''}"><span class="route-icon">${esc(icon)}</span>${esc(label)}</a>`
    )).join('');
  }
  const modeBadge = qs('#mode-badge');
  if (modeBadge) modeBadge.textContent = state.sync.mode === 'cloud' ? 'SYNC' : ai.mode(data.settings) === 'external' ? 'AI EXT' : 'LOCAL';
  const dot = qs('#sync-status');
  const label = qs('#sync-label');
  if (dot) dot.className = `status-dot${state.sync.error ? ' error' : state.sync.mode === 'cloud' ? ' cloud' : ''}`;
  if (label) label.textContent = state.sync.error ? 'Sync fallback' : state.sync.mode === 'cloud' ? 'Cloud sync' : 'Local only';
  const themeToggle = qs('#theme-toggle');
  if (themeToggle) themeToggle.textContent = data.settings.theme === 'ink' ? '◐' : '◑';
  document.documentElement.dataset.theme = data.settings.theme === 'paper' ? 'paper' : 'ink';
}

function render() {
  const active = document.activeElement;
  const focusId = active && active.id ? active.id : '';
  const caret = active && typeof active.selectionStart === 'number' ? active.selectionStart : null;
  const route = routeFromHash();
  if (route === 'landing') {
    if (landingEl) landingEl.hidden = false;
    if (appEl) appEl.hidden = true;
    document.documentElement.dataset.theme = data.settings.theme === 'paper' ? 'paper' : 'ink';
    return;
  }
  if (landingEl) landingEl.hidden = true;
  if (appEl) appEl.hidden = false;
  updateChrome(route);
  if (viewEl) {
    viewEl.innerHTML = (VIEWS[route] || overviewView)();
    if (route === 'downloads') mountDownloads(qs('#download-host'));
    if (focusId) {
      const restored = document.getElementById(focusId);
      if (restored) {
        restored.focus();
        if (caret !== null && typeof restored.setSelectionRange === 'function') {
          try { restored.setSelectionRange(caret, caret); } catch (_) { /* non-text inputs */ }
        }
      }
    }
  }
}

/* ---------------- Mutations ---------------- */

function recordFrom(form, kind, id) {
  const v = Object.fromEntries(new FormData(form).entries());
  const client = store.findClient(data, v.client);
  const project = store.findProject(data, v.project);
  const shared = { id: id || uid(kind.slice(0, 3)) };
  let input;
  switch (kind) {
    case 'payment':
      input = {
        ...shared, type: v.type, amount: parseMoney(v.amount), date: v.date || todayISO(),
        clientId: client ? client.id : '', projectId: project ? project.id : '',
        description: v.description || '', category: v.category || '', status: v.status || 'paid',
        currency: (client && client.currency) || (project && project.currency) || currentCurrency()
      };
      break;
    case 'invoice':
      input = {
        ...shared, number: v.number || `INV-${Date.now().toString(36).toUpperCase()}`,
        clientId: client ? client.id : '', projectId: project ? project.id : '',
        issueDate: v.issueDate || todayISO(), dueDate: v.dueDate || addDaysISO(todayISO(), 14),
        amount: parseMoney(v.amount), status: v.status || 'draft',
        currency: (client && client.currency) || currentCurrency()
      };
      break;
    case 'client':
      input = {
        ...shared, name: v.name, company: v.company || '', email: v.email || '',
        rate: parseMoney(v.rate), currency: v.currency || currentCurrency(), status: 'active'
      };
      break;
    case 'project':
      input = {
        ...shared, name: v.name, clientId: client ? client.id : '', rate: parseMoney(v.rate),
        status: v.status || 'active', currency: (client && client.currency) || currentCurrency()
      };
      break;
    case 'subscription':
      input = {
        ...shared, name: v.name, vendor: v.vendor || '', amount: parseMoney(v.amount),
        frequency: v.frequency || 'monthly', nextDate: v.nextDate || addDaysISO(todayISO(), 30),
        status: v.status || 'active', currency: currentCurrency()
      };
      break;
    case 'time':
      input = {
        ...shared, projectId: project ? project.id : '', date: v.date || todayISO(),
        hours: num(v.hours), description: v.description || '', billable: Boolean(v.billable)
      };
      break;
    case 'payout':
      input = {
        ...shared, date: v.date || todayISO(), amount: parseMoney(v.amount),
        destination: v.destination || '', status: v.status || 'pending', currency: currentCurrency()
      };
      break;
    case 'goal':
      input = {
        ...shared, name: v.name, target: num(v.target), current: num(v.current),
        deadline: v.deadline || ''
      };
      break;
    default:
      input = shared;
  }
  const collection = {
    payment: 'payments', invoice: 'invoices', client: 'clients', project: 'projects',
    subscription: 'subscriptions', time: 'timeEntries', payout: 'payouts', goal: 'goals'
  }[kind];
  return { collection, record: store.normalizeData({ [collection]: [input] })[collection][0] };
}

function upsert(kind, collection, record) {
  store.update((draft) => {
    const index = draft[collection].findIndex((item) => item.id === record.id);
    if (index >= 0) draft[collection][index] = record;
    else draft[collection].push(record);
    store.activity(draft, `${index >= 0 ? 'Updated' : 'Added'} ${kind}: ${record.name || record.description || record.number || record.amount}`, kind);
    return draft;
  });
}

function removeRecord(kind, collection, id) {
  store.update((draft) => {
    draft[collection] = draft[collection].filter((item) => item.id !== id);
    store.activity(draft, `Removed ${kind} ${id}`, kind);
    return draft;
  });
}

function setStatus(collection, id, status, kind) {
  store.update((draft) => {
    const item = draft[collection].find((entry) => entry.id === id);
    if (item) {
      item.status = status;
      store.activity(draft, `${kind} ${item.number || item.id} marked ${status}`, kind);
    }
    return draft;
  });
}

function handleSubmit(event) {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  const kind = form.dataset.form;
  if (kind === 'ai-ask') {
    const question = String(new FormData(form).get('question') || '').trim();
    if (!question) { toast('Enter a question first.'); return; }
    state.aiResult = { question };
    render();
    ai.ask(data, question, data.settings).then((result) => {
      state.aiResult = result;
      store.update((draft) => {
        draft.ai.unshift(store.normalizeData({ ai: [{ prompt: question, response: result.answer, at: result.at }] }).ai[0]);
        draft.ai = draft.ai.slice(0, 50);
        store.activity(draft, `Atlas AI question: ${question.slice(0, 70)}`, 'ai');
        return draft;
      });
      render();
    }).catch(() => { toast('Atlas AI could not answer. Local metrics remain available.'); });
    return;
  }
  if (kind === 'settings' || kind === 'integrations') {
    const v = Object.fromEntries(new FormData(form).entries());
    store.update((draft) => {
      if (kind === 'settings') {
        draft.settings.name = v.name || '';
        draft.settings.theme = v.theme === 'paper' ? 'paper' : 'ink';
        draft.settings.currency = CURRENCIES.includes(v.currency) ? v.currency : 'USD';
        draft.profile = { name: v.profileName || '', role: v.profileRole || '', company: v.profileCompany || '' };
      } else {
        draft.settings.syncEndpoint = v.syncEndpoint || '';
        draft.settings.cloudToken = v.cloudToken || '';
        draft.settings.aiEndpoint = v.aiEndpoint || '';
        draft.settings.aiKey = v.aiKey || '';
      }
      store.activity(draft, `Updated ${kind === 'settings' ? 'preferences' : 'integrations'}`, 'settings');
      return draft;
    });
    toast('Settings saved locally.');
    state.editing = null;
    render();
    return;
  }
  const inputId = String(new FormData(form).get('id') || '');
  const { collection, record } = recordFrom(form, kind, inputId);
  if (!collection) { toast('Unknown form.'); return; }
  upsert(kind, collection, record);
  state.editing = null;
  toast(`${kind[0].toUpperCase()}${kind.slice(1)} saved.`);
  render();
}

async function handleAction(button) {
  const action = button.dataset.action;
  const id = button.dataset.id || '';
  const [verb, kind] = action.split('-');
  if (action === 'cancel-edit') { state.editing = null; render(); return; }
  if (action.startsWith('edit-')) {
    state.editing = { kind: action.replace('edit-', ''), id };
    render();
    return;
  }
  if (action.startsWith('delete-')) {
    const map = {
      payment: 'payments', invoice: 'invoices', client: 'clients', project: 'projects',
      subscription: 'subscriptions', time: 'timeEntries', payout: 'payouts', goal: 'goals'
    };
    const collection = map[kind];
    if (!collection || !window.confirm('Delete this record? This cannot be undone.')) return;
    removeRecord(kind, collection, id);
    toast('Record deleted.');
    return;
  }
  switch (action) {
    case 'pay-paid': setStatus('payments', id, 'paid', 'payment'); toast('Payment marked paid.'); break;
    case 'invoice-send': setStatus('invoices', id, 'sent', 'invoice'); toast('Invoice marked sent.'); break;
    case 'invoice-paid': setStatus('invoices', id, 'paid', 'invoice'); toast('Invoice marked paid.'); break;
    case 'payout-paid': setStatus('payouts', id, 'paid', 'payout'); toast('Payout marked paid.'); break;
    case 'refresh-insights': state.aiResult = null; render(); toast('Insights recalculated from local data.'); break;
    case 'ai-replay': {
      const entry = data.ai.find((item) => item.id === id);
      if (entry) { state.aiResult = { question: entry.prompt, answer: entry.answer || entry.response, mode: 'cached' }; render(); }
      break;
    }
    case 'export-json': downloadText(`atlas-developers-export-${todayISO()}.json`, store.exportJson()); toast('JSON export downloaded.'); break;
    case 'clear-data':
      if (window.confirm('Clear all local data? Export first if you need a backup.')) { store.reset(); state.editing = null; state.aiResult = null; toast('Local data cleared.'); }
      break;
    case 'sync-connect': {
      const status = api.connect(data.settings.syncEndpoint, data.settings.cloudToken, (next) => { state.sync = next; updateChrome(routeFromHash()); });
      state.sync = status;
      toast(status.mode === 'cloud' ? 'Sync stream connecting…' : 'No endpoint configured; staying local.');
      break;
    }
    case 'sync-disconnect': api.disconnect(); state.sync = api.snapshot(); render(); toast('Disconnected. Local data unchanged.'); break;
    default: break;
  }
}

function handleClick(event) {
  const copy = event.target.closest('[data-copy]');
  if (copy) {
    copyText(copy.dataset.copy || '').then((ok) => toast(ok ? 'Copied to clipboard.' : 'Select the command manually.'));
    return;
  }
  const nav = event.target.closest('[data-nav]');
  if (nav) { location.hash = `#/${nav.dataset.nav}`; return; }
  const button = event.target.closest('button[data-action]');
  if (button) { handleAction(button).catch(() => toast('Action failed; local data unchanged.')); return; }
  if (event.target.id === 'theme-toggle') {
    store.update((draft) => { draft.settings.theme = draft.settings.theme === 'ink' ? 'paper' : 'ink'; return draft; });
  }
}

function handleChange(event) {
  const target = event.target;
  if (target.dataset.change === 'import-file' && target.files && target.files[0]) {
    const file = target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      try {
        store.importJson(String(reader.result));
        state.editing = null;
        state.aiResult = null;
        toast(`Imported ${file.name}.`);
        render();
      } catch (_) {
        toast('That file is not valid Atlas JSON.');
      }
    };
    reader.readAsText(file);
    target.value = '';
  }
  const filterIds = {
    'filter-payment-type': 'payments.type',
    'filter-payment-status': 'payments.status',
    'filter-payment-client': 'payments.client',
    'filter-invoice-status': 'invoices.status',
    'filter-sub-status': 'subscriptions.status'
  };
  const filterPath = target.dataset.filter || filterIds[target.id];
  if (!filterPath) return;
  const [group, key] = filterPath.split('.');
  if (state.filters[group]) state.filters[group][key] = target.value;
  if (filterIds[target.id]) render();
}

const debouncedRender = (() => {
  let timer = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(render, 160);
  };
})();

function handleInput(event) {
  if (!event.target.dataset || !event.target.dataset.filter) return;
  const [group, key] = event.target.dataset.filter.split('.');
  if (state.filters[group]) state.filters[group][key] = event.target.value;
  debouncedRender();
}

/* ---------------- Bootstrap ---------------- */

store.subscribe((next) => { data = next; render(); });
document.addEventListener('click', handleClick);
document.addEventListener('submit', handleSubmit);
document.addEventListener('change', handleChange);
document.addEventListener('input', handleInput);
window.addEventListener('hashchange', render);

if (window.atlasDesktop && typeof window.atlasDesktop.readDataSync === 'function' && !window.atlasDesktop.readDataSync()) {
  store.save(store.get());
}

if (window.atlasDesktop && typeof window.atlasDesktop.onDeepLink === 'function') {
  window.atlasDesktop.onDeepLink((url) => {
    const match = String(url).match(/atlasdev:\/\/([a-z]+)/i);
    const target = match ? String(match[1]).toLowerCase() : 'overview';
    location.hash = `#/${VIEWS[target] ? target : 'overview'}`;
  });
}

render();

/* Calendar widget uses the configured sync endpoint. The web app has no dedicated
   Atlas Calendar token helper yet, so it stays in the sign-in state for now. */
const getEndpoint = () => String(store.get().settings.syncEndpoint || RUNTIME.syncEndpoint || '').trim();
const getToken = () => String(store.get().settings.cloudToken || '').trim();
initCalendarWidget({ app: 'developer', getEndpoint, getToken });
