import { DatabaseSync } from 'node:sqlite';

const RUN_STATUSES = new Set(['RUNNING', 'COMPLETED', 'FAILED']);
const SPORE_STATUSES = new Set(['DORMANT', 'AWAKENED', 'EXPIRED']);

function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value;
}

function timestamp(value = new Date().toISOString()) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new TypeError('timestamp must be an ISO-compatible string');
  }
  return value;
}

function encode(value) {
  return JSON.stringify(value ?? null);
}

function decode(value) {
  return value === null ? null : JSON.parse(value);
}

function mapMemory(row) {
  return row ? { ...row, payload: decode(row.payload_json), payload_json: undefined } : null;
}

function mapSpore(row) {
  if (!row) return null;
  const { wake_attribute, wake_operator, wake_target_json, ...rest } = row;
  return {
    ...rest,
    wake_condition: {
      attribute: wake_attribute,
      operator: wake_operator,
      target: decode(wake_target_json),
    },
  };
}

export class SporeDatabase {
  constructor(filename = ':memory:') {
    this.database = new DatabaseSync(filename);
    this.database.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    this.migrate();
  }

  migrate() {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        run_id TEXT PRIMARY KEY,
        goal TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
        started_at TEXT NOT NULL,
        completed_at TEXT,
        summary_json TEXT
      );

