import { SporeDatabase } from '../src/storage/sqlite.mjs';
import { AutonomousWatcher } from '../src/watcher/watcher.mjs';

const database = new SporeDatabase();
database.createRun({ run_id: 'demo_run', goal: 'Find providers' });
database.saveSpore({
  spore_id: 'spore_acme',
  run_id: 'demo_run',
  subject: 'Acme',
  reason_dormant: 'No public API.',
  wake_condition: { attribute: 'public_api_available', operator: '==', target: true },
  monitor_query: 'Acme developer API launch',
  interval_seconds: 3600,
  next_check_at: '2026-09-25T19:00:00Z',
  on_wake: 'reevaluate_provider',
});

const replaySearch = {
  mode: 'historical_replay',
  async search() {
    return [{
      title: 'Announcing the Acme Developer API',
      description: 'The public API is now available with documentation.',
      url: 'https://acme.example/developers',
    }];
  },
};

const watcher = new AutonomousWatcher({
  database,
  searchClient: replaySearch,
  clock: () => new Date('2026-09-25T20:00:00Z'),
});
console.log('Evidence mode: historical replay (no Nimble credits used)');
console.log('Before:', database.getSpore('spore_acme').status);
const result = await watcher.runOnce();
console.log('Event: ', result.events[0]);
console.log('After: ', database.getSpore('spore_acme').status);
database.close();
