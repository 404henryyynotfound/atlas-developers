'use strict';

const fs = require('fs');
const path = require('path');

// In the repo, core/ sits next to cli/. In the npm package, core is installed
// as the atlas-developers-core dependency. Prefer the package, then fall back
// to the source checkout so `node cli/test.js` keeps working without npm install.
function loadCore(name, fallback) {
  try {
    return require(`atlas-developers-core/src/${name}`);
  } catch (error) {
    const missingPackage = error && error.code === 'MODULE_NOT_FOUND'
      && String(error.message).includes("Cannot find module 'atlas-developers-core");
    if (missingPackage) return require(fallback);
    throw error;
  }
}

const store = loadCore('store', '../../core/src/store');
const model = loadCore('model', '../../core/src/model');
const insights = loadCore('insights', '../../core/src/insights');
const ai = loadCore('ai', '../../core/src/ai');
const { VERSION } = loadCore('version', '../../core/src/version');
const { makeOutput } = require('./output');

function parseArgs(args = []) {
  const flags = {};
  const positional = [];
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === '--') {
      positional.push(...args.slice(index + 1));
      break;
    }
    if (/^--[A-Za-z]/.test(token)) {
      const equals = token.indexOf('=');
      const key = equals > -1 ? token.slice(2, equals) : token.slice(2);
      if (equals > -1) {
        flags[key] = token.slice(equals + 1);
      } else if (index + 1 < args.length && !/^--/.test(args[index + 1])) {
        flags[key] = args[index + 1];
        index += 1;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(token);
    }
  }
  return { flags, positional };
}

function flag(flags, ...names) {
  for (const name of names) {
    if (flags[name] !== undefined) return flags[name];
  }
  return undefined;
}

function need(value, label) {
  if (value === undefined || value === null || value === '' || value === true) {
    throw new Error(`Missing required value: ${label}`);
  }
  return value;
}

function load() {
  store.init();
  return store.readData();
}

function findById(list, ref, label) {
  const key = model.str(ref).toLowerCase();
  const match = list.find((item) => item.id.toLowerCase() === key || item.id.toLowerCase().startsWith(key));
  if (!match) throw new Error(`${label} not found: ${ref}. Run the matching list command to see IDs.`);
  return match;
}

function resolveClient(data, ref) {
  if (!ref) return null;
  const key = model.str(ref).toLowerCase();
  const match = data.clients.find((client) => (
    client.id.toLowerCase() === key ||
    client.name.toLowerCase() === key ||
    client.company.toLowerCase() === key
  ));
  if (!match) throw new Error(`Client not found: ${ref}. Run "atlas clients list" first.`);
  return match;
}

function resolveProject(data, ref) {
  if (!ref) return null;
  const key = model.str(ref).toLowerCase();
  const match = data.projects.find((project) => (
    project.id.toLowerCase() === key || project.name.toLowerCase() === key
  ));
  if (!match) throw new Error(`Project not found: ${ref}. Run "atlas projects list" first.`);
  return match;
}

function currencyFor(data, ref) {
  return ref && ref.currency ? ref.currency : data.settings.currency;
}

function money(value, currency) {
  return model.formatMoney(value, currency);
}

function shortDate(value) {
  return model.str(value).slice(0, 10) || '—';
}

