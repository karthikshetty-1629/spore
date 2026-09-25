import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

function safeId(value, name) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new TypeError(`${name} must contain only letters, numbers, underscores, or hyphens`);
  }
  return value;
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export class EvidenceArchive {
  constructor(rootDirectory) {
    if (typeof rootDirectory !== 'string' || rootDirectory.trim() === '') {
      throw new TypeError('archive root directory is required');
    }
    this.rootDirectory = rootDirectory;
  }

  resolve(pointer) {
    if (typeof pointer !== 'string' || basename(pointer) !== pointer || !/^[A-Za-z0-9_-]+\.json$/.test(pointer)) {
      throw new TypeError('archive pointer is invalid');
    }
    return join(this.rootDirectory, pointer);
  }

  async archiveEvidence({
    spore_id,
    memory_id,
    run_id,
    subject,
    payload,
    token_count = 0,
    archived_at = new Date().toISOString(),
  }) {
    const pointer = `${safeId(spore_id, 'spore_id')}.json`;
    safeId(memory_id, 'memory_id');
    safeId(run_id, 'run_id');
    const evidence = { memory_id, run_id, subject, payload, token_count };
    const record = {
      archive_version: 1,
      spore_id,
      archived_at,
      evidence,
      integrity: { algorithm: 'sha256', digest: digest(evidence) },
    };
    const serialized = `${JSON.stringify(record, null, 2)}\n`;
    const destination = this.resolve(pointer);
    const temporary = `${destination}.${process.pid}.tmp`;
    await mkdir(this.rootDirectory, { recursive: true });
    await writeFile(temporary, serialized, { encoding: 'utf8', mode: 0o600 });
    await rename(temporary, destination);
    return {
      pointer,
      bytes: Buffer.byteLength(serialized),
      digest: record.integrity.digest,
    };
  }

  async readEvidence(pointer) {
    const record = JSON.parse(await readFile(this.resolve(pointer), 'utf8'));
    if (record.archive_version !== 1 || record.integrity?.algorithm !== 'sha256') {
      throw new Error('archive format is unsupported');
    }
    if (digest(record.evidence) !== record.integrity.digest) {
      throw new Error('archive integrity check failed');
    }
    return record;
  }

  async remove(pointer) {
    await rm(this.resolve(pointer), { force: true });
  }
}
