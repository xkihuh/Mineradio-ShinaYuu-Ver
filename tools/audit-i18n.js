'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const I18N_FILE = path.join(ROOT, 'public', 'js', 'shinayuu-i18n.js');
const CJK_RE = /[\u3400-\u9fff]/;
const VI_RE = /[ăâđêôơưĂÂĐÊÔƠƯáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵÁÀẢÃẠẤẦẨẪẬẮẰẲẴẶÉÈẺẼẸẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌỐỒỔỖỘỚỜỞỠỢÚÙỦŨỤỨỪỬỮỰÝỲỶỸỴ]/;

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function walk(dir, predicate, output = []) {
  if (!fs.existsSync(dir)) return output;
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    const stat = fs.statSync(file);
    if (stat.isDirectory()) walk(file, predicate, output);
    else if (predicate(file)) output.push(file);
  }
  return output;
}

function extractJsonObject(source, openIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex, i + 1);
    }
  }
  throw new Error('Unterminated translation object');
}

function loadDictionary() {
  const source = read(I18N_FILE);
  const dictionary = Object.create(null);
  const pattern = /var\s+([A-Za-z0-9_]*(?:TEXT|SOURCE)[A-Za-z0-9_]*)\s*=\s*\{/g;
  let match;
  while ((match = pattern.exec(source))) {
    const open = source.indexOf('{', match.index);
    const raw = extractJsonObject(source, open);
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`Could not parse ${match[1]}: ${error.message}`);
    }
    Object.assign(dictionary, parsed);
    pattern.lastIndex = open + raw.length;
  }
  return { dictionary, source };
}

function extractStringLiterals(source) {
  const values = [];
  let state = 'code';
  let quote = '';
  let buffer = '';
  let start = 0;
  let escaped = false;

  function push() {
    if (buffer.trim()) values.push({ value: buffer.trim(), index: start });
    buffer = '';
  }

  for (let i = 0; i < source.length;) {
    const ch = source[i];
    const next = source[i + 1] || '';
    if (state === 'code') {
      if (ch === '/' && next === '/') { state = 'line-comment'; i += 2; continue; }
      if (ch === '/' && next === '*') { state = 'block-comment'; i += 2; continue; }
      if (ch === '"' || ch === "'") { state = 'string'; quote = ch; start = i; buffer = ''; escaped = false; i += 1; continue; }
      if (ch === '`') { state = 'template'; quote = '`'; start = i; buffer = ''; escaped = false; i += 1; continue; }
      i += 1;
      continue;
    }
    if (state === 'line-comment') {
      if (ch === '\n') state = 'code';
      i += 1;
      continue;
    }
    if (state === 'block-comment') {
      if (ch === '*' && next === '/') { state = 'code'; i += 2; }
      else i += 1;
      continue;
    }
    if (escaped) {
      buffer += ({ n: '\n', r: '\r', t: '\t' }[ch] || ch);
      escaped = false;
      i += 1;
      continue;
    }
    if (ch === '\\') { escaped = true; i += 1; continue; }
    if (ch === quote) { push(); state = 'code'; i += 1; continue; }
    if (state === 'template' && ch === '$' && next === '{') {
      push();
      i += 2;
      let depth = 1;
      let expressionQuote = null;
      let expressionEscaped = false;
      while (i < source.length && depth > 0) {
        const current = source[i];
        if (expressionQuote) {
          if (expressionEscaped) expressionEscaped = false;
          else if (current === '\\') expressionEscaped = true;
          else if (current === expressionQuote) expressionQuote = null;
        } else if (current === '"' || current === "'" || current === '`') expressionQuote = current;
        else if (current === '{') depth += 1;
        else if (current === '}') depth -= 1;
        i += 1;
      }
      start = i;
      continue;
    }
    buffer += ch;
    i += 1;
  }
  return values;
}

function translateToEnglish(value, dictionary, sortedKeys) {
  if (dictionary[value]) return dictionary[value][1];
  let output = value;
  for (const key of sortedKeys) {
    if (!output.includes(key)) continue;
    const pair = dictionary[key];
    if (pair && pair[1]) output = output.split(key).join(pair[1]);
  }
  return output;
}

function isSearchMatchingData(value, file) {
  if (!file.endsWith(path.join('05-playback', '07-search.js'))) return false;
  return CJK_RE.test(value) && (
    (value.includes('|') && value.includes('/')) || value.includes('周杰伦') ||
    value.includes('翻唱') || value.includes('伴奏') || value.includes('加速版')
  );
}

function isCodeFragment(value) {
  if (value.length > 600) return true;
  if (/\\[puds]|\(\?:|\(\?=|\[[^\]]*\\/.test(value)) return true;
  return false;
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function auditDynamicStrings(dictionary) {
  const sortedKeys = Object.keys(dictionary).sort((a, b) => b.length - a.length);
  const files = [
    ...walk(path.join(ROOT, 'public', 'js'), file => file.endsWith('.js') && !file.endsWith('shinayuu-i18n.js') && !file.endsWith('shinayuu-index-bundle.js')),
    ...walk(path.join(ROOT, 'desktop'), file => file.endsWith('.js')),
  ];
  const unresolved = [];
  for (const file of files) {
    const source = read(file);
    for (const item of extractStringLiterals(source)) {
      const value = item.value;
      if (!(CJK_RE.test(value) || VI_RE.test(value))) continue;
      if (isCodeFragment(value) || isSearchMatchingData(value, file)) continue;
      const translated = translateToEnglish(value, dictionary, sortedKeys);
      if (CJK_RE.test(translated) || VI_RE.test(translated)) {
        unresolved.push(`${path.relative(ROOT, file)}:${lineNumber(source, item.index)} ${value.replace(/\n/g, '\\n')}`);
      }
    }
  }
  return unresolved;
}

function auditStaticFiles() {
  const failures = [];
  const html = read(path.join(ROOT, 'public', 'index.html'));
  if (CJK_RE.test(html)) failures.push('public/index.html still contains Han UI text');

  const cssFiles = walk(path.join(ROOT, 'public'), file => file.endsWith('.css'));
  for (const file of cssFiles) {
    const source = read(file);
    const pseudoStrings = [...source.matchAll(/content\s*:\s*(["'])(.*?)\1/g)].map(match => match[2]);
    if (pseudoStrings.some(text => CJK_RE.test(text))) failures.push(`${path.relative(ROOT, file)} contains Han pseudo-element text`);
  }

  const installerFiles = walk(ROOT, file => /\.(nsh|nsi)$/i.test(file));
  for (const file of installerFiles) {
    if (CJK_RE.test(read(file))) failures.push(`${path.relative(ROOT, file)} contains untranslated Han installer text`);
  }
  return failures;
}

function main() {
  const { dictionary, source } = loadDictionary();
  const failures = [];
  if (!/function wrapDialogs\(\)/.test(source)) failures.push('dialog localization wrapper is missing');
  if (!/function wrapCanvas\(\)/.test(source)) failures.push('canvas localization wrapper is missing');
  if (!/var SHINAYUU_ALPHA2_DYNAMIC_TEXT=/.test(source)) failures.push('Alpha 2 dynamic translation map is missing');
  failures.push(...auditStaticFiles());
  failures.push(...auditDynamicStrings(dictionary));

  if (failures.length) {
    console.error(`[i18n-audit] ${failures.length} issue(s) found:`);
    failures.slice(0, 100).forEach(item => console.error(` - ${item}`));
    process.exitCode = 1;
    return;
  }
  console.log(`[i18n-audit] PASS · ${Object.keys(dictionary).length} translation entries · static and dynamic UI covered`);
}

main();
