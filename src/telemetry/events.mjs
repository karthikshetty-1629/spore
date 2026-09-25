import { randomUUID } from 'node:crypto';

export const LIFECYCLE_EVENT_TYPES = new Set([
  'run_started',
  'observation_created',
  'memory_classified',
  'memory_spored',
  'context_released',
  'wake_check_started',
  'wake_check_no_match',
  'wake_check_failed',
  'memory_awakened',
  'memory_rehydrated',
  'candidate_reevaluated',
  'agent_action_completed',
  'run_completed',
  'run_failed',
]);

function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value;
}

function nonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}

export function createLifecycleEvent({
  event_id = randomUUID(),
  event_type,
  run_id,
  spore_id = '',
  subject = '',
  evidence_mode = 'local',
  is_test = false,
  successful = true,
  timestamp = new Date().toISOString(),
  active_tokens_removed = 0,
  archive_bytes = 0,
  compact_spore_bytes = 0,
  latency_ms = 0,
  source_count = 0,
  details = {},
}) {
  if (!LIFECYCLE_EVENT_TYPES.has(event_type)) throw new TypeError(`unsupported event_type: ${event_type}`);
  if (Number.isNaN(Date.parse(timestamp))) throw new TypeError('timestamp must be ISO-compatible');
  if (typeof is_test !== 'boolean' || typeof successful !== 'boolean') {
    throw new TypeError('is_test and successful must be booleans');
  }
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    throw new TypeError('details must be an object');
  }

  return {
    event_id: requiredString(event_id, 'event_id'),
    project: 'spore',
    schema_version: 1,
    run_id: requiredString(run_id, 'run_id'),
    spore_id: typeof spore_id === 'string' ? spore_id : '',
    event_type,
    subject: typeof subject === 'string' ? subject : '',
    evidence_mode: requiredString(evidence_mode, 'evidence_mode'),
    is_test,
    successful,
    timestamp: new Date(timestamp).toISOString(),
    active_tokens_removed: nonNegativeInteger(active_tokens_removed, 'active_tokens_removed'),
    archive_bytes: nonNegativeInteger(archive_bytes, 'archive_bytes'),
    compact_spore_bytes: nonNegativeInteger(compact_spore_bytes, 'compact_spore_bytes'),
    latency_ms: nonNegativeInteger(latency_ms, 'latency_ms'),
    source_count: nonNegativeInteger(source_count, 'source_count'),
    details_json: JSON.stringify(details),
  };
}
