// Checks that every link in the given resource files (or all of them) still works.
// Usage: node scripts/check-links.mjs [--report report.md] [file ...]
// Exit code 1 when a link is broken. Sites that block automated requests are reported
// as "could not verify" without failing, since they work fine in a browser.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadAll, listFiles } from './lib.mjs';

const args = process.argv.slice(2);
const reportAt = args.indexOf('--report');
const reportFile = reportAt >= 0 ? args.splice(reportAt, 2)[1] : null;
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
  for (let attempt = 0; attempt < (archive ? 4 : 2); attempt++) {
    if (attempt) await sleep(archive ? 5000 * attempt : 2000);
    try {
      const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': UA, Accept: '*/*' }, signal: AbortSignal.timeout(archive ? 90000 : 30000) });
      res.body?.cancel().catch(() => {});
      if (res.ok) return { status: 'ok' };
      last = `HTTP ${res.status}`;
      if ((res.status === 403 || res.status === 429) && walled) return { status: 'unverified', detail: last };
      if (res.status === 404 || res.status === 410) break;
    } catch (e) {
      last = e.name === 'TimeoutError' ? 'timed out' : (e.cause?.code || e.message);
    }
  }
  return { status: 'broken', detail: last };
}

const jobs = resources.flatMap(r => [{ r, url: r.url, what: 'link' }, ...(r.links || []).map(x => ({ r, url: x.url, what: x.label }))]);
const archiveJobs = jobs.filter(j => new URL(j.url).hostname === 'web.archive.org');
const otherJobs = jobs.filter(j => !archiveJobs.includes(j));

async function runPool(list, size) {
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < list.length) { const j = list[i++]; j.result = await check(j.url); }
  }));
}
// The Wayback Machine throttles parallel requests, so its links go one at a time.
await Promise.all([runPool(otherJobs, 6), runPool(archiveJobs, 1)]);

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
