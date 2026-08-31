import { build } from 'esbuild';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = resolve(root, 'src');
const out = resolve(root, 'dist');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const entries = [
  ['background.ts', 'background.js'],
  ['collector.ts', 'collector.js'],
  ['popup.ts', 'popup.js'],
  ['options.ts', 'options.js'],
];

for (const [entry, outfile] of entries) {
  await build({
    absWorkingDir: root,
    entryPoints: [resolve(src, entry)],
    outfile: resolve(out, outfile),
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'chrome110',
    sourcemap: false,
    legalComments: 'none',
  });
}

await cp(resolve(src, 'popup.html'), resolve(out, 'popup.html'));
await cp(resolve(src, 'options.html'), resolve(out, 'options.html'));
await cp(resolve(src, 'styles.css'), resolve(out, 'styles.css'));
await cp(resolve(root, '../schemas/ai-response.schema.json'), resolve(out, 'ai-response.schema.json'));

const manifest = {
  manifest_version: 3,
  name: 'Forum Knowledge Base',
  description: 'Локальный сбор новых сообщений и подготовка материалов для ручного анализа ИИ.',
  version: '0.2.1',
  action: {
    default_title: 'Forum Knowledge Base',
    default_popup: 'popup.html',
  },
  options_page: 'options.html',
  background: {
    service_worker: 'background.js',
  },
  permissions: ['activeTab', 'scripting', 'storage', 'downloads', 'clipboardWrite'],
  host_permissions: [
    'https://4pda.to/*',
    'https://*.4pda.to/*',
    'http://4pda.to/*',
    'http://*.4pda.to/*',
    'http://127.0.0.1/*',
    'http://localhost/*',
  ],
};
await writeFile(resolve(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Extension built in ${out}`);
