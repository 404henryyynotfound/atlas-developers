import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const suiteDir = path.resolve(scriptsDir, '..');
const monorepo = process.env.ATLAS_MONOREPO || path.resolve(suiteDir, '..', '..');
const out = path.join(suiteDir, 'web-build');

const apps = [
  ['meridian', path.join(monorepo, 'meridian-finance')],
  ['airo', path.join(monorepo, 'airo-finance')],
  ['tandem', path.join(monorepo, 'tandem-finance')],
  ['business', path.join(monorepo, 'atlas-business')],
  ['calendar', path.join(monorepo, 'atlas-calendar')],
  ['developers', path.resolve(suiteDir, '..', 'web')],
];

const excluded = /(^|\/)(node_modules|\.git|dist|web-build)(\/|$)|package-lock\.json|CNAME$/;
const copyFilter = (source) => !excluded.test(source.replace(/\\/g, '/'));

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.cpSync(path.join(suiteDir, 'shell'), out, { recursive: true, filter: copyFilter });

const manifest = [];
for (const [id, source] of apps) {
  if (!fs.existsSync(path.join(source, 'index.html'))) {
    throw new Error(`Missing bundled app ${id}: ${path.join(source, 'index.html')}`);
  }
  const target = path.join(out, 'apps', id);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true, filter: copyFilter });
  manifest.push({ id, path: `/apps/${id}/index.html` });
  console.log(`Bundled ${id.padEnd(10)} <- ${source}`);
}

fs.writeFileSync(path.join(out, 'apps.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Atlas Suite bundle ready: ${out}`);
