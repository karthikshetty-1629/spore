import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

async function readPending(file) {
  try {
    const value = JSON.parse(await readFile(file, 'utf8'));
    return Array.isArray(value) ? value : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writePending(file, events) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(events, null, 2)}\n`, 'utf8');
  await rename(temporary, file);
}

export class BufferedTelemetrySink {
  constructor({ client, bufferPath }) {
    if (!client?.insertEvents) throw new TypeError('client.insertEvents is required');
    if (!bufferPath) throw new TypeError('bufferPath is required');
    this.client = client;
    this.bufferPath = bufferPath;
  }

  async emitMany(events) {
    if (!Array.isArray(events) || events.length === 0) throw new TypeError('events must be a non-empty array');
    const pending = [...await readPending(this.bufferPath), ...events];
    await writePending(this.bufferPath, pending);
    return this.flush();
  }

  async flush() {
    const pending = await readPending(this.bufferPath);
    if (pending.length === 0) return { delivered: true, count: 0, pending: 0 };
    try {
      await this.client.insertEvents(pending);
      await writePending(this.bufferPath, []);
      return { delivered: true, count: pending.length, pending: 0 };
    } catch (error) {
      return { delivered: false, count: 0, pending: pending.length, error: error.message };
    }
  }
}
