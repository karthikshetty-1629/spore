import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { RawTreeClient } from '../src/integrations/rawtree.mjs';
import { summarizeLifecycle } from '../src/telemetry/metrics.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const text = await readFile(path.join(root, '.env'), 'utf8');
const cfg = Object.fromEntries(text.split(/\r?\n/)
  .filter((line) => line.trim() && !line.trim().startsWith('#') && line.includes('='))
  .map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^(["'])(.*)\1$/, '$2')];
  }));
const client = new RawTreeClient({
  apiKey: cfg.RAWTREE_API_KEY,
  database: cfg.RAWTREE_DATABASE || 'default',
  baseUrl: cfg.RAWTREE_BASE_URL || 'https://api.rawtree.com',
});
const response = await client.readLatest();
if (!Array.isArray(response.data) || response.data.length === 0) throw new Error('RawTree returned no lifecycle events');
const runId = response.data[0].run_id;
const events = response.data.filter((event) => event.run_id === runId);
const summary = summarizeLifecycle(events, { remote_verified: true });
if (!summary.complete) throw new Error(`Latest RawTree run is incomplete: ${runId}`);
await mkdir(path.join(root, 'data'), { recursive: true });
await writeFile(path.join(root, 'data/telemetry-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(`Verified RawTree run: ${runId}`);
console.log(`Lifecycle events read back: ${summary.event_count}`);
