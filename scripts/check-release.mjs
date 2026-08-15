import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const fail = msg => { console.error(`check-release: ${msg}`); process.exit(1); };
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));

const manifest = JSON.parse(read('manifest.json'));
if (manifest.id !== 'youtube-float') fail('plugin id changed');
if (manifest.main !== 'plugin.js') fail('manifest main must be plugin.js');
if (!manifest.routes?.includes('/youtube')) fail('manifest must include /youtube route');
if (!/^v\d+\.\d+(?:\.\d+)?$/.test(manifest.version)) fail('manifest version must be vX.Y or vX.Y.Z');

const version = manifest.version;
const required = [
  'plugin.js',
  'manifest.json',
  'README.md',
  'CHANGELOG.md',
  'install-youtube-float.ps1',
  `install-youtube-float-${version}.ps1`,
  'install-youtube-float.sh',
  `install-youtube-float-${version}.sh`,
  'src/youtube-core.mjs',
  'tests/youtube-core.test.mjs',
  'tests/plugin-runtime-parity.test.mjs',
  'tests/fixtures/youtube-structures.mjs',
  'scripts/build-release-zip.py',
  'scripts/changelog-release-notes.py',
  'scripts/publish-release.py',
  'SECURITY.md',
  '.github/ISSUE_TEMPLATE/bug_report.yml',
  'TROUBLESHOOTING.md',
  'CONTRIBUTING.md',
  'ARCHITECTURE.md',
  'INTEGRATION_API.md',
  'docs/api-example-consumer.md',
  'PERFORMANCE.md',
  'docs/release-tests/v3.129-responsive-ux-accessibility.md',
];
for (const file of required) if (!exists(file)) fail(`missing ${file}`);

const plugin = read('plugin.js');
const versionMatch = plugin.match(/const VERSION = '([^']+)'/);
if (!versionMatch) fail('plugin VERSION constant missing');
if (versionMatch[1] !== version) fail(`plugin VERSION ${versionMatch[1]} != manifest ${version}`);
if (plugin.includes(`${version}-test`) || plugin.includes(`${version}-youtube`)) fail('plugin version must not include test/descriptive suffix');
if (!plugin.includes("id: 'youtube-float'")) fail('plugin id missing/changed in plugin.js');
if (!plugin.includes("path: '/youtube'")) fail('/youtube route missing from plugin.js');
if (!plugin.includes(`YouTube ${version} ★`)) fail('pane title does not match version');

