import assert from 'node:assert/strict';
import test from 'node:test';

import { SporeDatabase } from '../src/storage/sqlite.mjs';
import { evaluateWakeCondition } from '../src/watcher/conditions.mjs';
import { AutonomousWatcher } from '../src/watcher/watcher.mjs';

const now = new Date('2026-09-25T20:00:00Z');

function databaseWithDueSpore(t) {
  const database = new SporeDatabase();
  t.after(() => database.close());
  database.createRun({ run_id: 'run_001', goal: 'Find providers', started_at: '2026-09-25T18:00:00Z' });
  database.saveSpore({
    spore_id: 'spore_acme',
    run_id: 'run_001',
    subject: 'Acme',
    reason_dormant: 'No public API.',
    wake_condition: { attribute: 'public_api_available', operator: '==', target: true },
    monitor_query: 'Acme developer API launch',
    interval_seconds: 3600,
    next_check_at: '2026-09-25T19:00:00Z',
    on_wake: 'reevaluate_provider',
    created_at: '2026-09-25T18:00:00Z',
  });
  return database;
}

function replayClient(results) {
  return { mode: 'replay', calls: 0, async search() { this.calls += 1; return results; } };
}

test('keeps a spore dormant and reschedules when the condition is false', async (t) => {
  const database = databaseWithDueSpore(t);
  const searchClient = replayClient([{
    title: 'Acme product overview',
    description: 'No public API is available.',
    url: 'https://acme.example/product',
  }]);
  const watcher = new AutonomousWatcher({ database, searchClient, clock: () => now });
  const result = await watcher.runOnce();
  assert.equal(result.events[0].type, 'wake_check_no_match');
  assert.equal(database.getSpore('spore_acme').status, 'DORMANT');
  assert.equal(database.getSpore('spore_acme').next_check_at, '2026-09-25T21:00:00.000Z');
});

test('awakens a matching spore once and preserves evidence provenance', async (t) => {
  const database = databaseWithDueSpore(t);
  const searchClient = replayClient([{
    title: 'Announcing the Acme Developer API',
    description: 'The public API is now available with complete documentation.',
    url: 'https://acme.example/developers',
  }]);
  const watcher = new AutonomousWatcher({ database, searchClient, clock: () => now });
  const first = await watcher.runOnce();
  const second = await watcher.runOnce();
  assert.equal(first.events[0].type, 'memory_awakened');
  assert.deepEqual(first.events[0].evidence_urls, ['https://acme.example/developers']);
  assert.equal(first.events[0].evidence_mode, 'replay');
  assert.equal(database.getSpore('spore_acme').status, 'AWAKENED');
  assert.equal(second.events.length, 0);
  assert.equal(searchClient.calls, 1);
});

test('supports numeric threshold conditions', () => {
  assert.deepEqual(
    evaluateWakeCondition({ attribute: 'monthly_price', operator: '<=', target: 100 }, { monthly_price: 89 }),
    { matched: true, actual: 89, reason: 'numeric threshold matched' },
  );
});

test('the scheduler invokes cycles without a manual wake action', async (t) => {
  const database = databaseWithDueSpore(t);
  const searchClient = replayClient([]);
  let scheduled;
  let cleared = false;
  const watcher = new AutonomousWatcher({
    database,
    searchClient,
    clock: () => now,
    setIntervalFn: (callback) => { scheduled = callback; return 7; },
    clearIntervalFn: (handle) => { cleared = handle === 7; },
  });
  watcher.start({ runImmediately: false });
  await scheduled();
  watcher.stop();
  assert.equal(searchClient.calls, 1);
  assert.equal(cleared, true);
});
