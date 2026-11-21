'use strict';

/**
 * Local-first JSON store with atomic writes.
 * ATLAS_HOME overrides ~/.atlas-developers (used by tests and power users).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const model = require('./model');
const { VERSION } = require('./version');

const CONFIG_KEYS = [
  'currency', 'theme', 'clientId', 'syncEndpoint', 'cloudToken',
  'aiEndpoint', 'aiKey', 'dataFile', 'version'
];

function atlasHome() {
  const override = process.env.ATLAS_HOME;
  if (override && String(override).trim()) return path.resolve(String(override));
  return path.join(os.homedir(), '.atlas-developers');
}

function dataPath() {
  return path.join(atlasHome(), 'data.json');
}

function configPath() {
  return path.join(atlasHome(), 'config.json');
}

function ensureHome() {
  fs.mkdirSync(atlasHome(), { recursive: true });
}

function defaultConfig() {
  return {
    version: VERSION,
    dataFile: dataPath(),
    currency: 'USD',
    theme: 'ink',
    clientId: '',
    syncEndpoint: '',
    cloudToken: '',
    aiEndpoint: '',
    aiKey: '',
    createdAt: new Date().toISOString()
  };
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
}

function atomicWrite(file, value) {
  ensureHome();
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temp, file);
  return file;
}

function readConfig() {
  const stored = readJson(configPath(), {});
  const config = Object.assign(defaultConfig(), stored);
  config.version = VERSION;
  config.dataFile = dataPath();
  return config;
}

function writeConfig(config) {
  const clean = {};
  const current = readConfig();
  Object.assign(current, config || {});
  CONFIG_KEYS.forEach((key) => { clean[key] = current[key]; });
  clean.createdAt = current.createdAt;
  return atomicWrite(configPath(), clean);
}

function readData() {
  const stored = readJson(dataPath(), null);
  return model.normalizeData(stored);
}

function writeData(data) {
  const normalized = model.normalizeData(data);
  return atomicWrite(dataPath(), normalized);
}

function init() {
  ensureHome();
  let createdData = false;
  let createdConfig = false;
  if (!fs.existsSync(dataPath())) {
    writeData(model.defaultData());
    createdData = true;
  }
  if (!fs.existsSync(configPath())) {
    writeConfig(defaultConfig());
    createdConfig = true;
  }
  const data = readData();
  const config = readConfig();
  return { data, config, createdData, createdConfig, home: atlasHome() };
}

function exists() {
  return fs.existsSync(dataPath());
}

function update(mutator) {
  const data = readData();
  const result = typeof mutator === 'function' ? mutator(data) : data;
  const finalData = model.normalizeData(result || data);
  writeData(finalData);
  return finalData;
}

function readDataFile(file) {
  if (!file) return readData();
  const parsed = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  return model.normalizeData(parsed);
}

function exportData() {
  return model.normalizeData(readData());
}

function importData(file) {
  const imported = readDataFile(file);
  writeData(imported);
  return imported;
}

function clearData() {
  return writeData(model.defaultData());
}

function mode(config = readConfig()) {
  return config.syncEndpoint && config.cloudToken ? 'cloud' : 'local';
}

module.exports = {
  CONFIG_KEYS,
  atlasHome, dataPath, configPath, ensureHome,
  readJson, atomicWrite,
  readConfig, writeConfig, readData, writeData,
  init, exists, update, exportData, importData, clearData,
  readDataFile, mode
};
