const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const ts=require('typescript');
const root=path.resolve(__dirname,'..');
test('guide hub groups all nineteen local article owners and homepage links to useful decision pages',()=>{
 const hub=fs.readFileSync(path.join(root,'dist/guides/index.html'),'utf8');
 for(const group of ['Choose Your Next Step','Choosing a Dating Site','Culture and Expectations','Conversations and Safety','Distance and Communication','Your First Meeting']) assert.ok(hub.includes(group),group);
 const owners=[...hub.matchAll(/href="(\/guides\/[^"#?]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(owners).size,19);
 for(const owner of owners) assert.ok(fs.existsSync(path.join(root,'dist',owner,'index.html')),owner);
 const home=fs.readFileSync(path.join(root,'dist/index.html'),'utf8');
 assert.match(home,/data-home-decisions/);
});
test('shared fallback metadata does not restore unsupported verification or platform parity claims',()=>{
 const layout=fs.readFileSync(path.join(root,'src/layouts/Site.astro'),'utf8');
 assert.doesNotMatch(layout,/description = '[^']*(?:Verified profiles|on the web and on the app)/);
});
const html=route=>fs.readFileSync(path.join(root,'dist',route,'index.html'),'utf8');
test('pricing explains unconfirmed currency, entitlements and renewal rather than selling unsupported plans',()=>{
 const body=html('pricing');
 assert.match(body,/data-access-clarity/);
 for(const phrase of ['Western Men', 'Currency', 'Renewal', 'VIP', 'not confirmed']) assert.ok(body.includes(phrase),phrase);
 assert.doesNotMatch(body,/\$19|\$49/);
});
test('safety adds layered video caution and an off-platform reporting route without response promises',()=>{
 const body=html('safety');
 assert.match(body,/data-safety-response/);
 assert.match(body,/video call does not prove/);
 assert.match(body,/mailto:/);
 assert.match(body,/ic3.gov/);
 assert.doesNotMatch(body,/within 24 hours|reviews every report|live video can.t be faked/);
});
function dict(lang){const output={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,`src/i18n/${lang}.ts`),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:output});return output[lang];}
test('English homepage owns the category and includes men abroad without fake product proof',()=>{
 const d=dict('en'); assert.match(d.meta.home.title,/Filipina Dating Site & App/);
 assert.match([d.hero.line1,d.hero.line2,d.hero.line3].join(' '),/Filipina dating/i);
 assert.match(d.hero.body,/US/);assert.match(d.hero.body,/UK/);assert.match(d.hero.body,/Australia/);
});
for(const lang of ['en','tl','ceb'])test(`${lang}: metadata and conversion labels do not promise untested paid/free or safety features`,()=>{
 const d=dict(lang);const text=JSON.stringify(d.meta);
 assert.doesNotMatch(text,/verified|verification|translation|video call|bawat report|matag report|every report|cancel anytime|kanselahin anumang oras|kanselaha bisan kanus-a|free|libre/i);
 assert.doesNotMatch(d.hero.ctaSignup,/free|libre/i);
 assert.doesNotMatch(d.footer.tagline,/same profiles|parehong profile|parehas nga profile/i);
 assert.doesNotMatch(d.auth.signup.sub1,/free|libre/i);
});
