import assert from 'node:assert/strict';
import test from 'node:test';

import { RawTreeClient } from '../src/integrations/rawtree.mjs';

test('RawTree adapter batches events and verifies them by run', async () => {
  const calls = [];
  const events = [
    { event_id: 'event_1', run_id: 'run_1' },
    { event_id: 'event_2', run_id: 'run_1' },
  ];
  const client = new RawTreeClient({
    apiKey: 'secret',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      const body = JSON.parse(options.body);
      return {
        ok: true,
        async json() {
          return Array.isArray(body) ? { inserted: body.length } : { rows: events };
        },
      };
    },
  });
  assert.equal((await client.insertEvents(events)).inserted, 2);
  assert.equal((await client.verifyBatch(events)).verified, true);
  assert.match(calls[0].url, /spore_karthik_lifecycle_events_v1/);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer secret');
  assert.match(JSON.parse(calls[1].options.body).sql, /run_id = 'run_1'/);
});

test('RawTree adapter refuses unsafe SQL values', async () => {
  const client = new RawTreeClient({ apiKey: 'secret', fetchImpl: async () => assert.fail('should not fetch') });
  await assert.rejects(() => client.readRun("run_1'; DROP TABLE x;--"), /invalid/);
});
