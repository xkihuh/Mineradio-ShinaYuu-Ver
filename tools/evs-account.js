'use strict';

const { spawnSync } = require('node:child_process');

function fail(message) {
  console.error(`[EVS account] ${message}`);
  process.exit(1);
}

function candidates(args) {
  if (process.platform === 'win32') {
    return [
      ['py', ['-3', ...args]],
      ['python', args],
      ['python3', args],
    ];
  }
  return [
    ['python3', args],
    ['python', args],
  ];
}

function runPython(args) {
  let lastFailure = 'Python 3 was not found.';
  for (const [command, commandArgs] of candidates(args)) {
    const result = spawnSync(command, commandArgs, {
      env: process.env,
      stdio: 'inherit',
      shell: false,
      windowsHide: false,
    });
    if (!result.error && result.status === 0) return;
    if (result.error && result.error.code === 'ENOENT') {
      lastFailure = `${command} was not found.`;
      continue;
    }
    lastFailure = result.error?.message || `${command} exited with code ${result.status}`;
  }
  fail(lastFailure);
}

const action = String(process.argv[2] || '').toLowerCase();
switch (action) {
  case 'install':
    console.log('[EVS account] Installing the pinned build dependency without forcing an upgrade...');
    runPython(['-m', 'pip', 'install', 'castlabs-evs']);
    break;
  case 'upgrade':
    console.log('[EVS account] Upgrading castlabs-evs by explicit request...');
    runPython(['-m', 'pip', 'install', '--upgrade', 'castlabs-evs']);
    break;
  case 'refresh':
    console.log('[EVS account] Refreshing the Castlabs EVS account/session...');
    runPython(['-m', 'castlabs_evs.account', 'refresh']);
    break;
  case 'version':
    runPython(['-c', "import importlib.metadata as m; print('castlabs-evs', m.version('castlabs-evs'))"]);
    break;
  default:
    fail('Usage: node tools/evs-account.js <install|upgrade|refresh|version>');
}