function printHelp(out) {
  out.write('');
  out.write(out.paint('ATLAS DEVELOPERS CLI', `${out.ANSI.bold}${out.ANSI.cyan}`));
  out.muted('Tools for the work behind the money.');
  out.write('');
  out.write('Usage: atlas <command> [subcommand] [options]');
  out.write('');
  out.heading('Commands');
  const rows = [
    ['init', 'Create local config and data files'],
    ['status', 'Show data summary and cloud/local mode'],
    ['payments list|add|paid', 'Track income and expenses'],
    ['invoices list|add|send|paid', 'Manage invoices'],
    ['clients list|add', 'Manage clients'],
    ['projects list|add', 'Manage projects'],
    ['subscriptions list|add', 'Manage recurring costs'],
    ['payouts list|add|paid', 'Manage payouts'],
    ['time list|add', 'Track billable hours'],
    ['goals list|add', 'Track goals'],
    ['report', 'Cashflow summary'],
    ['export [--json] | import <file>', 'Move data in and out'],
    ['ai insight | ai ask "<question>"', 'Atlas AI (local by default)'],
    ['config get|set <key> [value]', 'Read or write local config']
  ];
  rows.forEach(([name, description]) => out.write(`  ${out.paint(name.padEnd(33), out.ANSI.lime)}  ${description}`));
  out.write('');
  out.muted('Global: --version, --help');
  out.muted('Data:   ~/.atlas-developers (override with ATLAS_HOME)');
  out.write('');
}

function cmdInit(out, flags) {
  const result = store.init();
  const data = result.data;
  if (flag(flags, 'currency')) data.settings.currency = model.str(flags.currency).toUpperCase();
  if (flag(flags, 'theme')) data.settings.theme = model.str(flags.theme) === 'paper' ? 'paper' : 'ink';
  if (flag(flags, 'name')) data.settings.name = model.str(flags.name);
  store.writeData(data);
  out.heading('Atlas initialized');
  out.keyValue({
    'Atlas home': result.home,
    'Data file': store.dataPath(),
    'Config file': store.configPath(),
    'Data created': result.createdData ? 'yes' : 'already present',
    'Config created': result.createdConfig ? 'yes' : 'already present',
    'AI mode': ai.modeLabel(store.readConfig())
  });
  out.write('');
  out.success('Run "atlas ai insight" for your first local analysis.');
  return 0;
}

function cmdStatus(out) {
  const data = load();
  const config = store.readConfig();
  const m = insights.metrics(data);
  out.heading('Atlas status');
  out.keyValue({
    Version: VERSION,
    Mode: store.mode(config) === 'cloud' ? 'cloud sync configured' : 'local only',
    'Data file': store.dataPath(),
    Currency: m.currency,
    Theme: data.settings.theme,
    Clients: `${m.activeClients} active / ${data.clients.length} total`,
    Projects: `${m.activeProjects} active / ${data.projects.length} total`,
    Payments: data.payments.length,
    Invoices: data.invoices.length,
    Subscriptions: data.subscriptions.length,
    'AI mode': ai.modeLabel(config),
    'Last activity': data.activity[0] ? data.activity[0].at : '—'
  });
  return 0;
}

