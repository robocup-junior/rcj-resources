// Turns a "Suggest a resource" issue into a resource file.
// Reads the issue body from the ISSUE_BODY environment variable (or a file given as the first argument).
// On success, writes the file and prints its path. On failure, prints the problems and exits 1.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { stringify } from 'yaml';
import { ROOT, RESOURCES_DIR, LEAGUES, TYPES, LEVELS, AUDIENCES, slugify, validate, loadAll } from './lib.mjs';

const body = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : process.env.ISSUE_BODY || '';

// Issue forms render each field as "### Label" followed by the answer.
const sections = {};
for (const part of body.replace(/\r\n/g, '\n').split(/^### /m).slice(1)) {
  const nl = part.indexOf('\n');
  const label = part.slice(0, nl).trim();
  const value = part.slice(nl + 1).trim();
  sections[label] = value === '_No response_' ? '' : value;
}
const get = label => (sections[label] || '').trim();
const byLabel = map => Object.fromEntries(Object.entries(map).map(([k, v]) => [v.toLowerCase(), k]));

const ticked = (label, map) => get(label).split('\n')
  .filter(l => /^- \[x\]/i.test(l.trim()))
  .map(l => byLabel(map)[l.trim().replace(/^- \[x\]\s*/i, '').toLowerCase()])
  .filter(Boolean);
const leagues = ticked('Leagues', LEAGUES);
const audience = ticked('Especially useful for (optional)', AUDIENCES);

const r = {
  title: get('Title'),
  url: get('Link'),
  description: get('Description').replace(/\s*\n\s*/g, ' '),
  leagues,
  type: byLabel(TYPES)[get('Type of resource').toLowerCase()],
  level: byLabel(LEVELS)[get('Level').toLowerCase()],
  source: get('Source'),
};
if (audience.length) r.audience = audience;
if (get('Authors (optional)')) r.authors = get('Authors (optional)');
if (get('Year (optional)')) r.year = Number(get('Year (optional)'));

const problems = validate(r);
const key = (r.url || '').replace(/\/+$/, '').toLowerCase();
const existing = loadAll().resources.find(x => x.url.replace(/\/+$/, '').toLowerCase() === key);
if (existing) problems.push(`this link is already in the library as \`${existing.file}\``);
if (problems.length) {
  console.log(problems.map(p => '- ' + p).join('\n'));
  process.exit(1);
}

const grouped = (r.type === 'werob' || r.type === 'research') && r.year;
const dir = grouped ? join(RESOURCES_DIR, r.type) : RESOURCES_DIR;
const base = (grouped ? r.year + '-' : '') + slugify(r.title);
let file = join(dir, base + '.yml');
for (let i = 2; existsSync(file); i++) file = join(dir, `${base}-${i}.yml`);
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, stringify(r, { lineWidth: 0 }));
console.log(relative(ROOT, file).replace(/\\/g, '/'));
