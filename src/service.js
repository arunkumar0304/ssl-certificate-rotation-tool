// Core workflow: scan -> decide -> issue -> deploy -> verify -> audit / alert.
import { setTimeout as sleep } from 'node:timers/promises';
import { nowIso } from './db.js';
import { fetchCert } from './scanner.js';
import { makeIssuer } from './issuers/index.js';
import { makeDeployer } from './deployers.js';
import { sendAlert } from './alerts.js';

export const statusOf = (days, threshold) => (days <= 0 ? 'expired' : days < threshold ? 'expiring' : 'ok');

export async function scanOne(cfg, db, t) {
  const prev = db.getCert(t.name);
  const rec = { name: t.name, domain: t.domain, host: t.host, port: t.port, last_checked: nowIso() };
  try {
    Object.assign(rec, await fetchCert(t.host, t.port, t.domain));
    rec.status = statusOf(rec.days_left, cfg.renewBeforeDays);
  } catch (e) {
    rec.status = 'unreachable';
    rec.error = String(e.message).slice(0, 200);
  }
  db.upsertCert(rec);
  rec.prevStatus = prev?.status ?? null;
  if (rec.prevStatus !== rec.status) db.audit(t.name, 'status_change', `${rec.prevStatus ?? 'new'} -> ${rec.status}`);
  return rec;
}

export const scanAll = async (cfg, db) => Promise.all(cfg.targets.map((t) => scanOne(cfg, db, t)));

export async function renewOne(cfg, db, t, { force = false, verifyTimeoutMs = 20000 } = {}) {
  const before = await scanOne(cfg, db, t);
  const name = t.name;
  if (!force && before.status === 'ok') return { name, action: 'skipped', reason: 'not due' };
  if (!force && before.status === 'unreachable') {
    if (before.prevStatus !== 'unreachable') await sendAlert(cfg, `[certrotator] ${name}: endpoint unreachable (${before.error})`);
    return { name, action: 'skipped', reason: 'unreachable' };      // never renew blindly
  }
  db.audit(name, 'renew_started', `status=${before.status} serial=${before.serial}`);
  try {
    const material = await makeIssuer(cfg).issue(t.domain);
    db.audit(name, 'issued', `domain=${t.domain}`);
    db.audit(name, 'deployed', await makeDeployer(t).deploy(material, t));

    // Verify: the endpoint must now serve a NEW serial, otherwise the rotation is not done.
    const deadline = Date.now() + verifyTimeoutMs;
    let after;
    do {
      after = await scanOne(cfg, db, t);
      if (after.serial && after.serial !== before.serial) break;
      await sleep(1000);
    } while (Date.now() < deadline);
    if (!after.serial || after.serial === before.serial) throw new Error('endpoint still serving old certificate after deploy');

    db.audit(name, 'verified', `new serial=${after.serial} expires=${after.not_after}`);
    await sendAlert(cfg, `[certrotator] ${name}: renewed, new cert expires ${after.not_after}`);
    return { name, action: 'renewed', not_after: after.not_after };
  } catch (e) {
    db.audit(name, 'renew_failed', e.message);
    await sendAlert(cfg, `[certrotator] ${name}: RENEWAL FAILED - ${e.message}`);
    return { name, action: 'failed', error: e.message };
  }
}

export async function renewDue(cfg, db, opts = {}) {
  const results = [];
  for (const t of cfg.targets) {
    if (opts.only && opts.only !== t.name) continue;
    results.push(await renewOne(cfg, db, t, opts));
  }
  return results;
}

// Seeds endpoints with a first (optionally short-lived) cert so the demo has something to rotate.
export async function bootstrap(cfg, db, validityDays) {
  const issuer = makeIssuer(cfg);
  for (const t of cfg.targets) {
    await makeDeployer(t).deploy(await issuer.issue(t.domain, validityDays), t);
    db.audit(t.name, 'bootstrap', `initial cert, validityDays=${validityDays ?? 'default'}`);
  }
}

let busy = false;
export async function runCycle(cfg, db) {   // one scheduler tick; guarded so ticks never overlap
  if (busy) return;
  busy = true;
  try { await renewDue(cfg, db); } finally { busy = false; }
}