function cmdPayments(out, args) {
  const [action, ...rest] = args;
  const { flags, positional } = parseArgs(rest);
  const data = load();

  if (!action || action === 'list') {
    const typeFilter = flag(flags, 'type');
    const statusFilter = flag(flags, 'status');
    const clientFilter = flag(flags, 'client', 'client-id');
    const search = model.str(flag(flags, 'search', 'q')).toLowerCase();
    let rows = data.payments.slice();
    if (typeFilter) rows = rows.filter((p) => p.type === String(typeFilter).toLowerCase());
    if (statusFilter) rows = rows.filter((p) => p.status === String(statusFilter).toLowerCase());
    if (clientFilter) {
      const client = resolveClient(data, clientFilter);
      rows = rows.filter((p) => p.clientId === (client && client.id));
    }
    if (search) rows = rows.filter((p) => `${p.description} ${p.category} ${p.method}`.toLowerCase().includes(search));
    rows.sort((a, b) => (a.date < b.date ? 1 : -1));
    const currency = data.settings.currency;
    out.heading('Payments');
    out.table([
      { key: 'date', label: 'DATE' },
      { key: 'type', label: 'TYPE' },
      { key: 'description', label: 'DESCRIPTION' },
      { key: 'client', label: 'CLIENT' },
      { key: 'status', label: 'STATUS' },
      { key: 'amount', label: 'AMOUNT', accent: out.ANSI.lime }
    ], rows.map((p) => ({
      date: shortDate(p.date),
      type: p.type,
      description: p.description || '—',
      client: p.clientId ? insights.clientName(data, p.clientId) : '—',
      status: p.status,
      amount: `${p.type === 'expense' ? '-' : ''}${money(p.amount, p.currency || currency)}`
    })), { empty: 'No payments yet. Try: atlas payments add --type income --amount 100 --description "Client work"' });
    const income = model.roundMoney(rows.filter((p) => p.type === 'income').reduce((sum, p) => sum + p.amount, 0));
    const expense = model.roundMoney(rows.filter((p) => p.type === 'expense').reduce((sum, p) => sum + p.amount, 0));
    out.write('');
    out.write(`Income ${money(income, currency)}  ·  Expenses ${money(expense, currency)}  ·  Net ${money(income - expense, currency)}`);
    return 0;
  }

  if (action === 'add') {
    const type = model.str(flag(flags, 'type') || positional[0] || 'income').toLowerCase() === 'expense' ? 'expense' : 'income';
    const amountArg = need(flag(flags, 'amount') || positional[1], '--amount');
    const amount = model.parseMoney(amountArg);
    if (amount <= 0) throw new Error('Amount must be greater than zero.');
    const descriptionParts = positional.slice(type === flag(flags, 'type') ? 0 : 2);
    const description = model.str(flag(flags, 'description', 'desc') || descriptionParts.join(' '));
    const client = resolveClient(data, flag(flags, 'client', 'client-id'));
    const project = resolveProject(data, flag(flags, 'project', 'project-id'));
    const status = model.str(flag(flags, 'status') || (type === 'income' ? 'paid' : 'paid'));
    const record = model.normalizePayment({
      type, amount, description,
      clientId: client ? client.id : '',
      projectId: project ? project.id : '',
      date: flag(flags, 'date') || model.todayISO(),
      currency: currencyFor(data, client || project),
      status,
      method: flag(flags, 'method') || '',
      category: flag(flags, 'category') || '',
      notes: flag(flags, 'notes') || ''
    });
    store.update((current) => {
      current.payments.push(record);
      return model.addActivity(current, `Added ${type} payment ${money(amount, record.currency)}`, 'payment');
    });
    out.success(`Added ${type} payment ${record.id} — ${money(amount, record.currency)}`);
    return 0;
  }

  if (action === 'paid') {
    const id = need(positional[0], 'payment id');
    const payment = findById(data.payments, id, 'Payment');
    store.update((current) => {
      const item = current.payments.find((p) => p.id === payment.id);
      item.status = 'paid';
      return model.addActivity(current, `Marked payment ${item.id} as paid`, 'payment');
    });
    out.success(`Payment ${payment.id} marked paid.`);
    return 0;
  }

  throw new Error(`Unknown payments action: ${action}. Use list, add, or paid.`);
}

