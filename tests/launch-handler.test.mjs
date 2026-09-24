import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLaunchHandler } from '../netlify/lib/launch-handler.mjs';
const valid = {email:'TEST@example.com','launch-consent':'yes','consent-version':'launch-2026-09-24'};
const req = (data=valid, origin='https://filipinawest.com') => new Request('https://filipinawest.com/.netlify/functions/launch-list',{method:'POST',headers:{origin},body:new URLSearchParams(data)});
test('store, strong readback and duplicate preservation',async()=>{
 const values=new Map();let reads=0;
 const handler=createLaunchHandler(()=>({setJSON:async(k,v,o)=>{assert.equal(o.onlyIfNew,true);if(!values.has(k))values.set(k,v)},get:async(k,o)=>{reads++;assert.equal(o.consistency,'strong');return values.get(k)}}));
 assert.equal((await handler(req())).status,200);const first=JSON.stringify([...values]);
 assert.equal((await (await handler(req())).json()).stored,true);assert.equal(values.size,1);assert.equal(JSON.stringify([...values]),first);assert.equal(reads,2);
});
for(const [name,data,status] of [['invalid email',{...valid,email:'bad'},400],['no consent',{...valid,'launch-consent':''},400],['honeypot',{...valid,'company-website':'spam'},400],['too large',{...valid,email:'x'.repeat(3000)},413]])test(name,async()=>{const h=createLaunchHandler(()=>{throw Error('must not access storage')});assert.equal((await h(req(data))).status,status)});
test('wrong origin rejected',async()=>assert.equal((await createLaunchHandler(()=>{})(req(valid,'https://evil.example'))).status,403));
test('storage errors never produce success',async()=>{const h=createLaunchHandler(()=>({setJSON:async()=>{throw Error('down')}}));assert.equal((await h(req())).status,503)});
test('missing readback never produces success',async()=>{const h=createLaunchHandler(()=>({setJSON:async()=>{},get:async()=>null}));assert.equal((await h(req())).status,503)});
test('GET does not disclose subscribers',async()=>assert.equal((await createLaunchHandler(()=>{})(new Request('https://filipinawest.com/.netlify/functions/launch-list'))).status,405));
