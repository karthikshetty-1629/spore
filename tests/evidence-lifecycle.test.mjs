import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { sporeWorkingMemory } from '../src/memory/lifecycle.mjs';
import { EvidenceArchive } from '../src/storage/archive.mjs';
import { SporeDatabase } from '../src/storage/sqlite.mjs';

const now = '2026-09-25T20:00:00Z';

async function setup(t) {
  const directory = await mkdtemp(join(tmpdir(), 'spore-lifecycle-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const database = new SporeDatabase(join(directory, 'spore.sqlite'));
  t.after(() => database.close());
  const archive = new EvidenceArchive(join(directory, 'archives'));
  database.createRun({ run_id: 'run_001', goal: 'Find providers', started_at: now });
  database.saveWorkingMemory({
    memory_id: 'memory_acme',
    run_id: 'run_001',
    subject: 'Acme',
    payload: {
      conclusion: 'Acme fits except for the missing public API.',
      evidence: ['https://example.com/acme/product', 'https://example.com/acme/docs'],
    },
    token_count: 3012,
    updated_at: now,
  });
  return { directory, database, archive };
}

function spore(overrides = {}) {
  return {
    spore_id: 'spore_acme',
    subject: 'Acme',
    reason_dormant: 'Acme has no public API.',
    wake_condition: { attribute: 'public_api_available', operator: '==', target: true },
    monitor_query: 'Acme developer API launch',
    interval_seconds: 3600,
    next_check_at: '2026-09-25T21:00:00Z',
    on_wake: 'reevaluate_provider',
    confidence: 0.91,
    created_at: now,
    ...overrides,
  };
}

test('archives detailed evidence before removing it from working context', async (t) => {
  const { database, archive } = await setup(t);
  const result = await sporeWorkingMemory({
    database,
    archive,
    memory_id: 'memory_acme',
    spore: spore(),
  });

  assert.equal(database.getWorkingMemory('memory_acme'), null);
  assert.equal(database.getSpore('spore_acme').archive_pointer, 'spore_acme.json');
  assert.equal(result.context_removed.token_count, 3012);
  assert.ok(result.context_removed.payload_bytes > 0);
  assert.ok(result.archive.bytes > result.context_removed.payload_bytes);
  assert.equal((await archive.readEvidence('spore_acme.json')).evidence.payload.conclusion,
    'Acme fits except for the missing public API.');
});

test('restores database state and removes the archive if persistence fails', async (t) => {
  const { database, archive } = await setup(t);
  await assert.rejects(
    sporeWorkingMemory({
      database,
      archive,
      memory_id: 'memory_acme',
      spore: spore({ interval_seconds: 0 }),
    }),
    /positive integer/,
  );
  assert.ok(database.getWorkingMemory('memory_acme'));
  assert.equal(database.getSpore('spore_acme'), null);
  await assert.rejects(archive.readEvidence('spore_acme.json'), /ENOENT/);
});

test('detects an archive modified after writing', async (t) => {
  const { directory, database, archive } = await setup(t);
  await sporeWorkingMemory({ database, archive, memory_id: 'memory_acme', spore: spore() });
  const filename = join(directory, 'archives', 'spore_acme.json');
  const record = JSON.parse(await readFile(filename, 'utf8'));
  record.evidence.payload.conclusion = 'Tampered';
  await writeFile(filename, JSON.stringify(record));
  await assert.rejects(archive.readEvidence('spore_acme.json'), /integrity check failed/);
});

test('rejects archive path traversal', async (t) => {
  const { archive } = await setup(t);
  await assert.rejects(archive.readEvidence('../secret.json'), /pointer is invalid/);
});
