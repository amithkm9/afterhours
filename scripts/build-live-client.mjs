/** Build the live React client; all data and mutations still use the real /api routes. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

export async function buildLiveClient(root = fileURLToPath(new URL('../', import.meta.url))) {
  const client = resolve(root, 'dist/client');
  const assets = resolve(client, 'assets');
  await mkdir(assets, { recursive: true });
  const result = await build({
    stdin: {
      contents: "import React from 'react'; import { createRoot } from 'react-dom/client'; import Page from './app/page.tsx'; createRoot(document.getElementById('app')).render(React.createElement(Page));",
      resolveDir: root, sourcefile: 'live-client.tsx', loader: 'tsx',
    },
    outdir: assets, entryNames: 'live-[hash]', bundle: true, write: false,
    minify: true, format: 'esm', platform: 'browser', target: 'es2022',
    define: { 'process.env.NODE_ENV': '"production"' }, jsx: 'automatic', metafile: true,
  });
  // Fail the build if a future client import accidentally embeds server data or code.
  const forbiddenInputs = Object.keys(result.metafile.inputs).filter(path => /(?:^|\/)(?:data\/|src\/lib\/(?:engine|providers|service|store)\.)/.test(path));
  assert.deepEqual(forbiddenInputs, [], 'The live client must not bundle saved data or server modules.');
  assert.equal(result.outputFiles.length, 1, 'Expected one standalone live JavaScript bundle.');
  const javascript = result.outputFiles[0];
  await writeFile(javascript.path, javascript.contents);

  const css = await readFile(resolve(root, 'app/globals.css'), 'utf8');
  const cssName = `live-${createHash('sha256').update(css).digest('hex').slice(0, 12)}.css`;
  await writeFile(resolve(assets, cssName), css);
  await cp(resolve(root, 'public'), client, { recursive: true });
  const scriptUrl = `/assets/${basename(javascript.path)}`;
  const cssUrl = `/assets/${cssName}`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="Evidence-backed profiles, thoughtful agent dates, and explained matches. Built from LinkedIn and public Instagram."><title>After Hours — Let your agents break the ice</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="${cssUrl}"></head><body><div id="app"></div><noscript>After Hours needs JavaScript to load profiles and agent conversations.</noscript><script type="module" src="${scriptUrl}"></script></body></html>`;
  await writeFile(resolve(client, 'index.html'), html);
  // Local fonts remain static assets; missing font files should block deployment.
  for (const match of css.matchAll(/url\(\/fonts\/([^\)]+)\)/g)) {
    assert.ok((await readFile(resolve(client, 'fonts', match[1]))).length, `Missing font ${match[1]}`);
  }
  return { html: relative(root, resolve(client, 'index.html')), javascript: scriptUrl, css: cssUrl, javascriptBytes: javascript.contents.length, bundledInputs: Object.keys(result.metafile.inputs).length };
}
