// Deployers push a new cert+key to an endpoint.
//  file    - atomic write (+ optional reload command). Used by the Docker/nginx demo.
//  ansible - runs ansible/deploy_cert.yml against a remote host (production path, AWX-compatible).
import { execFile, exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const run = promisify(execFile);
const sh = promisify(exec);

function atomicWrite(file, data, mode) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data, { mode });
  fs.renameSync(tmp, file);
}

class FileDeployer {
  constructor(cfg) { this.cfg = cfg; }
  async deploy({ cert, key }) {
    atomicWrite(this.cfg.keyPath, key, 0o600);   // key first, cert last, so servers never see a cert without its key
    atomicWrite(this.cfg.certPath, cert, 0o644);
    if (this.cfg.reloadCmd) await sh(this.cfg.reloadCmd);
    return `wrote ${this.cfg.certPath}`;
  }
}

class AnsibleDeployer {
  constructor(cfg) { this.cfg = cfg; }
  async deploy({ cert, key }, target) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'certrotator-'));
    try {
      fs.writeFileSync(path.join(dir, 'cert.pem'), cert, { mode: 0o644 });
      fs.writeFileSync(path.join(dir, 'key.pem'), key, { mode: 0o600 });
      const extra = {
        cert_src: path.join(dir, 'cert.pem'), key_src: path.join(dir, 'key.pem'),
        cert_dest: this.cfg.certDest, key_dest: this.cfg.keyDest,
        reload_service: this.cfg.reloadService ?? 'nginx',
      };
      const args = ['-i', `${target.host},`, 'ansible/deploy_cert.yml', '-e', JSON.stringify(extra)];
      if (this.cfg.user) args.push('-u', this.cfg.user);
      await run('ansible-playbook', args);
      return `ansible deployed to ${target.host}`;
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}

export function makeDeployer(target) {
  const d = target.deploy;
  if (d.type === 'file') return new FileDeployer(d);
  if (d.type === 'ansible') return new AnsibleDeployer(d);
  throw new Error(`unknown deploy type: ${d.type}`);
}
