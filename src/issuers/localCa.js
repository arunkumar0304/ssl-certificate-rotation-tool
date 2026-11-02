// Offline demo CA (works anywhere, zero setup). Returns { cert (fullchain PEM), key (PEM) }.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import forge from 'node-forge';

const pki = forge.pki;
const newKeyPair = () => crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const serial = () => '00' + crypto.randomBytes(15).toString('hex'); // positive 16-byte serial

export class LocalCaIssuer {
  constructor(cfg) {
    this.dir = cfg.dir;
    this.validityDays = cfg.validityDays ?? 90;
  }

  loadOrCreateCa() {
    const keyFile = path.join(this.dir, 'ca.key');
    const certFile = path.join(this.dir, 'ca.pem');
    if (fs.existsSync(keyFile) && fs.existsSync(certFile)) {
      return { keyPem: fs.readFileSync(keyFile, 'utf8'), certPem: fs.readFileSync(certFile, 'utf8') };
    }
    fs.mkdirSync(this.dir, { recursive: true });
    const { publicKey, privateKey } = newKeyPair();
    const cert = pki.createCertificate();
    cert.publicKey = pki.publicKeyFromPem(publicKey);
    cert.serialNumber = serial();
    cert.validity.notBefore = new Date(Date.now() - 60000);
    cert.validity.notAfter = new Date(Date.now() + 3650 * 86400000);
    const attrs = [{ name: 'commonName', value: 'CertRotator Demo CA' }];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.setExtensions([{ name: 'basicConstraints', cA: true }, { name: 'keyUsage', keyCertSign: true, cRLSign: true }]);
    cert.sign(pki.privateKeyFromPem(privateKey), forge.md.sha256.create());
    const certPem = pki.certificateToPem(cert);
    fs.writeFileSync(keyFile, privateKey, { mode: 0o600 });
    fs.writeFileSync(certFile, certPem);
    return { keyPem: privateKey, certPem };
  }

  async issue(domain, validityDays = this.validityDays) {
    const ca = this.loadOrCreateCa();
    const caCert = pki.certificateFromPem(ca.certPem);
    const { publicKey, privateKey } = newKeyPair();
    const cert = pki.createCertificate();
    cert.publicKey = pki.publicKeyFromPem(publicKey);
    cert.serialNumber = serial();
    cert.validity.notBefore = new Date(Date.now() - 60000);
    cert.validity.notAfter = new Date(Date.now() + validityDays * 86400000);
    cert.setSubject([{ name: 'commonName', value: domain }]);
    cert.setIssuer(caCert.subject.attributes);
    cert.setExtensions([
      { name: 'basicConstraints', cA: false },
      { name: 'subjectAltName', altNames: [{ type: 2, value: domain }] },
    ]);
    cert.sign(pki.privateKeyFromPem(ca.keyPem), forge.md.sha256.create());
    return { cert: pki.certificateToPem(cert) + ca.certPem, key: privateKey };
  }
}
