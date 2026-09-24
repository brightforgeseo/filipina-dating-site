const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = path => fs.readFileSync(path, 'utf8');
test('static launch form declares Netlify capture and minimal explicit consent', () => {
  const html = read('dist/index.html');
  assert.match(html, /name="filwest-launch" method="POST" action="\/launch-list-thanks" data-netlify="true"/);
  assert.match(html, /name="form-name" value="filwest-launch"/);
  assert.match(html, /netlify-honeypot="company-website"/);
  assert.match(html, /name="email" type="email"[^>]*required/);
  assert.match(html, /type="checkbox" name="launch-consent" value="yes" required/);
  assert.doesNotMatch(html, /name="launch-consent"[^>]*checked/);
  assert.match(html, /name="consent-version" value="launch-2026-09-24"/);
  assert.match(html, /\/privacy#launch-list-privacy/);
});
test('pre-launch homepage remains indexable with commercial title and canonical', () => {
  const html = read('dist/index.html');
  assert.match(html, /<title>Filipina Dating Site &amp; App for Serious Relationships \| FilWest<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/filipinawest.com\/"/);
  assert.doesNotMatch(html, /name="robots" content="noindex/);
  assert.match(html, /dating site\./);
  assert.match(html, /Join the launch list/);
});
test('confirmation is noindex and does not pretend a direct visit subscribed', () => {
  const html = read('dist/launch-list-thanks/index.html');
  assert.match(html, /name="robots" content="noindex, follow"/);
  assert.match(html, /Visiting this page on its own does not subscribe you/);
  assert.doesNotMatch(read('public/sitemap.xml'), /launch-list-thanks/);
});
test('privacy names launch consent and processor; preview never fakes a receipt', () => {
  const privacy = read('dist/privacy/index.html');
  assert.match(privacy, /id="launch-list-privacy"/);
  assert.match(privacy, /Netlify/);
  assert.match(privacy, /withdraw consent/);
  assert.match(read('src/components/marketing/LaunchList.astro'), /event.preventDefault\(\)/);
  assert.match(read('src/components/marketing/LaunchList.astro'), /No address has been submitted/);
});
