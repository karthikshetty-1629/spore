import { readFile } from 'node:fs/promises';

const requiredFiles = [
  'README.md',
  'docs/SETUP.md',
  'docs/HANDOFF.md',
  '.env.example',
  '.gitignore',
  'dashboard/progress.json',
];

for (const file of requiredFiles) await readFile(file, 'utf8');

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
if (Number(pkg.engines?.node?.match(/\d+/)?.[0] || 0) < 20) {
  throw new Error('package.json must require Node.js 20 or newer.');
}

const progress = JSON.parse(await readFile('dashboard/progress.json', 'utf8'));
if (!Array.isArray(progress.milestones) || progress.milestones.length === 0) {
  throw new Error('dashboard/progress.json must contain milestones.');
}
const statuses = new Set(['done', 'active', 'pending']);
const ids = new Set();
for (const milestone of progress.milestones) {
  if (!milestone.id || ids.has(milestone.id)) throw new Error('Milestone IDs must be present and unique.');
  if (!statuses.has(milestone.status)) throw new Error(`Invalid milestone status: ${milestone.status}`);
  ids.add(milestone.id);
}
if (progress.milestones.filter((item) => item.status === 'active').length > 1) {
  throw new Error('At most one milestone may be active.');
}

const example = await readFile('.env.example', 'utf8');
for (const key of ['NIMBLE_API_KEY', 'RAWTREE_API_KEY']) {
  const match = example.match(new RegExp(`^${key}=(.*)$`, 'm'));
  if (!match || match[1].trim()) throw new Error(`${key} must be present and empty in .env.example.`);
}

const ignore = await readFile('.gitignore', 'utf8');
for (const entry of ['.env', 'data/', 'archives/', '*.sqlite*']) {
  if (!ignore.split(/\r?\n/).includes(entry)) throw new Error(`.gitignore must include ${entry}`);
}

console.log(`Repository validation passed: ${progress.milestones.length} milestones, ${ids.size} unique IDs.`);
