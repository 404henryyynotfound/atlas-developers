#!/usr/bin/env node
'use strict';

const { dispatch } = require('../src/commands');

Promise.resolve(dispatch(process.argv.slice(2)))
  .then((code) => { process.exitCode = Number.isInteger(code) ? code : 0; })
  .catch((error) => {
    process.stderr.write(`atlas: fatal error: ${(error && error.message) || error}\n`);
    process.exitCode = 1;
  });
