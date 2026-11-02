import fs from 'node:fs';

export function loadConfig(path = process.env.CERTROTATOR_CONFIG || 'config.json') {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}
