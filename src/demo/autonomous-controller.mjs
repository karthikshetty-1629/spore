import { access, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { rehydrateAndAct } from '../agent/rehydrate-and-act.mjs';
import { DeterministicReevaluator } from '../agent/reevaluate.mjs';
import { evaluateObservation } from '../memory/gate.mjs';
import { sporeWorkingMemory } from '../memory/lifecycle.mjs';
import { EvidenceArchive } from '../storage/archive.mjs';
import { SporeDatabase } from '../storage/sqlite.mjs';
import { createLifecycleEvent } from '../telemetry/events.mjs';
import { summarizeLifecycle } from '../telemetry/metrics.mjs';
import { BufferedTelemetrySink } from '../telemetry/sink.mjs';
import { AutonomousWatcher } from '../watcher/watcher.mjs';

const DEFAULT_GOAL = 'Monitor the OpenAI Responses API and shortlist it when official API reference documentation is available.';
const MEMORY_ID = 'memory_responses_api_checkpoint';
const SPORE_ID = 'spore_responses_api_docs';
const HISTORICAL_DATE = '2025-02-01';

const PHASES = [
  ['plan', 'Liquid AI', 'Plan the goal'],
  ['checkpoint', 'SQLite', 'Load historical checkpoint'],
  ['classify', 'SPORE gate', 'Classify memory'],
  ['sleep', 'Archive + SQLite', 'Archive and release context'],
  ['watch', 'Scheduler', 'Start background watcher'],
  ['scout', 'Nimble + Liquid AI', 'Research and assess live evidence'],
  ['rehydrate', 'Archive', 'Restore historical context'],
  ['act', 'Liquid AI + guard', 'Decide and update shortlist'],
  ['telemetry', 'RawTree', 'Publish and verify proof'],
];

function freshState() {
  return {
    version: 1, status: 'idle', phase: 'idle', goal: DEFAULT_GOAL, run_id: '',
    started_at: null, completed_at: null, error: null, plan: null, decision: null,
    search_results: [], evidence_assessment: null, fresh_evidence: null,
    archive: null, rehydrated: null, action: null, model_result: null, telemetry: null,
    events: [], timeline: [], phases: PHASES.map(([id, tool, title]) => ({ id, tool, title, status: 'pending' })),
    updated_at: new Date().toISOString(),
  };
}

function estimateTokens(value) {
  return Math.ceil(Buffer.byteLength(JSON.stringify(value)) / 4);
}

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

function validateGoal(goal) {
  if (typeof goal !== 'string' || goal.trim().length < 20 || goal.length > 500) {
    throw new TypeError('Enter a clear goal between 20 and 500 characters.');
  }
  return goal.trim();
}

export class AutonomousDemoController {
  constructor({ root, nimbleClient, rawtreeClient, liquidClient, clock = () => new Date(), watcherFactory = (options) => new AutonomousWatcher(options) }) {
    this.root = root;
    this.nimbleClient = nimbleClient;
    this.rawtreeClient = rawtreeClient;
    this.liquidClient = liquidClient;
    this.clock = clock;
    this.watcherFactory = watcherFactory;
    this.databasePath = path.join(root, 'data/spore-autonomous.sqlite');
    this.archivePath = path.join(root, 'data/spore-autonomous-archives');
    this.statePath = path.join(root, 'data/spore-autonomous-state.json');
    this.pendingPath = path.join(root, 'data/spore-autonomous-telemetry-pending.json');
  }

  async readState() {
    try { return JSON.parse(await readFile(this.statePath, 'utf8')); } catch { return freshState(); }
  }

  async writeState(state) {
    state.updated_at = this.clock().toISOString();
    await mkdir(path.dirname(this.statePath), { recursive: true });
    const temporary = `${this.statePath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`);
    await rename(temporary, this.statePath);
    return state;
  }

  async reset() {
    await Promise.all([
      rm(this.databasePath, { force: true }), rm(`${this.databasePath}-shm`, { force: true }),
      rm(`${this.databasePath}-wal`, { force: true }), rm(this.archivePath, { recursive: true, force: true }),
      rm(this.pendingPath, { force: true }),
    ]);
    return this.writeState(freshState());
  }

  async phase(state, id, status, detail = '') {
    state.phase = id;
    const item = state.phases.find((candidate) => candidate.id === id);
    if (item) item.status = status;
    if (detail) state.timeline.unshift({ phase: id, tool: item?.tool || '', detail, timestamp: this.clock().toISOString() });
    await this.writeState(state);
  }

  record(state, event_type, fields = {}) {
    state.events.push(createLifecycleEvent({
      event_type, run_id: state.run_id, spore_id: fields.spore_id || '', subject: fields.subject || '',
      evidence_mode: fields.evidence_mode || 'live', is_test: false, timestamp: this.clock().toISOString(), ...fields,
    }));
  }

  async run(goal = DEFAULT_GOAL) {
    if (!this.nimbleClient) throw new Error('Nimble is not configured.');
    if (!this.rawtreeClient) throw new Error('RawTree is not configured.');
    if (!this.liquidClient) throw new Error('Liquid AI is not configured.');
    goal = validateGoal(goal);
    if (goal !== DEFAULT_GOAL) throw new Error('This verified demo is scoped to the OpenAI Responses API objective.');
    await this.reset();
    const state = freshState();
    state.status = 'running'; state.goal = goal; state.started_at = this.clock().toISOString();
    state.run_id = `auto_${this.clock().toISOString().replace(/\D/g, '').slice(0, 14)}`;
    await this.writeState(state);

    const database = new SporeDatabase(this.databasePath);
    const archive = new EvidenceArchive(this.archivePath);
    try {
      database.createRun({ run_id: state.run_id, goal, started_at: state.started_at });
      this.record(state, 'run_started', { details: { goal, mode: 'single_command_autonomous' } });

      await this.phase(state, 'plan', 'running', 'Liquid is converting the goal into a bounded research plan.');
      const plan = await this.liquidClient.planGoal({ goal });
      if (!plan.official_domains.every((domain) => domain === 'openai.com' || domain.endsWith('.openai.com'))) {
        throw new Error('The plan failed the official OpenAI domain policy.');
      }
      plan.official_domains = ['openai.com'];
      state.plan = plan;
      await this.phase(state, 'plan', 'complete', `Liquid created ${plan.search_queries.length} research queries and a typed wake condition.`);

      await this.phase(state, 'checkpoint', 'running', `Loading the dated ${HISTORICAL_DATE} checkpoint.`);
      const payload = {
        scenario: 'Time-compressed audit of a real product transition. The checkpoint predates the public launch of the Responses API; the watcher evaluates present-day official evidence.',
        historical_checkpoint: { date: HISTORICAL_DATE, evidence_mode: 'historical_checkpoint', api_documentation_available: false },
        requirements: [plan.wake_condition], observed_facts: { api_documentation_available: false },
        research_plan: plan, research_notes: ['Preserve the dated rationale outside active context.', 'Wake only from current official-domain evidence.', 'On wake, restore the checkpoint and independently reevaluate eligibility.'],
        source_urls: ['https://openai.com/index/new-tools-for-building-agents/'],
      };
      const tokenCount = estimateTokens(payload);
      database.saveWorkingMemory({ memory_id: MEMORY_ID, run_id: state.run_id, subject: plan.subject, payload, token_count: tokenCount, updated_at: this.clock().toISOString() });
      this.record(state, 'observation_created', { subject: plan.subject, evidence_mode: 'historical_checkpoint', source_count: 1, details: { checkpoint_date: HISTORICAL_DATE, token_count: tokenCount } });
      await this.phase(state, 'checkpoint', 'complete', `SQLite stored the dated checkpoint as ${tokenCount} estimated working tokens.`);

      await this.phase(state, 'classify', 'running', 'The validated memory policy is deciding what should remain active.');
      state.decision = evaluateObservation({
        scope: 'candidate_evaluation', subject: plan.subject, is_duplicate: false, is_relevant: true, is_complete: true,
        currently_needed: false, eligible: false,
        blocker: { changeable: true, reason: `Official API documentation was unavailable at the ${HISTORICAL_DATE} checkpoint.` },
        wake_condition: plan.wake_condition, raw_text: 'Reevaluate when current official documentation proves the blocker has changed.',
        source_urls: payload.source_urls, observed_at: `${HISTORICAL_DATE}T12:00:00.000Z`,
      });
      this.record(state, 'memory_classified', { subject: plan.subject, evidence_mode: 'historical_checkpoint', details: state.decision });
      await this.phase(state, 'classify', 'complete', `The policy classified the checkpoint as ${state.decision.decision}.`);

      await this.phase(state, 'sleep', 'running', 'Archiving detailed context and creating a compact scheduled memory.');
      const sleep = await sporeWorkingMemory({ database, archive, memory_id: MEMORY_ID, spore: {
        spore_id: SPORE_ID, subject: plan.subject, reason_dormant: state.decision.reason,
        wake_condition: plan.wake_condition, monitor_query: plan.search_queries[0], interval_seconds: 86400,
        next_check_at: new Date(this.clock().getTime() - 1000).toISOString(), on_wake: 'reevaluate_provider', confidence: 1,
        created_at: this.clock().toISOString(),
      } });
      state.archive = { pointer: sleep.archive.pointer, bytes: sleep.archive.bytes, digest: sleep.archive.digest, tokens_removed: sleep.context_removed.token_count, compact_spore_bytes: sleep.compact_spore_bytes };
      this.record(state, 'memory_spored', { spore_id: SPORE_ID, subject: plan.subject, evidence_mode: 'historical_checkpoint', details: { wake_condition: plan.wake_condition } });
      this.record(state, 'context_released', { spore_id: SPORE_ID, subject: plan.subject, evidence_mode: 'historical_checkpoint', active_tokens_removed: sleep.context_removed.token_count, archive_bytes: sleep.archive.bytes, compact_spore_bytes: sleep.compact_spore_bytes });
      await this.phase(state, 'sleep', 'complete', 'The working-memory row was removed only after the checksum-protected archive was saved.');

      await this.phase(state, 'watch', 'running', 'The scheduler is starting itself; no wake button is involved.');
      this.record(state, 'wake_check_started', { spore_id: SPORE_ID, subject: plan.subject, details: { trigger: 'AutonomousWatcher.start', query_count: plan.search_queries.length } });
      const multiQueryScout = {
        mode: 'live',
        search: async () => {
          await this.phase(state, 'scout', 'running', `Nimble is running ${plan.search_queries.length} live searches.`);
          const batches = [];
          for (const query of plan.search_queries) {
            const results = await this.nimbleClient.search({ query, maxResults: 4, searchDepth: 'lite' });
            batches.push(...results.map((result) => ({ ...result, query })));
          }
          const unique = [...new Map(batches.map((result) => [result.url, result])).values()];
          state.search_results = unique;
          await this.writeState(state);
          return unique;
        },
      };
      let settleCycle;
      let rejectCycle;
      const cycle = new Promise((resolve, reject) => { settleCycle = resolve; rejectCycle = reject; });
      const watcher = this.watcherFactory({
        database, searchClient: multiQueryScout, cadenceMs: 60_000, clock: this.clock,
        extractFacts: async (spore, results) => {
          const assessment = await this.liquidClient.assessEvidence({ plan, results });
          const matching = results.filter((result) => assessment.matched_urls.includes(result.url)
            && /responses/i.test(`${result.title} ${result.description} ${result.url}`)
            && /api|reference|documentation|docs/i.test(`${result.title} ${result.description} ${result.url}`));
          state.evidence_assessment = { ...assessment, provenance_guard: matching.length > 0, official_sources: matching.map((item) => item.url) };
          await this.phase(state, 'scout', 'complete', `Liquid analyzed ${results.length} results; the source guard accepted ${matching.length} official result(s).`);
          return { facts: { [spore.wake_condition.attribute]: assessment.condition_met && matching.length > 0 }, evidence_urls: matching.map((item) => item.url) };
        },
        onCycle: settleCycle, onError: rejectCycle,
      });
      watcher.start({ runImmediately: true });
      await this.phase(state, 'watch', 'complete', 'AutonomousWatcher.start() is active and immediately ran the due check.');
      let timeoutHandle;
      const timeout = new Promise((_, reject) => { timeoutHandle = setTimeout(() => reject(new Error('The autonomous watch cycle timed out.')), 180_000); });
      const cycleResult = await Promise.race([cycle, timeout]);
      clearTimeout(timeoutHandle);
      watcher.stop();
      const wake = cycleResult.events[0];
      if (!wake) throw new Error('The scheduler completed without a due memory.');
      if (wake.type === 'wake_check_failed') throw new Error(`The autonomous watcher failed safely: ${wake.error}`);
      if (wake.type !== 'memory_awakened') throw new Error('No current official source satisfied the wake condition. The memory remains dormant.');
      state.fresh_evidence = wake;
      this.record(state, 'memory_awakened', { spore_id: SPORE_ID, subject: plan.subject, source_count: wake.evidence_urls.length, details: { facts: wake.facts, evidence_urls: wake.evidence_urls, evaluation: wake.evaluation } });
      await this.writeState(state);

      await this.phase(state, 'rehydrate', 'running', 'Verifying archive integrity and restoring the dated rationale.');
      const archived = await archive.readEvidence(sleep.archive.pointer);
      state.rehydrated = { integrity: archived.integrity.algorithm, historical_checkpoint: archived.evidence.payload.historical_checkpoint, fresh_facts: wake.facts };
      this.record(state, 'memory_rehydrated', { spore_id: SPORE_ID, subject: plan.subject, details: { archive_pointer: sleep.archive.pointer, integrity_verified: true } });
      await this.phase(state, 'rehydrate', 'complete', 'The SHA-256 checksum passed and historical plus fresh context was reconstructed.');

      await this.phase(state, 'act', 'running', 'Liquid is deciding the action from restored context; the deterministic guard will fail closed on disagreement.');
      const safe = new DeterministicReevaluator();
      let modelOutput = null;
      const guardedReevaluator = { reevaluate: async (context) => {
        modelOutput = await this.liquidClient.reevaluate(context);
        const expected = await safe.reevaluate(context);
        if (modelOutput.eligible !== expected.eligible) throw new Error('Liquid action disagreed with the validated evidence; action blocked.');
        return modelOutput;
      } };
      const acted = await rehydrateAndAct({ database, archive, reevaluator: guardedReevaluator, spore_id: SPORE_ID, fresh_evidence: wake, clock: this.clock });
      state.model_result = { status: 'validated', output: modelOutput };
      state.action = acted.action;
      this.record(state, 'candidate_reevaluated', { spore_id: SPORE_ID, subject: plan.subject, details: { model_status: 'validated', decision: acted.decision } });
      this.record(state, 'agent_action_completed', { spore_id: SPORE_ID, subject: plan.subject, details: { action_type: acted.action.action_type } });
      await this.phase(state, 'act', 'complete', `The agent independently completed ${acted.action.action_type}.`);

      await this.phase(state, 'telemetry', 'running', 'Publishing the complete lifecycle to RawTree and reading it back.');
      database.completeRun(state.run_id, { summary: { action: acted.action.action_type, evidence_urls: wake.evidence_urls }, completed_at: this.clock().toISOString() });
      this.record(state, 'run_completed', { subject: plan.subject, details: { outcome: acted.action.action_type } });
      const sink = new BufferedTelemetrySink({ client: this.rawtreeClient, bufferPath: this.pendingPath });
      const delivery = await sink.emitMany(state.events);
      if (!delivery.delivered) throw new Error(`RawTree delivery buffered: ${delivery.error}`);
      let verification = { verified: false };
      for (let attempt = 0; attempt < 5 && !verification.verified; attempt += 1) {
        if (attempt) await new Promise((resolve) => setTimeout(resolve, 500));
        verification = await this.rawtreeClient.verifyBatch(state.events);
      }
      if (!verification.verified) throw new Error('RawTree accepted the events but read-back verification is not complete.');
      state.telemetry = summarizeLifecycle(state.events, { remote_verified: true });
      state.telemetry.query = `SELECT * FROM spore_karthik_lifecycle_events_v1 WHERE run_id = '${state.run_id}' ORDER BY timestamp`;
      await this.phase(state, 'telemetry', 'complete', `RawTree returned all ${state.events.length} lifecycle events.`);
      state.status = 'complete'; state.phase = 'complete'; state.completed_at = this.clock().toISOString();
      await this.writeState(state);
      return state;
    } catch (error) {
      state.status = 'failed'; state.error = error.message; state.completed_at = this.clock().toISOString();
      const active = state.phases.find((item) => item.status === 'running');
      if (active) active.status = 'failed';
      try {
        if (database.getRun(state.run_id)) database.completeRun(state.run_id, { status: 'FAILED', summary: { error: error.message }, completed_at: state.completed_at });
        this.record(state, 'run_failed', { successful: false, details: { error: error.message, phase: state.phase } });
      } catch {}
      await this.writeState(state);
      throw error;
    } finally {
      database.close();
    }
  }

  async snapshot() {
    const state = await this.readState();
    let storage = { exists: false, counts: { runs: 0, working: 0, durable: 0, spores: 0, shortlist: 0, actions: 0 } };
    if (await exists(this.databasePath)) {
      const database = new SporeDatabase(this.databasePath);
      try {
        storage = { exists: true, database_path: 'data/spore-autonomous.sqlite', counts: database.counts(), run: state.run_id ? database.getRun(state.run_id) : null, spore: database.getSpore(SPORE_ID), shortlist: state.run_id ? database.listShortlist(state.run_id) : [], action: database.getActionForSpore(SPORE_ID) };
      } finally { database.close(); }
    }
    let archiveFile = null;
    if (state.archive?.pointer) {
      const file = path.join(this.archivePath, state.archive.pointer);
      if (await exists(file)) archiveFile = { path: `data/spore-autonomous-archives/${state.archive.pointer}`, bytes: (await stat(file)).size };
    }
    return { ...state, storage, archive_file: archiveFile, default_goal: DEFAULT_GOAL, links: { liquid: 'https://huggingface.co/LiquidAI/LFM2.5-8B-A1B-GGUF', nimble: 'https://docs.nimbleway.com/', rawtree: 'https://rawtree.com/', repository: 'https://github.com/karthikshetty-1629/spore' } };
  }
}
