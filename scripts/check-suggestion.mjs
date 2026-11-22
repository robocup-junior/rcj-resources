// Checks a "Suggest a resource" issue for links that are already in the library or in an earlier open suggestion.
// Reads the issue body from ISSUE_BODY, the issue number from ISSUE_NUMBER, and the open suggestions
// (a JSON list of {number, body}, as `gh issue list --json number,body` prints it) from the file given as the first argument.
// Prints a Markdown comment listing the duplicates, or nothing if there are none.
import { readFileSync } from 'node:fs';
import { loadAll, parseIssue, parseExtraLinks, findDuplicates, normalizeUrl } from './lib.mjs';

const linksIn = body => {
  const get = parseIssue(body);
  return [get('Link'), ...parseExtraLinks(get('Other links (optional)')).links.map(x => x.url)].filter(l => /^https?:\/\//.test(l));
};

const number = Number(process.env.ISSUE_NUMBER);
const links = linksIn(process.env.ISSUE_BODY);
const open = process.argv[2] ? JSON.parse(readFileSync(process.argv[2], 'utf8')) : [];

const repo = `https://github.com/${process.env.GITHUB_REPOSITORY || 'robocup-junior/rcj-resources'}`;
const lines = [];
for (const d of findDuplicates(links, loadAll().resources)) {
  lines.push(`- ${d.link} is already in the library: [\`${d.file}\`](${repo}/blob/main/${d.file})`);
}
const keys = new Map(links.map(l => [normalizeUrl(l), l]));
for (const other of open) {
  // Only earlier suggestions count, so the original is never flagged as a copy of a later one.
  if (!(other.number < number)) continue;
  for (const l of linksIn(other.body)) {
    if (keys.has(normalizeUrl(l))) lines.push(`- ${keys.get(normalizeUrl(l))} is already suggested in #${other.number}`);
  }
}
if (lines.length) {
  console.log([
    'This suggestion may be a duplicate:', '',
    ...[...new Set(lines)], '',
    'If it is, a maintainer can close this issue as a duplicate. If it is different (for example, a newer version), edit the link or explain in a comment. This check runs again whenever the issue is edited.',
  ].join('\n'));
}
