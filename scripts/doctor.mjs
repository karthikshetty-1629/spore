import { access, readFile } from 'node:fs/promises';
import process from 'node:process';

const requiredFiles = [
  'README.md',
  'docs/SETUP.md',
  'docs/HANDOFF.md',
  '.env.example',
  'dashboard/server.mjs',
  'dashboard/progress.json',
  'scripts/evaluate_models.py',
];

const requiredKeys = [
  'NIMBLE_API_KEY',
  'RAWTREE_API_KEY',
  'RAWTREE_DATABASE',
  'LIQUID_BASE_URL',
  'LIQUID_MODEL',
  'LIQUID_REEVALUATION_MODEL',
];

function parseEnv(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, '$2');
        return [key, value];
      }),
  );
}

function row(label, ok, detail) {
  const state = ok ? 'OK' : 'NEEDS ATTENTION';
  console.log(`${state.padEnd(15)} ${label.padEnd(24)} ${detail}`);
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
row('Node.js', nodeMajor >= 20, process.version);

let fileFailure = false;
for (const file of requiredFiles) {
  try {
    await access(file);
    row(file, true, 'present');
  } catch {
    fileFailure = true;
    row(file, false, 'missing');
  }
}

const envText = await readFile('.env', 'utf8').catch(() => '');
const env = parseEnv(envText);
let envFailure = !envText;
row('.env', Boolean(envText), envText ? 'present; values hidden' : 'copy .env.example to .env');
for (const key of requiredKeys) {
  const configured = Boolean(env[key]);
  envFailure ||= !configured;
  row(key, configured, configured ? 'configured; value hidden' : 'missing');
}

let ollamaFailure = false;
try {
  const response = await fetch('http://127.0.0.1:11434/api/tags', {
    signal: AbortSignal.timeout(2500),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  const installed = new Set((payload.models || []).map((model) => model.name.replace(/:latest$/, '')));
  row('Ollama', true, `${installed.size} local model(s) available`);
  for (const key of ['LIQUID_MODEL', 'LIQUID_REEVALUATION_MODEL']) {
    const model = env[key];
    if (!model) continue;
    const present = installed.has(model.replace(/:latest$/, ''));
    ollamaFailure ||= !present;
    row(key.replace('LIQUID_', ''), present, present ? 'installed' : 'not installed');
  }
} catch (error) {
  ollamaFailure = true;
  row('Ollama', false, 'start the Ollama application or service');
}

console.log('\nNo paid API requests were made. No secret values were printed.');
if (fileFailure || envFailure || ollamaFailure || nodeMajor < 20) process.exitCode = 1;
