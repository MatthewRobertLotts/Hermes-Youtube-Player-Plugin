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
  'SECURITY.md',
  '.github/ISSUE_TEMPLATE/bug_report.yml',
  'TROUBLESHOOTING.md',
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

for (const file of ['install-youtube-float.ps1', `install-youtube-float-${version}.ps1`, 'install-youtube-float.sh', `install-youtube-float-${version}.sh`]) {
  const text = read(file);
  if (!text.includes(version)) fail(`${file} does not reference ${version}`);
  if (!text.includes('desktop-plugins')) fail(`${file} does not target desktop-plugins`);
}

const syntax = spawnSync('node', ['--check', path.join(root, 'plugin.js')], { encoding: 'utf8' });
if (syntax.status !== 0) fail(`node --check failed\n${syntax.stderr}`);
const testFiles = fs.readdirSync(path.join(root, 'tests')).filter(f => f.endsWith('.test.mjs')).map(f => path.join('tests', f));
if (!testFiles.length) fail('no Node test files found');
const tests = spawnSync('node', ['--test', ...testFiles], { cwd: root, encoding: 'utf8' });
if (tests.status !== 0) fail(`node --test failed\n${tests.stdout}\n${tests.stderr}`);

console.log(`check-release: ${version} ok`);
