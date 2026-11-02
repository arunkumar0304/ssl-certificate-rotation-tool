import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import * as service from './service.js';

export function createApp(cfg, db) {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/certs', (_req, res) => res.json(db.certs()));
  app.get('/api/audit', (req, res) => res.json(db.auditLog(Math.min(Number(req.query.limit) || 100, 500))));
  app.post('/api/scan', async (_req, res, next) => {
    try { res.json(await service.scanAll(cfg, db)); } catch (e) { next(e); }
  });
  app.post('/api/renew', async (req, res, next) => {
    try {
      const only = req.query.name || undefined;
      if (only && !cfg.targets.some((t) => t.name === only)) return res.status(404).json({ error: 'unknown target' });
      res.json(await service.renewDue(cfg, db, { force: req.query.force === 'true', only }));
    } catch (e) { next(e); }
  });

  // Serve the built React dashboard (npm run build:client)
  const dist = path.resolve('client/dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));
  return app;
}
