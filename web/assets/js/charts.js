/** Dependency-free SVG charts. All text is escaped before interpolation. */

import { esc, num } from './utils.js';

function safe(value) {
  const number = num(value);
  return Number.isFinite(number) ? number : 0;
}

export function lineChart(series, options = {}) {
  const points = Array.isArray(series) ? series : [];
  const width = options.width || 760;
  const height = options.height || 260;
  const pad = { top: 22, right: 18, bottom: 38, left: 58 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  if (!points.length) return '<div class="chart-empty">No chart data yet.</div>';
  const values = points.flatMap((point) => [safe(point.income), safe(point.expense)]);
  const max = Math.max(1, ...values) * 1.15;
  const x = (index) => pad.left + (innerW / Math.max(1, points.length - 1)) * index;
  const y = (value) => pad.top + innerH - (safe(value) / max) * innerH;
  const path = (key) => points.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(point[key]).toFixed(1)}`).join(' ');
  const area = `${path('income')} L${x(points.length - 1).toFixed(1)},${(pad.top + innerH).toFixed(1)} L${x(0).toFixed(1)},${(pad.top + innerH).toFixed(1)} Z`;
  const grid = [0, 0.25, 0.5, 0.75, 1].map((fraction) => {
    const gy = pad.top + innerH * (1 - fraction);
    const label = Math.round(max * fraction);
    return `<line x1="${pad.left}" y1="${gy.toFixed(1)}" x2="${width - pad.right}" y2="${gy.toFixed(1)}" class="chart-grid"/><text x="${pad.left - 10}" y="${(gy + 4).toFixed(1)}" class="chart-label" text-anchor="end">${esc(label)}</text>`;
  }).join('');
  const labels = points.map((point, index) => (
    `<text x="${x(index).toFixed(1)}" y="${height - 12}" class="chart-label" text-anchor="middle">${esc(point.label || '')}</text>`
  )).join('');
  const dots = (key, color) => points.map((point, index) => (
    `<circle cx="${x(index).toFixed(1)}" cy="${y(point[key]).toFixed(1)}" r="3.5" fill="${color}"><title>${esc(point.label)}: ${esc(point[key])}</title></circle>`
  )).join('');
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Income and expense cashflow chart">
    <defs><linearGradient id="atlas-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3ee6ff" stop-opacity="0.28"/><stop offset="100%" stop-color="#3ee6ff" stop-opacity="0"/></linearGradient></defs>
    ${grid}
    <path d="${area}" fill="url(#atlas-area)" stroke="none"/>
    <path d="${path('income')}" fill="none" stroke="#3ee6ff" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="${path('expense')}" fill="none" stroke="#c6ff5e" stroke-width="2" stroke-dasharray="6 5" stroke-linejoin="round"/>
    ${dots('income', '#3ee6ff')}${dots('expense', '#c6ff5e')}
    ${labels}
  </svg>`;
}

export function barChart(items, options = {}) {
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) return '<div class="chart-empty">No data to chart yet.</div>';
  const max = Math.max(1, ...rows.map((item) => safe(item.value)));
  return `<div class="bar-chart">${rows.map((item, index) => {
    const width = Math.max(2, (safe(item.value) / max) * 100);
    return `<div class="bar-row">
      <div class="bar-name"><span class="bar-index">${index + 1}</span>${esc(item.label)}</div>
      <div class="bar-track"><div class="bar-fill bar-fill-${index % 2}" style="width:${width.toFixed(1)}%"></div></div>
      <div class="bar-value">${esc(item.display !== undefined ? item.display : item.value)}</div>
    </div>`;
  }).join('')}</div>`;
}

export function progressBar(current, target, label = '') {
  const total = safe(target);
  const value = safe(current);
  const percent = total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0;
  return `<div class="progress-wrap">
    <div class="progress-track"><div class="progress-fill" style="width:${percent.toFixed(1)}%"></div></div>
    <span class="progress-label">${esc(label || `${Math.round(percent)}%`)}</span>
  </div>`;
}

export function sparkline(values, options = {}) {
  const list = Array.isArray(values) ? values.map(safe) : [];
  if (!list.length) return '';
  const width = options.width || 120;
  const height = options.height || 32;
  const max = Math.max(1, ...list);
  const min = Math.min(0, ...list);
  const span = max - min || 1;
  const points = list.map((value, index) => {
    const px = (index / Math.max(1, list.length - 1)) * width;
    const py = height - ((value - min) / span) * height;
    return `${px.toFixed(1)},${py.toFixed(1)}`;
  }).join(' ');
  return `<svg class="sparkline" viewBox="0 0 ${width} ${height}" aria-hidden="true"><polyline points="${points}" fill="none" stroke="#3ee6ff" stroke-width="2"/></svg>`;
}