function cmdInvoices(out, args) {
  const [action, ...rest] = args;
  const { flags, positional } = parseArgs(rest);
  const data = load();

  if (!action || action === 'list') {
    const statusFilter = flag(flags, 'status');
    const today = model.todayISO();
    let rows = data.invoices.slice();
    if (statusFilter) rows = rows.filter((i) => i.status === String(statusFilter).toLowerCase());
    rows.sort((a, b) => (a.dueDate < b.dueDate ? 1 : -1));
    out.heading('Invoices');
    out.table([
      { key: 'number', label: 'NUMBER' },
      { key: 'client', label: 'CLIENT' },
      { key: 'due', label: 'DUE' },
      { key: 'status', label: 'STATUS', accent: out.ANSI.yellow },
      { key: 'amount', label: 'AMOUNT', accent: out.ANSI.lime }
    ], rows.map((invoice) => {
      const overdue = invoice.status !== 'paid' && invoice.dueDate < today;
      return {
        number: invoice.number,
        client: invoice.clientId ? insights.clientName(data, invoice.clientId) : '—',
        due: overdue ? `${invoice.dueDate} !` : invoice.dueDate,
        status: overdue ? 'overdue' : invoice.status,
        amount: money(invoice.amount, invoice.currency)
      };
    }), { empty: 'No invoices yet. Try: atlas invoices add --client <id> --amount 500' });
    const outstanding = insights.metrics(data).outstanding;
    out.write('');
    out.write(`Outstanding: ${money(outstanding, data.settings.currency)}`);
    return 0;
  }

  if (action === 'add') {
    const client = resolveClient(data, need(flag(flags, 'client', 'client-id'), '--client'));
    const project = resolveProject(data, flag(flags, 'project', 'project-id'));
    const amount = model.parseMoney(need(flag(flags, 'amount') || positional[0], '--amount'));
    if (amount <= 0) throw new Error('Amount must be greater than zero.');
    const issueDate = flag(flags, 'issue-date') || model.todayISO();
    const dueDate = flag(flags, 'due-date') || model.addDaysISO(issueDate, model.num(flag(flags, 'days'), 14));
    const record = model.normalizeInvoice({
      clientId: client.id,
      projectId: project ? project.id : '',
      amount,
      issueDate,
      dueDate,
      number: flag(flags, 'number') || `INV-${Date.now().toString(36).toUpperCase()}`,
      status: flag(flags, 'status') || 'draft',
      currency: currencyFor(data, client || project),
      notes: flag(flags, 'notes') || ''
    });
    store.update((current) => {
      current.invoices.push(record);
      return model.addActivity(current, `Created invoice ${record.number} for ${client.name}`, 'invoice');
    });
    out.success(`Created invoice ${record.number} (${record.id}) due ${record.dueDate}.`);
    return 0;
  }

  if (action === 'send' || action === 'paid') {
    const ref = model.str(need(positional[0], 'invoice id or number')).toLowerCase();
    const invoice = data.invoices.find((item) => (
      item.id.toLowerCase().startsWith(ref) ||
      item.number.toLowerCase() === ref ||
      item.number.toLowerCase().startsWith(ref)
    )) || findById(data.invoices, ref, 'Invoice');
    const nextStatus = action === 'send' ? 'sent' : 'paid';
    store.update((current) => {
      const item = current.invoices.find((i) => i.id === invoice.id);
      item.status = nextStatus;
      return model.addActivity(current, `Invoice ${item.number} marked ${nextStatus}`, 'invoice');
    });
    out.success(`Invoice ${invoice.number} marked ${nextStatus}.`);
    return 0;
  }

  throw new Error(`Unknown invoices action: ${action}. Use list, add, send, or paid.`);
}

function cmdClients(out, args) {
  const [action, ...rest] = args;
  const { flags, positional } = parseArgs(rest);
  const data = load();

  if (!action || action === 'list') {
    out.heading('Clients');
    out.table([
      { key: 'name', label: 'NAME', accent: out.ANSI.lime },
      { key: 'company', label: 'COMPANY' },
      { key: 'email', label: 'EMAIL' },
      { key: 'rate', label: 'RATE' },
      { key: 'status', label: 'STATUS' },
      { key: 'id', label: 'ID' }
    ], data.clients.map((client) => ({
      name: client.name, company: client.company, email: client.email,
      rate: money(client.rate, client.currency), status: client.status, id: client.id
    })), { empty: 'No clients yet. Try: atlas clients add "Acme Studio" --email billing@acme.test' });
    return 0;
  }

  if (action === 'add') {
    const name = need(flag(flags, 'name') || positional[0], 'client name');
    const record = model.normalizeClient({
      name,
      email: flag(flags, 'email') || '',
      company: flag(flags, 'company') || '',
      rate: model.parseMoney(flag(flags, 'rate') || 0),
      currency: flag(flags, 'currency') || data.settings.currency,
      status: flag(flags, 'status') || 'active'
    });
    store.update((current) => {
      current.clients.push(record);
      return model.addActivity(current, `Added client ${record.name}`, 'client');
    });
    out.success(`Added client ${record.name} (${record.id}).`);
    return 0;
  }

  throw new Error(`Unknown clients action: ${action}. Use list or add.`);
}

