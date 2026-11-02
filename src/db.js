// SQLite storage: certificate inventory + append-only audit trail.
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const COLS = ['name', 'domain', 'host', 'port', 'subject', 'issuer', 'serial', 'not_before',
  'not_after', 'days_left', 'status', 'last_checked', 'error'];

export const nowIso = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');

export class DB {
  constructor(file) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new Database(file);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS certs (
        name TEXT PRIMARY KEY, domain TEXT, host TEXT, port INTEGER, subject TEXT, issuer TEXT,
        serial TEXT, not_before TEXT, not_after TEXT, days_left REAL, status TEXT,
        last_checked TEXT, error TEXT);
      CREATE TABLE IF NOT EXISTS audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, name TEXT, action TEXT, detail TEXT);
    `);
    this.upsertStmt = this.db.prepare(
      `INSERT OR REPLACE INTO certs (${COLS.join(',')}) VALUES (${COLS.map((c) => '@' + c).join(',')})`);
  }
  upsertCert(rec) {
    const row = Object.fromEntries(COLS.map((c) => [c, rec[c] ?? null]));
    this.upsertStmt.run(row);
  }
  getCert(name) { return this.db.prepare('SELECT * FROM certs WHERE name=?').get(name); }
  certs() { return this.db.prepare('SELECT * FROM certs ORDER BY name').all(); }
  audit(name, action, detail = '') {
    this.db.prepare('INSERT INTO audit (ts,name,action,detail) VALUES (?,?,?,?)').run(nowIso(), name, action, detail);
  }
  auditLog(limit = 100) {
    return this.db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT ?').all(limit);
  }
  close() { this.db.close(); }
}
