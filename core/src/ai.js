'use strict';

/**
 * Atlas AI.
 * Local mode is deterministic and offline. External mode is opt-in through
 * ATLAS_AI_ENDPOINT + ATLAS_AI_KEY (or the equivalent config keys). Keys are
 * never logged, echoed, or written into insight history by this module.
 */

const model = require('./model');
const insights = require('./insights');

function resolveSettings(config = {}) {
  const source = config && typeof config === 'object' ? config : {};
  return {
    endpoint: source.aiEndpoint || source.ATLAS_AI_ENDPOINT || process.env.ATLAS_AI_ENDPOINT || '',
    key: source.aiKey || source.ATLAS_AI_KEY || process.env.ATLAS_AI_KEY || '',
    model: source.aiModel || source.ATLAS_AI_MODEL || process.env.ATLAS_AI_MODEL || 'atlas-local-llm'
  };
}

function mode(config) {
  const settings = resolveSettings(config);
  return settings.endpoint && settings.key ? 'external' : 'local';
}

function modeLabel(config) {
  return mode(config) === 'external' ? 'external LLM (opt-in)' : 'local deterministic engine';
}

function localInsight(data) {
  return insights.insight(data);
}

function localAsk(data, question) {
  const normalized = model.normalizeData(data);
  const m = insights.metrics(normalized);
  const q = model.str(question).toLowerCase().trim();
  const fmt = (value) => model.formatMoney(value, m.currency);
  let answer;

  if (!q || /\b(help|what can you do|commands|hello|hi)\b/.test(q)) {
    answer = 'Ask about income, burn rate, overdue invoices, top clients, subscriptions, cashflow, billable time, goals, or payouts. Try: "atlas ai ask \'who are my top clients?\'".';
  } else if (/\b(top|best|biggest)\b.*\b(client|customer)/.test(q) || /\bclient(s)?\b/.test(q) && /\bwho|rank|revenue/.test(q)) {
    const top = insights.topClients(normalized, 5);
    answer = top.length
      ? `Top clients by paid income: ${top.map((c, i) => `${i + 1}. ${c.name} — ${fmt(c.amount)} (${c.count} payments)`).join('; ')}.`
      : 'No paid client income has been recorded yet. Add income payments with a client to build this ranking.';
  } else if (/\bburn|monthly cost|monthly spend|expense rate/.test(q)) {
    answer = `Monthly burn averages ${fmt(m.burnRate)} across active months. Total paid expenses are ${fmt(m.spent)}; recent income averages ${fmt(m.avgIncome)} per month.`;
  } else if (/\boverdue|late|unpaid|remind/.test(q)) {
    const list = insights.overdueInvoices(normalized);
    answer = list.length
      ? `${list.length} invoice(s) are overdue or past due, totaling ${fmt(m.overdueAmount)}: ${list.slice(0, 5).map((i) => `${i.number} (${i.clientId ? insights.clientName(normalized, i.clientId) : 'unassigned'}, due ${i.dueDate})`).join('; ')}.`
      : 'No overdue invoices are currently recorded. Keep due dates current to preserve that signal.';
  } else if (/\boutstanding|receivable|due/.test(q) || /\binvoice/.test(q)) {
    answer = `Outstanding invoice balance is ${fmt(m.outstanding)} across ${m.invoiceCount} invoice(s). Of that, ${fmt(m.overdueAmount)} is overdue.`;
  } else if (/\bsubscription|recurring|annual cost|saas/.test(q)) {
    const active = normalized.subscriptions.filter((s) => s.status === 'active');
    answer = `${active.length} active subscription(s) cost ${fmt(m.annualSubscriptions)} annually. Largest: ${active.slice().sort((a, b) => b.amount - a.amount).slice(0, 3).map((s) => `${s.name} (${fmt(s.amount)}/${s.frequency})`).join('; ') || 'none logged'}.`;
  } else if (/\bcashflow|cash flow|trend|net/.test(q)) {
    const series = insights.cashflow(normalized, 6);
    answer = `Six-month net cashflow: ${series.map((p) => `${p.label} ${fmt(p.net)}`).join(', ')}. Current net position from recorded payments is ${fmt(m.net)}.`;
  } else if (/\btime|billable|hours|hourly/.test(q)) {
    answer = `${m.trackedHours} hours tracked, ${m.billableHours} billable, valued at ${fmt(m.billableValue)} using project or client rates.`;
  } else if (/\bgoal|target|deadline/.test(q)) {
    const goals = normalized.goals.slice(0, 5);
    answer = goals.length
      ? `Goals: ${goals.map((g) => `${g.name} ${Math.round((model.num(g.current) / (model.num(g.target) || 1)) * 100)}%${g.deadline ? ` (due ${g.deadline})` : ''}`).join('; ')}.`
      : 'No goals are tracked yet. Add a goal to monitor progress against a target.';
  } else if (/\bpayout|withdraw/.test(q)) {
    const pending = normalized.payouts.filter((p) => p.status === 'pending');
    answer = `${pending.length} pending payout(s) totaling ${fmt(insights.sum(pending, (p) => p.amount))}. Next scheduled: ${insights.upcoming(normalized).filter((u) => u.kind === 'payout')[0]?.date || 'none scheduled'}.`;
  } else if (/\bexpense|spend|spent|cost/.test(q)) {
    answer = `Paid expenses total ${fmt(m.spent)}. Average monthly burn is ${fmt(m.burnRate)} and annualized subscriptions add ${fmt(m.annualSubscriptions)}.`;
  } else if (/\bincome|revenue|received|earn/.test(q)) {
    answer = `Paid income totals ${fmt(m.received)}. Recent monthly income averages ${fmt(m.avgIncome)}. Outstanding invoices add ${fmt(m.outstanding)}.`;
  } else if (/\bsummary|insight|status|overview|how am i/.test(q)) {
    const result = insights.insight(normalized);
    answer = `${result.headline}. ${result.findings.slice(0, 3).join(' ')} Next: ${result.actions[0]}`;
  } else {
    answer = `I could not map "${model.str(question).slice(0, 120)}" to a local metric. Ask about clients, burn, invoices, subscriptions, cashflow, time, goals, payouts, or type "help".`;
  }
  return {
    mode: 'local',
    answer,
    question: model.str(question),
    intent: 'local-parse',
    at: new Date().toISOString()
  };
}