function cmdProjects(out, args) {
  const [action, ...rest] = args;
  const { flags, positional } = parseArgs(rest);
  const data = load();

  if (!action || action === 'list') {
    out.heading('Projects');
    out.table([
      { key: 'name', label: 'NAME', accent: out.ANSI.lime },
      { key: 'client', label: 'CLIENT' },
      { key: 'status', label: 'STATUS' },
      { key: 'rate', label: 'RATE' },
      { key: 'id', label: 'ID' }
    ], data.projects.map((project) => ({
      name: project.name,
      client: project.clientId ? insights.clientName(data, project.clientId) : '—',
      status: project.status,
      rate: project.rate ? money(project.rate, project.currency) : '—',
      id: project.id
    })), { empty: 'No projects yet. Try: atlas projects add "Website refresh" --client <id>' });
    return 0;
  }

  if (action === 'add') {
    const name = need(flag(flags, 'name') || positional[0], 'project name');
    const client = resolveClient(data, flag(flags, 'client', 'client-id'));
    const record = model.normalizeProject({
      name,
      clientId: client ? client.id : '',
      status: flag(flags, 'status') || 'active',
      rate: model.parseMoney(flag(flags, 'rate') || (client && client.rate) || 0),
      currency: currencyFor(data, client)
    });
    store.update((current) => {
      current.projects.push(record);
      return model.addActivity(current, `Added project ${record.name}`, 'project');
    });
    out.success(`Added project ${record.name} (${record.id}).`);
    return 0;
  }

  throw new Error(`Unknown projects action: ${action}. Use list or add.`);
}

function cmdSubscriptions(out, args) {
  const [action, ...rest] = args;
  const { flags, positional } = parseArgs(rest);
  const data = load();

  if (!action || action === 'list') {
    out.heading('Subscriptions');
    out.table([
      { key: 'name', label: 'NAME', accent: out.ANSI.lime },
      { key: 'vendor', label: 'VENDOR' },
      { key: 'amount', label: 'AMOUNT' },
      { key: 'frequency', label: 'FREQUENCY' },
      { key: 'nextDate', label: 'NEXT' },
      { key: 'status', label: 'STATUS' }
    ], data.subscriptions.map((s) => ({
      name: s.name, vendor: s.vendor, amount: money(s.amount, s.currency),
      frequency: s.frequency, nextDate: s.nextDate, status: s.status
    })), { empty: 'No subscriptions yet. Try: atlas subscriptions add "Design suite" --amount 24' });
    out.write('');
    out.write(`Annualized cost: ${money(insights.annualizedSubscriptions(data), data.settings.currency)}`);
    return 0;
  }

  if (action === 'add') {
    const name = need(flag(flags, 'name') || positional[0], 'subscription name');
    const amount = model.parseMoney(need(flag(flags, 'amount') || positional[1], '--amount'));
    if (amount <= 0) throw new Error('Amount must be greater than zero.');
    const record = model.normalizeSubscription({
      name,
      amount,
      vendor: flag(flags, 'vendor') || '',
      frequency: flag(flags, 'frequency') || 'monthly',
      nextDate: flag(flags, 'next-date') || model.addDaysISO(model.todayISO(), 30),
      category: flag(flags, 'category') || '',
      status: 'active',
      currency: flag(flags, 'currency') || data.settings.currency
    });
    store.update((current) => {
      current.subscriptions.push(record);
      return model.addActivity(current, `Added subscription ${record.name}`, 'subscription');
    });
    out.success(`Added subscription ${record.name} (${record.id}).`);
    return 0;
  }

  throw new Error(`Unknown subscriptions action: ${action}. Use list or add.`);
}

