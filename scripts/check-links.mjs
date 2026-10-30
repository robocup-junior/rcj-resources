// Checks that every link in the given resource files (or all of them) still works.
// Usage: node scripts/check-links.mjs [--report report.md] [--since <git ref>] [file ...]
// Exit code 1 when a link is broken. Sites that block automated requests are reported
// as "could not verify" without failing, since they work fine in a browser.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadAll, listFiles } from './lib.mjs';

const args = process.argv.slice(2);
const reportAt = args.indexOf('--report');
const reportFile = reportAt >= 0 ? args.splice(reportAt, 2)[1] : null;
const sinceAt = args.indexOf('--since');
const sinceRef = sinceAt >= 0 ? args.splice(sinceAt, 2)[1] : null;
const files = args.length ? args.map(f => resolve(f)) : listFiles();

const { resources, errors } = loadAll(files);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }

// These sites answer scripts with 403/429 (Cloudflare and similar) even when the page exists.
const BOT_WALLED = ['printables.com', 'sagepub.com', 'doi.org', 'thingiverse.com', 'mathworks.com', 'instructables.com', 'youtube.com', 'youtu.be', 'facebook.com', 'linkedin.com'];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 rcj-resources-link-check';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function check(url) {
  const host = new URL(url).hostname.replace(/^www\./, '');
  const walled = BOT_WALLED.some(h => host === h || host.endsWith('.' + h));
  const archive = host === 'web.archive.org';
  let last = '';
  for (let attempt = 0; attempt < (archive ? 3 : 2); attempt++) {
    if (attempt) await sleep(archive ? 5000 * attempt : 2000);
    try {
      const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': UA, Accept: '*/*' }, signal: AbortSignal.timeout(archive ? 45000 : 30000) });
      res.body?.cancel().catch(() => {});
      if (res.ok) return { status: 'ok' };
      last = `HTTP ${res.status}`;
      if ((res.status === 403 || res.status === 429) && walled) return { status: 'unverified', detail: last };
      // 520-524 are Cloudflare's "the site behind me is temporarily unreachable" codes.
      if (res.status >= 520 && res.status <= 524 && attempt) return { status: 'unverified', detail: last + ' (server temporarily unavailable)' };
      if (res.status === 404 || res.status === 410) return { status: 'broken', detail: last };
    } catch (e) {
      last = e.name === 'TimeoutError' ? 'timed out' : (e.cause?.code || e.message);
    }
  }
  // The Wayback Machine throttles and drops connections under load; only a "not found" means a dead copy.
  if (archive) return { status: 'unverified', detail: last + ' (archive busy)' };
  return { status: 'broken', detail: last };
}

// With --since <git ref>, skip links that were already in the library at that ref (used on pull requests).
let known = new Set();
if (sinceRef) {
  const { execFileSync } = await import('node:child_process');
  const { parse } = await import('yaml');
  for (const r of resources) {
    try {
      const old = parse(execFileSync('git', ['show', `${sinceRef}:${r.file}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
      [old.url, ...(old.links || []).map(x => x.url)].forEach(u => known.add(r.file + ' ' + u));
    } catch { /* new file */ }
  }
}
const jobs = resources.flatMap(r => [{ r, url: r.url, what: 'link' }, ...(r.links || []).map(x => ({ r, url: x.url, what: x.label }))])
  .filter(j => !known.has(j.r.file + ' ' + j.url));
const archiveJobs = jobs.filter(j => new URL(j.url).hostname === 'web.archive.org');
const otherJobs = jobs.filter(j => !archiveJobs.includes(j));

async function runPool(list, size) {
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < list.length) { const j = list[i++]; j.result = await check(j.url); }
  }));
}
// The Wayback Machine throttles parallel requests, so its links go one at a time. If it keeps
// refusing, stop asking: the rest are marked unverified rather than taking hours to time out.
async function runArchive(list) {
  let failures = 0;
  for (const j of list) {
    if (failures >= 3) { j.result = { status: 'unverified', detail: 'skipped (archive unavailable)' }; continue; }
    j.result = await check(j.url);
    failures = j.result.status === 'ok' || j.result.status === 'broken' ? 0 : failures + 1;
    await sleep(1000);
  }
}
await Promise.all([runPool(otherJobs, 6), runArchive(archiveJobs)]);

const broken = jobs.filter(j => j.result.status === 'broken');
const unverified = jobs.filter(j => j.result.status === 'unverified');
const line = j => `- \`${j.r.file}\` (${j.what}): ${j.url} (${j.result.detail})`;
let report = `Checked ${jobs.length} links in ${resources.length} resources.\n`;
if (broken.length) report += `\n### Broken (${broken.length})\n\n${broken.map(line).join('\n')}\n`;
if (unverified.length) report += `\n### Could not verify (${unverified.length})\n\nThese sites block automated checks. Open them in a browser if in doubt.\n\n${unverified.map(line).join('\n')}\n`;
if (!broken.length) report += '\nNo broken links.\n';
console.log(report);
if (reportFile) writeFileSync(reportFile, report);
process.exit(broken.length ? 1 : 0);
