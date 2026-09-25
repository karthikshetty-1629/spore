import { mkdir, readFile, writeFile } from 'node:fs/promises';

const state = JSON.parse(await readFile('data/spore-autonomous-state.json', 'utf8'));
if (state.status !== 'complete' || !state.telemetry?.remote_verified) {
  throw new Error('A complete autonomous run with RawTree read-back is required before publishing.');
}

const publicRun = {
  generated_at: new Date().toISOString(), status: state.status, goal: state.goal, run_id: state.run_id,
  started_at: state.started_at, completed_at: state.completed_at, phases: state.phases, timeline: state.timeline,
  plan: state.plan, search_results: state.search_results, evidence_assessment: state.evidence_assessment,
  archive: state.archive, action: state.action, model_result: state.model_result, telemetry: state.telemetry,
  links: {
    repository: 'https://github.com/karthikshetty-1629/spore',
    liquid: 'https://huggingface.co/LiquidAI/LFM2.5-8B-A1B-GGUF',
    nimble: 'https://docs.nimbleway.com/', rawtree: 'https://rawtree.com/', event: 'https://tokensand.com/horizonagentshack',
  },
};
await mkdir('docs', { recursive: true });
await writeFile('docs/run.json', `${JSON.stringify(publicRun, null, 2)}\n`);
await writeFile('docs/.nojekyll', '');
console.log(`Public proof generated for ${state.run_id}: ${state.telemetry.event_count} verified events.`);
