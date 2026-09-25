import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { GuidedDemoController } from '../src/demo/controller.mjs';

test('guided demo persists and exposes every lifecycle stage', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'spore-guided-demo-'));
  let tick = 0;
  const inserted = [];
  const controller = new GuidedDemoController({
    root,
    clock: () => new Date(Date.parse('2026-09-25T20:00:00Z') + tick++ * 1000),
    nimbleClient: {
      mode: 'live',
      async search() {
        return [{
          title: 'Responses API Reference',
          description: 'Official API reference documentation is available.',
          url: 'https://platform.openai.com/docs/api-reference/responses',
        }];
      },
    },
    reevaluator: {
      async reevaluate() {
        return { schema_version: 1, eligible: true, reason: 'Official API documentation is now available.' };
      },
    },
    rawtreeClient: {
      async insertEvents(events) { inserted.push(...events); return { inserted: events.length }; },
      async verifyBatch(events) { return { verified: events.every((event) => inserted.some((item) => item.event_id === event.event_id)) }; },
    },
  });
  try {
    await controller.reset();
    await controller.observe();
    let snapshot = await controller.snapshot();
    assert.equal(snapshot.stage, 1);
    assert.equal(snapshot.storage.counts.working, 1);

    await controller.classify();
    assert.equal((await controller.snapshot()).decision.decision, 'SPORE');

    await controller.sleep();
    snapshot = await controller.snapshot();
    assert.equal(snapshot.storage.counts.working, 0);
    assert.equal(snapshot.storage.spore.status, 'DORMANT');
    assert.equal(snapshot.archive.exists, true);

    await controller.wake('live');
    snapshot = await controller.snapshot();
    assert.equal(snapshot.stage, 4);
    assert.equal(snapshot.storage.spore.status, 'AWAKENED');
    assert.equal(snapshot.fresh_evidence.evidence_mode, 'live');

    await controller.rehydrate();
    assert.equal((await controller.snapshot()).rehydrated.integrity_algorithm, 'sha256');

    await controller.act();
    snapshot = await controller.snapshot();
    assert.equal(snapshot.stage, 6);
    assert.equal(snapshot.model_result.status, 'validated');
    assert.equal(snapshot.storage.counts.shortlist, 1);
    assert.equal(snapshot.storage.counts.actions, 1);

    await controller.telemetry();
    snapshot = await controller.snapshot();
    assert.equal(snapshot.stage, 7);
    assert.equal(snapshot.telemetry.complete, true);
    assert.equal(snapshot.telemetry.remote_verified, true);
    assert.equal(inserted.length, 11);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
