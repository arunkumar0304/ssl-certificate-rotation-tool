import { LocalCaIssuer } from './localCa.js';
import { AcmeIssuer } from './acme.js';

export function makeIssuer(cfg) {
  switch (cfg.issuer.type) {
    case 'localCa': return new LocalCaIssuer(cfg.issuer.localCa);
    case 'acme': return new AcmeIssuer(cfg.issuer.acme);
    default: throw new Error(`unknown issuer type: ${cfg.issuer.type}`);
  }
}
