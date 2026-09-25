import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { rehydrateAndAct } from '../src/agent/rehydrate-and-act.mjs';
import { DeterministicReevaluator } from '../src/agent/reevaluate.mjs';
import { sporeWorkingMemory } from '../src/memory/lifecycle.mjs';
import { EvidenceArchive } from '../src/storage/archive.mjs';
import { SporeDatabase } from '../src/storage/sqlite.mjs';
import { AutonomousWatcher } from '../src/watcher/watcher.mjs';

const directory = await mkdtemp(join(tmpdir(), 'spore-action-demo-'));
const database = new SporeDatabase(join(directory, 'spore.sqlite'));
const archive = new EvidenceArchive(join(directory, 'archives'));

try {
  database.createRun({ run_id: 'demo_run', goal: 'Find providers' });
  database.saveWorkingMemory({
    memory_id: 'memory_acme', run_id: 'demo_run', subject: 'Acme', token_count: 3012,
    payload: {
      requirements: [
        { attribute: 'public_api_available', operator: '==', target: true },
        { attribute: 'aws_support', operator: '==', target: true },
        { attribute: 'monthly_price', operator: '<=', target: 100 },
      ],
      observed_facts: { public_api_available: false, aws_support: true, monthly_price: 80 },
    },
  });
  await sporeWorkingMemory({
    database, archive, memory_id: 'memory_acme',
    spore: {
      spore_id: 'spore_acme', subject: 'Acme', reason_dormant: 'No public API.',
      wake_condition: { attribute: 'public_api_available', operator: '==', target: true },
      monitor_query: 'Acme developer API launch', interval_seconds: 3600,
      next_check_at: '2026-09-25T19:00:00Z', on_wake: 'reevaluate_provider',
    },
  });
  const watcher = new AutonomousWatcher({
    database,
    searchClient: {
      mode: 'historical_replay',
      async search() {
        return [{ title: 'Acme Developer API launched', description: 'Public API documentation is now available.', url: 'https://acme.example/developers' }];
      },
    },
    clock: () => new Date('2026-09-25T20:00:00Z'),
  });
  const wake = await watcher.runOnce();
  const action = await rehydrateAndAct({
    database, archive, reevaluator: new DeterministicReevaluator(), spore_id: 'spore_acme',
    fresh_evidence: wake.events[0],
    clock: () => new Date('2026-09-25T20:01:00Z'),
  });
  console.log('Evidence mode:', wake.events[0].evidence_mode);
  console.log('Lifecycle: DORMANT -> AWAKENED ->', action.action.action_type.toUpperCase());
  console.log('Decision:', action.decision);
  console.log('Shortlist:', database.listShortlist('demo_run').map((entry) => entry.subject));
} finally {
  database.close();
  await rm(directory, { recursive: true, force: true });
}
