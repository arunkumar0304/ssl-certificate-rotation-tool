import cron from 'node-cron';
import { loadConfig } from './config.js';
import { DB } from './db.js';
import { createApp } from './app.js';
import { runCycle } from './service.js';

const cfg = loadConfig();
const db = new DB(cfg.dbPath);
const port = Number(process.env.PORT) || cfg.port || 8000;

createApp(cfg, db).listen(port, () => console.log(`CertRotator listening on http://localhost:${port}`));

cron.schedule(cfg.schedule, () => runCycle(cfg, db).catch((e) => console.error('cycle failed:', e)));
runCycle(cfg, db).catch((e) => console.error('initial cycle failed:', e));   // first run immediately
