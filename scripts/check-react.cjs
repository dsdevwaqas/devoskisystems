const fs = require('node:fs'), assert = require('node:assert/strict');
const pages = JSON.parse(fs.readFileSync('src/data/pages.json', 'utf8'));
assert.equal(Object.keys(pages).length, 53);
let images = 0, links = 0, forms = 0;
function walk(node) {
  if (typeof node === 'string') { assert(!node.includes('devoski-old.devoskisystems.com')); return; }
  if (node.tag === 'form') forms++;
  if (node.attrs.src?.startsWith('/assets/')) { assert(fs.existsSync('public' + node.attrs.src), node.attrs.src); images++; }
  if (node.attrs.href?.startsWith('/') && !node.attrs.href.startsWith('//')) {
    const [route, hash] = node.attrs.href.split('#');
    assert(pages[route], 'Missing route ' + route);
    if (hash) assert(JSON.stringify(pages[route].nodes).includes(`"id":"${hash}"`), 'Missing anchor ' + node.attrs.href);
    links++;
  }
  node.children.forEach(walk);
}
Object.values(pages).forEach(page => page.nodes.forEach(walk));
assert.equal(forms, 2);
const build = fs.readdirSync('dist/assets').filter(f => f.endsWith('.js')).map(f => fs.readFileSync('dist/assets/' + f, 'utf8')).join('\n');
for (const secret of ['recaptcha_secret', 'smtp_password', 'test-not-a-real-password']) assert(!build.includes(secret), 'Private configuration leaked into build');
if (fs.existsSync('server/config.php')) {
  const config = fs.readFileSync('server/config.php', 'utf8');
  const secret = config.match(/'recaptcha_secret'\s*=>\s*'([^']+)'/)?.[1];
  if (secret) assert(!build.includes(secret), 'Private CAPTCHA secret leaked into build');
}
assert(!build.includes('devoski-old.devoskisystems.com'));
assert(fs.existsSync('dist/api/contact.php'));
assert(fs.existsSync('dist/.htaccess'));
assert(!fs.existsSync('dist/server'));
assert(!fs.existsSync('dist/config.php'));
console.log(`PASS: 53 React routes, ${links} content links, ${images} content images, 2 React forms, isolated PHP configuration.`);