const forbiddenSecurityPatterns = [
  /document\.cookie/,
  /getAllCookies\s*\(/,
  /cookies\.get/,
  /sessionStorage\.(?:getItem|setItem)\s*\(/,
  /localStorage\.getItem\(['"][^'"]*(?:cookie|token|password|credential)[^'"]*['"]\)/i,
  /navigator\.clipboard\.writeText\([^)]*(?:cookie|token|password|credential)/i,
];
for (const pattern of forbiddenSecurityPatterns) {
  if (pattern.test(plugin)) fail(`forbidden security/privacy pattern in plugin.js: ${pattern}`);
}
const security = read('SECURITY.md');
for (const needle of ['persistent Electron webview partition', 'does **not** directly handle YouTube login credentials', 'should not store, print, copy, or intentionally expose', 'executeJavaScript']) {
  if (!security.includes(needle)) fail(`SECURITY.md missing ${needle}`);
}

const troubleshooting = read('TROUBLESHOOTING.md');
for (const needle of ['Installer says it worked', 'Signed-in shelves are empty', 'History shows wrong or missing videos', 'Big Screen does not cover the Windows taskbar', 'What to include in a bug report']) {
  if (!troubleshooting.includes(needle)) fail(`TROUBLESHOOTING.md missing ${needle}`);
}

const issueTemplate = read('.github/ISSUE_TEMPLATE/bug_report.yml');
for (const needle of ['Bug report', 'Plugin version', 'Diagnostics', 'Copy diagnostics']) {
  if (!issueTemplate.includes(needle)) fail(`bug report template missing ${needle}`);
}

const readme = read('README.md');
for (const needle of [`Current-${version}-blue`, `install-youtube-float-${version}.ps1`, `install-youtube-float-${version}.sh`, `YouTube ${version} ★`, 'actions/workflows/check.yml/badge.svg']) {
  if (!readme.includes(needle)) fail(`README missing ${needle}`);
}

const changelog = read('CHANGELOG.md');
if (!changelog.split('\n').slice(0, 5).includes(`## ${version}`)) fail('CHANGELOG top entry is not current version');
const changelogVersions = [...changelog.matchAll(/^## (v\d+\.\d+(?:\.\d+)?)$/gm)].map(m => m[1]);
const duplicateChangelogVersions = changelogVersions.filter((v, i) => changelogVersions.indexOf(v) !== i);
if (duplicateChangelogVersions.length) fail(`duplicate CHANGELOG versions: ${[...new Set(duplicateChangelogVersions)].join(', ')}`);
// The changelog is the source of truth for release notes, so a deleted heading silently fuses one
// version's notes into another. Require a bijection between CHANGELOG headings and per-version
// docs/versions/vX.Y.md files (every heading must have a doc, every doc a heading). This catches
// a deleted/fused entry without assuming a contiguous integer series (releases need not be dense).
// Scoped to the modern series (minor >= 100) so old one-off entries (e.g. "## v3.0 ★") don't trip.
const isModern = v => /^v\d+\.\d+(?:\.\d+)?$/.test(v) && Number((v.match(/^v(\d+)\.(\d+)/) || [])[2]) >= 100;
const changelogSet = new Set(changelogVersions);
const docDir = path.join(root, 'docs', 'versions');
const docVersions = fs.existsSync(docDir)
  ? fs.readdirSync(docDir).filter(f => /^v\d+\.\d+(?:\.\d+)?\.md$/.test(f)).map(f => f.replace(/\.md$/, ''))
  : [];
const changelogWithoutDoc = changelogVersions.filter(v => isModern(v) && !docVersions.includes(v));
const docWithoutChangelog = docVersions.filter(v => isModern(v) && !changelogSet.has(v));
if (changelogWithoutDoc.length) fail(`CHANGELOG entries without a matching docs/versions file: ${changelogWithoutDoc.join(', ')}`);
if (docWithoutChangelog.length) fail(`docs/versions files without a CHANGELOG entry: ${docWithoutChangelog.join(', ')}`);
// Guard against a broken/mangled changelog body: if the current version's entry contains any
// other version heading, its body is contaminated and would corrupt the generated release notes.
const entryMatch = changelog.match(new RegExp(`^## ${version}\\n(?<body>.*?)(?=^## v\\d+\\.\\d+(?:\\.\\d+)?\\n|\\Z)`, 'ms'));
if (!entryMatch || !entryMatch.groups.body.trim()) fail('CHANGELOG current entry is empty');
if (/^## v\d+\.\d+(?:\.\d+)?$/m.test(entryMatch.groups.body)) fail('CHANGELOG current entry body contains another version heading (fused entries)');

for (const file of ['install-youtube-float.ps1', `install-youtube-float-${version}.ps1`, 'install-youtube-float.sh', `install-youtube-float-${version}.sh`]) {
  const text = read(file);
  if (!text.includes(version)) fail(`${file} does not reference ${version}`);
  if (!text.includes('desktop-plugins')) fail(`${file} does not target desktop-plugins`);
}

const syntax = spawnSync('node', ['--check', path.join(root, 'plugin.js')], { encoding: 'utf8' });
if (syntax.status !== 0) fail(`node --check failed\n${syntax.stderr}`);
const testFiles = fs.readdirSync(path.join(root, 'tests'))
  .filter(f => f.endsWith('.test.mjs'))
  .map(f => path.join('tests', f));
if (!testFiles.length) fail('no Node test files found');
const tests = spawnSync('node', ['--test', ...testFiles], { cwd: root, encoding: 'utf8' });
if (tests.status !== 0) fail(`node --test failed\n${tests.stdout}\n${tests.stderr}`);

console.log(`check-release: ${version} ok`);
