import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { AutonomousDemoController } from '../src/demo/autonomous-controller.mjs';
import { buildHistoricalDossier } from '../src/demo/historical-dossier.mjs';

test('historical dossier represents a meaningful amount of releasable context', () => {
  const plan = { wake_condition: { attribute: 'api_documentation_available', operator: '==', target: true } };
  const dossier = buildHistoricalDossier(plan);
  const estimatedTokens = Math.ceil(Buffer.byteLength(JSON.stringify(dossier)) / 4);
  assert.ok(estimatedTokens >= 2_000, `expected at least 2,000 estimated tokens, received ${estimatedTokens}`);
});

test('one command plans, scouts, schedules, wakes, acts, and verifies telemetry', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'spore-autonomous-'));
  let tick = 0;
  let watcherStarted = false;
  const inserted = [];
  const results = [{ title: 'Responses API reference', description: 'Official API documentation and reference.', url: 'https://developers.openai.com/api/reference/responses/' }];
  const controller = new AutonomousDemoController({
    root,
    clock: () => new Date(Date.parse('2026-09-25T20:00:00Z') + tick++ * 1000),
    nimbleClient: { mode: 'live', async search() { return results; } },
    liquidClient: {
      async planGoal({ goal }) { return { schema_version: 1, objective: goal, subject: 'OpenAI Responses API', search_queries: ['Responses API docs', 'OpenAI Responses API reference'], official_domains: ['openai.com'], wake_condition: { attribute: 'api_documentation_available', operator: '==', target: true } }; },
      async assessEvidence() { return { schema_version: 1, condition_met: true, matched_urls: [results[0].url], summary: 'Official reference found.' }; },
      async reevaluate() { return { schema_version: 1, eligible: true, reason: 'The official reference is available.' }; },
    },
    rawtreeClient: {
      async insertEvents(events) { inserted.push(...events); return { inserted: events.length }; },
      async verifyBatch(events) { return { verified: events.every((event) => inserted.some((item) => item.event_id === event.event_id)) }; },
    },
    watcherFactory(options) {
      const { onCycle, onError } = options;
      return {
        start() {
          watcherStarted = true;
          import('../src/watcher/watcher.mjs').then(({ AutonomousWatcher }) => new AutonomousWatcher(options).runOnce()).then(onCycle).catch(onError);
        },
        stop() {},
      };
    },
  });
  try {
    await controller.run('Monitor the OpenAI Responses API and shortlist it when official API reference documentation is available.');
    const snapshot = await controller.snapshot();
    assert.equal(watcherStarted, true);
    assert.equal(snapshot.status, 'complete');
    assert.equal(snapshot.storage.spore.status, 'AWAKENED');
    assert.equal(snapshot.storage.counts.shortlist, 1);
    assert.equal(snapshot.telemetry.remote_verified, true);
    assert.ok(snapshot.archive.tokens_removed >= 2_000);
    assert.equal(snapshot.evidence_assessment.provenance_guard, true);
    assert.ok(snapshot.phases.every((phase) => phase.status === 'complete'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
