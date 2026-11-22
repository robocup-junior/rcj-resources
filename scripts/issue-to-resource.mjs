// Turns a "Suggest a resource" issue into a resource file.
// Reads the issue body from the ISSUE_BODY environment variable (or a file given as the first argument).
// On success, writes the file and prints its path. On failure, prints the problems and exits 1.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { stringify } from 'yaml';
import { ROOT, RESOURCES_DIR, LEAGUES, TYPES, LEVELS, AUDIENCES, slugify, validate, loadAll, parseIssue, parseExtraLinks, findDuplicates, linksOf } from './lib.mjs';

const body = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : process.env.ISSUE_BODY || '';

const get = parseIssue(body);
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
const extra = parseExtraLinks(get('Other links (optional)'));
if (extra.links.length) r.links = extra.links;

const problems = [...validate(r), ...extra.problems];
for (const d of findDuplicates(linksOf(r), loadAll().resources)) {
  problems.push(`${d.link} is already in the library, in \`${d.file}\` (${d.title})`);
}
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
