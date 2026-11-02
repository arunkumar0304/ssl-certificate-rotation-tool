import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { DB } from '../src/db.js';
import * as service from '../src/service.js';
import { startDevServer } from '../src/devServer.js';

const freePort = () => new Promise((r) => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

async function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-'));
  const port = await freePort();
  const deploy = { type: 'file', certPath: path.join(dir, 'c.pem'), keyPath: path.join(dir, 'k.pem') };
  const cfg = {
    dbPath: path.join(dir, 't.db'), renewBeforeDays: 30, alertWebhook: '',
    issuer: { type: 'localCa', localCa: { dir: path.join(dir, 'ca'), validityDays: 90 } },
    targets: [{ name: 't1', domain: 't1.local', host: '127.0.0.1', port, deploy }],
  };
  return { cfg, db: new DB(cfg.dbPath), deploy, port };
}

test('rotation end to end: expiring cert is renewed, deployed and verified', async () => {
  const { cfg, db, deploy, port } = await setup();
  await service.bootstrap(cfg, db, 1);
  const server = await startDevServer(port, deploy.certPath, deploy.keyPath);
  try {
    const [first] = await service.scanAll(cfg, db);
    assert.equal(first.status, 'expiring');

    const [res] = await service.renewDue(cfg, db);
    assert.equal(res.action, 'renewed');

    const after = db.certs()[0];
    assert.equal(after.status, 'ok');
    assert.ok(after.days_left > 80);
    assert.notEqual(after.serial, first.serial);
    const actions = db.auditLog().map((a) => a.action);
    for (const step of ['renew_started', 'issued', 'deployed', 'verified']) assert.ok(actions.includes(step), step);
  } finally { server.close(); }
});

test('healthy certificate is not renewed', async () => {
  const { cfg, db, deploy, port } = await setup();
  await service.bootstrap(cfg, db);
  const server = await startDevServer(port, deploy.certPath, deploy.keyPath);
  try {
    const [res] = await service.renewDue(cfg, db);
    assert.equal(res.action, 'skipped');
  } finally { server.close(); }
});

test('unreachable endpoint is reported and never renewed blindly', async () => {
  const { cfg, db } = await setup();
  const [scan] = await service.scanAll(cfg, db);
  assert.equal(scan.status, 'unreachable');
  const [res] = await service.renewDue(cfg, db);
  assert.equal(res.reason, 'unreachable');
});
