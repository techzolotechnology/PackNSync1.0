import fs from 'node:fs';
import path from 'node:path';

// Single-process development store. Production requires durable storage.
export function createFileStore(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  function read() {
    if (!fs.existsSync(filePath)) return { inspections: {}, claims: {} };
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  function write(data) {
    const temporary = `${filePath}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(data), { mode: 0o600 });
    fs.renameSync(temporary, filePath);
  }
  return {
    async saveInspection(bookingId, stage, result) {
      const data = read();
      const key = `${bookingId}:${stage}`;
      if (Object.hasOwn(data.inspections, key)) {
        const error = new Error('Inspection evidence cannot be overwritten.');
        error.statusCode = 409; throw error;
      }
      const record = { ...result, bookingId, stage, savedAt: new Date().toISOString() };
      data.inspections[key] = record;
      write(data); return record;
    },
    async getInspection(bookingId, stage) { return read().inspections[`${bookingId}:${stage}`] || null; },
    async saveClaim(bookingId, claim) {
      const data = read(); data.claims[bookingId] = claim; write(data); return claim;
    },
    async getClaim(bookingId) { return read().claims[bookingId] || null; },
  };
}
