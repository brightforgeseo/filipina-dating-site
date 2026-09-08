const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
test('shared guide CTA does not promise free access to every reader',()=>{const t=fs.readFileSync('src/layouts/Article.astro','utf8');assert.doesNotMatch(t,/Join FilWest free/);assert.match(t,/href="\/pricing"[^>]*>View access options/);});
