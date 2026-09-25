import { access, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
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

const MEMORY_ID = 'memory_openai_responses';
const SPORE_ID = 'spore_openai_responses';
const SUBJECT = 'OpenAI Responses API';
const ACTIONS = ['reset', 'observe', 'classify', 'sleep', 'wake-live', 'wake-replay', 'rehydrate', 'act', 'telemetry'];

function initialState() {
  return {
    version: 1,
    stage: 0,
    status: 'ready',
    run_id: '',
    evidence_mode: 'historical_then_live',
    events: [],
    messages: [],
    decision: null,
    sleep_result: null,
    search_results: [],
    fresh_evidence: null,
    rehydrated: null,
    model_result: null,
    telemetry: null,
    updated_at: new Date().toISOString(),
  };
}

function estimateTokens(value) {
  return Math.ceil(Buffer.byteLength(JSON.stringify(value)) / 4);
}

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

export class GuidedDemoController {
  constructor({ root, nimbleClient = null, rawtreeClient = null, reevaluator = null, clock = () => new Date() }) {
    this.root = root;
    this.nimbleClient = nimbleClient;
    this.rawtreeClient = rawtreeClient;
    this.reevaluator = reevaluator;
    this.clock = clock;
    this.databasePath = path.join(root, 'data/spore-demo.sqlite');
    this.archivePath = path.join(root, 'data/spore-demo-archives');
    this.statePath = path.join(root, 'data/spore-demo-state.json');
    this.pendingPath = path.join(root, 'data/spore-demo-telemetry-pending.json');
  }

  async readState() {
    try { return JSON.parse(await readFile(this.statePath, 'utf8')); } catch { return initialState(); }
  }

  async writeState(state) {
    state.updated_at = this.clock().toISOString();
    await mkdir(path.dirname(this.statePath), { recursive: true });
    const temporary = `${this.statePath}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`);
    await rename(temporary, this.statePath);
    return state;
  }

  record(state, event_type, fields = {}) {
    state.events.push(createLifecycleEvent({
      event_type,
      run_id: state.run_id,
      spore_id: fields.spore_id ?? '',
      subject: fields.subject ?? '',
      evidence_mode: fields.evidence_mode ?? state.evidence_mode,
      is_test: true,
      timestamp: this.clock().toISOString(),
      ...fields,
    }));
  }

  requireStage(state, expected, action) {
    if (state.stage !== expected) throw new Error(`${action} requires demo stage ${expected}; current stage is ${state.stage}`);
  }

  async reset() {
    await rm(this.databasePath, { force: true });
    await rm(`${this.databasePath}-shm`, { force: true });
    await rm(`${this.databasePath}-wal`, { force: true });
    await rm(this.archivePath, { recursive: true, force: true });
    await rm(this.pendingPath, { force: true });
    return this.writeState(initialState());
  }

  async observe() {
    const state = await this.readState();
    this.requireStage(state, 0, 'observe');
    await mkdir(path.dirname(this.databasePath), { recursive: true });
    const database = new SporeDatabase(this.databasePath);
    try {
      state.run_id = `guided_${this.clock().toISOString().replace(/\D/g, '').slice(0, 14)}`;
      const payload = {
        scenario: 'A previous provider review could not confirm official Responses API documentation. Recheck when the public documentation becomes available.',
        requirements: [{ attribute: 'api_documentation_available', operator: '==', target: true }],
        observed_facts: { api_documentation_available: false },
        research_notes: [
          'The provider is potentially useful for a long-running research agent.',
          'The review cannot proceed without official API documentation and a stable integration surface.',
          'Keep the original rationale and source provenance, but remove it from active context until the missing documentation is observed.',
          'On wake, combine the archived rationale with fresh web evidence and reevaluate eligibility before changing the shortlist.',
        ],
        source_urls: ['https://platform.openai.com/docs/api-reference/responses'],
      };
      const tokenCount = estimateTokens(payload);
      database.createRun({ run_id: state.run_id, goal: 'Monitor a provider until official API documentation is available' });
      database.saveWorkingMemory({ memory_id: MEMORY_ID, run_id: state.run_id, subject: SUBJECT, payload, token_count: tokenCount });
      this.record(state, 'run_started', { details: { goal: 'Monitor a provider until official API documentation is available' } });
      this.record(state, 'observation_created', { subject: SUBJECT, source_count: payload.source_urls.length, details: { token_estimate_method: 'serialized_bytes_divided_by_four' } });
      state.stage = 1;
      state.status = 'observation_created';
      state.messages.unshift(`SQLite working_memories now contains ${SUBJECT} (${tokenCount} estimated tokens).`);
      return this.writeState(state);
    } finally { database.close(); }
  }

  async classify() {
    const state = await this.readState();
    this.requireStage(state, 1, 'classify');
    const decision = evaluateObservation({
      scope: 'candidate_evaluation', subject: SUBJECT, is_duplicate: false, is_relevant: true,
      is_complete: true, currently_needed: false, eligible: false,
      blocker: { changeable: true, reason: 'Official Responses API documentation was not confirmed at the original observation time.' },
      wake_condition: { attribute: 'api_documentation_available', operator: '==', target: true },
      raw_text: 'Reconsider this provider when official Responses API documentation is available.',
      source_urls: ['https://platform.openai.com/docs/api-reference/responses'],
      observed_at: this.clock().toISOString(),
    });
    state.decision = decision;
    state.stage = 2;
    state.status = 'classified_as_spore';
    this.record(state, 'memory_classified', { subject: SUBJECT, details: { decision: decision.decision, reason: decision.reason } });
    state.messages.unshift(`The deterministic memory gate classified the observation as ${decision.decision}.`);
    return this.writeState(state);
  }

  async sleep() {
    const state = await this.readState();
    this.requireStage(state, 2, 'sleep');
    const database = new SporeDatabase(this.databasePath);
    const archive = new EvidenceArchive(this.archivePath);
    try {
      const result = await sporeWorkingMemory({
        database, archive, memory_id: MEMORY_ID,
        spore: {
          spore_id: SPORE_ID, subject: SUBJECT, reason_dormant: state.decision.reason,
          wake_condition: state.decision.wake_condition,
          monitor_query: 'OpenAI Responses API official documentation', interval_seconds: 3600,
          next_check_at: new Date(this.clock().getTime() - 1000).toISOString(),
          on_wake: 'reevaluate_provider', confidence: 1,
        },
      });
      state.sleep_result = {
        archive_pointer: result.archive.pointer,
        archive_bytes: result.archive.bytes,
        compact_spore_bytes: result.compact_spore_bytes,
        tokens_removed: result.context_removed.token_count,
      };
      this.record(state, 'memory_spored', { spore_id: SPORE_ID, subject: SUBJECT, details: { wake_condition: state.decision.wake_condition } });
      this.record(state, 'context_released', {
        spore_id: SPORE_ID, subject: SUBJECT,
        active_tokens_removed: result.context_removed.token_count,
        archive_bytes: result.archive.bytes,
        compact_spore_bytes: result.compact_spore_bytes,
      });
      state.stage = 3;
      state.status = 'dormant';
      state.messages.unshift(`Evidence archived to ${result.archive.pointer}; the working-memory row was removed.`);
      return this.writeState(state);
    } finally { database.close(); }
  }

  async wake(mode = 'live') {
    const state = await this.readState();
    this.requireStage(state, 3, 'wake');
    if (mode === 'live' && !this.nimbleClient) throw new Error('Nimble is not configured');
    const database = new SporeDatabase(this.databasePath);
    try {
      database.recordSporeCheck(SPORE_ID, {
        checked_at: this.clock().toISOString(),
        next_check_at: new Date(this.clock().getTime() - 1000).toISOString(),
      });
      this.record(state, 'wake_check_started', { spore_id: SPORE_ID, subject: SUBJECT, evidence_mode: mode === 'live' ? 'live' : 'historical_replay' });
      const searchClient = mode === 'live' ? this.nimbleClient : {
        mode: 'historical_replay',
        async search() {
          return [{
            title: 'Responses | OpenAI API Reference',
            description: 'Official API reference documentation for the Responses API is available.',
            url: 'https://platform.openai.com/docs/api-reference/responses',
          }];
        },
      };
      const started = performance.now();
      const watcher = new AutonomousWatcher({ database, searchClient, clock: this.clock });
      const result = await watcher.runOnce();
      const wakeEvent = result.events[0];
      if (!wakeEvent) throw new Error('No due spore was found');
      state.search_results = (wakeEvent.evidence_urls || []).map((url) => ({ url }));
      state.fresh_evidence = wakeEvent;
      this.record(state, wakeEvent.type, {
        spore_id: SPORE_ID, subject: SUBJECT,
        evidence_mode: wakeEvent.evidence_mode,
        successful: wakeEvent.type !== 'wake_check_failed',
        latency_ms: Math.round(performance.now() - started),
        source_count: wakeEvent.evidence_urls?.length || 0,
        details: { facts: wakeEvent.facts || {}, evidence_urls: wakeEvent.evidence_urls || [], evaluation: wakeEvent.evaluation || null },
      });
      if (wakeEvent.type !== 'memory_awakened') {
        state.status = wakeEvent.type;
        state.messages.unshift(`Watcher completed but the wake condition did not match. ${mode === 'live' ? 'You can inspect the sources or use the labeled replay.' : ''}`);
        return this.writeState(state);
      }
      state.stage = 4;
      state.status = 'awakened';
      state.evidence_mode = wakeEvent.evidence_mode;
      state.messages.unshift(`The autonomous watcher found matching ${wakeEvent.evidence_mode} evidence and awakened the spore.`);
      return this.writeState(state);
    } finally { database.close(); }
  }

  async rehydrate() {
    const state = await this.readState();
    this.requireStage(state, 4, 'rehydrate');
    const archive = new EvidenceArchive(this.archivePath);
    const record = await archive.readEvidence(state.sleep_result.archive_pointer);
    state.rehydrated = {
      archive_pointer: state.sleep_result.archive_pointer,
      integrity_algorithm: record.integrity.algorithm,
      subject: record.evidence.subject,
      historical_facts: record.evidence.payload.observed_facts,
      fresh_facts: state.fresh_evidence.facts,
      requirements: record.evidence.payload.requirements,
    };
    this.record(state, 'memory_rehydrated', { spore_id: SPORE_ID, subject: SUBJECT, details: { archive_pointer: state.sleep_result.archive_pointer, integrity_verified: true } });
    state.stage = 5;
    state.status = 'rehydrated';
    state.messages.unshift('The archive checksum passed; historical and fresh evidence are now combined for reevaluation.');
    return this.writeState(state);
  }

  async act() {
    const state = await this.readState();
    this.requireStage(state, 5, 'act');
    const database = new SporeDatabase(this.databasePath);
    const archive = new EvidenceArchive(this.archivePath);
    const deterministic = new DeterministicReevaluator();
    const model = { status: 'not_configured', output: null, error: null };
    const guarded = {
      reevaluate: async (context) => {
        const safe = await deterministic.reevaluate(context);
        if (!this.reevaluator) return safe;
        try {
          const candidate = await this.reevaluator.reevaluate(context);
          model.output = candidate;
          if (candidate.eligible !== safe.eligible) {
            model.status = 'guarded_mismatch';
            return safe;
          }
          model.status = 'validated';
          return candidate;
        } catch (error) {
          model.status = 'guarded_fallback';
          model.error = error.message;
          return safe;
        }
      },
    };
    try {
      const started = performance.now();
      const result = await rehydrateAndAct({
        database, archive, reevaluator: guarded, spore_id: SPORE_ID,
        fresh_evidence: state.fresh_evidence, clock: this.clock,
      });
      const latency = Math.round(performance.now() - started);
      state.model_result = { ...model, decision: result.decision, latency_ms: latency };
      this.record(state, 'candidate_reevaluated', { spore_id: SPORE_ID, subject: SUBJECT, latency_ms: latency, details: { model_status: model.status, decision: result.decision } });
      this.record(state, 'agent_action_completed', { spore_id: SPORE_ID, subject: SUBJECT, latency_ms: latency, details: { action_type: result.action.action_type } });
      state.stage = 6;
      state.status = result.action.action_type;
      state.messages.unshift(`Liquid ran locally (${model.status}); the validated decision produced ${result.action.action_type}.`);
      return this.writeState(state);
    } finally { database.close(); }
  }

  async telemetry() {
    const state = await this.readState();
    this.requireStage(state, 6, 'telemetry');
    if (!this.rawtreeClient) throw new Error('RawTree is not configured');
    this.record(state, 'run_completed', { details: { outcome: state.status } });
    const sink = new BufferedTelemetrySink({ client: this.rawtreeClient, bufferPath: this.pendingPath });
    const delivery = await sink.emitMany(state.events);
    if (!delivery.delivered) throw new Error(`RawTree delivery buffered: ${delivery.error}`);
    let verification = { verified: false };
    for (let attempt = 0; attempt < 4 && !verification.verified; attempt += 1) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 500));
      verification = await this.rawtreeClient.verifyBatch(state.events);
    }
    if (!verification.verified) throw new Error('RawTree accepted the batch, but read-back is not complete yet');
    state.telemetry = summarizeLifecycle(state.events, { remote_verified: true });
    state.telemetry.query = `SELECT * FROM spore_karthik_lifecycle_events_v1 WHERE run_id = '${state.run_id}' ORDER BY timestamp`;
    state.stage = 7;
    state.status = 'complete';
    state.messages.unshift(`RawTree accepted and returned all ${state.events.length} lifecycle events.`);
    return this.writeState(state);
  }

  async run(action) {
    if (!ACTIONS.includes(action)) throw new Error('Unknown demo action');
    if (action === 'reset') return this.reset();
    if (action === 'observe') return this.observe();
    if (action === 'classify') return this.classify();
    if (action === 'sleep') return this.sleep();
    if (action === 'wake-live') return this.wake('live');
    if (action === 'wake-replay') return this.wake('replay');
    if (action === 'rehydrate') return this.rehydrate();
    if (action === 'act') return this.act();
    return this.telemetry();
  }

  async snapshot() {
    const state = await this.readState();
    let storage = { exists: false, counts: { runs: 0, working: 0, durable: 0, spores: 0, shortlist: 0, actions: 0 } };
    if (await exists(this.databasePath)) {
      const database = new SporeDatabase(this.databasePath);
      try {
        const spore = database.getSpore(SPORE_ID);
        storage = {
          exists: true,
          database_path: 'data/spore-demo.sqlite',
          counts: database.counts(),
          working_memory: database.getWorkingMemory(MEMORY_ID),
          spore,
          shortlist: state.run_id ? database.listShortlist(state.run_id) : [],
          action: database.getActionForSpore(SPORE_ID),
        };
      } finally { database.close(); }
    }
    let archive = { exists: false };
    if (state.sleep_result?.archive_pointer) {
      const file = path.join(this.archivePath, state.sleep_result.archive_pointer);
      if (await exists(file)) archive = { exists: true, pointer: state.sleep_result.archive_pointer, bytes: (await stat(file)).size, path: `data/spore-demo-archives/${state.sleep_result.archive_pointer}` };
    }
    return {
      ...state,
      storage,
      archive,
      links: {
        liquid: 'https://huggingface.co/LiquidAI/LFM2.5-8B-A1B-GGUF',
        nimble: 'https://docs.nimbleway.com/',
        rawtree: 'https://rawtree.com/',
      },
    };
  }
}
