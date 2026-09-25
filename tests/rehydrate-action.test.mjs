import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { rehydrateAndAct } from '../src/agent/rehydrate-and-act.mjs';
import { DeterministicReevaluator } from '../src/agent/reevaluate.mjs';
import { sporeWorkingMemory } from '../src/memory/lifecycle.mjs';
import { EvidenceArchive } from '../src/storage/archive.mjs';
import { SporeDatabase } from '../src/storage/sqlite.mjs';

async function setup(t) {
  const directory = await mkdtemp(join(tmpdir(), 'spore-action-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const database = new SporeDatabase(join(directory, 'spore.sqlite'));
  t.after(() => database.close());
  const archive = new EvidenceArchive(join(directory, 'archives'));
  database.createRun({ run_id: 'run_001', goal: 'Find providers', started_at: '2026-09-25T18:00:00Z' });
  database.saveWorkingMemory({
    memory_id: 'memory_acme',
    run_id: 'run_001',
    subject: 'Acme',
    payload: {
      requirements: [
        { attribute: 'public_api_available', operator: '==', target: true },
        { attribute: 'aws_support', operator: '==', target: true },
        { attribute: 'monthly_price', operator: '<=', target: 100 },
      ],
      observed_facts: { public_api_available: false, aws_support: true, monthly_price: 80 },
    },
    token_count: 3012,
    updated_at: '2026-09-25T18:00:00Z',
  });
  await sporeWorkingMemory({
    database,
    archive,
    memory_id: 'memory_acme',
    spore: {
      spore_id: 'spore_acme',
      subject: 'Acme',
      reason_dormant: 'No public API.',
      wake_condition: { attribute: 'public_api_available', operator: '==', target: true },
      monitor_query: 'Acme developer API launch',
      interval_seconds: 3600,
      next_check_at: '2026-09-25T19:00:00Z',
      on_wake: 'reevaluate_provider',
      created_at: '2026-09-25T18:00:00Z',
    },
  });
  database.awakenSpore('spore_acme', { checked_at: '2026-09-25T20:00:00Z' });
  return { database, archive };
}

test('rehydrates history, reevaluates, and adds an eligible provider to the shortlist once', async (t) => {
  const { database, archive } = await setup(t);
  const input = {
    database,
    archive,
    reevaluator: new DeterministicReevaluator(),
    spore_id: 'spore_acme',
    fresh_evidence: {
      mode: 'historical_replay',
      facts: { public_api_available: true },
      evidence_urls: ['https://acme.example/developers'],
    },
    clock: () => new Date('2026-09-25T20:01:00Z'),
  };
  const first = await rehydrateAndAct(input);
  const second = await rehydrateAndAct(input);
  assert.equal(first.decision.eligible, true);
  assert.equal(first.action.action_type, 'candidate_shortlisted');
  assert.equal(first.shortlist_entry.subject, 'Acme');
  assert.equal(database.listShortlist('run_001').length, 1);
  assert.equal(database.counts().actions, 1);
  assert.equal(database.getSpore('spore_acme').acted_at, '2026-09-25T20:01:00.000Z');
  assert.equal(second.skipped, true);
  assert.equal(database.counts().actions, 1);
});

test('does not shortlist a provider with remaining failed requirements', async (t) => {
  const { database, archive } = await setup(t);
  const result = await rehydrateAndAct({
    database,
    archive,
    reevaluator: new DeterministicReevaluator(),
    spore_id: 'spore_acme',
    fresh_evidence: { mode: 'replay', facts: { public_api_available: true, monthly_price: 140 }, evidence_urls: [] },
    clock: () => new Date('2026-09-25T20:01:00Z'),
  });
  assert.equal(result.decision.eligible, false);
  assert.equal(result.action.action_type, 'candidate_rejected');
  assert.equal(result.shortlist_entry, null);
});
