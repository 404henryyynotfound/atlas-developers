'use strict';

/** Dependency-free terminal formatting. Colors only on TTY. */

const ANSI = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  dim: '\u001b[2m',
  cyan: '\u001b[36m',
  lime: '\u001b[32m',
  yellow: '\u001b[33m',
  red: '\u001b[31m',
  gray: '\u001b[90m'
};

function makeOutput(io = {}) {
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;
  const enabled = io.color === undefined
    ? Boolean(io.isTTY !== undefined ? io.isTTY : process.stdout.isTTY) && !process.env.NO_COLOR
    : Boolean(io.color);

  // Piping into `head` should not produce an unhandled EPIPE stack trace.
  [stdout, stderr].forEach((stream) => {
    if (stream && typeof stream.on === 'function') {
      stream.on('error', (error) => {
        if (error && error.code === 'EPIPE') {
          try { stream.destroy(); } catch (_) { /* already closed */ }
        }
      });
    }
  });

  function paint(text, code) {
    return enabled ? `${code}${text}${ANSI.reset}` : String(text);
  }

  function write(text = '', stream = stdout) {
    stream.write(`${String(text)}\n`);
  }

  function strip(text) {
    return String(text).replace(/\u001b\[[0-9;]*m/g, '');
  }

  function heading(text) {
    write('');
    write(paint(String(text).toUpperCase(), `${ANSI.bold}${ANSI.cyan}`));
    write(paint('─'.repeat(Math.max(8, strip(text).length)), ANSI.gray));
  }

  function success(text) { write(paint(`✔ ${text}`, ANSI.lime)); }
  function info(text) { write(paint(`• ${text}`, ANSI.cyan)); }
  function warn(text) { write(paint(`! ${text}`, ANSI.yellow), stderr); }
  function error(text) { write(paint(`✖ ${text}`, ANSI.red), stderr); }
  function muted(text) { write(paint(String(text), ANSI.gray)); }
  function rule() { write(paint('─'.repeat(48), ANSI.gray)); }

  function keyValue(entries) {
    const rows = Object.entries(entries || {});
    const width = rows.reduce((max, [key]) => Math.max(max, strip(key).length), 0) + 2;
    rows.forEach(([key, value]) => {
      write(`${paint(String(key).padEnd(width), ANSI.dim)}${value === undefined || value === null ? '—' : value}`);
    });
  }

  function truncate(value, max = 42) {
    const text = String(value === undefined || value === null || value === '' ? '—' : value);
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function table(headers, rows, options = {}) {
    if (!rows.length) {
      muted(options.empty || 'No records found.');
      return;
    }
    const limit = options.maxWidth || 42;
    const cells = rows.map((row) => headers.map((header) => truncate(row[header.key], limit)));
    const widths = headers.map((header, index) => Math.max(
      strip(header.label).length,
      ...cells.map((row) => strip(row[index]).length)
    ));
    const line = (parts) => write(parts.map((part, index) => String(part).padEnd(widths[index])).join('  ').trimEnd());
    line(headers.map((header) => paint(header.label, `${ANSI.bold}${ANSI.dim}`)));
    line(widths.map((width) => '─'.repeat(width)));
    cells.forEach((row) => line(row.map((cell, index) => (
      headers[index].accent ? paint(cell, headers[index].accent) : cell
    ))));
    muted(`${rows.length} row${rows.length === 1 ? '' : 's'}`);
  }

  function json(value) { write(JSON.stringify(value, null, 2)); }

  function spinner(label) {
    if (!enabled || !stderr.isTTY) return { stop() {} };
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let index = 0;
    const timer = setInterval(() => {
      stderr.write(`\r${paint(frames[index++ % frames.length], ANSI.cyan)} ${label}`);
    }, 90);
    return {
      stop() {
        clearInterval(timer);
        stderr.write('\r\u001b[2K');
      }
    };
  }

  return { write, heading, success, info, warn, error, muted, rule, keyValue, table, json, spinner, paint, strip, ANSI };
}

module.exports = { makeOutput, ANSI };
