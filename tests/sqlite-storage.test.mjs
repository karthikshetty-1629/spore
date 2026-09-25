import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { SporeDatabase } from '../src/storage/sqlite.mjs';

const now = '2026-09-25T20:00:00Z';
const later = '2026-09-25T21:00:00Z';

async function databaseFile(t) {
  const directory = await mkdtemp(join(tmpdir(), 'spore-storage-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return join(directory, 'spore.sqlite');
}

function seed(database) {
  database.createRun({ run_id: 'run_001', goal: 'Find eligible AI infrastructure providers', started_at: now });
  database.saveWorkingMemory({
    memory_id: 'active_001',
    run_id: 'run_001',
    subject: 'Delta',
    payload: { state: 'eligible', source: 'live' },
    token_count: 42,
    updated_at: now,
  });
  database.saveDurableMemory({
    memory_id: 'durable_001',
    run_id: 'run_001',
    subject: 'Selection policy',
    payload: { requires_aws: true, maximum_monthly_price: 100 },
    updated_at: now,
  });
  database.saveSpore({
    spore_id: 'spore_001',
    run_id: 'run_001',
    subject: 'Acme',
    reason_dormant: 'No public API at evaluation time.',
    wake_condition: { attribute: 'public_api_available', operator: '==', target: true },
    monitor_query: 'Acme developer API launch',
    interval_seconds: 3600,
    next_check_at: later,
    on_wake: 'reevaluate_provider',
    confidence: 0.91,
    created_at: now,
  });
}

test('creates the versioned storage schema', () => {
  const database = new SporeDatabase();
  assert.equal(database.database.prepare('PRAGMA user_version').get().user_version, 2);
  database.close();
});

test('stores and restores every memory class across database reopening', async (t) => {
  const filename = await databaseFile(t);
  const first = new SporeDatabase(filename);
  seed(first);
  assert.deepEqual(first.counts(), { runs: 1, working: 1, durable: 1, spores: 1, shortlist: 0, actions: 0 });
  first.close();

  const reopened = new SporeDatabase(filename);
  assert.equal(reopened.getRun('run_001').goal, 'Find eligible AI infrastructure providers');
  assert.deepEqual(reopened.getWorkingMemory('active_001').payload, { state: 'eligible', source: 'live' });
  assert.deepEqual(reopened.getDurableMemory('durable_001').payload, {
    requires_aws: true,
    maximum_monthly_price: 100,
  });
  assert.deepEqual(reopened.getSpore('spore_001').wake_condition, {
    attribute: 'public_api_available',
    operator: '==',
    target: true,
  });
  reopened.close();
});

test('upserts working memory without duplicating it', () => {
  const database = new SporeDatabase();
  seed(database);
  database.saveWorkingMemory({
    memory_id: 'active_001',
    run_id: 'run_001',
    subject: 'Delta',
    payload: { state: 'shortlisted' },
    token_count: 24,
    updated_at: later,
  });
  assert.deepEqual(database.counts(), { runs: 1, working: 1, durable: 1, spores: 1, shortlist: 0, actions: 0 });
  assert.equal(database.getWorkingMemory('active_001').token_count, 24);
  assert.deepEqual(database.getWorkingMemory('active_001').payload, { state: 'shortlisted' });
  database.close();
});

test('lists only dormant spores that are due', () => {
  const database = new SporeDatabase();
  seed(database);
  assert.equal(database.listDueSpores('2026-09-25T20:59:59Z').length, 0);
  assert.equal(database.listDueSpores('2026-09-25T21:00:00Z').length, 1);
  database.close();
});

test('enforces foreign keys and bounded values', () => {
  const database = new SporeDatabase();
  assert.throws(() => database.saveWorkingMemory({
    memory_id: 'orphan',
    run_id: 'missing',
    payload: {},
  }), /FOREIGN KEY constraint failed/);
  database.createRun({ run_id: 'run_001', goal: 'Test', started_at: now });
  assert.throws(() => database.saveSpore({
    spore_id: 'bad',
    run_id: 'run_001',
    subject: 'Acme',
    reason_dormant: 'Blocked',
    wake_condition: { attribute: 'available', operator: '==', target: true },
    monitor_query: 'Acme API',
    interval_seconds: 0,
    next_check_at: later,
    on_wake: 'reevaluate',
  }), /positive integer/);
  database.close();
});
