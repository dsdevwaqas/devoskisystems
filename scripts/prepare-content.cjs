const fs = require('node:fs');
const pages = JSON.parse(fs.readFileSync('src/data/pages.json', 'utf8'));
fs.mkdirSync('src/data/content', { recursive: true });
const routes = {};
for (const [route, page] of Object.entries(pages)) {
  const key = route === '/' ? 'home' : route.replaceAll('/', '');
  routes[route] = { key, title: page.title, description: page.description };
  fs.writeFileSync(`src/data/content/${key}.json`, JSON.stringify(page.nodes));
}
fs.writeFileSync('src/data/routes.json', JSON.stringify(routes));
