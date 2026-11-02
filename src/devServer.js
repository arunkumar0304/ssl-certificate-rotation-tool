// Tiny HTTPS endpoint that re-reads its cert on every handshake (stand-in for nginx in tests / local demo).
import https from 'node:https';
import fs from 'node:fs';
import tls from 'node:tls';

export function startDevServer(port, certPath, keyPath, host = '127.0.0.1') {
  const server = https.createServer({
    SNICallback: (_name, cb) => {
      try {
        cb(null, tls.createSecureContext({ cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }));
      } catch (e) { cb(e); }
    },
  }, (_req, res) => res.end('hello\n'));
  return new Promise((resolve) => server.listen(port, host, () => resolve(server)));
}
