/** Export the actual read-only React demo into one portable, offline HTML file. */
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const seed = JSON.parse(await readFile(resolve(root, 'data/seed.json'), 'utf8'));
if (!seed.complete || seed.people.length < 25 || seed.dates.length < 25) throw new Error('A complete, validated cohort is required before exporting.');
const portraits = new Map();
const peopleToEmbed = [...seed.people, ...seed.dates.flatMap(date => Object.values(date.profileSnapshots || {}))];
for (const person of peopleToEmbed) {
  if (person.imageUrl?.startsWith('/portraits/')) {
    const path = person.imageUrl;
    if (!portraits.has(path)) {
      const bytes = await readFile(resolve(root, 'public', path.slice(1)));
      portraits.set(path, `data:image/jpeg;base64,${bytes.toString('base64')}`);
    }
    person.imageUrl = portraits.get(path);
  }
}

const bootstrap = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import Page from './app/page.tsx';
import { rankPeople } from './src/lib/engine.ts';
const seed = ${JSON.stringify(seed)};
try { const url = new URL(location.href); url.searchParams.set('demo','1'); history.replaceState(null,'',url); } catch {}
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url, location.href);
  if (!url.pathname.startsWith('/api/')) return originalFetch(input, init);
  if (init?.method && init.method !== 'GET') return new Response(JSON.stringify({error:'This is the read-only local export. Live processing requires the hosted application.'}), {status:405});
  let value;
  if (url.pathname === '/api/state') value = {people:seed.people,dates:seed.dates,jobs:[],providerStatus:{},stats:{people:seed.people.length,ready:seed.people.length,verified:seed.people.length,dates:seed.dates.length,completedDates:seed.dates.length}};
  else if (url.pathname === '/api/rankings') { const person=seed.people.find(p=>p.id===url.searchParams.get('personId')); value={rankings:person?rankPeople(person,seed.people,seed.dates):[]}; }
  else return new Response(JSON.stringify({error:'Endpoint unavailable in the local export.'}),{status:404});
  return new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
};
createRoot(document.getElementById('app')).render(React.createElement(Page));
`;
const result = await build({
  stdin: { contents: bootstrap, resolveDir: root, sourcefile: 'offline-demo.tsx', loader: 'tsx' },
  bundle: true, write: false, minify: true, format: 'iife', platform: 'browser', target: 'es2022',
  define: { 'process.env.NODE_ENV': '"production"' }, jsx: 'automatic',
});
let css = (await readFile(resolve(root, 'app/globals.css'), 'utf8')).replace(/^@import[^;]+;/gm, '');
for (const match of [...css.matchAll(/url\(\/fonts\/([^\)]+)\)/g)]) {
  const bytes = await readFile(resolve(root, 'public/fonts', match[1]));
  css = css.replaceAll(match[0], `url(data:font/ttf;base64,${bytes.toString('base64')})`);
}
const script = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const mode = seed.mode === 'llm' ? 'Offline model-generated simulations' : 'Rules-based preview';
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>After Hours — saved local demo</title><style>${css}
.local-export-note{position:fixed;bottom:0;left:0;right:0;z-index:1000;padding:9px 16px;background:#4a1526;color:#fff7ee;font:12px/1.4 system-ui;text-align:center;box-shadow:0 -1px 8px #0001}.main-footer{padding-bottom:50px!important}.topbar .button,.sidebar-settings,.demo-banner button,.demo-own-button,.main-footer button{display:none!important}
</style></head><body><div id="app"></div><div class="local-export-note">Local saved demo · ${mode} · 25 real profiles · Read-only export; live deployment is separate.</div><script>${script}</script></body></html>`;
await mkdir(resolve(root, 'outputs'), { recursive: true });
const path = resolve(root, 'outputs/after-hours-demo.html');
await writeFile(path, html);
console.log(JSON.stringify({ path, people: seed.people.length, dates: seed.dates.length, mode: seed.mode, bytes: Buffer.byteLength(html) }));