      CREATE TABLE IF NOT EXISTS working_memories (
        memory_id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
        subject TEXT,
        payload_json TEXT NOT NULL,
        token_count INTEGER NOT NULL DEFAULT 0 CHECK (token_count >= 0),
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS durable_memories (
        memory_id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
        subject TEXT,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS spores (
        spore_id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
        subject TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('DORMANT', 'AWAKENED', 'EXPIRED')),
        reason_dormant TEXT NOT NULL,
        wake_attribute TEXT NOT NULL,
        wake_operator TEXT NOT NULL CHECK (wake_operator IN ('==', '<=')),
        wake_target_json TEXT NOT NULL,
        monitor_query TEXT NOT NULL,
        interval_seconds INTEGER NOT NULL CHECK (interval_seconds > 0),
        last_checked_at TEXT,
        next_check_at TEXT NOT NULL,
        archive_pointer TEXT,
        on_wake TEXT NOT NULL,
        confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
        created_at TEXT NOT NULL,
        awakened_at TEXT
      );

      CREATE INDEX IF NOT EXISTS spores_due_idx ON spores(status, next_check_at);
      PRAGMA user_version = 1;
    `);
  }

  createRun({ run_id, goal, status = 'RUNNING', started_at = new Date().toISOString() }) {
    if (!RUN_STATUSES.has(status)) throw new TypeError('run status is invalid');
    this.database.prepare(`
      INSERT INTO runs (run_id, goal, status, started_at)
      VALUES (?, ?, ?, ?)
    `).run(requiredString(run_id, 'run_id'), requiredString(goal, 'goal'), status, timestamp(started_at));
    return this.getRun(run_id);
  }

  getRun(runId) {
    const row = this.database.prepare('SELECT * FROM runs WHERE run_id = ?').get(runId);
    if (!row) return null;
    return { ...row, summary: decode(row.summary_json), summary_json: undefined };
  }

  saveWorkingMemory({ memory_id, run_id, subject = null, payload, token_count = 0, updated_at = new Date().toISOString() }) {
    if (!Number.isInteger(token_count) || token_count < 0) throw new TypeError('token_count must be a non-negative integer');
    this.database.prepare(`
      INSERT INTO working_memories (memory_id, run_id, subject, payload_json, token_count, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(memory_id) DO UPDATE SET
        run_id = excluded.run_id,
        subject = excluded.subject,
        payload_json = excluded.payload_json,
        token_count = excluded.token_count,
        updated_at = excluded.updated_at
    `).run(
      requiredString(memory_id, 'memory_id'),
      requiredString(run_id, 'run_id'),
      subject,
      encode(payload),
      token_count,
      timestamp(updated_at),
    );
    return this.getWorkingMemory(memory_id);
  }

  getWorkingMemory(memoryId) {
    return mapMemory(this.database.prepare('SELECT * FROM working_memories WHERE memory_id = ?').get(memoryId));
  }

  deleteWorkingMemory(memoryId) {
    return Number(this.database.prepare('DELETE FROM working_memories WHERE memory_id = ?').run(memoryId).changes);
  }

  saveDurableMemory({ memory_id, run_id, subject = null, payload, updated_at = new Date().toISOString() }) {
    this.database.prepare(`
      INSERT INTO durable_memories (memory_id, run_id, subject, payload_json, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(memory_id) DO UPDATE SET
        run_id = excluded.run_id,
        subject = excluded.subject,
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `).run(
      requiredString(memory_id, 'memory_id'),
      requiredString(run_id, 'run_id'),
      subject,
      encode(payload),
      timestamp(updated_at),
    );
    return this.getDurableMemory(memory_id);
  }

  getDurableMemory(memoryId) {
    return mapMemory(this.database.prepare('SELECT * FROM durable_memories WHERE memory_id = ?').get(memoryId));
  }

  saveSpore({
    spore_id,
    run_id,
    subject,
    status = 'DORMANT',
    reason_dormant,
    wake_condition,
    monitor_query,
    interval_seconds,
    next_check_at,
    archive_pointer = null,
    on_wake,
    confidence = null,
    created_at = new Date().toISOString(),
  }) {
    if (!SPORE_STATUSES.has(status)) throw new TypeError('spore status is invalid');
    if (!Number.isInteger(interval_seconds) || interval_seconds <= 0) {
      throw new TypeError('interval_seconds must be a positive integer');
    }
    if (confidence !== null && (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)) {
      throw new TypeError('confidence must be between 0 and 1');
    }

    this.database.prepare(`
      INSERT INTO spores (
        spore_id, run_id, subject, status, reason_dormant,
        wake_attribute, wake_operator, wake_target_json,
        monitor_query, interval_seconds, next_check_at, archive_pointer,
        on_wake, confidence, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(spore_id) DO UPDATE SET
        run_id = excluded.run_id,
        subject = excluded.subject,
        status = excluded.status,
        reason_dormant = excluded.reason_dormant,
        wake_attribute = excluded.wake_attribute,
        wake_operator = excluded.wake_operator,
        wake_target_json = excluded.wake_target_json,
        monitor_query = excluded.monitor_query,
        interval_seconds = excluded.interval_seconds,
        next_check_at = excluded.next_check_at,
        archive_pointer = excluded.archive_pointer,
        on_wake = excluded.on_wake,
        confidence = excluded.confidence
    `).run(
      requiredString(spore_id, 'spore_id'),
      requiredString(run_id, 'run_id'),
      requiredString(subject, 'subject'),
      status,
      requiredString(reason_dormant, 'reason_dormant'),
      requiredString(wake_condition?.attribute, 'wake_condition.attribute'),
      requiredString(wake_condition?.operator, 'wake_condition.operator'),
      encode(wake_condition?.target),
      requiredString(monitor_query, 'monitor_query'),
      interval_seconds,
      timestamp(next_check_at),
      archive_pointer,
      requiredString(on_wake, 'on_wake'),
      confidence,
      timestamp(created_at),
    );
    return this.getSpore(spore_id);
  }

  getSpore(sporeId) {
    return mapSpore(this.database.prepare('SELECT * FROM spores WHERE spore_id = ?').get(sporeId));
  }

  listDueSpores(asOf = new Date().toISOString()) {
    return this.database.prepare(`
      SELECT * FROM spores
      WHERE status = 'DORMANT' AND next_check_at <= ?
      ORDER BY next_check_at, spore_id
    `).all(timestamp(asOf)).map(mapSpore);
  }

  counts() {
    const count = (table) => this.database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
    return {
      runs: count('runs'),
      working: count('working_memories'),
      durable: count('durable_memories'),
      spores: count('spores'),
    };
  }

  withTransaction(operation) {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      if (result && typeof result.then === 'function') {
        throw new TypeError('SQLite transaction callbacks must be synchronous');
      }
      this.database.exec('COMMIT');
      return result;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  close() {
    this.database.close();
  }
}
