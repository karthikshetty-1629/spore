import assert from 'node:assert/strict';
import test from 'node:test';

import { createLifecycleEvent } from '../src/telemetry/events.mjs';
import { summarizeLifecycle } from '../src/telemetry/metrics.mjs';

test('lifecycle events use a stable RawTree-friendly shape', () => {
  const event = createLifecycleEvent({
    event_id: 'event_1', event_type: 'context_released', run_id: 'run_1',
    spore_id: 'spore_1', active_tokens_removed: 250, archive_bytes: 1000,
    compact_spore_bytes: 200, is_test: true, timestamp: '2026-09-25T20:00:00Z',
    details: { reason: 'sleeping' },
  });
  assert.equal(event.schema_version, 1);
  assert.equal(event.details_json, '{"reason":"sleeping"}');
  assert.equal(event.subject, '');
  assert.equal(event.source_count, 0);
});

test('lifecycle event validation rejects unknown types and negative metrics', () => {
  assert.throws(() => createLifecycleEvent({ event_type: 'invented', run_id: 'run_1' }), /unsupported/);
  assert.throws(() => createLifecycleEvent({
    event_type: 'run_started', run_id: 'run_1', active_tokens_removed: -1,
  }), /non-negative/);
});

test('summary derives completion and reduction from actual events', () => {
  const types = [
    'run_started', 'observation_created', 'memory_classified', 'memory_spored',
    'context_released', 'wake_check_started', 'memory_awakened',
    'memory_rehydrated', 'candidate_reevaluated', 'agent_action_completed', 'run_completed',
  ];
  const events = types.map((event_type) => createLifecycleEvent({
    event_type, run_id: 'run_1', is_test: true,
    ...(event_type === 'context_released'
      ? { active_tokens_removed: 3000, archive_bytes: 1000, compact_spore_bytes: 250 }
      : {}),
  }));
  const summary = summarizeLifecycle(events, { remote_verified: true });
  assert.equal(summary.complete, true);
  assert.equal(summary.event_count, 11);
  assert.equal(summary.active_tokens_removed, 3000);
  assert.equal(summary.payload_reduction_percent, 75);
  assert.equal(summary.remote_verified, true);
});
