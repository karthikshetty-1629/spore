import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { sporeWorkingMemory } from '../src/memory/lifecycle.mjs';
import { EvidenceArchive } from '../src/storage/archive.mjs';
import { SporeDatabase } from '../src/storage/sqlite.mjs';

const directory = await mkdtemp(join(tmpdir(), 'spore-demo-'));
const database = new SporeDatabase(join(directory, 'spore.sqlite'));
const archive = new EvidenceArchive(join(directory, 'archives'));

try {
  database.createRun({ run_id: 'demo_run', goal: 'Find eligible AI infrastructure providers' });
  database.saveWorkingMemory({
    memory_id: 'memory_acme',
    run_id: 'demo_run',
    subject: 'Acme',
    payload: {
      summary: 'Acme fits every requirement except public API availability.',
      source_urls: ['https://example.com/acme/docs'],
    },
    token_count: 3012,
  });

  console.log('Before:', database.counts());
  const result = await sporeWorkingMemory({
    database,
    archive,
    memory_id: 'memory_acme',
    spore: {
      spore_id: 'spore_acme',
      subject: 'Acme',
      reason_dormant: 'No public API is currently available.',
      wake_condition: { attribute: 'public_api_available', operator: '==', target: true },
      monitor_query: 'Acme developer API launch',
      interval_seconds: 3600,
      next_check_at: new Date(Date.now() + 3600_000).toISOString(),
      on_wake: 'reevaluate_provider',
      confidence: 0.91,
    },
  });
  console.log('After: ', database.counts());
  console.log('Removed from working context:', result.context_removed);
  console.log('Archive pointer:', result.archive.pointer);
  console.log('Dormant state:', result.spore.status);
} finally {
  database.close();
  await rm(directory, { recursive: true, force: true });
}
