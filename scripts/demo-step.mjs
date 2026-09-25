import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { GuidedDemoController } from '../src/demo/controller.mjs';
import { LiquidReevaluationClient } from '../src/integrations/liquid.mjs';
import { NimbleSearchClient } from '../src/integrations/nimble.mjs';
import { RawTreeClient } from '../src/integrations/rawtree.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const text = await readFile(path.join(root, '.env'), 'utf8').catch(() => '');
const cfg = Object.fromEntries(text.split(/\r?\n/)
  .filter((line) => line.trim() && !line.trim().startsWith('#') && line.includes('='))
  .map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^(["'])(.*)\1$/, '$2')];
  }));
const action = process.argv[2];
const controller = new GuidedDemoController({
  root,
  nimbleClient: cfg.NIMBLE_API_KEY ? new NimbleSearchClient({ apiKey: cfg.NIMBLE_API_KEY }) : null,
  rawtreeClient: cfg.RAWTREE_API_KEY ? new RawTreeClient({ apiKey: cfg.RAWTREE_API_KEY, database: cfg.RAWTREE_DATABASE || 'default', baseUrl: cfg.RAWTREE_BASE_URL || 'https://api.rawtree.com' }) : null,
  reevaluator: new LiquidReevaluationClient({ baseUrl: cfg.LIQUID_BASE_URL || 'http://127.0.0.1:11434/v1', model: cfg.LIQUID_REEVALUATION_MODEL || cfg.LIQUID_MODEL, apiMode: 'ollama' }),
});
if (!action) {
  console.log(JSON.stringify(await controller.snapshot(), null, 2));
} else {
  await controller.run(action);
  const snapshot = await controller.snapshot();
  console.log(`Completed: ${action}`);
  console.log(`Stage: ${snapshot.stage}/7 · ${snapshot.status}`);
  console.log(`SQLite: ${JSON.stringify(snapshot.storage.counts)}`);
}
