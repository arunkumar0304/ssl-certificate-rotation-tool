import { loadConfig } from './config.js';
import { DB } from './db.js';
import * as service from './service.js';

const [cmd, ...rest] = process.argv.slice(2);
const flag = (n) => rest.includes(`--${n}`);
const opt = (n) => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : undefined; };

const cfg = loadConfig();
const db = new DB(cfg.dbPath);
let out;
if (cmd === 'scan') out = await service.scanAll(cfg, db);
else if (cmd === 'renew') out = await service.renewDue(cfg, db, { force: flag('force'), only: opt('name') });
else if (cmd === 'bootstrap') { await service.bootstrap(cfg, db, opt('validity-days') ? Number(opt('validity-days')) : undefined); out = 'bootstrapped'; }
else { console.error('usage: node src/cli.js <scan|renew [--force] [--name x]|bootstrap [--validity-days n]>'); process.exit(1); }
console.log(JSON.stringify(out, null, 2));
db.close();
