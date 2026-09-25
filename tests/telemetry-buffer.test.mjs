import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { BufferedTelemetrySink } from '../src/telemetry/sink.mjs';

test('telemetry remains buffered after failure and flushes on retry', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'spore-buffer-test-'));
  const bufferPath = path.join(directory, 'pending.json');
  let fail = true;
  const delivered = [];
  const sink = new BufferedTelemetrySink({
    bufferPath,
    client: {
      async insertEvents(events) {
        if (fail) throw new Error('offline');
        delivered.push(...events);
        return { inserted: events.length };
      },
    },
  });
  try {
    const first = await sink.emitMany([{ event_id: 'event_1' }]);
    assert.deepEqual(first, { delivered: false, count: 0, pending: 1, error: 'offline' });
    assert.equal(JSON.parse(await readFile(bufferPath, 'utf8')).length, 1);
    fail = false;
    const second = await sink.flush();
    assert.deepEqual(second, { delivered: true, count: 1, pending: 0 });
    assert.equal(delivered[0].event_id, 'event_1');
    assert.deepEqual(JSON.parse(await readFile(bufferPath, 'utf8')), []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
