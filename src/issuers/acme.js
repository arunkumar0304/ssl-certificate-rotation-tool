// Real ACME (HTTP-01) using the acme-client library. Works with Pebble or Let's Encrypt.
// The webroot must be served by the target at /.well-known/acme-challenge/<token>.
import fs from 'node:fs';
import path from 'node:path';

export class AcmeIssuer {
  constructor(cfg) { this.cfg = cfg; }

  async accountKey() {
    const file = path.join(this.cfg.stateDir, 'account.key');
    const acme = (await import('acme-client')).default;
    if (fs.existsSync(file)) return fs.readFileSync(file);
    fs.mkdirSync(this.cfg.stateDir, { recursive: true });
    const key = await acme.crypto.createPrivateKey();
    fs.writeFileSync(file, key, { mode: 0o600 });
    return key;
  }

  async issue(domain) {
    const acme = (await import('acme-client')).default;
    const client = new acme.Client({ directoryUrl: this.cfg.directoryUrl, accountKey: await this.accountKey() });
    const [key, csr] = await acme.crypto.createCsr({ commonName: domain });
    const challengeDir = path.join(this.cfg.webroot, '.well-known', 'acme-challenge');
    const cert = await client.auto({
      csr,
      email: this.cfg.email,
      termsOfServiceAgreed: true,
      challengePriority: ['http-01'],
      challengeCreateFn: async (_authz, challenge, keyAuthorization) => {
        fs.mkdirSync(challengeDir, { recursive: true });
        fs.writeFileSync(path.join(challengeDir, challenge.token), keyAuthorization);
      },
      challengeRemoveFn: async (_authz, challenge) => {
        fs.rmSync(path.join(challengeDir, challenge.token), { force: true });
      },
    });
    return { cert: cert.toString(), key: key.toString() };
  }
}
