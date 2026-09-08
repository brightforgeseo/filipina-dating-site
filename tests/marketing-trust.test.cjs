const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
test('hero profile is explicitly an illustration',()=>assert.match(fs.readFileSync(require('node:path').join(__dirname,'../src/components/marketing/Hero.astro'),'utf8'),/data-profile-illustration/));
for (const lang of ['en','tl','ceb']) test(`${lang}: marketing uses guidance, not fabricated proof`,()=>{
 const file=require('node:path').join(__dirname,`../src/i18n/${lang}.ts`);
 const output={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:output});
 const d=output[lang];
 assert.doesNotMatch(JSON.stringify(d.safety.rows),/99\.2|4421|verified|6 months/i);
 assert.doesNotMatch(JSON.stringify(d.stories),/David|Marcus|Rhea|Mariel|Angeline/);
 assert.doesNotMatch(JSON.stringify(d.auth.login),/38|David|member since|99\.2/);
 assert.doesNotMatch(JSON.stringify([d.hero,d.features,d.how,d.safety,d.different,d.safetyPage,d.showcase]),/human.reviewed|human team|encrypted video|no re-login|never see them again|Inactive profiles are hidden automatically/i);
 assert.doesNotMatch(d.hero.chip,/iOS|Android/);
 assert.doesNotMatch(JSON.stringify([d.how,d.safety,d.safetyPage]),/live selfie/i);
});
