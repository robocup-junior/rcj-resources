// Shared helpers: the allowed values, loading resource files and validating them.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from 'yaml';

export const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
export const RESOURCES_DIR = join(ROOT, 'resources');

// Keys are what the files use; labels are what people see on the website and in the issue form.
export const LEAGUES = {
  soccer: 'Soccer',
  line: 'Rescue Line',
  maze: 'Rescue Maze',
  sim: 'Rescue Simulation',
  onstage: 'OnStage',
  general: 'Any league',
};
export const TYPES = {
  rules: 'Rules and guides',
  tutorial: 'Tutorials',
  code: 'Code and tools',
  field: 'Fields and equipment',
  video: 'Videos and inspiration',
  community: 'Community',
  werob: 'WEROB talks and papers',
};
export const LEVELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

const FIELDS = ['title', 'url', 'description', 'leagues', 'type', 'level', 'source', 'year', 'authors', 'links'];
const REQUIRED = ['title', 'url', 'description', 'leagues', 'type', 'level', 'source'];

export function slugify(s) {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60).replace(/-$/, '');
}

export function listFiles(dir = RESOURCES_DIR) {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return listFiles(p);
    return /\.ya?ml$/.test(name) ? [p] : [];
  }).sort();
}

const isUrl = s => typeof s === 'string' && /^https?:\/\/[^\s]+$/.test(s);
const isText = s => typeof s === 'string' && s.trim().length > 0;

// Returns a list of problems with one resource; empty means it is valid.
export function validate(r) {
  const errors = [];
  if (!r || typeof r !== 'object' || Array.isArray(r)) return ['the file must contain one resource (a set of key: value fields)'];
  for (const k of Object.keys(r)) if (!FIELDS.includes(k)) errors.push(`unknown field "${k}" (allowed: ${FIELDS.join(', ')})`);
  for (const k of REQUIRED) if (r[k] === undefined || r[k] === null || r[k] === '') errors.push(`missing "${k}"`);
  if (r.title !== undefined && !isText(r.title)) errors.push('"title" must be text');
  if (isText(r.title) && r.title.length > 200) errors.push('"title" is longer than 200 characters');
  if (r.url !== undefined && !isUrl(r.url)) errors.push('"url" must be a full link starting with https://');
  if (r.description !== undefined && !isText(r.description)) errors.push('"description" must be text');
  if (isText(r.description) && r.description.length > 300) errors.push('"description" is longer than 300 characters; keep it to one or two sentences');
  if (r.leagues !== undefined) {
    if (!Array.isArray(r.leagues) || !r.leagues.length) errors.push('"leagues" must be a list with at least one league');
    else for (const l of r.leagues) if (!LEAGUES[l]) errors.push(`unknown league "${l}" (use: ${Object.keys(LEAGUES).join(', ')})`);
  }
  if (r.type !== undefined && !TYPES[r.type]) errors.push(`unknown type "${r.type}" (use: ${Object.keys(TYPES).join(', ')})`);
  if (r.level !== undefined && !LEVELS[r.level]) errors.push(`unknown level "${r.level}" (use: ${Object.keys(LEVELS).join(', ')})`);
  if (r.source !== undefined && !isText(r.source)) errors.push('"source" must be text');
  if (r.year !== undefined && !(Number.isInteger(r.year) && r.year >= 1997 && r.year <= 2100)) errors.push('"year" must be a four-digit year');
  if (r.authors !== undefined && !isText(r.authors)) errors.push('"authors" must be text');
  if (r.type === 'werob' && r.year === undefined) errors.push('WEROB resources need a "year"');
  if (r.links !== undefined) {
    if (!Array.isArray(r.links)) errors.push('"links" must be a list of {label, url}');
    else r.links.forEach((x, i) => {
      if (!x || !isText(x.label) || !isUrl(x.url) || Object.keys(x).some(k => !['label', 'url'].includes(k))) errors.push(`links[${i}] needs exactly a "label" and a full "url"`);
    });
  }
  return errors;
}

// Loads every resource file. Returns {resources, errors} where errors are prefixed with the file path.
export function loadAll(files = listFiles()) {
  const resources = [], errors = [];
  for (const file of files) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    let data;
    try { data = parse(readFileSync(file, 'utf8')); }
    catch (e) { errors.push(`${rel}: not valid YAML: ${e.message.split('\n')[0]}`); continue; }
    const problems = validate(data);
    problems.forEach(p => errors.push(`${rel}: ${p}`));
    if (!problems.length) resources.push({ file: rel, ...data });
  }
  const seen = new Map();
  for (const r of resources) {
    const key = r.url.replace(/\/+$/, '').toLowerCase();
    if (seen.has(key)) errors.push(`${r.file}: same url as ${seen.get(key)}`);
    else seen.set(key, r.file);
  }
  return { resources, errors };
}