function cmdPayouts(out, args) {
  const [action, ...rest] = args;
  const { flags, positional } = parseArgs(rest);
  const data = load();

  if (!action || action === 'list') {
    out.heading('Payouts');
    out.table([
      { key: 'date', label: 'DATE' },
      { key: 'destination', label: 'DESTINATION' },
      { key: 'amount', label: 'AMOUNT' },
      { key: 'status', label: 'STATUS' },
      { key: 'id', label: 'ID' }
    ], data.payouts.map((p) => ({
      date: p.date, destination: p.destination, amount: money(p.amount, p.currency), status: p.status, id: p.id
    })), { empty: 'No payouts recorded yet.' });
    return 0;
  }

  if (action === 'add') {
    const amount = model.parseMoney(need(flag(flags, 'amount') || positional[0], '--amount'));
    if (amount <= 0) throw new Error('Amount must be greater than zero.');
    const record = model.normalizePayout({
      amount,
      date: flag(flags, 'date') || model.todayISO(),
      destination: flag(flags, 'destination', 'to') || positional[1] || '',
      status: 'pending',
      currency: flag(flags, 'currency') || data.settings.currency,
      notes: flag(flags, 'notes') || ''
    });
    store.update((current) => {
      current.payouts.push(record);
      return model.addActivity(current, `Scheduled payout ${money(amount, record.currency)}`, 'payout');
    });
    out.success(`Scheduled payout ${record.id}.`);
    return 0;
  }

  if (action === 'paid') {
    const payout = findById(data.payouts, need(positional[0], 'payout id'), 'Payout');
    store.update((current) => {
      current.payouts.find((p) => p.id === payout.id).status = 'paid';
      return model.addActivity(current, `Payout ${payout.id} marked paid`, 'payout');
    });
    out.success(`Payout ${payout.id} marked paid.`);
    return 0;
  }

  throw new Error(`Unknown payouts action: ${action}. Use list, add, or paid.`);
}

function cmdTime(out, args) {
  const [action, ...rest] = args;
  const { flags, positional } = parseArgs(rest);
  const data = load();

  if (!action || action === 'list') {
    out.heading('Time entries');
    out.table([
      { key: 'date', label: 'DATE' },
      { key: 'project', label: 'PROJECT' },
      { key: 'description', label: 'DESCRIPTION' },
      { key: 'hours', label: 'HOURS' },
      { key: 'billable', label: 'BILLABLE' }
    ], data.timeEntries.map((entry) => ({
      date: entry.date,
      project: entry.projectId ? insights.projectName(data, entry.projectId) : '—',
      description: entry.description,
      hours: String(entry.hours),
      billable: entry.billable ? 'yes' : 'no'
    })), { empty: 'No time entries yet. Try: atlas time add <project-id> 2.5 "Discovery call"' });
    const m = insights.metrics(data);
    out.write('');
    out.write(`${m.trackedHours} hours tracked · ${m.billableHours} billable · ${money(m.billableValue, m.currency)} value`);
    return 0;
  }

  if (action === 'add') {
    const project = resolveProject(data, flag(flags, 'project', 'project-id') || positional[0]);
    if (!project) throw new Error('Missing required value: project. Create a project first.');
    const hoursArg = need(flag(flags, 'hours') || positional[1], 'hours');
    const hours = model.num(hoursArg, 0);
    if (hours <= 0) throw new Error('Hours must be greater than zero.');
    const descriptionParts = positional.slice(2);
    const billableRaw = flag(flags, 'billable');
    const billable = billableRaw === undefined ? !flags['no-billable'] : (billableRaw !== 'false' && billableRaw !== false);
    const record = model.normalizeTimeEntry({
      projectId: project.id,
      hours,
      description: flag(flags, 'description', 'desc') || descriptionParts.join(' ') || 'Work logged',
      date: flag(flags, 'date') || model.todayISO(),
      billable
    });
    store.update((current) => {
      current.timeEntries.push(record);
      return model.addActivity(current, `Logged ${hours}h on ${project.name}`, 'time');
    });
    out.success(`Logged ${hours}h on ${project.name} (${record.id}).`);
    return 0;
  }

  throw new Error(`Unknown time action: ${action}. Use list or add.`);
}

