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
const tests = spawnSync('node', ['--test', 'tests/*.test.mjs'], { cwd: root, encoding: 'utf8' });
if (tests.status !== 0) fail(`node --test failed\n${tests.stdout}\n${tests.stderr}`);

console.log(`check-release: ${version} ok`);
