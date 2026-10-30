// Validates every file in resources/ and writes dist/resources.json for the website.
// Usage: node scripts/build.mjs [--check]   (--check validates only, without writing dist/)
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, LEAGUES, TYPES, LEVELS, loadAll } from './lib.mjs';

const { resources, errors } = loadAll();
if (errors.length) {
  console.error(`${errors.length} problem(s) found:\n` + errors.map(e => '  - ' + e).join('\n'));
  process.exit(1);
}
console.log(`${resources.length} resources are valid.`);
if (process.argv.includes('--check')) process.exit(0);

const out = {
  generated: new Date().toISOString(),
  count: resources.length,
  labels: { leagues: LEAGUES, types: TYPES, levels: LEVELS },
  resources: resources.map(({ file, ...r }) => ({ id: file.replace(/^resources\//, '').replace(/\.ya?ml$/, ''), ...r })),
};
const dist = join(ROOT, 'dist');
mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, 'resources.json'), JSON.stringify(out));
copyFileSync(join(ROOT, 'site', 'index.html'), join(dist, 'index.html'));
console.log('Wrote dist/resources.json');
