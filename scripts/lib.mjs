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
  teaching: 'Teaching and curriculum',
  research: 'Research papers',
  werob: 'WEROB talks and papers',
};
export const LEVELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};
// Optional. Leave it out for resources aimed at teams; list who else it is especially useful for.
export const AUDIENCES = {
  students: 'Students',
  educators: 'Educators',
  organizers: 'Organizers',
};

const FIELDS = ['title', 'url', 'description', 'leagues', 'type', 'level', 'source', 'audience', 'year', 'authors', 'links'];
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
  if (r.audience !== undefined) {
    if (!Array.isArray(r.audience) || !r.audience.length) errors.push('"audience" must be a list, or left out');
    else for (const a of r.audience) if (!AUDIENCES[a]) errors.push(`unknown audience "${a}" (use: ${Object.keys(AUDIENCES).join(', ')})`);
  }
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
    const key = normalizeUrl(r.url);
    if (seen.has(key)) errors.push(`${r.file}: same url as ${seen.get(key)}`);
    else seen.set(key, r.file);
  }
  return { resources, errors };
}

// Query parameters that never change which page a link opens (tracking, start time, share codes).
const IGNORED_PARAMS = /^(utm_.*|fbclid|gclid|mc_[a-z]+|ref|ref_src|si|feature|t|start|time_continue|ab_channel|pp|usp)$/i;

// Reduces a link to a key that is the same for every spelling of the same page, so duplicates can be found:
// http/https, "www.", letter case, a trailing slash and tracking parameters are ignored, and
// YouTube, Google Drive and Google Docs links are reduced to the ID of the video, file or document.
export function normalizeUrl(link) {
  let u;
  try { u = new URL(String(link).trim()); } catch { return String(link).trim().replace(/\/+$/, '').toLowerCase(); }
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, '');
  const path = u.pathname;
  let m;
  if (host === 'youtu.be' && (m = path.match(/^\/([\w-]{11})/))) return 'youtube:' + m[1];
  if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'music.youtube.com') {
    if (u.searchParams.get('v')) return 'youtube:' + u.searchParams.get('v');
    if ((m = path.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/))) return 'youtube:' + m[1];
    if (path.replace(/\/+$/, '') === '/playlist' && u.searchParams.get('list')) return 'youtube-playlist:' + u.searchParams.get('list');
  }
  if (host === 'drive.google.com' || host === 'docs.google.com') {
    if ((m = path.match(/\/(?:file|document|spreadsheets|presentation|forms|drawings)\/(?:u\/\d+\/)?d\/(e\/)?([\w-]{10,})/))) return 'google:' + (m[1] || '') + m[2];
    if ((m = path.match(/\/drive\/(?:u\/\d+\/)?folders\/([\w-]{10,})/))) return 'google:' + m[1];
    if (u.searchParams.get('id')) return 'google:' + u.searchParams.get('id');
  }
  const params = [...u.searchParams].filter(([k]) => !IGNORED_PARAMS.test(k)).sort(([a], [b]) => a.localeCompare(b));
  const query = params.length ? '?' + new URLSearchParams(params).toString() : '';
  // Keep "#..." because it often points to a different section of the same page.
  return (host + path.replace(/\/+$/, '') + query + u.hash).toLowerCase();
}

// Every link in a resource: the main link and any extra links.
export const linksOf = r => [r.url, ...(r.links || []).map(x => x.url)].filter(Boolean);

// Finds resources that already contain any of the given links (as their main link or an extra link).
// Returns [{link, file, title, url}] with one entry per match.
export function findDuplicates(links, resources) {
  const wanted = new Map(links.map(l => [normalizeUrl(l), l]));
  const found = [];
  for (const r of resources) for (const url of linksOf(r)) {
    const key = normalizeUrl(url);
    if (wanted.has(key)) found.push({ link: wanted.get(key), file: r.file, title: r.title, url });
  }
  return found;
}

// Reads a "Suggest a resource" issue body. Issue forms render each field as "### Label" followed by the answer.
export function parseIssue(body) {
  const sections = {};
  for (const part of String(body || '').replace(/\r\n/g, '\n').split(/^### /m).slice(1)) {
    const nl = part.indexOf('\n');
    if (nl < 0) continue;
    const label = part.slice(0, nl).trim();
    const value = part.slice(nl + 1).trim();
    sections[label] = value === '_No response_' ? '' : value;
  }
  return label => (sections[label] || '').trim();
}

// Reads the "Other links" field: one link per line, with a short label before it, such as
// "Code on GitHub: https://github.com/...". Returns {links: [{label, url}], problems: [...]}.
export function parseExtraLinks(text) {
  const links = [], problems = [];
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim().replace(/^[-*]\s+/, '');
    if (!line) continue;
    const md = line.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
    if (md) { links.push({ label: md[1].trim(), url: md[2] }); continue; }
    const m = line.match(/https?:\/\/\S+/);
    if (!m) { problems.push(`"Other links": no link found in "${line}"`); continue; }
    const url = m[0].replace(/[).,;>]+$/, '');
    const label = line.slice(0, m.index).replace(/[\s:\-–—|(<]+$/, '').trim();
    if (!label) { problems.push(`"Other links": add a short label before ${url}, for example "Code on GitHub: ${url}"`); continue; }
    links.push({ label, url });
  }
  return { links, problems };
}
