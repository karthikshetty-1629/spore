export function summarizeLifecycle(events, { remote_verified = false } = {}) {
  if (!Array.isArray(events)) throw new TypeError('events must be an array');
  const counts = {};
  for (const event of events) counts[event.event_type] = (counts[event.event_type] || 0) + 1;

  const total = (field) => events.reduce((sum, event) => sum + Number(event[field] || 0), 0);
  const archiveBytes = total('archive_bytes');
  const compactBytes = total('compact_spore_bytes');
  const required = [
    'run_started', 'observation_created', 'memory_classified', 'memory_spored',
    'context_released', 'wake_check_started', 'memory_awakened',
    'memory_rehydrated', 'candidate_reevaluated', 'agent_action_completed', 'run_completed',
  ];

  return {
    generated_at: new Date().toISOString(),
    run_id: events[0]?.run_id || '',
    evidence_mode: events[0]?.evidence_mode || 'unknown',
    is_test: events.length > 0 && events.every((event) => event.is_test === true),
    complete: required.every((type) => counts[type] > 0),
    remote_verified,
    event_count: events.length,
    counts,
    active_tokens_removed: total('active_tokens_removed'),
    archive_bytes: archiveBytes,
    compact_spore_bytes: compactBytes,
    payload_reduction_percent: archiveBytes > 0
      ? Math.max(0, Math.round((1 - compactBytes / archiveBytes) * 1000) / 10)
      : 0,
    source_count: total('source_count'),
  };
}
