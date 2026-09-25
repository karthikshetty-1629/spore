import { evaluateWakeCondition, extractFactsFromSearch } from './conditions.mjs';

function nextCheck(checkedAt, intervalSeconds) {
  return new Date(Date.parse(checkedAt) + intervalSeconds * 1000).toISOString();
}

export class AutonomousWatcher {
  constructor({
    database,
    searchClient,
    extractFacts = extractFactsFromSearch,
    cadenceMs = 60_000,
    clock = () => new Date(),
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
    onError = () => {},
    onCycle = () => {},
  }) {
    this.database = database;
    this.searchClient = searchClient;
    this.extractFacts = extractFacts;
    this.cadenceMs = cadenceMs;
    this.clock = clock;
    this.setIntervalFn = setIntervalFn;
    this.clearIntervalFn = clearIntervalFn;
    this.onError = onError;
    this.onCycle = onCycle;
    this.timer = null;
    this.running = false;
  }

  async runOnce() {
    if (this.running) return { skipped: true, events: [] };
    this.running = true;
    const checkedAt = this.clock().toISOString();
    const events = [];
    try {
      for (const spore of this.database.listDueSpores(checkedAt)) {
        const scheduledNext = nextCheck(checkedAt, spore.interval_seconds);
        try {
          const results = await this.searchClient.search({
            query: spore.monitor_query,
            maxResults: 3,
            searchDepth: 'lite',
          });
          const observed = await this.extractFacts(spore, results);
          const evaluation = evaluateWakeCondition(spore.wake_condition, observed.facts);
          const awakened = evaluation.matched
            ? this.database.awakenSpore(spore.spore_id, { checked_at: checkedAt })
            : false;
          if (!evaluation.matched) {
            this.database.recordSporeCheck(spore.spore_id, {
              checked_at: checkedAt,
              next_check_at: scheduledNext,
            });
          }
          events.push({
            type: awakened ? 'memory_awakened' : 'wake_check_no_match',
            spore_id: spore.spore_id,
            subject: spore.subject,
            checked_at: checkedAt,
            evidence_mode: this.searchClient.mode || 'unknown',
            evidence_urls: observed.evidence_urls,
            facts: observed.facts,
            evaluation,
          });
        } catch (error) {
          this.database.recordSporeCheck(spore.spore_id, {
            checked_at: checkedAt,
            next_check_at: scheduledNext,
          });
          events.push({
            type: 'wake_check_failed',
            spore_id: spore.spore_id,
            subject: spore.subject,
            checked_at: checkedAt,
            evidence_mode: this.searchClient.mode || 'unknown',
            error: error.message,
          });
        }
      }
      return { skipped: false, checked_at: checkedAt, events };
    } finally {
      this.running = false;
    }
  }

  start({ runImmediately = true } = {}) {
    if (this.timer !== null) return;
    const tick = () => this.runOnce().then(this.onCycle).catch(this.onError);
    if (runImmediately) void tick();
    this.timer = this.setIntervalFn(tick, this.cadenceMs);
  }

  stop() {
    if (this.timer === null) return;
    this.clearIntervalFn(this.timer);
    this.timer = null;
  }
}
