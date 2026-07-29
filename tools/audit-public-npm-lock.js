'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const files = ['package-lock.json', '.npmrc'];
const forbidden = [
  'applied-caas-gateway',
  'internal.api.openai.org',
  '/artifactory/api/npm/'
];

for (const name of files) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) {
    throw new Error(`Missing required npm configuration file: ${name}`);
  }
  const text = fs.readFileSync(file, 'utf8');
  for (const marker of forbidden) {
    if (text.includes(marker)) {
      throw new Error(`${name} contains a private registry reference: ${marker}`);
    }
  }
}

const npmrc = fs.readFileSync(path.join(root, '.npmrc'), 'utf8');
if (!/^registry=https:\/\/registry\.npmjs\.org\/$/m.test(npmrc)) {
  throw new Error('.npmrc must use the public npm registry.');
}

console.log('[ShinaYuu] Public npm registry audit passed.');
