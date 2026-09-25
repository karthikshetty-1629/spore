import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { rehydrateAndAct } from '../src/agent/rehydrate-and-act.mjs';
import { DeterministicReevaluator } from '../src/agent/reevaluate.mjs';
import { RawTreeClient } from '../src/integrations/rawtree.mjs';
import { sporeWorkingMemory } from '../src/memory/lifecycle.mjs';
import { EvidenceArchive } from '../src/storage/archive.mjs';
import { SporeDatabase } from '../src/storage/sqlite.mjs';
import { createLifecycleEvent } from '../src/telemetry/events.mjs';
import { summarizeLifecycle } from '../src/telemetry/metrics.mjs';
import { BufferedTelemetrySink } from '../src/telemetry/sink.mjs';
import { AutonomousWatcher } from '../src/watcher/watcher.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const live = process.argv.includes('--live');
const directory = await mkdtemp(path.join(tmpdir(), 'spore-telemetry-demo-'));
const database = new SporeDatabase(path.join(directory, 'spore.sqlite'));
const archive = new EvidenceArchive(path.join(directory, 'archives'));
const runId = `telemetry_${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
const sporeId = `spore_${runId}`;
const events = [];
let eventOffset = 0;

function envFrom(text) {
  return Object.fromEntries(text.split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^(["'])(.*)\1$/, '$2')];
    }));
}

function record(event_type, fields = {}) {
  const timestamp = new Date(Date.now() + eventOffset).toISOString();
  eventOffset += 1;
  events.push(createLifecycleEvent({
    event_type,
    run_id: runId,
    spore_id: fields.spore_id ?? '',
    subject: fields.subject ?? '',
    evidence_mode: 'historical_replay',
    is_test: true,
    timestamp,
    ...fields,
  }));
}

try {
  const subject = 'Acme';
  const payload = {
    requirements: [
      { attribute: 'public_api_available', operator: '==', target: true },
      { attribute: 'aws_support', operator: '==', target: true },
      { attribute: 'monthly_price', operator: '<=', target: 100 },
    ],
    observed_facts: { public_api_available: false, aws_support: true, monthly_price: 80 },
    sources: ['https://acme.example/product', 'https://acme.example/pricing'],
    research_notes: 'Representative replay evidence retained to prove context restoration.',
  };

  database.createRun({ run_id: runId, goal: 'Find providers with a public API' });
  record('run_started', { details: { goal: 'Find providers with a public API' } });
  database.saveWorkingMemory({
    memory_id: 'memory_acme', run_id: runId, subject, token_count: 3012, payload,
  });
  record('observation_created', { subject, source_count: payload.sources.length });
  record('memory_classified', { subject, details: { memory_class: 'SPORE', reason: 'Public API unavailable.' } });

  const dormant = await sporeWorkingMemory({
    database, archive, memory_id: 'memory_acme',
    spore: {
      spore_id: sporeId, subject, reason_dormant: 'No public API.',
      wake_condition: { attribute: 'public_api_available', operator: '==', target: true },
      monitor_query: 'Acme developer API launch', interval_seconds: 3600,
      next_check_at: new Date(Date.now() - 1000).toISOString(), on_wake: 'reevaluate_provider',
    },
  });
  record('memory_spored', { spore_id: sporeId, subject, details: { wake_attribute: 'public_api_available' } });
  record('context_released', {
    spore_id: sporeId,
    subject,
    active_tokens_removed: dormant.context_removed.token_count,
    archive_bytes: dormant.archive.bytes,
    compact_spore_bytes: dormant.compact_spore_bytes,
  });

  record('wake_check_started', { spore_id: sporeId, subject });
  const wakeStarted = performance.now();
  const watcher = new AutonomousWatcher({
    database,
    searchClient: {
      mode: 'historical_replay',
      async search() {
        return [{
          title: 'Acme Developer API launched',
          description: 'Public API documentation is now available.',
          url: 'https://acme.example/developers',
        }];
      },
    },
  });
  const wake = await watcher.runOnce();
  const wakeEvent = wake.events[0];
  record('memory_awakened', {
    spore_id: sporeId,
    subject,
    latency_ms: Math.round(performance.now() - wakeStarted),
    source_count: wakeEvent.evidence_urls.length,
    details: { facts: wakeEvent.facts, evidence_urls: wakeEvent.evidence_urls },
  });

  record('memory_rehydrated', { spore_id: sporeId, subject, details: { archive_pointer: dormant.archive.pointer } });
  const actionStarted = performance.now();
  const action = await rehydrateAndAct({
    database,
    archive,
    reevaluator: new DeterministicReevaluator(),
    spore_id: sporeId,
    fresh_evidence: wakeEvent,
  });
  const actionLatency = Math.round(performance.now() - actionStarted);
  record('candidate_reevaluated', {
    spore_id: sporeId, subject, latency_ms: actionLatency,
    details: { eligible: action.decision.eligible, reason: action.decision.reason },
  });
  record('agent_action_completed', {
    spore_id: sporeId, subject, latency_ms: actionLatency,
    details: { action_type: action.action.action_type },
  });
  record('run_completed', { details: { shortlist_size: database.listShortlist(runId).length } });

  let remoteVerified = false;
  if (live) {
    const cfg = envFrom(await readFile(path.join(root, '.env'), 'utf8'));
    const client = new RawTreeClient({
      apiKey: cfg.RAWTREE_API_KEY,
      database: cfg.RAWTREE_DATABASE || 'default',
      baseUrl: cfg.RAWTREE_BASE_URL || 'https://api.rawtree.com',
    });
    const sink = new BufferedTelemetrySink({
      client,
      bufferPath: path.join(root, 'data/telemetry-pending.json'),
    });
    const delivery = await sink.emitMany(events);
    if (!delivery.delivered) throw new Error(`telemetry remains buffered: ${delivery.error}`);
    let verification = { verified: false };
    for (let attempt = 0; attempt < 4 && !verification.verified; attempt += 1) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 500));
      verification = await client.verifyBatch(events);
    }
    if (!verification.verified) throw new Error('RawTree read-back did not contain the complete event batch');
    remoteVerified = true;
  }

  const summary = summarizeLifecycle(events, { remote_verified: remoteVerified });
  await mkdir(path.join(root, 'data'), { recursive: true });
  await writeFile(path.join(root, 'data/telemetry-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`Lifecycle events: ${summary.event_count}`);
  console.log(`Working tokens released: ${summary.active_tokens_removed}`);
  console.log(`Payload reduction: ${summary.payload_reduction_percent}%`);
  console.log(`RawTree verified: ${summary.remote_verified ? 'yes' : 'not requested'}`);
} finally {
  database.close();
  await rm(directory, { recursive: true, force: true });
}
