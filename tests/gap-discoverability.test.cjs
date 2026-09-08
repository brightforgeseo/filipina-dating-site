const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = route => fs.readFileSync(path.join(root, 'dist', route, 'index.html'), 'utf8');
test('public schema uses factual identity and preferred breadcrumb URLs without invented proof', () => {
  for (const route of ['', 'tl', 'pricing', 'guides', 'guides/first-video-call-tips']) {
    const body=html(route);
    const blocks=[...body.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
    assert.equal(blocks.length,1,route);
    const graph=blocks[0]['@graph'];
    assert.ok(graph.some(n=>n['@type']==='Organization' && n.name==='FilWest'));
    assert.ok(graph.some(n=>n['@type']==='WebSite' && n.url==='https://filipinawest.com/'));
    assert.doesNotMatch(JSON.stringify(graph), /aggregateRating|reviewCount|priceCurrency|datePublished|dateModified/);
    if (route==='guides/first-video-call-tips') {
      const article=graph.find(n=>n['@type']==='Article');
      assert.equal(article.headline,'First video call with a Filipina: timing, conversation and safety');
      assert.equal(article.mainEntityOfPage,'https://filipinawest.com/guides/first-video-call-tips');
      assert.equal(graph.find(n=>n['@type']==='BreadcrumbList').itemListElement.length,3);
    }
  }
});
test('form and app utilities are noindexed but remain crawlable; sitemap excludes them', () => {
  for (const route of ['signup','login','tl/signup','tl/login','ceb/signup','ceb/login','search','admin','verify','app','app/messages']) {
    assert.match(html(route), /<meta\b[^>]*name="robots"[^>]*content="noindex(?:,\s*follow)?"/,route);
  }
  const sitemap=fs.readFileSync(path.join(root,'dist/sitemap.xml'),'utf8');
  assert.doesNotMatch(sitemap, /\/(?:signup|login|app|admin|verify|search)(?:<|\/|\")/);
  const robots=fs.readFileSync(path.join(root,'dist/robots.txt'),'utf8');
  assert.doesNotMatch(robots,/Disallow:\s*\/app/);
});
test('canonical is absolute, query-free and uses the preferred path per locale', () => {
  for (const [route, preferred] of [['','/'], ['guides','/guides'], ['guides/red-flags-international-dating','/guides/red-flags-international-dating'], ['tl','/tl/'], ['ceb/pricing','/ceb/pricing']]) {
    const body=html(route);
    const tags=body.match(/<link\b[^>]*rel="canonical"[^>]*>/g)||[];
    assert.equal(tags.length,1,`one canonical on ${route}`);
    assert.ok(tags[0].includes(`href="https://filipinawest.com${preferred}"`),tags[0]);
  }
});