function cmdGoals(out, args) {
  const [action, ...rest] = args;
  const { flags, positional } = parseArgs(rest);
  const data = load();

  if (!action || action === 'list') {
    out.heading('Goals');
    out.table([
      { key: 'name', label: 'GOAL', accent: out.ANSI.lime },
      { key: 'progress', label: 'PROGRESS' },
      { key: 'deadline', label: 'DEADLINE' }
    ], data.goals.map((goal) => ({
      name: goal.name,
      progress: `${model.roundMoney(goal.current)} / ${model.roundMoney(goal.target)} (${Math.round((goal.current / (goal.target || 1)) * 100)}%)`,
      deadline: goal.deadline || '—'
    })), { empty: 'No goals yet. Try: atlas goals add "Emergency fund" --target 5000' });
    return 0;
  }

  if (action === 'add') {
    const name = need(flag(flags, 'name') || positional[0], 'goal name');
    const target = model.num(need(flag(flags, 'target') || positional[1], '--target'), 0);
    if (target <= 0) throw new Error('Target must be greater than zero.');
    const record = model.normalizeGoal({
      name, target,
      current: model.num(flag(flags, 'current'), 0),
      deadline: flag(flags, 'deadline') || ''
    });
    store.update((current) => {
      current.goals.push(record);
      return model.addActivity(current, `Added goal ${record.name}`, 'goal');
    });
    out.success(`Added goal ${record.name} (${record.id}).`);
    return 0;
  }

  throw new Error(`Unknown goals action: ${action}. Use list or add.`);
}

function cmdReport(out) {
  const data = load();
  const result = insights.insight(data);
  const m = result.metrics;
  out.heading('Cashflow report');
  out.keyValue({
    Currency: m.currency,
    Received: money(m.received, m.currency),
    Expenses: money(m.spent, m.currency),
    Net: money(m.net, m.currency),
    Outstanding: money(m.outstanding, m.currency),
    'Monthly burn': money(m.burnRate, m.currency),
    'Avg monthly income': money(m.avgIncome, m.currency),
    'Annual subscriptions': money(m.annualSubscriptions, m.currency),
    'Active clients': m.activeClients,
    'Billable value': money(m.billableValue, m.currency)
  });
  out.write('');
  out.heading('Six-month cashflow');
  out.table([
    { key: 'month', label: 'MONTH' },
    { key: 'income', label: 'INCOME' },
    { key: 'expense', label: 'EXPENSE' },
    { key: 'net', label: 'NET', accent: out.ANSI.lime }
  ], result.cashflow.map((point) => ({
    month: point.label,
    income: money(point.income, m.currency),
    expense: money(point.expense, m.currency),
    net: money(point.net, m.currency)
  })));
  return 0;
}

function cmdExport(out, args) {
  const { flags } = parseArgs(args);
  const data = load();
  if (flags.json) {
    out.write(JSON.stringify(data, null, 2));
    return 0;
  }
  const file = path.join(process.cwd(), `atlas-developers-export-${model.todayISO()}.json`);
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  out.success(`Exported ${data.payments.length} payments to ${file}`);
  return 0;
}

function cmdImport(out, args) {
  const { positional } = parseArgs(args);
  const file = need(positional[0], 'import file');
  if (!fs.existsSync(path.resolve(file))) throw new Error(`File not found: ${file}`);
  const data = store.importData(file);
  out.success(`Imported data from ${file}`);
  out.keyValue({
    Clients: data.clients.length,
    Projects: data.projects.length,
    Payments: data.payments.length,
    Invoices: data.invoices.length,
    Subscriptions: data.subscriptions.length
  });
  return 0;
}

