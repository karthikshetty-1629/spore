import { SporeDatabase } from '../src/storage/sqlite.mjs';

const database = new SporeDatabase();
database.createRun({
  run_id: 'demo_run',
  goal: 'Find AI infrastructure providers with public APIs.',
});
database.saveWorkingMemory({
  memory_id: 'active_delta',
  run_id: 'demo_run',
  subject: 'Delta',
  payload: { status: 'eligible' },
  token_count: 38,
});
database.saveDurableMemory({
  memory_id: 'rule_api',
  run_id: 'demo_run',
  subject: 'Selection policy',
  payload: { public_api_required: true },
});
database.saveSpore({
  spore_id: 'spore_acme',
  run_id: 'demo_run',
  subject: 'Acme',
  reason_dormant: 'Acme has no public API.',
  wake_condition: { attribute: 'public_api_available', operator: '==', target: true },
  monitor_query: 'Acme developer API launch',
  interval_seconds: 3600,
  next_check_at: new Date(Date.now() + 3600_000).toISOString(),
  on_wake: 'reevaluate_provider',
  confidence: 0.91,
});

console.table(database.counts());
console.log('\nStored SPORE:');
console.log(JSON.stringify(database.getSpore('spore_acme'), null, 2));
database.close();
