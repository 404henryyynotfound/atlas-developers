'use strict';

/** Integration tests for the zero-dependency Atlas CLI. Run: node cli/test.js */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const bin = path.join(__dirname, 'bin', 'atlas.js');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-developers-test-'));
const env = Object.assign({}, process.env, { ATLAS_HOME: home, NO_COLOR: '1' });

function run(args) {
  const result = spawnSync(process.execPath, [bin].concat(args), {
    env,
    cwd: root,
    encoding: 'utf8',
    timeout: 20000
  });
  if (result.error) throw result.error;
  return result;
}

function ok(args, expected) {
  const result = run(args);
  assert.strictEqual(result.status, 0, `atlas ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  if (expected) assert.ok(result.stdout.includes(expected), `atlas ${args.join(' ')} missing "${expected}":\n${result.stdout}`);
  return result;
}

try {
  ok(['--version'], 'atlas ');
  ok(['--help'], 'ATLAS DEVELOPERS CLI');

  const init = ok(['init'], 'ATLAS INITIALIZED');
  assert.ok(init.stdout.includes('Data created'), 'init should report data creation');
  assert.ok(fs.existsSync(path.join(home, 'data.json')), 'data.json should exist');
  assert.ok(fs.existsSync(path.join(home, 'config.json')), 'config.json should exist');

  ok(['clients', 'add', 'Northstar Studio', '--email', 'billing@northstar.test', '--company', 'Northstar', '--rate', '120'], 'Added client');
  ok(['projects', 'add', 'Atlas site', 'Northstar', '--rate', '135'], 'Added project');
  ok(['payments', 'add', '--type', 'income', '--amount', '1200', '--description', 'Design retainer', '--client', 'Northstar'], 'Added income payment');
  ok(['payments', 'add', '--type', 'expense', '--amount', '19', '--description', 'Hosting', '--category', 'software'], 'Added expense payment');
  ok(['subscriptions', 'add', 'Design suite', '--amount', '24', '--frequency', 'monthly'], 'Added subscription');
  ok(['invoices', 'add', '--client', 'Northstar', '--amount', '500', '--days', '7'], 'Created invoice');
  ok(['invoices', 'list'], 'Outstanding:');
  ok(['time', 'add', 'Atlas site', '2.5', 'Discovery workshop'], 'Logged 2.5h');
  ok(['goals', 'add', 'Emergency fund', '--target', '5000'], 'Added goal');

  ok(['clients', 'list'], 'Northstar Studio');
  const payments = ok(['payments', 'list'], 'Income');
  assert.ok(payments.stdout.includes('Hosting'), 'payments list should show the expense');
  ok(['report'], 'CASHFLOW REPORT');
  ok(['status'], 'local only');
  ok(['ai', 'insight'], 'ATLAS AI');
  ok(['ai', 'ask', 'who are my top clients?'], 'Northstar Studio');
  ok(['config', 'set', 'currency', 'USD'], 'Set currency = USD');
  ok(['config', 'get', 'currency'], 'USD');

  const exported = ok(['export', '--json']);
  const payload = JSON.parse(exported.stdout);
  assert.strictEqual(payload.payments.length, 2, 'export should contain two payments');
  assert.strictEqual(payload.clients.length, 1, 'export should contain one client');

  const importFile = path.join(home, 'import.json');
  fs.writeFileSync(importFile, JSON.stringify(payload), 'utf8');
  ok(['import', importFile], 'Imported data');
  ok(['invoices', 'paid', 'INV-'], 'marked paid');
  ok(['payments', 'paid', 'pay_'], 'marked paid');

  const unknown = run(['definitely-not-a-command']);
  assert.notStrictEqual(unknown.status, 0, 'unknown command should exit nonzero');

  process.stdout.write('atlas CLI tests passed (init, add, list, report, ai, export, import, config)\n');
} finally {
  fs.rmSync(home, { recursive: true, force: true });
}
