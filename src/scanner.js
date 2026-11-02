// Discovery: connect to an endpoint and read the certificate it is actually serving.
import tls from 'node:tls';

export function fetchCert(host, port, sni, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: sni, rejectUnauthorized: false }, () => {
      const c = socket.getPeerCertificate();
      socket.end();
      if (!c || !c.valid_to) return reject(new Error('no certificate presented'));
      const notAfter = new Date(c.valid_to);
      resolve({
        subject: c.subject?.CN ?? JSON.stringify(c.subject),
        issuer: c.issuer?.CN ?? JSON.stringify(c.issuer),
        serial: String(c.serialNumber).toLowerCase(),
        not_before: new Date(c.valid_from).toISOString(),
        not_after: notAfter.toISOString(),
        days_left: Math.round(((notAfter - Date.now()) / 86400000) * 1000) / 1000,
      });
    });
    socket.setTimeout(timeoutMs, () => { socket.destroy(); reject(new Error('connection timed out')); });
    socket.on('error', reject);
  });
}
