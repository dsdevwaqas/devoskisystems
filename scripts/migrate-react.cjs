// One-time import of the reviewed static design into structured React content.
// Runtime pages are edited in src/data/pages.json after this migration.
const fs = require('node:fs');
const { parse, walk, decode } = require('./source-parser.cjs');
const manifest = JSON.parse(fs.readFileSync('site-manifest.json', 'utf8'));
const clean = value => value.replaceAll('https://devoski-old.devoskisystems.com', 'https://devoskisystems.com');
function node(n) {
  if (typeof n === 'string') return clean(decode(n).replace(/&(?:larr|rarr);/g, m => m === '&larr;' ? '←' : '→'));
  const attrs = { ...n.attrs };
  for (const [key, val] of Object.entries(attrs)) {
    attrs[key] = clean(val);
    if (['href', 'src'].includes(key) && val.startsWith('assets/')) attrs[key] = '/' + val;
    if (key === 'href' && !/^(https?:|mailto:|tel:|#)/.test(val)) {
      const [file, hash] = val.split('#');
      attrs[key] = (file === 'index.html' ? '/' : '/' + file.replace(/\.html$/, '') + '/') + (hash ? '#' + hash : '');
    }
  }
  return { tag: n.tag, attrs, children: n.children.map(node) };
}
const result = {};
for (const p of manifest) {
  const html = fs.readFileSync(p.page, 'utf8');
  let main;
  walk(parse(html), n => { if (n.tag === 'main') main = n; });
  result[p.source] = { title: p.title, description: decode(html.match(/<meta name="description" content="([^"]*)"/)?.[1] || ''), nodes: main.children.map(node) };
}
fs.mkdirSync('src/data', { recursive: true });
fs.writeFileSync('src/data/pages.json', JSON.stringify(result));
fs.mkdirSync('legacy-static', { recursive: true });
for (const p of manifest) fs.renameSync(p.page, 'legacy-static/' + p.page);
for (const file of ['site.js', 'demo.html', 'demo-controls.js']) fs.renameSync(file, 'legacy-static/' + file);
fs.mkdirSync('public', { recursive: true });
fs.renameSync('assets', 'public/assets');
fs.copyFileSync('LICENSE.txt', 'public/LICENSE.txt');
fs.renameSync('site.css', 'src/site.css');
fs.renameSync('fluid-background.css', 'src/fluid-background.css');
let fluid = fs.readFileSync('fluid-background.js', 'utf8');
fluid = fluid.replace('(()=>{try{', `export function initFluid(canvas) {\nconst events = new AbortController();\nconst listen = (target, type, callback, options = {}) => target.addEventListener(type, callback, {...options, signal: events.signal});\ntry {`);
fluid = fluid.replace("const canvas = document.getElementById('site-fluid');", '');
for (const target of ['window', 'document', 'canvas', 'reduced']) fluid = fluid.replaceAll(target + '.addEventListener(', 'listen(' + target + ',');
fluid = fluid.replace('}catch(error){console.warn("Static background retained.",error);const canvas=document.getElementById("site-fluid");if(canvas)canvas.style.opacity="0";}})();', `return () => {events.abort(); cancelAnimationFrame(animationFrame); if(window.studioFluid) delete window.studioFluid; gl.getExtension('WEBGL_lose_context')?.loseContext();};\n}catch(error){events.abort(); console.warn("Static background retained.",error);if(canvas)canvas.style.opacity="0";}\n}`);
fs.mkdirSync('src/lib', { recursive: true });
fs.writeFileSync('src/lib/fluid.js', fluid);
fs.renameSync('fluid-background.js', 'legacy-static/fluid-background.js');
console.log('Migrated ' + Object.keys(result).length + ' pages to React content.');
