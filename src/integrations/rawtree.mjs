const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SAFE_VALUE = /^[A-Za-z0-9_-]+$/;

function validateIdentifier(value, name) {
  if (!SAFE_IDENTIFIER.test(value)) throw new TypeError(`${name} is invalid`);
  return value;
}

export class RawTreeClient {
  constructor({
    apiKey,
    database = 'default',
    baseUrl = 'https://api.rawtree.com',
    table = 'spore_karthik_lifecycle_events_v1',
    fetchImpl = fetch,
  }) {
    if (!apiKey) throw new TypeError('RawTree API key is required');
    this.apiKey = apiKey;
    this.database = validateIdentifier(database, 'database');
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.table = validateIdentifier(table, 'table');
    this.fetchImpl = fetchImpl;
  }

  async request(path, body) {
    const response = await this.fetchImpl(`${this.baseUrl}${path}?database=${encodeURIComponent(this.database)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`RawTree returned HTTP ${response.status}`);
    return response.json();
  }

  async insertEvents(events) {
    if (!Array.isArray(events) || events.length === 0) throw new TypeError('events must be a non-empty array');
    const result = await this.request(`/v1/tables/${this.table}`, events);
    if (result.inserted !== events.length) {
      throw new Error(`RawTree acknowledged ${result.inserted ?? 0} of ${events.length} events`);
    }
    return result;
  }

  async readRun(runId) {
    if (!SAFE_VALUE.test(runId)) throw new TypeError('runId is invalid');
    return this.request('/v1/query', {
      sql: `SELECT event_id, event_type, timestamp FROM ${this.table} WHERE run_id = '${runId}' ORDER BY timestamp LIMIT 100`,
    });
  }

  async readLatest(limit = 100) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new TypeError('limit must be between 1 and 1000');
    return this.request('/v1/query', {
      sql: `SELECT * FROM ${this.table} ORDER BY timestamp DESC LIMIT ${limit}`,
    });
  }

  async verifyBatch(events) {
    const runIds = new Set(events.map((event) => event.run_id));
    if (runIds.size !== 1) throw new TypeError('all events must have the same run_id');
    const response = await this.readRun(events[0].run_id);
    const serialized = JSON.stringify(response);
    return {
      verified: events.every((event) => serialized.includes(event.event_id)),
      response,
    };
  }
}
