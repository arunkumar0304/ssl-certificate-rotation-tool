// Zero-Docker demo:  npm run demo
// Full loop: expiring cert -> detect -> issue -> deploy -> verify -> audit.
import { loadConfig } from '../src/config.js';
import { DB } from '../src/db.js';
import * as service from '../src/service.js';
import { startDevServer } from '../src/devServer.js';

const cfg = loadConfig('config.json');
const db = new DB(cfg.dbPath);
const t = cfg.targets[0];

console.log('1) Seeding endpoint with a cert that expires in 1 day (simulating a neglected cert)');
await service.bootstrap(cfg, db, 1);
const server = await startDevServer(t.port, t.deploy.certPath, t.deploy.keyPath);

let [r] = await service.scanAll(cfg, db);
console.log(`2) Scan: ${r.name} status=${r.status} days_left=${r.days_left} serial=${r.serial.slice(0, 10)}`);

console.log('3) Running renewal (issue -> deploy -> verify)...');
console.log('   result:', (await service.renewDue(cfg, db))[0]);

r = db.certs()[0];
console.log(`4) Scan again: status=${r.status} days_left=${r.days_left} serial=${r.serial.slice(0, 10)}`);
console.log('5) Audit trail:');
for (const a of db.auditLog(8).reverse()) console.log(`   ${a.ts}  ${a.action.padEnd(14)} ${a.detail}`);
server.close();
db.close();