async function cmdAi(out, args) {
  const [action, ...rest] = args;
  const { flags, positional } = parseArgs(rest);
  const data = load();
  const config = store.readConfig();

  if (action === 'insight') {
    const result = insights.insight(data);
    out.write(insights.formatInsightText(result));
    return 0;
  }

  if (action === 'ask') {
    const question = model.str(flag(flags, 'question') || positional.join(' ')).trim();
    if (!question) throw new Error('Ask requires a question, e.g. atlas ai ask "what is my burn rate?"');
    const result = await ai.ask(data, question, config);
    out.heading(result.mode === 'external' ? 'Atlas AI — external' : 'Atlas AI — local');
    out.write('');
    out.write(result.answer);
    out.write('');
    out.muted(`Mode: ${result.mode}${result.fallback ? ' (fell back to local)' : ''} · no keys are stored in insight history`);
    store.update((current) => {
      current.ai.unshift(model.normalizeAi({ at: result.at, prompt: question, response: result.answer }));
      current.ai = current.ai.slice(0, 50);
      return model.addActivity(current, `Atlas AI question: ${question.slice(0, 80)}`, 'ai');
    });
    return 0;
  }

  throw new Error(`Unknown ai action: ${action || '(none)'}. Use insight or ask.`);
}

function cmdConfig(out, args) {
  const [action, ...rest] = args;
  const { positional } = parseArgs(rest);
  const allowed = ['currency', 'theme', 'clientId', 'syncEndpoint', 'cloudToken', 'aiEndpoint', 'aiKey'];
  const secretKeys = ['cloudToken', 'aiKey'];

  if (action === 'set') {
    const key = need(positional[0], 'config key');
    const value = need(positional[1], 'config value');
    if (!allowed.includes(key)) throw new Error(`Unknown config key: ${key}. Allowed: ${allowed.join(', ')}`);
    const config = store.readConfig();
    config[key] = value;
    store.writeConfig(config);
    store.update((data) => {
      if (['currency', 'theme', 'syncEndpoint', 'cloudToken', 'clientId'].includes(key)) {
        data.settings[key] = value;
      }
      return data;
    });
    out.success(`Set ${key} = ${secretKeys.includes(key) ? '••••••' : value}`);
    if (secretKeys.includes(key)) out.warn('Secrets stay in local config. Never commit config.json.');
    return 0;
  }

  if (action === 'get') {
    const key = need(positional[0], 'config key');
    if (!allowed.includes(key)) throw new Error(`Unknown config key: ${key}. Allowed: ${allowed.join(', ')}`);
    const config = store.readConfig();
    const value = config[key] || '';
    out.write(secretKeys.includes(key) && value ? '••••••' : (value || '—'));
    return 0;
  }

  throw new Error(`Unknown config action: ${action || '(none)'}. Use get or set.`);
}

async function dispatch(argv = [], io = {}) {
  const out = makeOutput(io);
  const [command, ...rest] = argv;

  if (!command || command === '--help' || command === '-h' || command === 'help') {
    printHelp(out);
    return 0;
  }
  if (command === '--version' || command === '-v' || command === 'version') {
    out.write(`atlas ${VERSION}`);
    return 0;
  }

  try {
    switch (command) {
      case 'init': return cmdInit(out, parseArgs(rest).flags);
      case 'status': return cmdStatus(out);
      case 'payments':
      case 'payment': return cmdPayments(out, rest);
      case 'invoices':
      case 'invoice': return cmdInvoices(out, rest);
      case 'clients':
      case 'client': return cmdClients(out, rest);
      case 'projects':
      case 'project': return cmdProjects(out, rest);
      case 'subscriptions':
      case 'subscription': return cmdSubscriptions(out, rest);
      case 'payouts':
      case 'payout': return cmdPayouts(out, rest);
      case 'time': return cmdTime(out, rest);
      case 'goals':
      case 'goal': return cmdGoals(out, rest);
      case 'report': return cmdReport(out);
      case 'export': return cmdExport(out, rest);
      case 'import': return cmdImport(out, rest);
      case 'ai': return await cmdAi(out, rest);
      case 'config': return cmdConfig(out, rest);
      default:
        out.error(`Unknown command: ${command}`);
        out.muted('Run "atlas --help" to see available commands.');
        return 1;
    }
  } catch (error) {
    out.error((error && error.message) || String(error));
    return 1;
  }
}

module.exports = { dispatch, parseArgs, printHelp };