function externalContext(data) {
  const m = insights.metrics(data);
  return {
    currency: m.currency,
    totals: {
      received: m.received, spent: m.spent, outstanding: m.outstanding,
      burnRate: m.burnRate, overdueCount: m.overdueCount, activeClients: m.activeClients
    },
    topClients: insights.topClients(data, 5),
    upcoming: insights.upcoming(data, 5),
    recentPayments: model.arr(data && data.payments).slice(-10).map((p) => ({
      date: p.date, type: p.type, description: p.description.slice(0, 120), amount: p.amount, status: p.status
    }))
  };
}

async function externalAsk(data, question, config = {}) {
  const settings = resolveSettings(config);
  if (!settings.endpoint || !settings.key) throw new Error('External AI requires an endpoint and key.');
  if (typeof globalThis.fetch !== 'function') throw new Error('External AI requires Node 20+ (global fetch).');
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), 20000) : null;
  try {
    const response = await globalThis.fetch(settings.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${settings.key}`,
        'user-agent': 'atlas-developers-cli/1.0'
      },
      body: JSON.stringify({
        model: settings.model,
        system: 'You are Atlas AI, a concise bookkeeping assistant. Answer using only the provided local context. Never invent transactions. Keep replies under 150 words.',
        question: model.str(question),
        context: externalContext(model.normalizeData(data))
      }),
      signal: controller ? controller.signal : undefined
    });
    if (!response.ok) throw new Error(`AI endpoint returned HTTP ${response.status}`);
    const payload = await response.json().catch(() => ({}));
    const answer = model.str(
      payload.answer || payload.response || payload.content ||
      (payload.choices && payload.choices[0] && (payload.choices[0].text || (payload.choices[0].message && payload.choices[0].message.content)))
    ).trim();
    if (!answer) throw new Error('AI endpoint returned no text response.');
    return {
      mode: 'external',
      answer,
      question: model.str(question),
      intent: 'external-llm',
      at: new Date().toISOString()
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function ask(data, question, config = {}) {
  if (mode(config) === 'external') {
    try {
      return await externalAsk(data, question, config);
    } catch (error) {
      const fallback = localAsk(data, question);
      fallback.answer = `[External AI unavailable: ${model.str(error && error.message).slice(0, 120)}] ${fallback.answer}`;
      fallback.fallback = true;
      return fallback;
    }
  }
  return localAsk(data, question);
}

module.exports = {
  resolveSettings, mode, modeLabel, localInsight, localAsk,
  externalAsk, externalContext, ask
};
